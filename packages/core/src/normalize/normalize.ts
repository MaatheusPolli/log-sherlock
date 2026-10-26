import { maskDocument } from "./masks/document.js";
import { maskEmail } from "./masks/email.js";
import { maskHex, maskId, maskNumber } from "./masks/number.js";
import { maskPath } from "./masks/path.js";
import { maskTimestamp } from "./masks/timestamp.js";
import { maskUrl } from "./masks/url.js";
import { maskUuid } from "./masks/uuid.js";

export type Mask = (s: string) => string;

/** Ordem importa: do padrão mais específico para o mais genérico. */
export const MASKS: readonly Mask[] = [
  maskUrl,
  maskEmail,
  maskUuid,
  maskTimestamp,
  maskDocument,
  maskPath,
  maskHex,
  maskId,
  maskNumber,
];

export function normalize(text: string, masks: readonly Mask[] = MASKS): string {
  const masked = masks.reduce((acc, mask) => mask(acc), text);
  return masked.replace(/\s+/g, " ").trim();
}
