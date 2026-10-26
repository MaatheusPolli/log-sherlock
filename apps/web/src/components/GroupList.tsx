import { useState } from "react";
import type { AnalyzedGroup, KnownIssue } from "../types";
import { CaseForm } from "./CaseForm";
import { DiagnosisCard } from "./DiagnosisCard";
import { FeedbackButtons } from "./FeedbackButtons";

export function GroupList({ groups, onCaseCreated }: { groups: AnalyzedGroup[]; onCaseCreated: (i: KnownIssue) => void }) {
  if (groups.length === 0) return <p className="text-sm text-slate-600">Nenhum erro encontrado no log.</p>;
  return (
    <ul className="space-y-4">
      {groups.map((g) => (
        <GroupCard key={g.hash} group={g} onCaseCreated={onCaseCreated} />
      ))}
    </ul>
  );
}

function GroupCard({ group: g, onCaseCreated }: { group: AnalyzedGroup; onCaseCreated: (i: KnownIssue) => void }) {
  const [creating, setCreating] = useState(false);
  const best = g.candidates[0];
  return (
    <li className="space-y-3 rounded-lg bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <code className="text-sm font-semibold break-all">{g.signature}</code>
        <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs text-white">{g.count}x</span>
      </div>
      <p className="text-xs text-slate-500">
        linhas {g.firstLine}–{g.lastLine} · {g.variants.length} variante(s)
        {g.lastSeen ? ` · última ocorrência ${g.lastSeen}` : ""}
      </p>
      <pre className="max-h-40 overflow-auto rounded-md bg-slate-100 p-2 text-xs whitespace-pre-wrap">{g.sample}</pre>

      {g.diagnosis && <DiagnosisCard diagnosis={g.diagnosis} />}

      {best ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm">
          <p className="font-medium">
            Caso sugerido: {best.issue.id} <span className="text-xs text-slate-600">({best.via}, score {best.score.toFixed(2)})</span>
          </p>
          <p>{best.issue.fix}</p>
        </div>
      ) : (
        <p className="text-sm text-slate-600">Nenhum caso compatível na base.</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FeedbackButtons hash={g.hash} casoId={best?.issue.id} />
        {!creating && (
          <button onClick={() => setCreating(true)} className="text-sm text-slate-700 underline">
            Criar caso a partir deste erro
          </button>
        )}
      </div>
      {creating && (
        <CaseForm
          group={g}
          onCreated={(issue) => {
            setCreating(false);
            onCaseCreated(issue);
          }}
        />
      )}
    </li>
  );
}
