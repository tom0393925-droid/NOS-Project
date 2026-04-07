// ==========================================
// js/ui_analytics.js: Analytics & Prediction UI
// ==========================================

function updateAnalyticsUI() {
    if (document.getElementById('analyticsPlaceholder')) document.getElementById('analyticsPlaceholder').style.display = 'none';
    if (document.getElementById('analyticsContent')) document.getElementById('analyticsContent').style.display = 'block';
    
    // アラートの描画（ui.js側に残している場合はそちらを呼び出し）
    if (typeof renderOrderAlerts === "function") renderOrderAlerts();

    const historyList = document.getElementById('fileHistoryList');
    if (historyList) {
        historyList.innerHTML = '';
        if (loadedFiles.length === 0) {
            historyList.innerHTML = '<li class="text-gray-400 text-xs py-2 text-center">No NOS history available.</li>';
        } else {
            loadedFiles.forEach((fileName, index) => {
                const li = document.createElement('li');
                li.className = "flex justify-between items-center text-xs text-gray-700 py-1.5 border-b border-gray-200 last:border-0 hover:bg-white px-2";
                const upDisabled = index === 0 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : '';
                const downDisabled = index === loadedWeeks - 1 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : '';
                li.innerHTML = `<div class="truncate flex-grow"><span class="font-bold text-indigo-600 mr-2 w-14 inline-block">Wk ${index + 1}:</span> ${fileName}</div>
                    <div class="flex gap-1 flex-shrink-0 ml-2">
                        <button onclick="moveFileUp(${index})" class="p-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-600 shadow-sm" ${upDisabled}>▲</button>
                        <button onclick="moveFileDown(${index})" class="p-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-600 shadow-sm" ${downDisabled}>▼</button>
                        <button onclick="deleteFile(${index})" class="p-1 bg-red-100 hover:bg-red-200 rounded text-red-600 ml-1 shadow-sm">✖</button>
                    </div>`;
               historyList.appendChild(li);
        });
        // ★ 勝手に一番下までスクロールする「余計なお世話」を無効化
        // historyList.parentElement.scrollTop = historyList.parentElement.scrollHeight;
    }
    }

    let skuTotalsMap = {};
    let totalNormalValue = 0;
    let totalWasteRisk = 0;
    let alertList = [];
    const today = new Date();

    for (const key in historyData) {
        const item = historyData[key];
        const latestQty = item.qtys.length > 0 ? (item.qtys[item.qtys.length - 1] || 0) : 0;
        const master = skuMaster[item.code] || { tc: 0, uom: "N/A", isFF: false };
        const amount = master.tc * latestQty;

        if (!item.isDamaged && !master.isFF) {
            totalNormalValue += amount;
            if (item.expiry && (item.expiry - today) / (1000 * 60 * 60 * 24) <= 30) totalWasteRisk += amount;
            if (item.expiry && item.expiry < today) totalWasteRisk += amount; 
        }

        if (latestQty > 0) {
            if (item.isDamaged || master.isFF) alertList.push({ code: item.code, secId: 6, qty: latestQty });
            else if (item.expiry && item.expiry < today) alertList.push({ code: item.code, secId: 7, qty: latestQty });
        }

        if (!skuTotalsMap[item.code]) {
            const dispName = getSkuName(item.code);
            skuTotalsMap[item.code] = { code: item.code, name: dispName, amount: 0, hasActiveStock: false, tc: master.tc, qty: 0 };
        }
        
        if (latestQty > 0) skuTotalsMap[item.code].hasActiveStock = true;
        skuTotalsMap[item.code].qty += latestQty;
        if (!item.isDamaged && !master.isFF) skuTotalsMap[item.code].amount += amount;
    }

    setSafeText('kpiTotalValue', '$' + Math.round(totalNormalValue).toLocaleString());
    setSafeText('kpiWasteRisk', '$' + Math.round(totalWasteRisk).toLocaleString());
    let activeSkusCount = Object.values(skuTotalsMap).filter(sku => sku.hasActiveStock).length;
    setSafeText('kpiTotalSkus', activeSkusCount.toLocaleString());

    // ==========================================
    // 1. Financial ABC Analysis
    // ==========================================
    let skuTotals = Object.values(skuTotalsMap).filter(sku => sku.qty > 0);
    
    // ★ 修正：数字のコードでもエラーにならないように String() で文字列に強制変換して比較
    skuTotals.sort((a, b) => {
        if (b.amount !== a.amount) return b.amount - a.amount;
        if (b.qty !== a.qty) return b.qty - a.qty;
        return String(a.code).localeCompare(String(b.code));
    });
    
    let abcValues = { A: 0, B: 0, C: 0 }; let abcCounts = { A: 0, B: 0, C: 0 }; let cumulative = 0;
    window.abcRanks = {}; let totalAmtForAbc = skuTotals.reduce((acc, curr) => acc + curr.amount, 0);

    skuTotals.forEach(sku => {
        let prevPct = totalAmtForAbc > 0 ? cumulative / totalAmtForAbc : 0;
        cumulative += sku.amount;
        let currentPct = totalAmtForAbc > 0 ? cumulative / totalAmtForAbc : 0;
        sku.cumulativePct = currentPct * 100;

        if (prevPct < 0.7) { sku.rank = 'A'; abcValues.A += sku.amount; abcCounts.A++; } 
        else if (prevPct < 0.9) { sku.rank = 'B'; abcValues.B += sku.amount; abcCounts.B++; } 
        else { sku.rank = 'C'; abcValues.C += sku.amount; abcCounts.C++; }
        window.abcRanks[sku.code] = sku.rank; 
    });

    window.abcList = skuTotals; 
    
    if (document.getElementById('cntAbcA')) document.getElementById('cntAbcA').innerText = abcCounts.A;
    if (document.getElementById('cntAbcB')) document.getElementById('cntAbcB').innerText = abcCounts.B;
    if (document.getElementById('cntAbcC')) document.getElementById('cntAbcC').innerText = abcCounts.C;

    const canvasEl = document.getElementById('abcChart');
    if (canvasEl) {
        const ctx = canvasEl.getContext('2d');
        if (myAbcChart) myAbcChart.destroy(); 
        myAbcChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['A Rank (Top 70%)', 'B Rank (Next 20%)', 'C Rank (Bottom 10%)'],
                datasets: [
                    { label: 'Total Value ($)', type: 'bar', data: [abcValues.A, abcValues.B, abcValues.C], backgroundColor: ['rgba(16, 185, 129, 0.7)', 'rgba(245, 158, 11, 0.7)', 'rgba(100, 116, 139, 0.7)' ], yAxisID: 'y' },
                    { label: 'SKU Count', type: 'line', data: [abcCounts.A, abcCounts.B, abcCounts.C], borderColor: '#ef4444', backgroundColor: '#ef4444', borderWidth: 3, pointRadius: 6, pointHoverRadius: 8, yAxisID: 'y1' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { position: 'bottom' } },
                scales: {
                    y: { type: 'linear', position: 'left', title: { display: true, text: 'Total Value ($)', color: '#475569', font: { weight: 'bold' } }, ticks: { callback: function(value) { return '$' + Math.round(value).toLocaleString(); } } },
                    y1: { type: 'linear', position: 'right', title: { display: true, text: 'SKU Count', color: '#ef4444', font: { weight: 'bold' } }, grid: { drawOnChartArea: false }, min: 0 }
                }
            }
        });
    }

    renderAbcList('A');

    const alertTbody = document.getElementById('analyticsAlertTableBody');
    if (alertTbody) {
        alertTbody.innerHTML = '';
        alertList.forEach(item => {
            const tr = document.createElement('tr'); tr.className = "border-b hover:bg-slate-50";
            let status = '';
            if (item.secId === 6) status = '<span class="text-red-500 font-bold bg-red-50 px-2 py-1 rounded">🚨 Damaged/FF</span>';
            if (item.secId === 7) status = '<span class="text-gray-800 font-bold bg-gray-200 px-2 py-1 rounded">💀 Expired</span>';
            tr.innerHTML = `<td class="p-3 font-medium">${item.code}</td><td class="p-3 text-center">${status}</td><td class="p-3 text-right font-bold">${item.qty.toLocaleString()}</td>`;
            alertTbody.appendChild(tr);
        });
    }

    // ==========================================
    // 2. Picking Frequency (Hit) ABC Analysis
    // ==========================================
    if (loadedInvoiceWeeks > 0) {
        document.getElementById('hitAbcPlaceholder').style.display = 'none';
        document.getElementById('hitAbcContent').style.display = 'block';

        let hitTotalsMap = {};
        for (const key in invoiceHistoryData) {
            const item = invoiceHistoryData[key];
            const hitsArray = invoiceHistoryData[key].hits || [];
            const totalHits = hitsArray.reduce((a, b) => a + b, 0);
            const totalSalesQty = item.qtys.reduce((a, b) => a + b, 0);
            
            if (totalHits > 0) {
                const dispName = getSkuName(key);
                hitTotalsMap[key] = { code: key, name: dispName, hits: totalHits, qty: totalSalesQty };
            }
        }

        let hitTotalsArray = Object.values(hitTotalsMap);
        
        // ★ 修正：数字のコードでもエラーにならないように String() で文字列に強制変換して比較
        hitTotalsArray.sort((a, b) => {
            if (b.hits !== a.hits) return b.hits - a.hits;
            if (b.qty !== a.qty) return b.qty - a.qty;
            return String(a.code).localeCompare(String(b.code));
        });

        let hitAbcValues = { A: 0, B: 0, C: 0 }; let hitAbcCounts = { A: 0, B: 0, C: 0 }; let hitCumulative = 0;
        window.hitAbcRanks = {}; let totalHitsForAbc = hitTotalsArray.reduce((acc, curr) => acc + curr.hits, 0);

        hitTotalsArray.forEach(sku => {
            let prevPct = totalHitsForAbc > 0 ? hitCumulative / totalHitsForAbc : 0;
            hitCumulative += sku.hits;
            let currentPct = totalHitsForAbc > 0 ? hitCumulative / totalHitsForAbc : 0;
            sku.cumulativePct = currentPct * 100;

            if (prevPct < 0.7) { sku.rank = 'A'; hitAbcValues.A += sku.hits; hitAbcCounts.A++; } 
            else if (prevPct < 0.9) { sku.rank = 'B'; hitAbcValues.B += sku.hits; hitAbcCounts.B++; } 
            else { sku.rank = 'C'; hitAbcValues.C += sku.hits; hitAbcCounts.C++; }
            window.hitAbcRanks[sku.code] = sku.rank; 
        });

        window.hitAbcList = hitTotalsArray; 
        
        if (document.getElementById('cntHitAbcA')) document.getElementById('cntHitAbcA').innerText = hitAbcCounts.A;
        if (document.getElementById('cntHitAbcB')) document.getElementById('cntHitAbcB').innerText = hitAbcCounts.B;
        if (document.getElementById('cntHitAbcC')) document.getElementById('cntHitAbcC').innerText = hitAbcCounts.C;

        const hitCanvasEl = document.getElementById('hitAbcChart');
        if (hitCanvasEl) {
            const hitCtx = hitCanvasEl.getContext('2d');
            if (myHitAbcChart) myHitAbcChart.destroy(); 
            myHitAbcChart = new Chart(hitCtx, {
                type: 'bar',
                data: {
                    labels: ['A Rank (Top 70%)', 'B Rank (Next 20%)', 'C Rank (Bottom 10%)'],
                    datasets: [
                        { label: 'Total Picking Hits', type: 'bar', data: [hitAbcValues.A, hitAbcValues.B, hitAbcValues.C], backgroundColor: ['rgba(99, 102, 241, 0.7)', 'rgba(236, 72, 153, 0.7)', 'rgba(148, 163, 184, 0.7)' ], yAxisID: 'y' },
                        { label: 'SKU Count', type: 'line', data: [hitAbcCounts.A, hitAbcCounts.B, hitAbcCounts.C], borderColor: '#f59e0b', backgroundColor: '#f59e0b', borderWidth: 3, pointRadius: 6, pointHoverRadius: 8, yAxisID: 'y1' }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, 
                    plugins: { legend: { position: 'bottom' } },
                    scales: {
                        y: { type: 'linear', position: 'left', title: { display: true, text: 'Total Picking Hits', color: '#475569', font: { weight: 'bold' } } },
                        y1: { type: 'linear', position: 'right', title: { display: true, text: 'SKU Count', color: '#f59e0b', font: { weight: 'bold' } }, grid: { drawOnChartArea: false }, min: 0 }
                    }
                }
            });
        }
        renderHitAbcList('A');
    }
    
    // 3. Render Cross Analysis if both data are available
    renderCrossAnalysis();

    // 4. Order Action Required List
    _buildOrderData();
    renderOrderTable();
}


