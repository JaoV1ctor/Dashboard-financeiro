# 📊 Data-First Rule & Schema Definitions

*Para manter um fluxo estável entre API e DOM, o contrato de uso de dados foi estipulado.*

## 1. Input Object Schema
Objeto resultante das interações do input (`Amount`, `Swap moedas`):
```json
{
  "base": "BTC",
  "target": "BRL",
  "amount": 1,
  "type": "crypto-to-fiat"
}
```

## 2. Output Schema
Objeto resultante após passar pela "Layer 3" (Conversões puras) contendo o parse do request da API retornado:
```json
{
  "pair": "BTCBRL",
  "high": "string",
  "low": "string",
  "bid": "number",
  "converted": "number", 
  "last_update": "timestamp"
}
```

*Nota: Todos os formatadores de exibição lidarão com formatação inteligente (Cripto com precisão base extra x Fiat precisão 2 casas (centavos)).*
