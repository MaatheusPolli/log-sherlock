import { describe, expect, it } from "vitest";
import { MASKS, normalize } from "../../../packages/core/src/normalize/normalize.js";

describe("normalize", () => {
  it("aplica todas as máscaras em ordem e colapsa espaços", () => {
    const raw =
      "  2024-05-10T13:22:01Z  pedido 98765 de joao@x.com.br (CNPJ 12.345.678/0001-90) req 3f2504e0-4f89-11d3-9a0c-0305e82c3301 em https://api.x.com/o/1 ";
    expect(normalize(raw)).toBe("<TS> pedido <NUM> de <EMAIL> (CNPJ <DOC>) req <UUID> em <URL>");
  });

  it("é idempotente", () => {
    const once = normalize("Access violation at address 0040A1B2 in module 'Integrador.exe'. Read of address 00000000");
    expect(normalize(once)).toBe(once);
  });

  it("URL é mascarada antes do número (nenhum <NUM> dentro de URL)", () => {
    expect(normalize("GET https://x.com/orders/123456")).toBe("GET <URL>");
  });

  it("aceita lista de máscaras customizada", () => {
    expect(normalize("id 1234  x", [])).toBe("id 1234 x");
    expect(MASKS.length).toBeGreaterThan(5);
  });
});
