// Espelho dos tipos de @log-sherlock/core usados pela interface (sem importar o pacote no browser).
export interface KnownIssue {
  id: string;
  signature: string;
  signatureHash: string;
  symptom: string;
  rootCause: string;
  fix: string;
  integration?: string;
  tags: string[];
  occurrences: number;
  lastSeen?: string;
}

export interface IssueMatch {
  issue: KnownIssue;
  score: number;
  via: "assinatura" | "vetorial" | "textual";
}

export interface Diagnosis {
  kind: "diagnostico";
  signatureHash: string;
  probableCause: string;
  verificationSteps: string[];
  fix: string;
  citedIssueId: string;
  confidence: "alta" | "media" | "baixa";
}

export interface Refusal {
  kind: "recusa";
  signatureHash: string;
  reason: string;
  message: string;
}

export interface AnalyzedGroup {
  signature: string;
  hash: string;
  variants: string[];
  count: number;
  firstLine: number;
  lastLine: number;
  firstSeen?: string;
  lastSeen?: string;
  levels: Record<string, number>;
  sample: string;
  candidates: IssueMatch[];
  diagnosis?: Diagnosis | Refusal;
}

export interface AnalysisReport {
  id: string;
  createdAt: string;
  format?: string;
  entries: number;
  malformed: number;
  groups: AnalyzedGroup[];
}

export interface Dashboard {
  days: number;
  topErrors: { hash: string; signature: string; count: number }[];
  trend: { day: string; count: number }[];
  feedback: { resolved: number; notResolved: number };
  casosMaisUsados: { id: string; integracao?: string; usos: number; ultimoUso?: string }[];
}

export interface NewCaseInput {
  signature: string;
  symptom: string;
  rootCause: string;
  fix: string;
  integration?: string;
  tags?: string[];
}
