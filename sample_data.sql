-- ============================================================
-- NOS Dashboard Sample Data（全タブ対応）
-- 実行方法: Supabase > SQL Editor に全文コピーして Run
-- 削除方法: 末尾の「削除用SQL」を実行
-- ============================================================

-- テーブルをすべて削除して再作成（再実行時も安全）
DROP TABLE IF EXISTS sample_picking_data;
DROP TABLE IF EXISTS sample_shipment_orders;
DROP TABLE IF EXISTS sample_sku_category_map;
DROP TABLE IF EXISTS sample_order_categories;
DROP TABLE IF EXISTS sample_weekly_sales;
DROP TABLE IF EXISTS sample_sku_master;

-- ============================================================
-- sample_sku_master
-- ============================================================
CREATE TABLE sample_sku_master (
    code         text PRIMARY KEY,
    name         text,
    uom          text,
    price        numeric,
    tc           numeric,
    weight       numeric,
    storage_type text,
    manufacture  text,
    location     text,
    is_ff        boolean DEFAULT false,
    updated_at   timestamptz DEFAULT now()
);
ALTER TABLE sample_sku_master DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- sample_weekly_sales
-- ============================================================
CREATE TABLE sample_weekly_sales (
    id          bigserial PRIMARY KEY,
    code        text,
    expiry_date date,
    location    text,
    week_start  date,
    ending_qty  numeric,
    total_sales numeric
);
ALTER TABLE sample_weekly_sales DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- sample_order_categories
-- ============================================================
CREATE TABLE sample_order_categories (
    id    text PRIMARY KEY,
    name  text,
    next1 date,
    next2 date,
    next3 date
);
ALTER TABLE sample_order_categories DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- sample_sku_category_map
-- ============================================================
CREATE TABLE sample_sku_category_map (
    sku_code    text,
    category_id text,
    PRIMARY KEY (sku_code, category_id)
);
ALTER TABLE sample_sku_category_map DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- sample_shipment_orders
-- ============================================================
CREATE TABLE sample_shipment_orders (
    id           bigserial PRIMARY KEY,
    code         text,
    arrival_date date,
    order_qty    numeric,
    status       text DEFAULT 'pending'
);
ALTER TABLE sample_shipment_orders DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- sample_picking_data（Warehouse Map用）
-- ============================================================
CREATE TABLE sample_picking_data (
    id          bigserial PRIMARY KEY,
    code        text,
    client_name text,
    week_start  date,
    pick_qty    numeric,
    pick_count  integer
);
ALTER TABLE sample_picking_data DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- SKUマスター（7品目）
-- ============================================================
INSERT INTO sample_sku_master (code, name, uom, price, tc, weight, storage_type, manufacture, location, is_ff) VALUES
('DEMO001', 'Demo Fresh Pasta 500g',      'pkt', 3.50, 3.50,  0.5,  'Dry',    'Demo Foods', 'A', false),
('DEMO002', 'Demo Soy Sauce 1L',          'btl', 0,    8.00,  1.0,  'Dry',    'Demo Foods', 'A', false),
('DEMO003', 'Demo Seafood Sauce 500ml',   'btl', 0,   12.00,  0.6,  'Dry',    'Demo Foods', 'B', false),
('DEMO004', 'Demo Rice 25kg',             'bag', 0,   45.00, 25.0,  'Dry',    'Demo Foods', 'C', false),
('DEMO005', 'Demo Kitchen Towel 12pk',    'pkt', 0,   15.00,  2.0,  'Dry',    'Demo Foods', 'D', false),
('DEMO006', 'Demo Frozen Shrimp 1kg',     'kg',  0,   25.00,  1.0,  'Frozen', 'Demo Foods', 'F', true),
('DEMO007', 'Demo Expired Vinegar 750ml', 'btl', 0,    6.00,  0.8,  'Dry',    'Demo Foods', 'B', false);

