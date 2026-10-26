---
id: frete-cep-invalido
signature: "HTTP 400 Bad Request POST <URL> CEP de destino inválido"
integration: frete
tags: [http, frete, cadastro]
---
## Sintoma
Cotação de frete falha com `400 CEP de destino inválido`.

## Causa
O CEP chega com máscara, espaços ou menos de 8 dígitos (zero à esquerda perdido ao ser tratado como número no ERP).

## Correção
1. Normalizar o CEP para 8 dígitos (remover não-dígitos e completar com zeros à esquerda).
2. Corrigir o tipo da coluna no ERP para texto.
