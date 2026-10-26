import { useState } from "react";
import { api } from "../api";
import { GroupList } from "../components/GroupList";
import { LogInput } from "../components/LogInput";
import type { AnalysisReport, KnownIssue } from "../types";

export function AnalyzePage() {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(input: { text?: string; file?: File; diagnosticar: number }) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      let data: AnalysisReport;
      if (input.file) {
        const form = new FormData();
        form.append("arquivo", input.file);
        data = await api<AnalysisReport>(`/analisar?diagnosticar=${input.diagnosticar}`, { method: "POST", body: form });
      } else {
        data = await api<AnalysisReport>("/analisar", {
          method: "POST",
          body: JSON.stringify({ log: input.text, diagnosticar: input.diagnosticar }),
        });
      }
      setReport(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <LogInput busy={busy} onSubmit={run} />
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {report && (
        <section className="space-y-3">
          <p className="text-sm text-slate-600">
            {report.entries} entrada(s) · {report.groups.length} grupo(s) · {report.malformed} linha(s) malformada(s)
            {report.format ? ` · formato ${report.format}` : ""}
          </p>
          {notice && <p className="text-sm text-emerald-700">{notice}</p>}
          <GroupList groups={report.groups} onCaseCreated={(issue: KnownIssue) => setNotice(`Caso criado: ${issue.id}`)} />
        </section>
      )}
    </div>
  );
}
