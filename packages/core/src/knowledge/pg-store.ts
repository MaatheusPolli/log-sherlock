import type pg from "pg";
import { tokenize } from "../cluster/similarity.js";
import type { KnownIssue } from "../domain/known-issue.js";
import type { KnowledgeStore, Scored } from "../ports/store.js";
import { searchableText } from "./memory-store.js";

type Queryable = Pick<pg.Pool, "query">;

interface IssueRow {
  id: string;
  signature: string;
  signature_hash: string;
  symptom: string;
  root_cause: string;
  fix: string;
  integration: string | null;
  tags: string[];
  occurrences: number;
  last_seen: Date | null;
  score?: number;
}

const toIssue = (r: IssueRow): KnownIssue => ({
  id: r.id,
  signature: r.signature,
  signatureHash: r.signature_hash,
  symptom: r.symptom,
  rootCause: r.root_cause,
  fix: r.fix,
  integration: r.integration ?? undefined,
  tags: r.tags,
  occurrences: r.occurrences,
  lastSeen: r.last_seen?.toISOString(),
});

const COLUMNS = "id, signature, signature_hash, symptom, root_cause, fix, integration, tags, occurrences, last_seen";

/** PostgreSQL + pgvector (cosseno, HNSW) + tsvector em português. */
export class PgKnowledgeStore implements KnowledgeStore {
  constructor(
    private readonly db: Queryable,
    private readonly dimensions: number,
  ) {}

  async migrate(): Promise<void> {
    await this.db.query(`
      CREATE EXTENSION IF NOT EXISTS vector;
      CREATE EXTENSION IF NOT EXISTS unaccent;
      CREATE TABLE IF NOT EXISTS known_issue (
        id text PRIMARY KEY,
        signature text NOT NULL,
        signature_hash text NOT NULL,
        symptom text NOT NULL,
        root_cause text NOT NULL,
        fix text NOT NULL,
        integration text,
        tags text[] NOT NULL DEFAULT '{}',
        occurrences int NOT NULL DEFAULT 0,
        last_seen timestamptz,
        search_text text NOT NULL,
        tsv tsvector NOT NULL,
        embedding vector(${this.dimensions}) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS known_issue_hash_idx ON known_issue (signature_hash);
      CREATE INDEX IF NOT EXISTS known_issue_tsv_idx ON known_issue USING gin (tsv);
      CREATE INDEX IF NOT EXISTS known_issue_embedding_idx ON known_issue USING hnsw (embedding vector_cosine_ops);
    `);
  }

  async upsert(issue: KnownIssue, embedding: number[]): Promise<void> {
    await this.db.query(
      `INSERT INTO known_issue (id, signature, signature_hash, symptom, root_cause, fix, integration, tags, search_text, tsv, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, to_tsvector('portuguese', unaccent($9)), $10::vector)
       ON CONFLICT (id) DO UPDATE SET
         signature = EXCLUDED.signature, signature_hash = EXCLUDED.signature_hash, symptom = EXCLUDED.symptom,
         root_cause = EXCLUDED.root_cause, fix = EXCLUDED.fix, integration = EXCLUDED.integration, tags = EXCLUDED.tags,
         search_text = EXCLUDED.search_text, tsv = EXCLUDED.tsv, embedding = EXCLUDED.embedding`,
      [
        issue.id,
        issue.signature,
        issue.signatureHash,
        issue.symptom,
        issue.rootCause,
        issue.fix,
        issue.integration ?? null,
        issue.tags,
        searchableText(issue),
        JSON.stringify(embedding),
      ],
    );
  }

  async get(id: string) {
    const { rows } = await this.db.query<IssueRow>(`SELECT ${COLUMNS} FROM known_issue WHERE id = $1`, [id]);
    return rows[0] && toIssue(rows[0]);
  }

  async bySignatureHash(hash: string) {
    const { rows } = await this.db.query<IssueRow>(
      `SELECT ${COLUMNS} FROM known_issue WHERE signature_hash = $1 ORDER BY occurrences DESC LIMIT 1`,
      [hash],
    );
    return rows[0] && toIssue(rows[0]);
  }

  async vectorSearch(embedding: number[], limit: number): Promise<Scored[]> {
    const { rows } = await this.db.query<IssueRow>(
      `SELECT ${COLUMNS}, 1 - (embedding <=> $1::vector) AS score FROM known_issue ORDER BY embedding <=> $1::vector LIMIT $2`,
      [JSON.stringify(embedding), limit],
    );
    return rows.map((r) => ({ issue: toIssue(r), score: Number(r.score) }));
  }

  async textSearch(query: string, limit: number): Promise<Scored[]> {
    // Qualquer termo casa (OR); tokens só têm [a-z0-9], então são seguros para to_tsquery.
    const terms = [...new Set(tokenize(query))];
    if (!terms.length) return [];
    // ts_rank_cd com normalização 32 (rank/(rank+1)) fica em 0..1.
    const { rows } = await this.db.query<IssueRow>(
      `SELECT ${COLUMNS}, ts_rank_cd(tsv, q, 32) AS score
         FROM known_issue, to_tsquery('portuguese', $1) q
        WHERE tsv @@ q ORDER BY score DESC LIMIT $2`,
      [terms.join(" | "), limit],
    );
    return rows.map((r) => ({ issue: toIssue(r), score: Number(r.score) }));
  }

  async list() {
    const { rows } = await this.db.query<IssueRow>(`SELECT ${COLUMNS} FROM known_issue ORDER BY id`);
    return rows.map(toIssue);
  }

  async recordUse(id: string, at: string) {
    await this.db.query(`UPDATE known_issue SET occurrences = occurrences + 1, last_seen = $2 WHERE id = $1`, [id, at]);
  }
}
