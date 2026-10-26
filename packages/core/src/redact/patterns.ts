import type { SensitiveKind } from "../domain/redacted.js";

export interface SensitivePattern {
  kind: SensitiveKind;
  re: RegExp;
  /** Substituição; por padrão o texto inteiro vira `[KIND]`. */
  replace?: (match: string, ...groups: string[]) => string;
  /** Filtro extra para reduzir falso positivo (ex.: Luhn para cartão). */
  accept?: (match: string) => boolean;
}

const SECRET_KEYS =
  "password|passwd|senha|pwd|secret|client[_-]?secret|api[_-]?key|apikey|app[_-]?key|app[_-]?token|x-vtex-api-app(?:key|token)|access[_-]?token|refresh[_-]?token|access[_-]?key|token|authorization|private[_-]?key";

/** Algoritmo de Luhn: separa números de cartão de IDs longos quaisquer. */
export function luhn(digits: string): boolean {
  const d = digits.replace(/\D/g, "");
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/**
 * Ordem importa: blocos e padrões mais específicos primeiro, para que
 * pedaços deles não sejam capturados por padrões genéricos depois.
 */
export const PATTERNS: readonly SensitivePattern[] = [
  {
    kind: "CHAVE_PRIVADA",
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  },
  {
    // Blocos base64/hex longos: corpo de chave PEM em linha solta, certificados, tokens opacos.
    kind: "BLOB",
    re: /(?<![\w+/=-])(?=[A-Za-z0-9+/]*\d)(?=[A-Za-z0-9+/]*[A-Za-z])[A-Za-z0-9+/]{40,}={0,2}(?![\w+/=-])/g,
  },
  {
    kind: "CREDENCIAL_URL",
    re: /\b([a-z][a-z0-9+.-]*:\/\/)[^\s:/@]+:[^\s/@]+@/gi,
    replace: (_m, scheme) => `${scheme}[CREDENCIAL_URL]@`,
  },
  { kind: "JWT", re: /\beyJ[\w-]{5,}\.eyJ[\w-]{5,}\.[\w-]{5,}/g },
  {
    // "Bearer|Basic <valor>" só é credencial com a mesma regra do "Token" (dígito ou
    // maiúsculas/minúsculas com 16+ caracteres). Assim "Basic configuration" e
    // "Basic authentication" continuam visíveis ao diagnóstico.
    kind: "TOKEN",
    re: /\b((?:[Bb]earer|[Bb]asic|BEARER|BASIC))\s+(?:(?=[\w\-.~+/=]*\d)[\w\-.~+/=]{8,}|(?=[\w\-.~+/=]*[a-z])(?=[\w\-.~+/=]*[A-Z])[\w\-.~+/=]{16,})/g,
    replace: (_m, scheme) => `${scheme} [TOKEN]`,
  },
  {
    // Header "Authorization: Bearer|Basic <valor>": qualquer valor após o esquema é credencial.
    // Vem antes de SEGREDO, que de outra forma trataria "Bearer" como o valor de "Authorization".
    kind: "TOKEN",
    re: /(?<=\bauthorization:\s*(?:bearer|basic)\s+)[\w\-.~+/=]{8,}/gi,
  },
  {
    // "Token <valor>" só é credencial se o valor tiver dígito ou mistura de
    // maiúsculas/minúsculas com 16+ caracteres. Assim "token expirado",
    // "token inválido", "token expired" etc. continuam visíveis ao diagnóstico.
    // Sem flag `i`: as classes [a-z]/[A-Z] precisam ser estritas.
    kind: "TOKEN",
    re: /\b([Tt][Oo][Kk][Ee][Nn])\s+(?:(?=[\w\-.~+/=]*\d)[\w\-.~+/=]{8,}|(?=[\w\-.~+/=]*[a-z])(?=[\w\-.~+/=]*[A-Z])[\w\-.~+/=]{16,})/g,
    replace: (_m, scheme) => `${scheme} [TOKEN]`,
  },
  {
    // Header "Authorization: Token <valor>": qualquer valor após o esquema é credencial.
    kind: "TOKEN",
    re: /(?<=\bauthorization:\s*token\s+)[\w\-.~+/=]{8,}/gi,
  },
  {
    // Prefixos de chaves conhecidas: Anthropic/OpenAI, Stripe, AWS, GitHub, Slack, Google.
    kind: "TOKEN",
    re: /\b(?:sk-[\w-]{16,}|(?:sk|pk|rk)_(?:live|test)_[\w]{10,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|xox[abpr]-[\w-]{10,}|AIza[\w-]{30,})/g,
  },
  {
    // chave=valor, chave: valor, "chave": "valor" (JSON e headers).
    kind: "SEGREDO",
    re: new RegExp(String.raw`(["']?\b(?:${SECRET_KEYS})\b["']?\s*[:=]\s*["']?)(?!\[)([^\s"',;&}]+)`, "gi"),
    replace: (_m, prefix) => `${prefix}[SEGREDO]`,
  },
  { kind: "EMAIL", re: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g },
  // Chave de acesso de NF-e: 44 dígitos (contém o CNPJ do emitente).
  { kind: "CHAVE_NFE", re: /(?<!\d)(?:\d{4}\s?){10}\d{4}(?!\d)/g },
  // CNPJ numérico e alfanumérico (a partir de 2026), formatado ou não.
  { kind: "CNPJ", re: /\b[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}\/[A-Z0-9]{4}-\d{2}\b|(?<![\d.])\d{14}(?![\d.])/g },
  { kind: "CPF", re: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|(?<![\d.])\d{11}(?![\d.])/g },
  { kind: "CARTAO", re: /(?<![\d-])(?:\d[ -]?){12,18}\d(?![\d-])/g, accept: luhn },
];
