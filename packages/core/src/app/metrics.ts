import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { AnalysisReport } from "./analyze.js";

export interface FeedbackRecord {
  at: string;
  signatureHash: string;
  issueId?: string;
  resolved: boolean;
}

interface State {
  /** dia (YYYY-MM-DD) → hash → ocorrências */
  daily: Record<string, Record<string, number>>;
  signatures: Record<string, string>;
  feedback: FeedbackRecord[];
}

export interface Dashboard {
  days: number;
  topErrors: { hash: string; signature: string; count: number }[];
  /** Total de ocorrências por dia, do mais antigo ao mais recente. */
  trend: { day: string; count: number }[];
  feedback: { resolved: number; notResolved: number };
}

const day = (iso: string) => iso.slice(0, 10);

/**
 * Métricas agregadas (sem conteúdo de log, só assinaturas normalizadas e contagens).
 * Persistência opcional em JSON — suficiente para o painel de um time.
 */
export class MetricsStore {
  private state: State = { daily: {}, signatures: {}, feedback: [] };

  constructor(private readonly file?: string) {}

  async load(): Promise<this> {
    if (!this.file) return this;
    try {
      this.state = JSON.parse(await readFile(this.file, "utf8")) as State;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    return this;
  }

  private async save(): Promise<void> {
    if (!this.file) return;
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify(this.state));
  }

  async recordAnalysis(report: AnalysisReport): Promise<void> {
    const bucket = (this.state.daily[day(report.createdAt)] ??= {});
    for (const g of report.groups) {
      bucket[g.hash] = (bucket[g.hash] ?? 0) + g.count;
      this.state.signatures[g.hash] = g.signature;
    }
    await this.save();
  }

  async recordFeedback(f: FeedbackRecord): Promise<void> {
    this.state.feedback.push(f);
    await this.save();
  }

  dashboard(days = 7, now = new Date()): Dashboard {
    const trend: Dashboard["trend"] = [];
    const totals = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = day(new Date(now.getTime() - i * 86_400_000).toISOString());
      const bucket = this.state.daily[d] ?? {};
      trend.push({ day: d, count: Object.values(bucket).reduce((s, n) => s + n, 0) });
      for (const [h, n] of Object.entries(bucket)) totals.set(h, (totals.get(h) ?? 0) + n);
    }
    const since = trend[0]!.day;
    const recent = this.state.feedback.filter((f) => day(f.at) >= since);
    return {
      days,
      topErrors: [...totals]
        .map(([hash, count]) => ({ hash, signature: this.state.signatures[hash] ?? hash, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      trend,
      feedback: { resolved: recent.filter((f) => f.resolved).length, notResolved: recent.filter((f) => !f.resolved).length },
    };
  }
}
