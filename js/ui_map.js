// ==========================================
// js/ui_map.js: Warehouse Heatmap & Optimization Logic
// ==========================================

const RACK_DISTANCES = {
    'PS-A': 0,
    'I': 5, 'J': 10, 'K': 15, 'L': 20,
    'H': 15, 'G': 20, 'F': 25, 'E': 30, 'D': 35, 'C': 40, 'B': 45, 'A': 50,
    'M': 35, 'N': 40, 'O': 45, 'P': 50
};

// ★ シミュレーター用のグローバル変数
let simMoves = {}; 
let simBaseData = { totalCost: 0, items: {} };

function renderWarehouseMap() {
    if (typeof skuMaster === 'undefined' || typeof invoiceHistoryData === 'undefined') return;
    
    const rackHits = {};
    const racks = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','PS-A'];
    racks.forEach(r => rackHits[r] = { total: 0, skus: [] });

    for (const code in invoiceHistoryData) {
        const hitsArr = invoiceHistoryData[code].hits || [];
        const periodEl = document.getElementById('hitPeriodSelect');
        const period = periodEl ? periodEl.value : 'all';
        
        let sumHits = 0;
        if (period === 'all') {
            sumHits = hitsArr.reduce((a, b) => a + b, 0);
        } else {
            const wks = parseInt(period);
            const totalLoaded = typeof loadedInvoiceWeeks !== 'undefined' ? loadedInvoiceWeeks : hitsArr.length;
            const startIdx = Math.max(0, totalLoaded - wks);
            for (let i = startIdx; i < totalLoaded; i++) {
                sumHits += (hitsArr[i] || 0);
            }
        }

        if (sumHits > 0 && skuMaster[code] && skuMaster[code].location) {
            const loc = skuMaster[code].location;
            const weight = parseFloat(skuMaster[code].weight) || 0;
            if (rackHits[loc]) {
                rackHits[loc].total += sumHits;
                const rankInfo = window.hitAbcRanks ? window.hitAbcRanks[code] : '-';
                rackHits[loc].skus.push({
                    code: code,
                    name: skuMaster[code].name || "No Name",
                    hits: sumHits,
                    weight: weight,
                    rank: rankInfo
                });
            }
        }
    }

    racks.forEach(rackId => {
        const el = document.getElementById('rack-' + rackId);
        if (!el) return;

        const data = rackHits[rackId];
        el.className = 'rack-box ' + (['A','B','C','D','E','F','G','H','I'].includes(rackId) ? 'rack-v' : (['J','K','L'].includes(rackId) ? 'rack-s' : (rackId==='PS-A' ? 'rack-area' : 'rack-h')));

        if (data.total > 50) {
            el.classList.add('bg-red-200', 'border-red-600', 'text-red-900', 'cursor-pointer');
        } else if (data.total > 20) {
            el.classList.add('bg-yellow-200', 'border-yellow-600', 'text-yellow-900', 'cursor-pointer');
        } else if (data.total > 0) {
            el.classList.add('bg-blue-200', 'border-blue-600', 'text-blue-900', 'cursor-pointer');
        } else {
            el.classList.add('bg-gray-100', 'border-gray-300', 'text-gray-400');
        }

        el.onclick = () => {
            if (data.skus.length > 0) {
                showRackDetail(rackId, data.skus);
            } else {
                const area = document.getElementById('rackDetailArea');
                if(area) area.style.display = 'none';
            }
        };
    });
}

