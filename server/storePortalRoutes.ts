/**
 * Store Portal Routes
 * Execution-only: Buy, Cross-dock, Process, Pack, Dispatch
 * Store staff never see expected values, variances, or analytics
 */

import { Router } from 'express';
import { supabaseAdmin } from './supabase';
import { log } from './index';
import { z } from 'zod';
import { recordPurchaseAdditions, recordDispatch } from './ledgerService';

const router = Router();

// ============================================================================
// TO BUY QUEUE (Approved Purchase Requests)
// ============================================================================

// Get approved PRs for execution
router.get('/queue/to-buy', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('purchase_requests')
            .select(`
        *,
        items:purchase_request_items(*)
      `)
            .eq('status', 'approved')
            .order('approved_at', { ascending: true });

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        log(`Error fetching to-buy queue: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch purchase queue' });
    }
});

// Execute purchase against approved PR
router.post('/purchases/execute', async (req, res) => {
    try {
        const schema = z.object({
            prId: z.string().uuid(),
            executedBy: z.string(),
            items: z.array(z.object({
                prItemId: z.string().uuid(),
                receivedQty: z.number(),
                actualCost: z.number().optional(),
                notes: z.string().optional(),
            })),
            evidenceUrl: z.string().optional(),
            notes: z.string().optional(),
        });

        const data = schema.parse(req.body);

        // Update each PR item with received quantities
        for (const item of data.items) {
            const { error } = await supabaseAdmin
                .from('purchase_request_items')
                .update({
                    received_qty: item.receivedQty,
                    actual_cost: item.actualCost,
                    notes: item.notes,
                })
                .eq('id', item.prItemId);

            if (error) throw error;
        }

        // Calculate total actual cost
        const totalActual = data.items.reduce((sum, i) => sum + (i.actualCost || 0), 0);

        // Update PR status
        const { error: prError } = await supabaseAdmin
            .from('purchase_requests')
            .update({
                status: 'completed',
                total_actual: totalActual,
                notes: data.notes,
            })
            .eq('id', data.prId);

        if (prError) throw prError;

        // Save evidence if provided
        if (data.evidenceUrl) {
            await supabaseAdmin.from('evidence_attachments').insert({
                record_type: 'purchase',
                record_id: data.prId,
                file_url: data.evidenceUrl,
                uploaded_by: data.executedBy,
            });
        }

        // Update store stock for each received item and record in ledger
        const ledgerItems: { storeItemId?: string; name: string; quantity: number; unit: string; costPerUnit?: number }[] = [];

        for (const item of data.items) {
            const { data: prItem } = await supabaseAdmin
                .from('purchase_request_items')
                .select('store_item_id, item_name, unit')
                .eq('id', item.prItemId)
                .single();

            if (prItem && item.receivedQty > 0) {
                // Update stock
                if (prItem.store_item_id) {
                    await supabaseAdmin.rpc('increment_stock', {
                        item_id: prItem.store_item_id,
                        qty: item.receivedQty,
                    });
                }

                // Prepare ledger entry
                ledgerItems.push({
                    storeItemId: prItem.store_item_id,
                    name: prItem.item_name,
                    quantity: item.receivedQty,
                    unit: prItem.unit || 'units',
                    costPerUnit: item.actualCost ? item.actualCost / item.receivedQty : undefined,
                });
            }
        }

        // Record in ledger
        if (ledgerItems.length > 0) {
            await recordPurchaseAdditions(data.prId, ledgerItems, data.executedBy);
        }

        res.json({ success: true, prId: data.prId });
    } catch (error: any) {
        log(`Error executing purchase: ${error.message}`);
        res.status(500).json({ message: 'Failed to execute purchase' });
    }
});

// ============================================================================
// TO DISPATCH QUEUE (Approved SRRs)
// ============================================================================

// Get approved SRRs for dispatch
router.get('/queue/to-dispatch', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('shop_replenishment_requests')
            .select(`
        *,
        items:srr_items(*)
      `)
            .in('status', ['approved', 'picking'])
            .order('approved_at', { ascending: true });

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        log(`Error fetching dispatch queue: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch dispatch queue' });
    }
});

