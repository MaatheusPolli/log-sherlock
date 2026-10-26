---
id: node-econnreset-gateway
signature: "Error: read ECONNRESET"
integration: gateway-pagamento
tags: [node, rede, tls]
---
## Sintoma
Worker Node falha com `Error: read ECONNRESET at TLSWrap.onStreamRead` ao chamar o gateway de pagamento.

## Causa
O keep-alive do agente HTTP reutiliza um socket que o servidor remoto já fechou por inatividade (timeout do lado deles menor que o nosso).

## Correção
1. Configurar o timeout de socket ocioso menor que o do servidor (ex.: 4 s).
2. Adicionar retry idempotente para ECONNRESET.
