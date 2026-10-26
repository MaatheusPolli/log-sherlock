import type { KnownIssue } from "../domain/known-issue.js";
import type { EmbeddingPort } from "../ports/embedding.js";
import type { KnowledgeStore } from "../ports/store.js";
import { redact } from "../redact/redact.js";
import { loadKnowledgeBase } from "./loader.js";

/** Texto que representa o caso no espaço vetorial: o erro e como ele se manifesta. */
export const embeddingText = (i: KnownIssue): string => `${i.signature}\n${i.symptom}`;

export async function indexIssues(issues: KnownIssue[], store: KnowledgeStore, embeddings: EmbeddingPort): Promise<number> {
  // A base é curada, mas redigir antes de enviar ao provedor de embeddings custa pouco.
  const vectors = await embeddings.embed(issues.map((i) => redact(embeddingText(i))));
  for (const [n, issue] of issues.entries()) await store.upsert(issue, vectors[n]!);
  return issues.length;
}

export async function indexKnowledgeBase(dir: string, store: KnowledgeStore, embeddings: EmbeddingPort): Promise<number> {
  return indexIssues(await loadKnowledgeBase(dir), store, embeddings);
}
