import type { IssueMatch } from "../domain/known-issue.js";
import type { Signature } from "../domain/signature.js";
import type { EmbeddingPort } from "../ports/embedding.js";
import type { KnowledgeStore } from "../ports/store.js";
import { redact } from "../redact/redact.js";

export interface SearchOptions {
  limit?: number;
  /** Similaridade mínima de cosseno para aceitar um resultado vetorial. */
  minVectorScore?: number;
  /** Fração mínima de termos para aceitar um resultado textual. */
  minTextScore?: number;
}

// Calibrado com LocalEmbedding sobre a base inicial: variações do mesmo erro ficam
// em ≥ 0,49 e erros sem caso em ≤ 0,30 (vetorial) / ≤ 0,33 (textual).
export const DEFAULT_SEARCH: Required<SearchOptions> = { limit: 3, minVectorScore: 0.45, minTextScore: 0.5 };

/**
 * Busca em cascata: assinatura exata → vetorial → textual.
 * Cada nível só é consultado se o anterior não trouxe nada acima do limiar,
 * então um match exato nunca é "diluído" por candidatos parecidos.
 */
export async function searchKnownIssues(
  signature: Signature,
  store: KnowledgeStore,
  embeddings: EmbeddingPort,
  opts: SearchOptions = {},
): Promise<IssueMatch[]> {
  const { limit, minVectorScore, minTextScore } = { ...DEFAULT_SEARCH, ...opts };

  const exact = await store.bySignatureHash(signature.hash);
  if (exact) return [{ issue: exact, score: 1, via: "assinatura" }];

  const query = redact(signature.text);
  const [vector] = await embeddings.embed([query]);
  const byVector = (await store.vectorSearch(vector!, limit)).filter((s) => s.score >= minVectorScore);
  if (byVector.length) return byVector.map((s) => ({ ...s, via: "vetorial" }));

  const byText = (await store.textSearch(query, limit)).filter((s) => s.score >= minTextScore);
  return byText.map((s) => ({ ...s, via: "textual" }));
}
