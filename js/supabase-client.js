// ==========================================
// js/supabase-client.js
// Supabase接続 & データアクセス関数
// ==========================================

const SUPABASE_URL  = 'https://jujtqiphzmcqaoxqytrt.supabase.co';  
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1anRxaXBoem1jcWFveHF5dHJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NDYxNjAsImV4cCI6MjA5MTEyMjE2MH0.g-okN0e5kA8Ve5CJfMfr2gAKLLWuW9abnuiShUJ1ZC8';    

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ==========================================
// 接続テスト
// ==========================================
async function testSupabaseConnection() {
    const { data, error } = await _sb.from('sku_master').select('code').limit(1);
    if (error) {
        console.error('Supabase接続エラー:', error.message);
        return false;
    }
    console.log('Supabase接続OK');
    return true;
}

// ==========================================
// SKU Master
// ==========================================
async function sbLoadSkuMaster() {
    const allRows = [];
    const pageSize = 1000;
    let from = 0;
    while (true) {
        const { data, error } = await _sb
            .from('sku_master')
            .select('*')
            .range(from, from + pageSize - 1);
        if (error) throw error;
        allRows.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
    }
    const result = {};
    for (const row of allRows) {
        result[row.code] = {
            name:        row.name,
            uom:         row.uom,
            price:       row.price,
            tc:          row.tc,
            weight:      row.weight,
            storageType: row.storage_type,
            manufacture: row.manufacture,
            location:    row.location,
            isFF:        row.is_ff,
            safetyStock: 0, // 常にavg×8で計算するため不使用
        };
    }
    return result;
}

async function sbSaveSkuMaster(code, item) {
    const row = {
        code,
        name:         item.name        || '',
        uom:          item.uom         || 'pcs',
        price:        item.price       || 0,
        tc:           item.tc          || 0,
        weight:       item.weight      || 0,
        storage_type: item.storageType || 'Dry',
        manufacture:  item.manufacture || '',
        location:     item.location    || '-',
        is_ff:        item.isFF        || false,
        updated_at:   new Date().toISOString(),
    };
    const { error } = await _sb.from('sku_master').upsert(row, { onConflict: 'code' });
    if (error) throw error;
}

async function sbDeleteSkuMaster(code) {
    const { error } = await _sb.from('sku_master').delete().eq('code', code);
    if (error) throw error;
}

// ==========================================
// Weekly Sales
// ==========================================
async function sbLoadWeeklySales(weeks = 52) {
    // 直近N週の開始日を計算
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - weeks * 7);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const allRows = [];
    const pageSize = 1000;
    let from = 0;
    while (true) {
        const { data, error } = await _sb
            .from('weekly_sales')
            .select('*')
            .gte('week_start', cutoffStr)
            .order('week_start', { ascending: true })
            .range(from, from + pageSize - 1);
        if (error) throw error;
        allRows.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
    }
    return allRows;
}

async function sbUpsertWeeklySales(rows) {
    // rows: [{ code, expiry_date, location, week_start, ending_qty, total_sales }, ...]
    const { error } = await _sb.from('weekly_sales').upsert(rows, {
        onConflict: 'code,expiry_date,location,week_start'
    });
    if (error) throw error;
}

// ==========================================
// Picking Data
// ==========================================
async function sbLoadPickingData() {
    const allRows = [];
    const pageSize = 1000;
    let from = 0;
    while (true) {
        const { data, error } = await _sb
            .from('picking_data')
            .select('*')
            .order('week_start', { ascending: true })
            .range(from, from + pageSize - 1);
        if (error) throw error;
        allRows.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
    }
    return allRows;
}

async function sbUpsertPickingData(rows) {
    // rows: [{ code, client_name, week_start, pick_qty, pick_count }, ...]
    const { error } = await _sb.from('picking_data').upsert(rows, {
        onConflict: 'code,client_name,week_start'
    });
    if (error) throw error;
}

