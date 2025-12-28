-- PosterGram Multi-Portal Extensions
-- Run after 001_enhanced_schema.sql and 002_legacy_tables.sql

-- ============================================================================
-- MISSING CORE TABLES (from Drizzle schema, not in Supabase migrations)
-- ============================================================================

-- Shop Stock Sessions (Opening/Closing stock counts)
CREATE TABLE IF NOT EXISTS shop_stock_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_type TEXT NOT NULL, -- 'opening' or 'closing'
    status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed'
    staff_name TEXT NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    date TIMESTAMPTZ DEFAULT NOW(),
    total_items INTEGER DEFAULT 0,
    counted_items INTEGER DEFAULT 0
);

-- Shop Stock Entries
CREATE TABLE IF NOT EXISTS shop_stock_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES shop_stock_sessions(id),
    inventory_item_id UUID,
    item_name TEXT NOT NULL,
    poster_pos_id TEXT,
    quantity DECIMAL(10,2) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'units',
    notes TEXT,
    counted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shop Expenses
CREATE TABLE IF NOT EXISTS shop_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_type TEXT NOT NULL, -- 'supermarket' or 'petty_cash'
    category TEXT, -- For petty cash: 'staff', 'transport', 'directors', 'mall_bills', 'other'
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    paid_by TEXT NOT NULL,
    paid_to TEXT,
    receipt_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense Items
CREATE TABLE IF NOT EXISTS expense_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID REFERENCES shop_expenses(id) ON DELETE CASCADE,
    inventory_item_id UUID,
    item_name TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'units',
    cost_per_unit DECIMAL(10,2)
);

-- Goods Receipts
CREATE TABLE IF NOT EXISTS goods_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    despatch_log_id UUID,
    received_by TEXT NOT NULL,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    excel_file_path TEXT
);

-- Goods Receipt Items
CREATE TABLE IF NOT EXISTS goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID REFERENCES goods_receipts(id) ON DELETE CASCADE,
    inventory_item_id UUID,
    item_name TEXT NOT NULL,
    poster_pos_id TEXT,
    expected_quantity DECIMAL(10,2) NOT NULL,
    received_quantity DECIMAL(10,2),
    unit TEXT NOT NULL DEFAULT 'units',
    cost_per_unit DECIMAL(10,2),
    notes TEXT
);

-- Store Items
CREATE TABLE IF NOT EXISTS store_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    unit TEXT NOT NULL DEFAULT 'pcs',
    min_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
    current_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
    cost_per_unit DECIMAL(10,2),
    bought_by TEXT NOT NULL DEFAULT 'store' CHECK (bought_by IN ('store', 'shop')),
    requires_counting BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store Purchases
CREATE TABLE IF NOT EXISTS store_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier TEXT,
    invoice_number TEXT,
    purchase_date TIMESTAMPTZ DEFAULT NOW(),
    total_amount DECIMAL(10,2),
    status TEXT NOT NULL DEFAULT 'received',
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store Purchase Items
CREATE TABLE IF NOT EXISTS store_purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID REFERENCES store_purchases(id) ON DELETE CASCADE,
    store_item_id UUID REFERENCES store_items(id),
    item_name TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'pcs',
    cost_per_unit DECIMAL(10,2),
    total_cost DECIMAL(10,2),
    quantity_processed DECIMAL(10,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending'
);

-- Store Processed Items
CREATE TABLE IF NOT EXISTS store_processed_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_item_id UUID REFERENCES store_items(id),
    purchase_item_id UUID REFERENCES store_purchase_items(id),
    item_name TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'pcs',
    batch_number TEXT,
    processed_by TEXT NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'ready',
    notes TEXT
);

-- Store Despatches
CREATE TABLE IF NOT EXISTS store_despatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    despatch_date TIMESTAMPTZ DEFAULT NOW(),
    destination TEXT NOT NULL DEFAULT 'Shop',
    status TEXT NOT NULL DEFAULT 'pending',
    total_items INTEGER NOT NULL DEFAULT 0,
    sent_by TEXT NOT NULL,
    received_by TEXT,
    received_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store Despatch Items
CREATE TABLE IF NOT EXISTS store_despatch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    despatch_id UUID REFERENCES store_despatches(id) ON DELETE CASCADE,
    processed_item_id UUID REFERENCES store_processed_items(id),
    store_item_id UUID REFERENCES store_items(id),
    item_name TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'pcs',
    received_quantity DECIMAL(10,2),
    notes TEXT
);

-- Store Reorders
CREATE TABLE IF NOT EXISTS store_reorders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_item_id UUID REFERENCES store_items(id),
    item_name TEXT NOT NULL,
    current_stock DECIMAL(10,2) NOT NULL,
    min_stock DECIMAL(10,2) NOT NULL,
    suggested_quantity DECIMAL(10,2) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'pcs',
    estimated_cost DECIMAL(10,2),
    priority TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'pending',
    ordered_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock Reconciliations
CREATE TABLE IF NOT EXISTS stock_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMPTZ NOT NULL,
    opening_session_id UUID REFERENCES shop_stock_sessions(id),
    closing_session_id UUID REFERENCES shop_stock_sessions(id),
    status TEXT NOT NULL DEFAULT 'pending',
    over_items INTEGER DEFAULT 0,
    under_items INTEGER DEFAULT 0,
    matched_items INTEGER DEFAULT 0,
    sent_to_owner_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STAFF REGISTRY
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('store', 'shop', 'partner')),
    telegram_user_id TEXT UNIQUE,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STORE: PURCHASE REQUESTS (PRs)
