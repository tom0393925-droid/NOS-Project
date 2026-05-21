// ==========================================
// js/ui_customer_insights.js: Customer Insights tab
// ==========================================

window._ciRawData       = [];    // raw rows from Supabase
window._ciSelectedCode  = null;  // currently selected customer_code
window._ciChart         = null;  // Chart.js instance (bar)
window._ciDonutChart    = null;  // Chart.js instance (donut)
window._ciPeriod        = '12w'; // '4w' | '12w' | 'all'
window._ciAllSkuEntries = [];    // all SKU entries for the current client
window._ciAllWeeks      = [];    // all week_start dates for the current client

const _ciFormatAmt = v => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });


const CI_WARN_WEEKS   = 4;
const CI_DORMANT_WEEKS = 8;

// ==========================================
// Entry: load data from Supabase and init tab
// ==========================================
async function initCustomerInsights() {
    const placeholder = document.getElementById('ciPlaceholder');
    const content     = document.getElementById('ciContent');

    if (placeholder) placeholder.style.display = 'flex';
    if (content)     content.style.display = 'none';

    // Show loading spinner
    if (placeholder) placeholder.innerHTML = `
        <div class="flex flex-col items-center justify-center gap-3">
            <svg class="animate-spin h-10 w-10 text-teal-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
            <p class="text-sm font-bold text-gray-400">Loading client data...</p>
        </div>`;

    // Load SKU master if not yet populated (e.g. Analytics tab hasn't been opened)
    if (typeof skuMaster !== 'undefined' && Object.keys(skuMaster).length === 0) {
        try {
            const masterData = await sbLoadSkuMaster();
            skuMaster = masterData;
        } catch (e) {
            console.warn('[CI] skuMaster load failed:', e);
        }
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

    window._ciRawData = rows;

    if (!rows.length) {
        // Restore "no data" message
        if (placeholder) placeholder.innerHTML = `
            <div class="text-5xl mb-4">👥</div>
            <p class="text-xl font-black text-gray-700 mb-2">No data yet</p>
            <p class="text-sm text-gray-500">Go to <strong class="text-teal-700">⚙️ Data Setup</strong> and upload a <em>Sales By Item (Customer)</em> Excel file.</p>`;
        return;
    }

    console.log('[CI] Showing content');
    if (placeholder) placeholder.style.display = 'none';
    if (content)     content.style.display = 'block';

    try {
        renderCiClientDropdown();
        renderCiContent(''); // show prompt message on initial load
    } catch (e) {
        console.error('[CI] renderCiClientDropdown failed:', e);
        if (content) {
            const errEl = document.createElement('p');
            errEl.className = 'text-red-500 text-sm font-bold bg-red-50 px-4 py-2 rounded-lg border border-red-200 mb-4';
            errEl.textContent = 'Dropdown build error: ' + (e.message || String(e));
            content.insertBefore(errEl, content.firstChild);
        }
    }
}

// ==========================================
// Build client list for search combobox
// ==========================================
window._ciClients = []; // [{code, name}]

function renderCiClientDropdown() {
    const clientMap = {};
    for (const row of window._ciRawData) {
        clientMap[row.customer_code] = row.customer_name;
    }
    window._ciClients = Object.entries(clientMap)
        .map(([code, name]) => ({ code, name: name || '' }))
        .sort((a, b) => a.name.localeCompare(b.name));

    // Close dropdown when clicking outside
    document.addEventListener('click', e => {
        const wrapper = document.getElementById('ciSearchWrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            const dd = document.getElementById('ciClientDropdown');
            if (dd) dd.classList.add('hidden');
        }
    }, { capture: true });
}

function ciFilterClients(query) {
    const dd = document.getElementById('ciClientDropdown');
    if (!dd) return;

    const q = query.trim().toLowerCase();
    const matches = q
        ? window._ciClients.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
        : window._ciClients;

    if (!matches.length) {
        dd.innerHTML = '<p class="px-4 py-3 text-sm text-gray-400">No clients found.</p>';
        dd.classList.remove('hidden');
        return;
    }

    dd.innerHTML = matches.map(c => `
        <div class="px-4 py-2.5 text-sm cursor-pointer hover:bg-teal-50 hover:text-teal-700 font-bold border-b border-gray-50 last:border-0"
             onmousedown="ciSelectClient('${c.code}')">
            ${c.name}
            <span class="text-xs font-normal text-gray-400 ml-1">(${c.code})</span>
        </div>`).join('');
    dd.classList.remove('hidden');
}

function ciClearSearch() {
    const input = document.getElementById('ciClientSearch');
    const dd    = document.getElementById('ciClientDropdown');
    if (input) input.value = '';
    if (dd)    dd.classList.add('hidden');
    renderCiContent('');
}

function ciSelectClient(code) {
    const input  = document.getElementById('ciClientSearch');
    const dd     = document.getElementById('ciClientDropdown');
    const client = window._ciClients.find(c => c.code === code);
    if (input) input.value = client ? client.name + ' (' + code + ')' : code;
    if (dd)    dd.classList.add('hidden');
    renderCiContent(code);
}

// ==========================================
// Render main content for selected client
// ==========================================
function renderCiContent(customerCode) {
    window._ciSelectedCode = customerCode;

    const panel = document.getElementById('ciClientPanel');
    if (!panel) return;

    if (!customerCode) {
        if (window._ciChart)      { window._ciChart.destroy();      window._ciChart      = null; }
        if (window._ciDonutChart) { window._ciDonutChart.destroy(); window._ciDonutChart = null; }
        window._ciAllSkuEntries = [];
        window._ciAllWeeks      = [];
        panel.innerHTML = `
            <div class="flex flex-col items-center justify-center py-24 text-center">
                <div class="text-5xl mb-4">🔍</div>
                <p class="text-lg font-black text-gray-600 mb-1">Select a Client</p>
                <p class="text-sm text-gray-400">Type a client name in the search box above<br>to view purchase data.</p>
            </div>`;
        return;
    }

    const rows = window._ciRawData.filter(r => r.customer_code === customerCode);
    if (!rows.length) { panel.innerHTML = '<p class="text-gray-400 text-center py-10">No data for this client.</p>'; return; }

    // All weeks from first to last, filling gaps with zero (7-day steps)
    const dataWeeks = [...new Set(rows.map(r => r.week_start))].sort();
    const allWeeks = [];
    if (dataWeeks.length) {
        const end = new Date(dataWeeks[dataWeeks.length - 1]);
        for (let d = new Date(dataWeeks[0]); d <= end; d.setDate(d.getDate() + 7)) {
            allWeeks.push(d.toISOString().slice(0, 10));
        }
    }
    const latestWeek = allWeeks[allWeeks.length - 1];
    const latestDate = new Date(latestWeek);

    // Aggregate per SKU: { sku_code → { name, totalAmount, totalQty, weekMap: {week_start → {qty,amount}} } }
    const skuMap = {};
    for (const row of rows) {
        if (!skuMap[row.sku_code]) {
            skuMap[row.sku_code] = { totalAmount: 0, totalQty: 0, weekMap: {} };
        }
        skuMap[row.sku_code].totalAmount += row.amount;
        skuMap[row.sku_code].totalQty    += row.qty;
        skuMap[row.sku_code].weekMap[row.week_start] = { qty: row.qty, amount: row.amount };
    }

    // Determine last order date and status per SKU
    const activeSkus  = [];
    const dormantSkus = [];

    for (const [code, data] of Object.entries(skuMap)) {
        const orderedWeeks = allWeeks.filter(w => (data.weekMap[w]?.qty || 0) > 0);
        const lastWeek = orderedWeeks.length ? orderedWeeks[orderedWeeks.length - 1] : null;
        const weeksSince = lastWeek
            ? Math.round((latestDate - new Date(lastWeek)) / (7 * 24 * 3600 * 1000))
            : 999;

        const skuName = (typeof skuMaster !== 'undefined' && skuMaster[code]?.name) || code;

        const entry = { code, name: skuName, totalAmount: data.totalAmount, totalQty: data.totalQty, lastWeek, weeksSince, weekMap: data.weekMap };

        if (weeksSince < CI_WARN_WEEKS) {
            activeSkus.push(entry);
        } else {
            dormantSkus.push(entry);
        }
    }

    activeSkus.sort((a, b)  => b.totalAmount - a.totalAmount);
    dormantSkus.sort((a, b) => a.weeksSince  - b.weeksSince);

    // Store for period-switching (reset to default 12w on every client change)
    window._ciPeriod        = '12w';
    window._ciAllSkuEntries = [...activeSkus, ...dormantSkus];
    window._ciAllWeeks      = allWeeks;

    const customerName = rows[0].customer_name;

    // Show last N weeks as column headers (up to 12)
    const displayWeeks = allWeeks.slice(-12);

    // ==========================================
    // KPI calculations
    // ==========================================
    const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);

    // Weekly totals for bar chart
    const weeklyTotals = {};
    const weeklySkuCounts = {};
    for (const row of rows) {
        weeklyTotals[row.week_start] = (weeklyTotals[row.week_start] || 0) + row.amount;
        weeklySkuCounts[row.week_start] = (weeklySkuCounts[row.week_start] || 0) + 1;
    }

    const last4Weeks = allWeeks.slice(-4);
    const prev4Weeks = allWeeks.slice(-8, -4);
    const last4Total = rows.filter(r => last4Weeks.includes(r.week_start)).reduce((sum, r) => sum + r.amount, 0);
    const prev4Total = rows.filter(r => prev4Weeks.includes(r.week_start)).reduce((sum, r) => sum + r.amount, 0);

    let trendCardHtml;
    if (prev4Weeks.length === 0) {
        trendCardHtml = `
            <p class="text-2xl font-black text-gray-400">—</p>
            <p class="text-xs text-gray-400 mt-1">Not enough data</p>`;
    } else if (prev4Total === 0) {
        trendCardHtml = `
            <p class="text-2xl font-black text-blue-500">NEW</p>
            <p class="text-xs text-gray-400 mt-1">No orders in prev 4 wks</p>`;
    } else {
        const trendPct = (last4Total - prev4Total) / prev4Total * 100;
        const isUp = trendPct >= 0;
        const color  = isUp ? 'text-green-600' : 'text-red-500';
        const arrow  = isUp ? '↑' : '↓';
        trendCardHtml = `
            <p class="text-2xl font-black ${color}">${arrow} ${Math.abs(trendPct).toFixed(1)}%</p>
            <p class="text-xs text-gray-400 mt-1">vs prev 4 wks (${_ciFormatAmt(prev4Total)} → ${_ciFormatAmt(last4Total)})</p>`;
    }
    const trendBorder = (prev4Total > 0 && last4Total >= prev4Total) ? 'border-l-green-500' : (prev4Total > 0 ? 'border-l-red-400' : 'border-l-gray-300');

    panel.innerHTML = `
        <div class="mb-5">
            <h2 class="text-xl font-black text-gray-800">${customerName}</h2>
            <p class="text-xs text-gray-400 mt-0.5">Code: ${customerCode} &nbsp;|&nbsp; Data up to: ${latestWeek}</p>
        </div>

        <!-- KPI Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-indigo-400">
                <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Last 4 Weeks</p>
                <p class="text-2xl font-black text-gray-800">${_ciFormatAmt(last4Total)}</p>
                <p class="text-xs text-gray-400 mt-1">${last4Weeks.length ? last4Weeks[0].slice(5) + ' – ' + last4Weeks[last4Weeks.length - 1].slice(5) : '—'}</p>
            </div>
            <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-green-500">
                <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Active SKUs</p>
                <p class="text-2xl font-black text-green-600">${activeSkus.length}
                    <span class="text-sm font-bold text-gray-300 ml-1">/ ${activeSkus.length + dormantSkus.length}</span>
                </p>
                <p class="text-xs text-gray-400 mt-1">ordered within last ${CI_WARN_WEEKS} wks &nbsp;|&nbsp; <span class="text-red-400 font-bold">${dormantSkus.length} dormant</span></p>
            </div>
            <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm border-l-4 ${trendBorder}">
                <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">4-Week Trend</p>
                ${trendCardHtml}
            </div>
        </div>

        <!-- Charts Row: Trend + Donut -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8" style="height:440px;">
            <div class="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5 h-full flex flex-col">
                <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Weekly Purchase Trend</p>
                <div class="flex-1 min-h-0" style="position:relative;">
                    <canvas id="ciTrendChart"></canvas>
                </div>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5 h-full flex flex-col overflow-hidden">
                <div class="flex items-center justify-between mb-3">
                    <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">SKU Mix</p>
                    <div class="flex gap-1">
                        <button id="ciTabBtn4w"  onclick="ciSetDonutPeriod('4w')"  class="px-2 py-1 text-xs font-bold rounded text-gray-400 hover:bg-gray-100 transition-colors">4 Wks</button>
                        <button id="ciTabBtn12w" onclick="ciSetDonutPeriod('12w')" class="px-2 py-1 text-xs font-bold rounded bg-teal-500 text-white">12 Wks</button>
                        <button id="ciTabBtnall" onclick="ciSetDonutPeriod('all')" class="px-2 py-1 text-xs font-bold rounded text-gray-400 hover:bg-gray-100 transition-colors">All</button>
                    </div>
                </div>
                <div style="position:relative;height:200px;">
                    <canvas id="ciDonutChart"></canvas>
                </div>
                <div id="ciDonutList" class="mt-3 space-y-1.5 overflow-y-auto flex-1 min-h-0"></div>
            </div>
        </div>

        <!-- Active SKUs -->
        <div class="mb-8">
            <h3 class="font-black text-green-700 text-base mb-3 flex items-center gap-2">
                ✅ Active SKUs
                <span class="text-xs font-normal text-gray-400">ordered within last ${CI_WARN_WEEKS} weeks · sorted by total amount</span>
            </h3>
            ${activeSkus.length === 0
                ? '<p class="text-gray-400 text-sm">No active SKUs in the last ' + CI_WARN_WEEKS + ' weeks.</p>'
                : _renderCiSkuHeatmap(activeSkus, displayWeeks)
            }
        </div>

        <!-- Dormant SKUs -->
        <div>
            <h3 class="font-black text-red-600 text-base mb-3 flex items-center gap-2">
                ⚠️ Dormant SKUs
                <span class="text-xs font-normal text-gray-400">no order for ${CI_WARN_WEEKS}+ weeks</span>
            </h3>
            ${dormantSkus.length === 0
                ? '<p class="text-gray-400 text-sm">No dormant SKUs.</p>'
                : _renderCiDormantTable(dormantSkus)
            }
        </div>
    `;

    // Initialize charts (must run after innerHTML is set)
    if (window._ciChart)      { window._ciChart.destroy();      window._ciChart      = null; }
    if (window._ciDonutChart) { window._ciDonutChart.destroy(); window._ciDonutChart = null; }
    const ctx = document.getElementById('ciTrendChart');
    if (ctx) {
        window._ciChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: allWeeks.map(w => w.slice(5)),
                datasets: [{
                    data: allWeeks.map(w => weeklyTotals[w] || 0),
                    backgroundColor: allWeeks.map(w =>
                        last4Weeks.includes(w) ? 'rgba(20,184,166,0.85)' : 'rgba(20,184,166,0.3)'
                    ),
                    borderRadius: 4,
                    borderSkipped: false,
                }]
            },
            plugins: [{
                id: 'ciBarLabels',
                afterDatasetsDraw(chart) {
                    const { ctx } = chart;
                    chart.getDatasetMeta(0).data.forEach((bar, i) => {
                        const val = chart.data.datasets[0].data[i];
                        if (!val) return;
                        const amtLabel = val >= 1000 ? '$' + (val / 1000).toFixed(1) + 'k' : '$' + val.toFixed(0);
                        const skuCount = weeklySkuCounts[allWeeks[i]] || 0;
                        ctx.save();
                        ctx.textAlign = 'center';
                        ctx.fillStyle = '#374151';
                        ctx.font = 'bold 13px sans-serif';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(amtLabel, bar.x, bar.y - 20);
                        ctx.fillStyle = '#6b7280';
                        ctx.font = '11px sans-serif';
                        ctx.fillText(skuCount + ' SKUs', bar.x, bar.y - 5);
                        ctx.restore();
                    });
                }
            }],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 40 } },
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            font: { size: 12 },
                            callback: v => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)
                        },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    x: {
                        ticks: { font: { size: 12 } },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    _ciRenderDonut('12w');
}

