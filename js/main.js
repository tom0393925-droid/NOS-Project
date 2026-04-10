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
// Shipment Order: on-site edit (in-memory only)
// ==========================================

function updateShipmentOrder(slot, value) {
    if (!currentSelectedSKU) return;
    const qty = parseInt(value) || 0;
    const masterData = skuMaster[currentSelectedSKU] || {};
    const stType = masterData.storageType || 'Dry';
    const arrivalDate = slot === 'next'
        ? (stType === 'Frozen' ? globalFrozenNext  : globalDryNext)
        : slot === 'next2'
        ? (stType === 'Frozen' ? globalFrozenNext2 : globalDryNext2)
        : (stType === 'Frozen' ? globalFrozenNext3 : globalDryNext3);
    if (!arrivalDate) return;

    if (!window.shipmentOrders) window.shipmentOrders = {};
    if (!window.shipmentOrders[currentSelectedSKU]) window.shipmentOrders[currentSelectedSKU] = [];

    const orders = window.shipmentOrders[currentSelectedSKU];
    const existing = orders.find(s => s.arrivalDate === arrivalDate);
    if (existing) { existing.orderQty = qty; }
    else { orders.push({ arrivalDate, orderQty: qty, status: 'pending' }); }

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
        console.error('コンテナ日程の保存失敗:', e);
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
    // HTMLのパズルズレを自動修復
    const dashBg = document.querySelector('.bg-gray-100.flex-grow');
    const mapTab = document.getElementById('mapTab');
    if (dashBg && mapTab) {
        dashBg.appendChild(mapTab);
    }

    restoreContainerDates();
    if (typeof renderMasterList === "function") renderMasterList();
    const firstTabBtn = document.querySelector('.tab-button');
    if(firstTabBtn) switchTab('nosTab', firstTabBtn);
    if(typeof checkDashboardVisibility === "function") checkDashboardVisibility();
    
    // 画面が描画されると同時に、静かに一番上をセットする（ガクッとならない）
    window.scrollTo(0, 0);
};