import type { LogEntry } from "../domain/log-entry.js";
import type { Signature } from "../domain/signature.js";
import { signatureOfEntry } from "../normalize/signature.js";
import type { EmbeddingPort } from "../ports/embedding.js";
import { redact } from "../redact/redact.js";
import { cosine } from "./similarity.js";

export interface ErrorGroup {
  signature: Signature;
  /** Assinaturas absorvidas por similaridade semântica. */
  variants: Signature[];
  count: number;
  firstLine: number;
  lastLine: number;
  firstSeen?: string;
  lastSeen?: string;
  levels: Record<string, number>;
  /** Primeira ocorrência completa, como exemplo para o diagnóstico. */
  sample: LogEntry;
}

const DIAGNOSABLE = new Set(["ERROR", "FATAL", "CRITICAL", "WARN", undefined]);

/** Agrupa por assinatura exata em streaming: memória proporcional ao nº de grupos, não de linhas. */
export class Grouper {
  private groups = new Map<string, ErrorGroup>();

  constructor(private readonly includeLevel: (level: string | undefined) => boolean = (l) => DIAGNOSABLE.has(l)) {}

  add(entry: LogEntry): void {
    if (!this.includeLevel(entry.level)) return;
    const sig = signatureOfEntry(entry);
    const g = this.groups.get(sig.hash);
    const level = entry.level ?? "?";
    if (!g) {
      this.groups.set(sig.hash, {
        signature: sig,
        variants: [],
        count: 1,
        firstLine: entry.line,
        lastLine: entry.line,
        firstSeen: entry.timestamp,
        lastSeen: entry.timestamp,
        levels: { [level]: 1 },
        sample: entry,
      });
      return;
    }
    g.count++;
    g.lastLine = entry.line;
    if (entry.timestamp) {
      g.firstSeen ??= entry.timestamp;
      g.lastSeen = entry.timestamp;
    }
    g.levels[level] = (g.levels[level] ?? 0) + 1;
  }

  /** Grupos por contagem, maior primeiro. */
  result(): ErrorGroup[] {
    return [...this.groups.values()].sort((a, b) => b.count - a.count || a.firstLine - b.firstLine);
  }
}

/**
 * Segunda passada: une grupos cujas assinaturas diferem no texto mas são o mesmo erro
 * ("Error: read ECONNRESET" × "read ECONNRESET while calling gateway"). O maior grupo
 * absorve os menores; união gulosa em ordem de contagem, sem transitividade.
 */
export async function mergeSimilar(groups: ErrorGroup[], embeddings: EmbeddingPort, threshold = 0.8): Promise<ErrorGroup[]> {
  if (groups.length < 2) return groups;
  const vectors = await embeddings.embed(groups.map((g) => redact(g.signature.text)));
  const merged: { group: ErrorGroup; vector: number[] }[] = [];
  for (const [i, g] of groups.entries()) {
    const target = merged.find((m) => cosine(m.vector, vectors[i]!) >= threshold);
    if (!target) {
      merged.push({ group: { ...g, variants: [...g.variants], levels: { ...g.levels } }, vector: vectors[i]! });
      continue;
    }
    const t = target.group;
    t.count += g.count;
    t.variants.push(g.signature, ...g.variants);
    t.firstLine = Math.min(t.firstLine, g.firstLine);
    t.lastLine = Math.max(t.lastLine, g.lastLine);
    t.firstSeen = [t.firstSeen, g.firstSeen].filter(Boolean).sort()[0];
    t.lastSeen = [t.lastSeen, g.lastSeen].filter(Boolean).sort().at(-1);
    for (const [lvl, n] of Object.entries(g.levels)) t.levels[lvl] = (t.levels[lvl] ?? 0) + n;
  }
  return merged.map((m) => m.group).sort((a, b) => b.count - a.count || a.firstLine - b.firstLine);
}

export async function groupEntries(
  entries: AsyncIterable<LogEntry> | Iterable<LogEntry>,
  embeddings?: EmbeddingPort,
  threshold?: number,
): Promise<ErrorGroup[]> {
  const grouper = new Grouper();
  for await (const e of entries) grouper.add(e);
  const exact = grouper.result();
  return embeddings ? mergeSimilar(exact, embeddings, threshold) : exact;
}
