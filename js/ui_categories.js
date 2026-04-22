// ==========================================
// js/ui_categories.js: Order Category Management UI
// ==========================================

// ── Add-category UI state ──
let _newCatPrefixes = [];

function _getSkuSupplierPrefixes() {
    const prefixes = new Set();
    for (const code in (window.skuMaster || {})) {
        const m = code.match(/^([A-Za-z]+)/);
        if (m) prefixes.add(m[1].toUpperCase());
    }
    return [...prefixes].sort();
}

function _newCatGenerateName() {
    const parentSel = document.getElementById('newCatParent');
    const parentId  = parentSel?.value || '';
    if (!parentId || parentId === '__new__') return '';
    const cats = window.orderCategories || {};
    const parentName = (cats[parentId]?.name) || parentId;
    if (_newCatPrefixes.length === 0) return parentName + ' ALL';
    return parentName + ' (' + _newCatPrefixes.join(', ') + ')';
}

function _updateNewCatUI() {
    // Tags
    const tagsEl = document.getElementById('newCatPrefixTags');
    if (tagsEl) {
        tagsEl.innerHTML = _newCatPrefixes.map(p =>
            `<span class="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                ${_escHtml(p)}<button type="button" onclick="_removeNewCatPrefix('${_escHtml(p)}')" class="hover:text-red-500 leading-none">×</button>
            </span>`
        ).join('');
    }
    // Preview
    const preview = document.getElementById('newCatNamePreview');
    if (preview) preview.textContent = _newCatGenerateName();
}

function _onNewCatParentChange() {
    const sel = document.getElementById('newCatParent');
    if (sel?.value === '__new__') {
        const name = prompt('Enter new parent category ID (e.g. USJP):');
        sel.value = '';
        if (name) _createNewParentCategory(name.trim().toUpperCase());
        return;
    }
    _updateNewCatUI();
}

async function _createNewParentCategory(id) {
    if (!id) return;
    if (window.orderCategories?.[id]) { alert(`"${id}" already exists.`); return; }
    try {
        await sbSaveOrderCategory({ id, name: id, next1: null, next2: null, next3: null });
        if (!window.orderCategories) window.orderCategories = {};
        window.orderCategories[id] = { id, name: id, parentId: null, prefixes: null, next1: '', next2: '', next3: '' };
        renderCategoryManagement();
        if (typeof renderOrderCategoryTabs === 'function') renderOrderCategoryTabs();
        const sel = document.getElementById('newCatParent');
        if (sel) sel.value = id;
        _updateNewCatUI();
    } catch(e) { alert('Failed to create: ' + e.message); }
}

function _onNewCatPrefixInput(val) {
    const suggestions = document.getElementById('newCatPrefixSuggestions');
    if (!suggestions) return;
    const q = (val || '').trim().toUpperCase();
    const all = _getSkuSupplierPrefixes().filter(p => !_newCatPrefixes.includes(p));
    const matches = q ? all.filter(p => p.startsWith(q)) : all;
    if (matches.length === 0) { suggestions.classList.add('hidden'); return; }
    suggestions.innerHTML = matches.map(p =>
        `<div class="px-3 py-1.5 hover:bg-purple-50 cursor-pointer" onmousedown="_addNewCatPrefix('${_escHtml(p)}')">${_escHtml(p)}</div>`
    ).join('');
    suggestions.classList.remove('hidden');
}

function _onNewCatPrefixKeydown(event) {
    if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        const input = document.getElementById('newCatPrefixInput');
        const val = (input?.value || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
        if (val) _addNewCatPrefix(val);
    } else if (event.key === 'Escape') {
        document.getElementById('newCatPrefixSuggestions')?.classList.add('hidden');
    }
}

function _addNewCatPrefix(prefix) {
    if (!prefix || _newCatPrefixes.includes(prefix)) return;
    _newCatPrefixes.push(prefix);
    _newCatPrefixes.sort();
    const input = document.getElementById('newCatPrefixInput');
    if (input) input.value = '';
    document.getElementById('newCatPrefixSuggestions')?.classList.add('hidden');
    _updateNewCatUI();
}

function _removeNewCatPrefix(prefix) {
    _newCatPrefixes = _newCatPrefixes.filter(p => p !== prefix);
    _updateNewCatUI();
}

// Close suggestions when clicking outside
document.addEventListener('click', e => {
    if (!document.getElementById('newCatPrefixWrapper')?.contains(e.target)) {
        document.getElementById('newCatPrefixSuggestions')?.classList.add('hidden');
    }
});

