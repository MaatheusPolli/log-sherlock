import { spawn } from "node:child_process";
import type { LlmPort, LlmRequest, LlmResponse } from "../ports/llm.js";

/** Executa o binário `claude` com os argumentos dados e devolve o stdout. */
export type ClaudeRunner = (bin: string, args: string[], stdin: string, timeoutMs: number) => Promise<string>;

export interface ClaudeCliOptions {
  /** Nome ou caminho do binário. Padrão: `claude` do PATH. */
  bin?: string;
  /** Alias ou nome completo do modelo (ex.: "opus", "sonnet"). Sem valor, usa o padrão da CLI. */
  model?: string;
  timeoutMs?: number;
  run?: ClaudeRunner;
}

/** Forma relevante da saída `--output-format json` da CLI. */
interface CliResult {
  is_error?: boolean;
  subtype?: string;
  stop_reason?: string;
  result?: string;
  structured_output?: unknown;
}

const defaultRunner: ClaudeRunner = (bin, args, stdin, timeoutMs) =>
  new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString("utf8")));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`claude saiu com código ${code}: ${stderr.trim().slice(0, 300)}`));
    });
    child.stdin.end(stdin, "utf8");
  });

/**
 * Adaptador da `LlmPort` que usa a Claude Code CLI (`claude -p`) em vez da API.
 * Usa a assinatura da própria CLI, então não exige `ANTHROPIC_API_KEY`.
 * A ferramenta do diagnóstico vira `--json-schema`: a CLI devolve a resposta validada em `structured_output`.
 */
export class ClaudeCliLlm implements LlmPort {
  private readonly bin: string;
  private readonly model?: string;
  private readonly timeoutMs: number;
  private readonly run: ClaudeRunner;

  constructor(opts: ClaudeCliOptions = {}) {
    this.bin = opts.bin ?? "claude";
    this.model = opts.model;
    this.timeoutMs = opts.timeoutMs ?? 120_000;
    this.run = opts.run ?? defaultRunner;
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const tool = req.tools?.[0];
    const args = ["-p", "--output-format", "json", "--system-prompt", req.system, "--tools", "", "--no-session-persistence"];
    if (this.model) args.push("--model", this.model);
    if (tool) args.push("--json-schema", JSON.stringify(tool.input_schema));

    // Só texto já redigido (RedactedText) chega aqui; vai pela entrada padrão, sem limite de linha de comando.
    const stdin = req.messages.map((m) => m.content).join("\n\n");
    const raw = await this.run(this.bin, args, stdin, this.timeoutMs);

    const out = JSON.parse(raw) as CliResult;
    if (out.is_error || out.subtype !== "success") {
      throw new Error(`claude respondeu com erro (${out.subtype ?? "desconhecido"})`);
    }
    if (out.stop_reason === "refusal") return {};
    if (!tool) return { text: out.result };
    if (out.structured_output === undefined) return {};
    return { toolCall: { name: tool.name, input: out.structured_output } };
  }
}
