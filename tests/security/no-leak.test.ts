import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { collect } from "../../packages/core/src/parse/parse.js";
import type { LlmPort, LlmRequest } from "../../packages/core/src/ports/llm.js";
import { guardLlm } from "../../packages/core/src/redact/guard.js";
import { findSensitive, joinRedacted, redact, redactLines } from "../../packages/core/src/redact/redact.js";
import { analyze } from "../../packages/core/src/app/analyze.js";
import { LocalEmbedding } from "../../packages/core/src/knowledge/embeddings.js";
import { MemoryKnowledgeStore } from "../../packages/core/src/knowledge/memory-store.js";

// Valores literais plantados em sensitive.log; nenhum deles pode chegar ao LLM.
const PLANTED = [
  "maria.souza@gmail.com",
  "529.982.247-25",
  "52998224725",
  "11.222.333/0001-81",
  "11222333000181",
  "3524 0511 2223 3300 0181",
  "eyJhbGciOiJIUzI1NiJ9",
  "vtexappkey-lojax-ABCDEF",
  "QWERTYUIOPASDFGHJKLZXCVBNM123456",
  "sk-ant-api03-abcdefghijklmnopqrstuv",
  "Sup3rS3cr3t!",
  "cs_9f8e7d6c",
  "minhaSenha123",
  "4111 1111 1111 1111",
  "AKIAIOSFODNN7EXAMPLE",
  "sk_live_51HxYzAbCdEfGhIjKl",
  "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
  "abc123def456",
  "hunter2",
  "dXN1YXJpbzpzZW5oYTEyMw==",
  "MIIEowIBAAKCAQEA",
];

/** Porta espiã: registra exatamente o que seria enviado ao provedor. */
function spyPort(): LlmPort & { sent: LlmRequest[] } {
  const sent: LlmRequest[] = [];
  return { sent, complete: async (req) => (sent.push(req), { text: "ok" }) };
}

const serialized = (reqs: LlmRequest[]) => JSON.stringify(reqs);

describe("no-leak: nada sensível chega à porta do LLM", () => {
  it("log com dados sensíveis: parse → redação → porta", async () => {
    const spy = spyPort();
    const llm = guardLlm(spy);
    const entries = await collect(readFileSync("tests/fixtures/logs/sensitive.log", "utf8"));

    // Mensagem e stack de cada entrada, como o diagnóstico fará.
    const content = joinRedacted(entries.map((e) => redact([e.message, ...e.stack].join("\n"))));
    await llm.complete({ system: "Você é um analista de integrações.", messages: [{ role: "user", content }] });

    expect(spy.sent).toHaveLength(1);
    const out = serialized(spy.sent);
    for (const value of PLANTED) expect(out, `vazou: ${value}`).not.toContain(value);
    expect(findSensitive(spy.sent[0]!.messages[0]!.content)).toEqual([]);
  });

  it("log bruto inteiro, linha a linha, também sai limpo", async () => {
    const spy = spyPort();
    const raw = readFileSync("tests/fixtures/logs/sensitive.log", "utf8");
    await guardLlm(spy).complete({ system: "s", messages: [{ role: "user", content: redact(raw) }] });
    const out = serialized(spy.sent);
    for (const value of PLANTED) expect(out, `vazou: ${value}`).not.toContain(value);
  });

  it("nenhuma fixture de log vaza após redação", async () => {
    for (const file of readdirSync("tests/fixtures/logs")) {
      const redacted = redact(readFileSync(`tests/fixtures/logs/${file}`, "utf8"));
      expect(findSensitive(redacted), file).toEqual([]);
    }
  });

  it("chave PEM com linhas sem indentação não vaza (análise e streaming linha a linha)", async () => {
    const body = "MIIEowIBAAKCAQEA7bq98Yz2kLmN3pQrStUvWxYz0123456789AbCdEfGhIj";
    const log = [
      "2024-05-10 10:00:00 [ERROR] falha ao carregar certificado",
      "-----BEGIN PRIVATE KEY-----",
      body,
      "Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZmdoaWprbG1ub3Bxcg==",
      "-----END PRIVATE KEY-----",
      "2024-05-10 10:00:01 [ERROR] depois",
    ];
    const streamed: string[] = [];
    for await (const l of redactLines(log)) streamed.push(l);
    expect(streamed.join("\n")).not.toContain(body);
    expect(streamed.join("\n")).not.toContain("Zm9vYmFy");
    expect(streamed[5]).toBe("2024-05-10 10:00:01 [ERROR] depois");

    const report = await analyze(log, { store: new MemoryKnowledgeStore(), embeddings: new LocalEmbedding() });
    const out = JSON.stringify(report);
    expect(out).not.toContain(body);
    expect(out).not.toContain("Zm9vYmFy");
  });

  it("se a redação for pulada, o envio é bloqueado e nada sai", async () => {
    const spy = spyPort();
    const raw = readFileSync("tests/fixtures/logs/sensitive.log", "utf8");
    await expect(
      // Simula um bug que contorna o tipo com cast.
      guardLlm(spy).complete({ system: "s", messages: [{ role: "user", content: raw as never }] }),
    ).rejects.toThrow(/bloqueado/);
    expect(spy.sent).toHaveLength(0);
  });
});
