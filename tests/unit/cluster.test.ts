import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { groupEntries, Grouper, mergeSimilar } from "../../packages/core/src/cluster/group.js";
import { cosine, tokenize } from "../../packages/core/src/cluster/similarity.js";
import { LocalEmbedding } from "../../packages/core/src/knowledge/embeddings.js";
import { parseLog } from "../../packages/core/src/parse/parse.js";

describe("similaridade", () => {
  it("cosine", () => {
    expect(cosine([1, 0], [1, 0])).toBe(1);
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(cosine([0, 0], [1, 0])).toBe(0);
    expect(cosine([1, 1], [1])).toBeCloseTo(Math.SQRT1_2);
  });

  it("tokenize remove acentos, placeholders e stopwords", () => {
    expect(tokenize("Rejeição de NF-e <NUM> [CPF] na Chave")).toEqual(["rejeicao", "nf", "chave"]);
  });
});

describe("agrupamento", () => {
  it("conjunto com 5 grupos conhecidos é agrupado corretamente", async () => {
    const log = readFileSync("tests/fixtures/logs/clusters.log", "utf8");
    const groups = await groupEntries(parseLog(log), new LocalEmbedding());

    expect(groups.map((g) => [g.signature.text.slice(0, 40), g.count])).toEqual([
      ["HTTP 429 Too Many Requests GET <URL> loc", 3],
      ["Rejeição 539: Duplicidade de NF-e, com d", 3],
      ["HTTP 401 Unauthorized POST <URL> invalid", 3],
      ["Transaction (Process ID <NUM>) was deadl", 2],
      ["SyntaxError: Unexpected token < in JSON ", 2],
    ]);
    const [rate, nfe] = groups;
    expect(rate!.variants.map((v) => v.text)).toEqual(["HTTP 429 Too Many Requests PUT <URL> local_rate_limited"]);
    expect(rate).toMatchObject({ firstLine: 1, lastLine: 10, firstSeen: "2024-05-10 08:00:01,000", lastSeen: "2024-05-10 08:00:10,000" });
    expect(nfe!.levels).toEqual({ ERROR: 2, WARN: 1 });
  });

  it("sem embeddings, agrupa só por assinatura exata", async () => {
    const log = readFileSync("tests/fixtures/logs/clusters.log", "utf8");
    const groups = await groupEntries(parseLog(log));
    expect(groups).toHaveLength(7);
    expect(groups.reduce((s, g) => s + g.count, 0)).toBe(13); // a linha INFO fica de fora
  });

  it("Grouper: filtro de nível customizado e entradas sem timestamp", () => {
    const g = new Grouper(() => true);
    g.add({ line: 1, format: "line", message: "boom 12345", stack: [], level: "INFO" });
    g.add({ line: 2, format: "line", message: "boom 67890", stack: [] });
    g.add({ line: 3, format: "line", message: "boom 11111", stack: [], timestamp: "t3" });
    const [only] = g.result();
    expect(only).toMatchObject({ count: 3, firstLine: 1, lastLine: 3, firstSeen: "t3", lastSeen: "t3", levels: { INFO: 1, "?": 2 } });
  });

  it("mergeSimilar: menos de dois grupos volta igual; datas ausentes não quebram", async () => {
    expect(await mergeSimilar([], new LocalEmbedding())).toEqual([]);
    const g = new Grouper();
    g.add({ line: 1, format: "line", message: "HTTP 429 Too Many Requests GET https://a/b local_rate_limited", stack: [] });
    g.add({ line: 2, format: "line", message: "HTTP 429 Too Many Requests PUT https://a/b local_rate_limited", stack: [], timestamp: "t2" });
    const merged = await mergeSimilar(g.result(), new LocalEmbedding());
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ count: 2, firstSeen: "t2", lastSeen: "t2" });
  });
});
