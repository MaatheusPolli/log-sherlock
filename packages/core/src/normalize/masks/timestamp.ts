const DATE = String.raw`(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})`;
const TIME = String.raw`\d{2}:\d{2}(?::\d{2}(?:[.,]\d{1,9})?)?`;
const ZONE = String.raw`(?:Z|[+-]\d{2}:?\d{2})?`;

// Data com hora opcional (ISO 8601, "2024-01-02 10:11:12,345", "02/01/2024 10:11"), ou hora isolada.
const TIMESTAMP_RE = new RegExp(String.raw`\b${DATE}(?:[T ]${TIME}${ZONE})?(?![\d])|\b${TIME}${ZONE}(?![\d:])`, "g");
const EPOCH_RE = /\b1[5-9]\d{8}(?:\d{3})?\b/g;

export const maskTimestamp = (s: string): string => s.replace(TIMESTAMP_RE, "<TS>").replace(EPOCH_RE, "<TS>");
