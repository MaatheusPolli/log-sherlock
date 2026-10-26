import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { groupEntries } from "../../packages/core/src/cluster/group.js";
import { AnthropicLlm } from "../../packages/core/src/diagnose/anthropic.js";
import { diagnoseGroup } from "../../packages/core/src/diagnose/diagnose.js";
import { validateDiagnosis } from "../../packages/core/src/diagnose/guardrail.js";
import { buildDiagnosisPrompt } from "../../packages/core/src/diagnose/prompts/diagnose.js";
import { LocalEmbedding } from "../../packages/core/src/knowledge/embeddings.js";
import { indexKnowledgeBase } from "../../packages/core/src/knowledge/indexer.js";
import { MemoryKnowledgeStore } from "../../packages/core/src/knowledge/memory-store.js";
import { parseLog } from "../../packages/core/src/parse/parse.js";
import type { LlmPort, LlmRequest, LlmResponse } from "../../packages/core/src/ports/llm.js";
import { findSensitive } from "../../packages/core/src/redact/redact.js";

const recorded = JSON.parse(readFileSync("tests/fixtures/llm/recorded.json", "utf8")) as Record<string, LlmResponse>;

/** LLM gravado: devolve uma resposta fixa e registra o que recebeu. */
function replay(key: keyof typeof recorded | LlmResponse): LlmPort & { calls: LlmRequest[] } {
  const calls: LlmRequest[] = [];
  const response = typeof key === "string" ? recorded[key]! : key;
  return { calls, complete: async (req) => (calls.push(req), response) };
}

async function setup(kbDir = "knowledge-base") {
  const store = new MemoryKnowledgeStore();
  const embeddings = new LocalEmbedding();
  if (kbDir) await indexKnowledgeBase(kbDir, store, embeddings);
  return { store, embeddings };
}

async function groupOf(log: string) {
  const [group] = await groupEntries(parseLog(log));
  return group!;
}

const VTEX_LOG = `2024-05-10 08:00:07,000 [ERROR] HTTP 401 Unauthorized POST https://lojax.vtexcommercestable.com.br/api/oms/pvt/orders/1334560781-01/invoice invalid or expired app token
2024-05-10 08:00:09,000 [ERROR] HTTP 401 Unauthorized POST https://lojax.vtexcommercestable.com.br/api/oms/pvt/orders/1334560799-01/invoice invalid or expired app token`;

describe("diagnóstico", () => {
  it("cita o caso usado", async () => {
    const llm = replay("vtex-401");
    const result = await diagnoseGroup(await groupOf(VTEX_LOG), { llm, ...(await setup()) });
    expect(result).toMatchObject({
      kind: "diagnostico",
      citedIssueId: "vtex-401-token-expirado",
      confidence: "alta",
      candidates: [expect.objectContaining({ via: "assinatura" })],
    });
    const req = llm.calls[0]!;
    expect(req.tools?.[0]?.name).toBe("registrar_diagnostico");
    expect(req.messages[0]!.content).toContain("### Caso vtex-401-token-expirado");
    expect(req.messages[0]!.content).toContain("Ocorrências: 2");
  });

  it("base vazia: recusa explícita, sem chamar o LLM", async () => {
    const llm = replay("vtex-401");
    const result = await diagnoseGroup(await groupOf(VTEX_LOG), { llm, ...(await setup("")) });
    expect(result).toMatchObject({ kind: "recusa", reason: "sem-caso-na-base", candidates: [] });
    expect(llm.calls).toHaveLength(0);
  });

  it("erro sem caso compatível na base real: recusa sem chamar o LLM", async () => {
    const llm = replay("vtex-401");
    const result = await diagnoseGroup(await groupOf("2024-05-10 [ERROR] Kafka consumer group rebalance failed"), {
      llm,
      ...(await setup()),
    });
    expect(result.kind).toBe("recusa");
    expect(llm.calls).toHaveLength(0);
  });

  it.each([
    ["recusa", "modelo-sem-caso-compativel", /rate limit do Mercado Livre/],
    ["citacao-inventada", "citacao-invalida", /não estava entre os candidatos/],
    ["texto-livre", "resposta-invalida", /não devolveu/],
  ])("resposta %s vira recusa (%s)", async (key, reason, msg) => {
    const result = await diagnoseGroup(await groupOf(VTEX_LOG), { llm: replay(key), ...(await setup()) });
    expect(result).toMatchObject({ kind: "recusa", reason });
    expect(result.kind === "recusa" && result.message).toMatch(msg);
  });

  it("ferramenta com outro nome é ignorada", async () => {
    const llm = replay({ toolCall: { name: "outra", input: recorded["vtex-401"]!.toolCall!.input } });
    const result = await diagnoseGroup(await groupOf(VTEX_LOG), { llm, ...(await setup()) });
    expect(result).toMatchObject({ kind: "recusa", reason: "resposta-invalida" });
  });

  it("nada sensível do log chega ao LLM durante o diagnóstico", async () => {
    const log = `2024-05-10 08:00:07,000 [ERROR] HTTP 401 Unauthorized POST https://lojax.vtexcommercestable.com.br/api/oms/pvt/orders/1334560781-01/invoice invalid or expired app token
    header X-VTEX-API-AppToken: QWERTYUIOPASDFGHJKLZXCVBNM123456
    cliente maria.souza@gmail.com CPF 529.982.247-25`;
    const llm = replay("vtex-401");
    await diagnoseGroup(await groupOf(log), { llm, ...(await setup()) });
    const sent = JSON.stringify(llm.calls);
    for (const v of ["QWERTYUIOPASDFGHJKLZXCVBNM123456", "maria.souza@gmail.com", "529.982.247-25"]) expect(sent).not.toContain(v);
    expect(findSensitive(llm.calls[0]!.messages[0]!.content)).toEqual([]);
  });
});

