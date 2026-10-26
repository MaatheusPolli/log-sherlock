import { useState } from "react";
import { AnalyzePage } from "./pages/AnalyzePage";
import { CasesPage } from "./pages/CasesPage";
import { DashboardPage } from "./pages/DashboardPage";

const TABS = [
  { id: "analisar", label: "Analisar" },
  { id: "casos", label: "Casos" },
  { id: "painel", label: "Painel" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function App() {
  const [tab, setTab] = useState<Tab>("analisar");
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">LogSherlock</h1>
        <nav className="flex gap-1 rounded-lg bg-slate-200 p-1" aria-label="Seções">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t.id ? "bg-white shadow" : "text-slate-600 hover:text-slate-900"}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      {tab === "analisar" && <AnalyzePage />}
      {tab === "casos" && <CasesPage />}
      {tab === "painel" && <DashboardPage />}
    </div>
  );
}
