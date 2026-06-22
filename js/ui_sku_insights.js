// ==========================================
// js/ui_sku_insights.js: SKU Insights tab
// SKU-centric view (the inverse of Customer Insights):
// pick a SKU -> see its sales trend across ALL customers,
// bucketed into fixed 4-week periods with an ending estimate.
// ==========================================

window._siAllRows      = null;   // all client_sku_orders rows (across all customers), loaded once per session
window._siSkuList      = [];     // [{code, name, totalAmount}]
window._siSelectedSku  = null;   // currently selected sku_code
window._siMetric       = 'amount'; // 'amount' | 'qty'
window._siNumBlocks    = 6;      // number of 4-week periods to show: 6 | 13 | 'all'
window._siChart        = null;   // Chart.js instance
window._siGlobalMaxWeek = null;  // MAX(week_start) across all rows (ISO date string)
window._siMode         = 'single'; // 'single' | 'stack'
window._siStackSkus    = [];     // sku_codes selected for stacked comparison

// Categorical palette for stacked comparison mode (distinct, app-consistent hues)
const SI_PALETTE = [
    '#0d9488', '#6366f1', '#db2777', '#d97706', '#0891b2',
    '#65a30d', '#9333ea', '#dc2626', '#0ea5e9', '#ca8a04',
    '#16a34a', '#e11d48'
];

// Fixed weekly grid so 4-week period boundaries are stable regardless of the data range.
// 2020-01-06 is a Monday (week_start values are always Mondays).
const SI_EPOCH    = Date.UTC(2020, 0, 6);
const SI_WEEK_MS  = 7 * 24 * 3600 * 1000;
const SI_BLOCK_WEEKS = 4;

const _siFmtAmt = v => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const _siFmtShort = (v, isAmt) => {
    if (isAmt) return v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'k' : '$' + v.toFixed(0);
    return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v));
};

function _siWeekIndex(weekStr) {
    const [y, m, d] = weekStr.split('-').map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - SI_EPOCH) / SI_WEEK_MS);
}
function _siBlockOf(weekStr)  { return Math.floor(_siWeekIndex(weekStr) / SI_BLOCK_WEEKS); }
function _siBlockStartDate(blockIdx) {
    return new Date(SI_EPOCH + blockIdx * SI_BLOCK_WEEKS * SI_WEEK_MS);
}
function _siBlockLabel(blockIdx) {
    const s = _siBlockStartDate(blockIdx);
    const e = new Date(s.getTime() + (SI_BLOCK_WEEKS - 1) * SI_WEEK_MS);
    const fmt = dt => (dt.getUTCMonth() + 1) + '/' + dt.getUTCDate();
    return fmt(s) + '–' + fmt(e);
}

// Diagonal-stripe pattern for the "projected" (estimate) portion of the latest bar
let _siStripePatternCache = null;
function _siStripePattern() {
    if (_siStripePatternCache) return _siStripePatternCache;
    const c = document.createElement('canvas');
    c.width = 8; c.height = 8;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(20,184,166,0.10)';
    x.fillRect(0, 0, 8, 8);
    x.strokeStyle = 'rgba(20,184,166,0.85)';
    x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(0, 8); x.lineTo(8, 0);
    x.moveTo(-4, 4); x.lineTo(4, -4);
    x.moveTo(4, 12); x.lineTo(12, 4);
    x.stroke();
    _siStripePatternCache = x.createPattern(c, 'repeat');
    return _siStripePatternCache;
}

// Diagonal-stripe pattern in an arbitrary base color (for estimate segments in stack mode)
const _siColorStripeCache = {};
function _siStripePatternFor(hex) {
    if (_siColorStripeCache[hex]) return _siColorStripeCache[hex];
    const c = document.createElement('canvas');
    c.width = 8; c.height = 8;
    const x = c.getContext('2d');
    // faint base tint so the segment still reads as its SKU color
    x.fillStyle = hex + '26'; // ~15% alpha
    x.fillRect(0, 0, 8, 8);
    x.strokeStyle = hex;
    x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(0, 8); x.lineTo(8, 0);
    x.moveTo(-4, 4); x.lineTo(4, -4);
    x.moveTo(4, 12); x.lineTo(12, 4);
    x.stroke();
    _siColorStripeCache[hex] = x.createPattern(c, 'repeat');
    return _siColorStripeCache[hex];
}

