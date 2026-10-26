---
id: json-parse-resposta-html
signature: "SyntaxError: Unexpected token < in JSON at position <NUM>"
integration: generico
tags: [node, parse, proxy]
---
## Sintoma
`SyntaxError: Unexpected token < in JSON at position 0` ao processar resposta de API.

## Causa
A API (ou um proxy/WAF na frente dela) retornou uma página HTML — erro 502/503 de manutenção ou bloqueio — e o código faz `JSON.parse` sem checar status e content-type.

## Correção
1. Logar status e os primeiros bytes do corpo.
2. Verificar `content-type` antes de parsear e tratar 5xx com retry.
