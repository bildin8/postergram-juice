-- Postergram Partner Control System
-- Migration 010: Add PAR levels, settings, and enforcement controls
-- Gives Partner full control over all operational thresholds

-- ============================================================================
-- 1. INVENTORY CONTROLS - Add to op_ingredients
-- ============================================================================

ALTER TABLE op_ingredients ADD COLUMN IF NOT EXISTS par_level DECIMAL(15,4) DEFAULT 0;
ALTER TABLE op_ingredients ADD COLUMN IF NOT EXISTS safety_stock DECIMAL(15,4) DEFAULT 0;
ALTER TABLE op_ingredients ADD COLUMN IF NOT EXISTS max_stock DECIMAL(15,4) DEFAULT 0;
ALTER TABLE op_ingredients ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 1;
ALTER TABLE op_ingredients ADD COLUMN IF NOT EXISTS preferred_supplier TEXT;
ALTER TABLE op_ingredients ADD COLUMN IF NOT EXISTS last_cost DECIMAL(15,4) DEFAULT 0;
ALTER TABLE op_ingredients ADD COLUMN IF NOT EXISTS avg_daily_usage DECIMAL(15,4) DEFAULT 0;

-- Index for quick PAR checks
CREATE INDEX IF NOT EXISTS idx_op_ingredients_par ON op_ingredients(par_level) WHERE par_level > 0;

-- ============================================================================
-- 2. PARTNER SETTINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- Enable RLS
ALTER TABLE op_settings ENABLE ROW LEVEL SECURITY;

-- Only partner/service can modify settings
CREATE POLICY "settings_service_all" ON op_settings FOR ALL
    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "settings_authenticated_read" ON op_settings FOR SELECT
    TO authenticated USING (true);

-- Insert default settings
INSERT INTO op_settings (setting_key, setting_value, description) VALUES
    ('shift_controls', '{
        "require_opening_count": true,
        "require_closing_count": true,
        "require_cash_declaration": true,
        "require_staff_assignment": true
    }', 'Controls what is required to open/close shifts'),
    
    ('financial_controls', '{
        "max_petty_cash": 5000,
        "expense_approval_threshold": 2000,
        "cash_variance_tolerance": 500,
        "receipt_required_threshold": 500,
        "price_alert_percent": 20
    }', 'Financial thresholds and limits'),
    
    ('approval_limits', '{
        "shop_lead": 2000,
        "store_lead": 10000,
        "partner": null
    }', 'Maximum amounts each role can approve'),
    
    ('alert_settings', '{
        "dispatch_timeout_hours": 24,
        "variance_threshold_percent": 10,
        "critical_stock_telegram": true,
        "auto_reorder_enabled": true,
        "daily_summary_enabled": true
    }', 'Alert and automation settings'),
    
    ('reorder_settings', '{
        "auto_create_reorder": true,
        "default_lead_time_days": 1,
        "urgent_threshold_percent": 50
    }', 'Reorder automation settings')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- 3. VARIANCE TRACKING ENHANCEMENTS
-- ============================================================================

ALTER TABLE op_stock_count_items ADD COLUMN IF NOT EXISTS variance_reason TEXT;
ALTER TABLE op_stock_count_items ADD COLUMN IF NOT EXISTS acknowledged_by TEXT;
ALTER TABLE op_stock_count_items ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE op_stock_count_items ADD COLUMN IF NOT EXISTS requires_acknowledgment BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 4. DISPATCH TRACKING ENHANCEMENTS
-- ============================================================================

ALTER TABLE op_store_dispatches ADD COLUMN IF NOT EXISTS timeout_alerted BOOLEAN DEFAULT FALSE;
ALTER TABLE op_store_dispatches ADD COLUMN IF NOT EXISTS expected_by TIMESTAMPTZ;

-- ============================================================================
-- 5. SHIFT ENHANCEMENTS
-- ============================================================================

