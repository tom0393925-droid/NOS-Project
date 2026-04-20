// ==========================================
// js/ui.js: Main NOS List and Detail Views
// ==========================================

function renderActionList() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    if (document.getElementById('resultsArea')) document.getElementById('resultsArea').style.display = 'block';

    if (loadedWeeks === 0 || Object.keys(historyData).length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" class="text-center py-10 text-gray-500 font-bold">No Data Available. Please append Excel data or load a valid JSON file.</td></tr>`;
        if (typeof updateAnalyticsUI === "function") updateAnalyticsUI();
        return;
    }

    const sections = {
        1: { title: "1. New Arrival", color: "sec-1", skus: [] },
        2: { title: "2. No Sale 1m (Expiry < 3m)", color: "sec-2", skus: [] },
        3: { title: "3. Have sale in 1m (Slow to clear)", color: "sec-3", skus: [] },
        4: { title: "4. No Sale 1m (Expiry > 3m, over $500)", color: "sec-4", skus: [] },
        5: { title: "5. No Sale 1m (No Expiry Date)", color: "sec-5", skus: [] },
        6: { title: "6. Return & Damage, and FF Item", color: "sec-6", skus: [] },
        7: { title: "7. Expired Item", color: "sec-7", skus: [] }
    };

    const today = new Date();
    const threeMonths = new Date(today); threeMonths.setMonth(today.getMonth() + 3);
    let skuGroups = {};

    for (const key in historyData) {
        const item = historyData[key];
        const latestQty = item.qtys.length > 0 ? (item.qtys[item.qtys.length - 1] || 0) : 0;
        
        if (latestQty <= 0 && (!item.expiry || item.expiry > today)) continue; 

        const latestSales = item.sales.length > 0 ? (item.sales[item.sales.length - 1] || 0) : 0;
        
        let past4WSalesSum = 0; const checkWeeks4 = Math.min(4, loadedWeeks);
        for(let i = loadedWeeks - checkWeeks4; i < loadedWeeks; i++) past4WSalesSum += (item.sales[i] || 0);

        const checkWeeks12 = Math.min(12, loadedWeeks);
        let _hasStockItem = false, recentZeroQtyWeeks = 0;
        for (let i = 0; i < loadedWeeks; i++) {
            if ((item.qtys[i] || 0) > 0) _hasStockItem = true;
            if (i >= loadedWeeks - checkWeeks12 && (item.qtys[i] || 0) === 0) recentZeroQtyWeeks++;
        }
        let past12WAvg;
        if (_hasStockItem && recentZeroQtyWeeks > 0) {
            past12WAvg = _calcStockoutAvg(item.qtys, item.sales, loadedWeeks);
        } else {
            let _s = 0, _w = 0;
            for (let i = loadedWeeks - checkWeeks12; i < loadedWeeks; i++) {
                if ((item.qtys[i] || 0) > 0) { _s += (item.sales[i] || 0); _w++; }
            }
            past12WAvg = _w > 0 ? _s / _w : 0;
        }

        let isNewArrival = true;
        for(let i = 0; i < loadedWeeks - 1; i++) { if (item.qtys[i] > 0) { isNewArrival = false; break; } }

        const master = skuMaster[item.code] || { tc: 0, uom: "N/A", isFF: false };
        const totalAmount = master.tc * latestQty;

        let secId = 0;
        if (item.isDamaged || master.isFF) secId = 6;
        else if (item.expiry && item.expiry < today) secId = 7;
        else if (isNewArrival) secId = 1;
        else {
            if (past4WSalesSum === 0) {
                if (!item.expiry) secId = 5; else if (item.expiry <= threeMonths) secId = 2; else if (totalAmount >= 500) secId = 4;
            } else {
                if (item.expiry) {
                    const weeksToExpiry = (item.expiry - today) / (1000 * 60 * 60 * 24 * 7);
                    const weeksToClear = past12WAvg > 0 ? (latestQty / past12WAvg) : 999;
                    if (weeksToClear > weeksToExpiry) secId = 3; 
                }
            }
        }

        if (secId !== 0) {
            if (!skuGroups[item.code]) skuGroups[item.code] = [];
            skuGroups[item.code].push({ ...item, latestQty, latestSales, past12WAvg, totalAmount, tc: master.tc, uom: master.uom, secId, uniqueKey: key });
        }
    }

    const sevOrder = { 6:1, 7:2, 2:3, 3:4, 4:5, 5:6, 1:7 }; 

    Object.keys(skuGroups).sort().forEach(code => {
        const lots = skuGroups[code];
        let topSec = -1; let minSev = 99;

        lots.forEach(lot => { const sev = sevOrder[lot.secId]; if (sev < minSev) { minSev = sev; topSec = lot.secId; } });

        if (topSec !== -1) {
            lots.sort((a, b) => { if (!a.expiry) return 1; if (!b.expiry) return -1; return a.expiry - b.expiry; });
            sections[topSec].skus.push({ code: code, lots: lots });
        }
    });

    const fragment = document.createDocumentFragment();

    [1, 2, 3, 4, 5, 6, 7].forEach(secId => {
        const sec = sections[secId];
        if (sec.skus.length > 0) {
            const headerTr = document.createElement('tr');
            headerTr.innerHTML = `<td colspan="3" class="sec-header ${sec.color}">${sec.title} : ${sec.skus.length} SKUs</td><td colspan="10" class="sec-header ${sec.color} sec-header-bg"></td>`;
            fragment.appendChild(headerTr);

            let skuIndex = 1;
            sec.skus.forEach(skuObj => {
                skuObj.lots.forEach((item, idx) => {
                    const isFirst = (idx === 0);
                    const tr = document.createElement('tr');
                    if (isFirst) tr.className = "row-first";
                    
                    const m1 = `m1_${item.uniqueKey}`; const m2 = `m2_${item.uniqueKey}`; const m3 = `m3_${item.uniqueKey}`;
                    let origBadge = ''; if (item.secId !== secId) origBadge = `<br><span class="bg-gray-200 text-gray-700 px-1 py-0.5 rounded" style="font-size:9px;">[${item.secId}]</span>`;
                    const dispName = getSkuName(item.code);

                    tr.innerHTML = `
                        <td class="sticky-col-0">${isFirst ? `<b>${skuIndex}</b>` : ''}</td>
                        <td class="sticky-col-1">${isFirst ? item.code : ''}</td>
                        <td class="sticky-col-2">${isFirst ? `<b>${dispName}</b>` : ''}</td>
                        <td>${isFirst ? item.uom : ''}</td>
                        <td style="background:#fffcf0;"><b>${item.expiryStr}</b>${origBadge}</td>
                        <td class="val-num" style="font-weight:bold; font-size:14px;">${item.latestQty.toLocaleString()}</td>
                        <td class="val-num">${item.latestSales.toLocaleString()}</td>
                        <td class="val-num">${item.past12WAvg.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}</td>
                        <td class="val-num">${isFirst ? `$${item.tc.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : ''}</td>
                        <td class="val-num" style="color:var(--danger); font-weight:bold;">$${Math.round(item.totalAmount).toLocaleString()}</td>
                        <td class="memo-cell" contenteditable="true" onblur="currentMemos['${m1}'] = this.innerText">${currentMemos[m1] || ''}</td>
                        <td class="memo-cell" contenteditable="true" onblur="currentMemos['${m2}'] = this.innerText">${currentMemos[m2] || ''}</td>
                        <td class="memo-cell" contenteditable="true" onblur="currentMemos['${m3}'] = this.innerText">${currentMemos[m3] || ''}</td>
                    `;
                    fragment.appendChild(tr);
                });
                skuIndex++;
            });
        }
    });
    tbody.appendChild(fragment);
    if (typeof updateAnalyticsUI === "function") setTimeout(() => updateAnalyticsUI(), 0);
}

function handleSearchInput() {
    try {
        const inputEl = document.getElementById('skuSearchInput');
        const suggestList = document.getElementById('searchSuggestList');
        if (!inputEl || !suggestList) return;

        const query = inputEl.value.trim().toLowerCase();
        if (!query) { suggestList.classList.add('hidden'); return; }

        let matches = [];

        for (const code in skuMaster) {
            const master = skuMaster[code];
            const safeCode = code.toLowerCase();
            const safeName = (master.name || '').toLowerCase();
            if (safeCode.includes(query) || safeName.includes(query)) {
                matches.push({ code, name: master.name || code });
            }
        }

        if (matches.length === 0) {
            suggestList.innerHTML = '<li class="p-3 text-red-500 text-sm font-bold">No matching products found</li>';
            suggestList.classList.remove('hidden');
        } else {
            let html = '';
            matches.slice(0, 10).forEach(m => {
                const safeCodeForClick = String(m.code).replace(/'/g, "\\'").replace(/"/g, "&quot;");
                const dispName = m.name ? String(m.name).replace(/</g, "&lt;").replace(/>/g, "&gt;") : "No Name";
                html += `<li class="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0" onclick="renderSKUDetails('${safeCodeForClick}')"><span class="font-bold text-indigo-600">${m.code}</span> <span class="text-sm text-gray-700 ml-2">${dispName}</span></li>`;
            });
            suggestList.innerHTML = html;
            suggestList.classList.remove('hidden');
        }
    } catch (e) { console.error("Search Logic Error:", e); }
}

function renderSKUDetails(selectedCode) {
    if (document.getElementById('searchSuggestList')) document.getElementById('searchSuggestList').classList.add('hidden');
    if (document.getElementById('skuSearchInput')) document.getElementById('skuSearchInput').value = selectedCode;
    currentSelectedSKU = selectedCode; 

    let targetLots = []; let allTimeSalesSum = 0; let grandTotalSales = 0;
    for (const key in historyData) {
        const h = historyData[key];
        const sSum = h.sales.reduce((a, b) => a + b, 0);
        grandTotalSales += sSum;
        if (h.code === selectedCode) { targetLots.push(h); allTimeSalesSum += sSum; }
    }

    if (targetLots.length === 0) {
        // まずskuMasterの情報で即座にパネルを更新し、古いSKUの表示を消す
        const mPrev = skuMaster[selectedCode] || {};
        setSafeText('skuDetailCode', selectedCode);
        setSafeText('skuDetailName', mPrev.name || selectedCode);
        setSafeText('skuDetailUom',  mPrev.uom  || '-');
        setSafeText('skuDetailQty',  '0');
        setSafeText('skuDetailTotalAmount', '$0');
        setSafeText('skuDetailSafety', '0');
        const bodyEl = document.getElementById('skuDetailBody');
        if (bodyEl) bodyEl.style.display = 'none';

        if (typeof sbLoadSkuHistory === 'function') {
            if (typeof _showLoading === 'function') _showLoading('履歴データを読み込み中...');
            sbLoadSkuHistory(selectedCode).then(lots => {
                if (typeof _hideLoading === 'function') _hideLoading();
                if (lots.length > 0) {
                    for (const lot of lots) historyData[lot.code + '_' + lot.expiryStr] = lot;
                    renderSKUDetails(selectedCode);
                }
            }).catch(e => { if (typeof _hideLoading === 'function') _hideLoading(); console.error('Lazy load failed:', e); });
        }
        return;
    }

    let latestQty = 0;
    for (const key in historyData) {
        if (historyData[key].code === selectedCode) latestQty += (historyData[key].qtys[loadedWeeks - 1] || 0);
    }

    const masterData = skuMaster[selectedCode] || { name: targetLots[0].name, tc: 0, uom: "N/A", storageType: "Dry", safetyStock: 0 };
    const latestTotalAmount = masterData.tc * latestQty;
    const dispName = getSkuName(selectedCode);
    const uomText = masterData.uom || "-";

    // past12WAvg を先に計算してデフォルトの安全在庫（2ヶ月 = 8週分）に使う
    const _aggQtys = new Array(loadedWeeks).fill(0);
    const _aggSales = new Array(loadedWeeks).fill(0);
    for (let i = 0; i < loadedWeeks; i++) {
        targetLots.forEach(lot => { _aggQtys[i] += (lot.qtys[i] || 0); _aggSales[i] += (lot.sales[i] || 0); });
    }
    const checkWeeks12 = Math.min(12, loadedWeeks);
    let _hasStockDetail = false, recentZeroQtyWeeksDetail = 0;
    for (let i = 0; i < loadedWeeks; i++) {
        if (_aggQtys[i] > 0) _hasStockDetail = true;
        if (i >= loadedWeeks - checkWeeks12 && _aggQtys[i] === 0) recentZeroQtyWeeksDetail++;
    }
    const isStockoutSku = _hasStockDetail && recentZeroQtyWeeksDetail > 0;
    let past12WAvg;
    if (isStockoutSku) {
        past12WAvg = _calcStockoutAvg(_aggQtys, _aggSales, loadedWeeks);
    } else {
        let _s = 0, _w = 0;
        for (let i = loadedWeeks - checkWeeks12; i < loadedWeeks; i++) {
            if (_aggQtys[i] > 0) { _s += _aggSales[i]; _w++; }
        }
        past12WAvg = _w > 0 ? _s / _w : 0;
    }

    // ★ セーフティストックは常に週平均×8週（約2ヶ月）で統一
    const safetyStock = Math.round(past12WAvg * safetyWeeks);

    setSafeText('skuDetailCode', targetLots[0].code);
    setSafeText('skuDetailName', dispName);
    setSafeText('skuDetailTc', `$${masterData.tc.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    setSafeText('skuDetailUom', uomText);

    const tempEl = document.getElementById('skuDetailTemp');
    if (tempEl) {
        let stBadge = '';
        const stType = masterData.storageType || 'Dry';
        if (stType === 'Dry') stBadge = '<span class="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded border border-yellow-200">Dry</span>';
        if (stType === 'Chill') stBadge = '<span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">Chill</span>';
        if (stType === 'Frozen') stBadge = '<span class="bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded border border-cyan-200">Frozen</span>';
        tempEl.innerHTML = stBadge;
    }

    setSafeText('skuDetailQty', latestQty.toLocaleString());
    setSafeText('skuDetailTotalAmount', `$${Math.round(latestTotalAmount).toLocaleString()}`);
    setSafeText('skuDetailSafety', safetyStock.toLocaleString());

    const wos = past12WAvg > 0 ? (latestQty / past12WAvg) : (latestQty === 0 ? 0 : 999);
    let wosColor = wos > 12 ? "text-red-500" : (wos > 8 ? "text-yellow-600" : "text-green-600");
    if (wos === 999) wosColor = "text-gray-400";
    
    setSafeText('skuDetailWos', wos === 999 ? "∞" : wos.toFixed(1) + " Wks");
    const wosEl = document.getElementById('skuDetailWos');
    if (wosEl) wosEl.className = `font-black text-4xl ${wosColor}`;
    setSafeText('skuDetailAvg', isStockoutSku
        ? `(Est. Avg: ${past12WAvg.toFixed(1)} pcs/wk | Stockout)`
        : `(Recent Avg: ${past12WAvg.toFixed(1)} pcs/wk)`);

    const predictEl = document.getElementById('skuDetailOrderPredict');
    if (predictEl) {
        const stType = masterData.storageType || 'Dry';
        let targetNext = "", targetNext2 = "";
        if (stType === 'Frozen') { targetNext = globalFrozenNext; targetNext2 = globalFrozenNext2; }
        else { targetNext = globalDryNext; targetNext2 = globalDryNext2; }
        let targetNext3 = (stType === 'Frozen') ? globalFrozenNext3 : globalDryNext3;

        // 発注量入力欄を現在の shipmentOrders から復元
        const skuShipments = (window.shipmentOrders && window.shipmentOrders[selectedCode]) || [];
        const loadedNextQty  = skuShipments.find(s => s.status !== 'arrived' && s.arrivalDate === targetNext)?.orderQty  || 0;
        const loadedNext2Qty = skuShipments.find(s => s.status !== 'arrived' && s.arrivalDate === targetNext2)?.orderQty || 0;
        const loadedNext3Qty = skuShipments.find(s => s.status !== 'arrived' && s.arrivalDate === targetNext3)?.orderQty || 0;
        const nextInput  = document.getElementById('shipOrderNextQty');
        const next2Input = document.getElementById('shipOrderNext2Qty');
        const next3Input = document.getElementById('shipOrderNext3Qty');
        if (nextInput)  nextInput.value  = loadedNextQty  || '';
        if (next2Input) next2Input.value = loadedNext2Qty || '';
        if (next3Input) next3Input.value = loadedNext3Qty || '';

        if (!targetNext || !targetNext2) {
            setSafeText('predNextQty', '-'); setSafeText('predNext2Qty', '-'); setSafeText('predNext3Qty', '-');
            predictEl.innerHTML = `<span class="text-xs text-gray-400">* Please set the Next / 2nd Next arrival dates for ${stType} in the calendar above.</span>`;
        } else {
            const dNext = new Date(targetNext); const dNext2 = new Date(targetNext2);
            const baseDate = getLatestDataDate();
            const diffWkNext  = (dNext  - baseDate) / (1000 * 60 * 60 * 24 * 7);
            const diffWkNext2 = (dNext2 - baseDate) / (1000 * 60 * 60 * 24 * 7);

            if (diffWkNext <= 0 || diffWkNext2 <= 0) {
                setSafeText('predNextQty', 'Error'); setSafeText('predNext2Qty', 'Error'); setSafeText('predNext3Qty', 'Error');
                predictEl.innerHTML = `<span class="text-xs text-red-400 font-bold">Date Setting Error (Past date selected)</span>`;
            } else {
                // 発注量を考慮した予測在庫
                const shipNext  = skuShipments.filter(s => s.status !== 'arrived' && s.arrivalDate === targetNext).reduce((a, s) => a + s.orderQty, 0);
                const shipNext2 = skuShipments.filter(s => s.status !== 'arrived' && s.arrivalDate === targetNext2).reduce((a, s) => a + s.orderQty, 0);
                const shipNext3 = targetNext3 ? skuShipments.filter(s => s.status !== 'arrived' && s.arrivalDate === targetNext3).reduce((a, s) => a + s.orderQty, 0) : 0;
                const stockNext  = latestQty - (past12WAvg * diffWkNext)  + shipNext;
                const stockNext2 = latestQty - (past12WAvg * diffWkNext2) + shipNext + shipNext2;
                let stockNext3 = null;
                if (targetNext3) {
                    const diffWkNext3 = (new Date(targetNext3) - baseDate) / (1000 * 60 * 60 * 24 * 7);
                    if (diffWkNext3 > 0) stockNext3 = latestQty - (past12WAvg * diffWkNext3) + shipNext + shipNext2 + shipNext3;
                }

                setSafeText('predNextQty',  Math.max(0, Math.round(stockNext)).toLocaleString()  + ' ' + uomText);
                setSafeText('predNext2Qty', Math.max(0, Math.round(stockNext2)).toLocaleString() + ' ' + uomText);
                setSafeText('predNext3Qty', stockNext3 !== null ? Math.max(0, Math.round(stockNext3)).toLocaleString() + ' ' + uomText : '-');

                // Compute auto order suggestions (pure prediction, no user input)
                const predNextRaw = latestQty - past12WAvg * diffWkNext;
                const wks12 = diffWkNext2 - diffWkNext;
                const autoNext = Math.max(0, Math.round(safetyStock + past12WAvg * wks12 - predNextRaw));
                const pred2ndRaw = predNextRaw + autoNext - past12WAvg * wks12;
                let autoNext2 = 0, autoNext3 = 0;
                if (targetNext3) {
                    const dWk3 = (new Date(targetNext3) - baseDate) / (1000 * 60 * 60 * 24 * 7);
                    if (dWk3 > 0) {
                        const wks23 = dWk3 - diffWkNext2;
                        autoNext2 = Math.max(0, Math.round(safetyStock + past12WAvg * wks23 - pred2ndRaw));
                        autoNext3 = Math.max(0, Math.round(safetyStock - (pred2ndRaw + autoNext2 - past12WAvg * wks23)));
                    }
                }
                window._shipAutoQtys = { next: autoNext, next2: autoNext2, next3: autoNext3 };
                _updateShipHints(loadedNextQty, loadedNext2Qty, loadedNext3Qty);

                const cNext  = Math.ceil(Math.max(0, stockNext));
                const cNext2 = Math.ceil(Math.max(0, stockNext2));
                const cNext3 = stockNext3 !== null ? Math.ceil(Math.max(0, stockNext3)) : null;
                let html = `<div class="flex gap-4 mt-1">`;
                if (cNext < safetyStock) {
                    html += `<div class="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded w-full"><span class="text-xl">🚨</span><div><p class="text-xs font-bold text-red-700">Urgent: Below Safety Stock (${safetyStock}) before ${targetNext}</p><p class="text-[10px] text-red-600">Short by <span class="font-bold text-sm">${safetyStock - cNext}</span> ${uomText}</p></div></div>`;
                } else if (cNext2 < safetyStock) {
                    html += `<div class="flex items-center gap-2 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded w-full"><span class="text-xl">📦</span><div><p class="text-xs font-bold text-yellow-800">Order Now: Will fall below Safety Stock (${safetyStock}) before ${targetNext2}</p><p class="text-[10px] text-yellow-700">Short by <span class="font-bold text-sm">${safetyStock - cNext2}</span> ${uomText}</p></div></div>`;
                } else if (cNext3 !== null && cNext3 < safetyStock) {
                    html += `<div class="flex items-center gap-2 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded w-full"><span class="text-xl">⚠️</span><div><p class="text-xs font-bold text-orange-800">Plan Ahead: Will fall below Safety Stock (${safetyStock}) before ${targetNext3}</p><p class="text-[10px] text-orange-700">Short by <span class="font-bold text-sm">${safetyStock - cNext3}</span> ${uomText}</p></div></div>`;
                } else {
                    const safeUntil = targetNext3 ? targetNext3 : targetNext2;
                    html += `<div class="flex items-center gap-2 bg-green-50 border border-green-200 px-3 py-1.5 rounded w-full"><span class="text-xl">✅</span><div><p class="text-xs font-bold text-green-700">Safe: No order needed</p><p class="text-[10px] text-green-600">Remains above safety line until 3rd Next Arrival (${safeUntil})</p></div></div>`;
                }
                html += `</div>`;
                predictEl.innerHTML = html;
            }
        }
    }

    if (document.getElementById('skuDetailArea')) document.getElementById('skuDetailArea').style.display = 'block';
    const bodyEl = document.getElementById('skuDetailBody');
    if (bodyEl) bodyEl.style.display = 'block';
    if (typeof updateChartPeriod === "function") updateChartPeriod();
}

// ★ 軽量更新：発注量変更時にチャートを再描画せずに予測残高だけ更新する
function refreshPredictedBalances() {
    if (!currentSelectedSKU) return;
    const selectedCode = currentSelectedSKU;
    const masterData = skuMaster[selectedCode] || {};
    const stType = masterData.storageType || 'Dry';
    const uomText = masterData.uom || '-';

    const targetLots = Object.values(historyData).filter(h => h.code === selectedCode);
    if (targetLots.length === 0) return;

    let latestQty = 0;
    targetLots.forEach(lot => { latestQty += (lot.qtys[loadedWeeks - 1] || 0); });

    let past12WSalesSum = 0;
    const checkWeeks12 = Math.min(12, loadedWeeks);
    for (let i = loadedWeeks - checkWeeks12; i < loadedWeeks; i++) {
        let weeklySum = 0;
        targetLots.forEach(lot => { weeklySum += (lot.sales[i] || 0); });
        past12WSalesSum += weeklySum;
    }
    const past12WAvg = checkWeeks12 > 0 ? (past12WSalesSum / checkWeeks12) : 0;

    // ★ セーフティストックは常に週平均×8週（約2ヶ月）で統一
    const safetyStock = Math.round(past12WAvg * safetyWeeks);

    let targetNext = '', targetNext2 = '';
    if (stType === 'Frozen') { targetNext = globalFrozenNext; targetNext2 = globalFrozenNext2; }
    else { targetNext = globalDryNext; targetNext2 = globalDryNext2; }
    const targetNext3 = (stType === 'Frozen') ? globalFrozenNext3 : globalDryNext3;

    const predictEl = document.getElementById('skuDetailOrderPredict');

    if (!targetNext || !targetNext2) {
        setSafeText('predNextQty', '-');
        setSafeText('predNext2Qty', '-');
        setSafeText('predNext3Qty', '-');
        if (predictEl) predictEl.innerHTML = `<span class="text-xs text-gray-400">* Please set the Next / 2nd Next arrival dates for ${stType} in the calendar above.</span>`;
        return;
    }

    const dNext = new Date(targetNext);
    const dNext2 = new Date(targetNext2);
    const baseDate = getLatestDataDate();
    const diffWkNext  = (dNext  - baseDate) / (1000 * 60 * 60 * 24 * 7);
    const diffWkNext2 = (dNext2 - baseDate) / (1000 * 60 * 60 * 24 * 7);

    if (diffWkNext <= 0 || diffWkNext2 <= 0) {
        setSafeText('predNextQty', 'Error');
        setSafeText('predNext2Qty', 'Error');
        setSafeText('predNext3Qty', 'Error');
        if (predictEl) predictEl.innerHTML = `<span class="text-xs text-red-400 font-bold">Date Setting Error (Past date selected)</span>`;
        return;
    }

    const skuShipments = (window.shipmentOrders && window.shipmentOrders[selectedCode]) || [];
    const shipNext  = skuShipments.filter(s => s.status !== 'arrived' && s.arrivalDate === targetNext).reduce((a, s) => a + s.orderQty, 0);
    const shipNext2 = skuShipments.filter(s => s.status !== 'arrived' && s.arrivalDate === targetNext2).reduce((a, s) => a + s.orderQty, 0);
    const shipNext3 = targetNext3 ? skuShipments.filter(s => s.status !== 'arrived' && s.arrivalDate === targetNext3).reduce((a, s) => a + s.orderQty, 0) : 0;
    const stockNext  = latestQty - (past12WAvg * diffWkNext)  + shipNext;
    const stockNext2 = latestQty - (past12WAvg * diffWkNext2) + shipNext + shipNext2;
    let stockNext3 = null;
    if (targetNext3) {
        const diffWkNext3 = (new Date(targetNext3) - baseDate) / (1000 * 60 * 60 * 24 * 7);
        if (diffWkNext3 > 0) stockNext3 = latestQty - (past12WAvg * diffWkNext3) + shipNext + shipNext2 + shipNext3;
    }

    setSafeText('predNextQty',  Math.max(0, Math.round(stockNext)).toLocaleString()  + ' ' + uomText);
    setSafeText('predNext2Qty', Math.max(0, Math.round(stockNext2)).toLocaleString() + ' ' + uomText);
    setSafeText('predNext3Qty', stockNext3 !== null ? Math.max(0, Math.round(stockNext3)).toLocaleString() + ' ' + uomText : '-');

    // Update hints with current input values
    const curNext  = parseInt(document.getElementById('shipOrderNextQty')?.value)  || 0;
    const curNext2 = parseInt(document.getElementById('shipOrderNext2Qty')?.value) || 0;
    const curNext3 = parseInt(document.getElementById('shipOrderNext3Qty')?.value) || 0;
    _updateShipHints(curNext, curNext2, curNext3);

    if (predictEl) {
        const cNext  = Math.ceil(Math.max(0, stockNext));
        const cNext2 = Math.ceil(Math.max(0, stockNext2));
        const cNext3 = stockNext3 !== null ? Math.ceil(Math.max(0, stockNext3)) : null;
        let html = `<div class="flex gap-4 mt-1">`;
        if (cNext < safetyStock) {
            html += `<div class="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded w-full"><span class="text-xl">🚨</span><div><p class="text-xs font-bold text-red-700">Urgent: Below Safety Stock (${safetyStock}) before ${targetNext}</p><p class="text-[10px] text-red-600">Short by <span class="font-bold text-sm">${safetyStock - cNext}</span> ${uomText}</p></div></div>`;
        } else if (cNext2 < safetyStock) {
            html += `<div class="flex items-center gap-2 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded w-full"><span class="text-xl">📦</span><div><p class="text-xs font-bold text-yellow-800">Order Now: Will fall below Safety Stock (${safetyStock}) before ${targetNext2}</p><p class="text-[10px] text-yellow-700">Short by <span class="font-bold text-sm">${safetyStock - cNext2}</span> ${uomText}</p></div></div>`;
        } else if (cNext3 !== null && cNext3 < safetyStock) {
            html += `<div class="flex items-center gap-2 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded w-full"><span class="text-xl">⚠️</span><div><p class="text-xs font-bold text-orange-800">Plan Ahead: Will fall below Safety Stock (${safetyStock}) before ${targetNext3}</p><p class="text-[10px] text-orange-700">Short by <span class="font-bold text-sm">${safetyStock - cNext3}</span> ${uomText}</p></div></div>`;
        } else {
            const safeUntil = targetNext3 ? targetNext3 : targetNext2;
            html += `<div class="flex items-center gap-2 bg-green-50 border border-green-200 px-3 py-1.5 rounded w-full"><span class="text-xl">✅</span><div><p class="text-xs font-bold text-green-700">Safe: No order needed</p><p class="text-[10px] text-green-600">Remains above safety line until 3rd Next Arrival (${safeUntil})</p></div></div>`;
        }
        html += `</div>`;
        predictEl.innerHTML = html;
    }
}

function _updateShipHints(qtyNext, qtyNext2, qtyNext3) {
    const auto = window._shipAutoQtys || { next: 0, next2: 0, next3: 0 };
    const upd = (id, qty, autoQty) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (qty !== autoQty) { el.textContent = `auto: ${autoQty.toLocaleString()}`; el.classList.remove('hidden'); }
        else el.classList.add('hidden');
    };
    upd('hintShipNext',  qtyNext,  auto.next);
    upd('hintShipNext2', qtyNext2, auto.next2);
    upd('hintShipNext3', qtyNext3, auto.next3);
}