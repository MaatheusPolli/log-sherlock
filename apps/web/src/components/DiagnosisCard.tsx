import type { AnalyzedGroup } from "../types";

export function DiagnosisCard({ diagnosis }: { diagnosis: NonNullable<AnalyzedGroup["diagnosis"]> }) {
  if (diagnosis.kind === "recusa") {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
        <p className="font-medium text-amber-900">Sem diagnóstico confiável</p>
        <p className="text-amber-800">{diagnosis.message}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm">
      <p className="font-medium text-emerald-900">Diagnóstico (confiança {diagnosis.confidence})</p>
      <p>
        <span className="font-medium">Causa provável:</span> {diagnosis.probableCause}
      </p>
      {diagnosis.verificationSteps.length > 0 && (
        <div>
          <p className="font-medium">Verificar:</p>
          <ol className="ml-5 list-decimal">
            {diagnosis.verificationSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}
      <p>
        <span className="font-medium">Correção:</span> {diagnosis.fix}
      </p>
      <p className="text-xs text-slate-600">Caso de referência: {diagnosis.citedIssueId}</p>
    </div>
  );
}