// Create dispatch from SRR
router.post('/dispatches/from-srr', async (req, res) => {
    try {
        const schema = z.object({
            srrId: z.string().uuid(),
            sentBy: z.string(),
            items: z.array(z.object({
                srrItemId: z.string().uuid(),
                pickedQty: z.number(),
                notes: z.string().optional(),
            })),
            sealCode: z.string().optional(),
            packingPhotoUrl: z.string().optional(),
            notes: z.string().optional(),
        });

        const data = schema.parse(req.body);

        // Update each SRR item with picked quantities
        for (const item of data.items) {
            const { error } = await supabaseAdmin
                .from('srr_items')
                .update({
                    picked_qty: item.pickedQty,
                    notes: item.notes,
                })
                .eq('id', item.srrItemId);

            if (error) throw error;
        }

        // Create store despatch record (using existing table)
        const { data: despatch, error: despatchError } = await supabaseAdmin
            .from('store_despatches')
            .insert({
                destination: 'Shop',
                status: 'in_transit',
                total_items: data.items.length,
                sent_by: data.sentBy,
                notes: data.notes,
            })
            .select()
            .single();

        if (despatchError) throw despatchError;

        // Update SRR status
        await supabaseAdmin
            .from('shop_replenishment_requests')
            .update({ status: 'dispatched' })
            .eq('id', data.srrId);

        // Save packing photo if provided
        if (data.packingPhotoUrl) {
            await supabaseAdmin.from('evidence_attachments').insert({
                record_type: 'dispatch',
                record_id: despatch.id,
                file_url: data.packingPhotoUrl,
                uploaded_by: data.sentBy,
                notes: data.sealCode ? `Seal: ${data.sealCode}` : null,
            });
        }

        res.json({ success: true, despatchId: despatch.id });
    } catch (error: any) {
        log(`Error creating dispatch from SRR: ${error.message}`);
        res.status(500).json({ message: 'Failed to create dispatch' });
    }
});

// ============================================================================
// CROSS-DOCK QUEUE (Trade goods - no processing)
// ============================================================================

