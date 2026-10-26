import type { LogEntry, LogFormat } from "../domain/log-entry.js";
import { createParser, detectFormat } from "./detect.js";

export interface ParseOptions {
  /** Força um formato em vez de detectar. */
  format?: LogFormat;
  /** Quantas linhas iniciais usar na detecção. */
  sampleSize?: number;
}

type Lines = Iterable<string> | AsyncIterable<string>;

/**
 * Faz o parse em streaming: guarda só a amostra de detecção e a entrada em aberto,
 * então logs grandes não são carregados inteiros em memória.
 */
export async function* parseLog(input: string | Lines, opts: ParseOptions = {}): AsyncGenerator<LogEntry> {
  const lines: Lines = typeof input === "string" ? input.split(/\r?\n/) : input;
  const sampleSize = opts.sampleSize ?? 50;
  const sample: string[] = [];
  let parser = opts.format ? createParser(opts.format) : undefined;
  let n = 0;

  for await (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    n++;
    if (!parser) {
      sample.push(line);
      if (sample.length < sampleSize) continue;
      parser = createParser(detectFormat(sample));
      for (const [i, l] of sample.entries()) yield* parser.push(l, i + 1);
      continue;
    }
    yield* parser.push(line, n);
  }
  if (!parser) {
    parser = createParser(detectFormat(sample));
    for (const [i, l] of sample.entries()) yield* parser.push(l, i + 1);
  }
  yield* parser.end();
}

export async function collect(input: string | Lines, opts?: ParseOptions): Promise<LogEntry[]> {
  const out: LogEntry[] = [];
  for await (const e of parseLog(input, opts)) out.push(e);
  return out;
}