-- ============================================================
-- DEMO001 週次在庫データ（52週分・3バッチ）
-- Batch 1: expiry 2025-12-31 / 2025-05-05〜2025-08-04（14週）小ロット入荷・需要立ち上がり期
-- Batch 2: expiry 2026-09-30 / 2025-08-04〜2026-01-19（25週）需要増を見越した大きな発注
-- Batch 3: expiry 2027-03-01 / 2026-01-19〜2026-04-27（15週）需要定着・最大発注
-- 販売推移: 10 pkt/週（May-25）→ 29 pkt/週（Apr-26） / 現在庫: 76 pkt
-- ============================================================

-- Batch 1 (expiry 2025-12-31): 220pkt入荷（需要立ち上がり期・小ロット）
INSERT INTO sample_weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO001', '2025-12-31', 'A', '2025-05-05', 210, 10),
('DEMO001', '2025-12-31', 'A', '2025-05-12', 199, 11),
('DEMO001', '2025-12-31', 'A', '2025-05-19', 187, 12),
('DEMO001', '2025-12-31', 'A', '2025-05-26', 174, 13),
('DEMO001', '2025-12-31', 'A', '2025-06-02', 160, 14),
('DEMO001', '2025-12-31', 'A', '2025-06-09', 146, 14),
('DEMO001', '2025-12-31', 'A', '2025-06-16', 131, 15),
('DEMO001', '2025-12-31', 'A', '2025-06-23', 115, 16),
('DEMO001', '2025-12-31', 'A', '2025-06-30',  99, 16),
('DEMO001', '2025-12-31', 'A', '2025-07-07',  82, 17),
('DEMO001', '2025-12-31', 'A', '2025-07-14',  64, 18),
('DEMO001', '2025-12-31', 'A', '2025-07-21',  46, 18),
('DEMO001', '2025-12-31', 'A', '2025-07-28',  27, 19),
('DEMO001', '2025-12-31', 'A', '2025-08-04',   0, 27);

-- Batch 2 (expiry 2026-09-30): 520pkt入荷（需要成長を受け大幅増量）
INSERT INTO sample_weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO001', '2026-09-30', 'A', '2025-08-04', 520,  0),
('DEMO001', '2026-09-30', 'A', '2025-08-11', 504, 16),
('DEMO001', '2026-09-30', 'A', '2025-08-18', 486, 18),
('DEMO001', '2026-09-30', 'A', '2025-08-25', 468, 18),
('DEMO001', '2026-09-30', 'A', '2025-09-01', 449, 19),
('DEMO001', '2026-09-30', 'A', '2025-09-08', 430, 19),
('DEMO001', '2026-09-30', 'A', '2025-09-15', 410, 20),
('DEMO001', '2026-09-30', 'A', '2025-09-22', 390, 20),
('DEMO001', '2026-09-30', 'A', '2025-09-29', 369, 21),
('DEMO001', '2026-09-30', 'A', '2025-10-06', 348, 21),
('DEMO001', '2026-09-30', 'A', '2025-10-13', 327, 21),
('DEMO001', '2026-09-30', 'A', '2025-10-20', 306, 21),
('DEMO001', '2026-09-30', 'A', '2025-10-27', 284, 22),
('DEMO001', '2026-09-30', 'A', '2025-11-03', 262, 22),
('DEMO001', '2026-09-30', 'A', '2025-11-10', 240, 22),
('DEMO001', '2026-09-30', 'A', '2025-11-17', 218, 22),
('DEMO001', '2026-09-30', 'A', '2025-11-24', 195, 23),
('DEMO001', '2026-09-30', 'A', '2025-12-01', 172, 23),
('DEMO001', '2026-09-30', 'A', '2025-12-08', 149, 23),
('DEMO001', '2026-09-30', 'A', '2025-12-15', 125, 24),
('DEMO001', '2026-09-30', 'A', '2025-12-22', 101, 24),
('DEMO001', '2026-09-30', 'A', '2025-12-29',  77, 24),
('DEMO001', '2026-09-30', 'A', '2026-01-05',  52, 25),
('DEMO001', '2026-09-30', 'A', '2026-01-12',  27, 25),
('DEMO001', '2026-09-30', 'A', '2026-01-19',   0, 27);

