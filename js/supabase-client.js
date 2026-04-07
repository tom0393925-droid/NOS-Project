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
    const { data, error } = await _sb.from('sku_master').select('*');
    if (error) throw error;
    // アプリのskuMaster形式に変換
    const result = {};
    for (const row of data) {
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
async function sbLoadWeeklySales(limitWeeks = 52) {
    // 直近N週分だけ取得してブラウザを軽く保つ
    const { data, error } = await _sb
        .from('weekly_sales')
        .select('*')
        .order('week_start', { ascending: true });
    if (error) throw error;
    return data;
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
async function sbLoadPickingData(limitWeeks = 52) {
    const { data, error } = await _sb
        .from('picking_data')
        .select('*')
        .order('week_start', { ascending: true });
    if (error) throw error;
    return data;
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
