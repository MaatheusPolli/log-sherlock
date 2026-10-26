import type { DiagnosisResult, Refusal, RefusalReason } from "../domain/diagnosis.js";
import type { IssueMatch } from "../domain/known-issue.js";
import type { DiagnosisToolInput } from "./prompts/diagnose.js";

const MESSAGES: Record<RefusalReason, string> = {
  "sem-caso-na-base": "Nenhum caso conhecido na base é compatível com este erro. Investigue manualmente e, ao resolver, registre o caso.",
  "modelo-sem-caso-compativel": "Os casos mais próximos da base não explicam este erro.",
  "citacao-invalida": "O modelo citou um caso que não estava entre os candidatos; o diagnóstico foi descartado.",
  "resposta-invalida": "O modelo não devolveu um diagnóstico estruturado; o resultado foi descartado.",
};

export function refuse(signatureHash: string, reason: RefusalReason, candidates: IssueMatch[], detail?: string): Refusal {
  return { kind: "recusa", signatureHash, reason, message: detail ? `${MESSAGES[reason]} ${detail}` : MESSAGES[reason], candidates };
}

function isToolInput(x: unknown): x is DiagnosisToolInput {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    (typeof o.caso_citado === "string" || o.caso_citado === null) &&
    typeof o.causa_provavel === "string" &&
    Array.isArray(o.passos_verificacao) &&
    o.passos_verificacao.every((p) => typeof p === "string") &&
    typeof o.correcao === "string" &&
    ["alta", "media", "baixa"].includes(o.confianca as string)
  );
}

/**
 * Pós-verificação da resposta do modelo: o diagnóstico só é aceito se citar
 * um dos candidatos efetivamente enviados. Qualquer outra coisa vira recusa.
 */
export function validateDiagnosis(signatureHash: string, candidates: IssueMatch[], raw: unknown): DiagnosisResult {
  if (!isToolInput(raw)) return refuse(signatureHash, "resposta-invalida", candidates);
  if (raw.caso_citado === null) {
    return refuse(signatureHash, "modelo-sem-caso-compativel", candidates, raw.motivo_sem_caso ?? undefined);
  }
  if (!candidates.some((c) => c.issue.id === raw.caso_citado)) {
    return refuse(signatureHash, "citacao-invalida", candidates);
  }
  return {
    kind: "diagnostico",
    signatureHash,
    probableCause: raw.causa_provavel,
    verificationSteps: raw.passos_verificacao,
    fix: raw.correcao,
    citedIssueId: raw.caso_citado,
    confidence: raw.confianca,
    candidates,
  };
}
