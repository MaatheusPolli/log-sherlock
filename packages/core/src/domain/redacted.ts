declare const redactedBrand: unique symbol;

/**
 * Texto que passou pelo redator. Só `redact()` produz esse tipo, então a porta do LLM
 * não aceita string crua: esquecer a redação é erro de compilação, não de revisão.
 */
export type RedactedText = string & { readonly [redactedBrand]: true };

export type SensitiveKind =
  | "CHAVE_NFE"
  | "CNPJ"
  | "CPF"
  | "CARTAO"
  | "JWT"
  | "TOKEN"
  | "SEGREDO"
  | "CHAVE_PRIVADA"
  | "BLOB"
  | "CREDENCIAL_URL"
  | "EMAIL";