describe("prompt", () => {
  it("inclui HTTP, variações e stack do exemplo", async () => {
    const [group] = await groupEntries(
      parseLog("HTTP/1.1 429 Too Many Requests\n\n{\"message\":\"local_rate_limited\"}", { format: "http" }),
    );
    group!.variants.push({ text: "variante X", hash: "h" });
    group!.sample.stack.push("at f (a.js:1:1)");
    const prompt = buildDiagnosisPrompt(group!, []);
    expect(prompt).toContain("HTTP: 429");
    expect(prompt).toContain("Variações agrupadas: variante X");
    expect(prompt).toContain("Stack (topo):\nat f (a.js:1:1)");
  });

  it("validateDiagnosis rejeita formatos inválidos", () => {
    for (const raw of [null, "x", { caso_citado: 1 }, { ...recorded["vtex-401"]!.toolCall!.input as object, confianca: "total" }]) {
      expect(validateDiagnosis("h", [], raw)).toMatchObject({ kind: "recusa", reason: "resposta-invalida" });
    }
    const semMotivo = { ...(recorded.recusa!.toolCall!.input as object), motivo_sem_caso: null };
    expect(validateDiagnosis("h", [], semMotivo)).toMatchObject({ reason: "modelo-sem-caso-compativel" });
  });
});

describe("AnthropicLlm (cliente falso)", () => {
  function fakeClient(response: unknown) {
    const calls: Record<string, unknown>[] = [];
    const client = { beta: { messages: { create: async (p: Record<string, unknown>) => (calls.push(p), response) } } };
    return { client: client as never, calls };
  }

  it("monta a requisição e extrai a chamada de ferramenta", async () => {
    const { client, calls } = fakeClient({
      stop_reason: "tool_use",
      content: [
        { type: "text", text: "a" },
        { type: "text", text: "b" },
        { type: "tool_use", name: "registrar_diagnostico", input: { x: 1 } },
        { type: "tool_use", name: "segunda", input: {} },
      ],
    });
    const llm = new AnthropicLlm({ client });
    const res = await llm.complete({
      system: "sys",
      messages: [{ role: "user", content: "oi" as never }],
      tools: [{ name: "registrar_diagnostico", description: "d", input_schema: { type: "object" } }],
    });
    expect(res).toEqual({ text: "ab", toolCall: { name: "registrar_diagnostico", input: { x: 1 } } });
    expect(calls[0]).toMatchObject({
      model: "claude-opus-5",
      max_tokens: 16000,
      fallbacks: "default",
      betas: ["server-side-fallback-2026-07-01"],
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      tool_choice: { type: "auto", disable_parallel_tool_use: true },
      tools: [expect.objectContaining({ strict: true })],
    });
  });

  it("recusa do modelo vira resposta vazia; sem ferramentas não envia tool_choice", async () => {
    const refused = fakeClient({ stop_reason: "refusal", content: [] });
    expect(await new AnthropicLlm({ client: refused.client, model: "m", effort: "low" }).complete({ system: "s", messages: [] })).toEqual({});
    expect(refused.calls[0]).toMatchObject({ model: "m", output_config: { effort: "low" }, tool_choice: undefined, tools: undefined });
  });

  it("constrói cliente padrão quando nenhum é passado", () => {
    expect(new AnthropicLlm({})).toBeInstanceOf(AnthropicLlm);
  });
});