// Get items that are trade goods (handling_type = 'trade_good')
router.get('/queue/crossdock', async (req, res) => {
    try {
        // Get store items marked as trade goods (direct receive->dispatch)
        const { data, error } = await supabaseAdmin
            .from('store_items')
            .select('*')
            .eq('is_active', true)
            .eq('category', 'trade_good'); // Using category field for now

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        log(`Error fetching crossdock queue: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch cross-dock queue' });
    }
});

// Receive cross-dock item (direct to stock, ready for dispatch)
router.post('/crossdock/receive', async (req, res) => {
    try {
        const schema = z.object({
            storeItemId: z.string().uuid(),
            quantity: z.number(),
            receivedBy: z.string(),
            notes: z.string().optional(),
        });

        const data = schema.parse(req.body);

        // Update stock directly
        const { error } = await supabaseAdmin.rpc('increment_stock', {
            item_id: data.storeItemId,
            qty: data.quantity,
        });

        if (error) {
            // Fallback if RPC doesn't exist - direct update
            const { data: item } = await supabaseAdmin
                .from('store_items')
                .select('current_stock')
                .eq('id', data.storeItemId)
                .single();

            if (item) {
                await supabaseAdmin
                    .from('store_items')
                    .update({
                        current_stock: Number(item.current_stock) + data.quantity,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', data.storeItemId);
            }
        }

        res.json({ success: true });
    } catch (error: any) {
        log(`Error receiving crossdock: ${error.message}`);
        res.status(500).json({ message: 'Failed to receive cross-dock item' });
    }
});

// ============================================================================
// PRODUCTION QUEUE (Process + Pack batches)
// ============================================================================

// Get items pending processing
router.get('/queue/production', async (req, res) => {
    try {
        // Get purchase items that haven't been fully processed
        const { data, error } = await supabaseAdmin
            .from('store_purchase_items')
            .select(`
        *,
        purchase:store_purchases(*)
      `)
            .neq('status', 'fully_processed')
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Filter items that have remaining quantity
        const pending = (data || []).filter(item => {
            const qty = Number(item.quantity) || 0;
            const processed = Number(item.quantity_processed) || 0;
            return qty > processed;
        });

        res.json(pending);
    } catch (error: any) {
        log(`Error fetching production queue: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch production queue' });
    }
});

// Get items ready for dispatch (processed)
router.get('/queue/ready', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('store_processed_items')
            .select('*')
            .eq('status', 'ready')
            .order('processed_at', { ascending: true });

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        log(`Error fetching ready items: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch ready items' });
    }
});

// ============================================================================
// EXCEPTIONS
// ============================================================================

router.get('/exceptions', async (req, res) => {
    try {
        const exceptions: any[] = [];

        // Short buys (PR items where received < approved)
        const { data: shortBuys } = await supabaseAdmin
            .from('purchase_request_items')
            .select(`
        *,
        pr:purchase_requests(*)
      `)
            .not('received_qty', 'is', null)
            .filter('received_qty', 'lt', 'approved_qty');

        if (shortBuys) {
            for (const item of shortBuys) {
                if ((Number(item.received_qty) || 0) < (Number(item.approved_qty) || 0)) {
                    exceptions.push({
                        type: 'short_buy',
                        item: item,
                        message: `Short buy: ${item.item_name} - received ${item.received_qty}, approved ${item.approved_qty}`,
                    });
                }
            }
        }

        // Overdue dispatches (SRRs approved but not dispatched for >24h)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const { data: overdueDispatches } = await supabaseAdmin
            .from('shop_replenishment_requests')
            .select('*')
            .eq('status', 'approved')
            .lt('approved_at', yesterday.toISOString());

        if (overdueDispatches) {
            for (const srr of overdueDispatches) {
                exceptions.push({
                    type: 'overdue_dispatch',
                    item: srr,
                    message: `Overdue dispatch: SRR #${srr.id.slice(-6)} approved but not dispatched`,
                });
            }
        }

        res.json(exceptions);
    } catch (error: any) {
        log(`Error fetching exceptions: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch exceptions' });
    }
});

// ============================================================================
// CREATE PURCHASE REQUEST (From Partner Insights / PAR suggestions)
// ============================================================================

router.post('/purchase-requests', async (req, res) => {
    try {
        const schema = z.object({
            requestedBy: z.string(),
            items: z.array(z.object({
                itemName: z.string(),
                requestedQty: z.number(),
                unit: z.string().optional(),
                estimatedCost: z.number().optional(),
                notes: z.string().optional(),
            })),
            notes: z.string().optional(),
            priority: z.enum(['normal', 'urgent']).optional(),
        });

        const data = schema.parse(req.body);

        // Create the purchase request
        const { data: pr, error: prError } = await supabaseAdmin
            .from('purchase_requests')
            .insert({
                requested_by: data.requestedBy,
                notes: data.notes,
                status: 'pending',
            })
            .select()
            .single();

        if (prError) throw prError;

        // Create items
        const itemInserts = data.items.map(item => ({
            pr_id: pr.id,
            item_name: item.itemName,
            requested_qty: item.requestedQty,
            unit: item.unit || 'units',
            estimated_cost: item.estimatedCost,
            notes: item.notes,
        }));

        const { error: itemsError } = await supabaseAdmin
            .from('purchase_request_items')
            .insert(itemInserts);

        if (itemsError) throw itemsError;

        log(`Purchase request created: ${pr.id} with ${data.items.length} items by ${data.requestedBy}`);

        res.json({
            success: true,
            prId: pr.id,
            itemCount: data.items.length,
        });
    } catch (error: any) {
        log(`Error creating purchase request: ${error.message}`);
        res.status(500).json({ message: 'Failed to create purchase request' });
    }
});

export default router;
