import { createHash } from "node:crypto";
import type { LogEntry } from "../domain/log-entry.js";
import type { Signature } from "../domain/signature.js";
import { normalize } from "./normalize.js";

/** Forma canônica para o hash: sem acentos, minúscula, sem pontuação redundante. */
export function canonical(normalized: string): string {
  return normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w<>]+/g, " ")
    .trim();
}

export function hashOf(normalized: string): string {
  return createHash("sha256").update(canonical(normalized)).digest("hex").slice(0, 16);
}

export function signatureOf(message: string): Signature {
  const text = normalize(message);
  return { text, hash: hashOf(text) };
}

export const signatureOfEntry = (entry: LogEntry): Signature => signatureOf(entry.message);
