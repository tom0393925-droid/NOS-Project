// ==========================================
// js/ui_customer_insights.js: Customer Insights tab
// ==========================================

window._ciRawData      = [];   // raw rows from Supabase
window._ciSelectedCode = null; // currently selected customer_code

const CI_WARN_WEEKS   = 4;
const CI_DORMANT_WEEKS = 8;

// ==========================================
// Entry: load data from Supabase and init tab
// ==========================================
async function initCustomerInsights() {
    const placeholder = document.getElementById('ciPlaceholder');
    const content     = document.getElementById('ciContent');
    if (placeholder) placeholder.style.display = 'none';
    if (content)     content.style.display = 'block';

    try {
        window._ciRawData = await sbLoadClientSkuOrders();
    } catch (e) {
        if (placeholder) { placeholder.style.display = 'block'; placeholder.textContent = 'Failed to load data: ' + e.message; }
        if (content) content.style.display = 'none';
        return;
    }

    if (!window._ciRawData.length) {
        if (placeholder) { placeholder.style.display = 'block'; placeholder.textContent = 'No data yet. Import a Sales By Item (Customer) Excel file.'; }
        if (content) content.style.display = 'none';
        return;
    }

    renderCiClientDropdown();
}

// ==========================================
// Build client dropdown from raw data
// ==========================================
function renderCiClientDropdown() {
    const select = document.getElementById('ciClientSelect');
    if (!select) return;

    // Collect unique customers (code → name)
    const clients = {};
    for (const row of window._ciRawData) {
        clients[row.customer_code] = row.customer_name;
    }

    const sorted = Object.entries(clients).sort((a, b) => a[1].localeCompare(b[1]));
    const prev = select.value;

    select.innerHTML = '<option value="">-- Select Client --</option>';
    for (const [code, name] of sorted) {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = `${name} (${code})`;
        select.appendChild(opt);
    }

    if (prev && clients[prev]) select.value = prev;
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

    panel.innerHTML = `
        <div class="mb-6">
            <h2 class="text-xl font-black text-gray-800">${customerName}</h2>
            <p class="text-xs text-gray-400 mt-0.5">Code: ${customerCode} &nbsp;|&nbsp; Data up to: ${latestWeek} &nbsp;|&nbsp; ${activeSkus.length} active SKUs, ${dormantSkus.length} dormant</p>
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
    const fmtAmt = v => '$' + v.toFixed(2);

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
            <td class="p-3 text-right font-mono text-sm text-gray-500">$${sku.totalAmount.toFixed(2)}</td>
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