// ==========================================
// Entry: load data once, then init tab
// ==========================================
async function initSkuInsights() {
    const placeholder = document.getElementById('siPlaceholder');
    const content     = document.getElementById('siContent');

    // 2nd+ visit: data already in memory, just re-show
    if (window._siAllRows !== null) {
        if (placeholder) placeholder.style.display = 'none';
        if (content)     content.style.display = 'block';
        return;
    }

    if (placeholder) {
        placeholder.style.display = 'flex';
        placeholder.innerHTML = `
            <div class="flex flex-col items-center justify-center gap-3">
                <svg class="animate-spin h-10 w-10 text-teal-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                </svg>
                <p class="text-sm font-bold text-gray-400">Loading SKU sales data...</p>
            </div>`;
    }
    if (content) content.style.display = 'none';

    // Load SKU master for item names if not yet populated
    if (typeof skuMaster !== 'undefined' && Object.keys(skuMaster).length === 0) {
        try { skuMaster = await sbLoadSkuMaster(); } catch (e) { console.warn('[SI] skuMaster load failed:', e); }
    }

    let rows = [];
    try {
        rows = await sbLoadClientSkuOrders();
    } catch (e) {
        if (placeholder) placeholder.innerHTML = `
            <p class="text-red-500 text-sm font-bold bg-red-50 px-4 py-2 rounded-lg border border-red-200">
                Load error: ${e.message || String(e)}
            </p>`;
        return;
    }

    window._siAllRows = rows;

    if (!rows.length) {
        if (placeholder) placeholder.innerHTML = `
            <div class="text-5xl mb-4">📈</div>
            <p class="text-xl font-black text-gray-700 mb-2">No data yet</p>
            <p class="text-sm text-gray-500">Go to <strong class="text-teal-700">⚙️ Data Setup</strong> and upload a <em>Sales By Item (Customer)</em> Excel file.</p>`;
        return;
    }

    // Build SKU list (distinct sku_code, sorted by total amount desc) + global max week
    const skuTotals = {};
    let maxWeek = null;
    for (const r of rows) {
        skuTotals[r.sku_code] = (skuTotals[r.sku_code] || 0) + (r.amount || 0);
        if (!maxWeek || r.week_start > maxWeek) maxWeek = r.week_start;
    }
    window._siGlobalMaxWeek = maxWeek;
    window._siSkuList = Object.keys(skuTotals)
        .map(code => ({
            code,
            name: (typeof skuMaster !== 'undefined' && skuMaster[code]?.name) || code,
            totalAmount: skuTotals[code]
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount);

    if (placeholder) placeholder.style.display = 'none';
    if (content)     content.style.display = 'block';

    _siRenderShell();
    _siRenderPanel(null);
}

// ==========================================
// Shell: search box + close dropdown on outside click
// ==========================================
function _siRenderShell() {
    document.addEventListener('click', e => {
        const wrapper = document.getElementById('siSearchWrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            const dd = document.getElementById('siSkuDropdown');
            if (dd) dd.classList.add('hidden');
        }
    }, { capture: true });
}

function siFilterSkus(query) {
    const dd = document.getElementById('siSkuDropdown');
    if (!dd) return;
    const q = query.trim().toLowerCase();
    const matches = (q
        ? window._siSkuList.filter(s => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
        : window._siSkuList
    ).slice(0, 50);

    if (!matches.length) {
        dd.innerHTML = '<p class="px-4 py-3 text-sm text-gray-400">No SKUs found.</p>';
        dd.classList.remove('hidden');
        return;
    }

    dd.innerHTML = matches.map(s => `
        <div class="px-4 py-2.5 text-sm cursor-pointer hover:bg-teal-50 hover:text-teal-700 font-bold border-b border-gray-50 last:border-0"
             onmousedown="siSelectSku('${String(s.code).replace(/'/g, "\\'")}')">
            <span class="text-indigo-700">${s.code}</span>
            <span class="text-xs font-normal text-gray-400 ml-1">${s.name === s.code ? '' : s.name}</span>
        </div>`).join('');
    dd.classList.remove('hidden');
}

function siClearSearch() {
    const input = document.getElementById('siSkuSearch');
    const dd    = document.getElementById('siSkuDropdown');
    if (input) input.value = '';
    if (dd)    dd.classList.add('hidden');
    window._siSelectedSku = null;
    _siRenderPanel(null);
}

function siSelectSku(code) {
    const input = document.getElementById('siSkuSearch');
    const dd    = document.getElementById('siSkuDropdown');
    if (dd) dd.classList.add('hidden');

    // Stack mode: add to comparison list, clear box for the next pick
    if (window._siMode === 'stack') {
        if (!window._siStackSkus.includes(code)) window._siStackSkus.push(code);
        if (input) input.value = '';
        _siRenderStackPanel();
        return;
    }

    const sku = window._siSkuList.find(s => s.code === code);
    if (input) input.value = sku ? (sku.code + (sku.name === sku.code ? '' : ' — ' + sku.name)) : code;
    window._siSelectedSku = code;
    _siRenderPanel(code);
}

function siSetMode(mode) {
    window._siMode = mode;
    const input = document.getElementById('siSkuSearch');
    if (input) input.value = '';
    const dd = document.getElementById('siSkuDropdown');
    if (dd) dd.classList.add('hidden');
    if (mode === 'stack') _siRenderStackPanel();
    else _siRenderPanel(window._siSelectedSku);
}

function _siRerender() {
    if (window._siMode === 'stack') _siRenderStackPanel();
    else if (window._siSelectedSku) _siRenderPanel(window._siSelectedSku);
}

function siSetMetric(metric) {
    window._siMetric = metric;
    _siRerender();
}

function siSetPeriod(n) {
    window._siNumBlocks = n;
    _siRerender();
}

function siRemoveStackSku(code) {
    window._siStackSkus = window._siStackSkus.filter(c => c !== code);
    _siRenderStackPanel();
}

function siClearStack() {
    window._siStackSkus = [];
    _siRenderStackPanel();
}

// Shared UI fragments
function _siModeToggleHtml() {
    const btn = (m, label) => {
        const active = m === window._siMode;
        const cls = active ? 'px-3 py-1.5 text-xs font-bold rounded bg-indigo-600 text-white'
                           : 'px-3 py-1.5 text-xs font-bold rounded text-gray-500 hover:bg-gray-100 transition-colors';
        return `<button onclick="siSetMode('${m}')" class="${cls}">${label}</button>`;
    };
    return `<div class="flex items-center gap-1 mb-5 bg-gray-50 border border-gray-200 rounded-lg p-1 w-max">
        ${btn('single', '📈 Single SKU')}${btn('stack', '📊 Compare (stacked)')}
    </div>`;
}

function _siControlsHtml() {
    const metricBtn = (m, label) => {
        const active = m === window._siMetric;
        const cls = active ? 'px-3 py-1.5 text-xs font-bold rounded bg-teal-500 text-white'
                           : 'px-3 py-1.5 text-xs font-bold rounded text-gray-400 hover:bg-gray-100 transition-colors';
        return `<button onclick="siSetMetric('${m}')" class="${cls}">${label}</button>`;
    };
    const periodBtn = (n, label) => {
        const active = n === window._siNumBlocks;
        const cls = active ? 'px-2.5 py-1 text-xs font-bold rounded bg-teal-500 text-white'
                           : 'px-2.5 py-1 text-xs font-bold rounded text-gray-400 hover:bg-gray-100 transition-colors';
        return `<button onclick="siSetPeriod(${typeof n === 'string' ? `'${n}'` : n})" class="${cls}">${label}</button>`;
    };
    return `<div class="flex items-center gap-4 flex-wrap">
        <div class="flex items-center gap-1.5">
            <span class="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Show:</span>
            ${metricBtn('amount', 'Sales $')}${metricBtn('qty', 'Quantity')}
        </div>
        <div class="flex items-center gap-1.5">
            <span class="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Periods:</span>
            ${periodBtn(6, '6')}${periodBtn(13, '13')}${periodBtn('all', 'All')}
        </div>
    </div>`;
}

// ==========================================
// Build 4-week period buckets for the selected SKU
// ==========================================
function _siBuildBlocks(code) {
    const rows    = window._siAllRows.filter(r => r.sku_code === code);
    const isAmt   = window._siMetric === 'amount';
    const valOf   = r => isAmt ? (r.amount || 0) : (r.qty || 0);

    const maxWeekIdx   = _siWeekIndex(window._siGlobalMaxWeek);
    const latestBlock  = Math.floor(maxWeekIdx / SI_BLOCK_WEEKS);
    // weeks elapsed within the latest (in-progress) block: 1..4
    const weeksElapsed = (maxWeekIdx - latestBlock * SI_BLOCK_WEEKS) + 1;

    // Sum this SKU's value per block
    const blockSum = {};
    let earliestBlock = latestBlock;
    for (const r of rows) {
        const b = _siBlockOf(r.week_start);
        blockSum[b] = (blockSum[b] || 0) + valOf(r);
        if (b < earliestBlock) earliestBlock = b;
    }

    const startBlock = window._siNumBlocks === 'all'
        ? earliestBlock
        : Math.max(earliestBlock, latestBlock - window._siNumBlocks + 1);

    const blocks = [];
    for (let b = startBlock; b <= latestBlock; b++) {
        const actual = blockSum[b] || 0;
        let projectedUplift = 0;
        let isEstimate = false;
        if (b === latestBlock && weeksElapsed < SI_BLOCK_WEEKS) {
            const projectedTotal = weeksElapsed > 0 ? (actual / weeksElapsed) * SI_BLOCK_WEEKS : 0;
            projectedUplift = Math.max(0, projectedTotal - actual);
            isEstimate = projectedUplift > 0;
        }
        blocks.push({
            blockIdx: b,
            label: _siBlockLabel(b),
            actual,
            projectedUplift,
            total: actual + projectedUplift,
            isEstimate,
            weeksElapsed: b === latestBlock ? weeksElapsed : SI_BLOCK_WEEKS
        });
    }
    return { blocks, isAmt };
}

// ==========================================
// Render the per-SKU detail panel + chart
// ==========================================
function _siRenderPanel(code) {
    const panel = document.getElementById('siSkuPanel');
    if (!panel) return;

    if (window._siChart) { window._siChart.destroy(); window._siChart = null; }

    if (!code) {
        panel.innerHTML = `
            ${_siModeToggleHtml()}
            <div class="flex flex-col items-center justify-center py-24 text-center">
                <div class="text-5xl mb-4">🔍</div>
                <p class="text-lg font-black text-gray-600 mb-1">Select a SKU</p>
                <p class="text-sm text-gray-400">Type a SKU code or item name in the search box above<br>to view its 4-week sales trend.</p>
            </div>`;
        return;
    }

    const sku = window._siSkuList.find(s => s.code === code);
    const { blocks, isAmt } = _siBuildBlocks(code);

    panel.innerHTML = `
        ${_siModeToggleHtml()}
        <div class="mb-5 flex items-start justify-between flex-wrap gap-3">
            <div>
                <h2 class="text-xl font-black text-gray-800">${sku ? sku.code : code}</h2>
                <p class="text-xs text-gray-400 mt-0.5">${sku && sku.name !== sku.code ? sku.name + ' &nbsp;|&nbsp; ' : ''}Data up to: ${window._siGlobalMaxWeek}</p>
            </div>
            ${_siControlsHtml()}
        </div>

        <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div class="flex items-center justify-between mb-2">
                <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">4-Week Sales Trend ${isAmt ? '(Amount)' : '(Quantity)'}</p>
                <div class="flex items-center gap-3 text-xs text-gray-400">
                    <span class="flex items-center gap-1"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:rgba(20,184,166,0.85);"></span> Actual</span>
                    <span class="flex items-center gap-1"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;border:1.5px solid rgba(20,184,166,0.85);background:rgba(20,184,166,0.12);"></span> Estimate (projected)</span>
                </div>
            </div>
            <div style="position:relative;height:420px;">
                <canvas id="siTrendChart"></canvas>
            </div>
            <p class="text-xs text-gray-400 mt-2">Each bar = one fixed 4-week period (label = start–end). The most recent period is projected to a full 4 weeks using the elapsed-week run rate.</p>
        </div>

        ${_siRenderCustomerTable(code)}
    `;

    _siRenderChart(blocks, isAmt);
}

function _siRenderChart(blocks, isAmt) {
    const ctx = document.getElementById('siTrendChart');
    if (!ctx) return;

    const labels    = blocks.map(b => b.label);
    const actualArr = blocks.map(b => b.actual);
    const projArr   = blocks.map(b => b.projectedUplift);

    // Rank top-3 by total for teal shading (matches the rest of the app)
    const totals = blocks.map(b => b.total);
    const uniq   = [...new Set(totals.filter(t => t > 0))].sort((a, b) => b - a);
    const rank   = {}; uniq.slice(0, 3).forEach((t, i) => { rank[t] = i + 1; });
    const shade  = { 1: 'rgba(20,184,166,0.90)', 2: 'rgba(20,184,166,0.62)', 3: 'rgba(20,184,166,0.38)' };
    const actualColors = blocks.map(b => b.isEstimate ? 'rgba(20,184,166,0.55)' : (shade[rank[b.total]] || 'rgba(156,163,175,0.32)'));

    const stripe = _siStripePattern();

    window._siChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Actual',    data: actualArr, backgroundColor: actualColors, stack: 's', borderRadius: 3, borderSkipped: false },
                { label: 'Projected', data: projArr,   backgroundColor: stripe,
                  borderColor: 'rgba(20,184,166,0.85)', borderWidth: { top: 1.5, left: 1.5, right: 1.5, bottom: 0 },
                  stack: 's', borderRadius: 3, borderSkipped: false }
            ]
        },
        plugins: [{
            id: 'siBarTotals',
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                const meta = chart.getDatasetMeta(1); // top (projected) dataset bars
                const metaA = chart.getDatasetMeta(0);
                meta.data.forEach((bar, i) => {
                    const b = blocks[i];
                    if (!b.total) return;
                    const topBar = b.projectedUplift > 0 ? bar : metaA.data[i];
                    ctx.save();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillStyle = '#374151';
                    ctx.font = 'bold 12px sans-serif';
                    ctx.fillText(_siFmtShort(b.total, isAmt), topBar.x, topBar.y - 6);
                    if (b.isEstimate) {
                        ctx.fillStyle = '#0d9488';
                        ctx.font = '10px sans-serif';
                        ctx.fillText('est. (' + b.weeksElapsed + '/4 wk)', topBar.x, topBar.y - 21);
                    }
                    ctx.restore();
                });
            }
        }],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 34 } },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: items => 'Period ' + items[0].label,
                        label: item => {
                            const b = blocks[item.dataIndex];
                            const fmt = v => isAmt ? _siFmtAmt(v) : (v.toLocaleString() + ' units');
                            if (item.datasetIndex === 0) return 'Actual: ' + fmt(b.actual);
                            return 'Projected total: ' + fmt(b.total) + '  (' + b.weeksElapsed + '/4 wks elapsed)';
                        }
                    }
                }
            },
            scales: {
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: { font: { size: 12 }, callback: v => isAmt ? _siFmtShort(v, true) : v.toLocaleString() },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    stacked: true,
                    ticks: { font: { size: 11 } },
                    grid: { display: false }
                }
            }
        }
    });
}

