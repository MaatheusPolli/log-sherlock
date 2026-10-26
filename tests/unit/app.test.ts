import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyze } from "../../packages/core/src/app/analyze.js";
import { createCase, CaseValidationError, slugify } from "../../packages/core/src/app/cases.js";
import { createContext } from "../../packages/core/src/app/context.js";
import { MetricsStore } from "../../packages/core/src/app/metrics.js";
import { LocalEmbedding } from "../../packages/core/src/knowledge/embeddings.js";
import { MemoryKnowledgeStore } from "../../packages/core/src/knowledge/memory-store.js";
import { redactLines } from "../../packages/core/src/redact/redact.js";
import type { AnalysisReport } from "../../packages/core/src/app/analyze.js";

const LOG = [
  "2026-10-20 10:00:01 ERROR VTEX 401 Unauthorized token expirado",
  "2026-10-20 10:00:05 ERROR VTEX 401 Unauthorized token expirado",
  "2026-10-20 10:00:09 ERROR VTEX 401 Unauthorized token expirado",
].join("\n");

describe("analyze", () => {
  it("agrupa, busca casos e não chama o LLM quando não há modelo configurado", async () => {
    const store = new MemoryKnowledgeStore();
    const embeddings = new LocalEmbedding();
    const report = await analyze(LOG, { store, embeddings }, { diagnoseTop: 3 });
    expect(report.entries).toBe(3);
    expect(report.groups).toHaveLength(1);
    expect(report.groups[0]!.count).toBe(3);
    expect(report.groups[0]!.diagnosis).toBeUndefined();
    expect(report.id).toMatch(/[0-9a-f-]{36}/);
  });
});

describe("MetricsStore", () => {
  const report = (day: string, hash: string, count: number): AnalysisReport => ({
    id: "r",
    createdAt: `${day}T12:00:00.000Z`,
    entries: count,
    malformed: 0,
    groups: [{ signature: `sig ${hash}`, hash, variants: [], count, firstLine: 1, lastLine: count, levels: {}, sample: "", candidates: [] }],
  });

  it("agrega ocorrências por dia, top erros e feedback sem persistir arquivo quando não há caminho", async () => {
    const m = await new MetricsStore().load();
    const today = new Date("2026-10-20T15:00:00.000Z");
    await m.recordAnalysis(report("2026-10-20", "aaa", 4));
    await m.recordAnalysis(report("2026-10-19", "aaa", 2));
    await m.recordAnalysis(report("2026-10-20", "bbb", 1));
    await m.recordFeedback({ at: "2026-10-20T16:00:00.000Z", signatureHash: "aaa", issueId: "x", resolved: true });
    await m.recordFeedback({ at: "2026-10-20T16:00:00.000Z", signatureHash: "aaa", resolved: false });

    const d = m.dashboard(2, today);
    expect(d.trend).toEqual([
      { day: "2026-10-19", count: 2 },
      { day: "2026-10-20", count: 5 },
    ]);
    expect(d.topErrors[0]).toEqual({ hash: "aaa", signature: "sig aaa", count: 6 });
    expect(d.feedback).toEqual({ resolved: 1, notResolved: 1 });
  });

  it("persiste em JSON e recarrega o estado", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "ls-metrics-")), "metrics.json");
    const m = await new MetricsStore(file).load();
    await m.recordAnalysis(report("2026-10-20", "ccc", 3));
    expect(existsSync(file)).toBe(true);
    const again = await new MetricsStore(file).load();
    expect(again.dashboard(1, new Date("2026-10-20T12:00:00.000Z")).trend[0]!.count).toBe(3);
    expect(JSON.parse(readFileSync(file, "utf8")).signatures.ccc).toBe("sig ccc");
  });
});

describe("createCase", () => {
  const dir = mkdtempSync(join(tmpdir(), "ls-cases-"));
  const deps = () => ({ dir, store: new MemoryKnowledgeStore(), embeddings: new LocalEmbedding() });
  const input = {
    integration: "VTEX",
    signature: "VTEX 401 Unauthorized credencial vencida",
    symptom: "Falha 401 ao sincronizar pedidos",
    rootCause: "Token expirou do lado do parceiro",
    fix: "Renovar a credencial e reenviar a fila",
    tags: ["auth"],
  };

  it("grava o Markdown, indexa e gera id único quando o slug já existe", async () => {
    const d = deps();
    const first = await createCase(input, d);
    const second = await createCase(input, d);
    expect(first.id).not.toBe(second.id);
    expect(existsSync(join(dir, `${first.id}.md`))).toBe(true);
    expect(await d.store.get(second.id)).toBeDefined();
    expect(readFileSync(join(dir, `${first.id}.md`), "utf8")).toContain("Renovar a credencial");
  });

  it("recusa campos obrigatórios vazios", async () => {
    await expect(createCase({ ...input, fix: "  " }, deps())).rejects.toBeInstanceOf(CaseValidationError);
  });

  it("recusa caso com dado sensível", async () => {
    await expect(createCase({ ...input, rootCause: "CPF 123.456.789-09 bloqueado" }, deps())).rejects.toThrow(/sensíveis/);
  });

  it("usa o nome da integração quando não há id", async () => {
    const issue = await createCase({ ...input, integration: "Mercado Livre", symptom: "x" }, deps());
    expect(issue.id.startsWith("mercado-livre")).toBe(true);
  });

  it("slugify remove acentos e placeholders", () => {
    expect(slugify("Nota Fiscal <URL> Rejeição")).toBe("nota-fiscal-rejeicao");
  });
});

describe("createContext", () => {
  it("monta contexto offline (memória, embedding local, sem LLM) a partir de uma base vazia", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ls-kb-"));
    const ctx = await createContext({ KNOWLEDGE_DIR: dir });
    expect(ctx.llm).toBeUndefined();
    expect(ctx.describe).toBe("memória · embedding local · sem LLM");
    expect(await ctx.store.list()).toEqual([]);
  });
});

describe("redactLines em stream", () => {
  it("redige um bloco de chave privada inteiro, inclusive linhas internas", async () => {
    const found: Record<string, number> = {};
    const lines = ["inicio", "-----BEGIN PRIVATE KEY-----", "MIIEvQIBADANBg", "-----END PRIVATE KEY-----", "fim"];
    const out: string[] = [];
    async function* src() {
      yield* lines;
    }
    for await (const l of redactLines(src(), found)) out.push(l);
    expect(out.join("\n")).not.toContain("MIIEvQ");
    expect(out[0]).toBe("inicio");
    expect(out[4]).toBe("fim");
    expect(found.CHAVE_PRIVADA).toBe(1);
  });
});

describe("redactLines contagem por tipo", () => {
  it("soma ocorrências do mesmo tipo entre linhas", async () => {
    const found: Record<string, number> = {};
    const out: string[] = [];
    async function* src() {
      yield "contato a@b.com";
      yield "contato c@d.com";
    }
    for await (const l of redactLines(src(), found)) out.push(l);
    expect(out.join("\n")).not.toContain("@");
    expect(found.EMAIL).toBe(2);
  });
});
