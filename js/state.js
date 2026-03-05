// ==========================================
// js/state.js: Global state management and JSON save/load
// ==========================================

let skuMaster = {}; 
let historyData = {}; 
let invoiceHistoryData = {}; // NEW: Picking Frequency (Hits) Data
let currentMemos = {}; 

let loadedWeeks = 0;
let loadedFiles = []; 
let loadedInvoiceWeeks = 0; // NEW
let loadedInvoiceFiles = []; // NEW

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
    if (!confirm("Are you sure you want to reset all history data (NOS and Invoice)?")) return;
    historyData = {}; 
    invoiceHistoryData = {};
    loadedWeeks = 0; 
    loadedFiles = [];
    loadedInvoiceWeeks = 0;
    loadedInvoiceFiles = [];
    
    if(document.getElementById('uiWeekCount')) document.getElementById('uiWeekCount').innerText = loadedWeeks;
    if(document.getElementById('uiInvoiceWeekCount')) document.getElementById('uiInvoiceWeekCount').innerText = loadedInvoiceWeeks;
    if (typeof renderActionList === "function") renderActionList();
}