// ==========================================
// Per-customer ordering-pace table (all-time, for the selected SKU)
// ==========================================
const SI_WARN_WEEKS    = 4;
const SI_DORMANT_WEEKS = 8;

function _siCustomerStats(code) {
    const rows       = window._siAllRows.filter(r => r.sku_code === code);
    const maxWeekIdx = _siWeekIndex(window._siGlobalMaxWeek);

    const byCust = {};
    for (const r of rows) {
        const c = byCust[r.customer_code] || (byCust[r.customer_code] = {
            code: r.customer_code,
            name: r.customer_name || r.customer_code,
            totalAmount: 0, totalQty: 0, uom: null, weeks: new Set()
        });
        c.totalAmount += r.amount || 0;
        c.totalQty    += r.qty || 0;
        if ((r.qty || 0) > 0 || (r.amount || 0) > 0) c.weeks.add(r.week_start);
        if (r.uom && !c.uom) c.uom = r.uom;
        if ((!c.name || c.name === c.code) && r.customer_name) c.name = r.customer_name;
    }

    const list = Object.values(byCust).map(c => {
        const weeksArr = [...c.weeks].sort();
        const orders   = weeksArr.length;
        const firstW   = weeksArr[0] || null;
        const lastW    = weeksArr[orders - 1] || null;
        const gap      = lastW ? (maxWeekIdx - _siWeekIndex(lastW)) : null;
        const cadence  = orders > 1
            ? (_siWeekIndex(lastW) - _siWeekIndex(firstW)) / (orders - 1)
            : null;
        return { code: c.code, name: c.name, totalAmount: c.totalAmount, totalQty: c.totalQty,
                 uom: c.uom || 'ea', orders, firstW, lastW, gap, cadence };
    });

    list.sort((a, b) => b.totalAmount - a.totalAmount);
    return list;
}

