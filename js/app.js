import { getLiveRates, getSparklineData } from './api.js';
import { convert, formatCurrency, debounce } from './utils.js';

// Configuration
const TARGET_PAIRS = [
    'USD-BRL', 'EUR-BRL', 'GBP-BRL', 
    'BTC-BRL', 'ETH-BRL', 'SOL-BRL', 
    'XRP-BRL', 'BNB-BRL', 'DOGE-BRL'
];

const CURRENCIES = {
    BTC: { name: 'Bitcoin', type: 'crypto', icon: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/btc.png' },
    ETH: { name: 'Ethereum', type: 'crypto', icon: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/eth.png' },
    SOL: { name: 'Solana', type: 'crypto', icon: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/sol.png' },
    BNB: { name: 'Binance Coin', type: 'crypto', icon: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/bnb.png' },
    XRP: { name: 'XRP', type: 'crypto', icon: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/xrp.png' },
    DOGE:{ name: 'Dogecoin', type: 'crypto', icon: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/doge.png' },
    BRL: { name: 'Real', type: 'fiat', sym: 'R$', color: 'bg-emerald-500' },
    USD: { name: 'Dólar Americano', type: 'fiat', sym: '$', color: 'bg-emerald-600' },
    EUR: { name: 'Euro', type: 'fiat', sym: '€', color: 'bg-blue-600' },
    GBP: { name: 'Libra Esterlina', type: 'fiat', sym: '£', color: 'bg-indigo-500' }
};

const DOM = {
    baseAmount: document.getElementById('base-amount'),
    targetAmount: document.getElementById('target-amount'),
    btnSwap: document.getElementById('btn-swap'),
    quickBtc: document.getElementById('quick-btc'),
    quickEth: document.getElementById('quick-eth'),
    quickSol: document.getElementById('quick-sol'),
    pairName: document.getElementById('pair-name'),
    insightPct: document.getElementById('insight-pct'),
    insightBadge: document.getElementById('insight-badge'),
    insightHigh: document.getElementById('insight-high'),
    insightLow: document.getElementById('insight-low'),
    insightTime: document.getElementById('insight-time'),
    historyContainer: document.getElementById('history-container'),
    clearHistoryBtn: document.getElementById('clear-history'),
    // Fees
    toggleFee: document.getElementById('toggle-fee'),
    feeContainer: document.getElementById('fee-container'),
    feeInput: document.getElementById('fee-input'),
    targetFeeInfo: document.getElementById('target-fee-info'),
    targetFeeValue: document.getElementById('target-fee-value'),
    // Multi
    btnMultiTarget: document.getElementById('btn-multi-target'),
    // Tabs & Plugins
    tabBtns: [document.getElementById('tab-btn-history'), document.getElementById('tab-btn-portfolio'), document.getElementById('tab-btn-alerts')],
    tabs: [document.getElementById('tab-content-history'), document.getElementById('tab-content-portfolio'), document.getElementById('tab-content-alerts')],
    // Portfolio
    addPortfolioBtn: document.getElementById('add-portfolio-btn'),
    portfolioAddForm: document.getElementById('portfolio-add-form'),
    portfolioAmount: document.getElementById('portfolio-amount'),
    portfolioCurrency: document.getElementById('portfolio-currency'),
    portfolioSave: document.getElementById('portfolio-save'),
    portfolioCancel: document.getElementById('portfolio-cancel'),
    portfolioContainer: document.getElementById('portfolio-container'),
    portfolioTotalBrl: document.getElementById('portfolio-total-brl'),
    ambientGlow1: document.getElementById('ambient-glow-1'),
    ambientGlow2: document.getElementById('ambient-glow-2'),
    // Alerts
    addAlertBtn: document.getElementById('add-alert-btn'),
    alertAddForm: document.getElementById('alert-add-form'),
    alertCurrency: document.getElementById('alert-currency'),
    alertCondition: document.getElementById('alert-condition'),
    alertPrice: document.getElementById('alert-price'),
    alertSave: document.getElementById('alert-save'),
    alertCancel: document.getElementById('alert-cancel'),
    alertsContainer: document.getElementById('alerts-container'),
    // Chart
    chartTitle: document.getElementById('chart-title'),
    chartToggles: document.querySelectorAll('.chart-selector'),
    mainChartCtx: document.getElementById('mainChart'),
    // SPA Routing
    sidebarBtns: document.querySelectorAll('.sidebar-btn'),
    appViews: document.querySelectorAll('.app-view'),
    // SPA Screens
    exchangeMarketList: document.getElementById('exchange-market-list'),
    walletVaultList: document.getElementById('wallet-vault-list'),
    viewWalletTotalBrl: document.getElementById('view-wallet-total-brl'),
    fullHistoryContainer: document.getElementById('full-history-container')
};

const state = {
    rates: {}, 
    loading: true,
    base: 'BTC',
    target: 'BRL',
    history: JSON.parse(localStorage.getItem('premium_converter_history')) || [],
    portfolio: JSON.parse(localStorage.getItem('premium_converter_portfolio')) || [{ currency: 'BTC', amount: 0.015 }, { currency: 'SOL', amount: 15 }],
    alerts: JSON.parse(localStorage.getItem('premium_converter_alerts')) || []
};

let historySaveTimeout = null;
let mainChartInstance = null;
let currentChartCoin = 'BTC';

async function boot() {
    toggleSkeleton(true);
    initSidebarNav();    // Initialize SPA Rules
    initCustomSelects(); // Initialize UX logic
    initTabs();          // Initialize Side Tabs
    renderHistory();     // Load previous items
    
    // Wire up clear history
    DOM.clearHistoryBtn.addEventListener('click', () => {
        state.history = [];
        localStorage.removeItem('premium_converter_history');
        renderHistory();
    });
    
    let ratesCall = null;
    try {
        ratesCall = await getLiveRates(TARGET_PAIRS);
    } catch (e) {
        console.error("Boot sequence error:", e);
    }
    
    if (ratesCall) {
        state.rates = ratesCall;
        state.loading = false;
        toggleSkeleton(false);

        renderQuickBoard();
        renderPortfolio();
        renderAlerts();
        recalculate(); 
        renderSparklines(); // Non-blocking
        initMainChart();    // Non-blocking
    } else {
        DOM.targetAmount.value = 'Offline API';
        // Continue partial init even without rates if we have cached data
        renderPortfolio();
        toggleSkeleton(false);
    }
}

function recalculate() {
    if (state.loading) return;
    
    const amountStr = DOM.baseAmount.value;
    const amount = parseFloat(amountStr) || 0; 
    const base = state.base;
    const target = state.target;
    
    const convertedValue = convert(amount, base, target, state.rates);

    // Fee logic
    const feePct = parseFloat(DOM.feeInput.value) || 0;
    let finalValue = convertedValue;
    
    if (feePct > 0 && amount > 0) {
        const feeRetained = convertedValue * (feePct / 100);
        finalValue = convertedValue - feeRetained;
        DOM.targetFeeInfo.classList.remove('hidden');
        DOM.targetFeeValue.innerText = formatCurrency(feeRetained, target);
    } else {
        DOM.targetFeeInfo.classList.add('hidden');
    }

    DOM.targetAmount.value = formatCurrency(finalValue, target);

    updateMarketInsights(base, target);
    scheduleHistorySave(base, target, amount, finalValue);
}

// ---- SPA NAVIGATION ENGINE ----
function initSidebarNav() {
    DOM.sidebarBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetViewId = btn.getAttribute('data-view');
            if(!targetViewId) return;
            
            // Manage Button States
            DOM.sidebarBtns.forEach(b => {
                b.classList.remove('bg-white/5', 'border-white/5', 'text-white');
                b.classList.add('hover:bg-white/5', 'text-white/40', 'border-transparent');
            });
            btn.classList.add('bg-white/5', 'border-white/5', 'text-white');
            btn.classList.remove('hover:bg-white/5', 'text-white/40', 'border-transparent');

            // Manage Views (Transitions)
            DOM.appViews.forEach(view => {
                if(!view.classList.contains('hidden')) {
                    view.classList.remove('opacity-100');
                    view.classList.add('opacity-0');
                    setTimeout(() => {
                        view.classList.add('hidden');
                        
                        // Switch completed, show new one
                        if(view.id !== `view-${targetViewId}`) {
                            const newView = document.getElementById(`view-${targetViewId}`);
                            if(newView) {
                                newView.classList.remove('hidden');
                                // Force reflow
                                void newView.offsetWidth;
                                newView.classList.add('opacity-100');
                            }
                        }
                    }, 300); // Transition time
                }
            });

            // Re-render Data on Target View
            setTimeout(() => {
                if(targetViewId === 'mercados') initSpotTrading();
                if(targetViewId === 'carteiras') renderWalletVaults();
                if(targetViewId === 'transferencias') renderFullHistory();
            }, 300);
        });
    });
}
// ------------------------------

// ---- CUSTOM SELECT LOGIC ----
function initCustomSelects() {
    renderOptions('base');
    renderOptions('target');

    ['base', 'target'].forEach(type => {
        const sel = document.getElementById(`custom-select-${type}`);
        const trigger = sel.querySelector('.select-trigger');
        
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const otherType = type === 'base' ? 'target' : 'base';
            closeSelect(otherType);

            const menu = sel.querySelector('.select-menu');
            const isOpen = !menu.classList.contains('invisible');
            if (isOpen) {
                closeSelect(type);
            } else {
                menu.classList.remove('invisible', 'scale-95', 'opacity-0');
                menu.classList.add('scale-100', 'opacity-100');
                const chevron = trigger.querySelector('[data-lucide="chevron-down"]');
                if (chevron) chevron.classList.add('rotate-180');
            }
        });
    });

    document.addEventListener('click', () => {
        closeSelect('base');
        closeSelect('target');
    });
}

