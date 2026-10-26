import Anthropic from "@anthropic-ai/sdk";
import type { LlmPort, LlmRequest, LlmResponse } from "../ports/llm.js";

export interface AnthropicLlmOptions {
  client?: Anthropic;
  model?: string;
  /** Profundidade do raciocínio; "medium" mantém o diagnóstico abaixo de ~8 s. */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}

/**
 * Adaptador da `LlmPort` para a API da Anthropic.
 * - tool_choice "auto" + `strict: true`: o prompt manda chamar a ferramenta (forçar não é
 *   suportado em todos os modelos atuais) e o strict garante argumentos válidos pelo schema.
 * - Fallback de recusa no servidor ("default"): se o modelo declinar, a API reexecuta num
 *   modelo alternativo na mesma chamada.
 */
export class AnthropicLlm implements LlmPort {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly effort: NonNullable<AnthropicLlmOptions["effort"]>;

  constructor(opts: AnthropicLlmOptions = {}) {
    this.client = opts.client ?? new Anthropic();
    this.model = opts.model ?? "claude-opus-5";
    this.effort = opts.effort ?? "medium";
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const response = await this.client.beta.messages.create({
      model: this.model,
      max_tokens: req.maxTokens ?? 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: this.effort },
      // Prompt de sistema fixo → cacheável entre diagnósticos.
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      tools: req.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Beta.BetaTool.InputSchema,
        strict: true,
      })),
      tool_choice: req.tools?.length ? { type: "auto", disable_parallel_tool_use: true } : undefined,
    });

    if (response.stop_reason === "refusal") return {};
    const out: LlmResponse = {};
    for (const block of response.content) {
      if (block.type === "text") out.text = (out.text ?? "") + block.text;
      else if (block.type === "tool_use") out.toolCall ??= { name: block.name, input: block.input };
    }
    return out;
  }
}
