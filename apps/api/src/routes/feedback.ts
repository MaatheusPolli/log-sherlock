import type { FastifyPluginAsync } from "fastify";
import type { ServerDeps } from "../server.js";

interface FeedbackBody {
  hash?: string;
  casoId?: string;
  resolvido?: boolean;
}

export const feedbackRoutes =
  ({ ctx, metrics }: ServerDeps): FastifyPluginAsync =>
  async (app) => {
    /** RF08: "resolveu / não resolveu". Só um "resolveu" conta como reuso do caso. */
    app.post<{ Body: FeedbackBody }>("/feedback", async (req, reply) => {
      const { hash, casoId, resolvido } = req.body ?? {};
      if (typeof hash !== "string" || typeof resolvido !== "boolean") {
        return reply.code(400).send({ erro: "campos 'hash' e 'resolvido' obrigatórios" });
      }
      if (casoId && !(await ctx.store.get(casoId))) return reply.code(404).send({ erro: "caso não encontrado" });
      const at = new Date().toISOString();
      if (resolvido && casoId) await ctx.store.recordUse(casoId, at);
      await metrics.recordFeedback({ at, signatureHash: hash, issueId: casoId, resolved: resolvido });
      return reply.code(204).send();
    });
  };