function _renderCiSkuTable(skus, displayWeeks, isDormant) {
    const fmtAmt = _ciFormatAmt;

    const headerCols = displayWeeks.map(w => `<th class="p-2 text-center text-xs font-bold text-gray-500 whitespace-nowrap">${w.slice(5)}</th>`).join('');

    const rows = skus.map(sku => {
        const weekCols = displayWeeks.map(w => {
            const amt = sku.weekMap[w]?.amount || 0;
            const bg  = amt > 0 ? 'bg-green-50 text-green-700 font-bold' : 'text-gray-300';
            return `<td class="p-2 text-right text-xs font-mono ${bg}">${amt > 0 ? fmtAmt(amt) : '-'}</td>`;
        }).join('');

        return `<tr class="border-b border-gray-100 hover:bg-slate-50">
            <td class="p-3 font-bold text-indigo-700 text-sm whitespace-nowrap">${sku.code}</td>
            <td class="p-3 text-sm text-gray-700 max-w-[200px] truncate" title="${sku.name}">${sku.name}</td>
            <td class="p-3 text-right font-mono font-black text-green-700 text-sm">${fmtAmt(sku.totalAmount)}</td>
            ${weekCols}
            <td class="p-3 text-center text-xs text-gray-400">${sku.lastWeek || '-'}</td>
        </tr>`;
    }).join('');

    return `<div class="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table class="w-full text-left text-sm">
            <thead class="bg-gray-50 border-b border-gray-200">
                <tr>
                    <th class="p-3 font-bold text-gray-600 text-xs">SKU</th>
                    <th class="p-3 font-bold text-gray-600 text-xs">Item Name</th>
                    <th class="p-3 text-right font-bold text-gray-600 text-xs">Total Amount</th>
                    ${headerCols}
                    <th class="p-3 text-center font-bold text-gray-600 text-xs">Last Order</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    </div>`;
}