function _siRenderCustomerTable(code) {
    const list = _siCustomerStats(code);
    if (!list.length) return '';

    const activeCount = list.filter(c => c.gap !== null && c.gap < SI_WARN_WEEKS).length;

    const rowsHtml = list.map(c => {
        let badge;
        if (c.gap === null) {
            badge = `<span class="text-gray-300 text-xs">—</span>`;
        } else if (c.gap < SI_WARN_WEEKS) {
            badge = `<span class="bg-green-100 text-green-700 font-black px-2 py-0.5 rounded text-xs">${c.gap}w 🟢</span>`;
        } else if (c.gap < SI_DORMANT_WEEKS) {
            badge = `<span class="bg-yellow-100 text-yellow-700 font-black px-2 py-0.5 rounded text-xs">${c.gap}w 🟡</span>`;
        } else {
            badge = `<span class="bg-red-100 text-red-700 font-black px-2 py-0.5 rounded text-xs">${c.gap}w 🔴</span>`;
        }

        const cadenceLabel = c.cadence === null
            ? `<span class="text-gray-300">single order</span>`
            : `every ~${c.cadence.toFixed(1)} wks`;

        return `<tr class="border-b border-gray-100 hover:bg-teal-50/30">
            <td class="p-3 text-sm text-gray-800 font-bold whitespace-nowrap max-w-[240px] truncate" title="${c.name}">
                ${c.name}<span class="text-xs font-normal text-gray-400 ml-1">(${c.code})</span>
            </td>
            <td class="p-3 text-right font-mono font-black text-green-700 text-sm whitespace-nowrap">${_siFmtAmt(c.totalAmount)}</td>
            <td class="p-3 text-right font-mono text-sm text-gray-600 whitespace-nowrap">${c.totalQty.toLocaleString()} ${c.uom}</td>
            <td class="p-3 text-center text-sm text-gray-600">${c.orders}</td>
            <td class="p-3 text-center text-sm text-gray-600 whitespace-nowrap">${cadenceLabel}</td>
            <td class="p-3 text-center text-xs text-gray-400 whitespace-nowrap">${c.lastW || '—'}</td>
            <td class="p-3 text-center whitespace-nowrap">${badge}</td>
        </tr>`;
    }).join('');

    return `
        <div class="mt-8">
            <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 class="font-black text-gray-800 text-base flex items-center gap-2">
                    👥 Who orders this SKU
                    <span class="text-xs font-normal text-gray-400">all-time · ${list.length} customers · ${activeCount} active (last ${SI_WARN_WEEKS} wks)</span>
                </h3>
                <input type="text" placeholder="Filter customers..."
                    oninput="window._siFilterCustomers(this.value)"
                    class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 max-w-xs">
            </div>
            <div class="overflow-x-auto rounded-xl border border-gray-200 shadow-sm" style="max-height:480px;overflow-y:auto;">
                <table class="w-full text-left text-sm" id="siCustomerTable">
                    <thead class="bg-gray-50 border-b border-gray-200" style="position:sticky;top:0;z-index:2;">
                        <tr>
                            <th class="p-3 font-bold text-gray-600 text-xs">Customer</th>
                            <th class="p-3 text-right font-bold text-gray-600 text-xs">Total Amount</th>
                            <th class="p-3 text-right font-bold text-gray-600 text-xs">Total Qty</th>
                            <th class="p-3 text-center font-bold text-gray-600 text-xs">Orders</th>
                            <th class="p-3 text-center font-bold text-gray-600 text-xs">Avg Cadence</th>
                            <th class="p-3 text-center font-bold text-gray-600 text-xs">Last Order</th>
                            <th class="p-3 text-center font-bold text-gray-600 text-xs">Gap</th>
                        </tr>
                    </thead>
                    <tbody id="siCustomerTbody">${rowsHtml}</tbody>
                </table>
            </div>
            <p class="text-xs text-gray-400 mt-2">Cadence = average weeks between orders. Gap = weeks since last order (relative to ${window._siGlobalMaxWeek}).</p>
        </div>`;
}

