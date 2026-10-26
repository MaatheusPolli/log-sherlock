---
id: bling-refresh-invalid-grant
signature: "HTTP 400 Bad Request POST <URL> invalid_grant Invalid refresh token"
integration: bling
tags: [http, oauth, 400]
---
## Sintoma
Renovação de token OAuth do Bling falha com `400 invalid_grant`.

## Causa
O refresh token é de uso único; duas instâncias do worker renovaram em paralelo e a segunda usou o token já consumido.

## Correção
1. Serializar a renovação com lock distribuído (ex.: advisory lock no Postgres).
2. Se o token já foi invalidado, refazer o fluxo de autorização no painel do Bling.
