// ==========================================
// js/excel.js: Excel file reading and history array manipulation
// ==========================================

function readExcelWorkbookAsync(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try { resolve(XLSX.read(new Uint8Array(e.target.result), { type: 'array' })); } 
            catch (error) { reject(error); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

async function handleTcExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
        const workbook = await readExcelWorkbookAsync(file);
        let updatedCount = 0; let startRow = -1; let colIdx = { sku: -1, cost: -1, unit: -1 }; let targetJson = null;

        for (const sheetName of workbook.SheetNames) {
            const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
            for (let r = 0; r < Math.min(json.length, 50); r++) {
                if (!json[r]) continue;
                for (let c = 0; c < json[r].length; c++) {
                    const val = String(json[r][c] || "").toLowerCase().replace(/[\s\r\n]+/g, '');
                    if (val === "sku" || val === "code") colIdx.sku = c;
                    if (val.includes("cost") && val.includes("total")) colIdx.cost = c;
                    if (val === "unit" || val === "uom") colIdx.unit = c;
                }
                if (colIdx.sku !== -1 && colIdx.cost !== -1) { startRow = r + 1; targetJson = json; break; }
            }
            if (startRow !== -1) break; 
        }
        if (startRow === -1) throw new Error("Could not find 'SKU' and 'COST TOTAL' headers.");

        for (let r = startRow; r < targetJson.length; r++) {
            const row = targetJson[r];
            if (!row || row.length === 0) continue;
            const code = colIdx.sku !== -1 && row[colIdx.sku] ? String(row[colIdx.sku]).trim() : "";
            const tc = parseFloat(String(colIdx.cost !== -1 && row[colIdx.cost] ? row[colIdx.cost] : "").replace(/[^0-9.-]+/g, ""));
            const uom = colIdx.unit !== -1 && row[colIdx.unit] ? String(row[colIdx.unit]).trim() : "-";

            if (code && !isNaN(tc)) {
                const normalizedUom = ['G', 'g'].includes(uom) ? 'KG' : (uom === 'Kg' ? 'KG' : uom);
                if (!skuMaster[code]) {
                    skuMaster[code] = { name: "", tc: tc, price: 0, uom: normalizedUom, storageType: "Dry", safetyStock: 0, isFF: false };
                } else {
                    skuMaster[code].tc = tc;
                    if (uom !== "-") skuMaster[code].uom = normalizedUom;
                }
                updatedCount++;
            }
        }
        if (typeof renderMasterList === "function") renderMasterList();
        alert(`✅ Successfully updated ${updatedCount} master records!`);
        event.target.value = ''; 
    } catch (e) { alert("❌ Excel Error: \n" + e.message); }
}

