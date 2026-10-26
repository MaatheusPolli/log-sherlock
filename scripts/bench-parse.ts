// Gera ~50 MB de log misto em streaming e mede parse + assinatura (RNF: < 30 s).
import { parseLog } from "../packages/core/src/parse/parse.js";
import { signatureOfEntry } from "../packages/core/src/normalize/signature.js";

const templates = [
  (i: number) => `2024-05-10 13:22:${String(i % 60).padStart(2, "0")},123 [ERROR] Transaction (Process ID ${i % 900}) was deadlocked on lock resources with another process and has been chosen as the deadlock victim. pedido ${i} cliente c${i}@loja.com.br`,
  (i: number) => `2024-05-10 13:22:01,123 [WARN] HTTP 429 Too Many Requests GET https://api.mercadolibre.com/items/MLB${3456789012 + i} local_rate_limited`,
  (i: number) => `2024-05-10 13:22:01,123 [ERROR] Error: read ECONNRESET req ${crypto.randomUUID()}`,
  () => `    at TLSWrap.onStreamRead (node:internal/stream_base_commons:217:20)`,
];
const TARGET = 50 * 1024 * 1024;
function* lines() {
  let bytes = 0;
  for (let i = 0; bytes < TARGET; i++) {
    const l = templates[i % templates.length]!(i);
    bytes += l.length + 1;
    yield l;
  }
}
const t0 = performance.now();
const groups = new Map<string, number>();
let n = 0;
for await (const e of parseLog(lines())) {
  const h = signatureOfEntry(e).hash;
  groups.set(h, (groups.get(h) ?? 0) + 1);
  n++;
}
const s = (performance.now() - t0) / 1000;
console.log(`${n} entradas, ${groups.size} assinaturas, ${s.toFixed(1)} s, heap ${(process.memoryUsage().heapUsed / 1e6).toFixed(0)} MB`);
