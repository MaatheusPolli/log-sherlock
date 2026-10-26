import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { KnownIssue } from "../domain/known-issue.js";
import { hashOf } from "../normalize/signature.js";

export class KnowledgeFormatError extends Error {
  constructor(file: string, reason: string) {
    super(`${file}: ${reason}`);
    this.name = "KnowledgeFormatError";
  }
}

/** Subconjunto de YAML usado na base: `chave: valor`, strings entre aspas e listas `[a, b]`. */
export function parseFrontMatter(block: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const line of block.split(/\r?\n/)) {
    const m = /^([\w-]+):\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    const [, key, raw] = m as unknown as [string, string, string];
    const value = raw.replace(/\s+#.*$/, "").trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      out[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else if (value.startsWith('"')) {
      out[key] = JSON.parse(value) as string;
    } else {
      out[key] = value.replace(/^'|'$/g, "");
    }
  }
  return out;
}

const SECTIONS: Record<string, "symptom" | "rootCause" | "fix"> = {
  sintoma: "symptom",
  causa: "rootCause",
  "causa raiz": "rootCause",
  correcao: "fix",
  "correção": "fix",
};

export function parseIssue(markdown: string, file = "caso"): KnownIssue {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(markdown);
  if (!fm) throw new KnowledgeFormatError(file, "front-matter ausente");
  const meta = parseFrontMatter(fm[1]!);
  const body: Partial<Record<"symptom" | "rootCause" | "fix", string>> = {};
  for (const part of fm[2]!.split(/^##\s+/m).slice(1)) {
    const [title, ...rest] = part.split(/\r?\n/);
    const key = SECTIONS[title!.trim().toLowerCase()];
    if (key) body[key] = rest.join("\n").trim();
  }
  const id = meta.id;
  const signature = meta.signature;
  if (typeof id !== "string" || !id) throw new KnowledgeFormatError(file, "campo id obrigatório");
  if (typeof signature !== "string" || !signature) throw new KnowledgeFormatError(file, "campo signature obrigatório");
  for (const k of ["symptom", "rootCause", "fix"] as const) {
    if (!body[k]) throw new KnowledgeFormatError(file, `seção ${k} ausente`);
  }
  const tags = meta.tags;
  return {
    id,
    signature,
    signatureHash: hashOf(signature),
    symptom: body.symptom!,
    rootCause: body.rootCause!,
    fix: body.fix!,
    integration: typeof meta.integration === "string" ? meta.integration : undefined,
    tags: Array.isArray(tags) ? tags : typeof tags === "string" ? [tags] : [],
    occurrences: 0,
  };
}

/** Carrega todos os casos `.md` do diretório (exceto README). */
export async function loadKnowledgeBase(dir: string): Promise<KnownIssue[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md").sort();
  const issues = await Promise.all(files.map(async (f) => parseIssue(await readFile(join(dir, f), "utf8"), f)));
  const seen = new Set<string>();
  for (const i of issues) {
    if (seen.has(i.id)) throw new KnowledgeFormatError(i.id, "id duplicado");
    seen.add(i.id);
  }
  return issues;
}

/** Serializa de volta para Markdown (usado ao criar caso a partir de um diagnóstico). */
export function toMarkdown(issue: Omit<KnownIssue, "signatureHash" | "occurrences" | "lastSeen">): string {
  const lines = [
    "---",
    `id: ${issue.id}`,
    `signature: ${JSON.stringify(issue.signature)}`,
    ...(issue.integration ? [`integration: ${issue.integration}`] : []),
    `tags: [${issue.tags.join(", ")}]`,
    "---",
    "## Sintoma",
    issue.symptom,
    "",
    "## Causa",
    issue.rootCause,
    "",
    "## Correção",
    issue.fix,
    "",
  ];
  return lines.join("\n");
}
