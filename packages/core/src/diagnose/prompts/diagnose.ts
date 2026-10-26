import type { ErrorGroup } from "../../cluster/group.js";
import type { IssueMatch } from "../../domain/known-issue.js";
import type { RedactedText } from "../../domain/redacted.js";
import type { LlmTool } from "../../ports/llm.js";
import { joinRedacted, redact } from "../../redact/redact.js";

export const DIAGNOSIS_TOOL: LlmTool = {
  name: "registrar_diagnostico",
  description: "Registra o diagnóstico do grupo de erros, citando o caso conhecido usado, ou a recusa quando nenhum caso se aplica.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["caso_citado", "causa_provavel", "passos_verificacao", "correcao", "confianca", "motivo_sem_caso"],
    properties: {
      caso_citado: { type: ["string", "null"], description: "id do caso usado, ou null se nenhum se aplica" },
      causa_provavel: { type: "string" },
      passos_verificacao: { type: "array", items: { type: "string" } },
      correcao: { type: "string" },
      confianca: { type: "string", enum: ["alta", "media", "baixa"] },
      motivo_sem_caso: { type: ["string", "null"], description: "preenchido apenas quando caso_citado é null" },
    },
  },
};

export interface DiagnosisToolInput {
  caso_citado: string | null;
  causa_provavel: string;
  passos_verificacao: string[];
  correcao: string;
  confianca: "alta" | "media" | "baixa";
  motivo_sem_caso: string | null;
}

const MAX_FRAMES = 8;

/** Monta a mensagem do usuário. Tudo o que vem do log ou da base passa por `redact`. */
export function buildDiagnosisPrompt(group: ErrorGroup, candidates: IssueMatch[]): RedactedText {
  const s = group.sample;
  const frames = s.stack.slice(0, MAX_FRAMES);
  const errorBlock = [
    "## Grupo de erros",
    `Assinatura: ${group.signature.text}`,
    `Ocorrências: ${group.count} (linhas ${group.firstLine}–${group.lastLine})`,
    group.variants.length ? `Variações agrupadas: ${group.variants.map((v) => v.text).join(" | ")}` : "",
    s.http ? `HTTP: ${s.http.status} ${s.http.method ?? ""} ${s.http.url ?? ""}` : "",
    "Exemplo:",
    s.message,
    ...(frames.length ? ["Stack (topo):", ...frames] : []),
  ].filter(Boolean);

  const cases = candidates.map((c) =>
    [
      `### Caso ${c.issue.id} (via ${c.via}, score ${c.score.toFixed(2)})`,
      `Assinatura: ${c.issue.signature}`,
      c.issue.integration ? `Integração: ${c.issue.integration}` : "",
      `Sintoma: ${c.issue.symptom}`,
      `Causa: ${c.issue.rootCause}`,
      `Correção:\n${c.issue.fix}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return joinRedacted(
    [redact(errorBlock.join("\n")), redact(["## Casos conhecidos candidatos", ...cases].join("\n\n"))],
    "\n\n",
  );
}
