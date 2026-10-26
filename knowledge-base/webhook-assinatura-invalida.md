---
id: webhook-assinatura-invalida
signature: "Webhook signature verification failed for event <ID>"
integration: generico
tags: [webhook, seguranca]
---
## Sintoma
Webhooks recebidos são rejeitados com "signature verification failed".

## Causa
O corpo é parseado (JSON) antes da verificação HMAC, alterando bytes; ou o segredo do webhook foi regenerado na plataforma.

## Correção
1. Calcular o HMAC sobre o corpo bruto (raw body).
2. Conferir se o segredo configurado é o atual na plataforma.
