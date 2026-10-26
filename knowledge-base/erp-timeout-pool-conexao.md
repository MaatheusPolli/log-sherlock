---
id: erp-timeout-pool-conexao
signature: "System.InvalidOperationException: Timeout expired. The timeout period elapsed prior to obtaining a connection from the pool. This may have occurred because all pooled connections were in use and max pool size was reached."
integration: erp
tags: [dotnet, banco, pool]
---
## Sintoma
Serviço .NET de integração lança `InvalidOperationException: Timeout expired. The timeout period elapsed prior to obtaining a connection from the pool`.

## Causa
Vazamento de conexões: `SqlConnection` aberta sem `using`/`Dispose` em algum handler, esgotando o pool (padrão 100).

## Correção
1. Identificar o handler pelo stack trace e envolver a conexão em `using`.
2. Monitorar conexões ativas; como paliativo, reciclar o serviço.
