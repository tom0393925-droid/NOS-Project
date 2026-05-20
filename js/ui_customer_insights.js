// ==========================================
// js/ui_customer_insights.js: Customer Insights tab
// ==========================================

window._ciRawData      = [];   // raw rows from Supabase
window._ciSelectedCode = null; // currently selected customer_code

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

    if (!customerCode) { panel.innerHTML = ''; return; }

    const rows = window._ciRawData.filter(r => r.customer_code === customerCode);
    if (!rows.length) { panel.innerHTML = '<p class="text-gray-400 text-center py-10">No data for this client.</p>'; return; }

    // All unique week_end dates, sorted ascending
    const allWeeks = [...new Set(rows.map(r => r.week_end))].sort();
    const latestWeek = allWeeks[allWeeks.length - 1];
    const latestDate = new Date(latestWeek);

    // Aggregate per SKU: { sku_code → { name, totalAmount, totalQty, weekMap: {week_end → {qty,amount}} } }
    const skuMap = {};
    for (const row of rows) {
        if (!skuMap[row.sku_code]) {
            skuMap[row.sku_code] = { totalAmount: 0, totalQty: 0, weekMap: {} };
        }
        skuMap[row.sku_code].totalAmount += row.amount;
        skuMap[row.sku_code].totalQty    += row.qty;
        skuMap[row.sku_code].weekMap[row.week_end] = { qty: row.qty, amount: row.amount };
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

    const customerName = rows[0].customer_name;

    // Show last N weeks as column headers (up to 12)
    const displayWeeks = allWeeks.slice(-12);

    // ==========================================
    // KPI calculations
    // ==========================================
    const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);

    const last4Weeks = allWeeks.slice(-4);
    const prev4Weeks = allWeeks.slice(-8, -4);
    const last4Total = rows.filter(r => last4Weeks.includes(r.week_end)).reduce((sum, r) => sum + r.amount, 0);
    const prev4Total = rows.filter(r => prev4Weeks.includes(r.week_end)).reduce((sum, r) => sum + r.amount, 0);

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

        <!-- Active SKUs -->
        <div class="mb-8">
            <h3 class="font-black text-green-700 text-base mb-3 flex items-center gap-2">
                ✅ Active SKUs
                <span class="text-xs font-normal text-gray-400">ordered within last ${CI_WARN_WEEKS} weeks · sorted by total amount</span>
            </h3>
            ${activeSkus.length === 0
                ? '<p class="text-gray-400 text-sm">No active SKUs in the last ' + CI_WARN_WEEKS + ' weeks.</p>'
                : _renderCiSkuTable(activeSkus, displayWeeks, false)
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