// ==========================================
// Shipment Orders
// ==========================================
async function sbLoadShipmentOrders() {
    const { data, error } = await _sb
        .from('shipment_orders')
        .select('*')
        .order('arrival_date', { ascending: true });
    if (error) throw error;
    // アプリのshipmentOrders形式に変換
    const result = {};
    for (const row of data) {
        if (!result[row.code]) result[row.code] = [];
        result[row.code].push({
            arrivalDate: row.arrival_date,
            orderQty:    row.order_qty,
            status:      row.status,
        });
    }
    return result;
}

async function sbSaveShipmentOrder(code, arrivalDate, orderQty, status = 'pending') {
    const { error } = await _sb.from('shipment_orders').upsert({
        code, arrival_date: arrivalDate, order_qty: orderQty, status
    }, { onConflict: 'code,arrival_date' });
    if (error) throw error;
}

// ==========================================
// Container Schedules
// ==========================================
async function sbLoadContainerDates() {
    const { data, error } = await _sb
        .from('container_schedules')
        .select('*')
        .eq('id', 'global')
        .single();
    if (error) {
        // 行がまだ存在しない場合は空オブジェクトを返す
        if (error.code === 'PGRST116') return {};
        throw error;
    }
    return {
        dryNext:     data.dry_next     || '',
        dryNext2:    data.dry_next2    || '',
        dryNext3:    data.dry_next3    || '',
        frozenNext:  data.frozen_next  || '',
        frozenNext2: data.frozen_next2 || '',
        frozenNext3: data.frozen_next3 || '',
    };
}

async function sbSaveContainerDates(dates) {
    const { error } = await _sb.from('container_schedules').upsert({
        id:           'global',
        dry_next:     dates.dryNext    || null,
        dry_next2:    dates.dryNext2   || null,
        dry_next3:    dates.dryNext3   || null,
        frozen_next:  dates.frozenNext || null,
        frozen_next2: dates.frozenNext2 || null,
        frozen_next3: dates.frozenNext3 || null,
        updated_at:   new Date().toISOString(),
    }, { onConflict: 'id' });
    if (error) throw error;
}

// ==========================================
// weekly_sales rows → historyData 形式に変換
// ==========================================
function _weeklySalesToHistoryData(rows) {
    // 全週キーを収集してソート
    const weekSet = new Set(rows.map(r => r.week_start));
    const weekKeys   = [...weekSet].sort();
    const weekLabels = weekKeys.map(w => 'W/' + w);

    // code+expiry をキーにグループ化（複数locationは合算）
    const groups = {};
    for (const row of rows) {
        const expiryStr = row.expiry_date ? row.expiry_date : 'noexpiry';
        const gKey = row.code + '_' + expiryStr;
        if (!groups[gKey]) {
            groups[gKey] = {
                code:      row.code,
                expiryStr,
                expiry:    row.expiry_date ? new Date(row.expiry_date) : null,
                byWeek:    {},
            };
        }
        const wk = row.week_start;
        if (!groups[gKey].byWeek[wk]) {
            groups[gKey].byWeek[wk] = { endQty: 0, sales: 0 };
        }
        // 同週・複数locationは合算
        groups[gKey].byWeek[wk].endQty += parseFloat(row.ending_qty)  || 0;
        groups[gKey].byWeek[wk].sales  += parseFloat(row.total_sales) || 0;
    }

    // historyData 形式に変換
    const historyData = {};
    for (const [gKey, group] of Object.entries(groups)) {
        const qtys  = [];
        const sales = [];
        let prevQty = 0;
        for (const wk of weekKeys) {
            if (group.byWeek[wk]) {
                prevQty = group.byWeek[wk].endQty;
                qtys.push(prevQty);
                sales.push(group.byWeek[wk].sales);
            } else {
                qtys.push(prevQty); // 前週の値を引き継ぎ
                sales.push(0);
            }
        }
        historyData[gKey] = {
            code:      group.code,
            name:      '',        // sku_master から後で補完
            uom:       '',
            expiry:    group.expiry,
            expiryStr: group.expiryStr,
            isDamaged: false,
            qtys,
            sales,
        };
    }

    return { historyData, weekKeys, weekLabels };
}

