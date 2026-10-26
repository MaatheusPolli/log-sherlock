---
id: certificado-a1-expirado
signature: "System.Security.Authentication.AuthenticationException: The remote certificate is invalid according to the validation procedure: NotTimeValid"
integration: sefaz
tags: [nfe, certificado, tls]
---
## Sintoma
Transmissão de NF-e falha com erro de TLS indicando certificado expirado.

## Causa
O certificado digital A1 da empresa venceu (validade de 1 ano) e não foi renovado no servidor.

## Correção
1. Conferir a validade do .pfx instalado.
2. Instalar o certificado renovado e atualizar a referência (thumbprint) na configuração do emissor.
