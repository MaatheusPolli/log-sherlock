import { randomUUID } from "node:crypto";
import { Grouper, mergeSimilar, type ErrorGroup } from "../cluster/group.js";
import type { DiagnosisResult } from "../domain/diagnosis.js";
import type { IssueMatch } from "../domain/known-issue.js";
import type { LogFormat } from "../domain/log-entry.js";
import { diagnoseGroup, type DiagnoseDeps } from "../diagnose/diagnose.js";
import { searchKnownIssues } from "../knowledge/search.js";
import { parseLog, type ParseOptions } from "../parse/parse.js";
import { redact } from "../redact/redact.js";

export interface AnalyzedGroup {
  signature: string;
  hash: string;
  variants: string[];
  count: number;
  firstLine: number;
  lastLine: number;
  firstSeen?: string;
  lastSeen?: string;
  levels: Record<string, number>;
  /** Exemplo já redigido: seguro para exibir e trafegar. */
  sample: string;
  /** Casos da base sugeridos pela busca híbrida (funciona sem LLM). */
  candidates: IssueMatch[];
  diagnosis?: DiagnosisResult;
}

export interface AnalysisReport {
  id: string;
  createdAt: string;
  format?: LogFormat;
  entries: number;
  malformed: number;
  groups: AnalyzedGroup[];
}

export interface AnalyzeOptions extends ParseOptions {
  /** Busca casos para os N maiores grupos. */
  searchTop?: number;
  /** Diagnostica com o LLM os N maiores grupos (exige `llm`). */
  diagnoseTop?: number;
  mergeThreshold?: number;
}

export type AnalyzeDeps = Omit<DiagnoseDeps, "llm"> & { llm?: DiagnoseDeps["llm"] };

type Input = string | Iterable<string> | AsyncIterable<string>;

function toView(g: ErrorGroup, candidates: IssueMatch[]): AnalyzedGroup {
  const s = g.sample;
  return {
    signature: g.signature.text,
    hash: g.signature.hash,
    variants: g.variants.map((v) => v.text),
    count: g.count,
    firstLine: g.firstLine,
    lastLine: g.lastLine,
    firstSeen: g.firstSeen,
    lastSeen: g.lastSeen,
    levels: g.levels,
    sample: redact([s.message, ...s.stack.slice(0, 8)].join("\n")),
    candidates,
  };
}

/** Pipeline completo: parse em streaming → agrupamento → busca de casos → diagnóstico dos maiores grupos. */
export async function analyze(input: Input, deps: AnalyzeDeps, opts: AnalyzeOptions = {}): Promise<AnalysisReport> {
  const grouper = new Grouper();
  let entries = 0;
  let malformed = 0;
  let format: LogFormat | undefined;
  for await (const e of parseLog(input, opts)) {
    entries++;
    format ??= e.format;
    if (e.malformed) malformed++;
    grouper.add(e);
  }
  const groups = await mergeSimilar(grouper.result(), deps.embeddings, opts.mergeThreshold);
  const searchTop = opts.searchTop ?? 20;
  const diagnoseTop = deps.llm ? (opts.diagnoseTop ?? 0) : 0;
  const views: AnalyzedGroup[] = [];
  // Sequencial de propósito: respeita rate limit dos provedores e mantém custo previsível.
  for (const [i, g] of groups.entries()) {
    const candidates = i < searchTop ? await searchKnownIssues(g.signature, deps.store, deps.embeddings, deps.search) : [];
    const view = toView(g, candidates);
    if (i < diagnoseTop) view.diagnosis = await diagnoseGroup(g, { ...deps, llm: deps.llm! }, candidates);
    views.push(view);
  }
  return { id: randomUUID(), createdAt: new Date().toISOString(), format, entries, malformed, groups: views };
}
