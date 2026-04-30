-- ============================================================
-- NOS Meeting Sample Data
-- 実行方法: Supabase > SQL Editor に全文コピーして Run
-- 削除方法: 末尾の「削除用SQL」を実行するだけで全消去
-- ============================================================

-- 既存サンプルデータをクリア（再実行時の重複防止）
DELETE FROM weekly_sales WHERE code LIKE 'DEMO%';
DELETE FROM sku_master    WHERE code LIKE 'DEMO%';

-- ============================================================
-- SKU Master（7品目）
-- ============================================================
INSERT INTO sku_master (code, name, uom, price, tc, weight, storage_type, manufacture, location, is_ff, updated_at) VALUES
-- Sec 1: New Arrival
('DEMO001', 'Demo Fresh Pasta 500g',     'pkt', 0, 3.50,  0.5,  'Dry',    'Demo Foods', 'A1-01', false, now()),
-- Sec 2: No Sale 1m / Expiry < 3m
('DEMO002', 'Demo Soy Sauce 1L',         'btl', 0, 8.00,  1.0,  'Dry',    'Demo Foods', 'A2-03', false, now()),
-- Sec 3: Have Sale 1m / Slow to Clear
('DEMO003', 'Demo Seafood Sauce 500ml',  'btl', 0, 12.00, 0.6,  'Dry',    'Demo Foods', 'B1-02', false, now()),
-- Sec 4: No Sale 1m / Expiry > 3m / over $500
('DEMO004', 'Demo Rice 25kg',            'bag', 0, 45.00, 25.0, 'Dry',    'Demo Foods', 'C3-01', false, now()),
-- Sec 5: No Sale 1m / No Expiry Date
('DEMO005', 'Demo Kitchen Towel 12pk',   'pkt', 0, 15.00, 2.0,  'Dry',    'Demo Foods', 'D1-04', false, now()),
-- Sec 6: FF Item (is_ff = true)
('DEMO006', 'Demo Frozen Shrimp 1kg',    'kg',  0, 25.00, 1.0,  'Frozen', 'Demo Foods', 'F1-01', true,  now()),
-- Sec 7: Expired Item
('DEMO007', 'Demo Expired Vinegar 750ml','btl', 0, 6.00,  0.8,  'Dry',    'Demo Foods', 'A3-02', false, now());

-- ============================================================
-- Weekly Sales（週次在庫・販売データ）
-- 週: 2026-03-09 〜 2026-04-27（8週分）
-- ============================================================

-- DEMO001: Section 1 - New Arrival
-- 最新週だけにデータあり → 新着判定
INSERT INTO weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO001', '2027-03-01', 'A1-01', '2026-04-27', 48, 0);

-- DEMO002: Section 2 - No Sale 1m / Expiry < 3m (期限: 2026-07-15, 約2.5ヶ月後)
-- 直近4週の販売=0, 在庫あり
INSERT INTO weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO002', '2026-07-15', 'A2-03', '2026-03-09', 120, 15),
('DEMO002', '2026-07-15', 'A2-03', '2026-03-16', 105, 15),
('DEMO002', '2026-07-15', 'A2-03', '2026-03-23',  90, 12),
('DEMO002', '2026-07-15', 'A2-03', '2026-03-30',  80, 10),
('DEMO002', '2026-07-15', 'A2-03', '2026-04-06',  80,  0),
('DEMO002', '2026-07-15', 'A2-03', '2026-04-13',  80,  0),
('DEMO002', '2026-07-15', 'A2-03', '2026-04-20',  80,  0),
('DEMO002', '2026-07-15', 'A2-03', '2026-04-27',  80,  0);

-- DEMO003: Section 3 - Have Sale 1m / Slow to Clear
-- 期限: 2026-06-30（約8.7週後）, 在庫93個, 週平均4販売 → 消化まで23週 > 8.7週
INSERT INTO weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO003', '2026-06-30', 'B1-02', '2026-03-09', 120, 5),
('DEMO003', '2026-06-30', 'B1-02', '2026-03-16', 115, 5),
('DEMO003', '2026-06-30', 'B1-02', '2026-03-23', 110, 5),
('DEMO003', '2026-06-30', 'B1-02', '2026-03-30', 105, 5),
('DEMO003', '2026-06-30', 'B1-02', '2026-04-06', 102, 3),
('DEMO003', '2026-06-30', 'B1-02', '2026-04-13',  99, 3),
('DEMO003', '2026-06-30', 'B1-02', '2026-04-20',  96, 3),
('DEMO003', '2026-06-30', 'B1-02', '2026-04-27',  93, 3);