function showRackDetail(rackId, skus) {
    const area = document.getElementById('rackDetailArea');
    const title = document.getElementById('rackDetailTitle');
    const tbody = document.getElementById('rackDetailBody');
    if (!area || !title || !tbody) return;

    const dist = RACK_DISTANCES[rackId] !== undefined ? RACK_DISTANCES[rackId] : 100;
    title.innerHTML = `Location <span class="text-blue-600">[ ${rackId} ]</span> <span class="text-sm text-gray-500 ml-2">(Distance from PS-A: <b>${dist}</b>)</span>`;
    tbody.innerHTML = '';

    skus.forEach(sku => {
        let weightFactor = 1.0;
        if (sku.weight >= 20.0) weightFactor = 2.0;
        else if (sku.weight >= 10.0) weightFactor = 1.5;
        sku.costScore = Math.round(sku.hits * dist * weightFactor);
    });
    skus.sort((a, b) => b.costScore - a.costScore);

    skus.forEach(sku => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0";
        
        tr.onclick = () => {
            const searchEl = document.getElementById('skuSearchInput');
            if (searchEl) {
                searchEl.value = sku.code;
                if(typeof handleSearchInput === 'function') handleSearchInput();
                if(typeof renderSKUDetails === 'function') renderSKUDetails(sku.code);
                
                const tabs = document.querySelectorAll('.tab-button');
                if(tabs.length > 1 && typeof switchTab === 'function') switchTab('analyticsTab', tabs[1]);
                window.scrollTo({ top: document.getElementById('skuDetailArea').offsetTop - 20, behavior: 'smooth' });
            }
        };

        let rankBadge = '-';
        if (sku.rank === 'A') rankBadge = '<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-black">A</span>';
        else if (sku.rank === 'B') rankBadge = '<span class="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-[10px] font-black">B</span>';
        else if (sku.rank === 'C') rankBadge = '<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-black">C</span>';

        let weightBadge = '';
        if (sku.weight >= 20) weightBadge = '<span class="bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 rounded text-[10px] font-black">C (Heavy)</span>';
        else if (sku.weight >= 10) weightBadge = '<span class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-2 py-0.5 rounded text-[10px] font-black">B (Mid)</span>';
        else weightBadge = '<span class="bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded text-[10px] font-black">A (Light)</span>';

        tr.innerHTML = `
            <td class="p-3 pl-6 font-bold text-indigo-700">${sku.code}</td>
            <td class="p-3 text-gray-800 text-xs truncate max-w-[200px]" title="${sku.name}">${sku.name}</td>
            <td class="p-3 text-center">${weightBadge}</td>
            <td class="p-3 text-right font-black text-gray-700">${sku.hits.toLocaleString()}</td>
            <td class="p-3 text-right font-black text-indigo-600">${sku.costScore.toLocaleString()}</td>
            <td class="p-3 text-center">${rankBadge}</td>
        `;
        tbody.appendChild(tr);
    });

    area.style.display = 'block';
    area.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function calculateOptimization() {
    let currentCost = 0;
    let skuDataList = [];
    
    // シミュレーター用のベースデータをリセット
    simBaseData = { totalCost: 0, items: {} };

    for (const code in invoiceHistoryData) {
        const hitsArr = invoiceHistoryData[code].hits || [];
        const periodEl = document.getElementById('hitPeriodSelect');
        const period = periodEl ? periodEl.value : 'all';
        
        let sumHits = 0;
        if (period === 'all') {
            sumHits = hitsArr.reduce((a, b) => a + b, 0);
        } else {
            const wks = parseInt(period);
            const totalLoaded = typeof loadedInvoiceWeeks !== 'undefined' ? loadedInvoiceWeeks : hitsArr.length;
            const startIdx = Math.max(0, totalLoaded - wks);
            for (let i = startIdx; i < totalLoaded; i++) {
                sumHits += (hitsArr[i] || 0);
            }
        }

        if (sumHits > 0 && skuMaster[code]) {
            const item = skuMaster[code];
            const weight = parseFloat(item.weight) || 0;
            
            let weightFactor = 1.0;
            if (weight >= 20.0) weightFactor = 2.0;
            else if (weight >= 10.0) weightFactor = 1.5;

            const loc = item.location || '-';
            const dist = RACK_DISTANCES[loc] !== undefined ? RACK_DISTANCES[loc] : 100; 

            const itemCost = sumHits * dist * weightFactor;
            currentCost += itemCost;

            skuDataList.push({
                code: code,
                name: item.name || "No Name",
                hits: sumHits,
                weight: weight,
                weightFactor: weightFactor,
                currentLoc: loc,
                currentDist: dist,
                score: sumHits * weightFactor 
            });

            // シミュレーター用にデータを保存
            simBaseData.items[code] = {
                name: item.name || "No Name",
                hits: sumHits,
                weightFactor: weightFactor,
                currentLoc: loc,
                currentCost: itemCost
            };
        }
    }

    simBaseData.totalCost = currentCost;
    skuDataList.sort((a, b) => b.score - a.score); 
    
    const availableRacks = Object.keys(RACK_DISTANCES)
        .filter(r => r !== 'PS-A')
        .map(r => ({ rack: r, dist: RACK_DISTANCES[r] }))
        .sort((a, b) => a.dist - b.dist);

    let optimizedCost = 0;
    const capacityPerRack = Math.ceil(skuDataList.length / availableRacks.length) || 1;
    let relocationList = []; 

    skuDataList.forEach((sku, index) => {
        const rackIndex = Math.floor(index / capacityPerRack);
        const assignedRack = availableRacks[Math.min(rackIndex, availableRacks.length - 1)];
        const targetDist = assignedRack.dist;
        
        const optCost = sku.hits * targetDist * sku.weightFactor;
        optimizedCost += optCost;

        function getZone(dist) {
            if (dist <= 20) return "Premium";
            if (dist <= 35) return "Standard";
            return "Deep";
        }

        const currentZone = getZone(sku.currentDist);
        const targetZone = getZone(targetDist);

        if (currentZone !== targetZone && sku.currentDist > targetDist) {
             const curCost = sku.hits * sku.currentDist * sku.weightFactor;
             const reduction = curCost - optCost; 
             
             if(reduction > 0) {
                 relocationList.push({
                     code: sku.code,
                     name: sku.name,
                     weight: sku.weight,
                     hits: sku.hits,
                     currentZone: currentZone,
                     targetZone: targetZone,
                     reduction: reduction
                 });
             }
        }
    });

    const currentEl = document.getElementById('optCurrentCost');
    const bestEl = document.getElementById('optBestCost');
    const impEl = document.getElementById('optImprovement');

    if(currentEl && bestEl && impEl) {
        currentEl.innerText = Math.round(currentCost).toLocaleString();
        bestEl.innerText = Math.round(optimizedCost).toLocaleString();
        
        if (currentCost > 0) {
            const diff = currentCost - optimizedCost;
            const pct = (diff / currentCost) * 100;
            impEl.innerText = `+${pct.toFixed(1)}%`;
        } else {
            impEl.innerText = "0%";
        }
    }

    renderRelocationPlan(relocationList);
    
    // ★計算が終わったらシミュレーターの準備も行う
    updateSimulatorUI();
}

