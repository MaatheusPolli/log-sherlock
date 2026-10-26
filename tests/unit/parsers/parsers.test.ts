import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { describe, expect, it } from "vitest";
import { createParser, detectFormat } from "../../../packages/core/src/parse/detect.js";
import { bodyMessage } from "../../../packages/core/src/parse/http.parser.js";
import { parseJsonLine } from "../../../packages/core/src/parse/json.parser.js";
import { parseHeader } from "../../../packages/core/src/parse/line.parser.js";
import { collect, parseLog } from "../../../packages/core/src/parse/parse.js";
import { EntryBuffer, normalizeLevel } from "../../../packages/core/src/parse/parser.js";

const fixture = (name: string) => readFileSync(`tests/fixtures/logs/${name}`, "utf8");

describe("detectFormat", () => {
  it.each([
    ["app.jsonl", "json"],
    ["erp.log", "line"],
    ["dotnet.txt", "stacktrace"],
    ["node-stack.txt", "stacktrace"],
    ["delphi.log", "stacktrace"],
    ["http.txt", "http"],
  ])("%s → %s", (file, format) => {
    expect(detectFormat(fixture(file).split(/\r?\n/))).toBe(format);
  });

  it("amostra vazia cai em line", () => {
    expect(detectFormat(["", "  "])).toBe("line");
  });
});

describe("parser JSON", () => {
  it("extrai mensagem, nível, timestamp, stack e HTTP; linha corrompida não derruba", async () => {
    const entries = await collect(fixture("app.jsonl"));
    expect(entries).toHaveLength(5);
    const [first, second, , broken, last] = entries;
    expect(first).toMatchObject({
      line: 1,
      format: "json",
      level: "ERROR",
      timestamp: "2024-05-10T13:22:01.123Z",
      message: "Falha ao enviar pedido: Error: read ECONNRESET",
    });
    expect(first!.stack).toEqual(["at TLSWrap.onStreamRead (node:internal/stream_base_commons:217:20)"]);
    expect(second!.http).toEqual({ status: 429, method: "GET", url: "https://api.mercadolibre.com/items/MLB3456789012" });
    expect(broken).toMatchObject({ line: 4, malformed: true });
    expect(last).toMatchObject({ level: "ERROR", message: "SyntaxError: Unexpected token < in JSON at position 0" });
  });

  it("casos de borda", () => {
    expect(parseJsonLine("[1,2]", 1).malformed).toBe(true);
    expect(parseJsonLine('{"message":"a","error":"a"}', 1).message).toBe("a");
    expect(parseJsonLine('{"level":"info"}', 1).message).toBe('{"level":"info"}');
    expect(parseJsonLine('{"error":{"message":"boom"},"stack":"x\\n  at f (a.js:1:1)"}', 1)).toMatchObject({
      message: "boom",
      stack: ["at f (a.js:1:1)"],
    });
    expect(parseJsonLine('{"error":{"message":"boom","stack":42}}', 1).stack).toEqual([]);
    const invalidStatus = parseJsonLine('{"err":"falhou","stack":"x\\n  at f (a.js:1:1)","statusCode":999}', 1);
    expect(invalidStatus).toMatchObject({ message: "falhou", stack: ["at f (a.js:1:1)"] });
    expect(invalidStatus.http).toBeUndefined();
  });
});

describe("parser de linha", () => {
  it("separa timestamp, nível e mensagem; linhas indentadas viram continuação", async () => {
    const entries = await collect(fixture("erp.log"));
    expect(entries.map((e) => [e.level, e.message])).toEqual([
      ["ERROR", "Rejeição 539: Duplicidade de NF-e, com diferença na Chave de Acesso"],
      ["INFO", "Reenviando lote 4521"],
      ["ERROR", expect.stringMatching(/^Transaction \(Process ID 57\)/)],
      ["WARN", "Rejeição 225: Falha no Schema XML da NFe"],
      [undefined, "linha sem cabeçalho nenhum"],
    ]);
    expect(entries[0]!.timestamp).toBe("2024-05-10 13:22:01,123");
    expect(entries[2]!.timestamp).toBe("10/05/2024 13:23:10");
    expect(entries[3]!.stack).toEqual(["detalhe: tag <xProd> com caractere inválido"]);
  });

  it("parseHeader sem cabeçalho", () => {
    expect(parseHeader("apenas texto", 3)).toMatchObject({ line: 3, message: "apenas texto", level: undefined });
    expect(parseHeader("Error: read ECONNRESET", 1)).toMatchObject({ level: undefined, message: "Error: read ECONNRESET" });
    expect(parseHeader("(Warning) disco cheio", 1)).toMatchObject({ level: "WARN", message: "disco cheio" });
  });

  it("continuação sem entrada aberta abre nova entrada", () => {
    const p = createParser("line");
    expect(p.push("   indentado", 1)).toEqual([]);
    expect(p.end()).toMatchObject([{ message: "indentado" }]);
  });
});

