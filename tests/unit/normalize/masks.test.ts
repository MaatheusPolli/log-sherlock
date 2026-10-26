import { describe, expect, it } from "vitest";
import { maskDocument } from "../../../packages/core/src/normalize/masks/document.js";
import { maskEmail } from "../../../packages/core/src/normalize/masks/email.js";
import { maskHex, maskId, maskNumber } from "../../../packages/core/src/normalize/masks/number.js";
import { maskPath } from "../../../packages/core/src/normalize/masks/path.js";
import { maskTimestamp } from "../../../packages/core/src/normalize/masks/timestamp.js";
import { maskUrl } from "../../../packages/core/src/normalize/masks/url.js";
import { maskUuid } from "../../../packages/core/src/normalize/masks/uuid.js";

describe("maskUrl", () => {
  it.each([
    ["GET https://api.x.com/v1/orders/123?x=1 falhou", "GET <URL> falhou"],
    ["ws://host:8080/socket.", "<URL>."],
    ["(ver http://a.b/c)", "(ver <URL>)"],
    ["sem url aqui", "sem url aqui"],
  ])("%s", (input, out) => expect(maskUrl(input)).toBe(out));
});

describe("maskEmail", () => {
  it("mascara e-mails e preserva o resto", () => {
    expect(maskEmail("cliente joao.silva+loja@empresa.com.br não encontrado")).toBe("cliente <EMAIL> não encontrado");
    expect(maskEmail("usuario@localhost")).toBe("usuario@localhost");
  });
});

describe("maskUuid", () => {
  it("mascara UUID em qualquer caixa", () => {
    expect(maskUuid("req 3F2504E0-4F89-11D3-9A0C-0305E82C3301 ok")).toBe("req <UUID> ok");
    expect(maskUuid("3f2504e0-4f89")).toBe("3f2504e0-4f89");
  });
});

describe("maskTimestamp", () => {
  it.each([
    ["2024-05-10T13:22:01.123Z erro", "<TS> erro"],
    ["2024-05-10 13:22:01,123 erro", "<TS> erro"],
    ["em 10/05/2024 13:22 falhou", "em <TS> falhou"],
    ["data 2024-05-10 apenas", "data <TS> apenas"],
    ["às 13:22:01 ok", "às <TS> ok"],
    ["2024-05-10T13:22:01-03:00", "<TS>"],
    ["epoch 1715347321 e 1715347321123", "epoch <TS> e <TS>"],
    ["versão 1.2.3", "versão 1.2.3"],
  ])("%s", (input, out) => expect(maskTimestamp(input)).toBe(out));
});

describe("maskDocument", () => {
  it.each([
    ["CNPJ 12.345.678/0001-90", "CNPJ <DOC>"],
    ["CNPJ 12345678000190", "CNPJ <DOC>"],
    ["CPF 123.456.789-09", "CPF <DOC>"],
    ["CPF 12345678909", "CPF <DOC>"],
    ["chave 35240512345678000190550010000012341000012345", "chave 35240512345678000190550010000012341000012345"],
    ["valor 1.234", "valor 1.234"],
  ])("%s", (input, out) => expect(maskDocument(input)).toBe(out));
});

describe("maskPath", () => {
  it.each([
    ["em C:\\src\\Integracao\\PedidoRepository.cs:line 42", "em <FILE>:line 42"],
    ["at /app/src/jobs/sync.js:77:31", "at <FILE>:77:31"],
    ["share \\\\srv\\logs\\app.log", "share <FILE>"],
    ["in module 'Integrador.exe'.", "in module <FILE>."],
    ["unit uExportaPedidos.pas", "unit <FILE>"],
    ["sem caminho", "sem caminho"],
  ])("%s", (input, out) => expect(maskPath(input)).toBe(out));
});

describe("maskHex", () => {
  it.each([
    ["ptr 0x7ffe12ab", "ptr <HEX>"],
    ["at 0040A1B2 x", "at <HEX> x"],
    ["Read of address 00000000", "Read of address <HEX>"],
    ["hash DEADBEEFCAFEBABE", "hash <HEX>"],
    ["pedido 12345678", "pedido 12345678"],
  ])("%s", (input, out) => expect(maskHex(input)).toBe(out));
});

describe("maskId", () => {
  it.each([
    ["event evt_1a2b3c4d5e", "event <ID>"],
    ["item MLB3456789012", "item <ID>"],
    ["ECONNRESET invalid_grant sha256", "ECONNRESET invalid_grant sha256"],
  ])("%s", (input, out) => expect(maskId(input)).toBe(out));
});

describe("maskNumber", () => {
  it.each([
    ["HTTP 401 Unauthorized", "HTTP 401 Unauthorized"],
    ["Rejeição 539: duplicidade", "Rejeição 539: duplicidade"],
    ["Process ID 57 deadlocked", "Process ID <NUM> deadlocked"],
    ["at position 0", "at position <NUM>"],
    ["pedido #98 falhou", "pedido #<NUM> falhou"],
    ["lote 4521", "lote <NUM>"],
    ["valor 1234,56 e 12.5", "valor <NUM> e <NUM>"],
    ["<NUM> e <HEX>", "<NUM> e <HEX>"],
  ])("%s", (input, out) => expect(maskNumber(input)).toBe(out));
});
