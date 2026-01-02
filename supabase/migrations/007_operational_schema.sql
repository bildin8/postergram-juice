-- Postergram Operational Schema Consolidation
-- Migration 007: Single-source-of-truth operational model
-- This creates the consolidated 16-table schema for operational tracking


-- ============================================================================
-- DROP ALL VIEWS FIRST (they reference old tables)
-- ============================================================================

DROP VIEW IF EXISTS v_current_stock CASCADE;
DROP VIEW IF EXISTS v_product_profitability CASCADE;
DROP VIEW IF EXISTS v_daily_consumption CASCADE;


-- ============================================================================
-- 1. INGREDIENTS (Master list - single source of truth)
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poster_ingredient_id TEXT UNIQUE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'g',  -- g, ml, pcs - NO AMBIGUITY
    category TEXT DEFAULT 'general',
    min_stock_level DECIMAL(12, 4) DEFAULT 0,
    avg_cost DECIMAL(12, 4) DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_ingredients_poster ON op_ingredients(poster_ingredient_id);


-- ============================================================================
-- 2. RECIPES (Synced from PosterPOS products)
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poster_product_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    selling_price DECIMAL(12, 2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_recipes_poster ON op_recipes(poster_product_id);


-- ============================================================================
-- 3. RECIPE_INGREDIENTS (Bill of Materials)
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES op_recipes(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES op_ingredients(id) ON DELETE CASCADE,
    quantity DECIMAL(12, 6) NOT NULL,  -- Per 1 unit of recipe output
    unit TEXT NOT NULL DEFAULT 'g',
    is_modifier BOOLEAN DEFAULT false,
    modifier_group TEXT,
    poster_modification_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(recipe_id, ingredient_id, poster_modification_id)
);

CREATE INDEX IF NOT EXISTS idx_op_recipe_ingredients_recipe ON op_recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_op_recipe_ingredients_ingredient ON op_recipe_ingredients(ingredient_id);


-- ============================================================================
-- 4. STORE_PURCHASES (Buying from suppliers)
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_store_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_name TEXT,
    invoice_number TEXT,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount DECIMAL(12, 2),
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('pending', 'received', 'cancelled')),
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_store_purchases_date ON op_store_purchases(purchase_date);


-- ============================================================================
-- 5. STORE_PURCHASE_ITEMS (Line items on purchases)
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_store_purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES op_store_purchases(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES op_ingredients(id),
    ingredient_name TEXT NOT NULL,  -- Denormalized for history
    quantity DECIMAL(12, 4) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'g',
    cost_per_unit DECIMAL(12, 4),
    total_cost DECIMAL(12, 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_store_purchase_items_purchase ON op_store_purchase_items(purchase_id);


-- ============================================================================
-- 6. STORE_DISPATCHES (Sending to shop)
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_store_dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'received', 'confirmed')),
    sent_by TEXT NOT NULL,
    received_by TEXT,
    received_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_store_dispatches_date ON op_store_dispatches(dispatch_date);
CREATE INDEX IF NOT EXISTS idx_op_store_dispatches_status ON op_store_dispatches(status);


-- ============================================================================
-- 7. STORE_DISPATCH_ITEMS (Items in dispatch)
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_store_dispatch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id UUID NOT NULL REFERENCES op_store_dispatches(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES op_ingredients(id),
    ingredient_name TEXT NOT NULL,  -- Denormalized
    quantity_sent DECIMAL(12, 4) NOT NULL,
    quantity_received DECIMAL(12, 4),
    unit TEXT NOT NULL DEFAULT 'g',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_store_dispatch_items_dispatch ON op_store_dispatch_items(dispatch_id);


-- ============================================================================
-- 8. SHOP_RECEIPTS (Shop receiving from store)
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_shop_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id UUID REFERENCES op_store_dispatches(id),
    received_by TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('pending', 'received', 'discrepancy')),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_op_shop_receipts_dispatch ON op_shop_receipts(dispatch_id);


-- ============================================================================
-- 9. SHOP_EXPENSES (Local buys, petty cash)
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_shop_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID,  -- FK added after shifts table
    expense_type TEXT NOT NULL CHECK (expense_type IN ('petty_cash', 'local_buy', 'other')),
    category TEXT,
    description TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    paid_by TEXT NOT NULL,
    paid_to TEXT,
    receipt_photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_shop_expenses_shift ON op_shop_expenses(shift_id);


