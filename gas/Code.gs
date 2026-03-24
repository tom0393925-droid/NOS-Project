// ============================================================
// NOS Inventory System - Google Apps Script
// ============================================================
// 必要なサービス:
//   - Google Sheets API (組み込み)
//   - Google Drive API v2 (高度なサービス: Drive)
//     メニュー > サービス > Drive API v2 を有効化
// ============================================================

// ==========================================
// CONFIG
// ==========================================

/**
 * スクリプトプロパティから設定を取得
 * 初回は setupFolders() を実行してプロパティを設定する
 */
function getConfig() {
  const props = PropertiesService.getScriptProperties().getProperties();
  return {
    spreadsheetId: props['SPREADSHEET_ID'],
    salesFolderId: props['SALES_FOLDER_ID'],
    invoiceFolderId: props['INVOICE_FOLDER_ID'],
  };
}

function getSpreadsheet() {
  const { spreadsheetId } = getConfig();
  if (!spreadsheetId) throw new Error('SPREADSHEET_ID が未設定です。スクリプトプロパティを確認してください。');
  return SpreadsheetApp.openById(spreadsheetId);
}

// ==========================================
// MAIN RUNNER
// ==========================================

/**
 * 毎朝 7:00 に自動実行するメイン関数
 * トリガー設定: 時間ベース > 日次 > 午前7時
 */
function runAll() {
  Logger.log('=== runAll() 開始: ' + new Date().toISOString() + ' ===');

  try {
    processSalesFolder();
  } catch (e) {
    Logger.log('ERROR: processSalesFolder: ' + e.message);
  }

  try {
    processInvoiceFolder();
  } catch (e) {
    Logger.log('ERROR: processInvoiceFolder: ' + e.message);
  }

  try {
    runRefillNotification();
  } catch (e) {
    Logger.log('ERROR: runRefillNotification: ' + e.message);
  }

  Logger.log('=== runAll() 完了 ===');
}

// ==========================================
// SETUP
// ==========================================

/**
 * Google Drive に 📥sales / 📥invoice フォルダを作成し
 * フォルダIDをスクリプトプロパティに保存する
 * ※ 初回のみ手動で実行
 */
function setupFolders() {
  const root = DriveApp.getRootFolder();
  const salesFolder = getOrCreateFolder(root, '📥sales');
  const invoiceFolder = getOrCreateFolder(root, '📥invoice');

  PropertiesService.getScriptProperties().setProperties({
    'SALES_FOLDER_ID': salesFolder.getId(),
    'INVOICE_FOLDER_ID': invoiceFolder.getId(),
  });

  Logger.log('✅ フォルダ設定完了');
  Logger.log('  📥sales   : ' + salesFolder.getId());
  Logger.log('  📥invoice : ' + invoiceFolder.getId());
  Logger.log('');
  Logger.log('次のステップ:');
  Logger.log('  スクリプトプロパティ > SPREADSHEET_ID に対象スプレッドシートのIDを設定してください');
}

function getOrCreateFolder(parent, name) {
  const iter = parent.getFoldersByName(name);
  if (iter.hasNext()) {
    const folder = iter.next();
    Logger.log('既存フォルダを使用: ' + name);
    return folder;
  }
  const folder = parent.createFolder(name);
  Logger.log('フォルダを作成: ' + name);
  return folder;
}

// ==========================================
// SALES PROCESSING
// ==========================================

function processSalesFolder() {
  const { salesFolderId } = getConfig();
  if (!salesFolderId) {
    Logger.log('WARN: SALES_FOLDER_ID 未設定。setupFolders() を実行してください。');
    return;
  }

  const folder = DriveApp.getFolderById(salesFolderId);
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();

    // 処理済み / エラーファイルはスキップ
    if (name.startsWith('[done]') || name.startsWith('[error]')) continue;
    // xlsx / xls のみ処理
    if (!name.match(/\.(xlsx|xls)$/i)) continue;

    try {
      Logger.log('Sales 処理開始: ' + name);
      processSalesFile(file);
      file.setName('[done]_' + name);
      Logger.log('Sales 処理完了: ' + name);
    } catch (e) {
      file.setName('[error]_' + name);
      Logger.log('ERROR: Sales 処理失敗 [' + name + ']: ' + e.message);
    }
  }
}

/**
 * Sales Excel ファイルをパースして daily_sales シートに書き込む
 * 列順: A=Date B=Code C=Name D=Location E=ExpiryDate F=RemainingDays
 *       G=UoM H=TotalPurchase I=TotalSales J=BeginningQty K=EndingQty
 */