-- Batch 3 (expiry 2027-03-01): 450pkt入荷（需要定着・安定した大口発注）
INSERT INTO sample_weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO001', '2027-03-01', 'A', '2026-01-19', 450,  0),
('DEMO001', '2027-03-01', 'A', '2026-01-26', 426, 24),
('DEMO001', '2027-03-01', 'A', '2026-02-02', 401, 25),
('DEMO001', '2027-03-01', 'A', '2026-02-09', 376, 25),
('DEMO001', '2027-03-01', 'A', '2026-02-16', 350, 26),
('DEMO001', '2027-03-01', 'A', '2026-02-23', 324, 26),
('DEMO001', '2027-03-01', 'A', '2026-03-02', 298, 26),
('DEMO001', '2027-03-01', 'A', '2026-03-09', 271, 27),
('DEMO001', '2027-03-01', 'A', '2026-03-16', 244, 27),
('DEMO001', '2027-03-01', 'A', '2026-03-23', 217, 27),
('DEMO001', '2027-03-01', 'A', '2026-03-30', 189, 28),
('DEMO001', '2027-03-01', 'A', '2026-04-06', 161, 28),
('DEMO001', '2027-03-01', 'A', '2026-04-13', 133, 28),
('DEMO001', '2027-03-01', 'A', '2026-04-20', 105, 28),
('DEMO001', '2027-03-01', 'A', '2026-04-27',  76, 29);

-- ============================================================
-- DEMO002〜DEMO007: 8週分データ（2026-03-09〜2026-04-27）
-- ============================================================

-- DEMO002: Section 2 - No Sale 1m / Expiry < 3m
INSERT INTO sample_weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO002', '2026-07-15', 'A', '2026-03-09', 120, 15),
('DEMO002', '2026-07-15', 'A', '2026-03-16', 105, 15),
('DEMO002', '2026-07-15', 'A', '2026-03-23',  90, 12),
('DEMO002', '2026-07-15', 'A', '2026-03-30',  80, 10),
('DEMO002', '2026-07-15', 'A', '2026-04-06',  80,  0),
('DEMO002', '2026-07-15', 'A', '2026-04-13',  80,  0),
('DEMO002', '2026-07-15', 'A', '2026-04-20',  80,  0),
('DEMO002', '2026-07-15', 'A', '2026-04-27',  80,  0);

-- DEMO003: Section 3 - Slow to Clear
INSERT INTO sample_weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO003', '2026-06-30', 'B', '2026-03-09', 120, 5),
('DEMO003', '2026-06-30', 'B', '2026-03-16', 115, 5),
('DEMO003', '2026-06-30', 'B', '2026-03-23', 110, 5),
('DEMO003', '2026-06-30', 'B', '2026-03-30', 105, 5),
('DEMO003', '2026-06-30', 'B', '2026-04-06', 102, 3),
('DEMO003', '2026-06-30', 'B', '2026-04-13',  99, 3),
('DEMO003', '2026-06-30', 'B', '2026-04-20',  96, 3),
('DEMO003', '2026-06-30', 'B', '2026-04-27',  93, 3);

-- DEMO004: Section 4 - No Sale 1m / Expiry > 3m / over $500
INSERT INTO sample_weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO004', '2027-06-01', 'C', '2026-03-09', 20, 5),
('DEMO004', '2027-06-01', 'C', '2026-03-16', 18, 2),
('DEMO004', '2027-06-01', 'C', '2026-03-23', 16, 2),
('DEMO004', '2027-06-01', 'C', '2026-03-30', 15, 1),
('DEMO004', '2027-06-01', 'C', '2026-04-06', 15, 0),
('DEMO004', '2027-06-01', 'C', '2026-04-13', 15, 0),
('DEMO004', '2027-06-01', 'C', '2026-04-20', 15, 0),
('DEMO004', '2027-06-01', 'C', '2026-04-27', 15, 0);

