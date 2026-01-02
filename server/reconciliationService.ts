/**
 * Reconciliation Service
 * Single source of truth for variance calculation
 * 
 * Formula:
 * Expected Closing = Opening + Received - Theoretical Usage
 * Variance = Actual Closing - Expected Closing
 */

import { supabaseAdmin } from './supabase';
import { log } from './index';

// ============================================================================
// CORE RECONCILIATION CALCULATION
// ============================================================================

export interface ReconciliationResult {
    success: boolean;
    reconciliationId: string | null;
    itemCount: number;
    overCount: number;
    underCount: number;
    matchedCount: number;
    totalVarianceValue: number;
    errors: string[];
}

/**
 * Calculate and persist daily reconciliation for a location
 * This is THE calculation - it happens ONCE per day, not on every page load
 */
export async function calculateDailyReconciliation(
    date: Date,
    location: 'store' | 'shop',
    openingStockCountId: string,
    closingStockCountId: string
): Promise<ReconciliationResult> {
    const result: ReconciliationResult = {
        success: true,
        reconciliationId: null,
        itemCount: 0,
        overCount: 0,
        underCount: 0,
        matchedCount: 0,
        totalVarianceValue: 0,
        errors: [],
    };

    const dateStr = date.toISOString().split('T')[0];

    try {
        // 1. Create or get reconciliation header
        const { data: recon, error: reconError } = await supabaseAdmin
            .from('op_daily_reconciliation')
            .upsert({
                date: dateStr,
                location,
                opening_stock_count_id: openingStockCountId,
                closing_stock_count_id: closingStockCountId,
                status: 'pending',
            }, { onConflict: 'date,location' })
            .select()
            .single();

        if (reconError || !recon) {
            result.success = false;
            result.errors.push(`Failed to create reconciliation: ${reconError?.message}`);
            return result;
        }

        result.reconciliationId = recon.id;

        // 2. Get opening stock counts
        const { data: openingItems } = await supabaseAdmin
            .from('op_stock_count_items')
            .select('ingredient_id, ingredient_name, counted_quantity, unit')
            .eq('stock_count_id', openingStockCountId);

        const openingMap = new Map<string, { name: string; qty: number; unit: string }>();
        for (const item of openingItems || []) {
            openingMap.set(item.ingredient_id, {
                name: item.ingredient_name,
                qty: parseFloat(item.counted_quantity) || 0,
                unit: item.unit,
            });
        }

        // 3. Get closing stock counts
        const { data: closingItems } = await supabaseAdmin
            .from('op_stock_count_items')
            .select('ingredient_id, ingredient_name, counted_quantity, unit')
            .eq('stock_count_id', closingStockCountId);

        const closingMap = new Map<string, { name: string; qty: number; unit: string }>();
        for (const item of closingItems || []) {
            closingMap.set(item.ingredient_id, {
                name: item.ingredient_name,
                qty: parseFloat(item.counted_quantity) || 0,
                unit: item.unit,
            });
        }

        // 4. Get received quantities for the day (from dispatches if shop)
        const receivedMap = new Map<string, number>();

        if (location === 'shop') {
            const { data: receipts } = await supabaseAdmin
                .from('op_shop_receipts')
                .select(`
          id,
          dispatch_id,
          op_store_dispatches!inner(
            op_store_dispatch_items(ingredient_id, quantity_received)
          )
        `)
                .gte('received_at', `${dateStr}T00:00:00`)
                .lt('received_at', `${dateStr}T23:59:59`)
                .eq('status', 'received');

            for (const receipt of receipts || []) {
                const dispatch = (receipt as any).op_store_dispatches;
                if (dispatch?.op_store_dispatch_items) {
                    for (const item of dispatch.op_store_dispatch_items) {
                        const current = receivedMap.get(item.ingredient_id) || 0;
                        receivedMap.set(item.ingredient_id, current + (parseFloat(item.quantity_received) || 0));
                    }
                }
            }
        }

        // 5. Get theoretical usage for the day (from calculated consumption)
        const { data: consumption } = await supabaseAdmin
            .from('op_calculated_consumption')
            .select('ingredient_id, quantity_consumed')
            .gte('calculated_at', `${dateStr}T00:00:00`)
            .lt('calculated_at', `${dateStr}T23:59:59`);

        const usageMap = new Map<string, number>();
        for (const item of consumption || []) {
            const current = usageMap.get(item.ingredient_id) || 0;
            usageMap.set(item.ingredient_id, current + (parseFloat(item.quantity_consumed) || 0));
        }

        // 6. Get ingredient costs for variance value calculation
        const { data: ingredients } = await supabaseAdmin
            .from('op_ingredients')
            .select('id, avg_cost');

        const costMap = new Map<string, number>();
        for (const ing of ingredients || []) {
            costMap.set(ing.id, parseFloat(ing.avg_cost) || 0);
        }

        // 7. Calculate variance for each ingredient
        const allIngredientIds = new Set([
            ...openingMap.keys(),
            ...closingMap.keys(),
            ...receivedMap.keys(),
            ...usageMap.keys(),
        ]);

        // Delete existing reconciliation items for this reconciliation
        await supabaseAdmin
            .from('op_reconciliation_items')
            .delete()
            .eq('reconciliation_id', recon.id);

        const reconciliationItems: any[] = [];

        for (const ingredientId of allIngredientIds) {
            const opening = openingMap.get(ingredientId);
            const closing = closingMap.get(ingredientId);

            const openingQty = opening?.qty || 0;
            const receivedQty = receivedMap.get(ingredientId) || 0;
            const theoreticalUsage = usageMap.get(ingredientId) || 0;
            const actualClosing = closing?.qty || 0;

            // THE FORMULA
            const expectedClosing = openingQty + receivedQty - theoreticalUsage;
            const variance = actualClosing - expectedClosing;

            // Variance value
            const avgCost = costMap.get(ingredientId) || 0;
            const varianceValue = variance * avgCost;

            // Status
            let varianceStatus: 'matched' | 'over' | 'under' = 'matched';
            const tolerance = 0.01; // Allow small rounding differences
            if (variance > tolerance) {
                varianceStatus = 'over';
                result.overCount++;
            } else if (variance < -tolerance) {
                varianceStatus = 'under';
                result.underCount++;
            } else {
                result.matchedCount++;
            }

            result.totalVarianceValue += varianceValue;

            reconciliationItems.push({
                reconciliation_id: recon.id,
                ingredient_id: ingredientId,
                ingredient_name: opening?.name || closing?.name || 'Unknown',
                opening_qty: openingQty,
                received_qty: receivedQty,
                theoretical_usage: theoreticalUsage,
                expected_closing: expectedClosing,
                actual_closing: actualClosing,
                variance,
                variance_value: varianceValue,
                variance_status: varianceStatus,
                unit: opening?.unit || closing?.unit || 'g',
            });
        }

        // 8. Insert reconciliation items
        if (reconciliationItems.length > 0) {
            const { error: itemsError } = await supabaseAdmin
                .from('op_reconciliation_items')
                .insert(reconciliationItems);

            if (itemsError) {
                result.errors.push(`Failed to insert items: ${itemsError.message}`);
            }
        }

        result.itemCount = reconciliationItems.length;

        // 9. Update reconciliation status
        await supabaseAdmin
            .from('op_daily_reconciliation')
            .update({
                status: 'completed',
            })
            .eq('id', recon.id);

        log(`Reconciliation complete: ${result.itemCount} items, ${result.overCount} over, ${result.underCount} under`, 'reconciliation');

    } catch (error: any) {
        result.success = false;
        result.errors.push(error.message);
        log(`Reconciliation failed: ${error.message}`, 'reconciliation');
    }

    return result;
}

