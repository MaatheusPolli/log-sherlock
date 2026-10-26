import type { KnownIssue } from "../domain/known-issue.js";

export interface Scored {
  issue: KnownIssue;
  score: number;
}

export interface KnowledgeStore {
  upsert(issue: KnownIssue, embedding: number[]): Promise<void>;
  get(id: string): Promise<KnownIssue | undefined>;
  bySignatureHash(hash: string): Promise<KnownIssue | undefined>;
  /** Similaridade de cosseno, maior primeiro. */
  vectorSearch(embedding: number[], limit: number): Promise<Scored[]>;
  /** Busca textual; score normalizado em 0..1. */
  textSearch(query: string, limit: number): Promise<Scored[]>;
  list(): Promise<KnownIssue[]>;
  recordUse(id: string, at: string): Promise<void>;
}
