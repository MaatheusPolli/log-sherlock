# Avaliação do LogSherlock

Gerado em 2026-10-26T23:32:05.159Z · Node v24.22.0 · modelo: sem LLM

Base: memória · embedding local · sem LLM. Dataset: 33 logs (26 com caso na base, 7 sem caso).

## Resumo

| Métrica | Resultado |
| --- | --- |
| Busca: caso correto no topo (positivos) | 80.8% |
| Busca: recusa correta sem caso (negativos) | 85.7% |
| Positivos resolvidos por assinatura exata / vetorial / textual | 14 / 3 / 4 |
| Latência mediana por log | 0 ms |
| Latência máxima por log | 3 ms (meta < 8000 ms: atendida) |

## Detalhe por log

| Log | Categoria | Esperado | Busca | ms |
| --- | --- | --- | --- | --- |
| vtex-401-a | variacao | vtex-401-token-expirado | vtex-401-token-expirado (assinatura) ✓ | 3 |
| vtex-401-b | variacao | vtex-401-token-expirado | vtex-401-token-expirado (assinatura) ✓ | 0 |
| nfe-539-a | variacao | nfe-rejeicao-539 | nfe-rejeicao-539 (vetorial) ✓ | 1 |
| nfe-539-b | variacao | nfe-rejeicao-539 | nfe-rejeicao-539 (vetorial) ✓ | 0 |
| meli-429-a | variacao | meli-429-rate-limit | meli-429-rate-limit (assinatura) ✓ | 0 |
| shopify-422-a | variacao | shopify-422-variant-sku | shopify-422-variant-sku (assinatura) ✓ | 0 |
| vtex-404-a | variacao | vtex-404-sku-inexistente | vtex-404-sku-inexistente (assinatura) ✓ | 0 |
| erp-timeout-a | variacao | erp-timeout-pool-conexao | erp-timeout-pool-conexao (assinatura) ✓ | 0 |
| delphi-av-a | variacao | delphi-access-violation-dataset | delphi-access-violation-dataset (assinatura) ✓ | 0 |
| econnreset-a | variacao | node-econnreset-gateway | node-econnreset-gateway (vetorial) ✓ | 0 |
| nfe-225-a | variacao | nfe-rejeicao-225-schema | nfe-rejeicao-225-schema (assinatura) ✓ | 0 |
| json-html-a | variacao | json-parse-resposta-html | json-parse-resposta-html (assinatura) ✓ | 0 |
| cert-a1-a | variacao | certificado-a1-expirado | certificado-a1-expirado (assinatura) ✓ | 0 |
| deadlock-a | variacao | deadlock-pedido-estoque | deadlock-pedido-estoque (assinatura) ✓ | 0 |
| bling-400-a | variacao | bling-refresh-invalid-grant | bling-refresh-invalid-grant (assinatura) ✓ | 0 |
| frete-cep-a | variacao | frete-cep-invalido | frete-cep-invalido (assinatura) ✓ | 0 |
| webhook-sig-a | variacao | webhook-assinatura-invalida | webhook-assinatura-invalida (assinatura) ✓ | 0 |
| negativo-npe | negativo | — | — (sem match) ✓ | 1 |
| negativo-smtp | negativo | — | — (sem match) ✓ | 0 |
| negativo-disco | negativo | — | — (sem match) ✓ | 0 |
| negativo-503 | negativo | — | — (sem match) ✓ | 0 |
| negativo-index | negativo | — | — (sem match) ✓ | 0 |
| parafrase-vtex-401 | parafrase | vtex-401-token-expirado | — (sem match) ✗ | 0 |
| parafrase-meli-429 | parafrase | meli-429-rate-limit | — (sem match) ✗ | 0 |
| parafrase-shopify-422 | parafrase | shopify-422-variant-sku | shopify-422-variant-sku (textual) ✓ | 0 |
| parafrase-erp-timeout | parafrase | erp-timeout-pool-conexao | — (sem match) ✗ | 0 |
| parafrase-econnreset | parafrase | node-econnreset-gateway | — (sem match) ✗ | 0 |
| parafrase-nfe-539 | parafrase | nfe-rejeicao-539 | nfe-rejeicao-539 (textual) ✓ | 0 |
| parafrase-json-html | parafrase | json-parse-resposta-html | json-parse-resposta-html (textual) ✓ | 0 |
| parafrase-frete | parafrase | frete-cep-invalido | — (sem match) ✗ | 0 |
| parafrase-cert | parafrase | certificado-a1-expirado | certificado-a1-expirado (textual) ✓ | 0 |
| negativo-ncm | negativo | — | vtex-404-sku-inexistente (textual) ✗ | 0 |
| negativo-relatorio | negativo | — | — (sem match) ✓ | 0 |

## Limitações

- O dataset é derivado da própria base de casos: mede a capacidade de reconhecer variações do mesmo erro, não a generalização para erros inéditos.
- Os logs são sintéticos, baseados nos sintomas dos casos, e não em incidentes reais do time.
- Sem `ANTHROPIC_API_KEY`: a acurácia do diagnóstico e a latência com o LLM não foram medidas. Rode `pnpm eval` com a chave para completar este relatório.