// ============================================================================
// SHIFT-BASED CASH RECONCILIATION
// ============================================================================

export interface CashReconciliationResult {
    success: boolean;
    expectedCash: number;
    actualCash: number;
    variance: number;
    posCashTotal: number;
    posCardTotal: number;
    expensesTotal: number;
    openingFloat: number;
}

/**
 * Calculate cash reconciliation for a shift
 * Expected Cash = Opening Float + POS Cash Sales - Expenses
 * Variance = Actual Cash - Expected Cash
 */
export async function calculateCashReconciliation(shiftId: string): Promise<CashReconciliationResult> {
    const result: CashReconciliationResult = {
        success: false,
        expectedCash: 0,
        actualCash: 0,
        variance: 0,
        posCashTotal: 0,
        posCardTotal: 0,
        expensesTotal: 0,
        openingFloat: 0,
    };

    try {
        // Get shift details
        const { data: shift } = await supabaseAdmin
            .from('op_shifts')
            .select('*')
            .eq('id', shiftId)
            .single();

        if (!shift) {
            return result;
        }

        result.openingFloat = parseFloat(shift.opening_float) || 0;
        result.actualCash = parseFloat(shift.closing_cash) || 0;

        // Get POS totals for the shift period
        const { data: transactions } = await supabaseAdmin
            .from('op_synced_transactions')
            .select('payed_cash, payed_card')
            .gte('transaction_date', shift.opened_at)
            .lte('transaction_date', shift.closed_at || new Date().toISOString());

        for (const tx of transactions || []) {
            result.posCashTotal += parseFloat(tx.payed_cash) || 0;
            result.posCardTotal += parseFloat(tx.payed_card) || 0;
        }

        // Get expenses for the shift
        const { data: expenses } = await supabaseAdmin
            .from('op_shop_expenses')
            .select('amount')
            .eq('shift_id', shiftId);

        for (const exp of expenses || []) {
            result.expensesTotal += parseFloat(exp.amount) || 0;
        }

        // THE FORMULA
        result.expectedCash = result.openingFloat + result.posCashTotal - result.expensesTotal;
        result.variance = result.actualCash - result.expectedCash;
        result.success = true;

        // Update shift with calculated values
        await supabaseAdmin
            .from('op_shifts')
            .update({
                pos_cash_total: result.posCashTotal,
                pos_card_total: result.posCardTotal,
                expenses_total: result.expensesTotal,
                expected_cash: result.expectedCash,
                cash_variance: result.variance,
            })
            .eq('id', shiftId);

    } catch (error: any) {
        log(`Cash reconciliation failed: ${error.message}`, 'reconciliation');
    }

    return result;
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get reconciliation summary for a date range
 */
export async function getReconciliationSummary(
    startDate: Date,
    endDate: Date,
    location: 'store' | 'shop'
): Promise<any[]> {
    const { data } = await supabaseAdmin
        .from('op_daily_reconciliation')
        .select(`
      *,
      op_reconciliation_items(*)
    `)
        .eq('location', location)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

    return data || [];
}

/**
 * Get variance summary (items with non-zero variance)
 */
export async function getVarianceSummary(reconciliationId: string): Promise<any[]> {
    const { data } = await supabaseAdmin
        .from('op_reconciliation_items')
        .select('*')
        .eq('reconciliation_id', reconciliationId)
        .neq('variance_status', 'matched')
        .order('variance_value', { ascending: true });

    return data || [];
}

/**
 * Acknowledge reconciliation (mark as reviewed)
 */
export async function acknowledgeReconciliation(
    reconciliationId: string,
    acknowledgedBy: string
): Promise<boolean> {
    const { error } = await supabaseAdmin
        .from('op_daily_reconciliation')
        .update({
            status: 'acknowledged',
            acknowledged_by: acknowledgedBy,
            acknowledged_at: new Date().toISOString(),
        })
        .eq('id', reconciliationId);

    return !error;
}
/**
 * Generate a comprehensive daily summary for a specific date
 * Aggregates all activity into op_daily_summary table
 */
export async function generateDailySummary(date: Date): Promise<any> {
    const dateStr = date.toISOString().split('T')[0];
    log(`Generating daily summary for ${dateStr}`, 'reporting');

    try {
        // 1. Get Sales Summary
        const { data: salesTx } = await supabaseAdmin
            .from('op_synced_transactions')
            .select('total_amount, payed_cash, payed_card')
            .gte('transaction_date', `${dateStr}T00:00:00`)
            .lt('transaction_date', `${dateStr}T23:59:59`);

        const totalSales = salesTx?.reduce((sum: number, t: any) => sum + (parseFloat(t.total_amount) || 0), 0) || 0;
        const cashSales = salesTx?.reduce((sum: number, t: any) => sum + (parseFloat(t.payed_cash) || 0), 0) || 0;
        const cardSales = salesTx?.reduce((sum: number, t: any) => sum + (parseFloat(t.payed_card) || 0), 0) || 0;
        const txCount = salesTx?.length || 0;

        // 2. Get Consumption Summary
        const { data: consumption } = await supabaseAdmin
            .from('op_calculated_consumption')
            .select('quantity_consumed, cost_at_time')
            .gte('calculated_at', `${dateStr}T00:00:00`)
            .lt('calculated_at', `${dateStr}T23:59:59`);

        const totalConsumptionCost = consumption?.reduce((sum: number, c: any) => sum + (parseFloat(c.cost_at_time) || 0), 0) || 0;
        const itemsConsumed = consumption?.length || 0;

        // 3. Get Stock Variance
        const { data: recon } = await supabaseAdmin
            .from('op_daily_reconciliation')
            .select('id, total_variance_value')
            .eq('date', dateStr);

        let stockVarianceCount = 0;
        let stockVarianceValue = 0;

        for (const r of recon || []) {
            const { data: items } = await supabaseAdmin
                .from('op_reconciliation_items')
                .select('id')
                .eq('reconciliation_id', r.id)
                .neq('variance_status', 'matched');

            stockVarianceCount += items?.length || 0;
            stockVarianceValue += parseFloat(r.total_variance_value) || 0;
        }

        // 4. Get Cash Variance (from shifts closed today)
        const { data: shifts } = await supabaseAdmin
            .from('op_shifts')
            .select('cash_variance')
            .gte('closed_at', `${dateStr}T00:00:00`)
            .lt('closed_at', `${dateStr}T23:59:59`);

        const cashVariance = shifts?.reduce((sum: number, s: any) => sum + (parseFloat(s.cash_variance) || 0), 0) || 0;

        // 5. Get Ops Metrics
        const { count: shiftsOpened } = await supabaseAdmin.from('op_shifts').select('*', { count: 'exact', head: true }).gte('opened_at', `${dateStr}T00:00:00`).lt('opened_at', `${dateStr}T23:59:59`);
        const { count: reordersCreated } = await supabaseAdmin.from('op_reorder_requests').select('*', { count: 'exact', head: true }).gte('requested_at', `${dateStr}T00:00:00`).lt('requested_at', `${dateStr}T23:59:59`);
        const { count: dispatchesSent } = await supabaseAdmin.from('op_store_dispatches').select('*', { count: 'exact', head: true }).gte('dispatched_at', `${dateStr}T00:00:00`).lt('dispatched_at', `${dateStr}T23:59:59`);
        const { count: dispatchesReceived } = await supabaseAdmin.from('op_shop_receipts').select('*', { count: 'exact', head: true }).gte('received_at', `${dateStr}T00:00:00`).lt('received_at', `${dateStr}T23:59:59`);

        // Calculate Gross Margin
        const grossMargin = totalSales - totalConsumptionCost;

        // 6. Upsert Daily Summary
        const summaryData = {
            summary_date: dateStr,
            total_sales: totalSales,
            cash_sales: cashSales,
            card_sales: cardSales,
            transaction_count: txCount,
            total_consumption_cost: totalConsumptionCost,
            items_consumed: itemsConsumed,
            stock_variance_count: stockVarianceCount,
            stock_variance_value: stockVarianceValue,
            cash_variance: cashVariance,
            shifts_opened: shiftsOpened || 0,
            dispatches_sent: dispatchesSent || 0,
            dispatches_received: dispatchesReceived || 0,
            reorders_created: reordersCreated || 0,
            gross_margin: grossMargin,
        };

        const { data: finalSummary, error } = await supabaseAdmin
            .from('op_daily_summary')
            .upsert(summaryData, { onConflict: 'summary_date' })
            .select()
            .single();

        if (error) throw error;
        return finalSummary;

    } catch (error: any) {
        log(`Failed to generate daily summary: ${error.message}`, 'reporting');
        return null;
    }
}
