-- ============================================================
-- Weekly AI Digest — Supabase Setup
-- Run this once in the Supabase SQL Editor
-- ============================================================

-- 1. Cache table for generated digests
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_digest_cache (
    week_label   TEXT PRIMARY KEY,
    digest_text  TEXT        NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE weekly_digest_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wd_cache_read"   ON weekly_digest_cache;
DROP POLICY IF EXISTS "wd_cache_write"  ON weekly_digest_cache;
DROP POLICY IF EXISTS "wd_cache_delete" ON weekly_digest_cache;

CREATE POLICY "wd_cache_read"   ON weekly_digest_cache FOR SELECT USING (true);
CREATE POLICY "wd_cache_write"  ON weekly_digest_cache FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "wd_cache_delete" ON weekly_digest_cache FOR DELETE USING (true);


-- 2. Aggregate function: weekly revenue totals
--    week_start is DATE type → compare directly with CURRENT_DATE - int
-- ============================================================
CREATE OR REPLACE FUNCTION wd_weekly_performance(weeks_back int DEFAULT 8)
RETURNS TABLE(week_start text, total_amount numeric)
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT
        week_start::text,
        SUM(amount)::numeric AS total_amount
    FROM client_sku_orders
    WHERE week_start >= CURRENT_DATE - (weeks_back * 7)
    GROUP BY week_start
    ORDER BY week_start;
$$;


-- 3. Aggregate function: per-client ordering patterns
-- ============================================================
CREATE OR REPLACE FUNCTION wd_client_patterns(lookback_weeks int DEFAULT 12)
RETURNS TABLE(
    customer_code   text,
    customer_name   text,
    ordered_weeks   bigint,
    last_order_week text,
    total_amount    numeric
)
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT
        customer_code,
        MAX(customer_name)                  AS customer_name,
        COUNT(DISTINCT week_start)          AS ordered_weeks,
        MAX(week_start)::text               AS last_order_week,
        SUM(amount)::numeric                AS total_amount
    FROM client_sku_orders
    WHERE week_start >= CURRENT_DATE - (lookback_weeks * 7)
    GROUP BY customer_code;
$$;


-- 4. Aggregate function: SKU trends (client-count growth)
-- ============================================================
CREATE OR REPLACE FUNCTION wd_sku_trends(
    recent_weeks int DEFAULT 4,
    prior_weeks  int DEFAULT 4
)
RETURNS TABLE(
    sku_code       text,
    recent_clients bigint,
    recent_amount  numeric,
    prior_clients  bigint,
    prior_amount   numeric
)
LANGUAGE sql SECURITY DEFINER
AS $$
    WITH
    recent AS (
        SELECT
            sku_code,
            COUNT(DISTINCT customer_code) AS clients,
            SUM(amount)::numeric          AS amount
        FROM client_sku_orders
        WHERE week_start >= CURRENT_DATE - (recent_weeks * 7)
        GROUP BY sku_code
    ),
    prior AS (
        SELECT
            sku_code,
            COUNT(DISTINCT customer_code) AS clients,
            SUM(amount)::numeric          AS amount
        FROM client_sku_orders
        WHERE week_start >= CURRENT_DATE - ((recent_weeks + prior_weeks) * 7)
          AND week_start <  CURRENT_DATE - (recent_weeks * 7)
        GROUP BY sku_code
    )
    SELECT
        COALESCE(r.sku_code, p.sku_code)  AS sku_code,
        COALESCE(r.clients, 0)            AS recent_clients,
        COALESCE(r.amount,  0)            AS recent_amount,
        COALESCE(p.clients, 0)            AS prior_clients,
        COALESCE(p.amount,  0)            AS prior_amount
    FROM recent r
    FULL OUTER JOIN prior p ON r.sku_code = p.sku_code
    WHERE COALESCE(r.clients, 0) > COALESCE(p.clients, 0)
    ORDER BY (COALESCE(r.clients, 0) - COALESCE(p.clients, 0)) DESC
    LIMIT 20;
$$;
