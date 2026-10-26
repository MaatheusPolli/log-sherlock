import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { KnownIssue } from "../../packages/core/src/domain/known-issue.js";
import { LocalEmbedding, VoyageEmbedding } from "../../packages/core/src/knowledge/embeddings.js";
import { indexIssues, indexKnowledgeBase } from "../../packages/core/src/knowledge/indexer.js";
import {
  KnowledgeFormatError,
  loadKnowledgeBase,
  parseFrontMatter,
  parseIssue,
  toMarkdown,
} from "../../packages/core/src/knowledge/loader.js";
import { MemoryKnowledgeStore } from "../../packages/core/src/knowledge/memory-store.js";
import { searchKnownIssues } from "../../packages/core/src/knowledge/search.js";
import { signatureOf } from "../../packages/core/src/normalize/signature.js";
import { redact } from "../../packages/core/src/redact/redact.js";

const CASE = `---
id: exemplo
signature: "HTTP 401 Unauthorized POST <URL> invalid token"   # comentário
integration: vtex
tags: [http, "auth"]
---
## Sintoma
Falha 401.

## Causa
Token expirou.

## Correção
1. Renovar.
`;

describe("loader", () => {
  it("lê front-matter e seções", () => {
    const issue = parseIssue(CASE);
    expect(issue).toMatchObject({
      id: "exemplo",
      signature: "HTTP 401 Unauthorized POST <URL> invalid token",
      integration: "vtex",
      tags: ["http", "auth"],
      symptom: "Falha 401.",
      rootCause: "Token expirou.",
      fix: "1. Renovar.",
      occurrences: 0,
    });
    expect(issue.signatureHash).toBe(signatureOf("HTTP 401 Unauthorized POST https://x/y invalid token").hash);
  });

  it("parseFrontMatter: aspas simples, tag única e linhas inválidas", () => {
    expect(parseFrontMatter("a: 'x'\nlixo\ntags: auth")).toEqual({ a: "x", tags: "auth" });
    expect(parseIssue(CASE.replace("tags: [http, \"auth\"]", "tags: auth")).tags).toEqual(["auth"]);
    expect(parseIssue(CASE.replace(/tags:.*\n/, "").replace(/integration:.*\n/, ""))).toMatchObject({
      tags: [],
      integration: undefined,
    });
  });

  it.each([
    ["sem front-matter", "## Sintoma\nx", /front-matter/],
    ["sem id", CASE.replace("id: exemplo\n", ""), /id obrigatório/],
    ["sem assinatura", CASE.replace(/signature:.*\n/, ""), /signature obrigatório/],
    ["sem causa", CASE.replace("## Causa\nToken expirou.\n", ""), /rootCause ausente/],
  ])("erro: %s", (_n, md, msg) => {
    expect(() => parseIssue(md, "x.md")).toThrow(KnowledgeFormatError);
    expect(() => parseIssue(md, "x.md")).toThrow(msg);
  });

  it("toMarkdown ida e volta", () => {
    const issue = parseIssue(CASE);
    expect(parseIssue(toMarkdown(issue))).toEqual(issue);
    const { integration: _, ...semIntegracao } = issue;
    expect(toMarkdown(semIntegracao)).not.toContain("integration:");
  });

  it("carrega a base real (15+ casos) e rejeita id duplicado", async () => {
    const issues = await loadKnowledgeBase("knowledge-base");
    expect(issues.length).toBeGreaterThanOrEqual(15);
    expect(new Set(issues.map((i) => i.signatureHash)).size).toBe(issues.length);

    const dir = mkdtempSync(join(tmpdir(), "kb-"));
    writeFileSync(join(dir, "a.md"), CASE);
    writeFileSync(join(dir, "b.md"), CASE);
    writeFileSync(join(dir, "README.md"), "# ignorado");
    await expect(loadKnowledgeBase(dir)).rejects.toThrow(/duplicado/);
  });
});

describe("LocalEmbedding", () => {
  const emb = new LocalEmbedding(64);

  it("determinístico, normalizado e com a dimensão pedida", async () => {
    const [a, b] = await emb.embed([redact("read ECONNRESET"), redact("read ECONNRESET")]);
    expect(a).toEqual(b);
    expect(a).toHaveLength(64);
    expect(Math.hypot(...a!)).toBeCloseTo(1);
  });

  it("texto sem tokens vira vetor nulo", () => {
    expect(emb.embedOne("<NUM> <URL>").every((x) => x === 0)).toBe(true);
  });
});