function renderRelocationPlan(list) {
    const area = document.getElementById('relocationPlanArea');
    const tbody = document.getElementById('relocationPlanBody');
    if (!area || !tbody) return;

    if (list.length === 0) {
        area.style.display = 'none';
        return;
    }

    list.sort((a, b) => b.reduction - a.reduction);
    tbody.innerHTML = '';
    
    list.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-indigo-50 transition-colors";

        let weightBadge = '';
        if (item.weight >= 20) weightBadge = '<span class="bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 rounded text-[10px] font-black">C (Heavy)</span>';
        else if (item.weight >= 10) weightBadge = '<span class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-2 py-0.5 rounded text-[10px] font-black">B (Mid)</span>';
        else weightBadge = '<span class="bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded text-[10px] font-black">A (Light)</span>';

        const zoneColor = (zone) => {
            if(zone === 'Premium') return '<span class="text-emerald-600 font-black">🌟 Premium (Near)</span>';
            if(zone === 'Standard') return '<span class="text-yellow-600 font-bold">Standard (Mid)</span>';
            return '<span class="text-red-500 font-bold">Deep (Far)</span>';
        };

        tr.innerHTML = `
            <td class="p-3 pl-6 font-bold text-indigo-700">${item.code}</td>
            <td class="p-3 text-gray-800 text-xs truncate max-w-[200px]" title="${item.name}">${item.name}</td>
            <td class="p-3 text-center">${weightBadge}</td>
            <td class="p-3 text-right font-black text-gray-700">${item.hits.toLocaleString()}</td>
            <td class="p-3 text-center bg-gray-50 border-l border-gray-200">${zoneColor(item.currentZone)}</td>
            <td class="p-3 text-center bg-indigo-50 border-l border-r border-indigo-100 text-lg">➡️ ${zoneColor(item.targetZone)}</td>
            <td class="p-3 text-right font-black text-indigo-600">-${Math.round(item.reduction).toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
    });
    area.style.display = 'block';
}

// ==========================================
// ★ ここからシミュレーター専用ロジック ★
// ==========================================

function updateSimulatorUI() {
    const area = document.getElementById('simulatorArea');
    if (!area) return;
    area.style.display = 'block';

    const rackSelect = document.getElementById('simRackSelect');
    if (rackSelect && rackSelect.options && rackSelect.options.length <= 1) {
        rackSelect.innerHTML = '<option value="">-- Select Target Rack --</option>';
        const racks = Object.keys(RACK_DISTANCES).filter(r => r !== 'PS-A').sort((a,b) => RACK_DISTANCES[a] - RACK_DISTANCES[b]);
        racks.forEach(r => {
            rackSelect.innerHTML += `<option value="${r}">Rack [ ${r} ] (Distance: ${RACK_DISTANCES[r]})</option>`;
        });
    }

    renderSimMoves();
}

// ★ 追加：検索して候補を絞り込み、サジェストリストを表示する機能（絶対動くバージョン）
window.filterSimSku = function() {
    const input = document.getElementById('simSkuInput');
    const list = document.getElementById('simSkuDropdown');
    if (!input || !list) return;

    // データがまだ無いときのエラー回避
    if (!simBaseData || !simBaseData.items || Object.keys(simBaseData.items).length === 0) {
        list.innerHTML = '<li class="p-3 text-slate-400 text-xs text-center">Data is empty. Please load JSON.</li>';
        list.classList.remove('hidden');
        return;
    }

    const val = input.value.toLowerCase().trim();
    list.innerHTML = ''; 
    
    let matchCount = 0;
    const sorted = Object.keys(simBaseData.items).sort((a,b) => simBaseData.items[b].currentCost - simBaseData.items[a].currentCost);
    
    sorted.forEach(code => {
        const item = simBaseData.items[code];
        if (code.toLowerCase().includes(val) || (item.name && item.name.toLowerCase().includes(val))) {
            matchCount++;
            const li = document.createElement('li');
            li.className = "p-3 hover:bg-blue-600 cursor-pointer transition-colors flex flex-col border-b border-slate-600 last:border-0";
            
            let weightBadge = '';
            if (item.weightFactor >= 2.0) weightBadge = '<span class="bg-red-950 border border-red-700 text-red-200 px-1.5 py-0.5 rounded text-[9px] font-black ml-2">C</span>';
            else if (item.weightFactor >= 1.5) weightBadge = '<span class="bg-yellow-950 border border-yellow-700 text-yellow-200 px-1.5 py-0.5 rounded text-[9px] font-black ml-2">B</span>';
            else weightBadge = '<span class="bg-green-950 border border-green-700 text-green-200 px-1.5 py-0.5 rounded text-[9px] font-black ml-2">A</span>';

            li.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="font-bold text-blue-200">${code}${weightBadge}</span>
                    <span class="text-[10px] text-indigo-300 font-bold">${Math.round(item.currentCost).toLocaleString()} score</span>
                </div>
                <span class="text-xs text-slate-300 truncate mt-0.5">${item.name} (Now: ${item.currentLoc})</span>
            `;
            
            // ★ onmousedownを使うことで、クリック判定が逃げる（先にリストが消える）のを防ぐ
            li.onmousedown = (e) => {
                e.preventDefault();
                document.getElementById('simSkuSelect').value = code; 
                input.value = `${code} : ${item.name}`; 
                list.classList.add('hidden'); 
            };
            list.appendChild(li);
        }
    });

    if (matchCount === 0) {
        list.innerHTML = '<li class="p-3 text-slate-400 text-xs text-center">No matching SKU found.</li>';
    }
    list.classList.remove('hidden');
};

