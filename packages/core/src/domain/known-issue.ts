export interface KnownIssue {
  id: string;
  /** Texto normalizado do erro (ver `normalize`). */
  signature: string;
  /** Hash da assinatura, usado no match exato. */
  signatureHash: string;
  symptom: string;
  rootCause: string;
  fix: string;
  integration?: string;
  tags: string[];
  /** Quantas vezes o caso foi usado em diagnósticos confirmados. */
  occurrences: number;
  lastSeen?: string;
}

export type MatchVia = "assinatura" | "vetorial" | "textual";

export interface IssueMatch {
  issue: KnownIssue;
  /** 0..1 — 1 para match exato de assinatura. */
  score: number;
  via: MatchVia;
}
