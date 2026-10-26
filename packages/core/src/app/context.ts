import { AnthropicLlm } from "../diagnose/anthropic.js";
import { LocalEmbedding, VoyageEmbedding } from "../knowledge/embeddings.js";
import { indexKnowledgeBase } from "../knowledge/indexer.js";
import { MemoryKnowledgeStore } from "../knowledge/memory-store.js";
import { PgKnowledgeStore } from "../knowledge/pg-store.js";
import type { EmbeddingPort } from "../ports/embedding.js";
import type { LlmPort } from "../ports/llm.js";
import type { KnowledgeStore } from "../ports/store.js";

export interface AppContext {
  store: KnowledgeStore;
  embeddings: EmbeddingPort;
  /** Ausente quando não há credencial: a análise ainda agrupa e busca casos. */
  llm?: LlmPort;
  knowledgeDir: string;
  describe: string;
}

export interface ContextEnv {
  DATABASE_URL?: string;
  VOYAGE_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  KNOWLEDGE_DIR?: string;
}

/** Monta as dependências a partir do ambiente, com fallbacks offline. */
export async function createContext(env: ContextEnv = process.env): Promise<AppContext> {
  const knowledgeDir = env.KNOWLEDGE_DIR ?? "knowledge-base";
  const embeddings: EmbeddingPort = env.VOYAGE_API_KEY ? new VoyageEmbedding(env.VOYAGE_API_KEY) : new LocalEmbedding();

  let store: KnowledgeStore;
  if (env.DATABASE_URL) {
    const pg = (await import("pg")).default;
    const pgStore = new PgKnowledgeStore(new pg.Pool({ connectionString: env.DATABASE_URL }), embeddings.dimensions);
    await pgStore.migrate();
    store = pgStore;
  } else {
    store = new MemoryKnowledgeStore();
  }
  await indexKnowledgeBase(knowledgeDir, store, embeddings);

  const llm = env.ANTHROPIC_API_KEY ? new AnthropicLlm({ model: env.ANTHROPIC_MODEL }) : undefined;
  const describe = [
    env.DATABASE_URL ? "postgres" : "memória",
    env.VOYAGE_API_KEY ? "voyage" : "embedding local",
    llm ? "claude" : "sem LLM",
  ].join(" · ");
  return { store, embeddings, llm, knowledgeDir, describe };
}

