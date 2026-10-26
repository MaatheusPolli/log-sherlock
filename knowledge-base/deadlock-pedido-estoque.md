---
id: deadlock-pedido-estoque
signature: "Transaction (Process ID <NUM>) was deadlocked on lock resources with another process and has been chosen as the deadlock victim. Rerun the transaction."
integration: erp
tags: [banco, sqlserver, concorrencia]
---
## Sintoma
Importação de pedidos falha com "Transaction ... was deadlocked ... chosen as the deadlock victim".

## Causa
Importação de pedidos e baixa de estoque atualizam as tabelas `Pedido` e `Estoque` em ordem inversa, em paralelo.

## Correção
1. Padronizar a ordem de acesso às tabelas nas duas rotinas.
2. Adicionar retry automático para o erro 1205.
