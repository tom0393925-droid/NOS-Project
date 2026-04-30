// ==========================================
// js/main.js: Core app behavior and events
// ==========================================

let isSetupView = true;

function toggleSetupView() {
    isSetupView = !isSetupView;
    const dashView = document.getElementById('dashboardView');
    const setupView = document.getElementById('setupView');
    const btn = document.getElementById('btnToggleSetup');

    if (isSetupView) {
        dashView.style.display = 'none';
        dashView.classList.add('hidden'); 
        setupView.style.display = 'block';
        setupView.classList.remove('hidden'); 
        btn.innerHTML = '⬅️ Back to Dashboard';
        btn.classList.replace('bg-slate-700', 'bg-blue-600');
        btn.classList.replace('hover:bg-slate-800', 'hover:bg-blue-700');
        btn.classList.replace('border-slate-600', 'border-blue-500');
    } else {
        dashView.style.display = 'flex';
        dashView.classList.remove('hidden'); 
        setupView.style.display = 'none';
        setupView.classList.add('hidden'); 
        btn.innerHTML = '⚙️ Data Setup';
        btn.classList.replace('bg-blue-600', 'bg-slate-700');
        btn.classList.replace('hover:bg-blue-700', 'hover:bg-slate-800');
        btn.classList.replace('border-blue-500', 'border-slate-600');
        checkDashboardVisibility();
        const analyticsBtn = document.querySelector('[onclick*="analyticsTab"]');
        if (analyticsBtn) switchTab('analyticsTab', analyticsBtn);
    }
}

function checkDashboardVisibility() {
    const hasData = loadedWeeks > 0 && Object.keys(historyData).length > 0;
    const nosPlaceholder = document.getElementById('nosPlaceholder');
    const resultsArea = document.getElementById('resultsArea');
    if(nosPlaceholder && resultsArea) {
        nosPlaceholder.style.display = hasData ? 'none' : 'block';
        resultsArea.style.display = hasData ? 'block' : 'none';
    }
}

// ★ 軽量化の要：見ているタブだけを処理する（遅延レンダリング）
function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(c => { c.classList.remove('active'); c.style.display = 'none'; });
    document.querySelectorAll('.tab-button').forEach(b => {
        b.classList.remove('active');
        b.classList.replace('text-white', 'text-slate-300');
        b.classList.replace('bg-slate-700', 'bg-transparent');
    });
    
    const targetTab = document.getElementById(tabId);
    if(targetTab) { targetTab.classList.add('active'); targetTab.style.display = 'block'; }
    if(btnElement) {
        btnElement.classList.add('active');
        btnElement.classList.replace('text-slate-300', 'text-white');
        btnElement.classList.replace('bg-transparent', 'bg-slate-700');
    }

    // ★ アクティブになったタブの機能だけを呼び出す
    if (typeof _showLoading === 'function') _showLoading('画面を描画中...');
    setTimeout(() => {
        if (tabId === 'nosTab' && typeof renderActionList === 'function') {
            renderActionList();
        } else if (tabId === 'analyticsTab' && typeof updateAnalyticsUI === 'function') {
            updateAnalyticsUI();
        } else if (tabId === 'mapTab' && typeof renderWarehouseMap === 'function') {
            renderWarehouseMap();
            if (typeof updateAnalyticsUI === 'function') updateAnalyticsUI();
        }
        if (typeof _hideLoading === 'function') _hideLoading();
    }, 0);

    // ★ crossAnalysisSection と simulatorArea は mapTab のみで表示
    const _cross = document.getElementById('crossAnalysisSection');
    const _sim   = document.getElementById('simulatorArea');
    if (tabId !== 'mapTab') {
        if (_cross) _cross.style.display = 'none';
        if (_sim)   _sim.style.display   = 'none';
    }
}