// 枠外をクリックしたら閉じる
document.addEventListener('mousedown', function(e) {
    const input = document.getElementById('simSkuInput');
    const list = document.getElementById('simSkuDropdown');
    if (input && list && e.target !== input && !list.contains(e.target)) {
        list.classList.add('hidden');
    }
});

function addSimulationMove() {
    const code = document.getElementById('simSkuSelect').value;
    const target = document.getElementById('simRackSelect').value;
    if (!code || !target) { alert("Please search for a SKU and select a Target Rack."); return; }

    if (simBaseData.items[code].currentLoc === target) {
        alert("This SKU is already at the selected location!");
        return;
    }

    simMoves[code] = target;
    
    const inputEl = document.getElementById('simSkuInput');
    if(inputEl) inputEl.value = '';
    document.getElementById('simSkuSelect').value = '';

    renderSimMoves();
}

function removeSimulationMove(code) {
    delete simMoves[code];
    renderSimMoves();
}

function renderSimMoves() {
    const tbody = document.getElementById('simMoveListBody');
    const origEl = document.getElementById('simOriginalCost');
    const newEl = document.getElementById('simNewCost');
    const gainEl = document.getElementById('simGain');
    if(!tbody) return;

    let simTotalCost = simBaseData.totalCost;
    tbody.innerHTML = '';

    const moveCodes = Object.keys(simMoves);
    if (moveCodes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-500 font-bold">No test moves yet. Select an item above and click "Test Move".</td></tr>';
    } else {
        moveCodes.forEach(code => {
            const targetLoc = simMoves[code];
            const item = simBaseData.items[code];
            const targetDist = RACK_DISTANCES[targetLoc] !== undefined ? RACK_DISTANCES[targetLoc] : 100;
            const newCost = item.hits * targetDist * item.weightFactor;
            
            const diff = item.currentCost - newCost; 
            simTotalCost = simTotalCost - item.currentCost + newCost;

            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-800 transition-colors";
            
            const diffHtml = diff >= 0 
                ? `<span class="text-emerald-400 font-black">-${Math.round(diff).toLocaleString()}</span>` 
                : `<span class="text-red-400 font-black">+${Math.round(Math.abs(diff)).toLocaleString()} (Worse)</span>`;

            tr.innerHTML = `
                <td class="p-4 pl-6 font-bold text-blue-300">${code} <span class="text-slate-400 text-xs font-normal ml-2">${item.name}</span></td>
                <td class="p-4 text-center font-bold text-slate-400">${item.currentLoc}</td>
                <td class="p-4 text-center font-black text-white">➡️ Rack [ ${targetLoc} ]</td>
                <td class="p-4 text-right">${diffHtml}</td>
                <td class="p-4 text-center">
                    <button onclick="removeSimulationMove('${code}')" class="text-red-400 hover:text-red-300 font-bold text-xs bg-slate-950 px-3 py-1.5 rounded border border-red-900 shadow-sm transition-colors">Cancel</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    origEl.innerText = Math.round(simBaseData.totalCost).toLocaleString();
    newEl.innerText = Math.round(simTotalCost).toLocaleString();

    if (simBaseData.totalCost > 0) {
        const totalDiff = simBaseData.totalCost - simTotalCost;
        const pct = (totalDiff / simBaseData.totalCost) * 100;
        if (totalDiff >= 0) {
            gainEl.className = "text-2xl font-black text-emerald-300";
            gainEl.innerText = `+${pct.toFixed(1)}%`;
        } else {
            gainEl.className = "text-2xl font-black text-red-400";
            gainEl.innerText = `${pct.toFixed(1)}% (Worse)`;
        }
    } else {
        gainEl.innerText = "0%";
    }
}

function applySimulatedMoves() {
    const moveCodes = Object.keys(simMoves);
    if (moveCodes.length === 0) { alert("No moves to apply! Please test a move first."); return; }

    if (!confirm(`Are you sure you want to apply ${moveCodes.length} moves directly to the Master Data?\nThis will update the Map permanently.`)) return;

    moveCodes.forEach(code => {
        if (skuMaster[code]) {
            skuMaster[code].location = simMoves[code];
        }
    });

    simMoves = {};
    if (typeof renderMasterList === 'function') renderMasterList();
    renderWarehouseMap(); 
    
    alert("✅ Optimization Applied Successfully!\nThe Warehouse Map and Master Data have been updated.");
}

const originalRenderWarehouseMap = renderWarehouseMap;
renderWarehouseMap = function() {
    originalRenderWarehouseMap();
    calculateOptimization();
};