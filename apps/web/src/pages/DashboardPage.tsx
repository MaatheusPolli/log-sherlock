import { useEffect, useState } from "react";
import { api } from "../api";
import type { Dashboard } from "../types";

export function DashboardPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Dashboard>(`/metricas?dias=${days}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const max = Math.max(1, ...(data?.trend.map((t) => t.count) ?? [1]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Painel</h2>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-md border border-slate-300 p-1.5 text-sm">
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
      </div>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!data && !error && <p className="text-sm text-slate-600">Carregando...</p>}
      {data && (
        <>
          <section className="rounded-lg bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-medium">Ocorrências por dia</h3>
            <div className="flex h-40 items-end gap-1" role="img" aria-label="Tendência de ocorrências">
              {data.trend.map((t) => (
                <div key={t.day} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] text-slate-500">{t.count}</span>
                  <div className="w-full rounded-t bg-sky-500" style={{ height: `${(t.count / max) * 100}%`, minHeight: t.count ? 2 : 0 }} />
                  <span className="text-[10px] text-slate-400">{t.day.slice(5)}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-lg bg-white p-4 shadow-sm">
              <h3 className="mb-3 font-medium">Top erros</h3>
              {data.topErrors.length === 0 ? (
                <p className="text-sm text-slate-600">Sem dados no período.</p>
              ) : (
                <ol className="space-y-2 text-sm">
                  {data.topErrors.map((e) => (
                    <li key={e.hash} className="flex justify-between gap-3">
                      <code className="break-all text-xs">{e.signature}</code>
                      <span className="shrink-0 font-semibold">{e.count}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <section className="rounded-lg bg-white p-4 shadow-sm">
              <h3 className="mb-3 font-medium">Casos mais reutilizados</h3>
              {data.casosMaisUsados.length === 0 ? (
                <p className="text-sm text-slate-600">Nenhum caso reutilizado ainda.</p>
              ) : (
                <ol className="space-y-2 text-sm">
                  {data.casosMaisUsados.map((c) => (
                    <li key={c.id} className="flex justify-between gap-3">
                      <span className="break-all">{c.id}</span>
                      <span className="shrink-0 font-semibold">{c.usos}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <p className="text-sm text-slate-600">
            Feedback no período: {data.feedback.resolved} resolvido(s), {data.feedback.notResolved} não resolvido(s).
          </p>
        </>
      )}
    </div>
  );
}
