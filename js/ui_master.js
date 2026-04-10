// ==========================================
// js/ui_master.js: Master Data Management UI
// ==========================================

function autoFillMasterForm() {
    const code    = document.getElementById('mCode').value.trim();
    const status  = document.getElementById('masterStatus');
    const btnReset = document.getElementById('btnMasterReset');

    if (!code || !skuMaster[code]) {
        // コードが存在しない場合はフォームをクリア
        if (status && code && !skuMaster[code]) {
            status.innerText = '';
        }
        const btn = document.getElementById('btnMasterUpdate');
        if (btn) btn.innerText = '➕ Add New';
        if (btnReset) btnReset.classList.add('hidden');
        return;
    }

    const item = skuMaster[code];
    document.getElementById('mName').value    = item.name        || '';
    document.getElementById('mTc').value      = item.tc          || 0;
    document.getElementById('mPrice').value   = item.price       || 0;
    document.getElementById('mUom').value     = item.uom         || '';
    document.getElementById('mWeight').value  = item.weight      || '';
    document.getElementById('mSafety').value  = item.safetyStock || 0;
    document.getElementById('mStorage').value = item.storageType || 'Dry';
    document.getElementById('mFF').checked    = item.isFF        || false;
    if (document.getElementById('mManufacture')) document.getElementById('mManufacture').value = item.manufacture || '';
    if (document.getElementById('mLocation'))    document.getElementById('mLocation').value    = item.location    || '-';

    const btn = document.getElementById('btnMasterUpdate');
    if (btn) btn.innerText = '✏️ Update';
    if (btnReset) btnReset.classList.remove('hidden');

    if (status) {
        status.className = 'w-full text-xs text-blue-600 font-bold mt-1';
        status.innerText = `Loaded: ${item.name || code}`;
        setTimeout(() => { status.innerText = ''; }, 2000);
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
    ['mCode','mName','mTc','mPrice','mUom','mWeight','mSafety'].forEach(id => {
        if (document.getElementById(id)) document.getElementById(id).value = '';
    });
    if (document.getElementById('mLocation'))    document.getElementById('mLocation').value    = '-';
    if (document.getElementById('mStorage'))     document.getElementById('mStorage').value     = 'Dry';
    if (document.getElementById('mFF'))          document.getElementById('mFF').checked        = false;
    if (document.getElementById('mManufacture')) document.getElementById('mManufacture').value = '';

    const codeInput = document.getElementById('mCode');
    codeInput.disabled = false;

    const btn = document.getElementById('btnMasterUpdate');
    btn.innerText  = "➕ Update";
    btn.className  = "bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-bold shadow-md transition-colors whitespace-nowrap";
    const resetBtn = document.getElementById('btnMasterReset');
    if (resetBtn) resetBtn.classList.add('hidden');
}

async function saveSingleMaster() {
    const code = document.getElementById('mCode').value.trim();
    if (!code) { alert("Please enter SKU Code."); return; }

    const isNew  = !skuMaster[code];
    const locEl  = document.getElementById('mLocation');
    const item   = {
        name:        document.getElementById('mName').value.trim()          || 'No Name',
        tc:          parseFloat(document.getElementById('mTc').value)        || 0,
        price:       parseFloat(document.getElementById('mPrice').value)     || 0,
        uom:         document.getElementById('mUom').value.trim()            || 'pcs',
        weight:      parseFloat(document.getElementById('mWeight').value)    || 0,
        safetyStock: parseInt(document.getElementById('mSafety').value)      || 0,
        storageType: document.getElementById('mStorage').value,
        manufacture: document.getElementById('mManufacture')?.value          || '',
        isFF:        document.getElementById('mFF').checked,
        location:    locEl ? locEl.value : '-',
    };

    skuMaster[code] = item;

    // Supabase に保存
    try {
        await sbSaveSkuMaster(code, item);
    } catch (e) {
        console.error('SKUマスター保存失敗:', e);
        alert('保存に失敗しました: ' + e.message);
        return;
    }

    const status = document.getElementById('masterStatus');
    if (status) {
        status.innerText = isNew ? "✅ New SKU Added!" : "✅ SKU Updated!";
        setTimeout(() => status.innerText = '', 3000);
    }

    resetMasterForm();
    renderMasterList();
    if (typeof renderWarehouseMap === 'function') renderWarehouseMap();
}

async function deleteMaster(code) {
    if (!confirm(`Delete ${code}?`)) return;

    delete skuMaster[code];

    // Supabase から削除
    try {
        await sbDeleteSkuMaster(code);
    } catch (e) {
        console.error('SKUマスター削除失敗:', e);
    }

    renderMasterList();
}

function renderMasterList() {
    const tbody     = document.getElementById('masterListBody');
    const searchEl  = document.getElementById('masterTableSearch');
    const searchVal = searchEl ? searchEl.value.toLowerCase().trim() : '';
    if (!tbody) return;

    const fragment = document.createDocumentFragment();
    for (const code in skuMaster) {
        const item = skuMaster[code];
        if (searchVal && !code.toLowerCase().includes(searchVal) && !(item.name || '').toLowerCase().includes(searchVal)) continue;

        const tr = document.createElement('tr');
        tr.className = "border-b hover:bg-blue-50 transition-colors";

        let flags = [];
        if (item.isFF) flags.push('<span class="bg-blue-100 text-blue-700 px-1 py-0.5 rounded text-[10px] font-bold">FF</span>');

        let stBadge = '';
        if (item.storageType === 'Dry')    stBadge = '<span class="text-yellow-700 font-bold text-xs">Dry</span>';
        if (item.storageType === 'Chill')  stBadge = '<span class="text-blue-600 font-bold text-xs">Chill</span>';
        if (item.storageType === 'Frozen') stBadge = '<span class="text-cyan-600 font-bold text-xs">Frozen</span>';

        const w = parseFloat(item.weight) || 0;
        let weightBadge = '';
        if      (w >= 20) weightBadge = '<span class="bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 rounded text-[10px] font-black">C (Heavy)</span>';
        else if (w >= 10) weightBadge = '<span class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-2 py-0.5 rounded text-[10px] font-black">B (Mid)</span>';
        else              weightBadge = '<span class="bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded text-[10px] font-black">A (Light)</span>';

        let mfBadge = '';
        if      (item.manufacture === 'CFJP') mfBadge = '<span class="bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">❄️ CFJP</span>';
        else if (item.manufacture === 'CRJP') mfBadge = '<span class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-2 py-0.5 rounded text-[10px] font-bold">📦 CRJP</span>';

        tr.innerHTML = `
            <td class="p-3 font-bold text-indigo-700 cursor-pointer hover:underline" onclick="editMaster('${code}')">${code}</td>
            <td class="p-3 text-gray-800 text-xs max-w-[200px] truncate" title="${item.name}">${item.name}</td>
            <td class="p-3 font-black text-blue-600 text-lg">${item.location || '-'}</td>
            <td class="p-3">${stBadge}</td>
            <td class="p-3 text-gray-600">$${(item.tc || 0).toFixed(2)}</td>
            <td class="p-3 text-gray-600">$${(item.price || 0).toFixed(2)}</td>
            <td class="p-3 text-gray-600">${item.uom || '-'}</td>
            <td class="p-3 text-center">${weightBadge}</td>
            <td class="p-3 font-bold text-red-600">${item.safetyStock || 0}</td>
            <td class="p-3">${flags.join(' ')}</td>
            <td class="p-3">${mfBadge}</td>
            <td class="p-3 text-center">
                <button onclick="deleteMaster('${code}')" class="text-red-500 hover:text-red-700 font-bold text-xs px-2 py-1 bg-red-50 rounded">Delete</button>
            </td>
        `;
        fragment.appendChild(tr);
    }
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
}
