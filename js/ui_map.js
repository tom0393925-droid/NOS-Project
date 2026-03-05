// ==========================================
// js/ui_map.js: Warehouse Heatmap Logic
// ==========================================

function renderWarehouseMap() {
    if (typeof skuMaster === 'undefined' || typeof invoiceHistoryData === 'undefined') return;
    
    // 1. 各棚（Location）の総ヒット数を集計するための箱を準備
    const rackHits = {};
    const racks = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','PS-A'];
    racks.forEach(r => rackHits[r] = { total: 0, skus: [] });

    // 2. Invoiceデータから、棚ごとにヒット数（ピッキング回数）を足し算する
    for (const code in invoiceHistoryData) {
        const hits = invoiceHistoryData[code].hits || [];
        // 今回はとりあえず「全期間（All time）」の合計を計算
        let sumHits = hits.reduce((a, b) => a + b, 0);

        if (sumHits > 0 && skuMaster[code] && skuMaster[code].location) {
            const loc = skuMaster[code].location;
            if (rackHits[loc]) {
                rackHits[loc].total += sumHits;
                // ABC分析のランクを取得（A, B, C）
                const rankInfo = window.hitAbcRanks ? window.hitAbcRanks[code] : '-';
                rackHits[loc].skus.push({
                    code: code,
                    name: getSkuName(code),
                    hits: sumHits,
                    rank: rankInfo
                });
            }
        }
    }

    // 3. 集計結果をもとに、マップの棚の色を塗り替える
    racks.forEach(rackId => {
        const el = document.getElementById('rack-' + rackId);
        if (!el) return;

        const data = rackHits[rackId];
        // 既存の背景色・枠線色をリセット
        el.className = el.className.replace(/bg-\w+-\d+/g, '').replace(/border-\w+-\d+/g, '');

        // ヒット数に応じて色を変える（しきい値は適宜調整可能です）
        if (data.total > 150) {
            el.classList.add('bg-red-200', 'border-red-600', 'cursor-pointer');
        } else if (data.total > 50) {
            el.classList.add('bg-yellow-200', 'border-yellow-600', 'cursor-pointer');
        } else if (data.total > 0) {
            el.classList.add('bg-blue-200', 'border-blue-600', 'cursor-pointer');
        } else {
            el.classList.add('bg-gray-100', 'border-gray-400');
        }

        // 4. 棚をクリックしたときに、その棚にある商品リストを下に表示する
        el.onclick = () => {
            if (data.skus.length > 0) {
                showRackDetail(rackId, data.skus);
            }
        };
    });
}

function showRackDetail(rackId, skus) {
    const area = document.getElementById('rackDetailArea');
    const title = document.getElementById('rackDetailTitle');
    const tbody = document.getElementById('rackDetailBody');
    if (!area || !title || !tbody) return;

    title.innerText = `Location [ ${rackId} ] Details - ${skus.length} SKUs`;
    tbody.innerHTML = '';

    // ヒット数が多い順（降順）に並び替え
    skus.sort((a, b) => b.hits - a.hits);

    skus.forEach(sku => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0";
        
        // リストをクリックすると、Analytics画面の詳細に飛ぶ機能
        tr.onclick = () => {
            const searchEl = document.getElementById('skuSearchInput');
            if (searchEl) {
                searchEl.value = sku.code;
                if(typeof handleSearchInput === 'function') handleSearchInput();
                if(typeof renderSKUDetails === 'function') renderSKUDetails(sku.code);
                
                // Analyticsタブに切り替える
                const tabs = document.querySelectorAll('.tab-button');
                if(tabs.length > 1 && typeof switchTab === 'function') switchTab('analyticsTab', tabs[1]);
                window.scrollTo({ top: document.getElementById('skuDetailArea').offsetTop - 20, behavior: 'smooth' });
            }
        };

        // ABCランクのカラフルなバッジを作成
        let rankBadge = '-';
        if (sku.rank === 'A') rankBadge = '<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-black">A</span>';
        else if (sku.rank === 'B') rankBadge = '<span class="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-[10px] font-black">B</span>';
        else if (sku.rank === 'C') rankBadge = '<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-black">C</span>';

        tr.innerHTML = `
            <td class="p-3 pl-6 font-bold text-indigo-700">${sku.code}</td>
            <td class="p-3 text-gray-800 text-xs truncate max-w-[200px]" title="${sku.name}">${sku.name}</td>
            <td class="p-3 text-right font-black text-gray-700">${sku.hits.toLocaleString()}</td>
            <td class="p-3 text-center">${rankBadge}</td>
        `;
        tbody.appendChild(tr);
    });

    area.style.display = 'block';
    area.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}