-- ============================================================================
-- 10. SYNCED_TRANSACTIONS (Raw from PosterPOS - READ ONLY)
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_synced_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poster_transaction_id TEXT UNIQUE NOT NULL,
    transaction_date TIMESTAMPTZ NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    pay_type TEXT,  -- cash, card, mixed
    payed_cash DECIMAL(12, 2) DEFAULT 0,
    payed_card DECIMAL(12, 2) DEFAULT 0,
    products JSONB NOT NULL,  -- Raw product array from POS
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_synced_transactions_poster ON op_synced_transactions(poster_transaction_id);
CREATE INDEX IF NOT EXISTS idx_op_synced_transactions_date ON op_synced_transactions(transaction_date);


-- ============================================================================
-- 11. CALCULATED_CONSUMPTION (Derived from transactions × recipes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_calculated_consumption (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES op_synced_transactions(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES op_ingredients(id),
    ingredient_name TEXT NOT NULL,  -- Denormalized
    recipe_id UUID REFERENCES op_recipes(id),
    recipe_name TEXT,  -- Denormalized
    quantity_consumed DECIMAL(12, 6) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'g',
    is_modifier BOOLEAN DEFAULT false,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_consumption_transaction ON op_calculated_consumption(transaction_id);
CREATE INDEX IF NOT EXISTS idx_op_consumption_ingredient ON op_calculated_consumption(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_op_consumption_date ON op_calculated_consumption(calculated_at);


-- ============================================================================
-- 12. STOCK_COUNTS (Physical count sessions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_stock_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location TEXT NOT NULL CHECK (location IN ('store', 'shop')),
    count_type TEXT NOT NULL CHECK (count_type IN ('opening', 'closing', 'ad_hoc')),
    shift_id UUID,  -- FK added after shifts table
    counted_by TEXT NOT NULL,
    counted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    completed_at TIMESTAMPTZ,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_op_stock_counts_date ON op_stock_counts(counted_at);
CREATE INDEX IF NOT EXISTS idx_op_stock_counts_location ON op_stock_counts(location);


-- ============================================================================
-- 13. STOCK_COUNT_ITEMS (Per-ingredient counts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_stock_count_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_count_id UUID NOT NULL REFERENCES op_stock_counts(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES op_ingredients(id),
    ingredient_name TEXT NOT NULL,  -- Denormalized
    counted_quantity DECIMAL(12, 4) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'g',
    notes TEXT,
    counted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_stock_count_items_count ON op_stock_count_items(stock_count_id);


-- ============================================================================
-- 14. DAILY_RECONCILIATION (Reconciliation header by date)
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_daily_reconciliation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    location TEXT NOT NULL CHECK (location IN ('store', 'shop')),
    opening_stock_count_id UUID REFERENCES op_stock_counts(id),
    closing_stock_count_id UUID REFERENCES op_stock_counts(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'acknowledged')),
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(date, location)
);

CREATE INDEX IF NOT EXISTS idx_op_daily_reconciliation_date ON op_daily_reconciliation(date);


-- ============================================================================
-- 15. RECONCILIATION_ITEMS (Variance per ingredient - THE KEY TABLE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_reconciliation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_id UUID NOT NULL REFERENCES op_daily_reconciliation(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES op_ingredients(id),
    ingredient_name TEXT NOT NULL,  -- Denormalized
    
    -- The variance formula components
    opening_qty DECIMAL(12, 4) NOT NULL DEFAULT 0,
    received_qty DECIMAL(12, 4) NOT NULL DEFAULT 0,
    theoretical_usage DECIMAL(12, 4) NOT NULL DEFAULT 0,
    expected_closing DECIMAL(12, 4) NOT NULL DEFAULT 0,  -- opening + received - theoretical
    actual_closing DECIMAL(12, 4) NOT NULL DEFAULT 0,
    
    -- THE VARIANCE (actual - expected)
    variance DECIMAL(12, 4) NOT NULL DEFAULT 0,
    variance_value DECIMAL(12, 2),  -- variance × avg_cost
    variance_status TEXT NOT NULL DEFAULT 'pending' CHECK (variance_status IN ('matched', 'over', 'under', 'pending')),
    
    unit TEXT NOT NULL DEFAULT 'g',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(reconciliation_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_op_reconciliation_items_recon ON op_reconciliation_items(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_op_reconciliation_items_status ON op_reconciliation_items(variance_status);


-- ============================================================================
-- 16. SHIFTS (Cash + stock session tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    
    -- Opening
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    opened_by TEXT NOT NULL,
    opening_float DECIMAL(12, 2) NOT NULL,
    opening_stock_count_id UUID REFERENCES op_stock_counts(id),
    
    -- Closing
    closed_at TIMESTAMPTZ,
    closed_by TEXT,
    closing_cash DECIMAL(12, 2),
    closing_stock_count_id UUID REFERENCES op_stock_counts(id),
    
    -- Cash reconciliation
    pos_cash_total DECIMAL(12, 2),  -- From synced transactions
    pos_card_total DECIMAL(12, 2),
    expenses_total DECIMAL(12, 2),
    expected_cash DECIMAL(12, 2),  -- float + pos_cash - expenses
    cash_variance DECIMAL(12, 2),  -- closing_cash - expected_cash
    
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_shifts_status ON op_shifts(status);
CREATE INDEX IF NOT EXISTS idx_op_shifts_date ON op_shifts(opened_at);


-- ============================================================================
-- ADD FOREIGN KEYS (after all tables created)
-- ============================================================================

ALTER TABLE op_shop_expenses 
    ADD CONSTRAINT fk_shop_expenses_shift 
    FOREIGN KEY (shift_id) REFERENCES op_shifts(id);

ALTER TABLE op_stock_counts 
    ADD CONSTRAINT fk_stock_counts_shift 
    FOREIGN KEY (shift_id) REFERENCES op_shifts(id);


-- ============================================================================
-- SYNC STATUS TABLE (Tracking last sync timestamps)
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_type TEXT NOT NULL UNIQUE,  -- 'transactions', 'recipes'
    last_sync_at TIMESTAMPTZ,
    last_sync_timestamp BIGINT,  -- PosterPOS timestamp for incremental sync
    records_synced INTEGER DEFAULT 0,
    status TEXT DEFAULT 'idle',
    error_message TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Initialize sync status records
INSERT INTO op_sync_status (sync_type) VALUES ('transactions'), ('recipes')
ON CONFLICT (sync_type) DO NOTHING;


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE op_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_store_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_store_purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_store_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_store_dispatch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_shop_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_shop_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_synced_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_calculated_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_stock_count_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_daily_reconciliation ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_reconciliation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_sync_status ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "service_all" ON op_ingredients FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON op_recipes FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON op_recipe_ingredients FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON op_store_purchases FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON op_store_purchase_items FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON op_store_dispatches FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON op_store_dispatch_items FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON op_shop_receipts FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON op_shop_expenses FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON op_synced_transactions FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON op_calculated_consumption FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON op_stock_counts FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON op_stock_count_items FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON op_daily_reconciliation FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON op_reconciliation_items FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON op_shifts FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON op_sync_status FOR ALL TO service_role USING (true);

-- Authenticated read access
CREATE POLICY "auth_read" ON op_ingredients FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON op_recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON op_recipe_ingredients FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON op_store_purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON op_store_purchase_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON op_store_dispatches FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON op_store_dispatch_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON op_shop_receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON op_shop_expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON op_synced_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON op_calculated_consumption FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON op_stock_counts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON op_stock_count_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON op_daily_reconciliation FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON op_reconciliation_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON op_shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON op_sync_status FOR SELECT TO authenticated USING (true);


-- ============================================================================
-- VIEWS FOR QUICK ACCESS
-- ============================================================================

-- Current stock by location (sum from purchases/dispatches/consumption)
CREATE OR REPLACE VIEW v_op_ingredient_stock AS
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
  i.name,
  i.unit,
  i.category,
  COALESCE(p.purchased_qty, 0) as total_purchased,
  COALESCE(d.dispatched_qty, 0) as total_dispatched,
  COALESCE(c.consumed_qty, 0) as total_consumed,
  -- Store stock = purchased - dispatched
  COALESCE(p.purchased_qty, 0) - COALESCE(d.dispatched_qty, 0) as store_stock,
  -- Shop stock = dispatched - consumed (simplified)
  COALESCE(d.dispatched_qty, 0) - COALESCE(c.consumed_qty, 0) as shop_stock
FROM op_ingredients i
LEFT JOIN purchases p ON p.ingredient_id = i.id
LEFT JOIN dispatched d ON d.ingredient_id = i.id
LEFT JOIN consumed c ON c.ingredient_id = i.id
WHERE i.is_active = true;

-- Daily consumption summary
CREATE OR REPLACE VIEW v_op_daily_consumption AS
SELECT 
  DATE(t.transaction_date) as sale_date,
  c.ingredient_id,
  c.ingredient_name,
  SUM(c.quantity_consumed) as total_consumed,
  c.unit,
  COUNT(DISTINCT c.transaction_id) as transaction_count
FROM op_calculated_consumption c
JOIN op_synced_transactions t ON c.transaction_id = t.id
GROUP BY DATE(t.transaction_date), c.ingredient_id, c.ingredient_name, c.unit;


GRANT SELECT ON v_op_ingredient_stock TO authenticated;
GRANT SELECT ON v_op_daily_consumption TO authenticated;
