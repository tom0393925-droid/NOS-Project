-- ============================================================
-- NOS Dashboard Sample Data（全タブ対応）
-- 実行方法: Supabase > SQL Editor に全文コピーして Run
-- 削除方法: 末尾の「削除用SQL」を実行
-- ============================================================

-- テーブルをすべて削除して再作成（再実行時も安全）
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
-- sample_order_categories（order_categories と同じスキーマ）
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
-- sample_sku_category_map（sku_category_map と同じスキーマ）
-- ============================================================
CREATE TABLE sample_sku_category_map (
    sku_code    text,
    category_id text,
    PRIMARY KEY (sku_code, category_id)
);
ALTER TABLE sample_sku_category_map DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- sample_shipment_orders（shipment_orders と同じスキーマ）
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
-- SKUマスター（7品目）
-- ============================================================
INSERT INTO sample_sku_master (code, name, uom, price, tc, weight, storage_type, manufacture, location, is_ff) VALUES
('DEMO001', 'Demo Fresh Pasta 500g',      'pkt', 0,  3.50,  0.5,  'Dry',    'Demo Foods', 'A1-01', false),
('DEMO002', 'Demo Soy Sauce 1L',          'btl', 0,  8.00,  1.0,  'Dry',    'Demo Foods', 'A2-03', false),
('DEMO003', 'Demo Seafood Sauce 500ml',   'btl', 0, 12.00,  0.6,  'Dry',    'Demo Foods', 'B1-02', false),
('DEMO004', 'Demo Rice 25kg',             'bag', 0, 45.00, 25.0,  'Dry',    'Demo Foods', 'C3-01', false),
('DEMO005', 'Demo Kitchen Towel 12pk',    'pkt', 0, 15.00,  2.0,  'Dry',    'Demo Foods', 'D1-04', false),
('DEMO006', 'Demo Frozen Shrimp 1kg',     'kg',  0, 25.00,  1.0,  'Frozen', 'Demo Foods', 'F1-01', true),
('DEMO007', 'Demo Expired Vinegar 750ml', 'btl', 0,  6.00,  0.8,  'Dry',    'Demo Foods', 'A3-02', false);

-- ============================================================
-- 週次在庫データ（8週分: 2026-03-09 〜 2026-04-27）
-- ============================================================

-- DEMO001: Section 1 - New Arrival
INSERT INTO sample_weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO001', '2027-03-01', 'A1-01', '2026-04-27', 48, 0);

-- DEMO002: Section 2 - No Sale 1m / Expiry < 3m
INSERT INTO sample_weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO002', '2026-07-15', 'A2-03', '2026-03-09', 120, 15),
('DEMO002', '2026-07-15', 'A2-03', '2026-03-16', 105, 15),
('DEMO002', '2026-07-15', 'A2-03', '2026-03-23',  90, 12),
('DEMO002', '2026-07-15', 'A2-03', '2026-03-30',  80, 10),
('DEMO002', '2026-07-15', 'A2-03', '2026-04-06',  80,  0),
('DEMO002', '2026-07-15', 'A2-03', '2026-04-13',  80,  0),
('DEMO002', '2026-07-15', 'A2-03', '2026-04-20',  80,  0),
('DEMO002', '2026-07-15', 'A2-03', '2026-04-27',  80,  0);

-- DEMO003: Section 3 - Slow to Clear
INSERT INTO sample_weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO003', '2026-06-30', 'B1-02', '2026-03-09', 120, 5),
('DEMO003', '2026-06-30', 'B1-02', '2026-03-16', 115, 5),
('DEMO003', '2026-06-30', 'B1-02', '2026-03-23', 110, 5),
('DEMO003', '2026-06-30', 'B1-02', '2026-03-30', 105, 5),
('DEMO003', '2026-06-30', 'B1-02', '2026-04-06', 102, 3),
('DEMO003', '2026-06-30', 'B1-02', '2026-04-13',  99, 3),
('DEMO003', '2026-06-30', 'B1-02', '2026-04-20',  96, 3),
('DEMO003', '2026-06-30', 'B1-02', '2026-04-27',  93, 3);

