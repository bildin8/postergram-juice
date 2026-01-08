-- 012_gap_fill.sql
-- BRIDGE THE GAP between Portal Tables (003) and Operational Analytics (007/011)

-- 1. LINK REPLENISHMENT REQUESTS (SRR) TO ANALYTICS
-- The Portal uses 'shop_replenishment_requests' (Header/Items)
-- The Analytics expects 'op_reorder_requests' (Flat)
-- We replace the view 'v_op_pending_reorders' to look at the Portal table.

DROP VIEW IF EXISTS v_op_pending_reorders CASCADE;

CREATE OR REPLACE VIEW v_op_pending_reorders AS
SELECT 
    ri.id as id,
    r.shop_id,
    ri.store_item_id as ingredient_id, -- Assuming store_item_id maps to ingredient_id (1:1 in ideal world)
    ri.item_name as ingredient_name,
    ri.requested_qty as requested_quantity,
    ri.unit,
    r.notes as reason,
    r.priority,
    r.requested_by,
    r.requested_at,
    r.status,
    r.approved_by,
    r.approved_at,
    r.rejection_reason,
    -- Analytics extras
    i.category as ingredient_category,
    s.shop_stock as current_shop_stock,
    s.store_stock as available_store_stock
FROM shop_replenishment_requests r
JOIN srr_items ri ON ri.srr_id = r.id
LEFT JOIN op_ingredients i ON ri.store_item_id::text = i.id::text -- Cast to allow join if types differ, or purely logical join
LEFT JOIN v_op_ingredient_stock s ON ri.store_item_id::text = s.id::text
WHERE r.status = 'pending';

GRANT SELECT ON v_op_pending_reorders TO authenticated;


-- 2. LINK EXPENSES
-- Shop writes to 'shop_expenses'. Analytics (007) defined 'op_shop_expenses'.
-- We will MIGRATE the route logic, but for safety, let's ensure 'op_shop_expenses' 
-- covers everything 'shop_expenses' did.
-- 007 op_shop_expenses: id, shift_id, expense_type, category, description, amount, paid_by, paid_to, receipt_photo_url
-- 003 shop_expenses: same + receipt_number
-- Action: Alter op_shop_expenses to match fully, then we switch the code.

ALTER TABLE op_shop_expenses ADD COLUMN IF NOT EXISTS receipt_number TEXT;


-- 3. LINK STORE PURCHASES (PRs)
-- Portal uses 'purchase_requests' (Header/Items) for Draft/Pending
-- 007 uses 'op_store_purchases' (Header) -> 'op_store_purchase_items'
-- We should ensure 'op_store_purchases' handles the draft phase.
-- Code switch required.


-- 4. FIX SPLIT BRAIN IN STOCK
-- 'store_items' (003) vs 'op_ingredients' (007)
-- We need to ensure that when we refer to 'store_item_id' in SRRs/PRs, we are referring to something 
-- that maps to 'op_ingredients'.
-- For now, we assume they are the same UUIDs or we need a mapping.
-- If they are different tables, we need a migration to unify them.
-- Assuming 'op_ingredients' is the MASTER.
-- We will create a view 'store_items' that simply selects from 'op_ingredients' 
-- so legacy code keeps working but reads from Master.

-- BUT 'store_items' has 'current_stock' column (denormalized).
-- 'op_ingredients' uses calculated stock.
-- Legacy code UPDATES 'current_stock'.
-- If we replace table with view, UPDATE will fail.
-- So we cannot simply replace 'store_items' with a view without rewriting all UPDATE logic.
-- PROPOSAL: Keep 'store_items' as the "Cache" but ensure 'op_ingredients' is the source of definition.
-- Better yet, accept that 'store_items' is the "Store Inventory" and 'op_ingredients' is the "Analytics Definition".
-- We just need to make sure Analytics sees the stock.
-- v_op_ingredient_stock (011) calculates stock from purchases/dispatches.
-- So 'current_stock' in 'store_items' is redundant but harmless if we rely on the VIEW for analytics.

