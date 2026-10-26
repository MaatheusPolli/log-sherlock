import type { LogEntry, LogFormat } from "../domain/log-entry.js";
import { EntryBuffer, LEVEL_RE, normalizeLevel, type LineParser } from "./parser.js";

const LEVEL_PREFIX_RE = new RegExp(String.raw`^[[(]?${LEVEL_RE.source}[\])]?\s*[-:|]?\s*`, "i");

// "2024-05-10 13:22:01,123 [ERROR] mensagem", "[10/05/2024 13:22:01] ERRO - mensagem", etc.
const HEADER_RE =
  /^\[?(\d{4}-\d{2}-\d{2}[T ][\d:.,]+(?:Z|[+-]\d{2}:?\d{2})?|\d{2}\/\d{2}\/\d{4}[ T][\d:.,]+)\]?\s*/;

/** Linha que continua a entrada anterior: indentada ou frame de stack. */
export const isContinuation = (line: string): boolean =>
  /^\s+\S/.test(line) || /^(?:at |\[[0-9A-F]{8}\]|---|Caused by:|\.\.\. \d+ more)/.test(line);

export function parseHeader(line: string, lineNumber: number, format: LogFormat = "line"): LogEntry {
  let rest = line.trim();
  let timestamp: string | undefined;
  const ts = HEADER_RE.exec(rest);
  if (ts) {
    timestamp = ts[1];
    rest = rest.slice(ts[0].length);
  }
  let level: string | undefined;
  const lv = LEVEL_PREFIX_RE.exec(rest);
  // "Error: read ECONNRESET" é mensagem, não nível: exige caixa alta, colchetes ou timestamp antes.
  if (lv && (ts || /^[[(]/.test(lv[0]) || lv[1] === lv[1]!.toUpperCase())) {
    level = normalizeLevel(lv[1]);
    rest = rest.slice(lv[0].length);
  }
  return { line: lineNumber, format, timestamp, level, message: rest, stack: [] };
}

export function createLineParser(format: LogFormat = "line"): LineParser {
  const buf = new EntryBuffer();
  return {
    push(line, n) {
      if (!line.trim()) return [];
      const open = buf.open;
      if (open && isContinuation(line)) {
        open.stack.push(line.trim());
        return [];
      }
      return buf.start(parseHeader(line, n, format));
    },
    end: () => buf.flush(),
  };
}
