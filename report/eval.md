# Avaliação do LogSherlock

Gerado em 2026-10-30T20:18:37.113Z · Node v24.22.0 · modelo: opus

Base: memória · embedding local · claude (CLI). Dataset: 33 logs (26 com caso na base, 7 sem caso).

## Resumo

| Métrica | Resultado |
| --- | --- |
| Busca: caso correto no topo (positivos) | 80.8% |
| Busca: recusa correta sem caso (negativos) | 85.7% |
| Diagnóstico: cita o caso correto (positivos) | 80.8% |
| Diagnóstico: recusa correta (negativos) | 100.0% |
| Diagnóstico: citações erradas (alucinação) | 0 |
| Positivos resolvidos por assinatura exata / vetorial / textual | 14 / 3 / 4 |
| Latência mediana por log | 10414 ms |
| Latência máxima por log | 15325 ms (meta < 8000 ms: NÃO atendida) |

## Detalhe por log

| Log | Categoria | Esperado | Busca | Diagnóstico | ms |
| --- | --- | --- | --- | --- | --- |
| vtex-401-a | variacao | vtex-401-token-expirado | vtex-401-token-expirado (assinatura) ✓ | diagnostico ✓ | 12607 |
| vtex-401-b | variacao | vtex-401-token-expirado | vtex-401-token-expirado (assinatura) ✓ | diagnostico ✓ | 10414 |
| nfe-539-a | variacao | nfe-rejeicao-539 | nfe-rejeicao-539 (vetorial) ✓ | diagnostico ✓ | 13549 |
| nfe-539-b | variacao | nfe-rejeicao-539 | nfe-rejeicao-539 (vetorial) ✓ | diagnostico ✓ | 10335 |
| meli-429-a | variacao | meli-429-rate-limit | meli-429-rate-limit (assinatura) ✓ | diagnostico ✓ | 12666 |
| shopify-422-a | variacao | shopify-422-variant-sku | shopify-422-variant-sku (assinatura) ✓ | diagnostico ✓ | 10723 |
| vtex-404-a | variacao | vtex-404-sku-inexistente | vtex-404-sku-inexistente (assinatura) ✓ | diagnostico ✓ | 10784 |
| erp-timeout-a | variacao | erp-timeout-pool-conexao | erp-timeout-pool-conexao (assinatura) ✓ | diagnostico ✓ | 15325 |
| delphi-av-a | variacao | delphi-access-violation-dataset | delphi-access-violation-dataset (assinatura) ✓ | diagnostico ✓ | 14021 |
| econnreset-a | variacao | node-econnreset-gateway | node-econnreset-gateway (vetorial) ✓ | diagnostico ✓ | 12992 |
| nfe-225-a | variacao | nfe-rejeicao-225-schema | nfe-rejeicao-225-schema (assinatura) ✓ | diagnostico ✓ | 9896 |
| json-html-a | variacao | json-parse-resposta-html | json-parse-resposta-html (assinatura) ✓ | diagnostico ✓ | 13421 |
| cert-a1-a | variacao | certificado-a1-expirado | certificado-a1-expirado (assinatura) ✓ | diagnostico ✓ | 13650 |
| deadlock-a | variacao | deadlock-pedido-estoque | deadlock-pedido-estoque (assinatura) ✓ | diagnostico ✓ | 12474 |
| bling-400-a | variacao | bling-refresh-invalid-grant | bling-refresh-invalid-grant (assinatura) ✓ | diagnostico ✓ | 9918 |
| frete-cep-a | variacao | frete-cep-invalido | frete-cep-invalido (assinatura) ✓ | diagnostico ✓ | 10832 |
| webhook-sig-a | variacao | webhook-assinatura-invalida | webhook-assinatura-invalida (assinatura) ✓ | diagnostico ✓ | 10393 |
| negativo-npe | negativo | — | — (sem match) ✓ | recusa ✓ | 1 |
| negativo-smtp | negativo | — | — (sem match) ✓ | recusa ✓ | 1 |
| negativo-disco | negativo | — | — (sem match) ✓ | recusa ✓ | 1 |
| negativo-503 | negativo | — | — (sem match) ✓ | recusa ✓ | 1 |
| negativo-index | negativo | — | — (sem match) ✓ | recusa ✓ | 1 |
| parafrase-vtex-401 | parafrase | vtex-401-token-expirado | — (sem match) ✗ | recusa ✗ | 1 |
| parafrase-meli-429 | parafrase | meli-429-rate-limit | — (sem match) ✗ | recusa ✗ | 1 |
| parafrase-shopify-422 | parafrase | shopify-422-variant-sku | shopify-422-variant-sku (textual) ✓ | diagnostico ✓ | 12412 |
| parafrase-erp-timeout | parafrase | erp-timeout-pool-conexao | — (sem match) ✗ | recusa ✗ | 1 |
| parafrase-econnreset | parafrase | node-econnreset-gateway | — (sem match) ✗ | recusa ✗ | 1 |
| parafrase-nfe-539 | parafrase | nfe-rejeicao-539 | nfe-rejeicao-539 (textual) ✓ | diagnostico ✓ | 11889 |
| parafrase-json-html | parafrase | json-parse-resposta-html | json-parse-resposta-html (textual) ✓ | diagnostico ✓ | 14727 |
| parafrase-frete | parafrase | frete-cep-invalido | — (sem match) ✗ | recusa ✗ | 1 |
| parafrase-cert | parafrase | certificado-a1-expirado | certificado-a1-expirado (textual) ✓ | diagnostico ✓ | 13639 |
| negativo-ncm | negativo | — | vtex-404-sku-inexistente (textual) ✗ | recusa ✓ | 9949 |
| negativo-relatorio | negativo | — | — (sem match) ✓ | recusa ✓ | 1 |

## Limitações

- O dataset é derivado da própria base de casos: mede a capacidade de reconhecer variações do mesmo erro, não a generalização para erros inéditos.
- Os logs são sintéticos, baseados nos sintomas dos casos, e não em incidentes reais do time.