// ==========================================
// picking_data rows → invoiceHistoryData 形式に変換
// ==========================================
function _pickingDataToInvoiceHistory(rows, weekKeys) {
    const result = {};
    for (const row of rows) {
        const code = row.code;
        if (!result[code]) {
            result[code] = {
                code,
                hits: new Array(weekKeys.length).fill(0),
                qtys: new Array(weekKeys.length).fill(0),
            };
        }
        const idx = weekKeys.indexOf(row.week_start);
        if (idx >= 0) {
            result[code].hits[idx] += row.pick_count || 0;
            result[code].qtys[idx] += parseFloat(row.pick_qty) || 0;
        }
    }
    return result;
}

// ==========================================
// Supabase から全データを読み込んでグローバル変数に展開
// ==========================================
function _showLoading(msg) {
    const overlay = document.getElementById('loadingOverlay');
    const msgEl   = document.getElementById('loadingMessage');
    if (overlay) overlay.classList.remove('hidden');
    if (msgEl)   msgEl.textContent = msg || 'Loading...';
}
function _hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('hidden');
}

async function sbLoadAllData(statusCallback, weeks = 52) {
    const log = msg => {
        if (statusCallback) statusCallback(msg);
        _showLoading(msg);
    };

    log('Loading SKU master...');
    const masterData  = await sbLoadSkuMaster();

    log(`Loading weekly sales data (last ${weeks} weeks)...`);
    const salesRows   = await sbLoadWeeklySales(weeks);

    log('Loading picking data...');
    const pickingRows = await sbLoadPickingData();

    log('Loading shipment orders...');
    const ordersData  = await sbLoadShipmentOrders();

    log('Loading container arrival dates...');
    const containerDates = await sbLoadContainerDates();

    log('Converting data...');
    const { historyData: hd, weekKeys, weekLabels } = _weeklySalesToHistoryData(salesRows);

    // sku_master の name / uom を historyData に補完
    for (const key in hd) {
        const code = hd[key].code;
        if (masterData[code]) {
            hd[key].name = masterData[code].name;
            hd[key].uom  = masterData[code].uom;
        }
    }

    const invoiceHd = _pickingDataToInvoiceHistory(pickingRows, weekKeys);

    // ★ weekly_salesに存在するコードだけにsku_masterを絞る
    const activeCodes = new Set(Object.values(hd).map(v => v.code));
    const filteredMaster = {};
    for (const code of activeCodes) {
        if (masterData[code]) filteredMaster[code] = masterData[code];
    }

    // グローバル変数に反映
    skuMaster            = filteredMaster;
    historyData          = hd;
    invoiceHistoryData   = invoiceHd;
    loadedWeeks          = weekKeys.length;
    loadedFiles          = weekLabels;
    loadedInvoiceWeeks   = weekKeys.length;
    loadedInvoiceFiles   = weekLabels.map(w => 'Picking ' + w);
    window.shipmentOrders = ordersData;

    // コンテナ到着日をグローバル変数とUIに反映
    if (typeof restoreContainerDatesFromData === 'function') {
        restoreContainerDatesFromData(containerDates);
    }

    // UI を更新
    const wkEl = document.getElementById('uiWeekCount');
    if (wkEl) wkEl.innerText = loadedWeeks;

    log(`Done: ${Object.keys(masterData).length} SKUs / ${weekKeys.length} weeks / ${salesRows.length} records`);

    _showLoading('Rendering...');
    if (typeof renderMasterList   === 'function') renderMasterList();
    setTimeout(() => {
        if (typeof renderActionList  === 'function') renderActionList();
        setTimeout(() => {
            if (typeof updateAnalyticsUI  === 'function') updateAnalyticsUI();
            setTimeout(() => {
                if (typeof renderWarehouseMap === 'function') renderWarehouseMap();
                _hideLoading();
            }, 200);
        }, 100);
    }, 0);
}
