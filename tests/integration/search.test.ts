import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LocalEmbedding } from "../../packages/core/src/knowledge/embeddings.js";
import { indexKnowledgeBase } from "../../packages/core/src/knowledge/indexer.js";
import { PgKnowledgeStore } from "../../packages/core/src/knowledge/pg-store.js";
import { searchKnownIssues } from "../../packages/core/src/knowledge/search.js";
import { signatureOf } from "../../packages/core/src/normalize/signature.js";

function dockerAvailable(): boolean {
  try {
    execSync("docker info", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Roda no CI (Docker disponível); localmente sem Docker é pulado.
describe.skipIf(!dockerAvailable())("PgKnowledgeStore (Testcontainers + pgvector)", () => {
  const emb = new LocalEmbedding();
  let store: PgKnowledgeStore;
  let stop: () => Promise<unknown>;

  beforeAll(async () => {
    const { PostgreSqlContainer } = await import("@testcontainers/postgresql");
    const pg = (await import("pg")).default;
    const container = await new PostgreSqlContainer("pgvector/pgvector:pg16").start();
    const pool = new pg.Pool({ connectionString: container.getConnectionUri() });
    store = new PgKnowledgeStore(pool, emb.dimensions);
    await store.migrate();
    await indexKnowledgeBase("knowledge-base", store, emb);
    stop = async () => {
      await pool.end();
      await container.stop();
    };
  }, 120_000);

  afterAll(async () => stop?.());

  it("assinatura exata → vetorial → textual", async () => {
    const exact = await searchKnownIssues(
      signatureOf("HTTP 401 Unauthorized POST https://a.vtexcommercestable.com.br/x invalid or expired app token"),
      store,
      emb,
    );
    expect(exact[0]).toMatchObject({ via: "assinatura", issue: { id: "vtex-401-token-expirado" } });

    const vector = await searchKnownIssues(signatureOf("read ECONNRESET while calling payment gateway"), store, emb);
    expect(vector[0]).toMatchObject({ via: "vetorial", issue: { id: "node-econnreset-gateway" } });

    const text = await searchKnownIssues(signatureOf("rate limit mercadolivre estoque"), store, emb, { minVectorScore: 0.99, minTextScore: 0 });
    expect(text[0]).toMatchObject({ via: "textual", issue: { id: "meli-429-rate-limit" } });
  });

  it("reindexar preserva uso; get/list", async () => {
    await store.recordUse("nfe-rejeicao-539", "2024-05-10T00:00:00.000Z");
    await indexKnowledgeBase("knowledge-base", store, emb);
    expect(await store.get("nfe-rejeicao-539")).toMatchObject({ occurrences: 1, lastSeen: "2024-05-10T00:00:00.000Z" });
    expect((await store.list()).length).toBeGreaterThanOrEqual(15);
    expect(await store.get("nao-existe")).toBeUndefined();
    expect(await store.textSearch("<NUM>", 3)).toEqual([]);
  });
});
