import multipart from "@fastify/multipart";
import type { AppContext, MetricsStore } from "@log-sherlock/core";
import Fastify, { type FastifyInstance } from "fastify";
import { analyzeRoutes } from "./routes/analisar.js";
import { caseRoutes } from "./routes/casos.js";
import { feedbackRoutes } from "./routes/feedback.js";
import { metricsRoutes } from "./routes/metricas.js";

export interface ServerDeps {
  ctx: AppContext;
  metrics: MetricsStore;
}

const MAX_BYTES = 60 * 1024 * 1024; // RNF: logs de até 50 MB

export async function buildServer(deps: ServerDeps, opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  // O logger do Fastify nunca registra corpo de requisição: o log enviado pode conter dados sensíveis.
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: MAX_BYTES });
  await app.register(multipart, { limits: { fileSize: MAX_BYTES, files: 1 } });

  app.get("/api/saude", async () => ({ ok: true, modo: deps.ctx.describe, diagnostico: Boolean(deps.ctx.llm) }));
  await app.register(analyzeRoutes(deps), { prefix: "/api" });
  await app.register(caseRoutes(deps), { prefix: "/api" });
  await app.register(feedbackRoutes(deps), { prefix: "/api" });
  await app.register(metricsRoutes(deps), { prefix: "/api" });
  return app;
}
