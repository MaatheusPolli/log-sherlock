---
id: nfe-rejeicao-225-schema
signature: "Rejeição 225: Falha no Schema XML da NFe"
integration: sefaz
tags: [nfe, sefaz, xml]
---
## Sintoma
SEFAZ retorna "Rejeição 225: Falha no Schema XML da NFe".

## Causa
Campo fora do layout: caractere especial não escapado na descrição do produto, casas decimais além do permitido ou tag vazia.

## Correção
1. Validar o XML contra o XSD da versão vigente para achar a tag exata.
2. Sanitizar descrições (remover `&`, `<`, quebras de linha) e arredondar valores às casas do layout.
