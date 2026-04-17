# 🏛️ Layer 1: Architecture & Formatação Monetária

## Modelos Mentais Aplicados:

### Regras de Casas Decimais:
* **Fácil legibilidade para Fiat:** Dinheiro fiduciário (BRL, USD, EUR) operará obrigatoriamente com limite mínimo e máximo de `2 casas decimais` (centavos). 
* **Precisão cirúrgica para Cripto:** As variações em Bitcoin e Altcoins são fractais, e portanto exigirão o teto de `8 casas decimais` (Satoshis) e o chão mínimo de 2.

### Formato IntL
* Utilização de `Intl.NumberFormat('pt-BR')` como parser matriz para assegurar leitura unívoca da pontuação e vírgulas numéricas de acordo com o paradigma latino/brasileiro (Ex: `1.200,00`).

### Camada 3 e Cross-Rates (Matemática Pura de Câmbio):
Muitas moedas não têm pares combinados. O BRL (Real) funciona comodamente como **Pivô (Base Pair)**.
*   `Crypto -> Fiat`: Ex: `1 BTC * Bid do BTCBRL` = R$ valor.
*   `Crypto -> Crypto` ou `Fiat -> Fiat`: Usa a fórmula:
    *   `(A -> BRL) / (B -> BRL)`
    *   Exemplo (ETH -> SOL): `ETH * Bid(ETHBRL) / Bid(SOLBRL)` limitando calls extras à API.