// ==========================================
// Button Tabs & List Rendering Logic
// ==========================================

function renderAbcList(targetRank) {
    ['A', 'B', 'C'].forEach(r => {
        const b = document.getElementById('btnAbc' + r);
        if(b) {
            b.classList.remove('text-green-600', 'border-green-500', 'text-yellow-600', 'border-yellow-500', 'text-gray-800', 'border-gray-500', 'bg-slate-50');
            b.classList.add('text-gray-500', 'border-transparent');
        }
    });
    
    const btn = document.getElementById('btnAbc' + targetRank);
    let colorClassText = targetRank === 'A' ? 'text-green-600' : targetRank === 'B' ? 'text-yellow-600' : 'text-gray-800';
    let colorClassBorder = targetRank === 'A' ? 'border-green-500' : targetRank === 'B' ? 'border-yellow-500' : 'border-gray-500';
    
    if (btn) {
        btn.classList.remove('text-gray-500', 'border-transparent');
        btn.classList.add(colorClassText, colorClassBorder, 'bg-slate-50');
    }

    const tbody = document.getElementById('abcListBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!window.abcList) return;

    window.abcList.forEach(sku => {
        if (sku.rank === targetRank && sku.qty > 0) {
            const tr = document.createElement('tr'); tr.className = "border-b hover:bg-slate-50";
            tr.innerHTML = `
                <td class="p-4 pl-6 font-bold text-indigo-700">${sku.code}</td>
                <td class="p-4 truncate max-w-[300px]" title="${sku.name}">${sku.name}</td>
                <td class="p-4 text-right font-mono">$${sku.tc.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                <td class="p-4 text-right font-mono font-bold">${sku.qty.toLocaleString()}</td>
                <td class="p-4 text-right font-mono text-red-600 font-bold">$${Math.round(sku.amount).toLocaleString()}</td>
                <td class="p-4 text-right font-mono">${sku.cumulativePct.toFixed(2)}%</td>
                <td class="p-4 text-center"><span class="px-2 py-0.5 rounded text-xs font-bold bg-gray-100">${sku.rank}</span></td>
            `;
            tbody.appendChild(tr);
        }
    });
}

function renderHitAbcList(targetRank) {
    ['A', 'B', 'C'].forEach(r => {
        const b = document.getElementById('btnHitAbc' + r);
        if(b) {
            b.classList.remove('text-indigo-600', 'border-indigo-500', 'text-pink-600', 'border-pink-500', 'text-slate-800', 'border-slate-500', 'bg-slate-50');
            b.classList.add('text-gray-500', 'border-transparent');
        }
    });
    
    const btn = document.getElementById('btnHitAbc' + targetRank);
    let colorClassText = targetRank === 'A' ? 'text-indigo-600' : targetRank === 'B' ? 'text-pink-600' : 'text-slate-800';
    let colorClassBorder = targetRank === 'A' ? 'border-indigo-500' : targetRank === 'B' ? 'border-pink-500' : 'border-slate-500';
    
    if (btn) {
        btn.classList.remove('text-gray-500', 'border-transparent');
        btn.classList.add(colorClassText, colorClassBorder, 'bg-slate-50');
    }

    const tbody = document.getElementById('hitAbcListBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!window.hitAbcList) return;

    window.hitAbcList.forEach(sku => {
        if (sku.rank === targetRank && sku.hits > 0) {
            const tr = document.createElement('tr'); tr.className = "border-b hover:bg-indigo-50/30";
            tr.innerHTML = `
                <td class="p-4 pl-6 font-bold text-indigo-700">${sku.code}</td>
                <td class="p-4 truncate max-w-[300px]" title="${sku.name}">${sku.name}</td>
                <td class="p-4 text-right font-mono font-black text-indigo-600">${sku.hits.toLocaleString()}</td>
                <td class="p-4 text-right font-mono">${sku.qty.toLocaleString()}</td>
                <td class="p-4 text-right font-mono">${sku.cumulativePct.toFixed(2)}%</td>
                <td class="p-4 text-center"><span class="px-2 py-0.5 rounded text-xs font-bold bg-gray-100">${sku.rank}</span></td>
            `;
            tbody.appendChild(tr);
        }
    });
}

// ==========================================
// Cross ABC Analysis (9-Box Matrix)
// ==========================================
function renderCrossAnalysis() {
    const crossSection = document.getElementById('crossAnalysisSection');
    // crossAnalysisSection は mapTab にのみ表示する
    const mapTab = document.getElementById('mapTab');
    const isMapActive = mapTab && mapTab.style.display !== 'none';
    if (!isMapActive) {
        if(crossSection) crossSection.style.display = 'none';
        return;
    }
    if (loadedWeeks === 0 || loadedInvoiceWeeks === 0 || !window.abcRanks || !window.hitAbcRanks) {
        if(crossSection) crossSection.style.display = 'none';
        return;
    }

    if(crossSection) crossSection.style.display = 'block';

    window.crossMatrixData = {
        'A-A': [], 'A-B': [], 'A-C': [],
        'B-A': [], 'B-B': [], 'B-C': [],
        'C-A': [], 'C-B': [], 'C-C': []
    };

    const allCodes = new Set([...Object.keys(window.abcRanks), ...Object.keys(window.hitAbcRanks)]);
    
    allCodes.forEach(code => {
        const vRank = window.abcRanks[code] || 'C'; 
        const hRank = window.hitAbcRanks[code] || 'C'; 
        const cellKey = `${vRank}-${hRank}`;
        
        if (window.crossMatrixData[cellKey]) {
            const dispName = getSkuName(code);
            window.crossMatrixData[cellKey].push({ code: code, name: dispName, vRank: vRank, hRank: hRank });
        }
    });

    ['A','B','C'].forEach(v => {
        ['A','B','C'].forEach(h => {
            const cellId = `cell_${v}${h}`;
            if(document.getElementById(cellId)) {
                document.getElementById(cellId).innerText = window.crossMatrixData[`${v}-${h}`].length;
            }
        });
    });
}

// ==========================================
// Order Action Required List
// ==========================================

let _orderTab = 'dry';
let _orderSort = { col: null, asc: true };
let _orderData = [];

function _getArrivalDates(tab) {
    const next  = tab === 'frozen' ? globalFrozenNext  : globalDryNext;
    const next2 = tab === 'frozen' ? globalFrozenNext2 : globalDryNext2;
    const next3 = tab === 'frozen' ? globalFrozenNext3 : globalDryNext3;
    const baseDate = getLatestDataDate(); // SKU詳細と同じ基準日を使用
    const dNext  = next  ? new Date(next)  : null;
    const dNext2 = next2 ? new Date(next2) : null;
    const dNext3 = next3 ? new Date(next3) : null;
    const MS_PER_WEEK = 7 * 24 * 3600 * 1000;
    return {
        next, next2, next3,
        weeksToNext:    dNext  ? Math.max(0, (dNext  - baseDate) / MS_PER_WEEK) : null,
        weeks1to2:      (dNext && dNext2) ? Math.max(0, (dNext2 - dNext)  / MS_PER_WEEK) : null,
        weeks2to3:      (dNext2 && dNext3) ? Math.max(0, (dNext3 - dNext2) / MS_PER_WEEK) : null,
    };
}

function _buildOrderData() {
    const dates = _getArrivalDates(_orderTab);
    const rows = [];

    // Pre-index historyData by code once: O(n) build → O(1) per-SKU lookup
    const byCode = {};
    for (const key in historyData) {
        const c = historyData[key].code;
        if (!byCode[c]) byCode[c] = [];
        byCode[c].push(historyData[key]);
    }
    const wks = Math.min(12, loadedWeeks);

    for (const code in skuMaster) {
        const master = skuMaster[code];
        const stType = master.storageType || 'Dry';
        const matchTab = _orderTab === 'frozen' ? stType === 'Frozen' : (stType === 'Dry' || stType === 'Chill');
        if (!matchTab) continue;

        const lots = byCode[code] || [];

        // current qty (sum across lots)
        let currentQty = 0;
        for (const lot of lots) currentQty += (lot.qtys[loadedWeeks - 1] || 0);

        // avg weekly sales (past 12 weeks)
        let salesSum = 0;
        for (let i = loadedWeeks - wks; i < loadedWeeks; i++) {
            for (const lot of lots) salesSum += (lot.sales[i] || 0);
        }
        const avg = wks > 0 ? salesSum / wks : 0;
        const safety = Math.round(avg * 8); // ★ 常に週平均×8週（約2ヶ月）で統一

        // predictions
        const predNext = dates.weeksToNext !== null ? currentQty - avg * dates.weeksToNext : null;
        let orderNext = 0, pred2nd = null, order2nd = 0, pred3rd = null, order3rd = 0;

        if (predNext !== null && dates.weeks1to2 !== null) {
            orderNext = Math.max(0, Math.round(safety + avg * dates.weeks1to2 - predNext));
            pred2nd   = predNext + orderNext - avg * dates.weeks1to2;
        }
        if (pred2nd !== null && dates.weeks2to3 !== null) {
            order2nd = Math.max(0, Math.round(safety + avg * dates.weeks2to3 - pred2nd));
            pred3rd  = pred2nd + order2nd - avg * dates.weeks2to3;
        }
        if (pred3rd !== null) {
            order3rd = Math.max(0, Math.round(safety - pred3rd));
        }

        rows.push({ code, name: master.name || code, uom: master.uom || '-', avg, safety, currentQty,
            predNext, orderNext, pred2nd, order2nd, pred3rd, order3rd });
    }

    _orderData = rows;
}

function switchOrderTab(tab) {
    _orderTab = tab;
    _orderSort = { col: null, asc: true };
    const dryBtn    = document.getElementById('btnOrderTabDry');
    const frozenBtn = document.getElementById('btnOrderTabFrozen');
    if (dryBtn)    dryBtn.className    = `px-5 py-2.5 font-bold text-sm border-b-2 transition-colors ${tab === 'dry'    ? 'border-purple-600 text-purple-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`;
    if (frozenBtn) frozenBtn.className = `px-5 py-2.5 font-bold text-sm border-b-2 transition-colors ${tab === 'frozen' ? 'border-purple-600 text-purple-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`;
    _buildOrderData();
    renderOrderTable();
}

function sortOrderTable(col) {
    _orderSort.asc = _orderSort.col === col ? !_orderSort.asc : (col === 'code' || col === 'name');
    _orderSort.col = col;
    ['code','name','avg','safety','currentQty','predNext','pred2nd','pred3rd'].forEach(c => {
        const el = document.getElementById('sortIcon_' + c);
        if (el) el.textContent = c === col ? (_orderSort.asc ? '↑' : '↓') : '↕';
    });
    renderOrderTable();
}

function renderOrderTable() {
    const tbody = document.getElementById('orderAlertTableBody');
    if (!tbody) return;

    // update column headers with actual dates
    const dates = _getArrivalDates(_orderTab);
    const setTh = (id, label, date) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = date ? `→ ${date} <span id="sortIcon_${label}" class="text-blue-300">↕</span>` : `→ ${label.toUpperCase()} <span id="sortIcon_${label}" class="text-gray-300">↕</span>`;
    };
    setTh('thPredNext', 'predNext', dates.next);
    setTh('thPred2nd',  'pred2nd',  dates.next2);
    setTh('thPred3rd',  'pred3rd',  dates.next3);
    const setOrderTh = (id, label, date) => {
        const el = document.getElementById(id);
        if (el) el.textContent = date ? `Order (${date})` : label;
    };
    setOrderTh('thOrderNext', 'Order (Next)', dates.next);
    setOrderTh('thOrder2nd',  'Order (2nd)',  dates.next2);
    setOrderTh('thOrder3rd',  'Order (3rd)',  dates.next3);

    // filter
    const q = (document.getElementById('orderTableSearch')?.value || '').toLowerCase();
    let rows = q ? _orderData.filter(r => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)) : [..._orderData];

    // sort
    if (_orderSort.col) {
        rows.sort((a, b) => {
            const va = a[_orderSort.col], vb = b[_orderSort.col];
            if (va === null && vb === null) return 0;
            if (va === null) return 1;
            if (vb === null) return -1;
            if (typeof va === 'string') return _orderSort.asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
            return _orderSort.asc ? va - vb : vb - va;
        });
    }

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" class="p-8 text-center text-gray-400 font-bold">No SKUs found. Make sure container arrival dates are set above.</td></tr>`;
        return;
    }

    const fmtPred = (v, safety) => {
        if (v === null) return `<span class="text-gray-300">-</span>`;
        const rounded = Math.round(v);
        const cls = rounded < 0 ? 'text-red-700 font-black bg-red-50 px-1 rounded' :
                    rounded < safety ? 'text-red-500 font-bold' :
                    rounded < safety * 1.5 ? 'text-yellow-600 font-bold' : 'text-gray-700';
        return `<span class="${cls}">${rounded.toLocaleString()}</span>`;
    };

    tbody.innerHTML = '';
    rows.forEach(row => {
        const sid = String(row.code).replace(/[^a-zA-Z0-9]/g, '_');
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-100 hover:bg-purple-50/20';
        tr.innerHTML = `
            <td class="p-3 pl-4 font-bold text-indigo-700">${row.code}</td>
            <td class="p-3 max-w-[180px] truncate text-gray-700" title="${row.name}">${row.name}</td>
            <td class="p-3 text-center text-gray-500 text-xs">${row.uom}</td>
            <td class="p-3 text-right font-mono text-gray-500">${row.avg.toFixed(1)}</td>
            <td class="p-3 text-right font-mono text-red-500 font-bold">${row.safety.toLocaleString()}</td>
            <td class="p-3 text-right font-mono font-bold text-gray-800">${row.currentQty.toLocaleString()}</td>
            <td class="p-3 text-right bg-blue-50">${fmtPred(row.predNext, row.safety)}</td>
            <td class="p-3 bg-blue-50"><input type="number" min="0" value="${row.orderNext}" data-sid="${sid}" data-field="orderNext" onchange="onOrderQtyChange(this)" class="w-24 text-right border border-blue-200 rounded px-2 py-1 text-xs font-bold text-blue-800 focus:ring-1 focus:ring-blue-400 outline-none bg-white"></td>
            <td class="p-3 text-right bg-indigo-50" id="op2_${sid}">${fmtPred(row.pred2nd, row.safety)}</td>
            <td class="p-3 bg-indigo-50"><input type="number" min="0" value="${row.order2nd}" data-sid="${sid}" data-field="order2nd" onchange="onOrderQtyChange(this)" class="w-24 text-right border border-indigo-200 rounded px-2 py-1 text-xs font-bold text-indigo-800 focus:ring-1 focus:ring-indigo-400 outline-none bg-white"></td>
            <td class="p-3 text-right bg-violet-50" id="op3_${sid}">${fmtPred(row.pred3rd, row.safety)}</td>
            <td class="p-3 bg-violet-50"><input type="number" min="0" value="${row.order3rd}" data-sid="${sid}" data-field="order3rd" onchange="onOrderQtyChange(this)" class="w-24 text-right border border-violet-200 rounded px-2 py-1 text-xs font-bold text-violet-800 focus:ring-1 focus:ring-violet-400 outline-none bg-white"></td>
        `;
        tbody.appendChild(tr);
    });
}

