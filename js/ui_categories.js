// ==========================================
// js/ui_categories.js: Order Category Management UI
// ==========================================

function renderCategoryManagement() {
    const area   = document.getElementById('categoryListArea');
    const select = document.getElementById('categoryImportSelect');
    const cats   = window.orderCategories || {};
    const ids    = Object.keys(cats).sort();

    // Populate the import dropdown
    if (select) {
        const prev = select.value;
        select.innerHTML = '<option value="">-- Select Category --</option>'
            + ids.map(id => `<option value="${id}"${id === prev ? ' selected' : ''}>${id}</option>`).join('')
            + '<option value="__new__">+ New Category...</option>';
    }

    if (!area) return;
    area.innerHTML = '';

    if (ids.length === 0) {
        area.innerHTML = '<p class="text-sm text-gray-400 italic">No categories yet. Add one below.</p>';
        return;
    }

    for (const id of ids) {
        const cat = cats[id];
        const isBuiltin = id === 'CFJP' || id === 'RFJP';
        const div = document.createElement('div');
        div.className = 'bg-white border border-gray-200 rounded-lg px-4 py-3';
        div.innerHTML = `
            <div class="flex flex-wrap items-center gap-3">
                <span class="font-black text-gray-800 w-14 shrink-0">${id}</span>
                <div class="flex items-center gap-1 text-xs">
                    <span class="text-gray-500 font-semibold">Next:</span>
                    <input type="date" id="catDate_${id}_1" value="${cat.next1 || ''}"
                        class="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 outline-none">
                </div>
                <div class="flex items-center gap-1 text-xs">
                    <span class="text-gray-500 font-semibold">2nd:</span>
                    <input type="date" id="catDate_${id}_2" value="${cat.next2 || ''}"
                        class="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 outline-none">
                </div>
                <div class="flex items-center gap-1 text-xs">
                    <span class="text-gray-500 font-semibold">3rd:</span>
                    <input type="date" id="catDate_${id}_3" value="${cat.next3 || ''}"
                        class="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 outline-none">
                </div>
                <button onclick="saveCategoryDates('${id}')"
                    class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors">
                    Save
                </button>
                ${!isBuiltin ? `<button onclick="deleteCategory('${id}')"
                    class="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 bg-red-50 rounded transition-colors">
                    Delete
                </button>` : ''}
                <span id="catSaveStatus_${id}" class="text-xs text-green-700 font-bold"></span>
            </div>
        `;
        area.appendChild(div);
    }
}

async function saveCategoryDates(id) {
    const next1 = document.getElementById(`catDate_${id}_1`)?.value || null;
    const next2 = document.getElementById(`catDate_${id}_2`)?.value || null;
    const next3 = document.getElementById(`catDate_${id}_3`)?.value || null;

    if (!window.orderCategories) window.orderCategories = {};
    const cat = window.orderCategories[id] || { id, name: id };
    cat.next1 = next1 || ''; cat.next2 = next2 || ''; cat.next3 = next3 || '';
    window.orderCategories[id] = cat;

    try {
        await sbSaveOrderCategory({ id, name: id, next1, next2, next3 });

        // Keep global date vars in sync for chart.js
        if (id === 'CFJP') {
            globalDryNext    = next1 || '';
            globalDryNext2   = next2 || '';
            globalDryNext3   = next3 || '';
        } else if (id === 'RFJP') {
            globalFrozenNext  = next1 || '';
            globalFrozenNext2 = next2 || '';
            globalFrozenNext3 = next3 || '';
        }

        const st = document.getElementById(`catSaveStatus_${id}`);
        if (st) { st.textContent = '✅ Saved'; setTimeout(() => { st.textContent = ''; }, 2500); }

        // Refresh schedule bar if visible
        if (typeof renderCategoryScheduleBar === 'function') renderCategoryScheduleBar();
    } catch (e) {
        alert('Save failed: ' + e.message);
    }
}

