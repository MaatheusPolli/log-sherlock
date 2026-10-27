import { useState } from "react";
import { api } from "../api";

interface PreviewResponse {
  texto: string;
  encontrados: Record<string, number>;
}

/** Mostra o texto como sairia para o LLM, com a contagem do que foi removido por tipo. */
export function RedactionPreview() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function preview() {
    setBusy(true);
    setError(null);
    try {
      setResult(await api<PreviewResponse>("/redacao/preview", { method: "POST", body: JSON.stringify({ texto: text }) }));
    } catch (err) {
      setError((err as Error).message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  const kinds = result ? Object.entries(result.encontrados) : [];
  const total = kinds.reduce((sum, [, n]) => sum + n, 0);

  return (
    <section className="space-y-3 rounded-lg bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold">Prévia da redação</h2>
      <p className="text-xs text-slate-500">
        Veja o que sairia para o Claude antes de analisar. Nada é enviado ao LLM por este painel.
      </p>
      <label className="block text-sm font-medium" htmlFor="redacao-texto">
        Trecho do log
      </label>
      <textarea
        id="redacao-texto"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Cole um trecho com CPF, token ou e-mail para ver a redação"
        className="w-full rounded-md border border-slate-300 p-2 font-mono text-xs"
      />
      <button
        type="button"
        onClick={preview}
        disabled={busy || text.trim().length === 0}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {busy ? "Redigindo…" : "Ver redação"}
      </button>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {result && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            {total === 0
              ? "Nenhum dado sensível encontrado."
              : `${total} trecho(s) removido(s): ${kinds.map(([kind, n]) => `${kind} ×${n}`).join(", ")}`}
          </p>
          <pre className="overflow-x-auto rounded-md bg-slate-50 p-3 font-mono text-xs whitespace-pre-wrap break-all">
            {result.texto}
          </pre>
        </div>
      )}
    </section>
  );
}
