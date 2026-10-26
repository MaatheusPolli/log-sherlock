---
id: delphi-access-violation-dataset
signature: "Access violation at address <HEX> in module <FILE>. Read of address <HEX>"
integration: erp
tags: [delphi, crash]
---
## Sintoma
Integrador Delphi encerra com "Access violation at address ... Read of address 00000000" ao exportar pedidos.

## Causa
Acesso a `TDataSet`/objeto já liberado ou não criado — tipicamente `FieldByName` em query fechada após uma exceção anterior engolida.

## Correção
1. Verificar no log a exceção imediatamente anterior (geralmente conexão perdida com o banco).
2. Usar `FreeAndNil` e checar `Assigned`/`Active` antes do acesso; não engolir exceções no `try..except`.
