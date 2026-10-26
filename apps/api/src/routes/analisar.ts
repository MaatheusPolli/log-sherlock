import { createInterface } from "node:readline";
import { analyze, redactWithReport } from "@log-sherlock/core";
import type { FastifyPluginAsync } from "fastify";
import type { ServerDeps } from "../server.js";

const ACCEPTED = /\.(log|txt|json|jsonl)$/i;

interface AnalyzeBody {
  log?: string;
  diagnosticar?: number;
}

export const analyzeRoutes =
  ({ ctx, metrics }: ServerDeps): FastifyPluginAsync =>
  async (app) => {
    const deps = { store: ctx.store, embeddings: ctx.embeddings, llm: ctx.llm };

    /** RF01: texto colado (JSON) ou upload de arquivo (multipart, processado em streaming). */
    app.post<{ Body: AnalyzeBody; Querystring: { diagnosticar?: string } }>("/analisar", async (req, reply) => {
      let diagnoseTop = Number(req.query.diagnosticar ?? 0);
      let input: string | AsyncIterable<string>;

      if (req.isMultipart()) {
        const file = await req.file();
        if (!file) return reply.code(400).send({ erro: "envie um arquivo no campo 'arquivo'" });
        if (!ACCEPTED.test(file.filename)) return reply.code(415).send({ erro: "formatos aceitos: .log, .txt, .json, .jsonl" });
        input = createInterface({ input: file.file, crlfDelay: Infinity });
      } else {
        const body = req.body ?? {};
        if (typeof body.log !== "string" || !body.log.trim()) return reply.code(400).send({ erro: "campo 'log' obrigatório" });
        input = body.log;
        diagnoseTop = Number(body.diagnosticar ?? diagnoseTop);
      }

      const report = await analyze(input, deps, { diagnoseTop: Math.max(0, Math.min(diagnoseTop || 0, 10)) });
      await metrics.recordAnalysis(report);
      return report;
    });

    /** Mostra o que seria enviado ao LLM, com a contagem do que foi removido. */
    app.post<{ Body: { texto?: string } }>("/redacao/preview", async (req, reply) => {
      const texto = req.body?.texto;
      if (typeof texto !== "string") return reply.code(400).send({ erro: "campo 'texto' obrigatório" });
      const { text, found } = redactWithReport(texto);
      return { texto: text, encontrados: found };
    });
  };
