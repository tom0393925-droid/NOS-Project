# NOS-Project — 在庫管理・発注計画システム

社内向けの在庫管理・発注計画Webアプリケーションです。Googleスプレッドシートからデータを取り込み、在庫状況の分析・発注量の自動シミュレーションを行います。

---

## ディレクトリ構成

```
NOS-Project/
├── index.html            # アプリ本体（画面の骨格）
├── login.html            # ログイン画面
├── style.css             # 見た目のスタイル定義
├── js/                   # 機能ごとに分割されたプログラム
│   ├── state.js          # アプリ全体で共有するデータの保管庫
│   ├── main.js           # 画面の起動・タブ切替・発注量カスケード処理
│   ├── ui.js             # 分析パネル（SKU詳細・在庫予測・発注ヒント）
│   ├── ui_analytics.js   # Order Planningテーブル・ABCランク分析
│   ├── ui_categories.js  # カテゴリ・コンテナ設定画面
│   ├── ui_map.js         # 棚マップ（倉庫ロケーション管理）
│   ├── ui_master.js      # SKUマスタ管理画面
│   ├── chart.js          # 将来在庫のグラフ描画・シミュレーション
│   ├── excel.js          # Order Planning → Excelファイル出力
│   ├── sheets-api.js     # Googleスプレッドシートからのデータ読み込み
│   ├── supabase-client.js # データベース（Supabase）との通信
│   ├── supabase-upload.js # スプレッドシートデータのDB保存処理
│   └── utils.js          # 日付計算などの小さな共通処理
├── gas/                  # Google Apps Script（スプレッドシート側の処理）
│   ├── Code.gs           # スプレッドシートからデータを出力するスクリプト
│   └── SampleData.gs     # テスト用サンプルデータ生成スクリプト
└── .claude/
    ├── settings.local.json  # Claude Codeの権限設定
    └── skills/
        └── consult.md       # /consult コマンド（意見交換モード）の定義
```

---

## 各ファイルの役割（非エンジニア向け）

### 画面・スタイル

| ファイル | 役割 |
|----------|------|
| `index.html` | アプリの「骨格」。タブ・ボタン・テーブルなど画面上のすべての要素が書かれています |
| `login.html` | Googleアカウントでのログイン画面 |
| `style.css` | 色・フォント・レイアウトなど、画面の見た目を定義しています |

### プログラム（js/）

| ファイル | 役割 |
|----------|------|
| `state.js` | 在庫データ・週次売上・設定値（安全在庫週数など）をアプリ全体で共有するための「共有メモリ」 |
| `main.js` | アプリの司令塔。タブ切替・コンテナ到着日の保存・発注量を入力したときのカスケード自動計算を担当 |
| `ui.js` | SKUをクリックしたときに開く「分析パネル」の表示担当。在庫予測グラフ・発注ヒント・WOSの計算を行う |
| `ui_analytics.js` | 「Order Planning」タブのテーブル表示・ABCランク分析・クロス分析を担当。全SKUをまとめて一覧で見る画面 |
| `ui_categories.js` | カテゴリ（CFJP/RFJPなど）の設定・コンテナ到着日の入力画面 |
| `ui_map.js` | 棚番号とSKUの対応を管理する倉庫ロケーション画面 |
| `ui_master.js` | SKUの基本情報（品名・UOM・安全在庫など）を管理するマスタ画面 |
| `chart.js` | 将来の在庫推移をグラフで描画するエンジン。欠品SKUの需要推定ロジック（`_calcStockoutAvg`）もここに定義 |
| `excel.js` | Order PlanningテーブルをExcelファイルとしてダウンロードする機能 |
| `sheets-api.js` | GoogleスプレッドシートAPIを使って週次売上データを読み込む処理 |
| `supabase-client.js` | クラウドDB（Supabase）への読み書き。SKUマスタ・売上履歴・発注データの永続化を担当 |
| `supabase-upload.js` | スプレッドシートから読み込んだデータをDBへアップロードする処理 |
| `utils.js` | 「最新データ日付の取得」など、複数箇所で使う小さな共通処理をまとめたファイル |

### Google Apps Script（gas/）

| ファイル | 役割 |
|----------|------|
| `Code.gs` | Googleスプレッドシート側で動くスクリプト。スプレッドシートのデータをWebアプリが読める形式に出力する |
| `SampleData.gs` | 開発・テスト時にダミーデータを自動生成するためのスクリプト |

---

## 主要な機能一覧

| 機能 | 担当ファイル |
|------|-------------|
| SKU在庫の将来予測グラフ | `chart.js` + `ui.js` |
| 欠品SKUの需要推定（Stockout Avg） | `chart.js` (`_calcStockoutAvg`) |
| 発注量の自動計算ヒント（auto: X） | `ui.js` + `main.js` |
| Order Planningテーブル | `ui_analytics.js` |
| 発注量入力時の連鎖自動計算（カスケード） | `main.js` (`updateShipmentOrder`) + `ui_analytics.js` (`onOrderQtyChange`) |
| Excelエクスポート | `excel.js` |
| ABCランク分析 | `ui_analytics.js` |
| 棚マップ管理 | `ui_map.js` |
| SKUマスタ管理 | `ui_master.js` |
| ログイン認証（Google OAuth） | `supabase-client.js` |

---

## 重要な設計メモ

- **安全在庫の計算**: `avg（週平均売上）× safetyWeeks（デフォルト6週）` で算出。`safetyWeeks`はユーザーが画面から変更可能。
- **欠品SKUの特別扱い**: 在庫が0になったSKUは通常の12週平均では需要が0と計算されてしまうため、`_calcStockoutAvg`で欠品前の連続在庫期間から消費量を逆算して需要推定する。
- **到着週のセール除外**: コンテナ到着週は「その週の半ばに届く」という前提で、到着週の売上を0とみなした在庫予測を行う。これにより週境界のズレによる過剰発注を防ぐ。
- **データの基準日**: 「今日」ではなく「最後にロードしたデータファイルの日付」（`getLatestDataDate()`）を基準に週数計算を行う。
