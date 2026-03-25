// ============================================================
// SampleData.gs
// スプレッドシートにサンプルデータを投入するユーティリティ
// Phase 3 テスト用
// ============================================================

/**
 * 全シートのヘッダーと初期サンプルデータをセットアップする
 * 初回のみ手動で実行
 */
function setupAllSheets() {
  setupSkuMaster();
  setupDailySalesHeaders();
  setupInvoiceDetailHeaders();
  setupStockerStock();
  setupConfig();
  Logger.log('✅ 全シートのセットアップ完了');
}

function setupSkuMaster() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('sku_master');
  if (!sheet) sheet = ss.insertSheet('sku_master');

  sheet.clearContents();
  const headers = ['Code','Name','Location','StorageType','TC','Price','UoM','Weight','SafetyStock','SafetyDays','isFF'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e8f0fe');

  const data = [
    ['SKU-001','Soy Sauce 1L','P','Dry',2.5,4,'btl',1,50,3,false],
    ['SKU-002','Mayonnaise 500g','O','Chill',3.0,5,'pcs',0.5,30,3,false],
    ['SKU-003','Cooking Oil 5L','M','Dry',8.0,12,'btl',5,20,5,false],
    ['SKU-004','Frozen Udon 5pcs','B','Frozen',4.5,7,'pck',0.6,40,7,false],
    ['SKU-005','Curry Roux 200g','N','Dry',2.0,3.5,'box',0.2,25,3,false],
    ['SKU-006','Miso Paste 500g','K','Chill',3.5,6,'tub',0.5,20,5,false],
    ['SKU-007','All-Purpose Flour 1kg','L','Dry',1.2,2,'bag',1,30,3,false],
    ['SKU-008','Jasmine Rice 5kg','A','Dry',5.0,8,'bag',5,15,7,false],
    ['SKU-009','Canned Tuna 185g','J','Dry',1.5,2.8,'can',0.2,20,3,false],
    ['SKU-010','Wasabi Paste 43g','P','Dry',2.8,5,'tub',0.05,15,3,true],
  ];
  sheet.getRange(2, 1, data.length, headers.length).setValues(data);
  Logger.log('sku_master セットアップ完了 (' + data.length + ' SKU)');
}

function setupDailySalesHeaders() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('daily_sales');
  if (!sheet) sheet = ss.insertSheet('daily_sales');

  // ヘッダー行のみ設定 (データは Excel アップロード時に追加)
  if (sheet.getLastRow() === 0 || sheet.getRange(1,1).getValue() === '') {
    const headers = ['Date','Code','Name','Location','ExpiryDate','RemainingDays','UoM','TotalPurchase','TotalSales','BeginningQty','EndingQty','Shipped'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#fce8e6');
  }
  Logger.log('daily_sales ヘッダーセットアップ完了');
}

function setupInvoiceDetailHeaders() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('invoice_detail');
  if (!sheet) sheet = ss.insertSheet('invoice_detail');

  if (sheet.getLastRow() === 0 || sheet.getRange(1,1).getValue() === '') {
    const headers = ['Date','InvoiceNo','Code','Name','PickQty'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e6f4ea');
  }
  Logger.log('invoice_detail ヘッダーセットアップ完了');
}

function setupStockerStock() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('stocker_stock');
  if (!sheet) sheet = ss.insertSheet('stocker_stock');

  sheet.clearContents();
  const headers = ['Code','Name','StockerQty','LastUpdated'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#fff8e1');

  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const data = [
    ['SKU-001','Soy Sauce 1L',8,today],
    ['SKU-002','Mayonnaise 500g',3,today],
    ['SKU-003','Cooking Oil 5L',5,today],
    ['SKU-004','Frozen Udon 5pcs',12,today],
    ['SKU-005','Curry Roux 200g',6,today],
    ['SKU-006','Miso Paste 500g',2,today],
    ['SKU-007','All-Purpose Flour 1kg',10,today],
    ['SKU-008','Jasmine Rice 5kg',4,today],
    ['SKU-009','Canned Tuna 185g',7,today],
    ['SKU-010','Wasabi Paste 43g',1,today],
  ];
  sheet.getRange(2, 1, data.length, headers.length).setValues(data);
  Logger.log('stocker_stock セットアップ完了');
}

function setupConfig() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('config');
  if (!sheet) sheet = ss.insertSheet('config');

  sheet.clearContents();
  const data = [
    ['SlackWebhookURL', 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'],
    ['トレンド重み(A)', 0.4],
    ['曜日重み(B)', 0.6],
  ];
  sheet.getRange(1, 1, data.length, 2).setValues(data);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  Logger.log('config セットアップ完了');
}

