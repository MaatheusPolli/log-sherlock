---
id: shopify-422-variant-sku
signature: "HTTP 422 Unprocessable Entity POST <URL> variants sku has already been taken"
integration: shopify
tags: [http, catalogo, 422]
---
## Sintoma
Criação de produto na Shopify falha com `422` e "sku has already been taken" em variants.

## Causa
O ERP envia o mesmo SKU para duas variações (grade cor/tamanho mal configurada) ou o produto já existe e o conector tentou criar em vez de atualizar.

## Correção
1. Verificar no ERP a grade do produto e a unicidade dos SKUs por variação.
2. Fazer lookup por SKU antes de criar (upsert).