function updateSingleSlot() {
    const fileInput = document.getElementById('fileWeek');
    const slot = document.getElementById('slotWeek');
    const nameDiv = document.getElementById('nameWeek');
    if (fileInput && fileInput.files.length > 0) {
        nameDiv.innerText = fileInput.files[0].name;
        nameDiv.classList.replace('bg-gray-100', 'bg-blue-100');
        nameDiv.classList.replace('text-gray-500', 'text-blue-700');
        slot.classList.add('border-blue-400', 'bg-blue-50/30');
    } else {
        if(nameDiv) {
            nameDiv.innerText = "No file selected";
            nameDiv.classList.replace('bg-blue-100', 'bg-gray-100');
            nameDiv.classList.replace('text-blue-700', 'text-gray-500');
        }
        if(slot) slot.classList.remove('border-blue-400', 'bg-blue-50/30');
    }
}

// NEW: Invoice Data用ファイル表示更新
function updateInvoiceSlot() {
    const fileInput = document.getElementById('fileInvoice');
    const slot = document.getElementById('slotInvoiceWeek');
    const nameDiv = document.getElementById('nameInvoiceWeek');
    if (fileInput && fileInput.files.length > 0) {
        nameDiv.innerText = fileInput.files[0].name;
        nameDiv.classList.replace('bg-gray-100', 'bg-purple-100');
        nameDiv.classList.replace('text-gray-500', 'text-purple-700');
        slot.classList.add('border-purple-400', 'bg-purple-50/30');
    } else {
        if(nameDiv) {
            nameDiv.innerText = "No file selected";
            nameDiv.classList.replace('bg-purple-100', 'bg-gray-100');
            nameDiv.classList.replace('text-purple-700', 'text-gray-500');
        }
        if(slot) slot.classList.remove('border-purple-400', 'bg-purple-50/30');
    }
}

// ==========================================
// Shipment Order: on-site edit (in-memory only, save via Order Planning table)
// ==========================================