function renderCategoryManagement() {
    const area   = document.getElementById('categoryListArea');
    const select = document.getElementById('categoryImportSelect');
    const cats   = window.orderCategories || {};
    const ids    = Object.keys(cats).sort();

    // Populate the import dropdown
    if (select) {
        const prev = select.value;
        select.innerHTML = '<option value="">-- Select Category --</option>'
            + ids.map(id => {
                const n = (cats[id] && cats[id].name) ? cats[id].name : id;
                return `<option value="${id}"${id === prev ? ' selected' : ''}>${_escHtml(n)}</option>`;
            }).join('')
            + '<option value="__new__">+ New Category...</option>';
    }

    // Populate the new-category parent dropdown (only true parents = no parentId)
    const newCatParentSel = document.getElementById('newCatParent');
    if (newCatParentSel) {
        const prevParent = newCatParentSel.value;
        newCatParentSel.innerHTML = '<option value="">-- Parent Category --</option>'
            + ids.filter(id => !cats[id].parentId)
                 .map(id => `<option value="${id}"${id === prevParent ? ' selected' : ''}>${_escHtml(id)}</option>`)
                 .join('')
            + '<option value="__new__">+ New Parent...</option>';
    }

    // Update collapsed summary badges
    const badges = document.getElementById('categorySettingsBadges');
    if (badges) {
        badges.innerHTML = ids.map(id => {
            const n = (cats[id] && cats[id].name) ? cats[id].name : id;
            return `<span class="bg-purple-200 text-purple-800 text-xs font-bold px-2 py-0.5 rounded-full">${_escHtml(n)}</span>`;
        }).join('');
    }

    if (!area) return;
    area.innerHTML = '';

    if (ids.length === 0) {
        area.innerHTML = '<p class="text-sm text-gray-400 italic">No categories yet. Add one below.</p>';
        return;
    }

    for (const id of ids) {
        const cat = cats[id];
        const displayName = cat.name && cat.name !== id ? cat.name : id;
        const isBuiltin = id === 'CFJP' || id === 'RFJP';
        // parentId candidates: categories that are not themselves a filtered view and not the current id
        const parentOptions = ids
            .filter(oid => oid !== id && !cats[oid].parentId)
            .map(oid => `<option value="${oid}"${cat.parentId === oid ? ' selected' : ''}>${_escHtml(cats[oid].name || oid)}</option>`)
            .join('');
        const parentCat = cat.parentId ? (cats[cat.parentId] || null) : null;
        const inheritedDates = parentCat
            ? `<span class="text-xs text-gray-400 italic">Schedule inherited from ${_escHtml(parentCat.name || cat.parentId)}</span>`
            : `
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
                    class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors">Save</button>
                <span id="catSaveStatus_${id}" class="text-xs text-green-700 font-bold"></span>`;
        const div = document.createElement('div');
        div.className = 'bg-white border border-gray-200 rounded-lg px-4 py-3';
        div.innerHTML = `
            <div class="flex flex-wrap items-center gap-3">
                <div id="catNameDisplay_${id}" class="flex items-center gap-1 shrink-0 min-w-[3.5rem]">
                    <span class="font-black text-gray-800">${_escHtml(displayName)}</span>
                    <button onclick="startRenameCategory('${id}')" title="Rename / Configure filter"
                        class="text-gray-400 hover:text-purple-600 text-xs px-1 transition-colors">✏️</button>
                </div>
                <div id="catNameEdit_${id}" class="hidden items-center gap-2 shrink-0 flex-wrap">
                    <input type="text" id="catNameInput_${id}" value="${_escHtml(displayName)}" maxlength="40"
                        class="border border-purple-400 rounded px-2 py-1 text-xs font-bold w-44 focus:ring-1 outline-none"
                        placeholder="e.g. RFJP (AZ, KU, TMR)"
                        onkeydown="if(event.key==='Enter')saveCategoryName('${id}');if(event.key==='Escape')cancelRenameCategory('${id}')">
                    <select id="catParentInput_${id}"
                        class="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 outline-none">
                        <option value="">Standalone</option>
                        ${parentOptions}
                    </select>
                    <button onclick="saveCategoryName('${id}')"
                        class="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs font-bold transition-colors">OK</button>
                    <button onclick="cancelRenameCategory('${id}')"
                        class="text-gray-500 hover:text-gray-700 px-2 py-1 rounded text-xs font-bold transition-colors">✕</button>
                </div>
                ${inheritedDates}
                ${!isBuiltin ? `<button onclick="deleteCategory('${id}')"
                    class="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 bg-red-50 rounded transition-colors">
                    Delete
                </button>` : ''}
            </div>
        `;
        area.appendChild(div);
    }
}

