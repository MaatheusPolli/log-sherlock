import { CaseValidationError, createCase, type NewCaseInput } from "@log-sherlock/core";
import type { FastifyPluginAsync } from "fastify";
import type { ServerDeps } from "../server.js";

export const caseRoutes =
  ({ ctx }: ServerDeps): FastifyPluginAsync =>
  async (app) => {
    app.get("/casos", async () => {
      const issues = await ctx.store.list();
      return issues.sort((a, b) => b.occurrences - a.occurrences || a.id.localeCompare(b.id));
    });

    app.get<{ Params: { id: string } }>("/casos/:id", async (req, reply) => {
      const issue = await ctx.store.get(req.params.id);
      return issue ?? reply.code(404).send({ erro: "caso não encontrado" });
    });

    /** RF08: novo caso a partir de um diagnóstico (ou manual). */
    app.post<{ Body: NewCaseInput }>("/casos", async (req, reply) => {
      try {
        const issue = await createCase(req.body ?? ({} as NewCaseInput), {
          dir: ctx.knowledgeDir,
          store: ctx.store,
          embeddings: ctx.embeddings,
        });
        return reply.code(201).send(issue);
      } catch (err) {
        if (err instanceof CaseValidationError) return reply.code(422).send({ erro: err.message });
        throw err;
      }
    });
  };
