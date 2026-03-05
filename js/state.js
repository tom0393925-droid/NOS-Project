// ==========================================
// js/state.js: Global state management and JSON save/load
// ==========================================

let skuMaster = {}; 
let historyData = {}; 
let invoiceHistoryData = {}; // NEW: Picking Frequency (Hits) Data
let currentMemos = {}; 

let loadedWeeks = 0;
let loadedInvoiceWeeks = 0;
let loadedFiles = [];
let loadedInvoiceFiles = [];

let myAbcChart = null;
let myHitAbcChart = null; // NEW
let skuChartInstance = null; 
let currentSelectedSKU = null; 

let globalDryNext = "";
let globalDryNext2 = "";
let globalFrozenNext = "";
let globalFrozenNext2 = "";

window.abcRanks = {}; 
window.abcList = [];  
window.hitAbcRanks = {}; // NEW
window.hitAbcList = []; // NEW

const regionalHolidays = [
    { start: '2024/11/14', end: '2024/11/16', name: 'Water Festival', color: 'rgba(239, 68, 68, 0.15)' },
    { start: '2025/01/28', end: '2025/02/02', name: 'Chinese New Year', color: 'rgba(239, 68, 68, 0.15)' },
    { start: '2025/04/13', end: '2025/04/17', name: 'Khmer New Year', color: 'rgba(239, 68, 68, 0.15)' },
    { start: '2025/09/20', end: '2025/09/25', name: 'Pchum Ben', color: 'rgba(239, 68, 68, 0.15)' },
    { start: '2025/11/04', end: '2025/11/06', name: 'Water Festival', color: 'rgba(239, 68, 68, 0.15)' },
    { start: '2026/02/16', end: '2026/02/20', name: 'Chinese New Year', color: 'rgba(239, 68, 68, 0.15)' }
];

function importSaveData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            skuMaster = importedData.skuMaster || {};
            historyData = importedData.historyData || {};
            invoiceHistoryData = importedData.invoiceHistoryData || {}; // LOAD
            currentMemos = importedData.memos || {};
            
            loadedWeeks = importedData.loadedWeeks || 0;
            loadedFiles = importedData.loadedFiles || Array(loadedWeeks).fill("Unknown File");
            
            loadedInvoiceWeeks = importedData.loadedInvoiceWeeks || 0; // LOAD
            loadedInvoiceFiles = importedData.loadedInvoiceFiles || Array(loadedInvoiceWeeks).fill("Unknown File"); // LOAD
            
            globalDryNext = importedData.globalDryNext || "";
            globalDryNext2 = importedData.globalDryNext2 || "";
            globalFrozenNext = importedData.globalFrozenNext || "";
            globalFrozenNext2 = importedData.globalFrozenNext2 || "";
            
            if(document.getElementById('dryNextDate')) document.getElementById('dryNextDate').value = globalDryNext;
            if(document.getElementById('dryNext2Date')) document.getElementById('dryNext2Date').value = globalDryNext2;
            if(document.getElementById('frozenNextDate')) document.getElementById('frozenNextDate').value = globalFrozenNext;
            if(document.getElementById('frozenNext2Date')) document.getElementById('frozenNext2Date').value = globalFrozenNext2;

            for (const key in historyData) {
                if (historyData[key].expiry) historyData[key].expiry = new Date(historyData[key].expiry);
            }
            
           if(document.getElementById('uiWeekCount')) document.getElementById('uiWeekCount').innerText = loadedWeeks;
            if(document.getElementById('uiInvoiceWeekCount')) document.getElementById('uiInvoiceWeekCount').innerText = loadedInvoiceWeeks;
            
            // UIにファイル履歴リストを描画する関数を呼び出す
            updateHistoryListUI();
            updateInvoiceHistoryListUI();
            
            if (typeof renderMasterList === "function") renderMasterList();
            if (typeof renderActionList === "function") renderActionList();
            
            alert("✅ Data Loaded Successfully!");
            event.target.value = ''; 
        } catch (error) {
            alert("❌ Failed to load JSON.");
            console.error(error);
        }
    };
    reader.readAsText(file);
}

