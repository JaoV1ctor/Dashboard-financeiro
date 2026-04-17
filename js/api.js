/**
 * 📡 Layer 2 Engine: Link Connectivity Setup
 * Lógica pura de extração via AwesomeAPI respeitanto o Output Schema de gemini.md.
 */

const AWESOME_API_BASE = 'https://economia.awesomeapi.com.br/json/last';

/**
 * Função de Fetching agnóstica para qualquer conjunto de pares suportados.
 * @param {Array<string>} pairs - Array de pares EX: ['BTC-BRL', 'USD-BRL']
 * @returns {Promise<Object>} Dicionário dos dados normalizados para a Layer 3
 */
export async function getLiveRates(pairs) {
    try {
        const queryParams = pairs.join(',');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

        const response = await fetch(`${AWESOME_API_BASE}/${queryParams}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`AwesomeAPI Fetch falhou: Status ${response.status}`);
        }
        
        const rawData = await response.json();
        return normalizeToOutputSchema(rawData);

    } catch (error) {
        console.error('🔥 Erro Crítico na API (Fase 2):', error);
        return null; // Fallback
    }
}

/**
 * Formata os retornos crus da requisição para o Output Schema exato da regra.
 * Schema Requerido: { pair, high, low, bid, converted, last_update }
 * (OBS: "converted" será instanciado na lógica do client posteriormente, aqui deixamos engatilhado a conversão por "1" unidade)
 */
function normalizeToOutputSchema(apiData) {
    const formattedOutput = {};
    
    for (const key in apiData) {
        if (Object.prototype.hasOwnProperty.call(apiData, key)) {
            const data = apiData[key];
            const pairName = data.code + data.codein; // Ex: BTCBRL
            
            formattedOutput[pairName] = {
                pair: pairName,
                name: data.name, // Nome completo ex: Bitcoin/Real Brasileiro
                high: data.high,
                low: data.low,
                pctChange: data.pctChange, // Variação percentual
                bid: parseFloat(data.bid), // Importante converter String para Number flutuante
                converted: parseFloat(data.bid), // Equivalente a 1 unidade base
                last_update: data.create_date // Timestamp cru. Fica para Layer 1 (Architect) formatar dps.
            };
        }
    }
    
    return formattedOutput;
}

/**
 * Puxa dados dos últimos 7 dias para plotagem dos Sparklines.
 */
export async function getSparklineData(pair) {
    try {
        const response = await fetch(`https://economia.awesomeapi.com.br/json/daily/${pair}/7`);
        if (!response.ok) return [];
        const data = await response.json();
        // Retorna array de valores numéricos, invertendo para ficar da data mais antiga para a mais recente.
        return data.reverse().map(item => parseFloat(item.bid || item.high));
    } catch (e) {
        console.warn(`Fallback Sparkline: Não foi possível obter dados para ${pair}`);
        return [];
    }
}