function _escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function startRenameCategory(id) {
    document.getElementById(`catNameDisplay_${id}`)?.classList.add('hidden');
    const edit = document.getElementById(`catNameEdit_${id}`);
    if (edit) { edit.classList.remove('hidden'); edit.classList.add('flex'); }
    document.getElementById(`catNameInput_${id}`)?.focus();
}

function cancelRenameCategory(id) {
    document.getElementById(`catNameEdit_${id}`)?.classList.add('hidden');
    document.getElementById(`catNameEdit_${id}`)?.classList.remove('flex');
    document.getElementById(`catNameDisplay_${id}`)?.classList.remove('hidden');
}

function _extractPrefixesFromName(name) {
    const match = name.match(/\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(/[,\s]+/).map(p => p.trim()).filter(p => /^[A-Z0-9]+$/i.test(p));
    return parts.length ? parts.map(p => p.toUpperCase()) : null;
}

async function saveCategoryName(id) {
    const newName   = (document.getElementById(`catNameInput_${id}`)?.value || '').trim();
    const parentVal = (document.getElementById(`catParentInput_${id}`)?.value || '').trim();
    // カッコ内から自動的に prefix を抽出
    const prefixes  = parentVal ? (_extractPrefixesFromName(newName) || []) : [];
    if (!newName) { alert('Name cannot be empty.'); return; }

    if (!window.orderCategories) window.orderCategories = {};
    const cat = window.orderCategories[id] || { id, name: id };
    cat.name     = newName;
    cat.parentId = parentVal || null;
    cat.prefixes = prefixes.length ? prefixes : null;
    window.orderCategories[id] = cat;

    const encodedName = typeof _encodeCategoryConfig === 'function'
        ? _encodeCategoryConfig(newName, parentVal || null, prefixes.length ? prefixes : null)
        : newName;

    try {
        await sbSaveOrderCategory({ id, name: encodedName, next1: cat.next1 || null, next2: cat.next2 || null, next3: cat.next3 || null });
        renderCategoryManagement();
        if (typeof renderOrderCategoryTabs === 'function') renderOrderCategoryTabs();
        if (typeof renderCategoryScheduleBar === 'function') renderCategoryScheduleBar();
    } catch (e) {
        alert('Save failed: ' + e.message);
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
        const savedName = (cat.parentId && typeof _encodeCategoryConfig === 'function')
            ? _encodeCategoryConfig(cat.name || id, cat.parentId, cat.prefixes || null)
            : (cat.name || id);
        await sbSaveOrderCategory({ id, name: savedName, next1, next2, next3 });

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
    const parentSel = document.getElementById('newCatParent');
    const parentId  = (parentSel?.value || '').trim();
    if (!parentId || parentId === '__new__') { alert('Please select a parent category.'); return; }

    const cats      = window.orderCategories || {};
    const parentName = (cats[parentId]?.name) || parentId;
    const prefixes  = [..._newCatPrefixes];
    const name      = prefixes.length === 0
        ? parentName + ' ALL'
        : parentName + ' (' + prefixes.join(', ') + ')';
    const id = name;

    if (cats[id]) { alert(`"${id}" already exists.`); return; }

    const encodedName = _encodeCategoryConfig(name, parentId, prefixes.length ? prefixes : null);

    try {
        await sbSaveOrderCategory({ id, name: encodedName, next1: null, next2: null, next3: null });
        if (!window.orderCategories) window.orderCategories = {};
        window.orderCategories[id] = { id, name, parentId, prefixes: prefixes.length ? prefixes : null, next1: '', next2: '', next3: '' };
        if (parentSel) parentSel.value = '';
        _newCatPrefixes = [];
        _updateNewCatUI();
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

function toggleCategorySettings() {
    const content = document.getElementById('categorySettingsContent');
    const chevron = document.getElementById('categorySettingsChevron');
    if (!content) return;
    const opening = content.classList.toggle('hidden');
    if (chevron) chevron.textContent = opening ? '▼' : '▲';
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
