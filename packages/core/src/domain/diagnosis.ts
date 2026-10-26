import type { IssueMatch } from "./known-issue.js";

export type Confidence = "alta" | "media" | "baixa";

export interface Diagnosis {
  kind: "diagnostico";
  signatureHash: string;
  probableCause: string;
  verificationSteps: string[];
  fix: string;
  /** Caso da base usado como referência — obrigatório. */
  citedIssueId: string;
  confidence: Confidence;
  /** Candidatos que foram mostrados ao modelo. */
  candidates: IssueMatch[];
}

export type RefusalReason = "sem-caso-na-base" | "modelo-sem-caso-compativel" | "citacao-invalida" | "resposta-invalida";

export interface Refusal {
  kind: "recusa";
  signatureHash: string;
  reason: RefusalReason;
  /** Explicação para o usuário. */
  message: string;
  candidates: IssueMatch[];
}

export type DiagnosisResult = Diagnosis | Refusal;
