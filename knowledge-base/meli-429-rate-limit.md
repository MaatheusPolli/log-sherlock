---
id: meli-429-rate-limit
signature: "HTTP 429 Too Many Requests GET <URL> local_rate_limited"
integration: mercadolivre
tags: [http, rate-limit, 429]
---
## Sintoma
API do Mercado Livre responde `429 Too Many Requests` com `local_rate_limited` durante a sincronização de estoque.

## Causa
O job de estoque dispara atualizações item a item em paralelo sem controle de concorrência, estourando o limite por aplicação.

## Correção
1. Limitar a concorrência do worker (ex.: 5 req/s) e aplicar backoff exponencial respeitando o header `Retry-After`.
2. Usar o endpoint de atualização em lote quando disponível.
3. Reprocessar apenas os SKUs que falharam.