-- DEMO005: Section 5 - No Sale 1m / No Expiry Date
INSERT INTO sample_weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO005', null, 'D', '2026-03-09', 30, 3),
('DEMO005', null, 'D', '2026-03-16', 27, 3),
('DEMO005', null, 'D', '2026-03-23', 24, 3),
('DEMO005', null, 'D', '2026-03-30', 22, 2),
('DEMO005', null, 'D', '2026-04-06', 22, 0),
('DEMO005', null, 'D', '2026-04-13', 22, 0),
('DEMO005', null, 'D', '2026-04-20', 22, 0),
('DEMO005', null, 'D', '2026-04-27', 22, 0);

-- DEMO006: Section 6 - FF Item
INSERT INTO sample_weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO006', '2026-08-01', 'F', '2026-03-09', 50, 8),
('DEMO006', '2026-08-01', 'F', '2026-03-16', 44, 6),
('DEMO006', '2026-08-01', 'F', '2026-03-23', 40, 4),
('DEMO006', '2026-08-01', 'F', '2026-03-30', 38, 2),
('DEMO006', '2026-08-01', 'F', '2026-04-06', 38, 0),
('DEMO006', '2026-08-01', 'F', '2026-04-13', 38, 0),
('DEMO006', '2026-08-01', 'F', '2026-04-20', 38, 0),
('DEMO006', '2026-08-01', 'F', '2026-04-27', 38, 0);

-- DEMO007: Section 7 - Expired Item
INSERT INTO sample_weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO007', '2026-03-15', 'B', '2026-03-09', 25, 5),
('DEMO007', '2026-03-15', 'B', '2026-03-16', 20, 0),
('DEMO007', '2026-03-15', 'B', '2026-03-23', 20, 0),
('DEMO007', '2026-03-15', 'B', '2026-03-30', 20, 0),
('DEMO007', '2026-03-15', 'B', '2026-04-06', 20, 0),
('DEMO007', '2026-03-15', 'B', '2026-04-13', 20, 0),
('DEMO007', '2026-03-15', 'B', '2026-04-20', 20, 0),
('DEMO007', '2026-03-15', 'B', '2026-04-27', 20, 0);

-- ============================================================
-- オーダーカテゴリー（CFJP=Dry / RFJP=Frozen）
-- ============================================================
INSERT INTO sample_order_categories (id, name, next1, next2, next3) VALUES
('CFJP', 'Demo Dry',    '2026-05-15', '2026-06-12', '2026-07-10'),
('RFJP', 'Demo Frozen', '2026-05-20', '2026-06-18', '2026-07-16');

-- ============================================================
-- SKU → カテゴリ紐付け
-- ============================================================
INSERT INTO sample_sku_category_map (sku_code, category_id) VALUES
('DEMO001', 'CFJP'),
('DEMO002', 'CFJP'),
('DEMO003', 'CFJP'),
('DEMO004', 'CFJP'),
('DEMO005', 'CFJP'),
('DEMO007', 'CFJP'),
('DEMO006', 'RFJP');

-- ============================================================
-- 入荷予定（DEMO001: 過去2回完了 + 次回pending）
-- ============================================================
INSERT INTO sample_shipment_orders (code, arrival_date, order_qty, status) VALUES
('DEMO001', '2025-08-04',  480, 'completed'),
('DEMO001', '2026-01-19',  360, 'completed'),
('DEMO001', '2026-05-15',  240, 'pending'),
('DEMO002', '2026-05-15',  200, 'pending'),
('DEMO004', '2026-05-15',   30, 'pending'),
('DEMO003', '2026-06-12',  150, 'pending');

-- ============================================================
-- ピッキングデータ
-- DEMO001: 52週分（2025-05-05〜2026-04-27）
-- DEMO002〜006: 8週分（2026-03-09〜2026-04-27）
-- ============================================================

