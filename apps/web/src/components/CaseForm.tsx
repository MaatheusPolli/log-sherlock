import { useState } from "react";
import { api } from "../api";
import type { AnalyzedGroup, KnownIssue, NewCaseInput } from "../types";

interface Props {
  group: AnalyzedGroup;
  onCreated: (issue: KnownIssue) => void;
}

/** RF08: transforma o grupo (e o diagnóstico, se houver) em um novo caso da base. */
export function CaseForm({ group, onCreated }: Props) {
  const d = group.diagnosis?.kind === "diagnostico" ? group.diagnosis : undefined;
  const [form, setForm] = useState({
    integration: "",
    symptom: group.sample.split("\n")[0] ?? "",
    rootCause: d?.probableCause ?? "",
    fix: d?.fix ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    setSaving(true);
    const body: NewCaseInput = { signature: group.signature, ...form, integration: form.integration || undefined };
    try {
      onCreated(await api<KnownIssue>("/casos", { method: "POST", body: JSON.stringify(body) }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof typeof form, label: string) => (
    <label className="block text-xs font-medium text-slate-700">
      {label}
      <input
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="mt-1 w-full rounded-md border border-slate-300 p-1.5 text-sm font-normal"
      />
    </label>
  );

  return (
    <div className="space-y-2 rounded-md border border-slate-200 p-3">
      <p className="text-sm font-medium">Salvar como novo caso</p>
      {field("integration", "Integração (ex.: VTEX)")}
      {field("symptom", "Sintoma")}
      {field("rootCause", "Causa")}
      {field("fix", "Correção")}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={save}
        disabled={saving || !form.symptom.trim() || !form.rootCause.trim() || !form.fix.trim()}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
      >
        {saving ? "Salvando..." : "Criar caso"}
      </button>
    </div>
  );
}
