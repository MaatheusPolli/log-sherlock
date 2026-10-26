import type { LlmPort, LlmRequest } from "../ports/llm.js";
import { findSensitive } from "./redact.js";

export class SensitiveDataError extends Error {
  constructor(readonly kinds: string[]) {
    super(`Envio ao LLM bloqueado: dado sensível detectado (${kinds.join(", ")})`);
    this.name = "SensitiveDataError";
  }
}

/**
 * Segunda barreira: mesmo com o tipo `RedactedText`, um `as` indevido poderia
 * furar a garantia. O guard reinspeciona tudo o que sai e bloqueia o envio.
 */
export function guardLlm(inner: LlmPort): LlmPort {
  return {
    complete(req: LlmRequest) {
      const outgoing = [req.system, ...req.messages.map((m) => m.content)];
      const kinds = [...new Set(outgoing.flatMap(findSensitive))];
      if (kinds.length) return Promise.reject(new SensitiveDataError(kinds));
      return inner.complete(req);
    },
  };
}