-- DEMO001: 52週 / 約20pkt・8回/週
INSERT INTO sample_picking_data (code, client_name, week_start, pick_qty, pick_count) VALUES
('DEMO001', 'Demo Client', '2025-05-05', 20, 8),
('DEMO001', 'Demo Client', '2025-05-12', 22, 8),
('DEMO001', 'Demo Client', '2025-05-19', 20, 8),
('DEMO001', 'Demo Client', '2025-05-26', 20, 7),
('DEMO001', 'Demo Client', '2025-06-02', 20, 8),
('DEMO001', 'Demo Client', '2025-06-09', 22, 9),
('DEMO001', 'Demo Client', '2025-06-16', 20, 8),
('DEMO001', 'Demo Client', '2025-06-23', 20, 8),
('DEMO001', 'Demo Client', '2025-06-30', 20, 8),
('DEMO001', 'Demo Client', '2025-07-07', 20, 8),
('DEMO001', 'Demo Client', '2025-07-14', 20, 7),
('DEMO001', 'Demo Client', '2025-07-21', 20, 8),
('DEMO001', 'Demo Client', '2025-07-28', 22, 8),
('DEMO001', 'Demo Client', '2025-08-04', 14, 6),
('DEMO001', 'Demo Client', '2025-08-11', 20, 8),
('DEMO001', 'Demo Client', '2025-08-18', 20, 8),
('DEMO001', 'Demo Client', '2025-08-25', 22, 9),
('DEMO001', 'Demo Client', '2025-09-01', 20, 8),
('DEMO001', 'Demo Client', '2025-09-08', 20, 8),
('DEMO001', 'Demo Client', '2025-09-15', 20, 8),
('DEMO001', 'Demo Client', '2025-09-22', 20, 8),
('DEMO001', 'Demo Client', '2025-09-29', 22, 9),
('DEMO001', 'Demo Client', '2025-10-06', 20, 8),
('DEMO001', 'Demo Client', '2025-10-13', 20, 8),
('DEMO001', 'Demo Client', '2025-10-20', 20, 8),
('DEMO001', 'Demo Client', '2025-10-27', 22, 8),
('DEMO001', 'Demo Client', '2025-11-03', 20, 8),
('DEMO001', 'Demo Client', '2025-11-10', 20, 8),
('DEMO001', 'Demo Client', '2025-11-17', 20, 7),
('DEMO001', 'Demo Client', '2025-11-24', 22, 9),
('DEMO001', 'Demo Client', '2025-12-01', 20, 8),
('DEMO001', 'Demo Client', '2025-12-08', 20, 8),
('DEMO001', 'Demo Client', '2025-12-15', 22, 8),
('DEMO001', 'Demo Client', '2025-12-22', 20, 8),
('DEMO001', 'Demo Client', '2025-12-29', 20, 8),
('DEMO001', 'Demo Client', '2026-01-05', 20, 8),
('DEMO001', 'Demo Client', '2026-01-12', 20, 7),
('DEMO001', 'Demo Client', '2026-01-19', 10, 5),
('DEMO001', 'Demo Client', '2026-01-26', 20, 8),
('DEMO001', 'Demo Client', '2026-02-02', 20, 8),
('DEMO001', 'Demo Client', '2026-02-09', 20, 8),
('DEMO001', 'Demo Client', '2026-02-16', 20, 8),
('DEMO001', 'Demo Client', '2026-02-23', 22, 9),
('DEMO001', 'Demo Client', '2026-03-02', 20, 8),
('DEMO001', 'Demo Client', '2026-03-09', 20, 8),
('DEMO001', 'Demo Client', '2026-03-16', 20, 8),
('DEMO001', 'Demo Client', '2026-03-23', 20, 8),
('DEMO001', 'Demo Client', '2026-03-30', 22, 9),
('DEMO001', 'Demo Client', '2026-04-06', 20, 8),
('DEMO001', 'Demo Client', '2026-04-13', 20, 8),
('DEMO001', 'Demo Client', '2026-04-20', 20, 8),
('DEMO001', 'Demo Client', '2026-04-27', 20, 8);