function processSalesFile(file) {
  const data = readXlsxData(file);
  if (!data || data.length < 2) {
    Logger.log('  データなし (行数: ' + (data ? data.length : 0) + ')');
    return;
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('daily_sales');
  if (!sheet) throw new Error('シート "daily_sales" が見つかりません');

  // 既存データのインデックスを構築 (重複チェック用)
  const existingData = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues()
    : [];
  const existingMap = buildSalesMap(existingData);

  const newRows = [];
  let skipped = 0;

  // ヘッダー行(index=0)をスキップして1行目からパース
  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    // ---- バリデーション ----
    // A列 (Date) が空
    if (row[0] === '' || row[0] === null || row[0] === undefined) { skipped++; continue; }
    // B列 (Code) が空
    if (row[1] === '' || row[1] === null || row[1] === undefined) { skipped++; continue; }
    // B列が英字のみ (カテゴリ行: Beverage, Frozen, Dry Goods など)
    const codeStr = String(row[1]).trim();
    if (/^[A-Za-z][A-Za-z\s]*$/.test(codeStr)) { skipped++; continue; }
    // J列 (BeginningQty, index=9) が数値でない
    if (typeof row[9] !== 'number' || isNaN(row[9])) { skipped++; continue; }

    const dateVal = formatDate(row[0]);
    const code = codeStr;
    const name = row[2] || '';
    const location = row[3] || '';
    const expiryDate = row[4] ? formatDate(row[4]) : '';
    const remainingDays = typeof row[5] === 'number' ? row[5] : '';
    const uom = row[6] || '';
    const totalPurchase = typeof row[7] === 'number' ? row[7] : 0;
    const totalSales = typeof row[8] === 'number' ? row[8] : 0;
    const beginningQty = row[9];
    const endingQty = typeof row[10] === 'number' ? row[10] : 0;
    const shipped = beginningQty - endingQty;

    const dupKey = dateVal + '||' + code;

    if (existingMap[dupKey] !== undefined) {
      // 重複: 既存行を上書き (シート上の行番号は 2始まり + existingMapのindex)
      const sheetRow = existingMap[dupKey] + 2; // existingData は 0-indexed, シートは 2行目から
      sheet.getRange(sheetRow, 1, 1, 12).setValues([[
        dateVal, code, name, location, expiryDate, remainingDays,
        uom, totalPurchase, totalSales, beginningQty, endingQty, shipped
      ]]);
    } else {
      newRows.push([
        dateVal, code, name, location, expiryDate, remainingDays,
        uom, totalPurchase, totalSales, beginningQty, endingQty, shipped
      ]);
      existingMap[dupKey] = existingData.length + newRows.length - 1; // 重複防止
    }
  }

  if (newRows.length > 0) {
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, newRows.length, 12).setValues(newRows);
  }

  Logger.log('  書込: ' + newRows.length + '行, スキップ: ' + skipped + '行');
}

function buildSalesMap(data) {
  const map = {};
  data.forEach((row, i) => {
    const dateVal = formatDate(row[0]);
    const code = String(row[1]).trim();
    map[dateVal + '||' + code] = i;
  });
  return map;
}

// ==========================================
// INVOICE PROCESSING
// ==========================================

function processInvoiceFolder() {
  const { invoiceFolderId } = getConfig();
  if (!invoiceFolderId) {
    Logger.log('WARN: INVOICE_FOLDER_ID 未設定。setupFolders() を実行してください。');
    return;
  }

  const folder = DriveApp.getFolderById(invoiceFolderId);
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();

    if (name.startsWith('[done]') || name.startsWith('[error]')) continue;
    if (!name.match(/\.(xlsx|xls)$/i)) continue;

    try {
      Logger.log('Invoice 処理開始: ' + name);
      processInvoiceFile(file);
      file.setName('[done]_' + name);
      Logger.log('Invoice 処理完了: ' + name);
    } catch (e) {
      file.setName('[error]_' + name);
      Logger.log('ERROR: Invoice 処理失敗 [' + name + ']: ' + e.message);
    }
  }
}

/**
 * Invoice Excel ファイルをパースして invoice_detail シートに書き込む
 * 列順: A=Date B=InvoiceNo C=Code D=Name E=PickQty
 */