// ==========================================
// サンプル sales データを daily_sales に直接投入する
// (Excelアップロードのテストを省略したい場合に使用)
// ==========================================
function insertSampleSalesData() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('daily_sales');
  if (!sheet) { Logger.log('ERROR: daily_sales シートが見つかりません'); return; }

  const tz = Session.getScriptTimeZone();
  const today = new Date();
  const rows = [];

  // 直近 30 日分のサンプルデータを生成
  const skus = [
    { code:'SKU-001', name:'Soy Sauce 1L',         loc:'P', uom:'btl', expiry:'2026-12-31', baseSales:8,  beginQty:200 },
    { code:'SKU-002', name:'Mayonnaise 500g',       loc:'O', uom:'pcs', expiry:'2026-09-30', baseSales:5,  beginQty:120 },
    { code:'SKU-003', name:'Cooking Oil 5L',        loc:'M', uom:'btl', expiry:'2027-06-30', baseSales:3,  beginQty:80  },
    { code:'SKU-004', name:'Frozen Udon 5pcs',      loc:'B', uom:'pck', expiry:'2026-06-30', baseSales:10, beginQty:150 },
    { code:'SKU-005', name:'Curry Roux 200g',       loc:'N', uom:'box', expiry:'2026-11-30', baseSales:4,  beginQty:100 },
    { code:'SKU-006', name:'Miso Paste 500g',       loc:'K', uom:'tub', expiry:'2026-08-31', baseSales:3,  beginQty:60  },
    { code:'SKU-007', name:'All-Purpose Flour 1kg', loc:'L', uom:'bag', expiry:'2026-10-31', baseSales:6,  beginQty:180 },
    { code:'SKU-008', name:'Jasmine Rice 5kg',      loc:'A', uom:'bag', expiry:'',          baseSales:2,  beginQty:50  },
    { code:'SKU-009', name:'Canned Tuna 185g',      loc:'J', uom:'can', expiry:'2028-01-01', baseSales:4,  beginQty:90  },
    { code:'SKU-010', name:'Wasabi Paste 43g',      loc:'P', uom:'tub', expiry:'2026-07-31', baseSales:1,  beginQty:30  },
  ];

  for (let d = 83; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    const dateStr = Utilities.formatDate(date, tz, 'yyyy-MM-dd');
    const dayOfWeek = date.getDay();

    skus.forEach(sku => {
      // 曜日によって販売量を変動させる (週末は少なめ)
      const dayFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.4 : 1.0;
      const sales = Math.round(sku.baseSales * dayFactor * (0.8 + Math.random() * 0.4));
      const endQty = Math.max(0, sku.beginQty - sales);
      const remaining = sku.expiry
        ? Math.round((new Date(sku.expiry) - date) / (1000 * 60 * 60 * 24))
        : '';

      rows.push([
        dateStr, sku.code, sku.name, sku.loc,
        sku.expiry, remaining,
        sku.uom, 0, sales,
        sku.beginQty, endQty, sku.beginQty - endQty
      ]);

      sku.beginQty = endQty; // 前日の終了在庫を翌日の開始在庫に
    });
  }

  // 既存データをクリアしてヘッダー付きで書き直す
  sheet.clearContents();
  const headers = ['Date','Code','Name','Location','ExpiryDate','RemainingDays','UoM','TotalPurchase','TotalSales','BeginningQty','EndingQty','Shipped'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#fce8e6');
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  Logger.log('サンプル sales データ挿入完了: ' + rows.length + ' 行');
}

// ==========================================
// サンプル invoice データを invoice_detail に直接投入する
// ==========================================
function insertSampleInvoiceData() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('invoice_detail');
  if (!sheet) { Logger.log('ERROR: invoice_detail シートが見つかりません'); return; }

  const tz = Session.getScriptTimeZone();
  const today = new Date();
  const rows = [];

  // 高頻度 SKU と低頻度 SKU を混在させる
  const highHit = ['SKU-001','SKU-002','SKU-004','SKU-007'];
  const lowHit  = ['SKU-005','SKU-006','SKU-008','SKU-009'];
  const skuNames = {
    'SKU-001':'Soy Sauce 1L','SKU-002':'Mayonnaise 500g',
    'SKU-004':'Frozen Udon 5pcs','SKU-007':'All-Purpose Flour 1kg',
    'SKU-005':'Curry Roux 200g','SKU-006':'Miso Paste 500g',
    'SKU-008':'Jasmine Rice 5kg','SKU-009':'Canned Tuna 185g',
  };

  let invNum = 10001;
  for (let d = 83; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    if (date.getDay() === 0) continue; // 日曜はなし
    const dateStr = Utilities.formatDate(date, tz, 'yyyy-MM-dd');

    // 1日あたり 5〜10 インボイス
    const invoiceCount = 5 + Math.floor(Math.random() * 6);
    for (let i = 0; i < invoiceCount; i++) {
      const invNo = 'INV-' + invNum++;
      // 1インボイスに 2〜5 行
      const lineCount = 2 + Math.floor(Math.random() * 4);
      const picked = new Set();

      for (let l = 0; l < lineCount; l++) {
        // 70% の確率で高頻度 SKU を選ぶ
        const pool = Math.random() < 0.7 ? highHit : lowHit;
        const code = pool[Math.floor(Math.random() * pool.length)];
        if (picked.has(code)) continue; // 同インボイスで重複なし
        picked.add(code);

        const qty = 1 + Math.floor(Math.random() * 5);
        rows.push([dateStr, invNo, code, skuNames[code] || code, qty]);
      }
    }
  }

  sheet.clearContents();
  const headers = ['Date','InvoiceNo','Code','Name','PickQty'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e6f4ea');
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  Logger.log('サンプル invoice データ挿入完了: ' + rows.length + ' 行');
}
