import type { LogFormat } from "../domain/log-entry.js";
import { createHttpParser } from "./http.parser.js";
import { createJsonParser } from "./json.parser.js";
import { createLineParser } from "./line.parser.js";
import type { LineParser } from "./parser.js";
import { createStacktraceParser } from "./stacktrace.parser.js";

const FRAME_RE = /^\s*(?:at\s|\[[0-9A-F]{8}\]\s)/;
const HTTP_RE = /^(?:HTTP\/[\d.]+\s+\d{3}|(?:GET|POST|PUT|PATCH|DELETE)\s+\S+\s*(?:HTTP\/|->|=>))/i;

/** Escolhe o formato pela maioria das linhas não vazias de uma amostra do início do log. */
export function detectFormat(sample: string[]): LogFormat {
  const lines = sample.filter((l) => l.trim());
  if (!lines.length) return "line";
  const ratio = (re: RegExp | ((l: string) => boolean)) =>
    lines.filter((l) => (typeof re === "function" ? re(l) : re.test(l))).length / lines.length;

  if (ratio((l) => l.trim().startsWith("{")) >= 0.6) return "json";
  if (lines.some((l) => HTTP_RE.test(l.trim()))) return "http";
  if (ratio(FRAME_RE) >= 0.3) return "stacktrace";
  return "line";
}

const FACTORIES: Record<LogFormat, () => LineParser> = {
  json: createJsonParser,
  line: () => createLineParser(),
  stacktrace: createStacktraceParser,
  http: createHttpParser,
};

export const createParser = (format: LogFormat): LineParser => FACTORIES[format]();