function onOrderQtyChange(input) {
    const sid = input.dataset.sid;
    const field = input.dataset.field;
    const val = parseInt(input.value) || 0;
    const row = _orderData.find(r => String(r.code).replace(/[^a-zA-Z0-9]/g, '_') === sid);
    if (!row) return;

    const dates = _getArrivalDates(_orderTab);
    const fmtPred = (v, safety) => {
        if (v === null) return `<span class="text-gray-300">-</span>`;
        const rounded = Math.round(v);
        const cls = rounded < 0 ? 'text-red-700 font-black bg-red-50 px-1 rounded' :
                    rounded < safety ? 'text-red-500 font-bold' :
                    rounded < safety * 1.5 ? 'text-yellow-600 font-bold' : 'text-gray-700';
        return `<span class="${cls}">${rounded.toLocaleString()}</span>`;
    };

    if (field === 'orderNext') {
        row.orderNext = val;
        if (row.predNext !== null && dates.weeks1to2 !== null) {
            row.pred2nd  = row.predNext + val - row.avg * dates.weeks1to2;
            // ★ Fix: weeks2to3 が null のとき || 0 で計算していたバグを修正
            if (dates.weeks2to3 !== null) {
                row.order2nd = Math.max(0, Math.round(row.safety + row.avg * dates.weeks2to3 - row.pred2nd));
                row.pred3rd  = row.pred2nd + row.order2nd - row.avg * dates.weeks2to3;
                row.order3rd = Math.max(0, Math.round(row.safety - row.pred3rd));
            } else {
                row.order2nd = 0; row.pred3rd = null; row.order3rd = 0;
            }
        }
    } else if (field === 'order2nd') {
        row.order2nd = val;
        if (row.pred2nd !== null && dates.weeks2to3 !== null) {
            row.pred3rd  = row.pred2nd + val - row.avg * dates.weeks2to3;
            row.order3rd = Math.max(0, Math.round(row.safety - row.pred3rd));
        }
    } else {
        row.order3rd = val;
        return;
    }

    const p2El = document.getElementById(`op2_${sid}`);
    const p3El = document.getElementById(`op3_${sid}`);
    const o2In = document.querySelector(`input[data-sid="${sid}"][data-field="order2nd"]`);
    const o3In = document.querySelector(`input[data-sid="${sid}"][data-field="order3rd"]`);

    if (p2El) p2El.innerHTML = fmtPred(row.pred2nd, row.safety);
    if (p3El) p3El.innerHTML = fmtPred(row.pred3rd, row.safety);
    if (o2In && field === 'orderNext') o2In.value = row.order2nd;
    if (o3In) o3In.value = row.order3rd;
}

