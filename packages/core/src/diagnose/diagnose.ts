import type { ErrorGroup } from "../cluster/group.js";
import type { DiagnosisResult } from "../domain/diagnosis.js";
import type { IssueMatch } from "../domain/known-issue.js";
import { searchKnownIssues, type SearchOptions } from "../knowledge/search.js";
import type { EmbeddingPort } from "../ports/embedding.js";
import type { LlmPort } from "../ports/llm.js";
import type { KnowledgeStore } from "../ports/store.js";
import { guardLlm } from "../redact/guard.js";
import { refuse, validateDiagnosis } from "./guardrail.js";
import { buildDiagnosisPrompt, DIAGNOSIS_TOOL } from "./prompts/diagnose.js";
import { SYSTEM_PROMPT } from "./prompts/system.js";

export interface DiagnoseDeps {
  llm: LlmPort;
  store: KnowledgeStore;
  embeddings: EmbeddingPort;
  search?: SearchOptions;
}

/**
 * Diagnostica um grupo: busca casos → (sem caso: recusa, sem chamar o LLM) →
 * Claude escolhe e adapta um caso → guardrail valida a citação.
 */
export async function diagnoseGroup(
  group: ErrorGroup,
  deps: DiagnoseDeps,
  /** Candidatos já buscados (evita repetir a busca). */
  known?: IssueMatch[],
): Promise<DiagnosisResult> {
  const hash = group.signature.hash;
  const candidates = known ?? (await searchKnownIssues(group.signature, deps.store, deps.embeddings, deps.search));
  if (!candidates.length) return refuse(hash, "sem-caso-na-base", []);

  // guardLlm é aplicado aqui mesmo que o chamador já tenha aplicado: é barato e não pode faltar.
  const res = await guardLlm(deps.llm).complete({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildDiagnosisPrompt(group, candidates) }],
    tools: [DIAGNOSIS_TOOL],
    maxTokens: 4096,
  });
  const call = res.toolCall?.name === DIAGNOSIS_TOOL.name ? res.toolCall.input : undefined;
  return validateDiagnosis(hash, candidates, call);
}
