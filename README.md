# LogSherlock — diagnóstico de logs de integração com RAG

Analisador de logs de integração ERP ↔ e-commerce. Ele agrupa erros semelhantes, encontra a causa raiz numa base de erros conhecidos (RAG) e sugere a correção **citando o caso de referência**. Quando não há caso compatível, diz isso em vez de inventar.

> 🔨 **Status: em desenvolvimento.** O núcleo está pronto e testado: parse, normalização, redação, base de conhecimento, busca híbrida, agrupamento e diagnóstico com guardrail. A CLI e a API funcionam, a interface web ainda não foi construída, e a avaliação com chamadas reais ao Claude está pendente. Veja o progresso em [planejamento.md](planejamento.md).

## O problema

Quem sustenta integrações passa o dia lendo stack traces e logs de API. O mesmo erro reaparece com mensagens um pouco diferentes (IDs, horários, nomes de cliente). O conhecimento de "já vi isso, é token expirado do lado deles" fica na cabeça de duas pessoas do time.

## Como funciona

```
log → parse (formato detectado) → normalize (máscaras) → assinatura (hash)
                                        │
                     agrupamento (assinatura + similaridade)
                                        │
                busca híbrida: assinatura exata → vetorial → textual
                                        │
            sem candidato → recusa explícita (o LLM nem é chamado)
            com candidatos → Claude (texto redigido) → guardrail valida a citação
```

1. **Parse em streaming** de JSON, logs de linha, stack traces (Node, .NET, Delphi) e respostas HTTP. Uma linha corrompida não derruba o processamento.
2. **Normalização**: URL, e-mail, UUID, timestamp, CPF/CNPJ, IDs e números viram máscaras, gerando uma assinatura estável. Códigos curtos, como HTTP 401 e Rejeição 539, são preservados.
3. **Redação obrigatória**: o tipo `RedactedText` garante que só texto redigido chegue ao LLM e ao provedor de embeddings. O `guardLlm` reinspeciona tudo que sai.
4. **Base de conhecimento em Markdown** (`knowledge-base/`), revisável por PR. Fica em memória ou no Postgres com pgvector.
5. **Diagnóstico** com Claude via tool use (`registrar_diagnostico`). O guardrail só aceita respostas que citem um caso entre os candidatos enviados.

## Exemplo (CLI)

```bash
pnpm sherlock analisar app.log                 # agrupa e diagnostica os 3 maiores grupos
pnpm sherlock analisar app.log -l 20 --json    # 20 grupos, saída JSON
pnpm sherlock assinatura "Token expired for client 8f2c..."   # assinatura para cadastrar um caso
pnpm sherlock redigir app.log                  # mostra exatamente o que seria enviado ao LLM
```

Sem `ANTHROPIC_API_KEY`, a CLI mostra apenas os casos sugeridos pela busca.

## Base de conhecimento

Os 15 casos anonimizados de `knowledge-base/` cobrem, por exemplo: token VTEX expirado, rate limit 429 do Mercado Livre, Rejeição 539 e 225 de NF-e, certificado A1 expirado, deadlock pedido × estoque, Access Violation em dataset Delphi, timeout de pool do ERP, `invalid_grant` do Bling, `ECONNRESET` no gateway 422 de variante na Shopify, SKU inexistente na VTEX e assinatura inválida de webhook. Para contribuir, veja `knowledge-base/README.md` e gere a assinatura com `pnpm sherlock assinatura`.

## Estrutura

```text
log-sherlock/
├── packages/core/src/
│   ├── parse/       parsers incrementais + detecção de formato
│   ├── normalize/   máscaras e assinatura
│   ├── redact/      redação de dados sensíveis (RedactedText)
│   ├── cluster/     agrupamento por hash e por similaridade
│   ├── knowledge/   loader Markdown, embeddings, stores (memória/pgvector), busca híbrida
│   ├── diagnose/    adaptador Anthropic, prompts, guardrail
│   └── app/         casos de uso (analyze, cases, metrics)
├── apps/
│   ├── cli/         comando `sherlock` (commander)
│   ├── api/         rotas analisar, casos, feedback, métricas
│   └── web/         React + Vite (em construção)
├── knowledge-base/  casos conhecidos em Markdown
├── tests/           unit, integration (Testcontainers), security (no-leak)
├── scripts/         sync-kb-signatures.ts, bench-parse.ts
└── docker-compose.yml   Postgres 16 + pgvector
```

## Como rodar

Pré-requisitos: Node 20+, pnpm 9, e Docker (opcional, para o pgvector e os testes de integração).

```bash
pnpm install
cp .env.example .env          # ANTHROPIC_API_KEY, VOYAGE_API_KEY, DATABASE_URL (opcionais)
docker compose up -d          # opcional: Postgres + pgvector
pnpm test                     # Vitest
pnpm test:coverage
pnpm api                      # API HTTP
pnpm bench:parse              # benchmark de parse (50 MB)
```

Sem `DATABASE_URL`, a base fica em memória.

## Qualidade e segurança

- `tests/security/no-leak.test.ts`: um log com 21 valores sensíveis plantados passa por todo o fluxo, e nenhum deles chega ao LLM.
- Limites de cobertura no Vitest: 85% geral e 100% em `normalize/` e `redact/`.
- Benchmark: 50 MB processados em cerca de 4,7 s com cerca de 15 MB de heap.
- Os testes de integração com pgvector precisam de Docker e são pulados sem ele.

## Stack

TypeScript, pnpm workspaces, Vitest, Testcontainers, Postgres + pgvector, `@anthropic-ai/sdk` e commander. Interface web: React 19 + Vite.

## Licença

Este projeto usa **licença dupla**. O texto completo está em [LICENSE](LICENSE).

- **Uso pessoal, educacional e não comercial:** livre, nos termos da licença MIT (mantenha o aviso de copyright).
- **Uso comercial:** exige licença comercial. Isso inclui usar em produto ou serviço comercial, vender acesso ou derivados, usar em atividades com fins lucrativos e implantar em empresas.

Contato para licença comercial: ma.polli@hotmail.com
