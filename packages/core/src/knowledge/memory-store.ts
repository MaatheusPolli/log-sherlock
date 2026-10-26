import { cosine, tokenize } from "../cluster/similarity.js";
import type { KnownIssue } from "../domain/known-issue.js";
import type { KnowledgeStore, Scored } from "../ports/store.js";

interface Row {
  issue: KnownIssue;
  embedding: number[];
  tokens: Set<string>;
}

export const searchableText = (i: KnownIssue): string =>
  [i.signature, i.symptom, i.rootCause, i.integration ?? "", i.tags.join(" ")].join("\n");

/** Store em memória: testes, CLI offline e ambientes sem Postgres. */
export class MemoryKnowledgeStore implements KnowledgeStore {
  private rows = new Map<string, Row>();

  async upsert(issue: KnownIssue, embedding: number[]): Promise<void> {
    const prev = this.rows.get(issue.id)?.issue;
    // Reindexar a base não zera o histórico de uso.
    const merged = prev ? { ...issue, occurrences: prev.occurrences, lastSeen: prev.lastSeen } : issue;
    this.rows.set(issue.id, { issue: merged, embedding, tokens: new Set(tokenize(searchableText(issue))) });
  }

  async get(id: string) {
    return this.rows.get(id)?.issue;
  }

  async bySignatureHash(hash: string) {
    for (const r of this.rows.values()) if (r.issue.signatureHash === hash) return r.issue;
    return undefined;
  }

  async vectorSearch(embedding: number[], limit: number): Promise<Scored[]> {
    return [...this.rows.values()]
      .map((r) => ({ issue: r.issue, score: cosine(embedding, r.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /** Fração dos termos da consulta presentes no caso (0..1). */
  async textSearch(query: string, limit: number): Promise<Scored[]> {
    const terms = [...new Set(tokenize(query))];
    if (!terms.length) return [];
    return [...this.rows.values()]
      .map((r) => ({ issue: r.issue, score: terms.filter((t) => r.tokens.has(t)).length / terms.length }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async list() {
    return [...this.rows.values()].map((r) => r.issue);
  }

  async recordUse(id: string, at: string) {
    const r = this.rows.get(id);
    if (!r) return;
    r.issue = { ...r.issue, occurrences: r.issue.occurrences + 1, lastSeen: at };
  }
}
