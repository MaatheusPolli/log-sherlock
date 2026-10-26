import { access, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { KnownIssue } from "../domain/known-issue.js";
import { indexIssues } from "../knowledge/indexer.js";
import { parseIssue, toMarkdown } from "../knowledge/loader.js";
import { hashOf } from "../normalize/signature.js";
import type { EmbeddingPort } from "../ports/embedding.js";
import type { KnowledgeStore } from "../ports/store.js";
import { findSensitive } from "../redact/redact.js";

export interface NewCaseInput {
  id?: string;
  signature: string;
  symptom: string;
  rootCause: string;
  fix: string;
  integration?: string;
  tags?: string[];
}

export class CaseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaseValidationError";
  }
}

export const slugify = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/<[a-z]+>/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * RF08: transforma um diagnóstico confirmado em caso da base. Grava o Markdown
 * (para revisão por PR) e indexa imediatamente para o próximo diagnóstico já usar.
 */
export async function createCase(
  input: NewCaseInput,
  deps: { dir: string; store: KnowledgeStore; embeddings: EmbeddingPort },
): Promise<KnownIssue> {
  for (const k of ["signature", "symptom", "rootCause", "fix"] as const) {
    if (!input[k]?.trim()) throw new CaseValidationError(`campo obrigatório: ${k}`);
  }
  const text = [input.signature, input.symptom, input.rootCause, input.fix, input.integration ?? ""].join("\n");
  const leaks = findSensitive(text);
  if (leaks.length) throw new CaseValidationError(`o caso contém dados sensíveis (${leaks.join(", ")}); anonimize antes de salvar`);

  const base = slugify(input.id ?? `${input.integration ?? ""} ${input.signature}`) || "caso";
  let id = base;
  for (let n = 2; (await deps.store.get(id)) || (await exists(join(deps.dir, `${id}.md`))); n++) id = `${base}-${n}`;

  const md = toMarkdown({
    id,
    signature: input.signature,
    symptom: input.symptom.trim(),
    rootCause: input.rootCause.trim(),
    fix: input.fix.trim(),
    integration: input.integration?.trim() || undefined,
    tags: input.tags ?? [],
  });
  const issue = parseIssue(md, `${id}.md`);
  await writeFile(join(deps.dir, `${id}.md`), md, "utf8");
  await indexIssues([issue], deps.store, deps.embeddings);
  return { ...issue, signatureHash: hashOf(issue.signature) };
}