async function runAnalysis() {
    const fileInput = document.getElementById('fileWeek');
    const file = fileInput.files[0];
    if (!file) { alert("Please select this week's Excel file."); return; }

    document.getElementById('analyzeBtn').disabled = true;
    document.getElementById('loading').style.display = 'block';

    try {
        const workbook = await readExcelWorkbookAsync(file);
        let startRow = -1; let col = { code: -1, name: -1, lot: -1, sales: -1, qty: -1, uom: -1 }; let targetJson = null;

        for (const sheetName of workbook.SheetNames) {
            const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
            for (let r = 0; r < Math.min(json.length, 50); r++) {
                if (!json[r]) continue;
                for (let c = 0; c < json[r].length; c++) {
                    const val = String(json[r][c] || "").toLowerCase().replace(/[\s\r\n]+/g, '');
                    if (val === 'code' || val === 'sku') col.code = c;
                    if (val.includes('name') || val.includes('item')) col.name = c;
                    if (val === 'lot' || val === 'expiry' || val.includes('expire')) col.lot = c;
                    if (val.includes('sale') && val.includes('total')) col.sales = c;
                    if (val.includes('qty') && val.includes('end')) col.qty = c;
                    if (val === 'uom' || val === 'unit') col.uom = c;
                }
                if (col.code !== -1 && col.qty !== -1) { startRow = r + 1; targetJson = json; break; }
            }
            if (startRow !== -1) break;
        }
        if (startRow === -1) throw new Error("Missing essential columns (Code and Qty).");

        let currentWeekData = {}; let currentParent = { code: "", name: "", sales: 0 };
        for (let r = startRow; r < targetJson.length; r++) {
            const row = targetJson[r];
            if (!row || row.length === 0) continue;
            let isTotalRow = false;
            for (let c = 0; c < Math.min(row.length, 5); c++) {
                const cellStr = String(row[c] || "").toLowerCase().replace(/[\s\r\n]+/g, '');
                if (cellStr.includes("total") || cellStr.includes("grand") || cellStr.includes("subtotal")) { isTotalRow = true; break; }
            }
            if (isTotalRow) continue;

            const codeVal = col.code !== -1 && row[col.code] ? String(row[col.code]).trim() : "";
            const lotVal = col.lot !== -1 && row[col.lot] ? String(row[col.lot]).trim() : "";
            const qtyVal = col.qty !== -1 ? parseFloat(row[col.qty]) || 0 : 0;
            const salesVal = col.sales !== -1 ? parseFloat(row[col.sales]) || 0 : 0;
            
            if (codeVal !== "" && codeVal.toLowerCase() !== "code") {
                const nameVal = col.name !== -1 && row[col.name] ? String(row[col.name]).trim() : "";
                const uomVal = col.uom !== -1 && row[col.uom] ? String(row[col.uom]).trim() : "-";
                currentParent = { code: codeVal, name: nameVal, sales: salesVal, uom: uomVal };
                
                if (nameVal) {
                    if (!skuMaster[codeVal]) {
                        skuMaster[codeVal] = { name: nameVal, tc: 0, price: 0, uom: "-", storageType: "Dry", safetyStock: 0, isFF: false };
                    } else if (!skuMaster[codeVal].name || skuMaster[codeVal].name.trim() === "") {
                        skuMaster[codeVal].name = nameVal;
                    }
                }
            } 
            
            let expDate = null; let isValidDate = false; let isDamaged = false; let dateStr = "No Date";
            if (lotVal) {
                expDate = new Date(lotVal);
                if (!isNaN(Number(lotVal)) && Number(lotVal) > 20000) expDate = new Date(Math.round((Number(lotVal) - 25569) * 86400 * 1000));
                isValidDate = !isNaN(expDate.getTime());
                dateStr = isValidDate ? expDate.toLocaleDateString('ja-JP') : "No Date";
                isDamaged = /damage|return|rtn|dmg/i.test(lotVal);
            }
            
            const key = `${currentParent.code}_${dateStr}_${isDamaged ? 'dmg' : 'norm'}`;
            const _f = ['G', 'g'].includes(currentParent.uom) ? 1000 : 1;
            currentWeekData[key] = { code: currentParent.code, name: currentParent.name, expiry: isValidDate ? expDate : null, expiryStr: lotVal || "No Date", isDamaged: isDamaged, qty: qtyVal / _f, sales: currentParent.sales / _f };
        }

        for (const key in historyData) {
            while (historyData[key].qtys.length < loadedWeeks) historyData[key].qtys.push(0);
            while (historyData[key].sales.length < loadedWeeks) historyData[key].sales.push(0);
            if (currentWeekData[key]) {
                historyData[key].qtys.push(currentWeekData[key].qty);
                historyData[key].sales.push(currentWeekData[key].sales);
                delete currentWeekData[key];
            } else {
                historyData[key].qtys.push(0); historyData[key].sales.push(0);
            }
        }

        for (const key in currentWeekData) {
            const item = currentWeekData[key];
            historyData[key] = {
                code: item.code, name: item.name, expiry: item.expiry, expiryStr: item.expiryStr, isDamaged: item.isDamaged,
                qtys: [...new Array(loadedWeeks).fill(0), item.qty], sales: [...new Array(loadedWeeks).fill(0), item.sales]
            };
        }

        loadedWeeks++; loadedFiles.push(file.name); 
        document.getElementById('uiWeekCount').innerText = loadedWeeks;
        if (typeof renderActionList === "function") renderActionList();
        fileInput.value = ''; updateSingleSlot();
    } catch (error) { alert("❌ Error: \n" + error.message); } 
    finally {
        document.getElementById('analyzeBtn').disabled = false;
        document.getElementById('loading').style.display = 'none';
    }
}

function moveFileUp(index) { if (index <= 0) return; swapHistoryData(index, index - 1); if (typeof renderActionList === "function") renderActionList(); }
function moveFileDown(index) { if (index >= loadedWeeks - 1) return; swapHistoryData(index, index + 1); if (typeof renderActionList === "function") renderActionList(); }
function swapHistoryData(idx1, idx2) {
    const tempFile = loadedFiles[idx1]; loadedFiles[idx1] = loadedFiles[idx2]; loadedFiles[idx2] = tempFile;
    for (const key in historyData) {
        const qtys = historyData[key].qtys; const sales = historyData[key].sales;
        const tempQty = qtys[idx1]; qtys[idx1] = qtys[idx2]; qtys[idx2] = tempQty;
        const tempSale = sales[idx1]; sales[idx1] = sales[idx2]; sales[idx2] = tempSale;
    }
}
function deleteFile(index) {
    if (!confirm(`Are you sure you want to delete Week ${index + 1}?`)) return;
    loadedFiles.splice(index, 1);
    for (const key in historyData) { historyData[key].qtys.splice(index, 1); historyData[key].sales.splice(index, 1); }
    loadedWeeks--; document.getElementById('uiWeekCount').innerText = loadedWeeks;
    if (typeof renderActionList === "function") renderActionList();
}