function renderOptions(type) {
    const renders = {
        base: document.getElementById('custom-select-base'),
        target: document.getElementById('custom-select-target')
    };
    if (!renders[type]) return;

    const menuOpts = renders[type].querySelector('.dropdown-options');
    menuOpts.innerHTML = Object.keys(CURRENCIES).map(key => {
        const curr = CURRENCIES[key];
        const isSelected = state[type] === key;
        const bgClass = isSelected ? 'bg-white/10' : 'hover:bg-white/[0.05]';
        
        let iconHtml = '';
        if (curr.type === 'crypto') {
            iconHtml = `<img src="${curr.icon}" class="w-5 h-5 md:w-6 md:h-6 rounded-full" />`;
        } else {
            iconHtml = `<div class="w-5 h-5 md:w-6 md:h-6 rounded-full ${curr.color} flex items-center justify-center text-[9px] font-bold text-white shadow-inner">${curr.sym}</div>`;
        }

        return `
            <button type="button" class="w-full text-left px-3 py-2 md:py-2.5 rounded-xl cursor-pointer ${bgClass} flex items-center gap-3 transition-colors outline-none group" onclick="window.selectCurrency('${type}', '${key}')">
                ${iconHtml}
                <div class="flex flex-col">
                    <span class="text-sm font-semibold text-white/90 group-hover:text-white transition-colors">${key}</span>
                    <span class="text-[10px] text-white/40">${curr.name}</span>
                </div>
                ${isSelected ? `<i data-lucide="check" class="w-4 h-4 text-accentPurple ml-auto"></i>` : ''}
            </button>
        `;
    }).join('');
}

function closeSelect(type) {
    const sel = document.getElementById(`custom-select-${type}`);
    if(!sel) return;
    const menu = sel.querySelector('.select-menu');
    const trigger = sel.querySelector('.select-trigger');
    const chevron = trigger.querySelector('[data-lucide="chevron-down"]');
    
    menu.classList.add('invisible', 'scale-95', 'opacity-0');
    menu.classList.remove('scale-100', 'opacity-100');
    if (chevron) chevron.classList.remove('rotate-180');
}

window.selectCurrency = (type, val) => {
    state[type] = val;
    const sel = document.getElementById(`custom-select-${type}`);
    sel.dataset.value = val;
    
    const trigger = sel.querySelector('.select-trigger');
    const curr = CURRENCIES[val];
    
    let iconHtml = '';
    if (curr.type === 'crypto') {
        iconHtml = `<img src="${curr.icon}" class="w-6 h-6 md:w-7 md:h-7 rounded-full icon-display grayscale-0 transition-all duration-500" />`;
    } else {
        iconHtml = `<div class="w-6 h-6 md:w-7 md:h-7 rounded-full ${curr.color} flex items-center justify-center text-[10px] md:text-xs font-bold text-white icon-display-fiat shadow-inner">${curr.sym}</div>`;
    }
    
    trigger.innerHTML = `
        ${iconHtml}
        <span class="value-display text-base md:text-lg">${val}</span>
        <i data-lucide="chevron-down" class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none transition-transform duration-300"></i>
    `;
    
    initCustomSelects(); 
    if (window.lucide) window.lucide.createIcons();
    recalculate();
};
// ------------------------------

