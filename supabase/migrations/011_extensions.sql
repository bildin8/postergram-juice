-- 011_extensions.sql
-- Extensions to complete PosterGram functionality
-- 1. Recipe Versioning
-- 2. Processing Tracking
-- 3. M-Pesa Reversals
-- 4. Partner Security
-- 5. Unified Stock View (Fixing the Split Brain)

-- 1. RECIPE VERSIONING
CREATE TABLE IF NOT EXISTS op_recipe_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID REFERENCES op_recipes(id),
    version_hash TEXT NOT NULL, -- content hash to detect changes
    ingredients_snapshot JSONB NOT NULL, -- Full snapshot of ingredients at this time
    active_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    active_to TIMESTAMP WITH TIME ZONE, -- NULL means current
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_versions_recipe ON op_recipe_versions(recipe_id);

-- Add version column to consumption
ALTER TABLE op_calculated_consumption 
ADD COLUMN IF NOT EXISTS recipe_version_id UUID REFERENCES op_recipe_versions(id);

-- 2. STORE PROCESSED ITEMS (Missing table)
CREATE TABLE IF NOT EXISTS op_store_processed_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_item_id UUID REFERENCES op_store_purchase_items(id), -- Optional link
    item_name TEXT NOT NULL,
    quantity_produced NUMERIC NOT NULL,
    unit TEXT NOT NULL DEFAULT 'units',
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_by TEXT,
    batch_code TEXT,
    notes TEXT,
    status TEXT DEFAULT 'ready' CHECK (status IN ('ready', 'dispatched', 'quarantine'))
);

-- 3. M-PESA REVERSALS
CREATE TABLE IF NOT EXISTS mpesa_reversals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_transaction_id UUID REFERENCES op_synced_transactions(id),
    mpesa_receipt_number TEXT NOT NULL,
    reversal_amount NUMERIC NOT NULL,
    reversal_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    raw_response JSONB
);

-- 4. PARTNER SECURITY
CREATE TABLE IF NOT EXISTS partner_telegram_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_chat_id TEXT NOT NULL UNIQUE,
    partner_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. UNIFIED STOCK VIEW (Fixing the Split Brain)
-- We must DROP CASCADE to remove dependencies, then recreate them.
DROP VIEW IF EXISTS v_op_ingredient_stock CASCADE;

-- Recreate v_op_ingredient_stock backed by operational tables (Source of Truth)
-- Must match old interface: id, shop_stock, store_stock
CREATE VIEW v_op_ingredient_stock AS
WITH 
  purchases AS (
    SELECT 
      pi.ingredient_id,
      SUM(pi.quantity) as purchased_qty
    FROM op_store_purchase_items pi
    JOIN op_store_purchases p ON pi.purchase_id = p.id
    WHERE p.status = 'received'
    GROUP BY pi.ingredient_id
  ),
  dispatched AS (
    SELECT 
      di.ingredient_id,
      SUM(di.quantity_sent) as dispatched_qty
    FROM op_store_dispatch_items di
    JOIN op_store_dispatches d ON di.dispatch_id = d.id
    WHERE d.status IN ('sent', 'received', 'confirmed')
    GROUP BY di.ingredient_id
  ),
  consumed AS (
    SELECT 
      ingredient_id,
      SUM(quantity_consumed) as consumed_qty
    FROM op_calculated_consumption
    GROUP BY ingredient_id
  )
SELECT 
  i.id,
  -- Shop stock = dispatched - consumed
  COALESCE(d.dispatched_qty, 0) - COALESCE(c.consumed_qty, 0) as shop_stock,
  -- Store stock = purchased - dispatched
  COALESCE(p.purchased_qty, 0) - COALESCE(d.dispatched_qty, 0) as store_stock,
  -- Total stock
  COALESCE(p.purchased_qty, 0) - COALESCE(c.consumed_qty, 0) as total_stock
FROM op_ingredients i
LEFT JOIN purchases p ON p.ingredient_id = i.id
LEFT JOIN dispatched d ON d.ingredient_id = i.id
LEFT JOIN consumed c ON c.ingredient_id = i.id
WHERE i.is_active = true;

GRANT SELECT ON v_op_ingredient_stock TO authenticated;
GRANT SELECT ON v_op_ingredient_stock TO service_role;

-- RECREATE DEPENDENT VIEW 1: v_op_below_par (from 010_partner_controls.sql)
CREATE OR REPLACE VIEW v_op_below_par AS
SELECT 
    i.id,
    i.poster_ingredient_id,
    i.name,
    i.unit,
    COALESCE(s.shop_stock, 0) as shop_stock,
    COALESCE(s.store_stock, 0) as store_stock,
    i.par_level,
    i.safety_stock,
    i.lead_time_days,
    i.avg_daily_usage,
    CASE 
        WHEN COALESCE(s.shop_stock, 0) <= i.safety_stock THEN 'critical'
        WHEN COALESCE(s.shop_stock, 0) <= i.par_level THEN 'low'
        ELSE 'ok'
    END as stock_status,
    CASE 
        WHEN i.avg_daily_usage > 0 THEN ROUND((COALESCE(s.shop_stock, 0) / i.avg_daily_usage)::numeric, 1)
        ELSE NULL
    END as days_until_stockout,
    i.par_level - COALESCE(s.shop_stock, 0) as qty_to_order
FROM op_ingredients i
LEFT JOIN v_op_ingredient_stock s ON s.id = i.id
WHERE i.par_level > 0 AND COALESCE(s.shop_stock, 0) < i.par_level
ORDER BY 
    CASE WHEN COALESCE(s.shop_stock, 0) <= i.safety_stock THEN 0 ELSE 1 END,
    COALESCE(s.shop_stock, 0) / NULLIF(i.par_level, 0);

GRANT SELECT ON v_op_below_par TO authenticated;

-- RECREATE DEPENDENT VIEW 2: v_op_pending_reorders (from 008_reorder_requests.sql)
CREATE OR REPLACE VIEW v_op_pending_reorders AS
SELECT 
    r.*,
    i.category as ingredient_category,
    s.shop_stock as current_shop_stock,
    s.store_stock as available_store_stock
FROM op_reorder_requests r
LEFT JOIN op_ingredients i ON r.ingredient_id = i.id
LEFT JOIN v_op_ingredient_stock s ON r.ingredient_id = s.id
WHERE r.status = 'pending'
ORDER BY 
    CASE r.priority 
        WHEN 'urgent' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'normal' THEN 3 
        ELSE 4 
    END,
    r.requested_at ASC;

GRANT SELECT ON v_op_pending_reorders TO authenticated;