function processInvoiceFile(file) {
  const data = readXlsxData(file);
  if (!data || data.length < 2) return;

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('invoice_detail');
  if (!sheet) throw new Error('シート "invoice_detail" が見つかりません');

  const existingData = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues()
    : [];
  const existingMap = buildInvoiceMap(existingData);

  const newRows = [];
  let skipped = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    // バリデーション
    if (row[0] === '' || row[0] === null || row[0] === undefined) { skipped++; continue; }
    if (row[1] === '' || row[1] === null || row[1] === undefined) { skipped++; continue; }
    if (row[2] === '' || row[2] === null || row[2] === undefined) { skipped++; continue; }
    const codeStr = String(row[2]).trim();
    if (/^[A-Za-z][A-Za-z\s]*$/.test(codeStr)) { skipped++; continue; }

    const dateVal = formatDate(row[0]);
    const invoiceNo = String(row[1]).trim();
    const code = codeStr;
    const name = row[3] || '';
    const pickQty = typeof row[4] === 'number' ? row[4] : 0;

    const dupKey = dateVal + '||' + invoiceNo + '||' + code;

    if (existingMap[dupKey] !== undefined) {
      const sheetRow = existingMap[dupKey] + 2;
      sheet.getRange(sheetRow, 1, 1, 5).setValues([[dateVal, invoiceNo, code, name, pickQty]]);
    } else {
      newRows.push([dateVal, invoiceNo, code, name, pickQty]);
      existingMap[dupKey] = existingData.length + newRows.length - 1;
    }
  }

  if (newRows.length > 0) {
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, newRows.length, 5).setValues(newRows);
  }

  Logger.log('  書込: ' + newRows.length + '行, スキップ: ' + skipped + '行');
}

function buildInvoiceMap(data) {
  const map = {};
  data.forEach((row, i) => {
    const dateVal = formatDate(row[0]);
    const invoiceNo = String(row[1]).trim();
    const code = String(row[2]).trim();
    map[dateVal + '||' + invoiceNo + '||' + code] = i;
  });
  return map;
}

// ==========================================
// REFILL NOTIFICATION
// ==========================================

/**
 * stocker_stock の在庫が予測需要を下回るアイテムを Slack に通知する
 *
 * 予測式: (直近30日日次平均 × weightA) + (直近12週同曜日平均 × weightB)
 * 補充閾値: 予測値 × (1 + SafetyDays)
 */
function runRefillNotification() {
  const ss = getSpreadsheet();

  // --- Config シートから設定を読む ---
  const configSheet = ss.getSheetByName('config');
  if (!configSheet) {
    Logger.log('WARN: config シートが見つかりません');
    return;
  }
  const configData = configSheet.getDataRange().getValues();
  // 期待する config レイアウト:
  //   行1: [SlackWebhookURL, <url>]
  //   行2: [トレンド重み(A), 0.4]
  //   行3: [曜日重み(B),    0.6]
  const slackUrl = configData.length > 0 ? String(configData[0][1]).trim() : '';
  const weightA = configData.length > 1 ? (Number(configData[1][1]) || 0.4) : 0.4;
  const weightB = configData.length > 2 ? (Number(configData[2][1]) || 0.6) : 0.6;

  if (!slackUrl || slackUrl === '') {
    Logger.log('WARN: Slack Webhook URL が未設定です (config シート A1:B1)');
    return;
  }

  // --- sku_master を読む ---
  const masterSheet = ss.getSheetByName('sku_master');
  if (!masterSheet) { Logger.log('WARN: sku_master シートが見つかりません'); return; }
  const masterRows = masterSheet.getLastRow() > 1
    ? masterSheet.getRange(2, 1, masterSheet.getLastRow() - 1, 11).getValues()
    : [];

  const masterMap = {};
  masterRows.forEach(row => {
    if (!row[0]) return;
    masterMap[String(row[0]).trim()] = {
      name: row[1] || '',
      safetyDays: Number(row[9]) || 0, // 列 J = SafetyDays (0-indexed: 9)
    };
  });

  // --- stocker_stock を読む ---
  const stockerSheet = ss.getSheetByName('stocker_stock');
  if (!stockerSheet) { Logger.log('WARN: stocker_stock シートが見つかりません'); return; }
  const stockerRows = stockerSheet.getLastRow() > 1
    ? stockerSheet.getRange(2, 1, stockerSheet.getLastRow() - 1, 4).getValues()
    : [];

  if (stockerRows.length === 0) {
    Logger.log('INFO: stocker_stock にデータがありません');
    return;
  }

  // --- daily_sales を読む (予測用) ---
  const salesSheet = ss.getSheetByName('daily_sales');
  if (!salesSheet) { Logger.log('WARN: daily_sales シートが見つかりません'); return; }
  const salesRows = salesSheet.getLastRow() > 1
    ? salesSheet.getRange(2, 1, salesSheet.getLastRow() - 1, 12).getValues()
    : [];

  // Code → [{date, sales}] のマップを構築
  const salesByCode = buildSalesByCode(salesRows);

  // --- 補充が必要なアイテムを抽出 ---
  const today = new Date();
  const refillList = [];

  stockerRows.forEach(row => {
    const code = String(row[0]).trim();
    if (!code) return;

    const stockerQty = Number(row[2]) || 0;
    const master = masterMap[code];
    const safetyDays = master ? master.safetyDays : 0;
    const name = master ? master.name : (row[1] || code);

    const prediction = calcDailyPrediction(code, salesByCode, today, weightA, weightB);
    const threshold = prediction * (1 + safetyDays);

    if (stockerQty < threshold) {
      refillList.push({
        code,
        name,
        stockerQty: Math.round(stockerQty * 10) / 10,
        prediction: Math.round(prediction * 100) / 100,
        threshold: Math.round(threshold * 10) / 10,
        safetyDays,
        shortage: Math.round((threshold - stockerQty) * 10) / 10,
      });
    }
  });

  if (refillList.length === 0) {
    Logger.log('INFO: 補充対象アイテムなし');
    return;
  }

  postRefillToSlack(slackUrl, refillList, today);
}

