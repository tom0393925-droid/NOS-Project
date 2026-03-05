// ==========================================
// js/ui_master.js: Master Data Management UI
// ==========================================

function autoFillMasterForm() {
    const code = document.getElementById('mCode').value.trim();
    const btn = document.getElementById('btnMasterUpdate');
    const resetBtn = document.getElementById('btnMasterReset');
    const nameField = document.getElementById('mName');
    
    if (!code) {
        resetMasterForm();
        return;
    }
    
    resetBtn.classList.remove('hidden');

    if (skuMaster[code]) {
        const data = skuMaster[code];
        nameField.value = data.name || getSkuName(code);
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
        if(!nameField.value) nameField.value = getSkuName(code) !== "Unknown Item" ? getSkuName(code) : "";
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
    document.getElementById('mStorage').value = 'Dry';
    document.getElementById('mFF').checked = false;
    
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
    
    const name = document.getElementById('mName').value.trim();
    const tc = parseFloat(document.getElementById('mTc').value) || 0;
    const price = parseFloat(document.getElementById('mPrice').value) || 0; 
    const uom = document.getElementById('mUom').value.trim() || "-";
    const storageType = document.getElementById('mStorage').value || "Dry"; 
    const safetyStock = parseInt(document.getElementById('mSafety').value, 10) || 0;
    const isFF = document.getElementById('mFF').checked || false;

    skuMaster[code] = { name: name, tc: tc, price: price, uom: uom, storageType: storageType, safetyStock: safetyStock, isFF: isFF };
    
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
        delete skuMaster[code];
        renderMasterList();
    }
}

function renderMasterList() {
    const tbody = document.getElementById('masterListBody');
    const searchInput = document.getElementById('masterTableSearch');
    const searchVal = searchInput ? searchInput.value.toLowerCase() : "";
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const keys = Object.keys(skuMaster).sort(); 
    
    keys.forEach(code => {
        const data = skuMaster[code];
        const itemName = getSkuName(code);
        
        if (searchVal && !code.toLowerCase().includes(searchVal) && !itemName.toLowerCase().includes(searchVal)) return;

        const sellPrice = data.price ? `$${data.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-';
        const stType = data.storageType || 'Dry';
        
        let stBadge = '';
        if (stType === 'Dry') stBadge = '<span class="bg-yellow-50 text-yellow-700 px-1 rounded text-[10px] border border-yellow-200">Dry</span>';
        if (stType === 'Chill') stBadge = '<span class="bg-blue-50 text-blue-700 px-1 rounded text-[10px] border border-blue-200">Chill</span>';
        if (stType === 'Frozen') stBadge = '<span class="bg-cyan-50 text-cyan-700 px-1 rounded text-[10px] border border-cyan-200">Frozen</span>';

        const ffBadge = data.isFF ? '<span class="bg-blue-100 text-blue-800 px-1 rounded text-[10px] font-bold">🐟 FF</span>' : '';
        const safetyStr = data.safetyStock > 0 ? `<span class="text-red-600 font-bold">${data.safetyStock}</span>` : '0';

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition-colors";
        tr.innerHTML = `
            <td class="p-3 font-bold text-indigo-700">${code}</td>
            <td class="p-3 text-xs max-w-[200px] truncate" title="${itemName}">${itemName}</td>
            <td class="p-3">${stBadge}</td>
            <td class="p-3 font-mono">$${data.tc.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            <td class="p-3 font-mono">${sellPrice}</td>
            <td class="p-3">${data.uom}</td>
            <td class="p-3 text-center">${safetyStr}</td>
            <td class="p-3">${ffBadge}</td>
            <td class="p-3 text-center flex justify-center gap-3">
                <button class="font-bold text-blue-600 hover:text-blue-800 hover:underline" onclick="editMaster('${code}')">Edit</button>
                <button class="font-bold text-red-400 hover:text-red-600 hover:underline" onclick="deleteMaster('${code}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}