-- DEMO004: Section 4 - No Sale 1m / Expiry > 3m / over $500
-- 期限: 2027-06-01（>3ヶ月）, 在庫15個 × $45 = $675 > $500, 直近4週販売=0
INSERT INTO weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO004', '2027-06-01', 'C3-01', '2026-03-09', 20, 5),
('DEMO004', '2027-06-01', 'C3-01', '2026-03-16', 18, 2),
('DEMO004', '2027-06-01', 'C3-01', '2026-03-23', 16, 2),
('DEMO004', '2027-06-01', 'C3-01', '2026-03-30', 15, 1),
('DEMO004', '2027-06-01', 'C3-01', '2026-04-06', 15, 0),
('DEMO004', '2027-06-01', 'C3-01', '2026-04-13', 15, 0),
('DEMO004', '2027-06-01', 'C3-01', '2026-04-20', 15, 0),
('DEMO004', '2027-06-01', 'C3-01', '2026-04-27', 15, 0);

-- DEMO005: Section 5 - No Sale 1m / No Expiry Date
-- expiry_date = null, 在庫あり, 直近4週販売=0
INSERT INTO weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO005', null, 'D1-04', '2026-03-09', 30, 3),
('DEMO005', null, 'D1-04', '2026-03-16', 27, 3),
('DEMO005', null, 'D1-04', '2026-03-23', 24, 3),
('DEMO005', null, 'D1-04', '2026-03-30', 22, 2),
('DEMO005', null, 'D1-04', '2026-04-06', 22, 0),
('DEMO005', null, 'D1-04', '2026-04-13', 22, 0),
('DEMO005', null, 'D1-04', '2026-04-20', 22, 0),
('DEMO005', null, 'D1-04', '2026-04-27', 22, 0);

-- DEMO006: Section 6 - FF Item (sku_master.is_ff = true)
INSERT INTO weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO006', '2026-08-01', 'F1-01', '2026-03-09', 50, 8),
('DEMO006', '2026-08-01', 'F1-01', '2026-03-16', 44, 6),
('DEMO006', '2026-08-01', 'F1-01', '2026-03-23', 40, 4),
('DEMO006', '2026-08-01', 'F1-01', '2026-03-30', 38, 2),
('DEMO006', '2026-08-01', 'F1-01', '2026-04-06', 38, 0),
('DEMO006', '2026-08-01', 'F1-01', '2026-04-13', 38, 0),
('DEMO006', '2026-08-01', 'F1-01', '2026-04-20', 38, 0),
('DEMO006', '2026-08-01', 'F1-01', '2026-04-27', 38, 0);

-- DEMO007: Section 7 - Expired Item (期限: 2026-03-15, 既に期限切れ)
INSERT INTO weekly_sales (code, expiry_date, location, week_start, ending_qty, total_sales) VALUES
('DEMO007', '2026-03-15', 'A3-02', '2026-03-09', 25, 5),
('DEMO007', '2026-03-15', 'A3-02', '2026-03-16', 20, 0),
('DEMO007', '2026-03-15', 'A3-02', '2026-03-23', 20, 0),
('DEMO007', '2026-03-15', 'A3-02', '2026-03-30', 20, 0),
('DEMO007', '2026-03-15', 'A3-02', '2026-04-06', 20, 0),
('DEMO007', '2026-03-15', 'A3-02', '2026-04-13', 20, 0),
('DEMO007', '2026-03-15', 'A3-02', '2026-04-20', 20, 0),
('DEMO007', '2026-03-15', 'A3-02', '2026-04-27', 20, 0);

-- ============================================================
-- サンプルデータ削除用SQL（不要になったらこれだけ実行）
-- DELETE FROM weekly_sales WHERE code LIKE 'DEMO%';
-- DELETE FROM sku_master    WHERE code LIKE 'DEMO%';
-- ============================================================
