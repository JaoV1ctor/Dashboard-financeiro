/**
 * 🛠️ Layer 1 / Layer 3: Utility Functions
 * Regras Puras, sem dependência do DOM (Zero Side Effects).
 */

/**
 * Layer 3 Logic: Matriz de conversão Híbrida 
 * Permite conversão fluida entre Fiats e Cryptos cruzando pelo pivô (BRL).
 */
export function convert(amount, base, target, rates) {
    if (base === target) return amount;
    
    // Possibilidade A: Par direto existe (ex: BTC-BRL)
    const directPair = `${base}${target}`;
    if (rates[directPair]) {
        return amount * rates[directPair].bid;
    }
    
    // Possibilidade B: Par inverso (ex: BRL-BTC, convertemos invertendo a base)
    const inversePair = `${target}${base}`;
    if (rates[inversePair]) {
        return amount / rates[inversePair].bid;
    }
    
    // Possibilidade C: Intermediado Pivotando BRL (ex: BTC -> USD virará BTC->BRL->USD)
    const baseToBrl = rates[`${base}BRL`] || (base === 'BRL' ? {bid: 1} : null);
    const targetToBrl = rates[`${target}BRL`] || (target === 'BRL' ? {bid: 1} : null);
    
    if (baseToBrl && targetToBrl) {
        const inBrl = amount * baseToBrl.bid;
        return inBrl / targetToBrl.bid;
    }
    
    return 0; // Fallback
}

/**
 * Layer 1 Logic: Engine Formatação Monetária (Satoshi vs Centavos)
 */
export function formatCurrency(value, currencyCode) {
    const isCrypto = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE'].includes(currencyCode);
    const maxDecimals = isCrypto ? 8 : 2;
    const minDecimals = isCrypto ? 2 : 2;

    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: minDecimals,
        maximumFractionDigits: maxDecimals
    }).format(value);
}

/**
 * UX Logic: Debounce Event Handler para aliviar loops da thread no digito livre
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
