import { describe, expect, it } from "vitest";
import type { RedactedText } from "../../../packages/core/src/domain/redacted.js";
import { guardLlm, SensitiveDataError } from "../../../packages/core/src/redact/guard.js";
import { luhn, PATTERNS } from "../../../packages/core/src/redact/patterns.js";
import { findSensitive, joinRedacted, redact, redactWithReport } from "../../../packages/core/src/redact/redact.js";

describe("redact", () => {
  it.each([
    ["CPF 529.982.247-25", "CPF [CPF]"],
    ["cpf=52998224725;", "cpf=[CPF];"],
    ["CNPJ 11.222.333/0001-81", "CNPJ [CNPJ]"],
    ["CNPJ 11222333000181", "CNPJ [CNPJ]"],
    ["CNPJ alfanumérico 12.ABC.345/01DE-35", "CNPJ alfanumérico [CNPJ]"],
    ["chave 35240511222333000181550010000012341000012345 ok", "chave [CHAVE_NFE] ok"],
    ["chave 3524 0511 2223 3300 0181 5500 1000 0012 3410 0001 2345", "chave [CHAVE_NFE]"],
    ["cartão 4111 1111 1111 1111 ok", "cartão [CARTAO] ok"],
    ["cartão 5555-5555-5555-4444", "cartão [CARTAO]"],
    ["pedido 1234567890123 (não é cartão)", "pedido 1234567890123 (não é cartão)"],
    ["email joao.silva+x@empresa.com.br", "email [EMAIL]"],
    ["Authorization: Bearer abc.def-ghi_12345", "Authorization: [SEGREDO] [TOKEN]"],
    ["Basic dXN1YXJpbzpzZW5oYTEyMw==", "Basic [TOKEN]"],
    ["Token abc123XYZ987", "Token [TOKEN]"],
    ["Token AbcdEfghIjklMnopQrst na requisição", "Token [TOKEN] na requisição"],
    ["token expirado", "token expirado"],
    ["token inválido", "token inválido"],
    ["token expired", "token expired"],
    ["token invalid", "token invalid"],
    ["token missing", "token missing"],
    ["token revoked", "token revoked"],
    ["token abcdefghijklmnop", "token abcdefghijklmnop"],
    ["Authorization: Token abcdefgh", "Authorization: [SEGREDO] [TOKEN]"],
    ["jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abcdefghij", "jwt [JWT]"],
    ["key sk-ant-api03-abcdefghijklmnopqrstuv", "key [TOKEN]"],
    ["aws AKIAIOSFODNN7EXAMPLE", "aws [TOKEN]"],
    ["gh ghp_abcdefghijklmnopqrstuvwxyz0123456789", "gh [TOKEN]"],
    ["slack xoxb-1234567890-abcdef", "slack [TOKEN]"],
    ['{"password": "Sup3r!", "apiKey":"k-123"}', '{"password": "[SEGREDO]", "apiKey":"[SEGREDO]"}'],
    ["?token=abc&senha=hunter2&x=1", "?token=[SEGREDO]&senha=[SEGREDO]&x=1"],
    ["X-VTEX-API-AppToken: QWERTY123", "X-VTEX-API-AppToken: [SEGREDO]"],
    ["postgres://user:p4ss@host/db", "postgres://[CREDENCIAL_URL]@host/db"],
    ["-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----", "[CHAVE_PRIVADA]"],
    ["-----BEGIN EC PRIVATE KEY-----\nMIIE truncada", "[CHAVE_PRIVADA]"],
    ["HTTP 401 Unauthorized, Rejeição 539, pedido 98765", "HTTP 401 Unauthorized, Rejeição 539, pedido 98765"],
  ])("%s", (input, expected) => {
    expect(redact(input)).toBe(expected);
  });

  it("é idempotente", () => {
    const once = redact("senha=abc CPF 529.982.247-25 Bearer abcdefghijk");
    expect(redact(once)).toBe(once);
  });

  it("relata o que foi removido", () => {
    const r = redactWithReport("CPF 529.982.247-25 e 111.444.777-35, a@b.com, cartão 4111111111111111");
    expect(r.found).toEqual({ CPF: 2, EMAIL: 1, CARTAO: 1 });
    expect(redactWithReport("nada aqui").found).toEqual({});
  });

  it("aceita padrões customizados", () => {
    expect(redactWithReport("abc", []).text).toBe("abc");
  });
});

describe("findSensitive", () => {
  it("detecta cada tipo e ignora texto já redigido", () => {
    expect(findSensitive("CPF 529.982.247-25 Bearer abcdefghijk").sort()).toEqual(["CPF", "TOKEN"]);
    expect(findSensitive("cartão 1234 5678 9012 3456")).toEqual([]);
    expect(findSensitive("token expirado; token inválido; token expired")).toEqual([]);
    expect(findSensitive("Token abc123XYZ987")).toEqual(["TOKEN"]);
    expect(findSensitive(redact("senha=x CPF 529.982.247-25 Bearer abcdefghijk postgres://u:p@h"))).toEqual([]);
  });
});

describe("luhn", () => {
  it("valida números de cartão", () => {
    expect(luhn("4111111111111111")).toBe(true);
    expect(luhn("4111 1111 1111 1112")).toBe(false);
    expect(luhn("79927398713")).toBe(true);
  });
});

describe("tipos", () => {
  it("RedactedText só vem de redact()", () => {
    const acceptsRedacted = (t: RedactedText) => t;
    // @ts-expect-error string crua não é RedactedText
    acceptsRedacted("CPF 529.982.247-25");
    expect(acceptsRedacted(redact("ok"))).toBe("ok");
    expect(joinRedacted([redact("a"), redact("b")], " ")).toBe("a b");
    expect(joinRedacted([redact("a"), redact("b")])).toBe("a\nb");
  });

  it("padrões têm flag global (necessário para replace/matchAll)", () => {
    for (const p of PATTERNS) expect(p.re.flags).toContain("g");
  });
});

describe("guardLlm", () => {
  it("bloqueia texto sensível que furou o tipo e repassa texto limpo", async () => {
    const calls: unknown[] = [];
    const port = guardLlm({ complete: async (req) => (calls.push(req), { text: "ok" }) });
    const leaked = "CPF 529.982.247-25" as RedactedText;
    await expect(port.complete({ system: "s", messages: [{ role: "user", content: leaked }] })).rejects.toBeInstanceOf(
      SensitiveDataError,
    );
    await expect(
      port.complete({ system: "senha=abc", messages: [{ role: "user", content: redact("ok") }] }),
    ).rejects.toThrow(/SEGREDO/);
    expect(calls).toHaveLength(0);
    await expect(port.complete({ system: "s", messages: [{ role: "user", content: redact("CPF 529.982.247-25") }] })).resolves.toEqual({
      text: "ok",
    });
    expect(calls).toHaveLength(1);
  });
});
