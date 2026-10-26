import { createContext, MetricsStore } from "@log-sherlock/core";
import { buildServer } from "./server.js";

const ctx = await createContext();
const metrics = await new MetricsStore(process.env.METRICS_FILE ?? "data/metrics.json").load();
const app = await buildServer({ ctx, metrics }, { logger: true });
const port = Number(process.env.PORT ?? 3333);
await app.listen({ port, host: process.env.HOST ?? "127.0.0.1" });
app.log.info(`LogSherlock API em http://localhost:${port} (${ctx.describe})`);