-- DEMO004: Section 4 - No Sale 1m / Expiry > 3m / over $500
INSERT INTO sample_weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO004', '2027-06-01', 'C3-01', '2026-03-09', 20, 5),
('DEMO004', '2027-06-01', 'C3-01', '2026-03-16', 18, 2),
('DEMO004', '2027-06-01', 'C3-01', '2026-03-23', 16, 2),
('DEMO004', '2027-06-01', 'C3-01', '2026-03-30', 15, 1),
('DEMO004', '2027-06-01', 'C3-01', '2026-04-06', 15, 0),
('DEMO004', '2027-06-01', 'C3-01', '2026-04-13', 15, 0),
('DEMO004', '2027-06-01', 'C3-01', '2026-04-20', 15, 0),
('DEMO004', '2027-06-01', 'C3-01', '2026-04-27', 15, 0);

-- DEMO005: Section 5 - No Sale 1m / No Expiry Date
INSERT INTO sample_weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO005', null, 'D1-04', '2026-03-09', 30, 3),
('DEMO005', null, 'D1-04', '2026-03-16', 27, 3),
('DEMO005', null, 'D1-04', '2026-03-23', 24, 3),
('DEMO005', null, 'D1-04', '2026-03-30', 22, 2),
('DEMO005', null, 'D1-04', '2026-04-06', 22, 0),
('DEMO005', null, 'D1-04', '2026-04-13', 22, 0),
('DEMO005', null, 'D1-04', '2026-04-20', 22, 0),
('DEMO005', null, 'D1-04', '2026-04-27', 22, 0);

-- DEMO006: Section 6 - FF Item
INSERT INTO sample_weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO006', '2026-08-01', 'F1-01', '2026-03-09', 50, 8),
('DEMO006', '2026-08-01', 'F1-01', '2026-03-16', 44, 6),
('DEMO006', '2026-08-01', 'F1-01', '2026-03-23', 40, 4),
('DEMO006', '2026-08-01', 'F1-01', '2026-03-30', 38, 2),
('DEMO006', '2026-08-01', 'F1-01', '2026-04-06', 38, 0),
('DEMO006', '2026-08-01', 'F1-01', '2026-04-13', 38, 0),
('DEMO006', '2026-08-01', 'F1-01', '2026-04-20', 38, 0),
('DEMO006', '2026-08-01', 'F1-01', '2026-04-27', 38, 0);

-- DEMO007: Section 7 - Expired Item
INSERT INTO sample_weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO007', '2026-03-15', 'A3-02', '2026-03-09', 25, 5),
('DEMO007', '2026-03-15', 'A3-02', '2026-03-16', 20, 0),
('DEMO007', '2026-03-15', 'A3-02', '2026-03-23', 20, 0),
('DEMO007', '2026-03-15', 'A3-02', '2026-03-30', 20, 0),
('DEMO007', '2026-03-15', 'A3-02', '2026-04-06', 20, 0),
('DEMO007', '2026-03-15', 'A3-02', '2026-04-13', 20, 0),
('DEMO007', '2026-03-15', 'A3-02', '2026-04-20', 20, 0),
('DEMO007', '2026-03-15', 'A3-02', '2026-04-27', 20, 0);

-- ============================================================
-- オーダーカテゴリー（CFJP=Dry / RFJP=Frozen）
-- ※ IDをCFJP/RFJPにすることでデフォルトタブと一致
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
-- 入荷予定（Analyticsのオーダー提案に使用）
-- ============================================================
INSERT INTO sample_shipment_orders (code, arrival_date, order_qty, status) VALUES
('DEMO002', '2026-05-15', 200, 'pending'),
('DEMO004', '2026-05-15',  30, 'pending'),
('DEMO003', '2026-06-12', 150, 'pending');

-- ============================================================
-- 削除用SQL（不要になったらこれだけ実行）
-- DROP TABLE IF EXISTS sample_shipment_orders;
-- DROP TABLE IF EXISTS sample_sku_category_map;
-- DROP TABLE IF EXISTS sample_order_categories;
-- DROP TABLE IF EXISTS sample_weekly_sales;
-- DROP TABLE IF EXISTS sample_sku_master;
-- ============================================================