window._siFilterCustomers = function(query) {
    const tbody = document.getElementById('siCustomerTbody');
    if (!tbody) return;
    const q = query.trim().toLowerCase();
    for (const tr of tbody.rows) {
        const txt = tr.cells[0]?.textContent.toLowerCase() || '';
        tr.style.display = (!q || txt.includes(q)) ? '' : 'none';
    }
};

// ==========================================
// Stack mode: compare multiple SKUs as a stacked 4-week chart
// ==========================================
function _siBuildStackData() {
    const isAmt = window._siMetric === 'amount';
    const valOf = r => isAmt ? (r.amount || 0) : (r.qty || 0);

    const maxWeekIdx   = _siWeekIndex(window._siGlobalMaxWeek);
    const latestBlock  = Math.floor(maxWeekIdx / SI_BLOCK_WEEKS);
    const weeksElapsed = (maxWeekIdx - latestBlock * SI_BLOCK_WEEKS) + 1;
    const latestIsEst  = weeksElapsed < SI_BLOCK_WEEKS && weeksElapsed > 0;

    const codeSet  = new Set(window._siStackSkus);
    const skuBlock = {};
    window._siStackSkus.forEach(c => { skuBlock[c] = {}; });
    let earliestBlock = latestBlock;
    for (const r of window._siAllRows) {
        if (!codeSet.has(r.sku_code)) continue;
        const b = _siBlockOf(r.week_start);
        skuBlock[r.sku_code][b] = (skuBlock[r.sku_code][b] || 0) + valOf(r);
        if (b < earliestBlock) earliestBlock = b;
    }

    const startBlock = window._siNumBlocks === 'all'
        ? earliestBlock
        : Math.max(earliestBlock, latestBlock - window._siNumBlocks + 1);

    const blockIdxs = [];
    for (let b = startBlock; b <= latestBlock; b++) blockIdxs.push(b);
    const labels = blockIdxs.map(b => _siBlockLabel(b));

    const perSku = window._siStackSkus.map(code => {
        const sku = window._siSkuList.find(s => s.code === code);
        const data = blockIdxs.map(b => {
            const actual = skuBlock[code][b] || 0;
            if (b === latestBlock && latestIsEst) return (actual / weeksElapsed) * SI_BLOCK_WEEKS;
            return actual;
        });
        return { code, name: sku ? sku.name : code, data };
    });

    return { labels, perSku, isAmt, latestIsEst, weeksElapsed, latestIdx: blockIdxs.length - 1 };
}

