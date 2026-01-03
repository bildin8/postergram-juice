/**
 * Operational Sync Routes
 * Unified API endpoints for the new operational schema
 */

import { Router, Request, Response } from 'express';
import { supabaseAdmin } from './supabase';
import {
    syncTransactions,
    syncRecipes,
    getSyncStatus,
    startSalesSync,
    stopSalesSync
} from './salesSyncService';
import {
    calculateDailyReconciliation,
    calculateCashReconciliation,
    getReconciliationSummary,
    getVarianceSummary,
    acknowledgeReconciliation,
    generateDailySummary
} from './reconciliationService';
import { log } from './index';

const router = Router();

// ============================================================================
// SYNC ENDPOINTS
// ============================================================================

/**
 * GET /api/op/sync/status
 * Get current sync status for transactions and recipes
 */
router.get('/sync/status', async (req: Request, res: Response) => {
    try {
        const status = await getSyncStatus();

        // Also get recipe sync status
        const { data: recipeStatus } = await supabaseAdmin
            .from('op_sync_status')
            .select('*')
            .eq('sync_type', 'recipes')
            .single();

        res.json({
            transactions: status,
            recipes: {
                lastSyncAt: recipeStatus?.last_sync_at,
                recordsSynced: recipeStatus?.records_synced || 0,
                status: recipeStatus?.status || 'idle',
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/op/sync/transactions
 * Trigger manual transaction sync from PosterPOS
 */
router.post('/sync/transactions', async (req: Request, res: Response) => {
    try {
        const result = await syncTransactions();
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/op/sync/recipes
 * Sync recipes/products from PosterPOS
 */
router.post('/sync/recipes', async (req: Request, res: Response) => {
    try {
        const result = await syncRecipes();
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/op/sync/backfill
 * Backfill transactions for last N days (default 14)
 * Use this after fresh start to populate historical data
 */
router.post('/sync/backfill', async (req: Request, res: Response) => {
    try {
        const { days = 14 } = req.body;
        const daysNum = parseInt(days) || 14;

        log(`Starting ${daysNum}-day backfill...`, 'sales-sync');

        // First sync recipes
        const recipeResult = await syncRecipes();
        log(`Recipes synced: ${recipeResult.recipesUpserted}`, 'sales-sync');

        // Then sync transactions
        const txResult = await syncTransactions();

        res.json({
            success: true,
            days: daysNum,
            recipes: recipeResult,
            transactions: txResult,
            message: `Backfill complete. Synced ${recipeResult.recipesUpserted} recipes and ${txResult.transactionsSynced} transactions.`
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/op/fresh-start
 * Complete fresh start: sync recipes + backfill 14 days + mark go-live
 */
router.post('/fresh-start', async (req: Request, res: Response) => {
    try {
        const { days = 14 } = req.body;
        const daysNum = parseInt(days) || 14;

        log(`FRESH START initiated - ${daysNum} day backfill`, 'sales-sync');

        // Step 1: Sync recipes from PosterPOS
        log('Step 1: Syncing recipes...', 'sales-sync');
        const recipeResult = await syncRecipes();

        // Step 2: Sync transactions (will get recent ones)
        log('Step 2: Syncing transactions...', 'sales-sync');
        const txResult = await syncTransactions();

        // Step 3: Mark go-live timestamp
        const goLiveTime = new Date().toISOString();
        await supabaseAdmin
            .from('op_sync_status')
            .upsert({
                sync_type: 'go_live',
                last_sync_at: goLiveTime,
                status: 'complete',
                updated_at: goLiveTime,
            }, { onConflict: 'sync_type' });

        log(`FRESH START complete at ${goLiveTime}`, 'sales-sync');

        res.json({
            success: true,
            goLiveTime,
            recipes: {
                synced: recipeResult.recipesUpserted,
                ingredients: recipeResult.ingredientsUpserted,
            },
            transactions: {
                synced: txResult.transactionsSynced,
                consumption: txResult.consumptionRecordsCreated,
                errors: txResult.errors.length,
            },
            nextSteps: [
                'Run 009_fresh_start.sql if not already done',
                'Do opening stock count at /api/op/stock-counts',
                'Open first shift at /api/op/shifts/open',
                'System is now live!'
            ]
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// INGREDIENTS ENDPOINTS
// ============================================================================

/**
 * GET /api/op/ingredients
 * Get all active ingredients
 */
router.get('/ingredients', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('op_ingredients')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/op/ingredients/stock
 * Get current stock levels by location
 */
router.get('/ingredients/stock', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('v_op_ingredient_stock')
            .select('*');

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// CONSUMPTION ENDPOINTS
// ============================================================================

/**
 * GET /api/op/consumption
 * Get consumption for a date range (pre-calculated)
 */
router.get('/consumption', async (req: Request, res: Response) => {
    try {
        const { from, to } = req.query;

        let query = supabaseAdmin
            .from('v_op_daily_consumption')
            .select('*');

        if (from) {
            query = query.gte('sale_date', from);
        }
        if (to) {
            query = query.lte('sale_date', to);
        }

        const { data, error } = await query.order('sale_date', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// RECONCILIATION ENDPOINTS
// ============================================================================

/**
 * POST /api/op/reconciliation/calculate
 * Calculate and persist daily reconciliation
 */
router.post('/reconciliation/calculate', async (req: Request, res: Response) => {
    try {
        const { date, location, openingStockCountId, closingStockCountId } = req.body;

        if (!date || !location || !openingStockCountId || !closingStockCountId) {
            return res.status(400).json({
                error: 'Missing required fields: date, location, openingStockCountId, closingStockCountId'
            });
        }

        const result = await calculateDailyReconciliation(
            new Date(date),
            location,
            openingStockCountId,
            closingStockCountId
        );

        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/op/reconciliation
 * Get reconciliation summary for date range
 */
router.get('/reconciliation', async (req: Request, res: Response) => {
    try {
        const { from, to, location } = req.query;

        const startDate = from ? new Date(from as string) : new Date();
        startDate.setDate(startDate.getDate() - 7); // Default: last 7 days

        const endDate = to ? new Date(to as string) : new Date();

        const data = await getReconciliationSummary(
            startDate,
            endDate,
            (location as 'store' | 'shop') || 'shop'
        );

        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/op/reconciliation/:id/variance
 * Get variance items for a reconciliation
 */
router.get('/reconciliation/:id/variance', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data = await getVarianceSummary(id);
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/op/reconciliation/:id/acknowledge
 * Mark reconciliation as reviewed/acknowledged
 */
router.post('/reconciliation/:id/acknowledge', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { acknowledgedBy } = req.body;

        if (!acknowledgedBy) {
            return res.status(400).json({ error: 'acknowledgedBy is required' });
        }

        const success = await acknowledgeReconciliation(id, acknowledgedBy);
        res.json({ success });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// SHIFT ENDPOINTS
// ============================================================================

/**
 * GET /api/op/shifts
 * Get recent shifts
 */
router.get('/shifts', async (req: Request, res: Response) => {
    try {
        const { status, limit } = req.query;

        let query = supabaseAdmin
            .from('op_shifts')
            .select('*')
            .order('opened_at', { ascending: false })
            .limit(parseInt(limit as string) || 20);

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/op/shifts/current
 * Get currently open shift
 */
router.get('/shifts/current', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('op_shifts')
            .select('*')
            .eq('status', 'open')
            .order('opened_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
        res.json(data || null);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/op/shifts/open
 * Open a new shift with control checks
 */
router.post('/shifts/open', async (req: Request, res: Response) => {
    try {
        const { openedBy, openingFloat, openingStockCountId } = req.body;

        if (!openedBy || openingFloat === undefined) {
            return res.status(400).json({ error: 'openedBy and openingFloat are required' });
        }

        // 1. Fetch Shift Controls
        const { data: settings } = await supabaseAdmin
            .from('op_settings')
            .select('setting_value')
            .eq('setting_key', 'shift_controls')
            .single();

        const controls = settings?.setting_value || {};

        // 2. Enforce Opening Count if required
        if (controls.require_opening_count && !openingStockCountId) {
            return res.status(400).json({
                error: 'Partner requires an opening stock count to start a shift.',
                code: 'COUNT_REQUIRED'
            });
        }

        // Check if there's already an open shift
        const { data: existing } = await supabaseAdmin
            .from('op_shifts')
            .select('id')
            .eq('status', 'open')
            .limit(1);

        if (existing && existing.length > 0) {
            return res.status(400).json({ error: 'A shift is already open. Close it first.' });
        }

        const { data, error } = await supabaseAdmin
            .from('op_shifts')
            .insert({
                opened_by: openedBy,
                opening_float: openingFloat,
                opening_stock_count_id: openingStockCountId || null,
                status: 'open',
            })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/op/shifts/:id/close
 * Close a shift with cash reconciliation and control enforcement
 */
router.post('/shifts/:id/close', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { closedBy, closingCash, closingStockCountId, cashDeclared } = req.body;

        if (!closedBy || closingCash === undefined) {
            return res.status(400).json({ error: 'closedBy and closingCash are required' });
        }

        // 1. Fetch Controls
        const { data: settings } = await supabaseAdmin
            .from('op_settings')
            .select('setting_value')
            .eq('setting_key', 'shift_controls')
            .single();

        const controls = settings?.setting_value || {};

        // 2. Enforce Closing Count
        if (controls.require_closing_count && !closingStockCountId) {
            return res.status(400).json({
                error: 'Partner requires a closing stock count for shift reconciliation.',
                code: 'COUNT_REQUIRED'
            });
        }

        // 3. Enforce Cash Declaration
        if (controls.require_cash_declaration && cashDeclared === undefined) {
            return res.status(400).json({
                error: 'Partner requires a manual cash declaration before closing.',
                code: 'DECLARATION_REQUIRED'
            });
        }

        // Update shift
        const { data: shift, error: updateError } = await supabaseAdmin
            .from('op_shifts')
            .update({
                closed_by: closedBy,
                closing_cash: closingCash, // Theoretical/POS record
                cash_declared: cashDeclared, // Manual count
                closing_stock_count_id: closingStockCountId || null,
                closed_at: new Date().toISOString(),
                status: 'closed',
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Calculate cash reconciliation
        const cashRecon = await calculateCashReconciliation(id);

        // Auto-generate daily summary since a shift was just finalized
        await generateDailySummary(new Date());

        res.json({
            shift,
            cashReconciliation: cashRecon,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// STOCK COUNT ENDPOINTS
// ============================================================================

/**
 * POST /api/op/stock-counts
 * Create a new stock count session
 */
router.post('/stock-counts', async (req: Request, res: Response) => {
    try {
        const { location, countType, countedBy, shiftId } = req.body;

        if (!location || !countType || !countedBy) {
            return res.status(400).json({ error: 'location, countType, and countedBy are required' });
        }

        const { data, error } = await supabaseAdmin
            .from('op_stock_counts')
            .insert({
                location,
                count_type: countType,
                counted_by: countedBy,
                shift_id: shiftId || null,
                status: 'in_progress',
            })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/op/stock-counts/:id/items
 * Add items to a stock count
 */
router.post('/stock-counts/:id/items', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { items } = req.body; // Array of { ingredientId, ingredientName, countedQuantity, unit, notes }

        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'items array is required' });
        }

        const insertData = items.map((item: any) => ({
            stock_count_id: id,
            ingredient_id: item.ingredientId,
            ingredient_name: item.ingredientName,
            counted_quantity: item.countedQuantity,
            unit: item.unit || 'g',
            notes: item.notes,
        }));

        const { data, error } = await supabaseAdmin
            .from('op_stock_count_items')
            .insert(insertData)
            .select();

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/op/stock-counts/:id/complete
 * Mark stock count as complete
 */
router.post('/stock-counts/:id/complete', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabaseAdmin
            .from('op_stock_counts')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// TRANSACTIONS (READ-ONLY VIEW)
// ============================================================================

/**
 * GET /api/op/transactions
 * Get synced transactions (read-only from PosterPOS)
 */
router.get('/transactions', async (req: Request, res: Response) => {
    try {
        const { from, to, limit } = req.query;

        let query = supabaseAdmin
            .from('op_synced_transactions')
            .select('*')
            .order('transaction_date', { ascending: false })
            .limit(parseInt(limit as string) || 50);

        if (from) {
            query = query.gte('transaction_date', from);
        }
        if (to) {
            query = query.lte('transaction_date', to);
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/op/transactions/summary
 * Get transaction summary for a date
 */
router.get('/transactions/summary', async (req: Request, res: Response) => {
    try {
        const { date } = req.query;
        const targetDate = date ? new Date(date as string) : new Date();
        const dateStr = targetDate.toISOString().split('T')[0];

        const { data, error } = await supabaseAdmin
            .from('op_synced_transactions')
            .select('total_amount, payed_cash, payed_card, pay_type')
            .gte('transaction_date', `${dateStr}T00:00:00`)
            .lt('transaction_date', `${dateStr}T23:59:59`);

        if (error) throw error;

        const summary = {
            date: dateStr,
            transactionCount: data?.length || 0,
            totalSales: data?.reduce((sum: number, t: any) => sum + (parseFloat(t.total_amount) || 0), 0) || 0,
            cashSales: data?.reduce((sum: number, t: any) => sum + (parseFloat(t.payed_cash) || 0), 0) || 0,
            cardSales: data?.reduce((sum: number, t: any) => sum + (parseFloat(t.payed_card) || 0), 0) || 0,
        };

        res.json(summary);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// REORDER REQUESTS (Shop → Store replenishment)
// ============================================================================

/**
 * GET /api/op/reorders
 * Get all reorder requests (with optional status filter)
 */
router.get('/reorders', async (req: Request, res: Response) => {
    try {
        const { status, limit } = req.query;

        let query = supabaseAdmin
            .from('op_reorder_requests')
            .select('*')
            .order('requested_at', { ascending: false })
            .limit(parseInt(limit as string) || 50);

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/op/reorders/pending
 * Get pending reorder requests with stock info
 */
router.get('/reorders/pending', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('v_op_pending_reorders')
            .select('*');

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/op/reorders
 * Create a new reorder request (from Shop)
 */
router.post('/reorders', async (req: Request, res: Response) => {
    try {
        const { ingredientId, ingredientName, requestedQuantity, unit, reason, priority, requestedBy, notes } = req.body;

        if (!ingredientName || !requestedQuantity || !requestedBy) {
            return res.status(400).json({ error: 'ingredientName, requestedQuantity, and requestedBy are required' });
        }

        const { data, error } = await supabaseAdmin
            .from('op_reorder_requests')
            .insert({
                ingredient_id: ingredientId || null,
                ingredient_name: ingredientName,
                requested_quantity: requestedQuantity,
                unit: unit || 'g',
                reason: reason || 'restock',
                priority: priority || 'normal',
                requested_by: requestedBy,
                notes,
                status: 'pending',
            })
            .select()
            .single();

        if (error) throw error;

        log(`Reorder request created: ${ingredientName} x ${requestedQuantity} by ${requestedBy}`, 'reorder');
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/op/reorders/:id/approve
 * Approve a reorder request with staff limit enforcement
 */
router.post('/reorders/:id/approve', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { approvedBy, approverId } = req.body; // Expecting ID now for limit check

        if (!approvedBy) {
            return res.status(400).json({ error: 'approvedBy is required' });
        }

        // 1. Get the reorder details the estimate value
        const { data: reorder } = await supabaseAdmin
            .from('op_reorder_requests')
            .select('requested_quantity, ingredient_id')
            .eq('id', id)
            .single();

        if (!reorder) return res.status(404).json({ error: 'Request not found' });

        // Calculate estimated value using last cost
        const { data: ingredient } = await supabaseAdmin
            .from('op_ingredients')
            .select('last_cost')
            .eq('id', reorder.ingredient_id)
            .single();

        const estValue = (reorder.requested_quantity || 0) * (ingredient?.last_cost || 0);

        // 2. Check approver limits if not Partner
        if (approverId) {
            const { data: staff } = await supabaseAdmin
                .from('op_staff')
                .select('role, can_approve, approval_limit')
                .eq('id', approverId)
                .single();

            if (staff && staff.role !== 'partner') {
                if (!staff.can_approve) {
                    return res.status(403).json({ error: 'You do not have approval authority.' });
                }
                if (staff.approval_limit !== null && estValue > staff.approval_limit) {
                    return res.status(403).json({
                        error: `Exceeds your approval limit of KES ${staff.approval_limit}. (Request: ~KES ${estValue.toFixed(0)})`
                    });
                }
            }
        }

        const { data, error } = await supabaseAdmin
            .from('op_reorder_requests')
            .update({
                status: 'approved',
                approved_by: approvedBy,
                approved_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('status', 'pending')
            .select()
            .single();

        if (error) throw error;

        log(`Reorder request ${id} approved by ${approvedBy} (Value: ~KES ${estValue})`, 'reorder');
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/op/reorders/:id/reject
 * Reject a reorder request
 */
router.post('/reorders/:id/reject', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { rejectedBy, rejectionReason } = req.body;

        if (!rejectedBy) {
            return res.status(400).json({ error: 'rejectedBy is required' });
        }

        const { data, error } = await supabaseAdmin
            .from('op_reorder_requests')
            .update({
                status: 'rejected',
                approved_by: rejectedBy,  // Using approved_by for who took action
                approved_at: new Date().toISOString(),
                rejection_reason: rejectionReason,
            })
            .eq('id', id)
            .eq('status', 'pending')
            .select()
            .single();

        if (error) throw error;
        if (!data) {
            return res.status(404).json({ error: 'Request not found or already processed' });
        }

        log(`Reorder request ${id} rejected by ${rejectedBy}: ${rejectionReason}`, 'reorder');
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/op/reorders/:id/fulfill
 * Link reorder to a dispatch and mark as fulfilled
 */
router.post('/reorders/:id/fulfill', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { dispatchId, fulfilledQuantity } = req.body;

        if (!dispatchId) {
            return res.status(400).json({ error: 'dispatchId is required' });
        }

        const { data, error } = await supabaseAdmin
            .from('op_reorder_requests')
            .update({
                status: 'dispatched',
                dispatch_id: dispatchId,
                fulfilled_quantity: fulfilledQuantity,
                fulfilled_at: new Date().toISOString(),
            })
            .eq('id', id)
            .in('status', ['pending', 'approved'])
            .select()
            .single();

        if (error) throw error;
        if (!data) {
            return res.status(404).json({ error: 'Request not found or not in valid state' });
        }

        log(`Reorder request ${id} fulfilled with dispatch ${dispatchId}`, 'reorder');
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/op/reorders/:id/receive
 * Mark reorder as received (by Shop)
 */
router.post('/reorders/:id/receive', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabaseAdmin
            .from('op_reorder_requests')
            .update({
                status: 'received',
            })
            .eq('id', id)
            .eq('status', 'dispatched')
            .select()
            .single();

        if (error) throw error;
        if (!data) {
            return res.status(404).json({ error: 'Request not found or not in dispatched state' });
        }

        log(`Reorder request ${id} received at shop`, 'reorder');
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// SETTINGS ENDPOINTS
// ============================================================================

/**
 * GET /api/op/settings
 * Get all partner settings
 */
router.get('/settings', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('op_settings')
            .select('*');

        if (error) throw error;

        // Convert to key-value object
        const settings: Record<string, any> = {};
        for (const row of data || []) {
            settings[row.setting_key] = row.setting_value;
        }

        res.json(settings);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/op/settings/:key
 * Update a specific setting
 */
router.put('/settings/:key', async (req: Request, res: Response) => {
    try {
        const { key } = req.params;
        const { value, updatedBy } = req.body;

        const { data, error } = await supabaseAdmin
            .from('op_settings')
            .update({
                setting_value: value,
                updated_at: new Date().toISOString(),
                updated_by: updatedBy || 'Partner',
            })
            .eq('setting_key', key)
            .select()
            .single();

        if (error) throw error;
        if (!data) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        log(`Setting ${key} updated`, 'settings');
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// STAFF AUTH ENDPOINTS
// ============================================================================

/**
 * POST /api/op/auth/login
 * Login with passphrase - returns staff info and role
 */
router.post('/auth/login', async (req: Request, res: Response) => {
    try {
        const { passphrase } = req.body;

        if (!passphrase) {
            return res.status(400).json({ error: 'Passphrase required' });
        }

        const { data, error } = await supabaseAdmin
            .from('op_staff')
            .select('*')
            .eq('passphrase', passphrase.toLowerCase().trim())
            .eq('is_active', true)
            .single();

        if (error || !data) {
            return res.status(401).json({ error: 'Invalid passphrase' });
        }

        // Update last login
        await supabaseAdmin
            .from('op_staff')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', data.id);

        log(`Staff ${data.name} logged in (${data.role})`, 'auth');

        res.json({
            id: data.id,
            name: data.name,
            role: data.role,
            canApprove: data.can_approve,
            approvalLimit: data.approval_limit,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/op/staff
 * List all staff (Partner only)
 */
router.get('/staff', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('op_staff')
            .select('id, name, role, is_active, can_approve, approval_limit, last_login_at, created_at')
            .order('role')
            .order('name');

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/op/staff
 * Create new staff member
 */
router.post('/staff', async (req: Request, res: Response) => {
    try {
        const { name, passphrase, role, canApprove, approvalLimit, createdBy } = req.body;

        if (!name || !passphrase || !role) {
            return res.status(400).json({ error: 'Name, passphrase, and role required' });
        }

        if (!['partner', 'store', 'shop'].includes(role)) {
            return res.status(400).json({ error: 'Role must be partner, store, or shop' });
        }

        const { data, error } = await supabaseAdmin
            .from('op_staff')
            .insert({
                name,
                passphrase: passphrase.toLowerCase().trim(),
                role,
                can_approve: canApprove || false,
                approval_limit: approvalLimit || 0,
                created_by: createdBy || 'Partner',
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(400).json({ error: 'Passphrase already in use' });
            }
            throw error;
        }

        log(`Staff ${name} created with role ${role}`, 'staff');
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/op/staff/:id
 * Update staff member
 */
router.put('/staff/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, passphrase, role, isActive, canApprove, approvalLimit } = req.body;

        const updates: Record<string, any> = {};
        if (name !== undefined) updates.name = name;
        if (passphrase !== undefined) updates.passphrase = passphrase.toLowerCase().trim();
        if (role !== undefined) updates.role = role;
        if (isActive !== undefined) updates.is_active = isActive;
        if (canApprove !== undefined) updates.can_approve = canApprove;
        if (approvalLimit !== undefined) updates.approval_limit = approvalLimit;

        const { data, error } = await supabaseAdmin
            .from('op_staff')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// ALERTS ENDPOINTS
// ============================================================================

/**
 * GET /api/op/alerts
 * Get alerts (optionally filter by acknowledged)
 */
router.get('/alerts', async (req: Request, res: Response) => {
    try {
        const { acknowledged } = req.query;

        let query = supabaseAdmin
            .from('op_alerts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (acknowledged === 'false') {
            query = query.eq('acknowledged', false);
        }

        const { data, error } = await query;

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/op/alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.post('/alerts/:id/acknowledge', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { acknowledgedBy } = req.body;

        const { data, error } = await supabaseAdmin
            .from('op_alerts')
            .update({
                acknowledged: true,
                acknowledged_by: acknowledgedBy || 'Partner',
                acknowledged_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// REPORTS ENDPOINTS
// ============================================================================

/**
 * GET /api/op/reports/below-par
 * Get items below PAR level
 */
router.get('/reports/below-par', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('v_op_below_par')
            .select('*');

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/op/reports/daily-summary
 * Get daily summaries for historical analysis
 */
router.get('/reports/daily-summary', async (req: Request, res: Response) => {
    try {
        const { days = 14 } = req.query;
        const daysNum = parseInt(days as string) || 14;

        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - daysNum);

        const { data, error } = await supabaseAdmin
            .from('op_daily_summary')
            .select('*')
            .gte('summary_date', fromDate.toISOString().split('T')[0])
            .order('summary_date', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/op/reports/consumption-trends
 * Get consumption trends over time
 */
router.get('/reports/consumption-trends', async (req: Request, res: Response) => {
    try {
        const { days = 7 } = req.query;
        const daysNum = parseInt(days as string) || 7;

        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - daysNum);

        // Get daily consumption by ingredient using the view
        const { data, error } = await supabaseAdmin
            .from('v_op_daily_consumption')
            .select(`
                sale_date,
                ingredient_name,
                total_consumed,
                unit
            `)
            .gte('sale_date', fromDate.toISOString().split('T')[0])
            .order('sale_date', { ascending: true });

        if (error) throw error;

        // Aggregate by ingredient per day
        const trends: Record<string, Record<string, number>> = {};
        for (const row of data || []) {
            const ingredient = row.ingredient_name || 'Unknown';
            const date = row.sale_date;
            if (!trends[ingredient]) trends[ingredient] = {};
            // The view already sums per day, but just in case multiple rows per day/ingredient (unlikely with GROUP BY)
            trends[ingredient][date] = (trends[ingredient][date] || 0) + (row.total_consumed || 0);
        }

        res.json(trends);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/op/reports/top-sellers
 * Get top selling products
 */
router.get('/reports/top-sellers', async (req: Request, res: Response) => {
    try {
        const { days = 7 } = req.query;
        const daysNum = parseInt(days as string) || 7;

        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - daysNum);

        // Get sales from synced transactions
        const { data, error } = await supabaseAdmin
            .from('op_synced_transactions')
            .select('products')
            .gte('transaction_date', fromDate.toISOString());

        if (error) throw error;

        // Aggregate products
        const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
        for (const tx of data || []) {
            for (const product of tx.products || []) {
                const key = product.product_id || product.name;
                if (!productSales[key]) {
                    productSales[key] = { name: product.name || 'Unknown', quantity: 0, revenue: 0 };
                }
                productSales[key].quantity += product.count || 1;
                productSales[key].revenue += (product.price || 0) * (product.count || 1);
            }
        }

        // Sort by revenue
        const sorted = Object.values(productSales)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 20);

        res.json(sorted);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/op/reports/variance-history
 * Get historical variance data
 */
router.get('/reports/variance-history', async (req: Request, res: Response) => {
    try {
        const { days = 14 } = req.query;
        const daysNum = parseInt(days as string) || 14;

        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - daysNum);

        const { data, error } = await supabaseAdmin
            .from('op_daily_reconciliation')
            .select(`
                reconciliation_date,
                total_expected_consumption,
                total_variance,
                op_reconciliation_items(
                    op_ingredients(name),
                    expected_consumption,
                    actual_consumption,
                    variance_quantity
                )
            `)
            .gte('reconciliation_date', fromDate.toISOString().split('T')[0])
            .order('reconciliation_date', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/op/ingredients/:id/par
 * Update PAR levels for an ingredient
 */
router.put('/ingredients/:id/par', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { parLevel, safetyStock, maxStock, leadTimeDays, preferredSupplier } = req.body;

        const updates: Record<string, any> = {};
        if (parLevel !== undefined) updates.par_level = parLevel;
        if (safetyStock !== undefined) updates.safety_stock = safetyStock;
        if (maxStock !== undefined) updates.max_stock = maxStock;
        if (leadTimeDays !== undefined) updates.lead_time_days = leadTimeDays;
        if (preferredSupplier !== undefined) updates.preferred_supplier = preferredSupplier;

        const { data, error } = await supabaseAdmin
            .from('op_ingredients')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        log(`Updated PAR levels for ingredient ${id}`, 'ingredients');
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

