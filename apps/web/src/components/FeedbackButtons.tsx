import { useState } from "react";
import { api } from "../api";

interface Props {
  hash: string;
  casoId?: string;
}

/** RF08: "resolveu / não resolveu". Só um "resolveu" com caso sugerido conta como reuso. */
export function FeedbackButtons({ hash, casoId }: Props) {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(resolvido: boolean) {
    setError(null);
    try {
      await api("/feedback", { method: "POST", body: JSON.stringify({ hash, casoId, resolvido }) });
      setDone(resolvido ? "Registrado: resolvido" : "Registrado: não resolveu");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (done) return <p className="text-sm text-slate-600">{done}</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-slate-600">Resolveu?</span>
      <button
        onClick={() => send(true)}
        disabled={!casoId}
        title={casoId ? "" : "Só conta quando há um caso sugerido"}
        className="rounded-md border border-emerald-600 px-2 py-1 text-xs text-emerald-700 disabled:opacity-40"
      >
        Sim
      </button>
      <button onClick={() => send(false)} className="rounded-md border border-slate-400 px-2 py-1 text-xs text-slate-700">
        Não
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
