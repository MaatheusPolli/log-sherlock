import { describe, expect, it } from "vitest";
import { ClaudeCliLlm, type ClaudeRunner } from "../../packages/core/src/diagnose/claude-cli.js";
import { redact } from "../../packages/core/src/redact/redact.js";

const TOOL = {
  name: "registrar_diagnostico",
  description: "registra",
  input_schema: { type: "object", properties: { causa: { type: "string" } }, required: ["causa"] },
};

/** Executor simulado: grava os argumentos e devolve a saída pronta. */
function fakeRunner(stdout: unknown, calls: { args: string[]; stdin: string }[] = []): ClaudeRunner {
  return async (_bin, args, stdin) => {
    calls.push({ args, stdin });
    return typeof stdout === "string" ? stdout : JSON.stringify(stdout);
  };
}

describe("ClaudeCliLlm", () => {
  it("envia o prompt pela entrada padrão e o schema da ferramenta por --json-schema", async () => {
    const calls: { args: string[]; stdin: string }[] = [];
    const llm = new ClaudeCliLlm({
      model: "opus",
      run: fakeRunner({ subtype: "success", structured_output: { causa: "token" } }, calls),
    });
    await llm.complete({
      system: "sistema",
      messages: [{ role: "user", content: redact("erro 401 token expirado") }],
      tools: [TOOL],
    });
    const { args, stdin } = calls[0]!;
    expect(stdin).toBe("erro 401 token expirado");
    expect(args).toEqual(expect.arrayContaining(["-p", "--output-format", "json", "--tools", "", "--model", "opus"]));
    expect(args[args.indexOf("--json-schema") + 1]).toBe(JSON.stringify(TOOL.input_schema));
    expect(args[args.indexOf("--system-prompt") + 1]).toBe("sistema");
  });

  it("devolve a saída validada como chamada de ferramenta", async () => {
    const llm = new ClaudeCliLlm({ run: fakeRunner({ subtype: "success", structured_output: { causa: "token" } }) });
    const res = await llm.complete({ system: "s", messages: [{ role: "user", content: redact("x") }], tools: [TOOL] });
    expect(res).toEqual({ toolCall: { name: "registrar_diagnostico", input: { causa: "token" } } });
  });

  it("sem ferramenta, devolve o texto da resposta", async () => {
    const llm = new ClaudeCliLlm({ run: fakeRunner({ subtype: "success", result: "olá" }) });
    expect(await llm.complete({ system: "s", messages: [{ role: "user", content: redact("x") }] })).toEqual({ text: "olá" });
  });

  it("recusa do modelo vira resposta vazia (o guardrail recusa o diagnóstico)", async () => {
    const llm = new ClaudeCliLlm({ run: fakeRunner({ subtype: "success", stop_reason: "refusal" }) });
    expect(await llm.complete({ system: "s", messages: [{ role: "user", content: redact("x") }], tools: [TOOL] })).toEqual({});
  });

  it("sem structured_output (modelo não usou o schema) devolve vazio", async () => {
    const llm = new ClaudeCliLlm({ run: fakeRunner({ subtype: "success", result: "texto livre" }) });
    expect(await llm.complete({ system: "s", messages: [{ role: "user", content: redact("x") }], tools: [TOOL] })).toEqual({});
  });

  it("erro da CLI vira exceção", async () => {
    const llm = new ClaudeCliLlm({ run: fakeRunner({ is_error: true, subtype: "error_max_turns" }) });
    await expect(llm.complete({ system: "s", messages: [{ role: "user", content: redact("x") }] })).rejects.toThrow(
      /error_max_turns/,
    );
  });
});