function _renderCiDormantTable(skus) {
    const rows = skus.map(sku => {
        const badge = sku.weeksSince >= CI_DORMANT_WEEKS
            ? `<span class="bg-red-100 text-red-700 font-black px-2 py-0.5 rounded text-xs">${sku.weeksSince}w 🔴</span>`
            : `<span class="bg-yellow-100 text-yellow-700 font-black px-2 py-0.5 rounded text-xs">${sku.weeksSince}w 🟡</span>`;

        return `<tr class="border-b border-gray-100 hover:bg-red-50/20">
            <td class="p-3 font-bold text-indigo-700 text-sm">${sku.code}</td>
            <td class="p-3 text-sm text-gray-700 max-w-[250px] truncate" title="${sku.name}">${sku.name}</td>
            <td class="p-3 text-right font-mono text-sm text-gray-500">${_ciFormatAmt(sku.totalAmount)}</td>
            <td class="p-3 text-center text-xs text-gray-500">${sku.lastWeek || 'Never'}</td>
            <td class="p-3 text-center">${badge}</td>
        </tr>`;
    }).join('');

    return `<div class="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table class="w-full text-left text-sm">
            <thead class="bg-gray-50 border-b border-gray-200">
                <tr>
                    <th class="p-3 font-bold text-gray-600 text-xs">SKU</th>
                    <th class="p-3 font-bold text-gray-600 text-xs">Item Name</th>
                    <th class="p-3 text-right font-bold text-gray-600 text-xs">Cumulative Amount</th>
                    <th class="p-3 text-center font-bold text-gray-600 text-xs">Last Order</th>
                    <th class="p-3 text-center font-bold text-gray-600 text-xs">Gap</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    </div>`;
}