/**
 * daily_sales のデータを Code → [{date: Date, sales: number}] にまとめる
 */
function buildSalesByCode(rows) {
  const map = {};
  rows.forEach(row => {
    const code = String(row[1]).trim();
    if (!code) return;
    const dateVal = row[0];
    if (!dateVal) return;
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (isNaN(d.getTime())) return;
    const sales = Number(row[8]) || 0; // TotalSales = 列I (0-indexed: 8)
    if (!map[code]) map[code] = [];
    map[code].push({ date: d, sales });
  });
  return map;
}

/**
 * ハイブリッド予測 (日次): (直近30日平均 × A) + (直近12週同曜日平均 × B)
 */
function calcDailyPrediction(code, salesByCode, today, weightA, weightB) {
  const entries = salesByCode[code];
  if (!entries || entries.length === 0) return 0;

  const dayOfWeek = today.getDay();

  // 直近 30 日の平均日次販売量
  const d30ago = new Date(today);
  d30ago.setDate(today.getDate() - 30);
  const last30 = entries.filter(e => e.date >= d30ago);
  const avg30 = last30.length > 0
    ? last30.reduce((s, e) => s + e.sales, 0) / 30
    : 0;

  // 直近 12 週の同曜日平均
  const sameDay = entries
    .filter(e => e.date.getDay() === dayOfWeek)
    .sort((a, b) => b.date - a.date)
    .slice(0, 12);
  const avgSameDay = sameDay.length > 0
    ? sameDay.reduce((s, e) => s + e.sales, 0) / sameDay.length
    : 0;

  return avg30 * weightA + avgSameDay * weightB;
}

/**
 * 補充リストを Slack に投稿する
 */
function postRefillToSlack(webhookUrl, refillList, today) {
  const dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  let text = '*📦 Refill Alert — ' + dateStr + '*\n';
  text += refillList.length + ' アイテムの補充が必要です:\n\n';

  refillList.sort((a, b) => b.shortage - a.shortage).forEach(item => {
    text += '• *' + item.code + '* ' + item.name + '\n';
    text += '  在庫: ' + item.stockerQty + ' | 閾値: ' + item.threshold +
            ' | 不足: *' + item.shortage + '* (SafetyDays: ' + item.safetyDays + ')\n';
  });

  const payload = JSON.stringify({ text });
  UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    payload,
  });

  Logger.log('Slack 通知送信完了 (' + refillList.length + ' アイテム)');
}

// ==========================================
// HELPERS
// ==========================================

/**
 * xlsx ファイルを一時的に Google スプレッドシートに変換して読み込む
 * ※ Drive API v2 (高度なサービス) が必要
 */
function readXlsxData(file) {
  const blob = file.getBlob();
  const resource = {
    title: '_tmp_nos_' + Utilities.getUuid(),
    mimeType: MimeType.GOOGLE_SHEETS,
  };

  const tempFile = Drive.Files.insert(resource, blob, { convert: true });
  try {
    const tempSS = SpreadsheetApp.openById(tempFile.id);
    const sheet = tempSS.getSheets()[0];
    return sheet.getDataRange().getValues();
  } finally {
    DriveApp.getFileById(tempFile.id).setTrashed(true);
  }
}

/**
 * Date オブジェクトまたは文字列を "yyyy-MM-dd" 形式に変換する
 */
function formatDate(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  // Excel シリアル値の場合は Date に変換済みのはずだが、念のため文字列のまま返す
  return String(value);
}
