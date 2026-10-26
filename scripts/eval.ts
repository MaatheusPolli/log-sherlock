// Avalia o pipeline com o dataset rotulado em tests/eval/dataset.json e grava report/eval.md.
// Sem ANTHROPIC_API_KEY: mede só a busca de casos (offline). Com a chave: também mede o diagnóstico com Claude.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { analyze } from "../packages/core/src/app/analyze.js";
import { createContext } from "../packages/core/src/app/context.js";
import type { DiagnosisResult } from "../packages/core/src/domain/diagnosis.js";

interface EvalItem {
  id: string;
  categoria: "variacao" | "negativo";
  expected: string | null;
  log: string;
}

const ROOT = dirname(fileURLToPath(import.meta.url)) + "/..";
const LATENCY_TARGET_MS = 8000;

const items = JSON.parse(await readFile(`${ROOT}/tests/eval/dataset.json`, "utf8")) as EvalItem[];
// Embedding local e memória: a avaliação é reprodutível e não depende de chaves de busca.
const ctx = await createContext({
  KNOWLEDGE_DIR: `${ROOT}/knowledge-base`,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
});
const withLlm = Boolean(ctx.llm);

interface Row {
  id: string;
  categoria: EvalItem["categoria"];
  expected: string | null;
  searchTop: string | null;
  searchVia: string | null;
  searchOk: boolean;
  diagnosisTop: string | null;
  diagnosisOk: boolean | null;
  diagnosisKind: string | null;
  ms: number;
}

const rows: Row[] = [];
for (const item of items) {
  const t0 = performance.now();
  const report = await analyze(item.log, { store: ctx.store, embeddings: ctx.embeddings, llm: ctx.llm }, {
    diagnoseTop: withLlm ? 1 : 0,
  });
  const ms = performance.now() - t0;
  const group = report.groups.reduce((a, b) => (b.count > a.count ? b : a));

  const top = group.candidates[0];
  const searchTop = top?.issue.id ?? null;
  const searchVia = top?.via ?? null;
  const searchOk = item.expected === null ? searchTop === null : searchTop === item.expected;

  const d: DiagnosisResult | undefined = group.diagnosis;
  const diagnosisTop = d?.kind === "diagnostico" ? d.citedIssueId : null;
  const diagnosisOk = withLlm ? (item.expected === null ? d?.kind === "recusa" : diagnosisTop === item.expected) : null;

  rows.push({
    id: item.id,
    categoria: item.categoria,
    expected: item.expected,
    searchTop,
    searchVia,
    searchOk,
    diagnosisTop,
    diagnosisOk,
    diagnosisKind: d?.kind ?? null,
    ms,
  });
  console.log(`${item.id.padEnd(16)} busca=${searchOk ? "ok " : "ERR"} ${withLlm ? `diag=${diagnosisOk ? "ok " : "ERR"} ` : ""}${Math.round(ms)} ms`);
}

const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`);
const positives = rows.filter((r) => r.expected !== null);
const negatives = rows.filter((r) => r.expected === null);
const sorted = rows.map((r) => r.ms).sort((a, b) => a - b);
const p50 = sorted[Math.floor(sorted.length / 2)]!;
const max = sorted[sorted.length - 1]!;

const lines: string[] = [];
lines.push("# Avaliação do LogSherlock", "");
lines.push(`Gerado em ${new Date().toISOString()} · Node ${process.version} · modelo: ${withLlm ? (process.env.ANTHROPIC_MODEL ?? "padrão do adaptador") : "sem LLM"}`, "");
lines.push(`Base: ${ctx.describe}. Dataset: ${rows.length} logs (${positives.length} com caso na base, ${negatives.length} sem caso).`, "");
lines.push("## Resumo", "");
lines.push("| Métrica | Resultado |", "| --- | --- |");
lines.push(`| Busca: caso correto no topo (positivos) | ${pct(positives.filter((r) => r.searchOk).length, positives.length)} |`);
lines.push(`| Busca: recusa correta sem caso (negativos) | ${pct(negatives.filter((r) => r.searchOk).length, negatives.length)} |`);
if (withLlm) {
  lines.push(`| Diagnóstico: cita o caso correto (positivos) | ${pct(positives.filter((r) => r.diagnosisOk).length, positives.length)} |`);
  lines.push(`| Diagnóstico: recusa correta (negativos) | ${pct(negatives.filter((r) => r.diagnosisOk).length, negatives.length)} |`);
  lines.push(`| Diagnóstico: citações erradas (alucinação) | ${rows.filter((r) => r.diagnosisKind === "diagnostico" && r.expected !== r.diagnosisTop).length} |`);
}
const viaCount = (via: string) => positives.filter((r) => r.searchVia === via).length;
lines.push(`| Positivos resolvidos por assinatura exata / vetorial / textual | ${viaCount("assinatura")} / ${viaCount("vetorial")} / ${viaCount("textual")} |`);
lines.push(`| Latência mediana por log | ${Math.round(p50)} ms |`);
lines.push(`| Latência máxima por log | ${Math.round(max)} ms (meta < ${LATENCY_TARGET_MS} ms: ${max < LATENCY_TARGET_MS ? "atendida" : "NÃO atendida"}) |`);
lines.push("");
lines.push("## Detalhe por log", "");
lines.push(`| Log | Categoria | Esperado | Busca | ${withLlm ? "Diagnóstico | " : ""}ms |`);
lines.push(`| --- | --- | --- | --- | ${withLlm ? "--- | " : ""}--- |`);
for (const r of rows) {
  const search = `${r.searchTop ?? "—"} (${r.searchVia ?? "sem match"}) ${r.searchOk ? "✓" : "✗"}`;
  const diag = withLlm ? `${r.diagnosisKind ?? "—"} ${r.diagnosisOk ? "✓" : "✗"} | ` : "";
  lines.push(`| ${r.id} | ${r.categoria} | ${r.expected ?? "—"} | ${search} | ${diag}${Math.round(r.ms)} |`);
}
lines.push("");
lines.push("## Limitações", "");
lines.push("- O dataset é derivado da própria base de casos: mede a capacidade de reconhecer variações do mesmo erro, não a generalização para erros inéditos.");
lines.push("- Os logs são sintéticos, baseados nos sintomas dos casos, e não em incidentes reais do time.");
if (!withLlm) {
  lines.push("- Sem `ANTHROPIC_API_KEY`: a acurácia do diagnóstico e a latência com o LLM não foram medidas. Rode `pnpm eval` com a chave para completar este relatório.");
}
lines.push("");

await mkdir(`${ROOT}/report`, { recursive: true });
await writeFile(`${ROOT}/report/eval.md`, lines.join("\n"), "utf8");
console.log(`\nRelatório gravado em report/eval.md (${withLlm ? "com LLM" : "sem LLM"}).`);
