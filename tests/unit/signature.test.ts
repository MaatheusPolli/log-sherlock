import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonical, hashOf, signatureOf, signatureOfEntry } from "../../packages/core/src/normalize/signature.js";

describe("assinatura", () => {
  it("mesmo erro com IDs, horários e URLs diferentes gera a mesma assinatura", () => {
    const a = signatureOf("2024-05-10 10:00:01 Transaction (Process ID 57) was deadlocked on lock resources");
    const b = signatureOf("2024-06-01 23:59:59 Transaction (Process ID 112) was deadlocked on lock resources");
    expect(a).toEqual(b);
  });

  it("ignora acentos, caixa e pontuação no hash", () => {
    expect(hashOf("Rejeição 539: Duplicidade")).toBe(hashOf("REJEICAO 539 duplicidade"));
    expect(canonical("Olá, Mundo!  <NUM>")).toBe("ola mundo <num>");
  });

  it("erros distintos não colidem", () => {
    const sigs = [
      "HTTP 401 Unauthorized POST https://a/b invalid token",
      "HTTP 403 Forbidden POST https://a/b invalid token",
      "Rejeição 539: Duplicidade de NF-e",
      "Rejeição 225: Falha no Schema XML da NFe",
      "Error: read ECONNRESET",
      "Error: connect ECONNREFUSED",
    ].map((m) => signatureOf(m).hash);
    expect(new Set(sigs).size).toBe(sigs.length);
  });

  it("hash tem 16 caracteres hex", () => {
    expect(signatureOf("x").hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("signatureOfEntry usa a mensagem", () => {
    const e = { line: 1, format: "line" as const, message: "Error: read ECONNRESET", stack: ["at a"] };
    expect(signatureOfEntry(e)).toEqual(signatureOf("Error: read ECONNRESET"));
  });

  it("amostras reais batem com a assinatura registrada em cada caso da base", () => {
    const samples = JSON.parse(readFileSync("tests/fixtures/kb-samples.json", "utf8")) as Record<string, string>;
    for (const [id, msg] of Object.entries(samples)) {
      const md = readFileSync(`knowledge-base/${id}.md`, "utf8");
      const registered = JSON.parse(/^signature: (.*)$/m.exec(md)![1]!) as string;
      expect(signatureOf(msg).hash, id).toBe(hashOf(registered));
    }
  });
});