function _siRenderStackPanel() {
    const panel = document.getElementById('siSkuPanel');
    if (!panel) return;
    if (window._siChart) { window._siChart.destroy(); window._siChart = null; }

    if (!window._siStackSkus.length) {
        panel.innerHTML = `
            ${_siModeToggleHtml()}
            <div class="flex flex-col items-center justify-center py-24 text-center">
                <div class="text-5xl mb-4">📊</div>
                <p class="text-lg font-black text-gray-600 mb-1">Compare SKUs</p>
                <p class="text-sm text-gray-400">Use the search box above to add SKUs.<br>They stack into one 4-week trend so you can see the combined total.</p>
            </div>`;
        return;
    }

    const stack = _siBuildStackData();

    const chips = window._siStackSkus.map((code, i) => {
        const color = SI_PALETTE[i % SI_PALETTE.length];
        const sku   = window._siSkuList.find(s => s.code === code);
        const label = sku && sku.name !== sku.code ? sku.name : code;
        return `<span class="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full text-xs font-bold border" style="border-color:${color}40;background:${color}14;color:${color};">
            <span style="width:9px;height:9px;border-radius:50%;background:${color};display:inline-block;"></span>
            ${code}<span class="font-normal opacity-70 max-w-[120px] truncate">${label === code ? '' : '· ' + label}</span>
            <button onclick="siRemoveStackSku('${String(code).replace(/'/g, "\\'")}')" class="ml-0.5 w-4 h-4 rounded-full hover:bg-black/10 leading-none flex items-center justify-center" title="Remove">✕</button>
        </span>`;
    }).join('');

    panel.innerHTML = `
        ${_siModeToggleHtml()}
        <div class="mb-4 flex items-start justify-between flex-wrap gap-3">
            <div>
                <h2 class="text-xl font-black text-gray-800">Compare SKUs <span class="text-sm font-bold text-gray-400">(${window._siStackSkus.length})</span></h2>
                <p class="text-xs text-gray-400 mt-0.5">Stacked 4-week trend · Data up to: ${window._siGlobalMaxWeek}</p>
            </div>
            ${_siControlsHtml()}
        </div>

        <div class="flex items-center gap-2 flex-wrap mb-4">
            ${chips}
            <button onclick="siClearStack()" class="text-xs font-bold text-gray-400 hover:text-red-500 underline ml-1">Clear all</button>
        </div>

        <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div class="flex items-center justify-between mb-2">
                <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">Stacked 4-Week Sales ${stack.isAmt ? '(Amount)' : '(Quantity)'}</p>
                <span class="text-xs text-gray-400">${stack.latestIsEst ? 'Hatched = estimate (latest period projected to 4 wks)' : ''}</span>
            </div>
            <div style="position:relative;height:460px;">
                <canvas id="siStackChart"></canvas>
            </div>
            <p class="text-xs text-gray-400 mt-2">Each bar stacks the selected SKUs for one fixed 4-week period. Hover a segment for its value. The most recent period is projected to a full 4 weeks.</p>
        </div>
    `;

    _siRenderStackChart(stack);
}