describe("parser de stack trace", () => {
  it(".NET: frames associados à exceção", async () => {
    const entries = await collect(fixture("dotnet.txt"));
    expect(entries).toHaveLength(2);
    expect(entries[0]!.format).toBe("stacktrace");
    expect(entries[0]!.message).toMatch(/^System.InvalidOperationException: Timeout expired/);
    expect(entries[0]!.stack).toHaveLength(2);
    expect(entries[1]!.message).toMatch(/AuthenticationException/);
  });

  it("Node e Delphi", async () => {
    const node = await collect(fixture("node-stack.txt"));
    expect(node.map((e) => [e.message, e.stack.length])).toEqual([
      ["TypeError: Cannot read properties of undefined (reading 'sku')", 3],
      ["Error: read ECONNRESET", 1],
    ]);
    const delphi = await collect(fixture("delphi.log"));
    expect(delphi).toHaveLength(1);
    expect(delphi[0]!.stack[0]).toMatch(/^\[0040A1B2\] uExportaPedidos/);
  });
});

describe("parser HTTP", () => {
  it("monta mensagem com status, método, URL e erro do corpo", async () => {
    const entries = await collect(fixture("http.txt"));
    expect(entries.map((e) => e.message)).toEqual([
      "HTTP 401 Unauthorized POST https://lojax.vtexcommercestable.com.br/api/oms/pvt/orders/1334560781-01/invoice invalid or expired app token",
      "HTTP 404 Not Found PUT https://lojax.vtexcommercestable.com.br/api/logistics/pvt/inventory/skus/48213/warehouses/1_1 SKU not found",
      "HTTP 502 Bad Gateway 502 Bad Gateway",
    ]);
    expect(entries[0]!.http).toEqual({
      status: 401,
      reason: "Unauthorized",
      method: "POST",
      url: "https://lojax.vtexcommercestable.com.br/api/oms/pvt/orders/1334560781-01/invoice",
    });
  });

  it("resposta truncada (sem corpo) e linhas soltas antes da primeira resposta", async () => {
    const p = createParser("http");
    expect(p.push("lixo antes", 1)).toEqual([]);
    p.push("HTTP/1.1 500 Internal Server Error", 2);
    p.push("Content-Type: text/plain", 3);
    const out = p.push("HTTP/1.1 503", 4);
    expect(out.map((e) => e.message)).toEqual(["HTTP 500 Internal Server Error"]);
    expect(p.end().map((e) => e.message)).toEqual(["HTTP 503"]);
  });

  it("corpo sem linha em branco após headers", async () => {
    const entries = await collect("HTTP/1.1 400 Bad Request\nContent-Type: text/plain\nCEP inválido", { format: "http" });
    expect(entries[0]!.message).toBe("HTTP 400 Bad Request CEP inválido");
  });

  it("bodyMessage", () => {
    expect(bodyMessage("")).toBe("");
    expect(bodyMessage('{"error":"invalid_grant","error_description":"Invalid refresh token"}')).toBe(
      "Invalid refresh token invalid_grant",
    );
    expect(bodyMessage('{"ok":false}')).toBe('{"ok":false}');
    expect(bodyMessage("texto puro\nsegunda")).toBe("texto puro");
  });
});

describe("parseLog (streaming)", () => {
  it("aceita AsyncIterable (readline de arquivo)", async () => {
    const rl = createInterface({ input: createReadStream("tests/fixtures/logs/dotnet.txt") });
    const entries = [];
    for await (const e of parseLog(rl)) entries.push(e);
    expect(entries).toHaveLength(2);
  });

  it("detecta após encher a amostra e preserva números de linha", async () => {
    const lines = Array.from({ length: 120 }, (_, i) => `2024-01-01 00:00:00 ERROR erro ${i}`);
    const entries = await collect(lines, { sampleSize: 10 });
    expect(entries).toHaveLength(120);
    expect(entries[119]!.line).toBe(120);
    expect(entries[5]!.line).toBe(6);
  });

  it("entrada vazia", async () => {
    expect(await collect("")).toEqual([]);
  });

  it("remove \\r de linhas CRLF", async () => {
    const entries = await collect(["ERROR a\r", "ERROR b"], { format: "line" });
    expect(entries.map((e) => e.message)).toEqual(["a", "b"]);
  });
});

describe("utilitários", () => {
  it("normalizeLevel", () => {
    expect(normalizeLevel(undefined)).toBeUndefined();
    expect(normalizeLevel("warning")).toBe("WARN");
    expect(normalizeLevel("Erro")).toBe("ERROR");
    expect(normalizeLevel("fatal")).toBe("FATAL");
  });

  it("EntryBuffer", () => {
    const b = new EntryBuffer();
    expect(b.flush()).toEqual([]);
    const e = { line: 1, format: "line" as const, message: "a", stack: [] };
    expect(b.start(e)).toEqual([]);
    expect(b.open).toBe(e);
    expect(b.flush()).toEqual([e]);
  });
});
