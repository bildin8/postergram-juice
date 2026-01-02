-- Postergram Operational Schema - Reorder Requests
-- Migration 008: Add reorder management to complete the replenishment loop
-- Flow: Shop detects low stock → Request → Store approves → Dispatch → Shop receives

-- ============================================================================
-- REORDER REQUESTS (Shop → Store replenishment requests)
-- ============================================================================

CREATE TABLE IF NOT EXISTS op_reorder_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- What is being requested
    ingredient_id UUID REFERENCES op_ingredients(id),
    ingredient_name TEXT NOT NULL,  -- Denormalized
    requested_quantity DECIMAL(12, 4) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'g',
    
    -- Request details
    reason TEXT,  -- 'low_stock', 'out_of_stock', 'restock', 'variance'
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Requester info
    requested_by TEXT NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Approval workflow
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'dispatched', 'received', 'cancelled')),
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Fulfillment tracking
    dispatch_id UUID REFERENCES op_store_dispatches(id),
    fulfilled_quantity DECIMAL(12, 4),
    fulfilled_at TIMESTAMPTZ,
    
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_reorder_requests_status ON op_reorder_requests(status);
CREATE INDEX IF NOT EXISTS idx_op_reorder_requests_date ON op_reorder_requests(requested_at);
CREATE INDEX IF NOT EXISTS idx_op_reorder_requests_ingredient ON op_reorder_requests(ingredient_id);

-- RLS
ALTER TABLE op_reorder_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all" ON op_reorder_requests FOR ALL TO service_role USING (true);
CREATE POLICY "auth_read" ON op_reorder_requests FOR SELECT TO authenticated USING (true);

-- View for pending requests with ingredient details
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
