import type { LogEntry } from "../domain/log-entry.js";
import type { LineParser } from "./parser.js";

const REQUEST_RE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)(?:\s+HTTP\/[\d.]+)?\s*$/i;
const STATUS_RE = /^HTTP\/[\d.]+\s+(\d{3})\s*(.*)$/i;
// Formato compacto de uma linha: "POST https://x/y -> 401 Unauthorized {...}"
const INLINE_RE = /^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)\s*(?:->|=>|:)\s*(\d{3})\s*([A-Za-z ]*?)\s*(\{.*|$)/i;
const HEADER_RE = /^[\w-]+:\s/;

interface Pending {
  method?: string;
  url?: string;
  entry?: LogEntry;
  body: string[];
  inHeaders: boolean;
}

/** Extrai a mensagem de erro mais útil de um corpo de resposta. */
export function bodyMessage(body: string): string {
  const text = body.trim();
  if (!text) return "";
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    const err = obj.error;
    const candidates = [
      obj.message,
      obj.Message,
      obj.error_description,
      typeof err === "object" && err !== null ? (err as Record<string, unknown>).message : err,
      obj.detail,
    ];
    const parts = candidates.filter((c): c is string => typeof c === "string" && c.length > 0);
    if (parts.length) return [...new Set(parts)].join(" ");
    return text;
  } catch {
    // HTML (página de erro de proxy) ou texto puro: fica com o título ou a primeira linha.
    const title = /<title>([^<]*)<\/title>/i.exec(text);
    return (title?.[1] ?? text.split(/\r?\n/)[0]!).trim();
  }
}

function finalize(p: Pending): LogEntry[] {
  const e = p.entry;
  if (!e || !e.http) return [];
  const extra = bodyMessage(p.body.join("\n"));
  e.message = [`HTTP ${e.http.status}`, e.http.reason, e.http.method, e.http.url, extra]
    .filter(Boolean)
    .join(" ");
  return [e];
}

export function createHttpParser(): LineParser {
  let p: Pending = { body: [], inHeaders: false };
  const close = (): LogEntry[] => {
    const out = finalize(p);
    p = { body: [], inHeaders: false };
    return out;
  };

  return {
    push(line, n) {
      const inline = INLINE_RE.exec(line.trim());
      if (inline) {
        const out = close();
        p.entry = {
          line: n,
          format: "http",
          message: "",
          stack: [],
          http: { status: Number(inline[3]), reason: inline[4] || undefined, method: inline[1]!.toUpperCase(), url: inline[2] },
        };
        p.body.push(inline[5] ?? "");
        return [...out, ...close()];
      }
      const req = REQUEST_RE.exec(line.trim());
      if (req) {
        const out = close();
        p.method = req[1]!.toUpperCase();
        p.url = req[2];
        return out;
      }
      const status = STATUS_RE.exec(line.trim());
      if (status) {
        const { method, url } = p;
        const out = p.entry ? close() : [];
        p.method = method;
        p.url = url;
        p.entry = {
          line: n,
          format: "http",
          message: "",
          stack: [],
          http: { status: Number(status[1]), reason: status[2]?.trim() || undefined, method: p.method, url: p.url },
        };
        p.inHeaders = true;
        return out;
      }
      if (!p.entry) return [];
      if (p.inHeaders) {
        if (!line.trim()) p.inHeaders = false;
        else if (!HEADER_RE.test(line)) {
          p.inHeaders = false;
          p.body.push(line);
        }
        return [];
      }
      p.body.push(line);
      return [];
    },
    end: () => close(),
  };
}
