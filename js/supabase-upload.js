// ==========================================
// js/supabase-upload.js
// Supabase へのデータアップロード処理
// ==========================================

// ==========================================
// 週次在庫Excel → weekly_sales テーブル
// フォーマット:
//   行3: "Beginning: DD/MM/YYYY Ending: DD/MM/YYYY"
//   行5: ヘッダー (Nº, Code, Barcode, Name, UoM, TotalPurchase, TotalSales, BeginningQty, EndingQty)
//   行7+: データ行（列Aが数値の行のみ有効）
// ==========================================

function _parseInventoryExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const isCsv = file.name.toLowerCase().endsWith('.csv');
        reader.onload = (e) => {
            try {
                const wb = isCsv
                    ? XLSX.read(e.target.result, { type: 'string' })
                    : XLSX.read(e.target.result, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

                // 行3（index 2）から期間を取得
                const dateRow = String(rows[2]?.[0] || '');
                const match = dateRow.match(/Beginning:\s*(\d{2}\/\d{2}\/\d{4})/);
                if (!match) throw new Error(`日付行が見つかりません。行3に "Beginning: DD/MM/YYYY ..." が必要です。\n実際の内容: "${dateRow}"`);

                // DD/MM/YYYY → YYYY-MM-DD
                const [dd, mm, yyyy] = match[1].split('/');
                const weekStart = `${yyyy}-${mm}-${dd}`;

                // データ行を解析（列Aが数値の行のみ）
                const records = [];
                for (let i = 6; i < rows.length; i++) {
                    const row = rows[i];
                    const nº = row[0];
                    if (!nº || isNaN(Number(nº))) continue;

                    const code = String(row[1] || '').trim();
                    if (!code) continue;

                    const uom       = String(row[4] || '').trim();
                    const _f        = ['G', 'g'].includes(uom) ? 1000 : 1;
                    const beginQty  = (parseFloat(row[7]) || 0) / _f;
                    const endQty    = (parseFloat(row[8]) || 0) / _f;
                    const salesQty  = Math.max(0, beginQty - endQty);

                    records.push({
                        code,
                        expiry_date: null,
                        location:    '-',
                        week_start:  weekStart,
                        ending_qty:  endQty,
                        total_sales: salesQty,
                    });
                }

                if (records.length === 0) throw new Error('データ行が見つかりませんでした。Excelのフォーマットを確認してください。');
                resolve({ weekStart, records, fileName: file.name });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました。'));
        if (isCsv) {
            reader.readAsText(file, 'UTF-8');
        } else {
            reader.readAsBinaryString(file);
        }
    });
}

async function uploadWeeklyInventoryFiles(files) {
    const statusEl  = document.getElementById('sbUploadStatus');
    const progressEl = document.getElementById('sbUploadProgress');
    if (!statusEl) return;

    const fileList = Array.from(files).filter(f => f.name.match(/\.(xlsx|xls|csv)$/i));
    if (fileList.length === 0) {
        statusEl.innerHTML = '<span class="text-red-600">❌ ファイル (.xlsx / .xls / .csv) を選択してください。</span>';
        return;
    }

    statusEl.innerHTML = `<span class="text-blue-600">⏳ ${fileList.length}ファイルを処理中...</span>`;
    if (progressEl) progressEl.style.display = 'block';

    let successCount = 0;
    let errorCount   = 0;
    const logs = [];

    for (let fi = 0; fi < fileList.length; fi++) {
        const file = fileList[fi];
        if (progressEl) progressEl.textContent = `(${fi + 1} / ${fileList.length}) ${file.name}`;

        try {
            const { weekStart, records } = await _parseInventoryExcel(file);

            // 100件ずつバッチ送信
            const chunkSize = 100;
            for (let i = 0; i < records.length; i += chunkSize) {
                await sbUpsertWeeklySales(records.slice(i, i + chunkSize));
            }

            logs.push(`✅ ${weekStart} (${records.length}件) — ${file.name}`);
            successCount++;
        } catch (err) {
            logs.push(`❌ ${file.name}: ${err.message}`);
            errorCount++;
        }
    }

    if (progressEl) progressEl.style.display = 'none';

    const summary = `完了: ${successCount}件成功 / ${errorCount}件エラー`;
    statusEl.innerHTML = `
        <div class="font-bold mb-1 ${errorCount > 0 ? 'text-yellow-700' : 'text-green-700'}">${summary}</div>
        <div class="text-xs text-gray-600 space-y-0.5 max-h-32 overflow-y-auto">${logs.map(l => `<div>${l}</div>`).join('')}</div>
    `;
}

// ==========================================
// SKUマスターExcel → sku_master テーブル
// フォーマット:
//   行3（index 2）: ヘッダー行（SKU, Item name JP, Brand, Item name EN...）
//   行4+（index 3+）: データ行（列Aが空でない行のみ有効）
//   A=0:SKU, D=3:Name(EN), K=10:PP/UNIT(USD), N=13:COST TOTAL, P=15:Unit, V=21:Logistic temperature
// ==========================================