describe("VoyageEmbedding", () => {
  it("chama a API com Bearer e reordena pelo índice", async () => {
    let body: unknown;
    let auth: string | undefined;
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      auth = (init.headers as Record<string, string>).authorization;
      return new Response(JSON.stringify({ data: [{ index: 1, embedding: [2] }, { index: 0, embedding: [1] }] }));
    }) as unknown as typeof fetch;
    const voyage = new VoyageEmbedding("chave-teste", "voyage-3", fakeFetch);
    expect(await voyage.embed([redact("a"), redact("b")])).toEqual([[1], [2]]);
    expect(body).toEqual({ input: ["a", "b"], model: "voyage-3" });
    expect(auth).toBe("Bearer chave-teste");
    expect(voyage.dimensions).toBe(1024);
    expect(await voyage.embed([])).toEqual([]);
  });

  it("propaga erro HTTP", async () => {
    const fakeFetch = (async () => new Response("x", { status: 500 })) as unknown as typeof fetch;
    await expect(new VoyageEmbedding("k", undefined, fakeFetch).embed([redact("a")])).rejects.toThrow(/HTTP 500/);
  });

  it("repete em 429 e desiste depois do limite de tentativas", async () => {
    let calls = 0;
    const limitedThenOk = (async () => {
      calls++;
      return calls < 3
        ? new Response("slow down", { status: 429 })
        : new Response(JSON.stringify({ data: [{ index: 0, embedding: [7] }] }));
    }) as unknown as typeof fetch;
    expect(await new VoyageEmbedding("k", undefined, limitedThenOk, 1).embed([redact("a")])).toEqual([[7]]);
    expect(calls).toBe(3);

    calls = 0;
    const alwaysLimited = (async () => (calls++, new Response("x", { status: 429 }))) as unknown as typeof fetch;
    await expect(new VoyageEmbedding("k", undefined, alwaysLimited, 1).embed([redact("a")])).rejects.toThrow(/HTTP 429/);
    expect(calls).toBe(6);
  });
});

describe("MemoryKnowledgeStore", () => {
  it("upsert preserva histórico de uso; recordUse ignora id inexistente", async () => {
    const store = new MemoryKnowledgeStore();
    const issue = parseIssue(CASE);
    await store.upsert(issue, [1, 0]);
    await store.recordUse("exemplo", "2024-05-10T00:00:00Z");
    await store.recordUse("nao-existe", "2024-05-10T00:00:00Z");
    await store.upsert({ ...issue, symptom: "novo" }, [1, 0]);
    expect(await store.get("exemplo")).toMatchObject({ symptom: "novo", occurrences: 1, lastSeen: "2024-05-10T00:00:00Z" });
    expect(await store.list()).toHaveLength(1);
    expect(await store.bySignatureHash("nada")).toBeUndefined();
    expect(await store.textSearch("<NUM>", 3)).toEqual([]);
  });
});

describe("busca híbrida (base real + embedding local)", () => {
  const setup = async () => {
    const store = new MemoryKnowledgeStore();
    const emb = new LocalEmbedding();
    expect(await indexKnowledgeBase("knowledge-base", store, emb)).toBeGreaterThanOrEqual(15);
    return { store, emb, search: (msg: string) => searchKnownIssues(signatureOf(msg), store, emb) };
  };

  it("assinatura exata tem prioridade e retorna um único caso", async () => {
    const { search } = await setup();
    const r = await search("HTTP 401 Unauthorized POST https://outra.vtexcommercestable.com.br/api/x/99999 invalid or expired app token");
    expect(r).toEqual([expect.objectContaining({ via: "assinatura", score: 1 })]);
    expect(r[0]!.issue.id).toBe("vtex-401-token-expirado");
  });

  it.each([
    ["Rejeição 539: Duplicidade de NF-e [chNFe:35240511222333000181550010000012341000012345]", "nfe-rejeicao-539"],
    ["SqlException: Transaction (Process ID 88) was deadlocked on lock resources", "deadlock-pedido-estoque"],
    ["read ECONNRESET while calling payment gateway", "node-econnreset-gateway"],
    ["HTTP 429 Too Many Requests POST https://api.mercadolibre.com/orders", "meli-429-rate-limit"],
  ])("sem match exato cai para vetorial: %s", async (msg, id) => {
    const { search } = await setup();
    const r = await search(msg);
    expect(r[0]).toMatchObject({ via: "vetorial", issue: { id } });
  });

  it("vetorial vazio cai para textual", async () => {
    const { store, emb } = await setup();
    const r = await searchKnownIssues(signatureOf("rate limit mercadolivre estoque"), store, emb, { minVectorScore: 0.99 });
    expect(r[0]).toMatchObject({ via: "textual", issue: { id: "meli-429-rate-limit" } });
  });

  it("erro sem caso compatível não retorna nada", async () => {
    const { search } = await setup();
    expect(await search("Kafka consumer group rebalance failed")).toEqual([]);
    expect(await search("HTTP 500 Internal Server Error POST https://api.x.com/pedidos")).toEqual([]);
  });

  it("base vazia não retorna nada", async () => {
    const store = new MemoryKnowledgeStore();
    const emb = new LocalEmbedding();
    await indexIssues([] as KnownIssue[], store, emb);
    expect(await searchKnownIssues(signatureOf("Error: read ECONNRESET"), store, emb)).toEqual([]);
  });
});
