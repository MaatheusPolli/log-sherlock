# Base de conhecimento

Cada arquivo `.md` é um caso conhecido, revisado por PR como código.

## Formato

```markdown
---
id: slug-unico            # igual ao nome do arquivo
signature: "..."          # texto normalizado do erro (gere com: sherlock assinatura arquivo.log)
integration: vtex         # opcional
tags: [http, auth]
---
## Sintoma
## Causa
## Correção
1. passo verificável
```

## Regras
- **Nada de dados reais**: anonimize CNPJ, CPF, tokens, e-mails e nomes de cliente.
- Um caso por causa raiz. Se a mesma causa aparece com sintomas diferentes, amplie o sintoma.
- A correção deve ser acionável: passos numerados e verificáveis.
