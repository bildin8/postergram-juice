/**
 * Inventory Ledger Service
 * Connects transactions and operations to append-only inventory movement records
 */

import { supabaseAdmin } from './supabase';
import { log } from './index';

export interface MovementRecord {
    ingredientId?: string;
    itemName: string;
    locationId?: string;
    movementType:
    | 'sale'           // Deduction from POS sale
    | 'purchase'       // Addition from store purchase
    | 'dispatch_out'   // Deduction when dispatching from store
    | 'dispatch_in'    // Addition when receiving at shop
    | 'wastage'        // Write-off
    | 'adjustment'     // Manual adjustment
    | 'production_in'  // Input to production
    | 'production_out' // Output from production
    | 'local_buy';     // Shop supermarket purchase
    quantity: number;
    unit: string;
    referenceType?: string; // 'transaction', 'purchase', 'dispatch', 'shift', etc.
    referenceId?: string;
    notes?: string;
    performedBy?: string;
    costPerUnit?: number;
}

/**
 * Record an inventory movement in the append-only ledger
 */
export async function recordMovement(movement: MovementRecord): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabaseAdmin
            .from('inventory_movements')
            .insert({
                ingredient_id: movement.ingredientId,
                location_id: movement.locationId || 'main',
                movement_type: movement.movementType,
                quantity: movement.quantity,
                unit: movement.unit,
                reference_type: movement.referenceType,
                reference_id: movement.referenceId,
                notes: movement.notes ? `${movement.itemName}: ${movement.notes}` : movement.itemName,
                performed_by: movement.performedBy,
                cost_per_unit: movement.costPerUnit,
            });

        if (error) {
            log(`Ledger movement failed: ${error.message}`, 'ledger');
            return { success: false, error: error.message };
        }

        log(`Ledger: ${movement.movementType} ${movement.quantity} ${movement.unit} of ${movement.itemName}`, 'ledger');
        return { success: true };
    } catch (err: any) {
        log(`Ledger error: ${err.message}`, 'ledger');
        return { success: false, error: err.message };
    }
}

/**
 * Record multiple movements atomically
 */
export async function recordMovements(movements: MovementRecord[]): Promise<{ success: boolean; count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    for (const movement of movements) {
        const result = await recordMovement(movement);
        if (result.success) {
            count++;
        } else {
            errors.push(result.error || 'Unknown error');
        }
    }

    return { success: errors.length === 0, count, errors };
}

/**
 * Record sale deductions from a POS transaction
 */
export async function recordSaleDeductions(
    transactionId: string,
    items: { ingredientId?: string; name: string; quantity: number; unit: string }[],
    performedBy?: string
): Promise<void> {
    const movements: MovementRecord[] = items.map(item => ({
        ingredientId: item.ingredientId,
        itemName: item.name,
        locationId: 'shop',
        movementType: 'sale',
        quantity: -Math.abs(item.quantity), // Negative for deduction
        unit: item.unit,
        referenceType: 'transaction',
        referenceId: transactionId,
        performedBy,
    }));

    await recordMovements(movements);
}

/**
 * Record purchase additions
 */
export async function recordPurchaseAdditions(
    purchaseId: string,
    items: { storeItemId?: string; name: string; quantity: number; unit: string; costPerUnit?: number }[],
    performedBy?: string
): Promise<void> {
    const movements: MovementRecord[] = items.map(item => ({
        ingredientId: item.storeItemId,
        itemName: item.name,
        locationId: 'store',
        movementType: 'purchase',
        quantity: Math.abs(item.quantity), // Positive for addition
        unit: item.unit,
        referenceType: 'purchase',
        referenceId: purchaseId,
        performedBy,
        costPerUnit: item.costPerUnit,
    }));

    await recordMovements(movements);
}

/**
 * Record dispatch movements (out from store, in to shop)
 */
export async function recordDispatch(
    dispatchId: string,
    items: { storeItemId?: string; name: string; quantity: number; unit: string }[],
    phase: 'sent' | 'received',
    performedBy?: string
): Promise<void> {
    const movements: MovementRecord[] = items.map(item => ({
        ingredientId: item.storeItemId,
        itemName: item.name,
        locationId: phase === 'sent' ? 'store' : 'shop',
        movementType: phase === 'sent' ? 'dispatch_out' : 'dispatch_in',
        quantity: phase === 'sent' ? -Math.abs(item.quantity) : Math.abs(item.quantity),
        unit: item.unit,
        referenceType: 'dispatch',
        referenceId: dispatchId,
        performedBy,
    }));

    await recordMovements(movements);
}

/**
 * Record wastage
 */
export async function recordWastage(
    items: { ingredientId?: string; name: string; quantity: number; unit: string; reason?: string }[],
    shiftId?: string,
    performedBy?: string
): Promise<void> {
    const movements: MovementRecord[] = items.map(item => ({
        ingredientId: item.ingredientId,
        itemName: item.name,
        locationId: 'shop',
        movementType: 'wastage',
        quantity: -Math.abs(item.quantity),
        unit: item.unit,
        referenceType: 'shift',
        referenceId: shiftId,
        notes: item.reason,
        performedBy,
    }));

    await recordMovements(movements);
}

/**
 * Record local buy (shop supermarket purchase)
 */
export async function recordLocalBuy(
    taskId: string,
    items: { storeItemId?: string; name: string; quantity: number; unit: string; costPerUnit?: number }[],
    performedBy?: string
): Promise<void> {
    const movements: MovementRecord[] = items.map(item => ({
        ingredientId: item.storeItemId,
        itemName: item.name,
        locationId: 'shop',
        movementType: 'local_buy',
        quantity: Math.abs(item.quantity),
        unit: item.unit,
        referenceType: 'local_buy_task',
        referenceId: taskId,
        performedBy,
        costPerUnit: item.costPerUnit,
    }));

    await recordMovements(movements);
}

/**
 * Get movement history for an item
 */
export async function getItemMovementHistory(
    ingredientId: string,
    limit: number = 50
): Promise<any[]> {
    const { data, error } = await supabaseAdmin
        .from('inventory_movements')
        .select('*')
        .eq('ingredient_id', ingredientId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        log(`Failed to get movement history: ${error.message}`, 'ledger');
        return [];
    }

    return data || [];
}

/**
 * Get all movements for a reference (e.g., all movements for a specific dispatch)
 */
export async function getMovementsByReference(
    referenceType: string,
    referenceId: string
): Promise<any[]> {
    const { data, error } = await supabaseAdmin
        .from('inventory_movements')
        .select('*')
        .eq('reference_type', referenceType)
        .eq('reference_id', referenceId)
        .order('created_at', { ascending: true });

    if (error) {
        log(`Failed to get movements by reference: ${error.message}`, 'ledger');
        return [];
    }

    return data || [];
}

/**
 * Calculate current stock from ledger (sum of all movements)
 */
export async function calculateStockFromLedger(
    ingredientId: string,
    locationId?: string
): Promise<number> {
    let query = supabaseAdmin
        .from('inventory_movements')
        .select('quantity')
        .eq('ingredient_id', ingredientId);

    if (locationId) {
        query = query.eq('location_id', locationId);
    }

    const { data, error } = await query;

    if (error) {
        log(`Failed to calculate stock from ledger: ${error.message}`, 'ledger');
        return 0;
    }

    return (data || []).reduce((sum, row) => sum + (row.quantity || 0), 0);
}
