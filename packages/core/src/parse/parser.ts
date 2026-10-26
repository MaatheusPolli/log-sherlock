import type { LogEntry } from "../domain/log-entry.js";

/**
 * Parser incremental: recebe uma linha por vez (streaming) e devolve as entradas
 * que ficaram completas. Entradas multilinha (stack traces, respostas HTTP)
 * só são emitidas quando a próxima começa ou em `end()`.
 */
export interface LineParser {
  push(line: string, lineNumber: number): LogEntry[];
  end(): LogEntry[];
}

export const LEVEL_RE = /\b(TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|ERRO|FATAL|CRITICAL)\b/i;

export function normalizeLevel(level: string | undefined): string | undefined {
  if (!level) return undefined;
  const upper = level.toUpperCase();
  if (upper === "WARNING") return "WARN";
  if (upper === "ERRO") return "ERROR";
  return upper;
}

/** Acumula uma entrada multilinha e a emite quando outra começa. */
export class EntryBuffer {
  private current: LogEntry | undefined;

  start(entry: LogEntry): LogEntry[] {
    const done = this.flush();
    this.current = entry;
    return done;
  }

  get open(): LogEntry | undefined {
    return this.current;
  }

  flush(): LogEntry[] {
    const done = this.current ? [this.current] : [];
    this.current = undefined;
    return done;
  }
}