function exportSaveData() {
    const dataToSave = {
        skuMaster: skuMaster, 
        historyData: historyData, 
        invoiceHistoryData: invoiceHistoryData, // SAVE
        loadedWeeks: loadedWeeks,
        loadedFiles: loadedFiles, 
        loadedInvoiceWeeks: loadedInvoiceWeeks, // SAVE
        loadedInvoiceFiles: loadedInvoiceFiles, // SAVE
        memos: currentMemos, 
        globalDryNext: globalDryNext,
        globalDryNext2: globalDryNext2, 
        globalFrozenNext: globalFrozenNext, 
        globalFrozenNext2: globalFrozenNext2
    };
    const jsonString = JSON.stringify(dataToSave, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NOS_Database_W${loadedWeeks}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function clearAllData() {
    if (!confirm("Are you sure you want to reset ALL NOS data?")) return;
    historyData = {}; 
    loadedWeeks = 0; 
    loadedFiles = [];
    
    updateHistoryListUI();
    if (typeof renderActionList === "function") renderActionList();
    alert("NOS data cleared.");
}

// Invoice専用のリセット機能
function clearInvoiceData() {
    if (!confirm("Are you sure you want to reset ALL Invoice data?")) return;
    invoiceHistoryData = {};
    loadedInvoiceWeeks = 0;
    loadedInvoiceFiles = [];
    
    updateInvoiceHistoryListUI();
    if (typeof updateAnalyticsUI === "function") updateAnalyticsUI();
    alert("Invoice data cleared.");
}

// ==========================================
// File History Management (UI & Data Sync)
// ==========================================

function updateHistoryListUI() {
    const list = document.getElementById('fileHistoryList');
    if (list) {
        list.innerHTML = '';
        loadedFiles.forEach((file, i) => {
            const li = document.createElement('li');
            li.className = "flex justify-between items-center text-xs border-b border-gray-100 py-2 last:border-0 hover:bg-slate-50 transition-colors px-2";
            li.innerHTML = `
                <span class="truncate pr-2 text-gray-700" title="${file}">
                    <span class="font-black text-blue-600">Wk ${i+1}:</span> ${file}
                </span>
                <div class="flex gap-1 flex-shrink-0">
                    <button onclick="moveFileUp(${i})" class="bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded text-xs transition-colors shadow-sm font-bold" ${i === 0 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>▲</button>
                    <button onclick="moveFileDown(${i})" class="bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded text-xs transition-colors shadow-sm font-bold" ${i === loadedFiles.length - 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>▼</button>
                    <button onclick="deleteFile(${i})" class="bg-red-50 hover:bg-red-100 text-red-500 px-2 py-1 rounded text-xs transition-colors shadow-sm font-bold">✕</button>
                </div>
            `;
            list.appendChild(li);
        });
    }
    const countEl = document.getElementById('uiWeekCount');
    if (countEl) countEl.innerText = loadedWeeks;
}

function moveFileUp(index) {
    if (index <= 0) return;
    [loadedFiles[index - 1], loadedFiles[index]] = [loadedFiles[index], loadedFiles[index - 1]];
    for (let key in historyData) {
        if (historyData[key].qtys) {
            let temp = historyData[key].qtys[index - 1];
            historyData[key].qtys[index - 1] = historyData[key].qtys[index];
            historyData[key].qtys[index] = temp;
        }
    }
    updateHistoryListUI();
    if (typeof renderActionList === 'function') renderActionList();
}

function moveFileDown(index) {
    if (index >= loadedFiles.length - 1) return;
    [loadedFiles[index], loadedFiles[index + 1]] = [loadedFiles[index + 1], loadedFiles[index]];
    for (let key in historyData) {
        if (historyData[key].qtys) {
            let temp = historyData[key].qtys[index];
            historyData[key].qtys[index] = historyData[key].qtys[index + 1];
            historyData[key].qtys[index + 1] = temp;
        }
    }
    updateHistoryListUI();
    if (typeof renderActionList === 'function') renderActionList();
}

function deleteFile(index) {
    if (!confirm(`Delete Wk ${index + 1}: ${loadedFiles[index]}?`)) return;
    loadedFiles.splice(index, 1);
    loadedWeeks--;
    for (let key in historyData) {
        if (historyData[key].qtys) {
            historyData[key].qtys.splice(index, 1);
        }
    }
    updateHistoryListUI();
    if (typeof renderActionList === 'function') renderActionList();
}

// ------------------------------------------
// Invoice History Management
// ------------------------------------------

function updateInvoiceHistoryListUI() {
    const list = document.getElementById('invoiceHistoryList');
    if (list) {
        list.innerHTML = '';
        if (typeof loadedInvoiceFiles !== 'undefined') {
            loadedInvoiceFiles.forEach((file, i) => {
                const li = document.createElement('li');
                li.className = "flex justify-between items-center text-xs border-b border-gray-100 py-2 last:border-0 hover:bg-slate-50 transition-colors px-2";
                li.innerHTML = `
                    <span class="truncate pr-2 text-gray-700" title="${file}">
                        <span class="font-black text-blue-600">Wk ${i+1}:</span> ${file}
                    </span>
                    <div class="flex gap-1 flex-shrink-0">
                        <button onclick="moveInvoiceFileUp(${i})" class="bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded text-xs transition-colors shadow-sm font-bold" ${i === 0 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>▲</button>
                        <button onclick="moveInvoiceFileDown(${i})" class="bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded text-xs transition-colors shadow-sm font-bold" ${i === loadedInvoiceFiles.length - 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>▼</button>
                        <button onclick="deleteInvoiceFile(${i})" class="bg-red-50 hover:bg-red-100 text-red-500 px-2 py-1 rounded text-xs transition-colors shadow-sm font-bold">✕</button>
                    </div>
                `;
                list.appendChild(li);
            });
        }
    }
    const countEl = document.getElementById('uiInvoiceWeekCount');
    if (countEl) countEl.innerText = loadedInvoiceWeeks;
}

function moveInvoiceFileUp(index) {
    if (index <= 0) return;
    [loadedInvoiceFiles[index - 1], loadedInvoiceFiles[index]] = [loadedInvoiceFiles[index], loadedInvoiceFiles[index - 1]];
    for (let key in invoiceHistoryData) {
        if (invoiceHistoryData[key].hits) {
            let temp = invoiceHistoryData[key].hits[index - 1];
            invoiceHistoryData[key].hits[index - 1] = invoiceHistoryData[key].hits[index];
            invoiceHistoryData[key].hits[index] = temp;
        }
    }
    updateInvoiceHistoryListUI();
    if (typeof updateAnalyticsUI === 'function') updateAnalyticsUI();
}

function moveInvoiceFileDown(index) {
    if (index >= loadedInvoiceFiles.length - 1) return;
    [loadedInvoiceFiles[index], loadedInvoiceFiles[index + 1]] = [loadedInvoiceFiles[index + 1], loadedInvoiceFiles[index]];
    for (let key in invoiceHistoryData) {
        if (invoiceHistoryData[key].hits) {
            let temp = invoiceHistoryData[key].hits[index];
            invoiceHistoryData[key].hits[index] = invoiceHistoryData[key].hits[index + 1];
            invoiceHistoryData[key].hits[index + 1] = temp;
        }
    }
    updateInvoiceHistoryListUI();
    if (typeof updateAnalyticsUI === 'function') updateAnalyticsUI();
}

function deleteInvoiceFile(index) {
    if (!confirm(`Delete Wk ${index + 1}: ${loadedInvoiceFiles[index]}?`)) return;
    loadedInvoiceFiles.splice(index, 1);
    loadedInvoiceWeeks--;
    for (let key in invoiceHistoryData) {
        if (invoiceHistoryData[key].hits) {
            invoiceHistoryData[key].hits.splice(index, 1);
        }
    }
    updateInvoiceHistoryListUI();
    if (typeof updateAnalyticsUI === 'function') updateAnalyticsUI();
}