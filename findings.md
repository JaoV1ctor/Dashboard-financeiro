# 🔍 Findings & Constraints

## Validação da Awesome API (Fase 0)
- **Status:** Requisição do Endpoint `/json/available` testado com sucesso.
- **Resultado da Cobertura de Pares (Base: BRL):**
  - **✅ Encontradas (Seguras para uso):** 
    - **Fiat**: `USD`, `EUR`, `GBP`
    - **Crypto**: `BTC`, `ETH`, `SOL`, `XRP`, `BNB`, `DOGE`
  - **❌ Ausentes na AwesomeAPI:** 
    - `ADA`, `TRX`, `DOT`, `LINK`.
  
**💡 Ação Decidida (Fallback):** 
De acordo com os protocolos, como algumas das Top 10 do mercado atual (como Cardano, Tron e Polkadot) não são servidas pela AwesomeAPI nativamente contra o BRL ou não têm dados consistentes expostos, prosseguiremos as implementações garantindo as 6 Criptos atestadas. Omitiremos as moedas ausentes para garantir funcionamento determinístico sem retornos `HTTP 404`.

## Decisão de Estrutura:
Construiremos uma URL de *batch fetch* (buscando chaves separadas por vírgula em uma requisição só). Exemplo de batching URI: `/last/USD-BRL,EUR-BRL...` 
Isso irá minimizar o rate-limiting e acelerar a renderização do estado inicial.