-- Store staff creates, Partner approves, Store executes
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
    requested_by TEXT NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    requires_evidence BOOLEAN DEFAULT false,
    evidence_threshold DECIMAL(10,2) DEFAULT 5000,
    tolerance_percent DECIMAL(5,2) DEFAULT 10,
    notes TEXT,
    total_estimated DECIMAL(12,2),
    total_actual DECIMAL(12,2)
);

CREATE TABLE IF NOT EXISTS purchase_request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    store_item_id UUID REFERENCES store_items(id),
    requested_qty DECIMAL(10,2) NOT NULL,
    approved_qty DECIMAL(10,2),
    received_qty DECIMAL(10,2),
    unit TEXT DEFAULT 'units',
    estimated_cost DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_pr_status ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_pr_items_pr ON purchase_request_items(pr_id);

-- ============================================================================
-- SHOP: REPLENISHMENT REQUESTS (SRRs)
-- System/Partner creates, Partner approves, Store dispatches
-- ============================================================================

CREATE TABLE IF NOT EXISTS shop_replenishment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id TEXT DEFAULT 'main',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'picking', 'dispatched', 'received', 'completed')),
    requested_by TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS srr_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    srr_id UUID NOT NULL REFERENCES shop_replenishment_requests(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    store_item_id UUID REFERENCES store_items(id),
    requested_qty DECIMAL(10,2) NOT NULL,
    approved_qty DECIMAL(10,2),
    picked_qty DECIMAL(10,2),
    received_qty DECIMAL(10,2),
    unit TEXT DEFAULT 'units',
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_srr_status ON shop_replenishment_requests(status);
CREATE INDEX IF NOT EXISTS idx_srr_items_srr ON srr_items(srr_id);

-- ============================================================================
-- SHOP: SHIFTS (Links to stock sessions for cash tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id TEXT DEFAULT 'main',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    
    -- Open
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    opened_by TEXT NOT NULL,
    opening_float DECIMAL(10,2) NOT NULL,
    staff_on_duty TEXT[] DEFAULT '{}',
    
    -- Close
    closed_at TIMESTAMPTZ,
    closed_by TEXT,
    closing_cash DECIMAL(10,2),
    
    -- Links to stock sessions
    opening_stock_session_id UUID REFERENCES shop_stock_sessions(id),
    closing_stock_session_id UUID REFERENCES shop_stock_sessions(id),
    
    -- Flags (Partner sees these, Shop doesn't)
    flagged BOOLEAN DEFAULT false,
    flag_reason TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(opened_at);

-- ============================================================================
-- SHOP: LOCAL BUY TASKS (System-authorized supermarket purchases)
-- ============================================================================

CREATE TABLE IF NOT EXISTS local_buy_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id TEXT DEFAULT 'main',
    item_name TEXT NOT NULL,
    store_item_id UUID REFERENCES store_items(id),
    max_qty DECIMAL(10,2),
    spend_cap DECIMAL(10,2),
    expires_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'expired', 'cancelled')),
    
    -- Execution
    executed_at TIMESTAMPTZ,
    executed_by TEXT,
    actual_qty DECIMAL(10,2),
    actual_amount DECIMAL(10,2),
    receipt_photo_url TEXT,
    
    -- Link to expense created
    expense_id UUID REFERENCES shop_expenses(id),
    shift_id UUID REFERENCES shifts(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_local_buy_status ON local_buy_tasks(status);

-- ============================================================================
-- ADD SHIFT LINKING TO EXPENSES
-- ============================================================================

ALTER TABLE shop_expenses ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shifts(id);

-- ============================================================================
-- PARTNER: TELEGRAM LINKING (Security)
-- ============================================================================

CREATE TABLE IF NOT EXISTS partner_telegram_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id TEXT UNIQUE NOT NULL,
    staff_id UUID REFERENCES staff(id),
    link_code TEXT,
    code_expires_at TIMESTAMPTZ,
    linked_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

-- ============================================================================
-- PARTNER: PERIOD LOCKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS period_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    locked_by TEXT NOT NULL,
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT,
    
    UNIQUE(period_start, period_end)
);

-- ============================================================================
-- EVIDENCE ATTACHMENTS (Generic for any record type)
-- ============================================================================

CREATE TABLE IF NOT EXISTS evidence_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_type TEXT NOT NULL, -- 'purchase', 'expense', 'local_buy', 'dispatch'
    record_id UUID NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    uploaded_by TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_evidence_record ON evidence_attachments(record_type, record_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE shop_stock_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_stock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_processed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_despatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_despatch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_reorders ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_replenishment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE srr_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_buy_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_telegram_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_attachments ENABLE ROW LEVEL SECURITY;

-- Service role full access policies
CREATE POLICY "service_role_all" ON shop_stock_sessions FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON shop_stock_entries FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON shop_expenses FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON expense_items FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON goods_receipts FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON goods_receipt_items FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON store_items FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON store_purchases FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON store_purchase_items FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON store_processed_items FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON store_despatches FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON store_despatch_items FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON store_reorders FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON stock_reconciliations FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON staff FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON purchase_requests FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON purchase_request_items FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON shop_replenishment_requests FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON srr_items FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON shifts FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON local_buy_tasks FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON partner_telegram_links FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON period_locks FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON evidence_attachments FOR ALL TO service_role USING (true);

-- Authenticated read policies
CREATE POLICY "authenticated_read" ON shop_stock_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON shop_stock_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON shop_expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON expense_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON goods_receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON goods_receipt_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON store_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON store_purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON store_purchase_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON store_processed_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON store_despatches FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON store_despatch_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON store_reorders FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON stock_reconciliations FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON purchase_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON purchase_request_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON shop_replenishment_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON srr_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON local_buy_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON evidence_attachments FOR SELECT TO authenticated USING (true);
