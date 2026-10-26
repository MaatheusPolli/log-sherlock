import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { KnownIssue } from "../types";

export function CasesPage() {
  const [issues, setIssues] = useState<KnownIssue[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<KnownIssue[]>("/casos")
      .then(setIssues)
      .catch((err: Error) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!issues) return [];
    if (!q) return issues;
    return issues.filter((i) =>
      [i.id, i.symptom, i.rootCause, i.fix, i.integration ?? "", ...i.tags].some((s) => s.toLowerCase().includes(q)),
    );
  }, [issues, query]);

  if (error) return <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (!issues) return <p className="text-sm text-slate-600">Carregando casos...</p>;

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filtrar por sintoma, causa, integração ou tag"
        className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
      />
      <p className="text-xs text-slate-500">
        {filtered.length} de {issues.length} caso(s)
      </p>
      <ul className="space-y-3">
        {filtered.map((i) => (
          <li key={i.id} className="rounded-lg bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">{i.symptom}</h2>
              <span className="text-xs text-slate-500">
                {i.integration ? `${i.integration} · ` : ""}
                {i.occurrences} uso(s)
              </span>
            </div>
            <p className="mt-2 text-sm">
              <span className="font-medium">Causa:</span> {i.rootCause}
            </p>
            <p className="text-sm">
              <span className="font-medium">Correção:</span> {i.fix}
            </p>
            {i.tags.length > 0 && <p className="mt-2 text-xs text-slate-500">{i.tags.join(", ")}</p>}
            <p className="mt-1 font-mono text-[11px] text-slate-400">{i.id}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
