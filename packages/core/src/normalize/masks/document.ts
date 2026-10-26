// CNPJ (00.000.000/0000-00), CPF (000.000.000-00) e as formas só com dígitos (14 e 11).
const CNPJ_RE = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|(?<![\d.])\d{14}(?![\d.])/g;
const CPF_RE = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|(?<![\d.])\d{11}(?![\d.])/g;

export const maskDocument = (s: string): string => s.replace(CNPJ_RE, "<DOC>").replace(CPF_RE, "<DOC>");