function updateShipmentOrder(slot, value) {
    if (!currentSelectedSKU) return;
    const qty = parseInt(value) || 0;
    const masterData = skuMaster[currentSelectedSKU] || {};
    const stType = masterData.storageType || 'Dry';

    const tNext  = stType === 'Frozen' ? globalFrozenNext  : globalDryNext;
    const tNext2 = stType === 'Frozen' ? globalFrozenNext2 : globalDryNext2;
    const tNext3 = stType === 'Frozen' ? globalFrozenNext3 : globalDryNext3;

    const arrivalDate = slot === 'next' ? tNext : slot === 'next2' ? tNext2 : tNext3;
    if (!arrivalDate) return;

    if (!window.shipmentOrders) window.shipmentOrders = {};
    if (!window.shipmentOrders[currentSelectedSKU]) window.shipmentOrders[currentSelectedSKU] = [];

    const orders = window.shipmentOrders[currentSelectedSKU];
    const setOrder = (date, newQty) => {
        if (!date) return;
        const e = orders.find(s => s.arrivalDate === date);
        if (e) e.orderQty = newQty; else orders.push({ arrivalDate: date, orderQty: newQty, status: 'pending' });
    };
    setOrder(arrivalDate, qty);

    // Cascade: recalculate subsequent shipment quantities
    if (slot !== 'next3' && tNext2) {
        const targetLots = Object.values(historyData).filter(h => h.code === currentSelectedSKU);
        if (targetLots.length > 0) {
            let latestQty = 0;
            targetLots.forEach(lot => { latestQty += (lot.qtys[loadedWeeks - 1] || 0); });
            const wks12 = Math.min(12, loadedWeeks);
            const aggQtys  = new Array(loadedWeeks).fill(0);
            const aggSales = new Array(loadedWeeks).fill(0);
            for (let i = 0; i < loadedWeeks; i++) {
                targetLots.forEach(lot => { aggQtys[i] += (lot.qtys[i] || 0); aggSales[i] += (lot.sales[i] || 0); });
            }
            let hasStk = false, recentZero = 0;
            for (let i = 0; i < loadedWeeks; i++) {
                if (aggQtys[i] > 0) hasStk = true;
                if (i >= loadedWeeks - wks12 && aggQtys[i] === 0) recentZero++;
            }
            let avg;
            if (hasStk && recentZero > 0 && typeof _calcStockoutAvg === 'function') {
                avg = _calcStockoutAvg(aggQtys, aggSales, loadedWeeks);
            } else {
                let salesSum = 0;
                for (let i = loadedWeeks - wks12; i < loadedWeeks; i++) salesSum += aggSales[i];
                avg = wks12 > 0 ? salesSum / wks12 : 0;
            }
            const safety = Math.round(avg * safetyWeeks);
            const base = getLatestDataDate();
            const dw1 = tNext  ? (new Date(tNext)  - base) / 604800000 : 0;
            const dw2 = tNext2 ? (new Date(tNext2) - base) / 604800000 : 0;
            const dw3 = tNext3 ? (new Date(tNext3) - base) / 604800000 : 0;

            if (slot === 'next' && dw2 > 0) {
                // 1st changed → recalculate 2nd
                const depletedAtNext = Math.max(0, latestQty - avg * dw1);
                // Zero-stock: arrival week has no sales; use chart-aligned week count
                const isZeroStock = latestQty === 0;
                const chartWks12 = isZeroStock ? Math.ceil(dw2) - Math.ceil(dw1) - 1 : dw2 - dw1;
                const predAt2nd = isZeroStock
                    ? Math.max(0, qty - avg * chartWks12)
                    : Math.max(0, depletedAtNext + qty - avg * (dw2 - dw1));
                const auto2 = tNext3 && dw3 > dw2
                    ? Math.max(0, Math.ceil(safety + avg * (dw3 - dw2) - predAt2nd))
                    : Math.max(0, Math.ceil(safety - predAt2nd));
                const el2 = document.getElementById('shipOrderNext2Qty');
                if (el2 && document.activeElement !== el2) el2.value = auto2 || '';
                setOrder(tNext2, auto2);
                if (window._shipAutoQtys) window._shipAutoQtys.next2 = auto2;
                // Also cascade to 3rd
                if (tNext3 && dw3 > dw2) {
                    const predAt3rd = Math.max(0, predAt2nd + auto2 - avg * (dw3 - dw2));
                    const auto3 = Math.max(0, Math.ceil(safety - predAt3rd));
                    const el3 = document.getElementById('shipOrderNext3Qty');
                    if (el3 && document.activeElement !== el3) el3.value = auto3 || '';
                    setOrder(tNext3, auto3);
                    if (window._shipAutoQtys) window._shipAutoQtys.next3 = auto3;
                }
                // Refresh hint labels to reflect new auto values
                if (typeof _updateShipHints === 'function') {
                    const v2 = parseInt(document.getElementById('shipOrderNext2Qty')?.value) || 0;
                    const v3 = parseInt(document.getElementById('shipOrderNext3Qty')?.value) || 0;
                    _updateShipHints(qty, v2, v3);
                }
            } else if (slot === 'next2' && tNext3 && dw3 > dw2) {
                // 2nd changed → recalculate 3rd
                const shipNext = orders.find(s => s.arrivalDate === tNext)?.orderQty || 0;
                const depletedAtNext = Math.max(0, latestQty - avg * dw1);
                const stockAt2nd = Math.max(0, depletedAtNext + shipNext - avg * (dw2 - dw1)) + qty;
                const predAt3rd = Math.max(0, stockAt2nd - avg * (dw3 - dw2));
                const auto3 = Math.max(0, Math.ceil(safety - predAt3rd));
                const el3 = document.getElementById('shipOrderNext3Qty');
                if (el3 && document.activeElement !== el3) el3.value = auto3 || '';
                setOrder(tNext3, auto3);
                if (window._shipAutoQtys) window._shipAutoQtys.next3 = auto3;
                // Refresh hint labels
                if (typeof _updateShipHints === 'function') {
                    const v1 = parseInt(document.getElementById('shipOrderNextQty')?.value) || 0;
                    const v3 = parseInt(document.getElementById('shipOrderNext3Qty')?.value) || 0;
                    _updateShipHints(v1, qty, v3);
                }
            }
        }
    }

    // チャートと残高テキストのみ軽量更新（フォーカスを奪わない）
    if (typeof updateChartPeriod === 'function') updateChartPeriod();
    if (typeof refreshPredictedBalances === 'function') refreshPredictedBalances();
}