-- DEMO002: Rack A / 中頻度（週5回）
INSERT INTO sample_picking_data (code, client_name, week_start, pick_qty, pick_count) VALUES
('DEMO002', 'Demo Client', '2026-03-09', 20, 5),
('DEMO002', 'Demo Client', '2026-03-16', 20, 5),
('DEMO002', 'Demo Client', '2026-03-23', 20, 5),
('DEMO002', 'Demo Client', '2026-03-30', 20, 5),
('DEMO002', 'Demo Client', '2026-04-06', 20, 5),
('DEMO002', 'Demo Client', '2026-04-13', 20, 5),
('DEMO002', 'Demo Client', '2026-04-20', 20, 5),
('DEMO002', 'Demo Client', '2026-04-27', 20, 5);

-- DEMO003: Rack B / 中頻度（週4回）
INSERT INTO sample_picking_data (code, client_name, week_start, pick_qty, pick_count) VALUES
('DEMO003', 'Demo Client', '2026-03-09', 15, 4),
('DEMO003', 'Demo Client', '2026-03-16', 15, 4),
('DEMO003', 'Demo Client', '2026-03-23', 15, 4),
('DEMO003', 'Demo Client', '2026-03-30', 15, 4),
('DEMO003', 'Demo Client', '2026-04-06', 15, 3),
('DEMO003', 'Demo Client', '2026-04-13', 15, 3),
('DEMO003', 'Demo Client', '2026-04-20', 15, 3),
('DEMO003', 'Demo Client', '2026-04-27', 15, 3);

-- DEMO004: Rack C / 低頻度（週2回）
INSERT INTO sample_picking_data (code, client_name, week_start, pick_qty, pick_count) VALUES
('DEMO004', 'Demo Client', '2026-03-09', 10, 2),
('DEMO004', 'Demo Client', '2026-03-16', 10, 2),
('DEMO004', 'Demo Client', '2026-03-23', 10, 2),
('DEMO004', 'Demo Client', '2026-03-30', 10, 2),
('DEMO004', 'Demo Client', '2026-04-06', 10, 1),
('DEMO004', 'Demo Client', '2026-04-13', 10, 1),
('DEMO004', 'Demo Client', '2026-04-20', 10, 1),
('DEMO004', 'Demo Client', '2026-04-27', 10, 1);

-- DEMO005: Rack D / 低頻度（週1回）
INSERT INTO sample_picking_data (code, client_name, week_start, pick_qty, pick_count) VALUES
('DEMO005', 'Demo Client', '2026-03-09',  5, 1),
('DEMO005', 'Demo Client', '2026-03-16',  5, 1),
('DEMO005', 'Demo Client', '2026-03-23',  5, 1),
('DEMO005', 'Demo Client', '2026-03-30',  5, 1),
('DEMO005', 'Demo Client', '2026-04-06',  5, 1),
('DEMO005', 'Demo Client', '2026-04-13',  5, 1),
('DEMO005', 'Demo Client', '2026-04-20',  5, 1),
('DEMO005', 'Demo Client', '2026-04-27',  5, 1);

-- DEMO006: Rack F / 高頻度・Frozen（週9回）
INSERT INTO sample_picking_data (code, client_name, week_start, pick_qty, pick_count) VALUES
('DEMO006', 'Demo Client', '2026-03-09', 35, 9),
('DEMO006', 'Demo Client', '2026-03-16', 35, 9),
('DEMO006', 'Demo Client', '2026-03-23', 35, 9),
('DEMO006', 'Demo Client', '2026-03-30', 35, 9),
('DEMO006', 'Demo Client', '2026-04-06', 35, 9),
('DEMO006', 'Demo Client', '2026-04-13', 35, 9),
('DEMO006', 'Demo Client', '2026-04-20', 35, 9),
('DEMO006', 'Demo Client', '2026-04-27', 35, 9);

-- ============================================================
-- 削除用SQL（不要になったらこれだけ実行）
-- DROP TABLE IF EXISTS sample_picking_data;
-- DROP TABLE IF EXISTS sample_shipment_orders;
-- DROP TABLE IF EXISTS sample_sku_category_map;
-- DROP TABLE IF EXISTS sample_order_categories;
-- DROP TABLE IF EXISTS sample_weekly_sales;
-- DROP TABLE IF EXISTS sample_sku_master;
-- ============================================================
