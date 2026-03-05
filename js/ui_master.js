// ==========================================
// js/ui_master.js: Master Data Management UI
// ==========================================

function autoFillMasterForm() {
    const code = document.getElementById('mCode').value.trim();
    const btn = document.getElementById('btnMasterUpdate');
    const resetBtn = document.getElementById('btnMasterReset');
    const nameField = document.getElementById('mName');
    
    if (!code) { resetMasterForm(); return; }
    resetBtn.classList.remove('hidden');

    if (typeof skuMaster !== 'undefined' && skuMaster[code]) {
        const data = skuMaster[code];
        nameField.value = data.name || (typeof getSkuName === 'function' ? getSkuName(code) : code);
        
        // ★ Locationの値を読み込み
        document.getElementById('mLocation').value = data.location || "-";
        
        document.getElementById('mTc').value = data.tc || 0;
        document.getElementById('mPrice').value = data.price || 0;
        document.getElementById('mUom').value = data.uom || "-";
        document.getElementById('mStorage').value = data.storageType || "Dry";
        document.getElementById('mSafety').value = data.safetyStock || 0;
        document.getElementById('mFF').checked = data.isFF || false;
        
        btn.innerText = "💾 Save Changes";
        btn.className = "bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-md transition-colors whitespace-nowrap";
    } else {
        btn.innerText = "➕ Create New";
        btn.className = "bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-bold shadow-md transition-colors whitespace-nowrap";
        if(!nameField.value) nameField.value = (typeof getSkuName === 'function' && getSkuName(code) !== "Unknown Item") ? getSkuName(code) : "";
        // 新規の場合はLocationを "-" にリセット
        document.getElementById('mLocation').value = "-";
    }
}

function editMaster(code) {
    const codeInput = document.getElementById('mCode');
    codeInput.value = code;
    codeInput.disabled = true; 
    autoFillMasterForm();
    window.scrollTo({ top: document.getElementById('masterInputArea').offsetTop - 50, behavior: 'smooth' });
}

function resetMasterForm() {
    const ids = ['mCode', 'mName', 'mTc', 'mPrice', 'mUom', 'mSafety'];
    ids.forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = ''; });
    if(document.getElementById('mLocation')) document.getElementById('mLocation').value = "-"; // リセット時にもLocationを空に
    if(document.getElementById('mStorage')) document.getElementById('mStorage').value = 'Dry';
    if(document.getElementById('mFF')) document.getElementById('mFF').checked = false;
    
    const codeInput = document.getElementById('mCode');
    codeInput.disabled = false; 
    codeInput.focus();
    
    const btn = document.getElementById('btnMasterUpdate');
    btn.innerText = "➕ Update";
    btn.className = "bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-bold shadow-md transition-colors whitespace-nowrap";
    document.getElementById('btnMasterReset').classList.add('hidden');
}

function saveSingleMaster() {
    const codeEl = document.getElementById('mCode');
    if (!codeEl) return;
    const code = codeEl.value.trim();
    if (!code) return alert("Code is required.");
    
    if (typeof skuMaster !== 'undefined') {
        skuMaster[code] = { 
            name: document.getElementById('mName').value.trim(), 
            location: document.getElementById('mLocation').value, // ★ Locationを保存
            tc: parseFloat(document.getElementById('mTc').value) || 0, 
            price: parseFloat(document.getElementById('mPrice').value) || 0, 
            uom: document.getElementById('mUom').value.trim() || "-", 
            storageType: document.getElementById('mStorage').value || "Dry", 
            safetyStock: parseInt(document.getElementById('mSafety').value, 10) || 0, 
            isFF: document.getElementById('mFF').checked || false 
        };
    }
    
    resetMasterForm();
    renderMasterList();
    
    const status = document.getElementById('masterStatus');
    if (status) {
        status.innerText = `✅ ${code} saved.`;
        setTimeout(() => { status.innerText = ''; }, 3000);
    }
}

function deleteMaster(code) {
    if (confirm(`Delete ${code}?`)) {
        if (typeof skuMaster !== 'undefined') {
            delete skuMaster[code];
        }
        renderMasterList();
    }
}

function renderMasterList() {
    const tbody = document.getElementById('masterListBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (typeof skuMaster === 'undefined') return;

    const searchInput = document.getElementById('masterTableSearch');
    const searchVal = searchInput ? searchInput.value.toLowerCase() : "";
    const keys = Object.keys(skuMaster).sort(); 
    
    if(document.getElementById('uiWeekCount') && typeof loadedWeeks !== 'undefined') {
        document.getElementById('uiWeekCount').innerText = loadedWeeks;
    }
    if(document.getElementById('uiInvoiceWeekCount') && typeof loadedInvoiceWeeks !== 'undefined') {
        document.getElementById('uiInvoiceWeekCount').innerText = loadedInvoiceWeeks;
    }
    
    keys.forEach(code => {
        const data = skuMaster[code];
        if (!data) return;

        const itemName = typeof getSkuName === 'function' ? getSkuName(code) : (data.name || code);
        if (searchVal && !code.toLowerCase().includes(searchVal) && !itemName.toLowerCase().includes(searchVal)) return;

        const tcPrice = data.tc || 0;
        const sellPrice = data.price ? `$${data.price.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-';
        const stType = data.storageType || 'Dry';
        
        let stBadge = '';
        if (stType === 'Dry') stBadge = '<span class="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded text-[10px] font-bold border border-yellow-200">Dry</span>';
        if (stType === 'Chill') stBadge = '<span class="bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded text-[10px] font-bold border border-cyan-200">Chill</span>';
        if (stType === 'Frozen') stBadge = '<span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200">Frozen</span>';

        const ffBadge = data.isFF ? '<span class="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[10px] font-black border border-slate-300">🐟 FF</span>' : '';
        const safetyStock = data.safetyStock || 0;
        const safetyStr = safetyStock > 0 ? `<span class="text-red-600 font-black">${safetyStock}</span>` : '0';

        // ★ Locationのバッジ表示を作成
        const locBadge = data.location && data.location !== '-' 
            ? `<span class="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs font-black border border-indigo-200">${data.location}</span>` 
            : '<span class="text-gray-300">-</span>';

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition-colors";
        tr.innerHTML = `
            <td class="p-3 font-black text-indigo-700">${code}</td>
            <td class="p-3 text-xs font-bold text-gray-700 max-w-[200px] truncate" title="${itemName}">${itemName}</td>
            <td class="p-3 text-center">${locBadge}</td>
            <td class="p-3">${stBadge}</td>
            <td class="p-3 font-mono font-bold text-gray-600">$${tcPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            <td class="p-3 font-mono font-bold text-gray-600">${sellPrice}</td>
            <td class="p-3 font-bold text-gray-500">${data.uom || '-'}</td>
            <td class="p-3 text-center">${safetyStr}</td>
            <td class="p-3">${ffBadge}</td>
            <td class="p-3 text-center flex justify-center gap-4">
                <button class="font-black text-blue-500 hover:text-blue-700 hover:underline" onclick="editMaster('${code}')">Edit</button>
                <button class="font-black text-red-400 hover:text-red-600 hover:underline" onclick="deleteMaster('${code}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}