// ==========================================
// Container Arrival Dates: save / restore
// ==========================================

async function saveDatesAndRender() {
    globalDryNext    = document.getElementById('dryNextDate')?.value    || '';
    globalDryNext2   = document.getElementById('dryNext2Date')?.value   || '';
    globalDryNext3   = document.getElementById('dryNext3Date')?.value   || '';
    globalFrozenNext = document.getElementById('frozenNextDate')?.value || '';
    globalFrozenNext2= document.getElementById('frozenNext2Date')?.value|| '';
    globalFrozenNext3= document.getElementById('frozenNext3Date')?.value|| '';

    // Supabase に保存（失敗してもUIは継続）
    try {
        await sbSaveContainerDates({
            dryNext:     globalDryNext,
            dryNext2:    globalDryNext2,
            dryNext3:    globalDryNext3,
            frozenNext:  globalFrozenNext,
            frozenNext2: globalFrozenNext2,
            frozenNext3: globalFrozenNext3,
        });
    } catch (e) {
        console.error('Failed to save container dates:', e);
    }

    if (currentSelectedSKU && typeof renderSKUDetails === 'function') {
        renderSKUDetails(currentSelectedSKU);
    }
    // ★ 到着日が変わったら Order Action Required List も再構築
    if (typeof _buildOrderData === 'function' && typeof renderOrderTable === 'function') {
        _buildOrderData();
        renderOrderTable();
    }
}

// 過去の到着日を除去して残りを前に詰める
function _shiftExpiredDates(dates) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const shift = (...ds) => {
        const future = ds.filter(d => d && new Date(d) >= today);
        while (future.length < 3) future.push('');
        return future;
    };

    const dry    = shift(dates.dryNext,    dates.dryNext2,    dates.dryNext3);
    const frozen = shift(dates.frozenNext, dates.frozenNext2, dates.frozenNext3);

    return {
        dryNext:     dry[0],    dryNext2:    dry[1],    dryNext3:    dry[2],
        frozenNext:  frozen[0], frozenNext2: frozen[1], frozenNext3: frozen[2],
    };
}

// sbLoadAllData() から呼ばれる：取得済みデータをグローバル変数とUIに展開
async function restoreContainerDatesFromData(dates) {
    const shifted = _shiftExpiredDates(dates);

    // 過去日が1つでもあった場合は自動でSupabaseを更新
    const hasExpired =
        shifted.dryNext    !== (dates.dryNext    || '') ||
        shifted.dryNext2   !== (dates.dryNext2   || '') ||
        shifted.dryNext3   !== (dates.dryNext3   || '') ||
        shifted.frozenNext !== (dates.frozenNext  || '') ||
        shifted.frozenNext2 !== (dates.frozenNext2 || '') ||
        shifted.frozenNext3 !== (dates.frozenNext3 || '');

    if (hasExpired) {
        try { await sbSaveContainerDates(shifted); } catch (e) { console.error(e); }
    }

    globalDryNext     = shifted.dryNext;
    globalDryNext2    = shifted.dryNext2;
    globalDryNext3    = shifted.dryNext3;
    globalFrozenNext  = shifted.frozenNext;
    globalFrozenNext2 = shifted.frozenNext2;
    globalFrozenNext3 = shifted.frozenNext3;

    if (document.getElementById('dryNextDate'))     document.getElementById('dryNextDate').value     = globalDryNext;
    if (document.getElementById('dryNext2Date'))    document.getElementById('dryNext2Date').value    = globalDryNext2;
    if (document.getElementById('dryNext3Date'))    document.getElementById('dryNext3Date').value    = globalDryNext3;
    if (document.getElementById('frozenNextDate'))  document.getElementById('frozenNextDate').value  = globalFrozenNext;
    if (document.getElementById('frozenNext2Date')) document.getElementById('frozenNext2Date').value = globalFrozenNext2;
    if (document.getElementById('frozenNext3Date')) document.getElementById('frozenNext3Date').value = globalFrozenNext3;
}

