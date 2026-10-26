// Regenera o campo `signature` de cada caso a partir das mensagens em tests/fixtures/kb-samples.json.
import { readFileSync, writeFileSync } from "node:fs";
import { normalize } from "../packages/core/src/normalize/normalize.js";

const samples = JSON.parse(readFileSync("tests/fixtures/kb-samples.json", "utf8")) as Record<string, string>;
for (const [id, msg] of Object.entries(samples)) {
  const file = `knowledge-base/${id}.md`;
  const md = readFileSync(file, "utf8");
  writeFileSync(file, md.replace(/^signature: .*$/m, `signature: ${JSON.stringify(normalize(msg))}`));
}
console.log(`${Object.keys(samples).length} assinaturas atualizadas`);