function _siRenderStackChart(stack) {
    const ctx = document.getElementById('siStackChart');
    if (!ctx) return;

    const { labels, perSku, isAmt, latestIdx, latestIsEst, weeksElapsed } = stack;

    const datasets = perSku.map((sku, i) => {
        const color = SI_PALETTE[i % SI_PALETTE.length];
        const bg = sku.data.map((v, idx) =>
            (idx === latestIdx && latestIsEst) ? _siStripePatternFor(color) : color
        );
        return {
            label: sku.code,
            data: sku.data,
            backgroundColor: bg,
            stack: 's',
            borderColor: (latestIsEst ? sku.data.map((v, idx) => idx === latestIdx ? color : 'transparent') : 'transparent'),
            borderWidth: 1,
            borderRadius: 2,
            borderSkipped: false
        };
    });

    // Per-period totals for the top label
    const totals = labels.map((_, idx) => perSku.reduce((s, sku) => s + sku.data[idx], 0));

    window._siChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        plugins: [{
            id: 'siStackTotals',
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                labels.forEach((_, idx) => {
                    if (!totals[idx]) return;
                    let topY = Infinity;
                    chart.data.datasets.forEach((_, d) => {
                        const bar = chart.getDatasetMeta(d).data[idx];
                        if (bar && bar.y < topY) topY = bar.y;
                    });
                    const x = chart.getDatasetMeta(0).data[idx].x;
                    ctx.save();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillStyle = '#374151';
                    ctx.font = 'bold 12px sans-serif';
                    ctx.fillText(_siFmtShort(totals[idx], isAmt), x, topY - 6);
                    if (latestIsEst && idx === latestIdx) {
                        ctx.fillStyle = '#0d9488';
                        ctx.font = '10px sans-serif';
                        ctx.fillText('est. (' + weeksElapsed + '/4 wk)', x, topY - 21);
                    }
                    ctx.restore();
                });
            }
        }],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 34 } },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: item => {
                            const v = item.parsed.y;
                            const val = isAmt ? _siFmtAmt(v) : (v.toLocaleString() + ' units');
                            const est = (latestIsEst && item.dataIndex === latestIdx) ? ' (est.)' : '';
                            return `${item.dataset.label}: ${val}${est}`;
                        },
                        footer: items => {
                            const sum = items.reduce((s, it) => s + it.parsed.y, 0);
                            return 'Total: ' + (isAmt ? _siFmtAmt(sum) : sum.toLocaleString() + ' units');
                        }
                    }
                }
            },
            scales: {
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: { font: { size: 12 }, callback: v => isAmt ? _siFmtShort(v, true) : v.toLocaleString() },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    stacked: true,
                    ticks: { font: { size: 11 } },
                    grid: { display: false }
                }
            }
        }
    });
}
