import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { styleText } from "node:util";
import { analyze, createContext, redactLines, signatureOf } from "@log-sherlock/core";
import { Command } from "commander";
import { plain, renderCases, renderReport, type Style } from "./render.js";

const color: Style = {
  bold: (s) => styleText("bold", s),
  dim: (s) => styleText("dim", s),
  red: (s) => styleText("red", s),
  green: (s) => styleText("green", s),
  yellow: (s) => styleText("yellow", s),
  cyan: (s) => styleText("cyan", s),
};
const style = (): Style => (process.stdout.isTTY && !process.env.NO_COLOR ? color : plain);

/** Arquivo em streaming, ou stdin quando o caminho é "-". */
function lines(path: string) {
  const input = path === "-" ? process.stdin : createReadStream(path);
  return createInterface({ input, crlfDelay: Infinity });
}

const program = new Command()
  .name("sherlock")
  .description("Analisa logs de integração, agrupa erros e sugere a correção com base nos casos conhecidos do time.");

program
  .command("analisar")
  .argument("<arquivo>", "arquivo de log (.log, .txt, .json) ou - para stdin")
  .option("-d, --diagnosticar <n>", "diagnostica com Claude os N maiores grupos (requer ANTHROPIC_API_KEY)", "3")
  .option("-l, --limite <n>", "quantos grupos exibir", "10")
  .option("--json", "saída em JSON")
  .action(async (arquivo: string, opts: { diagnosticar: string; limite: string; json?: boolean }) => {
    const ctx = await createContext();
    if (!ctx.llm && Number(opts.diagnosticar) > 0 && !opts.json) {
      console.error(style().dim("ANTHROPIC_API_KEY não definida: mostrando apenas os casos sugeridos pela busca."));
    }
    const report = await analyze(lines(arquivo), ctx, { diagnoseTop: Number(opts.diagnosticar) });
    console.log(opts.json ? JSON.stringify(report, null, 2) : renderReport(report, style(), Number(opts.limite)));
  });

program
  .command("assinatura")
  .argument("<texto-ou-arquivo>", "mensagem de erro ou arquivo com uma mensagem por linha")
  .description("mostra a assinatura normalizada (use para preencher o campo signature de um caso)")
  .action((arg: string) => {
    const text = existsSync(arg) ? readFileSync(arg, "utf8") : arg;
    for (const line of text.split(/\r?\n/).filter((l) => l.trim())) {
      const sig = signatureOf(line);
      console.log(`${sig.hash}  ${sig.text}`);
    }
  });

program
  .command("redigir")
  .argument("<arquivo>", "arquivo de log ou - para stdin")
  .description("mostra o log exatamente como seria enviado ao LLM, com o resumo do que foi removido")
  .action(async (arquivo: string) => {
    const found = {};
    for await (const line of redactLines(lines(arquivo), found)) console.log(line);
    console.error(style().dim(`removidos: ${JSON.stringify(found)}`));
  });

program
  .command("casos")
  .description("lista os casos da base de conhecimento")
  .action(async () => {
    const ctx = await createContext();
    console.log(renderCases(await ctx.store.list(), style()));
  });

await program.parseAsync();
