import type { RedactedText } from "../domain/redacted.js";

export interface LlmMessage {
  role: "user" | "assistant";
  /** Só texto redigido entra na conversa com o modelo. */
  content: RedactedText;
}

export interface LlmTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LlmRequest {
  /** Prompt de sistema: texto fixo do código, sem dados do log. */
  system: string;
  messages: LlmMessage[];
  /** O prompt instrui o modelo a responder via ferramenta (tool_choice forçado não existe em todos os modelos). */
  tools?: LlmTool[];
  maxTokens?: number;
}

export interface LlmResponse {
  text?: string;
  toolCall?: { name: string; input: unknown };
}

export interface LlmPort {
  complete(req: LlmRequest): Promise<LlmResponse>;
}
