import { createHash } from "node:crypto";
import { tokenize } from "../cluster/similarity.js";
import type { RedactedText } from "../domain/redacted.js";
import type { EmbeddingPort } from "../ports/embedding.js";

function bucket(feature: string, dims: number): [number, number] {
  const h = createHash("md5").update(feature).digest();
  return [h.readUInt32LE(0) % dims, h[4]! & 1 ? 1 : -1];
}

/**
 * Embedding local e determinístico (feature hashing de palavras + trigramas de caracteres).
 * Não entende sinônimos como um modelo, mas é suficiente para agrupar variações do mesmo
 * erro e roda offline, sem custo — usado em testes, CLI sem chave e como fallback.
 */
export class LocalEmbedding implements EmbeddingPort {
  constructor(readonly dimensions = 512) {}

  embedOne(text: string): number[] {
    const v = new Array<number>(this.dimensions).fill(0);
    const words = tokenize(text);
    const features = [
      ...words.map((w) => [`w:${w}`, 2] as const),
      ...words.flatMap((w) => {
        const padded = ` ${w} `;
        return Array.from({ length: Math.max(0, padded.length - 2) }, (_, i) => [`c:${padded.slice(i, i + 3)}`, 1] as const);
      }),
    ];
    for (const [f, weight] of features) {
      const [i, sign] = bucket(f, this.dimensions);
      v[i]! += sign * weight;
    }
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    return norm ? v.map((x) => x / norm) : v;
  }

  async embed(texts: readonly RedactedText[]): Promise<number[][]> {
    return texts.map((t) => this.embedOne(t));
  }
}

type Fetch = typeof fetch;

/** Voyage AI (`voyage-3`, multilíngue). */
export class VoyageEmbedding implements EmbeddingPort {
  readonly dimensions = 1024;

  constructor(
    private readonly apiKey: string,
    private readonly model = "voyage-3",
    private readonly fetchFn: Fetch = fetch,
    private readonly retryBaseMs = 2000,
  ) {}

  async embed(texts: readonly RedactedText[]): Promise<number[][]> {
    if (!texts.length) return [];
    const res = await this.request(texts);
    if (!res.ok) throw new Error(`Voyage respondeu HTTP ${res.status}`);
    const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
    return [...json.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }

  /** Repete em HTTP 429 (limite de taxa) com espera crescente; outros erros não são repetidos. */
  private async request(texts: readonly RedactedText[], attempt = 0): Promise<Response> {
    const res = await this.fetchFn("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ input: texts, model: this.model }),
    });
    if (res.status !== 429 || attempt >= MAX_RETRIES) return res;
    await sleep(this.retryBaseMs * 2 ** attempt);
    return this.request(texts, attempt + 1);
  }
}

const MAX_RETRIES = 5;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
