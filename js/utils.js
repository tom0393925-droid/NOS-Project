// ==========================================
// js/utils.js: Common utility functions
// ==========================================

function setSafeText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

function getLatestDataDate() {
    let latestDate = new Date(); 
    if (loadedFiles.length > 0) {
        const lastFileName = loadedFiles[loadedFiles.length - 1];
        const match = lastFileName.match(/(\d+)[^\d]*\.[a-zA-Z]+$/);
        if (match) {
           let digits = match[1];
           if (digits.length >= 6) {
               let last6 = digits.slice(-6);
               latestDate = new Date(`20${last6.slice(0,2)}/${last6.slice(2,4)}/${last6.slice(4,6)}`);
           }
        }
    }
    return latestDate;
}

function getSkuName(code) {
    if (skuMaster[code] && skuMaster[code].name && skuMaster[code].name.trim() !== "") {
        return skuMaster[code].name;
    }
    for (const key in historyData) {
        if (historyData[key].code === code && historyData[key].name) {
            return historyData[key].name;
        }
    }
    return "Unknown Item";
}

function exportTableToExcel(tableID, filename = ''){
    const downloadLink = document.createElement("a"); 
    const dataType = 'application/vnd.ms-excel';
    const tableSelect = document.getElementById(tableID);
    if (!tableSelect) return;
    const tableHTML = tableSelect.outerHTML.replace(/ /g, '%20');
    filename = filename ? filename + '.xls' : 'excel_data.xls';
    downloadLink.href = 'data:' + dataType + ', ' + tableHTML; 
    downloadLink.download = filename; 
    downloadLink.click();
}