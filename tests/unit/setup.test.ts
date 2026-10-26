import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("setup", () => {
  it("base de conhecimento inicial tem ao menos 15 casos", () => {
    const cases = readdirSync("knowledge-base").filter((f) => f.endsWith(".md") && f !== "README.md");
    expect(cases.length).toBeGreaterThanOrEqual(15);
  });
});