// ---- DASHBOARD INSIGHTS ----
function updateMarketInsights(base, target) {
    const pairKey = `${base}${target}`;
    const directData = state.rates[pairKey];
    
    const displayData = directData || state.rates[`${base}BRL`] || state.rates[`${target}BRL`];

    if (displayData) {
        DOM.pairName.innerText = CURRENCIES[base].name + ' para ' + CURRENCIES[target].name;
        
        const pct = parseFloat(displayData.pctChange);
        DOM.insightPct.innerText = (pct > 0 ? '+' : '') + pct.toFixed(2) + '%';
        DOM.insightPct.className = `text-2xl font-bold font-outfit ${pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;

        DOM.insightBadge.classList.remove('hidden');
        DOM.insightBadge.innerText = pct >= 0 ? 'Alta' : 'Baixa';
        DOM.insightBadge.className = `px-2 py-1 rounded-md text-[10px] font-black uppercase ${pct >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`;

        // Uses Target if direct, or BRL if indirect
        const displayCurrency = directData ? target : 'BRL';
        DOM.insightHigh.innerText = formatCurrency(displayData.high, displayCurrency);
        DOM.insightLow.innerText = formatCurrency(displayData.low, displayCurrency);
        DOM.insightTime.innerText = displayData.last_update.split(' ')[1] || displayData.last_update;

        // Market Mood Glow Sync
        if(DOM.ambientGlow1 && DOM.ambientGlow2) {
            const glowClass1 = DOM.ambientGlow1.className;
            const glowClass2 = DOM.ambientGlow2.className;
            
            // Cleanup previous moods to set right context
            const allColorClasses = ['bg-accentPurple/10', 'bg-accentGold/5', 'bg-emerald-500/10', 'bg-emerald-400/5', 'bg-rose-500/10', 'bg-rose-400/5'];
            DOM.ambientGlow1.classList.remove(...allColorClasses);
            DOM.ambientGlow2.classList.remove(...allColorClasses);

            if(pct > 0) {
                DOM.ambientGlow1.classList.add('bg-emerald-500/10');
                DOM.ambientGlow2.classList.add('bg-emerald-400/5');
            } else if(pct < 0) {
                DOM.ambientGlow1.classList.add('bg-rose-500/10');
                DOM.ambientGlow2.classList.add('bg-rose-400/5');
            } else {
                DOM.ambientGlow1.classList.add('bg-accentPurple/10');
                DOM.ambientGlow2.classList.add('bg-accentGold/5');
            }
        }

    } else {
        DOM.pairName.innerText = `${base} to ${target}`;
        DOM.insightPct.innerText = '--';
        DOM.insightBadge.classList.add('hidden');
        DOM.insightHigh.innerText = '--';
        DOM.insightLow.innerText = '--';
        DOM.insightTime.innerText = 'N/A';
    }
}

function renderQuickBoard() {
    DOM.quickBtc.innerText = formatCurrency(convert(1, 'BTC', 'BRL', state.rates), 'BRL');
    DOM.quickEth.innerText = formatCurrency(convert(1, 'ETH', 'BRL', state.rates), 'BRL');
    DOM.quickSol.innerText = formatCurrency(convert(1, 'SOL', 'BRL', state.rates), 'BRL');
}

async function renderSparklines() {
    const coins = ['BTC', 'ETH', 'SOL'];
    for (const coin of coins) {
        const data = await getSparklineData(`${coin}-BRL`);
        if(data && data.length > 1) {
            // Check if trending up or down overall based on 7d
            const isUp = data[data.length - 1] >= data[0]; 
            drawSparkline(`spark-${coin.toLowerCase()}`, data, isUp);
        }
    }
}

function drawSparkline(containerId, dataPoints, isPositive) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const min = Math.min(...dataPoints);
    const max = Math.max(...dataPoints);
    const range = (max - min) || 1;
    
    // Scale slightly to keep points within bounds (padding top/bottom)
    const padding = 4;
    const width = 96;
    const height = 40;
    
    const points = dataPoints.map((val, idx) => {
        const x = (idx / (dataPoints.length - 1)) * width;
        const mappedY = height - padding - ((val - min) / range) * (height - 2 * padding);
        return `${x.toFixed(2)},${mappedY.toFixed(2)}`;
    }).join(' ');

    const color = isPositive ? '#34d399' : '#fb7185';

    container.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" class="w-full h-full overflow-visible drop-shadow-md">
            <polyline points="${points}" fill="none" stroke="${color}" stroke-opacity="0.8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
    `;
}
// ------------------------------

// ---- MAIN CHART ENGINE ----
async function initMainChart() {
    if (!DOM.mainChartCtx) return;
    
    // Bind toggles
    document.querySelectorAll('.chart-selector').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const coin = e.currentTarget.getAttribute('data-coin');
            if(!coin) return;

            // Update UI
            document.querySelectorAll('.chart-selector').forEach(b => {
                b.classList.remove('bg-white/10', 'text-white', 'font-bold');
                b.classList.add('text-white/30', 'hover:text-white');
            });
            e.currentTarget.classList.add('bg-white/10', 'text-white', 'font-bold');
            e.currentTarget.classList.remove('text-white/30', 'hover:text-white');
            
            currentChartCoin = coin;
            renderMainChartData(coin);
        });
    });

    // Default load
    renderMainChartData(currentChartCoin);
}

