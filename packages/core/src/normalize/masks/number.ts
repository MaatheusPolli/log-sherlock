// Endereços de memória e hashes: 0x..., ou 8/16 caracteres hex com ao menos uma letra.
const HEX_RE = /\b0x[0-9a-f]+\b|\b(?=[0-9A-F]*[A-F])[0-9A-F]{8}(?:[0-9A-F]{8})?\b|(?<=address )[0-9A-F]{8,16}\b/gi;

// Identificadores alfanuméricos (evt_1a2b3c4d, PED-2024X99): 8+ chars, 2+ dígitos, 1+ letra.
const ID_RE = /\b(?=[\w-]*[A-Za-z])(?=(?:[\w-]*\d){2})[A-Za-z0-9][\w-]{7,}\b/g;

// Números após palavras que indicam identificador ou posição.
const CONTEXT_RE = /\b((?:id|pid|process id|position|posi[cç][aã]o|line|linha|pedido|order|sku|nota|nf|attempt|tentativa)\s*[:#=]?\s*)\d+/gi;

// Números longos (4+ dígitos) e decimais; códigos curtos (HTTP 401, Rejeição 539) são preservados.
const NUMBER_RE = /(?<![\w<])(?:\d+[.,]\d+|\d{4,})(?![\w>])/g;

export const maskHex = (s: string): string => s.replace(HEX_RE, "<HEX>");
export const maskId = (s: string): string => s.replace(ID_RE, "<ID>");
export const maskNumber = (s: string): string =>
  s.replace(CONTEXT_RE, (_m, prefix: string) => `${prefix}<NUM>`).replace(NUMBER_RE, "<NUM>");
