-- Postergram Fresh Start Migration
-- Migration 009: Clear legacy tables and prepare for go-live
-- Run this AFTER 007 and 008 migrations are applied
-- This clears old data so the new op_ tables become the source of truth

-- ============================================================================
-- PRESERVE: Keep these tables (still in use)
-- ============================================================================
-- telegram_chats - Needed for notifications
-- op_* tables - The new operational schema
-- Any auth/user tables

-- ============================================================================
-- CLEAR LEGACY OPERATIONAL DATA (safely handles missing tables)
-- ============================================================================

DO $$ 
BEGIN
    -- Clear old sales/transaction data (will be re-synced)
    BEGIN
        TRUNCATE TABLE sales_records CASCADE;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
        TRUNCATE TABLE transactions CASCADE;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    -- Clear old inventory tracking (replaced by op_calculated_consumption)
    BEGIN
        TRUNCATE TABLE ingredient_consumption CASCADE;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
        TRUNCATE TABLE inventory_movements CASCADE;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
        TRUNCATE TABLE inventory_items CASCADE;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    -- Clear old despatch logs (replaced by op_store_dispatches)
    BEGIN
        TRUNCATE TABLE despatch_logs CASCADE;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    -- Clear old reorder requests (replaced by op_reorder_requests)
    BEGIN
        TRUNCATE TABLE reorder_requests CASCADE;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    -- Clear old stock/reconciliation data (replaced by op_ tables)
    BEGIN
        TRUNCATE TABLE stock_counts CASCADE;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
        TRUNCATE TABLE reconciliation_records CASCADE;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    -- Clear old shift data (replaced by op_shifts)
    BEGIN
        TRUNCATE TABLE shifts CASCADE;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
END $$;

-- ============================================================================
-- MARK GO-LIVE DATE
-- ============================================================================

-- Update sync status to indicate fresh start
UPDATE op_sync_status 
SET 
    last_sync_at = NULL,
    last_sync_timestamp = NULL,
    records_synced = 0,
    status = 'idle',
    error_message = NULL,
    updated_at = NOW()
WHERE sync_type IN ('transactions', 'recipes');

-- ============================================================================
-- DONE
-- ============================================================================

SELECT 'Fresh start migration complete. Legacy tables cleared.' as status;
