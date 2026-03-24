// ============================================================
// js/sheets-api.js
// Google Sheets API からデータを読み込み、既存のデータ構造に変換する
// ============================================================

const SheetsAPI = {

  // ==========================================
  // Public: メイン読込エントリポイント
  // ==========================================

  async loadAll() {
    const sheetId = document.getElementById('sheetsSheetId').value.trim();
    const apiKey = document.getElementById('sheetsApiKey').value.trim();

    if (!sheetId || !apiKey) {
      alert('Sheet ID と API Key を入力してください');
      return;
    }

    const btn = document.getElementById('loadSheetsBtn');
    const status = document.getElementById('sheetsLoadStatus');
    btn.disabled = true;
    btn.textContent = 'Loading...';
    status.textContent = '';
    status.className = 'text-sm mt-2 font-medium text-gray-500';

    try {
      status.textContent = 'Fetching sheets...';

      const [masterRows, salesRows, invoiceRows] = await Promise.all([
        this._fetchSheet(sheetId, apiKey, 'sku_master'),
        this._fetchSheet(sheetId, apiKey, 'daily_sales'),
        this._fetchSheet(sheetId, apiKey, 'invoice_detail'),
      ]);

      // --- sku_master → skuMaster ---
      skuMaster = this._convertSkuMaster(masterRows);
      assignRandomLocationsIfMissing();

      // --- daily_sales → historyData (weekly) ---
      status.textContent = 'Aggregating weekly data...';
      const salesResult = this._convertDailySales(salesRows);
      historyData = salesResult.historyData;
      loadedWeeks = salesResult.weekCount;
      loadedFiles = salesResult.weekLabels;

      // --- invoice_detail → invoiceHistoryData (weekly) ---
      invoiceHistoryData = this._convertInvoiceDetail(invoiceRows, salesResult.weekKeys);
      loadedInvoiceWeeks = salesResult.weekCount;
      loadedInvoiceFiles = salesResult.weekLabels.map(w => 'Invoice ' + w);

      // --- UI 更新 ---
      updateHistoryListUI();
      updateInvoiceHistoryListUI();
      if (typeof renderMasterList === 'function') renderMasterList();
      if (typeof renderActionList === 'function') renderActionList();

      const skuCount = Object.keys(skuMaster).length;
      const lotCount = Object.keys(historyData).length;
      status.textContent = `✅ Loaded: ${skuCount} SKUs · ${lotCount} lots · ${loadedWeeks} weeks`;
      status.className = 'text-sm mt-2 font-bold text-green-600';

    } catch (e) {
      console.error(e);
      status.textContent = '❌ Error: ' + e.message;
      status.className = 'text-sm mt-2 font-bold text-red-600';
    } finally {
      btn.disabled = false;
      btn.textContent = '🔄 Load from Google Sheets';
    }
  },

  // ==========================================
  // Private: Sheets API フェッチ
  // ==========================================

  async _fetchSheet(sheetId, apiKey, sheetName) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(sheetName)}?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`"${sheetName}" の取得失敗 (${res.status}): ${err.error?.message || res.statusText}`);
    }
    const json = await res.json();
    return json.values || [];
  },

  // ==========================================
  // Private: sku_master → skuMaster オブジェクト
  // ==========================================

  _convertSkuMaster(rows) {
    if (rows.length < 2) return {};
    const headers = rows[0].map(h => String(h).trim());
    const idx = h => headers.indexOf(h);

    const result = {};
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const code = String(row[idx('Code')] || '').trim();
      if (!code) continue;

      result[code] = {
        name:        row[idx('Name')]        || '',
        location:    row[idx('Location')]    || '',
        storageType: row[idx('StorageType')] || 'Dry',
        tc:          parseFloat(row[idx('TC')])          || 0,
        price:       parseFloat(row[idx('Price')])       || 0,
        uom:         row[idx('UoM')]         || '',
        weight:      parseFloat(row[idx('Weight')])      || 0,
        safetyStock: parseFloat(row[idx('SafetyStock')]) || 0,
        safetyDays:  parseFloat(row[idx('SafetyDays')])  || 0,
        isFF:        this._parseBool(row[idx('isFF')]),
      };
    }
    return result;
  },

  // ==========================================
  // Private: daily_sales → historyData (週次集計)
  //
  // 返り値:
  //   { historyData, weekCount, weekKeys, weekLabels }
  //
  // historyData のキー: "CODE_ExpiryDate" (例: "SKU-001_2026-12-31")
  //   qtys  : 週末(土曜)の EndingQty 配列 [最古 ... 最新]
  //   sales : その週の TotalSales 合計配列
  //   expiry: Date オブジェクト or null
  // ==========================================

  _convertDailySales(rows) {
    if (rows.length < 2) return { historyData: {}, weekCount: 0, weekKeys: [], weekLabels: [] };

    const headers = rows[0].map(h => String(h).trim());
    const idx = h => headers.indexOf(h);
    const iDate = idx('Date'), iCode = idx('Code'), iExpiry = idx('ExpiryDate');
    const iSales = idx('TotalSales'), iEndQty = idx('EndingQty');

    // 日付 → (code+expiry) → {endQty, sales} のマップを構築
    // groups["CODE||expiry"]["2026-03-10"] = { endQty, sales }
    const groups = {};
    const allDateSet = new Set();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rawDate = row[iDate];
      const code = String(row[iCode] || '').trim();
      if (!rawDate || !code) continue;

      const dateStr = this._toDateStr(rawDate);
      if (!dateStr) continue;
      allDateSet.add(dateStr);

      const expiry = row[iExpiry] ? String(row[iExpiry]).trim() : '';
      const groupKey = code + '||' + expiry;
      if (!groups[groupKey]) groups[groupKey] = { code, expiry, byDate: {} };

      const endQty = parseFloat(row[iEndQty]) || 0;
      const sales  = parseFloat(row[iSales])  || 0;

      // 同日の重複はより新しい行で上書き (GAS が上書き書込みするため最後の行が正)
      groups[groupKey].byDate[dateStr] = { endQty, sales };
    }

    // 週キー一覧を構築 (月曜日を週の代表キーとする)
    const weekSet = new Set([...allDateSet].map(d => this._weekKey(d)));
    const weekKeys = [...weekSet].sort();

    // historyData に変換
    const historyData = {};
    for (const [gKey, group] of Object.entries(groups)) {
      const qtys  = [];
      const sales = [];
      let prevQty = 0;

      for (const wk of weekKeys) {
        // その週に含まれる日のデータを収集
        const weekDays = Object.entries(group.byDate)
          .filter(([d]) => this._weekKey(d) === wk)
          .sort((a, b) => a[0].localeCompare(b[0]));

        if (weekDays.length > 0) {
          // 週末の EndingQty (最終営業日)
          prevQty = weekDays[weekDays.length - 1][1].endQty;
          qtys.push(prevQty);
          // 週の販売合計
          sales.push(weekDays.reduce((s, [, v]) => s + v.sales, 0));
        } else {
          // その週にデータがない → 前週のQtyを引き継ぎ (在庫変動なし扱い)
          qtys.push(prevQty);
          sales.push(0);
        }
      }

      const expiryDate = group.expiry ? new Date(group.expiry) : null;
      const histKey = group.code + '_' + (group.expiry || 'noexpiry');
      historyData[histKey] = { code: group.code, qtys, sales, expiry: expiryDate };
    }

    const weekLabels = weekKeys.map(wk => 'W/' + wk);

    return { historyData, weekCount: weekKeys.length, weekKeys, weekLabels };
  },

  // ==========================================
  // Private: invoice_detail → invoiceHistoryData (週次集計)
  //
  // hits[i] = 第i週に何回ピックされたか (invoice行数)
  // ==========================================

  _convertInvoiceDetail(rows, weekKeys) {
    if (rows.length < 2 || weekKeys.length === 0) return {};

    const headers = rows[0].map(h => String(h).trim());
    const idx = h => headers.indexOf(h);
    const iDate = idx('Date'), iCode = idx('Code');

    // code → { weekKey: count }
    const hitMap = {};
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rawDate = row[iDate];
      const code = String(row[iCode] || '').trim();
      if (!rawDate || !code) continue;

      const dateStr = this._toDateStr(rawDate);
      if (!dateStr) continue;
      const wk = this._weekKey(dateStr);

      if (!hitMap[code]) hitMap[code] = {};
      hitMap[code][wk] = (hitMap[code][wk] || 0) + 1;
    }

    const result = {};
    for (const [code, wkCounts] of Object.entries(hitMap)) {
      result[code] = {
        code,
        hits: weekKeys.map(wk => wkCounts[wk] || 0),
      };
    }
    return result;
  },

  // ==========================================
  // Helpers
  // ==========================================

  /** 任意の日付値を "yyyy-MM-dd" 文字列に変換 */
  _toDateStr(val) {
    if (!val) return '';
    if (typeof val === 'string') {
      // 既に yyyy-MM-dd 形式ならそのまま
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      return '';
    }
    return '';
  },

  /** 日付文字列から週の月曜日 (yyyy-MM-dd) を返す */
  _weekKey(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day; // 月曜日へのオフセット
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  },

  _parseBool(val) {
    if (val === true || val === 'TRUE' || val === '1' || val === 'true') return true;
    return false;
  },
};
