import type { AnalysisReport, AnalyzedGroup, KnownIssue } from "@log-sherlock/core";

export interface Style {
  bold(s: string): string;
  dim(s: string): string;
  red(s: string): string;
  green(s: string): string;
  yellow(s: string): string;
  cyan(s: string): string;
}

export const plain: Style = { bold: (s) => s, dim: (s) => s, red: (s) => s, green: (s) => s, yellow: (s) => s, cyan: (s) => s };

const indent = (s: string, n = 4) => s.replace(/^/gm, " ".repeat(n));

function renderGroup(g: AnalyzedGroup, n: number, st: Style): string[] {
  const when = g.firstSeen ? ` · ${g.firstSeen} → ${g.lastSeen}` : "";
  const out = [
    `${st.bold(`#${n}`)} ${st.yellow(`${g.count}×`)} ${g.signature}`,
    st.dim(`    linhas ${g.firstLine}–${g.lastLine}${when} · assinatura ${g.hash}`),
  ];
  if (g.variants.length) out.push(st.dim(`    + ${g.variants.length} variação(ões) agrupada(s) por similaridade`));

  const d = g.diagnosis;
  if (d?.kind === "diagnostico") {
    out.push(
      `    ${st.green("Diagnóstico")} (confiança ${d.confidence}) — caso ${st.cyan(d.citedIssueId)}`,
      indent(`Causa provável: ${d.probableCause}`, 6),
      indent(["Verificar:", ...d.verificationSteps.map((s, i) => `  ${i + 1}. ${s}`)].join("\n"), 6),
      indent(`Correção: ${d.fix}`, 6),
    );
  } else if (d?.kind === "recusa") {
    out.push(`    ${st.red("Sem diagnóstico")}: ${d.message}`);
  } else if (g.candidates.length) {
    const list = g.candidates.map((c) => `${st.cyan(c.issue.id)} (${c.via} ${c.score.toFixed(2)})`).join(", ");
    out.push(`    Casos sugeridos: ${list}`);
  } else {
    out.push(st.dim("    Nenhum caso conhecido compatível."));
  }
  return out;
}

export function renderReport(r: AnalysisReport, st: Style = plain, limit = 10): string {
  const total = r.groups.reduce((s, g) => s + g.count, 0);
  const lines = [
    st.bold(`LogSherlock — ${r.entries} entradas (${r.format ?? "vazio"}), ${total} erros em ${r.groups.length} grupo(s)`),
    ...(r.malformed ? [st.yellow(`${r.malformed} linha(s) não interpretadas no formato detectado`)] : []),
    "",
  ];
  r.groups.slice(0, limit).forEach((g, i) => lines.push(...renderGroup(g, i + 1, st), ""));
  if (r.groups.length > limit) lines.push(st.dim(`… mais ${r.groups.length - limit} grupo(s). Use --limite ou --json.`));
  return lines.join("\n").trimEnd();
}

export function renderCases(issues: KnownIssue[], st: Style = plain): string {
  return issues
    .map((i) => `${st.cyan(i.id)}${i.integration ? st.dim(` [${i.integration}]`) : ""} — ${i.signature}`)
    .join("\n");
}
