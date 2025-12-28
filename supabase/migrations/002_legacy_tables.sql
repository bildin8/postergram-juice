-- Legacy Tables Migration
-- These tables support backward compatibility with existing features
-- Run this AFTER 001_enhanced_schema.sql

-- ============================================================================
-- TELEGRAM CHATS (for bot notifications)
-- ============================================================================

CREATE TABLE IF NOT EXISTS telegram_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id TEXT NOT NULL UNIQUE,
    chat_type TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner',
    is_active BOOLEAN NOT NULL DEFAULT true,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_chats_chat_id ON telegram_chats(chat_id);

-- ============================================================================
-- SALES RECORDS (synced from Poster POS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sales_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poster_pos_id TEXT UNIQUE,
    item_name TEXT NOT NULL,
    quantity TEXT NOT NULL,
    amount TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_records_poster_id ON sales_records(poster_pos_id);
CREATE INDEX IF NOT EXISTS idx_sales_records_timestamp ON sales_records(timestamp);

-- ============================================================================
-- DESPATCH LOGS (items sent from store to shop)
-- ============================================================================

CREATE TABLE IF NOT EXISTS despatch_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID,
    item_name TEXT NOT NULL,
    quantity TEXT NOT NULL,
    destination TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- REORDER REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS reorder_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_name TEXT NOT NULL,
    quantity TEXT NOT NULL,
    unit TEXT NOT NULL,
    estimated_cost TEXT,
    vendor TEXT,
    notes TEXT,
    requester TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by TEXT
);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE telegram_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE despatch_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reorder_requests ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Allow service role all" ON telegram_chats FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role all" ON sales_records FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role all" ON despatch_logs FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role all" ON reorder_requests FOR ALL TO service_role USING (true);

-- Allow authenticated read
CREATE POLICY "Allow authenticated read" ON telegram_chats FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON sales_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON despatch_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON reorder_requests FOR SELECT TO authenticated USING (true);
