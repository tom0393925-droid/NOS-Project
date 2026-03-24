# NOS Inventory System — GAS セットアップガイド

## 概要

ERPからExcelをGoogle Driveにアップロードするだけで
在庫分析・補充通知が毎朝自動実行されるシステムです。

```
📥sales/  ←── ERP Excel をここに置く
📥invoice/ ←── Invoice Excel をここに置く
         ↓
   Google Apps Script (毎朝7時)
         ↓
   Google Spreadsheet (5シート)
         ↓
   Slack 補充通知 / NOSサイト更新
```

---

## Step 1: Google Spreadsheet を作成する

1. [Google Sheets](https://sheets.google.com) で新しいスプレッドシートを作成
2. URLから **スプレッドシートID** をコピーしておく
   例: `https://docs.google.com/spreadsheets/d/`**`1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`**`/edit`
3. 5つのシートを作成（タブを追加）:
   - `daily_sales`
   - `invoice_detail`
   - `sku_master`
   - `stocker_stock`
   - `config`

---

## Step 2: Apps Script プロジェクトを作成する

1. スプレッドシートのメニュー: **拡張機能 > Apps Script**
2. 新しいプロジェクトが開く
3. デフォルトの `コード.gs` を削除
4. `+` ボタンで **スクリプト** を追加:
   - `Code.gs` → `gas/Code.gs` の内容をコピー
   - `SampleData.gs` → `gas/SampleData.gs` の内容をコピー（初回テスト用）

---

## Step 3: Drive API を有効化する

> **xlsx を読み込むために必須**

1. Apps Script エディタの左サイドバー: **サービス** (＋アイコン)
2. **Drive API** を検索して選択
3. バージョン: **v2** を選択
4. **追加** をクリック

---

## Step 4: スクリプトプロパティを設定する

1. Apps Script エディタ: **プロジェクトの設定 > スクリプト プロパティ**
2. 以下を追加:

| プロパティ名 | 値 |
|---|---|
| `SPREADSHEET_ID` | Step 1 でコピーしたスプレッドシートID |

3. `SALES_FOLDER_ID` と `INVOICE_FOLDER_ID` は次の Step で自動設定されます

---

## Step 5: 初期セットアップ関数を実行する

Apps Script エディタで順番に実行:

```
1. setupFolders()     → Google Drive に 📥sales / 📥invoice フォルダを作成
                        フォルダIDをスクリプトプロパティに自動保存
2. setupAllSheets()   → 全シートのヘッダーとサンプルマスタを設定
```

実行後、プロジェクトの設定で `SALES_FOLDER_ID` と `INVOICE_FOLDER_ID` が
自動的に追加されていることを確認してください。

---

## Step 6: Slack Webhook を設定する

1. スプレッドシートの `config` シートを開く
2. B1 セルの Slack Webhook URL を本番のURLに更新:
   ```
   https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```
3. Webhook URLの取得: [Slack API > Incoming Webhooks](https://api.slack.com/messaging/webhooks)

---

## Step 7: トリガーを設定する

1. Apps Script エディタ左サイドバー: **トリガー** (時計アイコン)
2. **トリガーを追加** をクリック
3. 設定:
   ```
   実行する関数: runAll
   イベントのソース: 時間主導型
   時間ベースのトリガーのタイプ: 日付ベースのタイマー
   時刻: 午前6時〜7時
   ```
4. **保存**

---

## Step 8: テスト実行

### サンプルデータを直接投入する場合

Apps Script で `insertSampleSalesData()` と `insertSampleInvoiceData()` を実行
→ 過去30日分のデータが自動生成される

### Excel アップロードをテストする場合

`samples/` ディレクトリのサンプルExcelを
Google Drive の `📥sales` または `📥invoice` フォルダにアップロードして
`runAll()` を手動実行

---

## ERP Excel の列順（期待するフォーマット）

### Sales ファイル

| 列 | 項目 | 備考 |
|---|---|---|
| A | Date | 日付 |
| B | Code | SKUコード（英字のみの行はカテゴリとして自動スキップ）|
| C | Name | 商品名 |
| D | Location | ロケーション |
| E | ExpiryDate | 賞味期限 |
| F | RemainingDays | 残日数 |
| G | UoM | 単位 |
| H | TotalPurchase | 仕入数量 |
| I | TotalSales | 販売数量 |
| J | BeginningQty | 期首在庫（数値でない行は自動スキップ）|
| K | EndingQty | 期末在庫 |

### Invoice ファイル

| 列 | 項目 |
|---|---|
| A | Date |
| B | InvoiceNo |
| C | Code |
| D | Name |
| E | PickQty |

---

## バリデーションルール（自動スキップ）

- A列(Date)が空の行
- B列(Code)が空の行
- B列が英字のみの行 → カテゴリ行 (Beverage, Frozen等)
- J列(BeginningQty)が数値でない行 → 合計行・小計行

---

## ファイル命名規則

| プレフィックス | 意味 |
|---|---|
| (なし) | 未処理。次回 `runAll()` で処理される |
| `[done]_` | 処理済み |
| `[error]_` | エラー発生。ログを確認してください |

---

## トラブルシューティング

**「SPREADSHEET_ID が未設定」エラー**
→ スクリプトプロパティに `SPREADSHEET_ID` を設定してください

**「シート "daily_sales" が見つかりません」エラー**
→ `setupAllSheets()` を実行してください

**「Drive API が見つかりません」エラー**
→ Step 3: Drive API v2 の有効化を確認してください

**Slack に通知が届かない**
→ `config` シートの B1 セルの Webhook URL を確認してください
→ `stocker_stock` に在庫データが入っているか確認してください