// ==========================================
// Invoice Data Analysis (Hit Count & Auto-Naming)
// ==========================================
async function runInvoiceAnalysis() {
    const fileInput = document.getElementById('fileInvoice');
    const file = fileInput.files[0];
    if (!file) { alert("Please select an Invoice Excel file."); return; }

    document.getElementById('analyzeInvoiceBtn').disabled = true;
    document.getElementById('loadingInvoice').style.display = 'block';

    try {
        const workbook = await readExcelWorkbookAsync(file);
        let startRow = -1; let col = { product: -1, qty: -1 }; let targetJson = null;

        for (const sheetName of workbook.SheetNames) {
            const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
            for (let r = 0; r < Math.min(json.length, 50); r++) {
                if (!json[r]) continue;
                for (let c = 0; c < json[r].length; c++) {
                    const val = String(json[r][c] || "").toLowerCase().replace(/[\s\r\n]+/g, '');
                    if (val.includes('productname') || val === 'product') col.product = c;
                    if (val === 'qty' || val === 'quantity') col.qty = c;
                }
                if (col.product !== -1 && col.qty !== -1) { startRow = r + 1; targetJson = json; break; }
            }
            if (startRow !== -1) break;
        }
        if (startRow === -1) throw new Error("Could not find 'Product Name' and 'Qty' headers.");

        let currentWeekHits = {};

        for (let r = startRow; r < targetJson.length; r++) {
            const row = targetJson[r];
            if (!row || row.length === 0) continue;

            const productCell = col.product !== -1 && row[col.product] ? String(row[col.product]).trim() : "";
            const qtyVal = col.qty !== -1 ? parseFloat(row[col.qty]) || 0 : 0;

            if (!productCell || productCell.toLowerCase().includes('total')) continue;
            if (qtyVal <= 0) continue; 

            // ★ NEW: スペースで区切ってSKUと商品名を分離し、マスターを自動補完
            const spaceIdx = productCell.indexOf(' ');
            let skuCode = productCell;
            let nameMatch = "";

            if (spaceIdx !== -1) {
                skuCode = productCell.substring(0, spaceIdx).trim();
                nameMatch = productCell.substring(spaceIdx + 1).trim();
            }

            if (!skuCode) continue;

            if (nameMatch) {
                if (!skuMaster[skuCode]) {
                    skuMaster[skuCode] = { name: nameMatch, tc: 0, price: 0, uom: "-", storageType: "Dry", safetyStock: 0, isFF: false };
                } else if (!skuMaster[skuCode].name || skuMaster[skuCode].name.trim() === "" || skuMaster[skuCode].name === "Unknown Item") {
                    skuMaster[skuCode].name = nameMatch;
                }
            }

            if (!currentWeekHits[skuCode]) {
                currentWeekHits[skuCode] = { hits: 0, qty: 0 };
            }
            currentWeekHits[skuCode].hits += 1; 
            currentWeekHits[skuCode].qty += qtyVal;
        }

        for (const key in invoiceHistoryData) {
            while (invoiceHistoryData[key].hits.length < loadedInvoiceWeeks) invoiceHistoryData[key].hits.push(0);
            while (invoiceHistoryData[key].qtys.length < loadedInvoiceWeeks) invoiceHistoryData[key].qtys.push(0);

            if (currentWeekHits[key]) {
                invoiceHistoryData[key].hits.push(currentWeekHits[key].hits);
                invoiceHistoryData[key].qtys.push(currentWeekHits[key].qty);
                delete currentWeekHits[key];
            } else {
                invoiceHistoryData[key].hits.push(0);
                invoiceHistoryData[key].qtys.push(0);
            }
        }

        for (const key in currentWeekHits) {
            invoiceHistoryData[key] = {
                hits: [...new Array(loadedInvoiceWeeks).fill(0), currentWeekHits[key].hits],
                qtys: [...new Array(loadedInvoiceWeeks).fill(0), currentWeekHits[key].qty]
            };
        }

        loadedInvoiceWeeks++; 
        loadedInvoiceFiles.push(file.name);
        document.getElementById('uiInvoiceWeekCount').innerText = loadedInvoiceWeeks;
        
        if (typeof updateAnalyticsUI === "function") updateAnalyticsUI();
        if (typeof renderMasterList === "function") renderMasterList();
        
        fileInput.value = ''; 
        if (typeof updateInvoiceSlot === "function") updateInvoiceSlot();
        alert("✅ Invoice data loaded and missing SKU names were auto-registered!");
    } catch (error) { alert("❌ Invoice Error: \n" + error.message); } 
    finally {
        document.getElementById('analyzeInvoiceBtn').disabled = false;
        document.getElementById('loadingInvoice').style.display = 'none';
    }
}