// 初回ロード時（Supabaseデータ読込前）のフォールバック：localStorageから復元
function restoreContainerDates() {
    globalDryNext     = localStorage.getItem('nos_dryNext')     || '';
    globalDryNext2    = localStorage.getItem('nos_dryNext2')    || '';
    globalDryNext3    = localStorage.getItem('nos_dryNext3')    || '';
    globalFrozenNext  = localStorage.getItem('nos_frozenNext')  || '';
    globalFrozenNext2 = localStorage.getItem('nos_frozenNext2') || '';
    globalFrozenNext3 = localStorage.getItem('nos_frozenNext3') || '';

    if (document.getElementById('dryNextDate'))     document.getElementById('dryNextDate').value     = globalDryNext;
    if (document.getElementById('dryNext2Date'))    document.getElementById('dryNext2Date').value    = globalDryNext2;
    if (document.getElementById('dryNext3Date'))    document.getElementById('dryNext3Date').value    = globalDryNext3;
    if (document.getElementById('frozenNextDate'))  document.getElementById('frozenNextDate').value  = globalFrozenNext;
    if (document.getElementById('frozenNext2Date')) document.getElementById('frozenNext2Date').value = globalFrozenNext2;
    if (document.getElementById('frozenNext3Date')) document.getElementById('frozenNext3Date').value = globalFrozenNext3;
}

document.addEventListener('click', function(event) {
    const input = document.getElementById('skuSearchInput');
    const suggestList = document.getElementById('searchSuggestList');
    if (input && suggestList && !input.contains(event.target) && !suggestList.contains(event.target)) {
        suggestList.classList.add('hidden');
    }
});

// ★ 根本治療：ブラウザのおせっかいな「スクロール位置の記憶」を完全に無効化する
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

window.onload = function() {
    const _authTimer = setTimeout(() => {
        const overlay = document.getElementById('authOverlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            console.warn('[Auth] Timeout - redirecting to login');
            window.location.href = 'login.html';
        }
    }, 8000);

    sbInitAuth(
        function(user) {
            clearTimeout(_authTimer);
            document.getElementById('authOverlay')?.classList.add('hidden');
            document.getElementById('userEmail').textContent = user.email;
            document.getElementById('userInfoBar').classList.remove('hidden');
        },
        function() {
            clearTimeout(_authTimer);
            window.location.href = 'login.html';
        }
    );

    // HTMLのパズルズレを自動修復
    const dashBg = document.querySelector('.bg-gray-100.flex-grow');
    const mapTab = document.getElementById('mapTab');
    if (dashBg && mapTab) dashBg.appendChild(mapTab);

    const swInput = document.getElementById('safetyWeeksInput');
    if (swInput) swInput.value = safetyWeeks;
    restoreContainerDates();
    if (typeof renderMasterList === "function") renderMasterList();
    const analyticsBtn = document.querySelector('[onclick*="analyticsTab"]');
    if (analyticsBtn) switchTab('analyticsTab', analyticsBtn);
    if (typeof checkDashboardVisibility === "function") checkDashboardVisibility();
    window.scrollTo(0, 0);
};