ALTER TABLE op_shifts ADD COLUMN IF NOT EXISTS opening_count_id UUID REFERENCES op_stock_counts(id);
ALTER TABLE op_shifts ADD COLUMN IF NOT EXISTS closing_count_id UUID REFERENCES op_stock_counts(id);
ALTER TABLE op_shifts ADD COLUMN IF NOT EXISTS cash_declared DECIMAL(15,4);
ALTER TABLE op_shifts ADD COLUMN IF NOT EXISTS cash_variance DECIMAL(15,4);
ALTER TABLE op_shifts ADD COLUMN IF NOT EXISTS variance_acknowledged BOOLEAN DEFAULT FALSE;
ALTER TABLE op_shifts ADD COLUMN IF NOT EXISTS variance_reason TEXT;

-- ============================================================================
-- 6. HISTORICAL REPORTS - Daily Summary Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_daily_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    summary_date DATE NOT NULL UNIQUE,
    
    -- Sales
    total_sales DECIMAL(15,4) DEFAULT 0,
    cash_sales DECIMAL(15,4) DEFAULT 0,
    card_sales DECIMAL(15,4) DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    
    -- Consumption
    total_consumption_cost DECIMAL(15,4) DEFAULT 0,
    items_consumed INTEGER DEFAULT 0,
    
    -- Variance
    stock_variance_count INTEGER DEFAULT 0,
    stock_variance_value DECIMAL(15,4) DEFAULT 0,
    cash_variance DECIMAL(15,4) DEFAULT 0,
    
    -- Operations
    shifts_opened INTEGER DEFAULT 0,
    dispatches_sent INTEGER DEFAULT 0,
    dispatches_received INTEGER DEFAULT 0,
    reorders_created INTEGER DEFAULT 0,
    purchases_executed INTEGER DEFAULT 0,
    
    -- Profitability
    gross_margin DECIMAL(15,4) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE op_daily_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_summary_service_all" ON op_daily_summary FOR ALL
    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "daily_summary_authenticated_read" ON op_daily_summary FOR SELECT
    TO authenticated USING (true);

-- Index for date queries
CREATE INDEX IF NOT EXISTS idx_op_daily_summary_date ON op_daily_summary(summary_date DESC);

-- ============================================================================
-- 7. ALERT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type TEXT NOT NULL, -- 'low_stock', 'critical_stock', 'dispatch_timeout', 'variance', 'price_alert'
    severity TEXT NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'critical'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    reference_type TEXT, -- 'ingredient', 'dispatch', 'shift', 'purchase'
    reference_id UUID,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMPTZ,
    telegram_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE op_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts_service_all" ON op_alerts FOR ALL
    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "alerts_authenticated_read" ON op_alerts FOR SELECT
    TO authenticated USING (true);

-- Index for unacknowledged alerts
CREATE INDEX IF NOT EXISTS idx_op_alerts_pending ON op_alerts(acknowledged, created_at DESC) WHERE acknowledged = FALSE;

-- ============================================================================
-- 8. STAFF AUTHENTICATION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    passphrase TEXT NOT NULL UNIQUE, -- e.g. "mango-sunrise-2024"
    role TEXT NOT NULL CHECK (role IN ('partner', 'store', 'shop')),
    is_active BOOLEAN DEFAULT TRUE,
    can_approve BOOLEAN DEFAULT FALSE, -- Can approve within their limit
    approval_limit DECIMAL(15,4) DEFAULT 0, -- Max KES they can approve
    telegram_chat_id TEXT, -- For personal notifications
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

-- Enable RLS
ALTER TABLE op_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_service_all" ON op_staff FOR ALL
    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "staff_authenticated_read" ON op_staff FOR SELECT
    TO authenticated USING (true);

-- Index for login lookup
CREATE INDEX IF NOT EXISTS idx_op_staff_passphrase ON op_staff(passphrase) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_op_staff_role ON op_staff(role) WHERE is_active = TRUE;

-- Insert default partner user
INSERT INTO op_staff (name, passphrase, role, can_approve, approval_limit) VALUES
    ('Owner', 'owner-master-2024', 'partner', true, NULL)
ON CONFLICT (passphrase) DO NOTHING;

-- ============================================================================
-- 9. VIEW: Items Below PAR (joins with stock view)
-- ============================================================================

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

-- ============================================================================
-- DONE
-- ============================================================================

SELECT 'Migration 010: Partner controls + Staff auth added successfully' as status;
