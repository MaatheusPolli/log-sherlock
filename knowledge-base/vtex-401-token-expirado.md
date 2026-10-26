---
id: vtex-401-token-expirado
signature: "HTTP 401 Unauthorized POST <URL> invalid or expired app token"
integration: vtex
tags: [http, auth, 401]
---
## Sintoma
Chamadas à API da VTEX retornam `401 Unauthorized` com a mensagem "invalid or expired app token" em todas as requisições do conector.

## Causa
O AppToken da VTEX foi rotacionado (manualmente ou por política de segurança da loja) e o conector segue usando o par AppKey/AppToken antigo.

## Correção
1. Confirmar no Admin VTEX (Configurações da conta > Chaves de aplicação) se a chave está ativa.
2. Gerar novo AppToken e atualizar no cofre de segredos do conector.
3. Reiniciar o worker de sincronização e reprocessar a fila de pedidos com falha.