function _renderCiSkuHeatmap(skus, displayWeeks) {
    let maxAmt = 0;
    for (const sku of skus) {
        for (const w of displayWeeks) {
            const a = sku.weekMap[w]?.amount || 0;
            if (a > maxAmt) maxAmt = a;
        }
    }

    const headerCols = displayWeeks.map(w =>
        `<th class="p-2 text-center text-xs font-bold text-gray-500 whitespace-nowrap">${w.slice(5)}</th>`
    ).join('');

    const HEAT_LEVELS = [
        { maxRatio: 0.33, alpha: '0.20', textColor: '#0f766e', label: 'Low'  },
        { maxRatio: 0.66, alpha: '0.50', textColor: '#0f766e', label: 'Mid'  },
        { maxRatio: 1.00, alpha: '0.82', textColor: '#fff',    label: 'High' },
    ];

    const tableRows = skus.map(sku => {
        const weekCols = displayWeeks.map(w => {
            const amt = sku.weekMap[w]?.amount || 0;
            if (amt === 0) {
                return `<td class="p-2 text-center text-xs text-gray-200" style="background:rgba(0,0,0,0.02)">—</td>`;
            }
            const ratio = maxAmt > 0 ? amt / maxAmt : 1;
            const tier  = HEAT_LEVELS.find(l => ratio <= l.maxRatio) || HEAT_LEVELS[2];
            const label = amt >= 1000 ? '$' + (amt / 1000).toFixed(1) + 'k' : '$' + amt.toFixed(0);
            return `<td class="p-2 text-center text-xs font-bold whitespace-nowrap" style="background:rgba(20,184,166,${tier.alpha});color:${tier.textColor};">${label}</td>`;
        }).join('');

        return `<tr class="border-b border-gray-100 hover:bg-slate-50">
            <td class="p-3 font-bold text-indigo-700 text-sm whitespace-nowrap">${sku.code}</td>
            <td class="p-3 text-sm text-gray-700 max-w-[180px] truncate" title="${sku.name}">${sku.name}</td>
            <td class="p-3 text-right font-mono font-black text-green-700 text-sm whitespace-nowrap">${_ciFormatAmt(sku.totalAmount)}</td>
            ${weekCols}
            <td class="p-3 text-center text-xs text-gray-400 whitespace-nowrap">${sku.lastWeek || '—'}</td>
        </tr>`;
    }).join('');

    const maxLabel = maxAmt >= 1000 ? '$' + (maxAmt / 1000).toFixed(1) + 'k' : '$' + maxAmt.toFixed(0);
    const legend = `
        <div class="flex items-center gap-4 px-1 pb-2 flex-wrap">
            <span class="text-xs text-gray-400 font-semibold">Shade:</span>
            <span class="flex items-center gap-1 text-xs text-gray-500">
                <span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:rgba(0,0,0,0.06);border:1px solid #e5e7eb;"></span> No order
            </span>
            ${HEAT_LEVELS.map(l => `
            <span class="flex items-center gap-1 text-xs text-gray-500">
                <span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:rgba(20,184,166,${l.alpha});"></span> ${l.label}
            </span>`).join('')}
            <span class="text-xs text-gray-400 ml-2">— relative to table max <span class="font-bold text-gray-600">${maxLabel}</span> · Dates = week start</span>
        </div>`;

    return `<div>
        ${legend}
        <div class="mb-2">
            <input
                type="text"
                placeholder="Search by SKU or item name..."
                oninput="window._ciFilterHeatmap(this.value)"
                class="w-full max-w-xs px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
        </div>
        <div class="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table class="w-full text-left text-sm" id="ci-heatmap-table">
            <thead class="bg-gray-50 border-b border-gray-200">
                <tr>
                    <th class="p-3 font-bold text-gray-600 text-xs">SKU</th>
                    <th class="p-3 font-bold text-gray-600 text-xs">Item Name</th>
                    <th class="p-3 text-right font-bold text-gray-600 text-xs">Total</th>
                    ${headerCols}
                    <th class="p-3 text-center font-bold text-gray-600 text-xs">Last Order</th>
                </tr>
            </thead>
            <tbody id="ci-heatmap-tbody">${tableRows}</tbody>
        </table>
        </div>
    </div>`;
}