function _storageTypeMap(val) {
    const v = String(val || '').trim().toLowerCase();
    if (v === 'frozen') return 'Frozen';
    if (v === 'chilled' || v === 'chill' || v === 'fresh') return 'Chill';
    return 'Dry'; // Dried / Dry / その他
}

async function uploadSkuMasterFile(files) {
    const statusEl = document.getElementById('sbMasterUploadStatus');
    if (!statusEl) return;

    const fileList = Array.from(files).filter(f => f.name.match(/\.(xlsx|xls|csv)$/i));
    if (fileList.length === 0) {
        statusEl.innerHTML = '<span class="text-red-600">❌ Excelまたはcsvファイルを選択してください。</span>';
        return;
    }

    const file = fileList[0];
    statusEl.innerHTML = '<span class="text-blue-600">⏳ 読み込み中...</span>';

    try {
        const isCsv = file.name.toLowerCase().endsWith('.csv');
        const content = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = () => reject(new Error('読み込み失敗'));
            isCsv ? reader.readAsText(file, 'UTF-8') : reader.readAsBinaryString(file);
        });

        const wb = isCsv
            ? XLSX.read(content, { type: 'string' })
            : XLSX.read(content, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // ヘッダー行を探す（"SKU" が含まれる行）
        let headerRow = -1;
        for (let i = 0; i < Math.min(10, rows.length); i++) {
            if (rows[i].some(c => String(c).trim().toUpperCase() === 'SKU')) {
                headerRow = i;
                break;
            }
        }
        if (headerRow < 0) throw new Error('ヘッダー行（SKU列）が見つかりません。');

        // ヘッダーから列インデックスを動的に取得
        const headers = rows[headerRow].map(h => String(h).trim().toLowerCase());
        const col = name => {
            // 部分一致で検索
            const patterns = {
                'sku':   ['sku'],
                'name':  ['item name (en)', 'item name(en)', 'name (en)', 'name'],
                'tc':    ['cost total', 'pp/unit (usd)', 'cost'],
                'uom':   ['unit', 'uom'],
                'temp':  ['logistic temperature', 'logistic temp', 'temperature', 'type'],
            };
            for (const p of (patterns[name] || [name])) {
                const idx = headers.findIndex(h => h.includes(p));
                if (idx >= 0) return idx;
            }
            return -1;
        };

        const iSku  = col('sku');
        const iName = col('name');
        const iTc   = col('tc');
        const iUom  = col('uom');
        const iTemp = col('temp');

        if (iSku < 0) throw new Error('SKU列が見つかりません。');

        // データ行を解析（重複はMapで後勝ち）
        const recordMap = new Map();
        for (let i = headerRow + 1; i < rows.length; i++) {
            const row = rows[i];
            const code = String(row[iSku] || '').trim();
            if (!code || code.toLowerCase() === 'sku') continue;

            const name        = iName >= 0 ? String(row[iName] || '').trim() : '';
            const tc          = iTc   >= 0 ? parseFloat(String(row[iTc] || '').replace(/[$,]/g, '')) || 0 : 0;
            const uom         = iUom  >= 0 ? String(row[iUom] || '').trim() || 'pcs' : 'pcs';
            const storageType = iTemp >= 0 ? _storageTypeMap(row[iTemp]) : 'Dry';

            recordMap.set(code, { code, name, uom, tc, storage_type: storageType });
        }

        const records = [...recordMap.values()];
        if (records.length === 0) throw new Error('データ行が見つかりません。');

        statusEl.innerHTML = `<span class="text-blue-600">⏳ ${records.length}件をSupabaseに登録中...</span>`;

        // 既存データを upsert（code が同じなら上書き）
        const chunkSize = 100;
        for (let i = 0; i < records.length; i += chunkSize) {
            const chunk = records.slice(i, i + chunkSize);
            const { error } = await _sb.from('sku_master').upsert(chunk, { onConflict: 'code' });
            if (error) throw error;
        }

        statusEl.innerHTML = `<span class="text-green-700 font-bold">✅ ${records.length}件のSKUマスターを登録しました。</span>`;
    } catch (err) {
        statusEl.innerHTML = `<span class="text-red-600">❌ エラー: ${err.message}</span>`;
    }
}

// ドラッグ&ドロップ初期化
function initSbUploadArea() {
    const area = document.getElementById('sbDropArea');
    if (!area) return;

    area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('border-blue-500', 'bg-blue-50');
    });
    area.addEventListener('dragleave', () => {
        area.classList.remove('border-blue-500', 'bg-blue-50');
    });
    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('border-blue-500', 'bg-blue-50');
        uploadWeeklyInventoryFiles(e.dataTransfer.files);
    });
}

// ページ読み込み後に初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSbUploadArea);
} else {
    initSbUploadArea();
}
