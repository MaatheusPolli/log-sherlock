---
id: nfe-rejeicao-539
signature: "Rejeição 539: Duplicidade de NF-e, com diferença na Chave de Acesso"
integration: sefaz
tags: [nfe, sefaz, fiscal]
---
## Sintoma
SEFAZ devolve "Rejeição 539: Duplicidade de NF-e, com diferença na Chave de Acesso" ao transmitir a nota.

## Causa
Já existe NF-e autorizada com a mesma série e número, mas com chave diferente — o código numérico (cNF) ou a data de emissão mudou entre uma transmissão com timeout e o reenvio.

## Correção
1. Consultar a situação da chave original pelo número/série na SEFAZ.
2. Se autorizada, vincular o protocolo existente ao pedido em vez de reenviar.
3. Garantir que o reenvio reutilize a mesma chave de acesso (persistir cNF antes da primeira transmissão).