async function renderMainChartData(coin) {
    if(DOM.chartTitle) DOM.chartTitle.innerText = `${CURRENCIES[coin].name} (Últimos 7 dias)`;
    
    // Update Extra Stats (24h)
    const rateData = state.rates[`${coin}BRL`];
    if(rateData) {
        const pElem = document.getElementById('chart-price');
        const minElem = document.getElementById('dash-min-24h');
        const maxElem = document.getElementById('dash-max-24h');
        
        if(pElem) pElem.innerText = formatCurrency(rateData.bid, 'BRL');
        if(minElem) minElem.innerText = formatCurrency(rateData.low, 'BRL');
        if(maxElem) maxElem.innerText = formatCurrency(rateData.high, 'BRL');
    }

    const dataPoints = await getSparklineData(`${coin}-BRL`);
    if(!dataPoints || dataPoints.length === 0) return;

    // Simulate dates for the last 7 days (7 data points)
    const labels = [];
    for(let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }));
    }

    const minPrice = Math.min(...dataPoints);
    const isUp = dataPoints[dataPoints.length - 1] >= dataPoints[0];
    const chartColor = isUp ? '#34d399' : '#fb7185';
    const gradientColorStart = isUp ? 'rgba(52, 211, 153, 0.4)' : 'rgba(251, 113, 133, 0.4)';
    const gradientColorEnd = 'rgba(0,0,0,0)';

    if (mainChartInstance) {
        mainChartInstance.destroy();
    }

    const ctx = DOM.mainChartCtx.getContext('2d');
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, gradientColorStart);
    gradient.addColorStop(1, gradientColorEnd);

    mainChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${coin}/BRL`,
                data: dataPoints,
                borderColor: chartColor,
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#0a0f1c',
                pointBorderColor: chartColor,
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(10, 15, 28, 0.9)',
                    titleColor: 'rgba(255,255,255,0.5)',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            let value = context.parsed.y;
                            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
                        }
                    }
                }
            },
            scales: {
                y: {
                    display: true,
                    min: minPrice * 0.98, // give some padding
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    border: { display: false },
                    ticks: {
                        color: 'rgba(255,255,255,0.3)',
                        callback: function(value) {
                            if(value >= 1000) return 'R$ ' + (value/1000).toFixed(1) + 'k';
                            return 'R$ ' + value;
                        }
                    }
                },
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: { color: 'rgba(255,255,255,0.3)' }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
        }
    });
}
// ------------------------------

// ---- HISTORY ENGINE ----
function scheduleHistorySave(base, target, amount, converted) {
    if(amount === 0 || state.loading) return;
    clearTimeout(historySaveTimeout);
    historySaveTimeout = setTimeout(() => {
        saveHistory(base, target, amount, converted);
    }, 2000); // Wait 2s without changes to consider it a finalized conversion
}

function saveHistory(base, target, amount, converted) {
    const last = state.history[0];
    // Evita spans duplicados se os valores e base/target forem idênticos
    if(last && last.base === base && last.target === target && last.amount === amount) return;

    const entry = {
        id: Date.now(),
        base, target, amount, converted,
        date: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})
    };
    state.history.unshift(entry);
    if (state.history.length > 5) state.history.pop();
    localStorage.setItem('premium_converter_history', JSON.stringify(state.history));
    renderHistory();
}

function renderHistory() {
    if (state.history.length === 0) {
        DOM.historyContainer.innerHTML = `<div class="text-center text-white/20 text-sm italic py-4">Nenhuma conversão recente...</div>`;
        DOM.clearHistoryBtn.classList.add('hidden');
        return;
    }
    
    DOM.clearHistoryBtn.classList.remove('hidden');
    DOM.historyContainer.innerHTML = state.history.map(item => {
        const baseCurr = CURRENCIES[item.base];
        return `
            <div class="bg-black/20 hover:bg-black/40 border border-white/5 p-3.5 rounded-xl transition-colors flex items-center justify-between group cursor-default">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-accentPurple/50 transition-colors shadow-inner">
                        ${baseCurr.type === 'crypto' 
                            ? `<img src="${baseCurr.icon}" class="w-4 h-4 rounded-full" />` 
                            : `<div class="text-[9px] text-white font-bold">${baseCurr.sym}</div>`
                        }
                    </div>
                    <div class="flex flex-col">
                        <span class="text-xs font-bold text-white/80">${item.amount} <span class="font-normal opacity-70">${item.base}</span></span>
                        <span class="text-[10px] text-white/30">${item.date}</span>
                    </div>
                </div>
                
                <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-white/20 group-hover:rotate-12 transition-transform"></i>
                
                <div class="text-right">
                    <span class="text-xs font-bold text-emerald-400 group-hover:text-emerald-300 transition-colors">${formatCurrency(item.converted, item.target)}</span>
                    <span class="block text-[9px] text-white/30 uppercase tracking-widest mt-0.5">${item.target}</span>
                </div>
            </div>
        `;
    }).join('');
    
    if (window.lucide) window.lucide.createIcons();
}
// ------------------------------

// ---- PORTFOLIO & TABS ENGINE ----
function renderPortfolio() {
    if(!DOM.portfolioContainer || state.loading) return;
    
    if (state.portfolio.length === 0) {
        DOM.portfolioTotalBrl.innerText = "R$ 0,00";
        DOM.portfolioContainer.innerHTML = `<div class="text-center text-white/20 text-[11px] italic py-4">Sem ativos cadastrados.</div>`;
        return;
    }
    
    let totalBrl = 0;
    
    DOM.portfolioContainer.innerHTML = state.portfolio.map((asset, index) => {
        // Find value in BRL
        const valueInBrl = convert(asset.amount, asset.currency, 'BRL', state.rates);
        totalBrl += valueInBrl;
        
        const curr = CURRENCIES[asset.currency] || { sym: asset.currency, color: 'bg-white/10' };
        const formattedTotal = formatCurrency(valueInBrl, 'BRL');
        
        return `
            <div class="bg-black/20 hover:bg-black/40 border border-white/5 p-3 rounded-xl flex items-center justify-between group">
                <div class="flex items-center gap-3">
                    ${curr.type === 'crypto' 
                        ? `<img src="${curr.icon}" class="w-6 h-6 rounded-full" />` 
                        : `<div class="w-6 h-6 ${curr.color} rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-inner">${curr.sym}</div>`
                    }
                    <div class="flex flex-col">
                        <span class="text-xs font-bold text-white/80">${asset.amount} <span class="font-normal opacity-70">${asset.currency}</span></span>
                    </div>
                </div>
                <div class="text-right flex flex-col items-end">
                    <span class="text-xs font-bold text-emerald-400">${formattedTotal}</span>
                    <button onclick="window.removePortfolioItem(${index})" class="text-[9px] text-white/20 hover:text-rose-400 uppercase mt-1 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow">Remover</button>
                </div>
            </div>
        `;
    }).join('');
    
    DOM.portfolioTotalBrl.innerText = formatCurrency(totalBrl, 'BRL');
    // Sink to the wallet view total if available
    if(DOM.viewWalletTotalBrl) {
        DOM.viewWalletTotalBrl.innerText = formatCurrency(totalBrl, 'BRL');
    }
}

window.removePortfolioItem = (index) => {
    state.portfolio.splice(index, 1);
    localStorage.setItem('premium_converter_portfolio', JSON.stringify(state.portfolio));
    renderPortfolio();
};

function initTabs() {
    if(!DOM.tabBtns[0]) return;
    
    DOM.tabBtns.forEach((btn, idx) => {
        btn.addEventListener('click', () => {
            // Reset all
            DOM.tabBtns.forEach(b => {
                b.classList.remove('border-accentPurple', 'text-white');
                b.classList.add('border-transparent', 'text-white/40');
            });
            DOM.tabs.forEach(t => t.classList.add('hidden'));
            
            // Activate current
            btn.classList.add('border-accentPurple', 'text-white');
            btn.classList.remove('border-transparent', 'text-white/40');
            DOM.tabs[idx].classList.remove('hidden');
            
            // Re-render when Portfolio is shown (in case of pricing changes)
            if(idx === 1) renderPortfolio();
        });
    });
    
    // Setup Portfolio Add Form Setup
    if(DOM.addPortfolioBtn) {
        DOM.addPortfolioBtn.addEventListener('click', () => DOM.portfolioAddForm.classList.remove('hidden'));
        DOM.portfolioCancel.addEventListener('click', () => {
            DOM.portfolioAddForm.classList.add('hidden');
            DOM.portfolioAmount.value = '';
        });
        DOM.portfolioSave.addEventListener('click', () => {
             const amt = parseFloat(DOM.portfolioAmount.value);
             const cur = DOM.portfolioCurrency.value;
             if(amt > 0) {
                 state.portfolio.push({ currency: cur, amount: amt });
                 localStorage.setItem('premium_converter_portfolio', JSON.stringify(state.portfolio));
                 DOM.portfolioAddForm.classList.add('hidden');
                 DOM.portfolioAmount.value = '';
                 renderPortfolio();
             }
        });
    }
    initAlertFormUI(); // Setup alerts UI bindings
    renderNewsTicker(); // Setup Bottom Ticker
}

// ==== SPA VIEWS RENDERERS ====

// 1. CARTEIRAS (Vaults)
function renderWalletVaults() {
    if(!DOM.walletVaultList || state.loading) return;
    
    let totalBrl = 0;
    const portfolioBreakdown = state.portfolio.map(asset => {
        const val = convert(asset.amount, asset.currency, 'BRL', state.rates);
        totalBrl += val;
        return { ...asset, valInBrl: val };
    });
    
    if(totalBrl === 0) {
        DOM.walletVaultList.innerHTML = `<div class="col-span-full border border-dashed border-white/20 p-8 rounded-2xl flex flex-col items-center justify-center text-center">
            <i data-lucide="inbox" class="w-8 h-8 text-white/20 mb-2"></i>
            <span class="text-white/40 text-sm italic">Você não possui moedas depositadas no momento.</span>
        </div>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    DOM.walletVaultList.innerHTML = portfolioBreakdown.map((asset, index) => {
        const pct = ((asset.valInBrl / totalBrl) * 100).toFixed(1);
        const curr = CURRENCIES[asset.currency] || { sym: asset.currency, color: 'bg-white/10' };
        const iconHtml = curr.type === 'crypto' 
            ? `<img src="${curr.icon}" class="w-10 h-10 rounded-full" />`
            : `<div class="w-10 h-10 ${curr.color} rounded-full flex items-center justify-center font-bold text-white text-sm shadow-inner">${curr.sym}</div>`;
            
        return `
            <div class="bg-black/40 border border-white/5 rounded-2xl p-5 hover:border-white/10 hover:bg-black/60 transition-colors flex flex-col justify-between h-44 relative overflow-hidden group">
                <div class="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-accentGold/5 transition-colors"></div>
                
                <div class="flex items-start justify-between z-10 w-full mb-3">
                    <div class="flex items-center gap-3">
                        ${iconHtml}
                        <div class="flex flex-col">
                            <span class="text-white font-bold font-outfit text-lg">${asset.currency}</span>
                            <span class="text-white/40 text-[10px] uppercase font-bold tracking-widest">${curr.name}</span>
                        </div>
                    </div>
                </div>

                <div class="flex flex-col gap-1 z-10 w-full">
                    <span class="text-2xl font-bold font-outfit text-white">${asset.amount} <span class="text-sm font-normal text-white/40">${asset.currency}</span></span>
                    <span class="text-xs font-bold text-emerald-400">≈ ${formatCurrency(asset.valInBrl, 'BRL')}</span>
                </div>
                
                <div class="mt-4 flex flex-col gap-1.5 z-10 w-full shrink-0">
                    <div class="flex justify-between items-center text-[9px] font-bold text-white/50 uppercase tracking-widest">
                        <span>Alocação</span>
                        <span>${pct}%</span>
                    </div>
                    <div class="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                        <div class="h-full bg-accentGold w-[${pct}%]" style="width: ${pct}%"></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 2. MERCADOS (Exchange Simulation Component)
let spotState = {
    activePair: 'BTC',
    tradeInterval: null,
    orderbookInterval: null,
    currentPrice: Number(0)
};

function initSpotTrading() {
    if(state.loading) return;
    
    // Set initial active pair context
    const firstTarget = 'BTC'; 
    spotState.activePair = firstTarget;
    
    renderSpotPairsList();
    loadSpotPairData(firstTarget);
}

function loadSpotPairData(coin) {
    spotState.activePair = coin;
    const rateData = state.rates[`${coin}BRL`] || state.rates[`${coin}-BRL`];
    
    // Fallback price logic
    let price = 0;
    let pct = 0;
    let volStr = '--';
    
    if (rateData) {
        price = parseFloat(rateData.bid);
        pct = parseFloat(rateData.pctChange);
    } else {
        // Mock fallback for currencies missing active BRL stream in API
        price = Math.random() * 1000 * (coin === 'DOGE' ? 0.001 : 1);
        pct = (Math.random() * 5 - 2.5);
    }
    
    spotState.currentPrice = price;
    volStr = `$${(Math.random() * 40 + 1).toFixed(1)}B`; // Mock volume

    // 1. Update UI Headers
    const pctClass = pct >= 0 ? 'text-emerald-400' : 'text-rose-400';
    const isUp = pct >= 0;
    
    document.getElementById('exchange-current-pair').innerText = `${coin}/BRL`;
    document.getElementById('exchange-last-price').innerText = formatCurrency(price, 'BRL');
    
    const pctEl = document.getElementById('exchange-24h-change');
    pctEl.innerText = (isUp ? '+' : '') + pct.toFixed(2) + '%';
    pctEl.className = `text-sm font-bold ${pctClass}`;
    
    document.getElementById('exchange-24h-volume').innerText = volStr;
    
    // Update Trade Boleta
    document.getElementById('trade-price').value = price.toFixed(2);
    document.getElementById('trade-coin-label').innerText = coin;
    
    // Update Available Balance for BRL exactly
    renderBoletaBalance();
    
    // Re-Render Lists to show Active Pair selection
    renderSpotPairsList();

    // Kill old intervals
    if(spotState.orderbookInterval) clearInterval(spotState.orderbookInterval);
    if(spotState.tradeInterval) clearInterval(spotState.tradeInterval);
    
    // 2. Start Engines
    initOrderBookEngine(price);
    initMarketTradesEngine(price);
    
    // 3. Update Chart
    // (mocking an initial call if chart isn't instantiated yet)
    updateTradingChartMock(coin, isUp);
}

// Side Panel: Pairs list
function renderSpotPairsList() {
    const listEl = document.getElementById('spot-pairs-list');
    if(!listEl) return;
    
    const targets = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'USD', 'EUR', 'GBP'];
    
    listEl.innerHTML = targets.map((coin) => {
        if(coin === 'BRL') return '';
        
        let rateData = state.rates[`${coin}BRL`] || state.rates[`${coin}-BRL`];
        let price = '--'; let pct = '--'; let isUp = true;
        
        if (rateData) {
            price = formatCurrency(parseFloat(rateData.bid), 'BRL');
            const vPct = parseFloat(rateData.pctChange);
            pct = (vPct > 0 ? '+' : '') + vPct.toFixed(2) + '%';
            isUp = vPct >= 0;
        } else {
            price = "Offline";
            pct = "+0.00%";
        }

        const pctClass = isUp ? 'text-emerald-400' : 'text-rose-400';
        const isActive = spotState.activePair === coin;
        
        return `
            <div onclick="loadSpotPairData('${coin}')" class="flex px-3 py-2 text-xs font-bold items-center border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${isActive ? 'bg-white/10 border-l-2 border-l-accentGold' : ''}">
                <div class="flex-1 text-white">${coin}/BRL</div>
                <div class="flex-1 text-right text-white/80">${price}</div>
                <div class="flex-[0.5] text-right ${pctClass}">${pct}</div>
            </div>
        `;
    }).join('');
}

// Order Book Generator Algorithm
function initOrderBookEngine(basePrice) {
    const asksEl = document.getElementById('orderbook-asks');
    const bidsEl = document.getElementById('orderbook-bids');
    const curPriceEl = document.getElementById('orderbook-current-price');
    const spreadEl = document.getElementById('orderbook-spread');

    curPriceEl.innerText = formatCurrency(basePrice, 'BRL');

    function generateRows(isAsk) {
        let rowsHtml = '';
        let currentTotal = 0;
        
        // Generate 15 rows
        for(let i = 0; i < 15; i++) {
            // Asks are higher than base, bids are lower.
            const spread = (Math.random() * 0.002) + 0.0005; // 0.05% to 0.2% variance
            const price = isAsk ? basePrice * (1 + spread * (i+1)) : basePrice * (1 - spread * (i+1));
            
            // Random amount (quantity) logic based on relative market
            const qty = (Math.random() * 2) + 0.01;
            const total = price * qty;
            currentTotal += total;
            
            const colorClass = isAsk ? 'text-rose-400' : 'text-emerald-400';
            const depthPct = Math.min((currentTotal / (basePrice * 10)) * 100, 100);
            const bgDepthClass = isAsk ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)';

            rowsHtml += `
            <div class="flex px-3 py-0.5 text-xs font-outfit relative">
                <div class="absolute top-0 right-0 h-full max-w-full" style="width: ${depthPct}%; background-color: ${bgDepthClass}"></div>
                <div class="flex-1 relative z-10 ${colorClass}">${formatCurrency(price, '', true)}</div>
                <div class="flex-1 text-right relative z-10 text-white/80 font-normal">${qty.toFixed(4)}</div>
                <div class="flex-1 text-right relative z-10 text-white/60 font-normal">${formatCurrency(total, '', true)}</div>
            </div>`;
        }
        return rowsHtml;
    }

    const runEngine = () => {
        if(!document.getElementById('view-mercados').classList.contains('hidden')) {
            asksEl.innerHTML = generateRows(true);
            bidsEl.innerHTML = generateRows(false);
            
            // Spread mock update
            const mockSpread = (Math.random() * 0.5);
            spreadEl.innerHTML = `<i data-lucide="activity" class="w-3 h-3 inline"></i> ${mockSpread.toFixed(2)}`;
            lucide.createIcons();
        }
    };
    
    runEngine();
    spotState.orderbookInterval = setInterval(runEngine, 2500); // refresh every 2.5s
}

// Market Trades (Tape Reading style) Array Memory Engine
const recentTrades = [];

function initMarketTradesEngine(basePrice) {
    const tradesEl = document.getElementById('market-trades-list');
    recentTrades.length = 0; // reset
    tradesEl.innerHTML = '';
    
    function addTrade() {
        if(document.getElementById('view-mercados').classList.contains('hidden')) return;

        const isBuy = Math.random() > 0.5;
        const colorClass = isBuy ? 'text-emerald-400' : 'text-rose-400';
        
        // Slight devation from base price
        const price = basePrice * (1 + (Math.random() * 0.001 - 0.0005));
        const qty = (Math.random() * 1.5) + 0.001;
        
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        
        const html = `
        <div class="flex py-1 text-xs font-outfit slide-in-top">
            <div class="flex-[1.2] ${colorClass}">${formatCurrency(price, '', true)}</div>
            <div class="flex-[0.8] text-right text-white/80 font-normal">${qty.toFixed(4)}</div>
            <div class="flex-1 text-right text-white/40 font-normal">${timeStr}</div>
        </div>`;
        
        tradesEl.insertAdjacentHTML('afterbegin', html);
        
        if(tradesEl.children.length > 50) {
            tradesEl.removeChild(tradesEl.lastElementChild);
        }
    }

    // prefill
    for(let i=0; i<15; i++) { addTrade(); }
    
    spotState.tradeInterval = setInterval(addTrade, Math.random() * 1000 + 400); // randomize firing intervals
}

function updateTradingChartMock(coin, isUp) {
    // We will do a full chart initialization logic on the canvas here.
    // Ensure we don't recreate the global chart instance endlessly.
    const ctx = document.getElementById('tradingChart');
    if(!ctx) return;
    
    if(window._tradingChartInstance) {
        window._tradingChartInstance.destroy();
    }
    
    const xLabels = Array.from({length: 40}, (_, i) => i);
    let last = spotState.currentPrice;
    
    const initialPricePath = [last];
    
    // Create random mock path ending up closing to current price
    for (let i = 1; i < 40; i++) {
        // Random walk
        last = last * (1 + (Math.random()*0.02 - 0.01));
        initialPricePath.push(last);
    }
    
    const colorLine = isUp ? '#10b981' : '#f43f5e';
    const colorBg = isUp ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)';

    window._tradingChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: xLabels,
            datasets: [{
                data: initialPricePath,
                borderColor: colorLine,
                borderWidth: 2,
                backgroundColor: colorBg,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: '#000',
                pointHoverBorderColor: colorLine,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index',
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#fff',
                    bodyColor: colorLine,
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    displayColors: false,
                    callbacks: {
                        label: (ctx) => `Preço: R$ ${ctx.parsed.y.toFixed(2)}`
                    }
                }
            },
            scales: {
                x: { display: false }, // Hide x completely
                y: {
                    position: 'right', // Price grid on right like pro exchanges
                    grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                    ticks: {
                        color: 'rgba(255,255,255,0.3)',
                        font: { family: 'Outfit', size: 10 },
                        callback: (value) => formatCurrency(value, '', true)
                    }
                }
            }
        }
    });
}

// 3. TRANSFERÊNCIAS (Full History Extrato)
function renderFullHistory() {
    if(!DOM.fullHistoryContainer) return;
    
    if (state.history.length === 0) {
        DOM.fullHistoryContainer.innerHTML = `<div class="text-center text-white/20 text-sm italic py-8">Você não possui registro de transferências/conversões.</div>`;
        return;
    }
    
    DOM.fullHistoryContainer.innerHTML = state.history.map(item => {
        const baseCurr = CURRENCIES[item.base];
        return `
            <div class="bg-black/20 hover:bg-black/40 border border-white/5 p-5 rounded-2xl transition-colors flex items-center justify-between cursor-default group">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-accentPurple/50 transition-colors shadow-inner">
                        <i data-lucide="arrow-right-left" class="w-4 h-4 text-white/40"></i>
                    </div>
                    <div class="flex flex-col gap-1">
                        <span class="text-sm font-bold text-white/80">Swap de <span class="text-white">${item.amount} ${item.base}</span></span>
                        <div class="flex items-center gap-2 text-[10px] text-white/40 font-bold uppercase tracking-widest">
                            <span>Status: Sucesso</span> <span class="w-1 h-1 bg-emerald-500 rounded-full"></span> <span>${item.date}</span>
                        </div>
                    </div>
                </div>
                
                <div class="text-right flex flex-col gap-1">
                    <span class="text-base font-bold font-outfit text-emerald-400">+ ${formatCurrency(item.converted, item.target)}</span>
                    <span class="text-[9px] text-white/30 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded ml-auto">LIQUIDADO</span>
                </div>
            </div>
        `;
    }).join('');
    
    if (window.lucide) window.lucide.createIcons();
}

// ==== NEWS TICKER ENGINE ====
function renderNewsTicker() {
    const tickerEl = document.getElementById('news-ticker');
    if(!tickerEl) return;
    
    // Random / dynamic headlines mock
    const headlines = [
        "🔥 FOCUS: Adoção institucional atinge volumes históricos",
        "📉 BRL/USD: Mercado observa resistência na cotação do Dólar",
        "🚀 BITCOIN aproxima-se de zona de liquidez crítica",
        "🏦 FED: Análise do BCE sustenta cautela perante política monetária",
        "💎 ETH: Atividade de Stake renova métricas on-chain",
        "📊 ETF: Fluxo líquido de capital segue positivo para ativos digitais"
    ];
    
    // Multiply headlines to fill the infinite loop smoothly
    const track = [...headlines, ...headlines, ...headlines].map(h => {
        const color = h.includes('🚀') || h.includes('🔥') ? 'text-emerald-400' : 
                      h.includes('📉') ? 'text-rose-400' : 'text-white/70';
        return `<span class="mx-6 flex items-center gap-4"><div class="w-1.5 h-1.5 bg-white/20 rounded-full"></div> <span class="${color}">${h}</span></span>`;
    }).join("");
    
    tickerEl.innerHTML = track;
}
// ------------------------------

// ---- ALERTS ENGINE ----
function renderAlerts() {
    if(!DOM.alertsContainer) return;
    
    if (state.alerts.length === 0) {
        DOM.alertsContainer.innerHTML = `<div class="text-center text-white/20 text-[11px] italic py-4">Nenhum alerta configurado.</div>`;
        return;
    }
    
    DOM.alertsContainer.innerHTML = state.alerts.map((alert, index) => {
        const isActive = alert.active !== false;
        return `
            <div class="bg-black/20 hover:bg-black/40 border ${isActive ? 'border-accentPurple/20' : 'border-white/5'} p-3 rounded-xl flex items-center justify-between group transition-colors">
                <div class="flex flex-col">
                    <span class="text-[10px] font-bold text-white/40 uppercase tracking-widest">${alert.pair}</span>
                    <span class="text-white text-sm font-outfit mt-0.5">Se ${alert.condition === '>' ? 'subir de' : 'cair pra'} <span class="${alert.condition === '>' ? 'text-emerald-400' : 'text-rose-400'} font-bold">R$ ${alert.targetPrice}</span></span>
                </div>
                <div class="flex items-center gap-3">
                    <div class="w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse' : 'bg-white/10'}"></div>
                    <button onclick="window.removeAlertItem(${index})" class="text-[9px] text-white/20 hover:text-rose-400 uppercase opacity-0 group-hover:opacity-100 transition-opacity">Excluir</button>
                </div>
            </div>
        `;
    }).join('');
}

window.removeAlertItem = (index) => {
    state.alerts.splice(index, 1);
    localStorage.setItem('premium_converter_alerts', JSON.stringify(state.alerts));
    renderAlerts();
};

function initAlertFormUI() {
    if(!DOM.addAlertBtn) return;
    
    // Check initial notification perm
    if ("Notification" in window && Notification.permission === "denied") {
        const banner = document.getElementById('alert-permission-banner');
        if(banner) banner.classList.remove('hidden');
    }

    DOM.addAlertBtn.addEventListener('click', () => DOM.alertAddForm.classList.remove('hidden'));
    DOM.alertCancel.addEventListener('click', () => {
        DOM.alertAddForm.classList.add('hidden');
        DOM.alertPrice.value = '';
    });
    
    DOM.alertSave.addEventListener('click', () => {
        const pair = DOM.alertCurrency.value;
        const condition = DOM.alertCondition.value;
        const targetPrice = parseFloat(DOM.alertPrice.value);
        if(targetPrice > 0) {
            state.alerts.unshift({ id: Date.now(), pair, condition, targetPrice, active: true });
            localStorage.setItem('premium_converter_alerts', JSON.stringify(state.alerts));
            DOM.alertAddForm.classList.add('hidden');
            DOM.alertPrice.value = '';
            renderAlerts();
            
            // Mock System Notification Demo
            if ("Notification" in window && Notification.permission !== "denied") {
                Notification.requestPermission().then(permission => {
                    if (permission === "granted") {
                        new Notification("🔔 Alerta Monitorado", {
                            body: `Acompanhando ${pair} ${condition} R$ ${targetPrice}`,
                            icon: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/btc.png'
                        });
                    }
                });
            }
        }
    });
}
// ------------------------------

// ---- UX BOILERPLATE ----
function toggleSkeleton(isActive) {
    const list = [DOM.quickBtc, DOM.quickEth, DOM.quickSol, DOM.targetAmount, 
                  DOM.insightPct, DOM.insightHigh, DOM.insightLow, DOM.insightTime];
    list.forEach(el => {
        if (!el) return;
        if (isActive) {
            el.classList.add('skeleton');
            if(el.tagName === 'INPUT') el.value = '';
        } else {
            el.classList.remove('skeleton');
        }
    });
}

DOM.baseAmount.addEventListener('input', debounce(() => {
    recalculate();
}, 250));

DOM.btnSwap.addEventListener('click', () => {
    const temp = state.base;
    window.selectCurrency('base', state.target);
    window.selectCurrency('target', temp);
});

// Fee Listeners
DOM.toggleFee.addEventListener('click', () => {
    DOM.feeContainer.classList.toggle('hidden');
});

DOM.feeInput.addEventListener('input', debounce(() => {
    recalculate();
}, 250));

// Multi-Target Listeners & Logic
function renderMultiTarget() {
    const amountStr = DOM.baseAmount.value;
    const amount = parseFloat(amountStr) || 0; 
    const base = state.base;
    
    // Most popular fiats/cryptos to burst to
    const targets = ['BRL', 'USD', 'EUR', 'GBP', 'BTC', 'ETH'];
    const listContainer = document.getElementById('multi-target-list');
    
    if(!listContainer) return;
    
    if (amount === 0) {
        listContainer.innerHTML = `<div class="text-center text-white/40 py-4 text-sm mt-4">Insira um valor para ver a conversão simultânea.</div>`;
        return;
    }
    
    listContainer.innerHTML = targets.map(tgt => {
        if(tgt === base) return ''; // ignore self
        
        const convertedValue = convert(amount, base, tgt, state.rates);
        const feePct = parseFloat(DOM.feeInput.value) || 0;
        let finalValue = convertedValue;
        if(feePct > 0) {
            finalValue = convertedValue - (convertedValue * (feePct / 100));
        }
        
        const formatted = formatCurrency(finalValue, tgt);
        const curr = CURRENCIES[tgt];
        
        let iconHtml = '';
        if (curr.type === 'crypto') {
            iconHtml = `<img src="${curr.icon}" class="w-10 h-10 rounded-full" />`;
        } else {
            iconHtml = `<div class="w-10 h-10 ${curr.color || 'bg-white/10'} rounded-full flex items-center justify-center font-bold text-white shadow-inner">${curr.sym || tgt}</div>`;
        }

        return `
            <div class="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
                <div class="flex items-center gap-3">
                    ${iconHtml}
                    <div class="flex flex-col">
                        <span class="text-white font-bold text-sm leading-tight">${curr.name}</span>
                        <span class="text-white/40 text-[10px] tracking-wide uppercase">${tgt}</span>
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-accentGold font-bold text-lg md:text-xl font-outfit tracking-wide drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]">${formatted}</span>
                </div>
            </div>
        `;
    }).join('');
}

DOM.btnMultiTarget.addEventListener('click', () => {
    const modal = document.getElementById('multi-target-modal');
    renderMultiTarget();
    modal.classList.remove('opacity-0', 'pointer-events-none');
    modal.querySelector('.scale-95').classList.replace('scale-95', 'scale-100');
});

// Modal Global Close Logic
document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.fixed');
        if(modal) {
            modal.querySelector('.scale-100').classList.replace('scale-100', 'scale-95');
            setTimeout(() => {
                modal.classList.add('opacity-0', 'pointer-events-none');
            }, 200);
        }
    });
});

// --- SPOT TRADING ACTIONS ---
function renderBoletaBalance() {
    const el = document.getElementById('spot-available-brl');
    if(!el) return;
    const brlData = state.portfolio.find(p => p.currency === 'BRL');
    const bal = brlData ? brlData.amount : 0;
    el.innerText = formatCurrency(bal, 'BRL');
}

function initSpotActionListeners() {
    const inputAmountBrl = document.getElementById('trade-amount-brl');
    const estimateTotal = document.getElementById('trade-estimate-crypto');
    const buyBtn = document.getElementById('spot-buy-btn');
    const sellBtn = document.getElementById('spot-sell-btn');
    
    if(!inputAmountBrl || !buyBtn) return;
    
    // Auto-calculate estimate
    inputAmountBrl.addEventListener('input', () => {
        const brl = parseFloat(inputAmountBrl.value) || 0;
        const est = brl / spotState.currentPrice;
        estimateTotal.innerText = est.toFixed(6);
    });
    
    // Percentage Slider
    document.querySelectorAll('.percentage-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const pct = parseFloat(e.target.dataset.pct);
            const brlData = state.portfolio.find(p => p.currency === 'BRL');
            const bal = brlData ? brlData.amount : 0;
            
            inputAmountBrl.value = (bal * pct).toFixed(2);
            // Trigger input event to update estimate
            inputAmountBrl.dispatchEvent(new Event('input'));
        });
    });

    buyBtn.addEventListener('click', () => {
        const brlToSpend = parseFloat(inputAmountBrl.value) || 0;
        if(brlToSpend <= 0) return alert('Insira um valor maior que zero.');
        
        const brlPort = state.portfolio.find(p => p.currency === 'BRL');
        if(!brlPort || brlPort.amount < brlToSpend) {
            return alert('Saldo Insuficiente em BRL!');
        }
        
        const cryptoToReceive = brlToSpend / spotState.currentPrice;
        
        // Deduct BRL
        brlPort.amount -= brlToSpend;
        
        // Add Crypto
        let cryptoPort = state.portfolio.find(p => p.currency === spotState.activePair);
        if(cryptoPort) {
            cryptoPort.amount += cryptoToReceive;
        } else {
            state.portfolio.push({ currency: spotState.activePair, amount: cryptoToReceive, avgPrice: spotState.currentPrice });
        }
        
        localStorage.setItem('premium_converter_portfolio', JSON.stringify(state.portfolio));
        
        inputAmountBrl.value = '';
        estimateTotal.innerText = '0.000000';
        renderBoletaBalance();
        
        // Mock Add to history
        state.history.unshift({
            date: new Date().toISOString(),
            base: 'BRL',
            target: spotState.activePair,
            amount: brlToSpend,
            converted: cryptoToReceive,
            rate: 1/spotState.currentPrice,
            type: 'trade_buy'
        });
        localStorage.setItem('premium_converter_history', JSON.stringify(state.history));
        
        alert(`Sucesso! Você comprou ${cryptoToReceive.toFixed(6)} ${spotState.activePair} por R$ ${brlToSpend.toFixed(2)}`);
    });

    sellBtn.addEventListener('click', () => {
        const brlExpected = parseFloat(inputAmountBrl.value) || 0;
        if(brlExpected <= 0) return alert('Insira um valor BRL equivalente para vender.');
        
        const cryptoToSell = brlExpected / spotState.currentPrice;
        const cryptoPort = state.portfolio.find(p => p.currency === spotState.activePair);
        
        if(!cryptoPort || cryptoPort.amount < cryptoToSell) {
            return alert(`Saldo Insuficiente em ${spotState.activePair}!`);
        }
        
        const brlPort = state.portfolio.find(p => p.currency === 'BRL');
        brlPort.amount += brlExpected;
        cryptoPort.amount -= cryptoToSell;
        
        localStorage.setItem('premium_converter_portfolio', JSON.stringify(state.portfolio));
        
        inputAmountBrl.value = '';
        estimateTotal.innerText = '0.000000';
        renderBoletaBalance();
        
        state.history.unshift({
            date: new Date().toISOString(),
            base: spotState.activePair,
            target: 'BRL',
            amount: cryptoToSell,
            converted: brlExpected,
            rate: spotState.currentPrice,
            type: 'trade_sell'
        });
        localStorage.setItem('premium_converter_history', JSON.stringify(state.history));

        alert(`Sucesso! Você vendeu ${cryptoToSell.toFixed(6)} ${spotState.activePair} por R$ ${brlExpected.toFixed(2)}`);
    });
}
// ------------------------------

document.addEventListener('DOMContentLoaded', () => {
    boot();
    setTimeout(initSpotActionListeners, 1000); // Wait for DOM layout
});