window._ciFilterHeatmap = function(query) {
    const tbody = document.getElementById('ci-heatmap-tbody');
    if (!tbody) return;
    const q = query.trim().toLowerCase();
    for (const tr of tbody.rows) {
        const sku  = tr.cells[0]?.textContent.toLowerCase() || '';
        const name = tr.cells[1]?.textContent.toLowerCase() || '';
        tr.style.display = (!q || sku.includes(q) || name.includes(q)) ? '' : 'none';
    }
};

// ==========================================
// Donut chart: period-based rendering
// ==========================================
function ciSetDonutPeriod(period) {
    window._ciPeriod = period;
    _ciRenderDonut(period);
}

function _ciRenderDonut(period) {
    const allSkus  = window._ciAllSkuEntries || [];
    const allWeeks = window._ciAllWeeks || [];
    if (!allSkus.length) return;

    const periodWeeks = period === '4w'  ? allWeeks.slice(-4)
                      : period === '12w' ? allWeeks.slice(-12)
                      :                    allWeeks;
    const periodLabel = period === '4w'  ? 'Last 4 Wks'
                      : period === '12w' ? 'Last 12 Wks'
                      :                   'All Time';

    // Compute period amount per SKU; drop SKUs with 0 in this period
    const skuPeriodData = allSkus
        .map(sku => ({
            ...sku,
            periodAmount: periodWeeks.reduce((sum, w) => sum + (sku.weekMap[w]?.amount || 0), 0)
        }))
        .filter(sku => sku.periodAmount > 0)
        .sort((a, b) => b.periodAmount - a.periodAmount);

    const listEl = document.getElementById('ciDonutList');

    if (!skuPeriodData.length) {
        if (window._ciDonutChart) { window._ciDonutChart.destroy(); window._ciDonutChart = null; }
        if (listEl) listEl.innerHTML = '<p class="text-xs text-gray-400 text-center py-2">No orders in this period.</p>';
        _ciUpdateDonutTabs(period);
        return;
    }

    const grandTotal = skuPeriodData.reduce((s, x) => s + x.periodAmount, 0);
    const TOP_N      = 7;
    const topSkus    = skuPeriodData.slice(0, TOP_N);
    const restTotal  = skuPeriodData.slice(TOP_N).reduce((s, x) => s + x.periodAmount, 0);

    const donutLabels = topSkus.map(s => s.code);
    const donutData   = topSkus.map(s => s.periodAmount);
    if (restTotal > 0) { donutLabels.push('Others'); donutData.push(restTotal); }

    const palette = [
        'rgba(20,184,166,0.85)', 'rgba(45,212,191,0.85)', 'rgba(13,148,136,0.85)',
        'rgba(94,234,212,0.85)', 'rgba(15,118,110,0.85)', 'rgba(153,246,228,0.85)',
        'rgba(17,94,89,0.85)',   'rgba(156,163,175,0.75)'
    ];

    const centerPlugin = {
        id: 'ciDonutCenter',
        beforeDraw(chart) {
            const { ctx, chartArea: { left, top, width, height } } = chart;
            const cx = left + width / 2;
            const cy = top + height / 2;
            const gt = chart._ciGrandTotal || 0;
            const pl = chart._ciPeriodLabel || '';
            const totalLabel = gt >= 1000 ? '$' + (gt / 1000).toFixed(1) + 'k' : '$' + gt.toFixed(0);
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#1f2937';
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText(totalLabel, cx, cy - 9);
            ctx.fillStyle = '#9ca3af';
            ctx.font = '10px sans-serif';
            ctx.fillText(pl, cx, cy + 9);
            ctx.restore();
        }
    };

    if (window._ciDonutChart) {
        // Update in place for smooth animation
        const ch = window._ciDonutChart;
        ch._ciGrandTotal  = grandTotal;
        ch._ciPeriodLabel = periodLabel;
        ch.data.labels = donutLabels;
        ch.data.datasets[0].data = donutData;
        ch.data.datasets[0].backgroundColor = palette.slice(0, donutData.length);
        ch.options.plugins.tooltip.callbacks.label = c => {
            const pct = (c.parsed / grandTotal * 100).toFixed(1);
            return `${_ciFormatAmt(c.parsed)}  (${pct}%)`;
        };
        ch.update();
    } else {
        const donutCtx = document.getElementById('ciDonutChart');
        if (donutCtx) {
            window._ciDonutChart = new Chart(donutCtx, {
                type: 'doughnut',
                data: {
                    labels: donutLabels,
                    datasets: [{
                        data: donutData,
                        backgroundColor: palette.slice(0, donutData.length),
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                plugins: [centerPlugin],
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '62%',
                    animation: { duration: 500, easing: 'easeInOutQuart' },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: c => {
                                    const pct = (c.parsed / grandTotal * 100).toFixed(1);
                                    return `${_ciFormatAmt(c.parsed)}  (${pct}%)`;
                                }
                            }
                        }
                    }
                }
            });
            window._ciDonutChart._ciGrandTotal  = grandTotal;
            window._ciDonutChart._ciPeriodLabel = periodLabel;
        }
    }

    // Custom list below the chart
    if (listEl) {
        listEl.innerHTML = skuPeriodData.map((sku, i) => {
            const color = palette[Math.min(i, palette.length - 1)];
            const pct   = (sku.periodAmount / grandTotal * 100).toFixed(1);
            return `<div class="flex items-center gap-2 text-xs py-0.5">
                <span style="width:10px;height:10px;border-radius:2px;background:${color};flex-shrink:0;display:inline-block;"></span>
                <span class="font-bold text-indigo-700 whitespace-nowrap">${sku.code}</span>
                <span class="text-gray-500 truncate flex-1" title="${sku.name}">${sku.name}</span>
                <span class="font-mono font-bold text-gray-700 whitespace-nowrap">${_ciFormatAmt(sku.periodAmount)}</span>
                <span class="text-gray-400 whitespace-nowrap w-11 text-right">${pct}%</span>
            </div>`;
        }).join('');
    }

    _ciUpdateDonutTabs(period);
}

function _ciUpdateDonutTabs(period) {
    const active   = 'px-2 py-1 text-xs font-bold rounded bg-teal-500 text-white';
    const inactive = 'px-2 py-1 text-xs font-bold rounded text-gray-400 hover:bg-gray-100 transition-colors';
    const map = { '4w': 'ciTabBtn4w', '12w': 'ciTabBtn12w', 'all': 'ciTabBtnall' };
    for (const [key, id] of Object.entries(map)) {
        const btn = document.getElementById(id);
        if (btn) btn.className = key === period ? active : inactive;
    }
}
