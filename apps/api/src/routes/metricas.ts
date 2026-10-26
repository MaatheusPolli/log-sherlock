import type { FastifyPluginAsync } from "fastify";
import type { ServerDeps } from "../server.js";

export const metricsRoutes =
  ({ ctx, metrics }: ServerDeps): FastifyPluginAsync =>
  async (app) => {
    /** RF10: top erros do período, tendência diária e casos mais reutilizados. */
    app.get<{ Querystring: { dias?: string } }>("/metricas", async (req) => {
      const dias = Math.min(Math.max(Number(req.query.dias) || 7, 1), 90);
      const casosMaisUsados = (await ctx.store.list())
        .filter((i) => i.occurrences > 0)
        .sort((a, b) => b.occurrences - a.occurrences)
        .slice(0, 10)
        .map((i) => ({ id: i.id, integracao: i.integration, usos: i.occurrences, ultimoUso: i.lastSeen }));
      return { ...metrics.dashboard(dias), casosMaisUsados };
    });
  };
