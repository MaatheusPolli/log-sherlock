import type { RedactedText } from "../domain/redacted.js";

/** Embeddings também saem para um provedor externo: só texto redigido. */
export interface EmbeddingPort {
  readonly dimensions: number;
  embed(texts: readonly RedactedText[]): Promise<number[][]>;
}
