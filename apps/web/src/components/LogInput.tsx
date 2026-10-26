import { useState } from "react";

interface Props {
  busy: boolean;
  onSubmit: (input: { text?: string; file?: File; diagnosticar: number }) => void;
}

const ACCEPT = ".log,.txt,.json,.jsonl";

export function LogInput({ busy, onSubmit }: Props) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [diagnosticar, setDiagnosticar] = useState(0);
  const canSubmit = !busy && (file !== null || text.trim().length > 0);

  return (
    <form
      className="space-y-3 rounded-lg bg-white p-4 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit(file ? { file, diagnosticar } : { text, diagnosticar });
      }}
    >
      <label className="block text-sm font-medium" htmlFor="log-text">
        Cole o log (JSON, linha ou stack trace)
      </label>
      <textarea
        id="log-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={file !== null}
        rows={8}
        placeholder="2026-10-20 10:00:01 ERROR VTEX 401 Unauthorized token expirado"
        className="w-full rounded-md border border-slate-300 p-2 font-mono text-xs disabled:bg-slate-100"
      />
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="log-file">
            ou envie um arquivo
          </label>
          <input id="log-file" type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="diagnosticar">
            Diagnosticar com Claude (grupos)
          </label>
          <select
            id="diagnosticar"
            value={diagnosticar}
            onChange={(e) => setDiagnosticar(Number(e.target.value))}
            className="rounded-md border border-slate-300 p-1.5 text-sm"
          >
            <option value={0}>Não</option>
            <option value={1}>Os 1 maior</option>
            <option value={3}>Os 3 maiores</option>
            <option value={5}>Os 5 maiores</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="ml-auto rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "Analisando..." : "Analisar"}
        </button>
      </div>
      <p className="text-xs text-slate-500">Dados sensíveis (CPF, CNPJ, tokens, e-mails) são redigidos antes de qualquer envio ao modelo.</p>
    </form>
  );
}