async function addNewCategory() {
    const input = document.getElementById('newCategoryId');
    const id    = (input?.value || '').trim().toUpperCase();
    if (!id) { alert('Please enter a Category ID.'); return; }
    if (window.orderCategories?.[id]) { alert(`Category "${id}" already exists.`); return; }

    try {
        await sbSaveOrderCategory({ id, name: id, next1: null, next2: null, next3: null });
        if (!window.orderCategories) window.orderCategories = {};
        window.orderCategories[id] = { id, name: id, next1: '', next2: '', next3: '' };
        if (input) input.value = '';
        renderCategoryManagement();
        if (typeof renderOrderCategoryTabs === 'function') renderOrderCategoryTabs();
    } catch (e) {
        alert('Failed to add category: ' + e.message);
    }
}

async function deleteCategory(id) {
    if (!confirm(`Delete category "${id}"? All SKU assignments for this category will also be removed.`)) return;
    try {
        await sbDeleteOrderCategory(id);
        if (window.orderCategories) delete window.orderCategories[id];
        if (window.skuCategoryMap) {
            for (const code in window.skuCategoryMap) {
                window.skuCategoryMap[code] = window.skuCategoryMap[code].filter(c => c !== id);
            }
        }
        renderCategoryManagement();
        if (typeof renderOrderCategoryTabs === 'function') renderOrderCategoryTabs();
    } catch (e) {
        alert('Delete failed: ' + e.message);
    }
}

function updateCategoryFileName() {
    const fi  = document.getElementById('fileCategoryImport');
    const lbl = document.getElementById('nameCategoryFile');
    if (fi && lbl) lbl.textContent = fi.files.length ? fi.files[0].name : 'Choose Excel file';
}

async function importSkuCategoryExcel() {
    const fileInput = document.getElementById('fileCategoryImport');
    const select    = document.getElementById('categoryImportSelect');
    let   catId     = select?.value;

    if (!fileInput?.files.length) { alert('Please select an Excel file.'); return; }

    if (!catId || catId === '__new__') {
        const newId = prompt('Enter new Category ID (e.g. CFJP2):');
        if (!newId) return;
        catId = newId.trim().toUpperCase();
        if (!window.orderCategories?.[catId]) {
            try {
                await sbSaveOrderCategory({ id: catId, name: catId, next1: null, next2: null, next3: null });
                if (!window.orderCategories) window.orderCategories = {};
                window.orderCategories[catId] = { id: catId, name: catId, next1: '', next2: '', next3: '' };
                renderCategoryManagement();
                if (typeof renderOrderCategoryTabs === 'function') renderOrderCategoryTabs();
            } catch (e) { alert('Failed to create category: ' + e.message); return; }
        }
    }

    const file   = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const wb   = XLSX.read(e.target.result, { type: 'array' });
            const ws   = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

            // Auto-detect column containing "SKU" header (search first 5 rows)
            let skuColIdx = 0;
            let dataStartRow = 0;
            outer:
            for (let ri = 0; ri < Math.min(5, rows.length); ri++) {
                const row = rows[ri] || [];
                for (let ci = 0; ci < row.length; ci++) {
                    if (/^sku$/i.test(String(row[ci] || '').trim())) {
                        skuColIdx    = ci;
                        dataStartRow = ri + 1;
                        break outer;
                    }
                }
            }

            const skuCodes = [...new Set(
                rows.slice(dataStartRow)
                    .map(r => String(r[skuColIdx] || '').trim())
                    .filter(c => c)
            )];

            if (!skuCodes.length) { alert('No SKU codes found in column A.'); return; }

            if (typeof _showLoading === 'function') _showLoading(`Importing ${skuCodes.length} SKUs → ${catId}...`);
            await sbBulkUpsertSkuCategory(skuCodes, catId);

            // Update local map
            if (!window.skuCategoryMap) window.skuCategoryMap = {};
            for (const code of skuCodes) {
                if (!window.skuCategoryMap[code]) window.skuCategoryMap[code] = [];
                if (!window.skuCategoryMap[code].includes(catId)) window.skuCategoryMap[code].push(catId);
            }
            if (typeof _hideLoading === 'function') _hideLoading();

            const st = document.getElementById('categoryImportStatus');
            if (st) { st.textContent = `✅ ${skuCodes.length} SKUs imported to ${catId}`; setTimeout(() => { st.textContent = ''; }, 5000); }

            // Reset file input
            if (fileInput) fileInput.value = '';
            updateCategoryFileName();
        } catch (err) {
            if (typeof _hideLoading === 'function') _hideLoading();
            alert('Import failed: ' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}
