import type { RedactedText, SensitiveKind } from "../domain/redacted.js";
import { PATTERNS, type SensitivePattern } from "./patterns.js";

export interface RedactionResult {
  text: RedactedText;
  /** Quantas ocorrências de cada tipo foram removidas (para o preview na UI). */
  found: Partial<Record<SensitiveKind, number>>;
}

function apply(text: string, p: SensitivePattern, found: RedactionResult["found"]): string {
  return text.replace(p.re, (match: string, ...rest: unknown[]) => {
    if (p.accept && !p.accept(match)) return match;
    found[p.kind] = (found[p.kind] ?? 0) + 1;
    const groups = rest.filter((g): g is string => typeof g === "string");
    return p.replace ? p.replace(match, ...groups) : `[${p.kind}]`;
  });
}

export function redactWithReport(text: string, patterns: readonly SensitivePattern[] = PATTERNS): RedactionResult {
  const found: RedactionResult["found"] = {};
  const out = patterns.reduce((acc, p) => apply(acc, p, found), text);
  return { text: out as RedactedText, found };
}

/** Única forma de obter um `RedactedText`. */
export const redact = (text: string): RedactedText => redactWithReport(text).text;

/** Verificação independente usada como segunda barreira na porta do LLM. */
export function findSensitive(text: string): SensitiveKind[] {
  const kinds = new Set<SensitiveKind>();
  for (const p of PATTERNS) {
    for (const m of text.matchAll(p.re)) {
      const value = m[0];
      if (!p.accept || p.accept(value)) kinds.add(p.kind);
    }
  }
  return [...kinds];
}

const PEM_BEGIN = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const PEM_END = /-----END [A-Z ]*PRIVATE KEY-----/;

/**
 * Redação linha a linha em streaming. Padrões multilinha (chave PEM) não cabem
 * em uma linha, então o estado "dentro do bloco" é mantido entre linhas.
 */
export async function* redactLines(
  lines: Iterable<string> | AsyncIterable<string>,
  found: RedactionResult["found"] = {},
): AsyncGenerator<RedactedText> {
  let inKey = false;
  for await (const line of lines) {
    if (inKey || PEM_BEGIN.test(line)) {
      if (!inKey) found.CHAVE_PRIVADA = (found.CHAVE_PRIVADA ?? 0) + 1;
      inKey = !PEM_END.test(line);
      yield "[CHAVE_PRIVADA]" as RedactedText;
      continue;
    }
    const r = redactWithReport(line);
    for (const [k, n] of Object.entries(r.found) as [keyof typeof found, number][]) found[k] = (found[k] ?? 0) + n;
    yield r.text;
  }
}

/** Junta partes já redigidas sem perder a garantia de tipo. */
export const joinRedacted = (parts: readonly RedactedText[], sep = "\n"): RedactedText =>
  parts.join(sep) as RedactedText;
