import type { LogEntry } from "../domain/log-entry.js";
import { normalizeLevel, type LineParser } from "./parser.js";

type Json = Record<string, unknown>;

const str = (v: unknown): string | undefined =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined;

function pick(obj: Json, keys: string[]): unknown {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  return undefined;
}

function messageOf(obj: Json): string {
  const err = obj.error ?? obj.err ?? obj.exception;
  const errObj = typeof err === "object" && err !== null ? (err as Json) : undefined;
  const msg = str(pick(obj, ["message", "msg", "text", "@m"]));
  const errMsg = errObj ? str(pick(errObj, ["message", "msg", "Message"])) : str(err);
  if (msg && errMsg) return msg.includes(errMsg) ? msg : `${msg}: ${errMsg}`;
  return msg || errMsg || JSON.stringify(obj);
}

function stackOf(obj: Json): string[] {
  const err = obj.error ?? obj.err ?? obj.exception;
  const raw = (typeof err === "object" && err !== null ? (err as Json).stack : undefined) ?? obj.stack;
  if (typeof raw !== "string") return [];
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^at\s|^\[/.test(l));
}

export function parseJsonLine(line: string, lineNumber: number): LogEntry {
  let obj: unknown;
  try {
    obj = JSON.parse(line);
  } catch {
    return { line: lineNumber, format: "json", message: line.trim(), stack: [], malformed: true };
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return { line: lineNumber, format: "json", message: line.trim(), stack: [], malformed: true };
  }
  const o = obj as Json;
  const status = Number(pick(o, ["status", "statusCode", "status_code"]));
  const entry: LogEntry = {
    line: lineNumber,
    format: "json",
    timestamp: str(pick(o, ["timestamp", "time", "ts", "@t", "date"])),
    level: normalizeLevel(str(pick(o, ["level", "severity", "lvl", "@l"]))),
    message: messageOf(o),
    stack: stackOf(o),
  };
  if (Number.isInteger(status) && status >= 100 && status < 600) {
    entry.http = { status, method: str(o.method), url: str(pick(o, ["url", "path", "endpoint"])) };
  }
  return entry;
}

export function createJsonParser(): LineParser {
  return {
    push: (line, n) => (line.trim() ? [parseJsonLine(line, n)] : []),
    end: () => [],
  };
}