function exportOrderTable() {
    if (!_orderData || _orderData.length === 0) { alert('No data to export.'); return; }
    const dates = _getArrivalDates(_orderTab);
    const q = (document.getElementById('orderTableSearch')?.value || '').toLowerCase();
    const rows = q ? _orderData.filter(r => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)) : _orderData;
    const n  = dates.next  || 'Next';
    const n2 = dates.next2 || '2nd';
    const n3 = dates.next3 || '3rd';
    const wsData = [
        ['Code','Item Name','UoM','Avg/Wk','Safety Stock','Current Qty',
         `Pred @ ${n}`, `Order (${n})`, `Pred @ ${n2}`, `Order (${n2})`, `Pred @ ${n3}`, `Order (${n3})`],
        ...rows.map(r => [r.code, r.name, r.uom, +r.avg.toFixed(1), r.safety, r.currentQty,
            r.predNext !== null ? Math.round(r.predNext) : '-', r.orderNext,
            r.pred2nd  !== null ? Math.round(r.pred2nd)  : '-', r.order2nd,
            r.pred3rd  !== null ? Math.round(r.pred3rd)  : '-', r.order3rd])
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [10,25,6,8,10,10,12,12,12,12,12,12].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, _orderTab === 'frozen' ? 'Frozen Order' : 'Dry-Chill Order');
    XLSX.writeFile(wb, `Order_Plan_${_orderTab === 'frozen' ? 'Frozen' : 'Dry-Chill'}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function showCrossList(valRank, hitRank) {
    const titleEl = document.getElementById('crossListTitle');
    const descEl = document.getElementById('crossListDesc');
    const tbody = document.getElementById('crossListBody');
    
    if(!titleEl || !descEl || !tbody) return;

    const cellKey = `${valRank}-${hitRank}`;
    const list = window.crossMatrixData[cellKey] || [];
    
    let guidance = "";
    if (cellKey === 'A-A') guidance = "⭐ Core Items: Very High Value & Frequent Picks. Keep in Golden Zone.";
    else if (cellKey === 'C-A') guidance = "🏃‍♂️ High Labor, Low Value. Consider pre-packing or bulk sets.";
    else if (cellKey === 'A-C') guidance = "💰 Sleeping Giants: High Value but rarely picked. Monitor for overstock.";
    else guidance = "Standard inventory zone.";

    titleEl.innerText = `Segment: ${cellKey} (${list.length} SKUs)`;
    descEl.innerText = guidance;

    tbody.innerHTML = '';
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400 font-bold">No SKUs in this segment.</td></tr>`;
        return;
    }

    list.forEach(sku => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-100 cursor-pointer transition-colors";
        tr.onclick = () => {
            const safeCodeForClick = String(sku.code).replace(/'/g, "\\'").replace(/"/g, "&quot;");
            if (document.getElementById('skuSearchInput')) document.getElementById('skuSearchInput').value = sku.code;
            if (typeof renderSKUDetails === "function") renderSKUDetails(safeCodeForClick);
            window.scrollTo({ top: document.getElementById('skuDetailArea').offsetTop - 20, behavior: 'smooth' });
        };

        tr.innerHTML = `
            <td class="p-3 pl-4 font-bold text-indigo-700">${sku.code}</td>
            <td class="p-3 truncate max-w-[200px]" title="${sku.name}">${sku.name}</td>
            <td class="p-3 text-center"><span class="px-2 py-0.5 rounded text-xs font-bold ${valRank==='A'?'bg-green-100 text-green-700':valRank==='B'?'bg-yellow-100 text-yellow-700':'bg-slate-200 text-slate-700'}">${valRank}</span></td>
            <td class="p-3 text-center"><span class="px-2 py-0.5 rounded text-xs font-bold ${hitRank==='A'?'bg-indigo-100 text-indigo-700':hitRank==='B'?'bg-pink-100 text-pink-700':'bg-slate-200 text-slate-700'}">${hitRank}</span></td>
        `;
        tbody.appendChild(tr);
    });
}