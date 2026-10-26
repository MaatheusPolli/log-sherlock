---
id: vtex-404-sku-inexistente
signature: "HTTP 404 Not Found PUT <URL> SKU not found"
integration: vtex
tags: [http, catalogo, 404]
---
## Sintoma
Atualização de preço/estoque na VTEX responde `404 SKU not found`.

## Causa
O mapeamento ERP→VTEX aponta para um SKU excluído ou ainda não sincronizado (produto cadastrado no ERP, mas o job de catálogo não rodou).

## Correção
1. Conferir a tabela de de-para de SKUs.
2. Rodar a sincronização de catálogo antes da de preço/estoque, ou enfileirar o item para retry.
