/**
 * Partner Portal Routes
 * Full access: Approvals, Reconciliation, Staff, Business Finances, Alerts
 * Partner is the only role that sees expected values, variances, and POS totals
 */

import { Router } from 'express';
import { supabaseAdmin } from './supabase';
import { log } from './index';
import { z } from 'zod';
import { getPosterPOSClient, isPosterPOSInitialized } from './posterpos';

const router = Router();

// ============================================================================
// APPROVALS INBOX (Unified)
// ============================================================================

// Get all pending approvals (PRs + SRRs + adjustments)
router.get('/approvals', async (req, res) => {
    try {
        const approvals: any[] = [];

        // Pending Purchase Requests
        const { data: prs } = await supabaseAdmin
            .from('purchase_requests')
            .select(`
        *,
        items:purchase_request_items(*)
      `)
            .eq('status', 'pending')
            .order('requested_at', { ascending: false });

        if (prs) {
            for (const pr of prs) {
                approvals.push({
                    type: 'purchase_request',
                    id: pr.id,
                    data: pr,
                    requestedBy: pr.requested_by,
                    requestedAt: pr.requested_at,
                    priority: 'normal',
                    itemCount: pr.items?.length || 0,
                });
            }
        }

        // Pending Shop Replenishment Requests
        const { data: srrs } = await supabaseAdmin
            .from('shop_replenishment_requests')
            .select(`
        *,
        items:srr_items(*)
      `)
            .eq('status', 'pending')
            .order('requested_at', { ascending: false });

        if (srrs) {
            for (const srr of srrs) {
                approvals.push({
                    type: 'replenishment_request',
                    id: srr.id,
                    data: srr,
                    requestedBy: srr.requested_by,
                    requestedAt: srr.requested_at,
                    priority: srr.priority,
                    itemCount: srr.items?.length || 0,
                });
            }
        }

        // Sort by date, oldest first
        approvals.sort((a, b) =>
            new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime()
        );

        res.json(approvals);
    } catch (error: any) {
        log(`Error fetching approvals: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch approvals' });
    }
});

// Approve a request
router.post('/approve/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const schema = z.object({
            approvedBy: z.string(),
            adjustments: z.array(z.object({
                itemId: z.string().uuid(),
                approvedQty: z.number(),
                notes: z.string().optional(),
            })).optional(),
            notes: z.string().optional(),
        });

        const data = schema.parse(req.body);

        if (type === 'purchase_request') {
            // Apply item adjustments if any
            if (data.adjustments) {
                for (const adj of data.adjustments) {
                    await supabaseAdmin
                        .from('purchase_request_items')
                        .update({
                            approved_qty: adj.approvedQty,
                            notes: adj.notes,
                        })
                        .eq('id', adj.itemId);
                }
            } else {
                // Auto-approve all items at requested qty - fetch first then update
                const { data: prItems } = await supabaseAdmin
                    .from('purchase_request_items')
                    .select('id, requested_qty')
                    .eq('pr_id', id);

                if (prItems) {
                    for (const item of prItems) {
                        await supabaseAdmin
                            .from('purchase_request_items')
                            .update({ approved_qty: item.requested_qty })
                            .eq('id', item.id);
                    }
                }
            }

            // Update PR status
            await supabaseAdmin
                .from('purchase_requests')
                .update({
                    status: 'approved',
                    approved_by: data.approvedBy,
                    approved_at: new Date().toISOString(),
                    notes: data.notes,
                })
                .eq('id', id);

        } else if (type === 'replenishment_request') {
            // Apply item adjustments if any
            if (data.adjustments) {
                for (const adj of data.adjustments) {
                    await supabaseAdmin
                        .from('srr_items')
                        .update({
                            approved_qty: adj.approvedQty,
                            notes: adj.notes,
                        })
                        .eq('id', adj.itemId);
                }
            } else {
                // Auto-approve all items at requested qty - fetch first then update
                const { data: srrItems } = await supabaseAdmin
                    .from('srr_items')
                    .select('id, requested_qty')
                    .eq('srr_id', id);

                if (srrItems) {
                    for (const item of srrItems) {
                        await supabaseAdmin
                            .from('srr_items')
                            .update({ approved_qty: item.requested_qty })
                            .eq('id', item.id);
                    }
                }
            }

            await supabaseAdmin
                .from('shop_replenishment_requests')
                .update({
                    status: 'approved',
                    approved_by: data.approvedBy,
                    approved_at: new Date().toISOString(),
                })
                .eq('id', id);
        } else {
            return res.status(400).json({ message: 'Invalid request type' });
        }

        res.json({ success: true });
    } catch (error: any) {
        log(`Error approving request: ${error.message}`);
        res.status(500).json({ message: 'Failed to approve request' });
    }
});

// Reject a request
router.post('/reject/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const schema = z.object({
            rejectedBy: z.string(),
            reason: z.string(),
        });

        const data = schema.parse(req.body);

        const table = type === 'purchase_request'
            ? 'purchase_requests'
            : 'shop_replenishment_requests';

        const { error } = await supabaseAdmin
            .from(table)
            .update({
                status: 'rejected',
                rejection_reason: data.reason,
            })
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true });
    } catch (error: any) {
        log(`Error rejecting request: ${error.message}`);
        res.status(500).json({ message: 'Failed to reject request' });
    }
});

// ============================================================================
// RECONCILIATION (Partner-only views)
// ============================================================================

// Get stock reconciliation with variances
router.get('/reconciliation/stock', async (req, res) => {
    try {
        const { data: recon, error } = await supabaseAdmin
            .from('stock_reconciliations')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (!recon) {
            return res.json({
                date: new Date().toISOString(),
                variances: [],
                summary: {
                    totalItems: 0,
                    overItems: 0,
                    underItems: 0,
                    matchedItems: 0,
                    totalVarianceValue: 0,
                },
            });
        }

        // Get detailed entries for both sessions
        const [openingEntries, closingEntries] = await Promise.all([
            supabaseAdmin
                .from('shop_stock_entries')
                .select('*')
                .eq('session_id', recon.opening_session_id),
            supabaseAdmin
                .from('shop_stock_entries')
                .select('*')
                .eq('session_id', recon.closing_session_id),
        ]);

        // Build variance details
        const openingMap = new Map(
            (openingEntries.data || []).map(e => [e.item_name, { qty: Number(e.quantity), id: e.item_id }])
        );
        const closingMap = new Map(
            (closingEntries.data || []).map(e => [e.item_name, { qty: Number(e.quantity), id: e.item_id }])
        );

        const allItems = new Set([
            ...Array.from(openingMap.keys()),
            ...Array.from(closingMap.keys()),
        ]);

        const variances = Array.from(allItems).map(itemName => {
            const openingData = openingMap.get(itemName) || { qty: 0, id: null };
            const closingData = closingMap.get(itemName) || { qty: 0, id: null };
            const opening = openingData.qty;
            const closing = closingData.qty;

            // Simple variance calculation (in production, you'd factor in sales, dispatches, wastage)
            const expected = opening; // Simplified - would normally factor in movements
            const actual = closing;
            const variance = actual - expected;
            const variancePercent = expected > 0 ? Math.round((variance / expected) * 100) : 0;

            return {
                itemId: openingData.id || closingData.id || itemName,
                itemName,
                opening,
                closing,
                sold: 0, // Would come from POS data
                dispatched: 0, // Would come from dispatch records
                wastage: 0, // Would come from wastage entries
                expected,
                actual,
                variance,
                variancePercent,
                status: variance > 0 ? 'over' : variance < 0 ? 'under' : 'ok',
            };
        });

        // Sort by absolute variance (largest first)
        variances.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

        res.json({
            date: recon.date || recon.created_at,
            variances,
            summary: {
                totalItems: variances.length,
                overItems: variances.filter(d => d.status === 'over').length,
                underItems: variances.filter(d => d.status === 'under').length,
                matchedItems: variances.filter(d => d.status === 'ok').length,
                totalVarianceValue: variances.reduce((sum, v) => sum + Math.abs(v.variance), 0),
            },
        });
    } catch (error: any) {
        log(`Error fetching stock reconciliation: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch stock reconciliation' });
    }
});

// Get cash reconciliation (POS totals vs declared)
router.get('/reconciliation/cash', async (req, res) => {
    try {
        const { from, to } = req.query;

        // Default to today
        const today = new Date();
        const dateFrom = from || today.toISOString().split('T')[0].replace(/-/g, '');
        const dateTo = to || today.toISOString().split('T')[0].replace(/-/g, '');

        // Get POS totals (Partner can see this)
        let posTotals = { cash: 0, card: 0, total: 0 };

        if (isPosterPOSInitialized()) {
            const client = getPosterPOSClient();
            const transactions = await client.getTransactions({
                dateFrom: dateFrom as string,
                dateTo: dateTo as string
            });

            for (const tx of transactions) {
                const payedCash = parseFloat(tx.payed_cash || '0') / 100;
                const payedCard = parseFloat(tx.payed_card || '0') / 100;
                posTotals.cash += payedCash;
                posTotals.card += payedCard;
            }
            posTotals.total = posTotals.cash + posTotals.card;
        }

        // Get declared cash from shifts
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);

        const { data: shifts } = await supabaseAdmin
            .from('shifts')
            .select('*')
            .gte('opened_at', startOfDay.toISOString())
            .eq('status', 'closed');

        let declaredCash = 0;
        let openingFloats = 0;

        if (shifts) {
            for (const shift of shifts) {
                declaredCash += Number(shift.closing_cash) || 0;
                openingFloats += Number(shift.opening_float) || 0;
            }
        }

        // Get expenses
        const { data: expenses } = await supabaseAdmin
            .from('shop_expenses')
            .select('amount')
            .gte('created_at', startOfDay.toISOString());

        const totalExpenses = (expenses || []).reduce(
            (sum, e) => sum + Number(e.amount), 0
        );

        // Calculate variance
        // Expected cash = Opening float + POS cash sales - Expenses
        const expectedCash = openingFloats + posTotals.cash - totalExpenses;
        const variance = declaredCash - expectedCash;
        const variancePercent = expectedCash > 0 ? Math.round((variance / expectedCash) * 100) : 0;

        // Determine status based on variance threshold (e.g., 2% tolerance)
        let varianceStatus: 'ok' | 'warning' | 'critical' = 'ok';
        if (Math.abs(variancePercent) > 5) {
            varianceStatus = 'critical';
        } else if (Math.abs(variancePercent) > 2) {
            varianceStatus = 'warning';
        }

        // Build shifts with variance per shift
        const shiftDetails = (shifts || []).map(shift => ({
            id: shift.id,
            staffName: shift.opened_by || 'Unknown',
            openedAt: shift.opened_at,
            closedAt: shift.closed_at,
            openingFloat: Number(shift.opening_float) || 0,
            closingCash: Number(shift.closing_cash) || 0,
            posSales: 0, // Would need to calculate per shift from POS data
            variance: 0, // Would calculate per shift
        }));

        res.json({
            date: today.toISOString().split('T')[0],
            pos: {
                ...posTotals,
                transactions: 0, // Would come from transaction count
            },
            declared: declaredCash,
            openingFloat: openingFloats,
            closingCash: declaredCash,
            expenses: totalExpenses,
            variance: {
                amount: Math.round(variance),
                percent: variancePercent,
                status: varianceStatus,
            },
            shifts: shiftDetails,
        });
    } catch (error: any) {
        log(`Error fetching cash reconciliation: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch cash reconciliation' });
    }
});

// ============================================================================
// STAFF MANAGEMENT
// ============================================================================

router.get('/staff', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('staff')
            .select('*')
            .order('name');

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        log(`Error fetching staff: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch staff' });
    }
});

router.post('/staff', async (req, res) => {
    try {
        const schema = z.object({
            name: z.string(),
            role: z.enum(['store', 'shop', 'partner']),
            phone: z.string().optional(),
            telegramUserId: z.string().optional(),
        });

        const data = schema.parse(req.body);

        const { data: staff, error } = await supabaseAdmin
            .from('staff')
            .insert({
                name: data.name,
                role: data.role,
                phone: data.phone,
                telegram_user_id: data.telegramUserId,
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(staff);
    } catch (error: any) {
        log(`Error creating staff: ${error.message}`);
        res.status(500).json({ message: 'Failed to create staff' });
    }
});

router.patch('/staff/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data: staff, error } = await supabaseAdmin
            .from('staff')
            .update(req.body)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(staff);
    } catch (error: any) {
        log(`Error updating staff: ${error.message}`);
        res.status(500).json({ message: 'Failed to update staff' });
    }
});

// Get staff activity
router.get('/staff/:id/activity', async (req, res) => {
    try {
        const { id } = req.params;

        // Get staff member
        const { data: staff } = await supabaseAdmin
            .from('staff')
            .select('*')
            .eq('id', id)
            .single();

        if (!staff) {
            return res.status(404).json({ message: 'Staff not found' });
        }

        // Get recent shifts
        const { data: shifts } = await supabaseAdmin
            .from('shifts')
            .select('*')
            .contains('staff_on_duty', [staff.name])
            .order('opened_at', { ascending: false })
            .limit(20);

        // Get recent expenses
        const { data: expenses } = await supabaseAdmin
            .from('shop_expenses')
            .select('*')
            .eq('paid_by', staff.name)
            .order('created_at', { ascending: false })
            .limit(20);

        res.json({
            staff,
            recentShifts: shifts || [],
            recentExpenses: expenses || [],
        });
    } catch (error: any) {
        log(`Error fetching staff activity: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch staff activity' });
    }
});

// ============================================================================
// FLAGGED SHIFTS
// ============================================================================

router.get('/shifts/flagged', async (req, res) => {
    try {
        const days = Number(req.query.days) || 14;
        const since = new Date();
        since.setDate(since.getDate() - days);

        const { data, error } = await supabaseAdmin
            .from('shifts')
            .select('*')
            .eq('flagged', true)
            .gte('opened_at', since.toISOString())
            .order('opened_at', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        log(`Error fetching flagged shifts: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch flagged shifts' });
    }
});

// Review a flagged shift
router.post('/shifts/:id/review', async (req, res) => {
    try {
        const { id } = req.params;
        const schema = z.object({
            reviewedBy: z.string(),
            clearFlag: z.boolean().default(false),
            notes: z.string().optional(),
        });

        const data = schema.parse(req.body);

        const { error } = await supabaseAdmin
            .from('shifts')
            .update({
                flagged: data.clearFlag ? false : true,
                reviewed_by: data.reviewedBy,
                reviewed_at: new Date().toISOString(),
                flag_reason: data.notes || null,
            })
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error: any) {
        log(`Error reviewing shift: ${error.message}`);
        res.status(500).json({ message: 'Failed to review shift' });
    }
});

// ============================================================================
// ALERTS
// ============================================================================

router.get('/alerts', async (req, res) => {
    try {
        const alerts: any[] = [];

        // Overdue dispatch receipts (>24h in transit)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const { data: overdueDispatches } = await supabaseAdmin
            .from('store_despatches')
            .select('*')
            .eq('status', 'in_transit')
            .lt('despatch_date', yesterday.toISOString());

        if (overdueDispatches) {
            for (const d of overdueDispatches) {
                alerts.push({
                    type: 'overdue_dispatch',
                    severity: 'warning',
                    message: `Dispatch #${d.id.slice(-6)} in transit for >24h`,
                    data: d,
                });
            }
        }

        // Flagged shifts
        const { data: flaggedShifts } = await supabaseAdmin
            .from('shifts')
            .select('*')
            .eq('flagged', true)
            .is('reviewed_at', null);

        if (flaggedShifts) {
            for (const s of flaggedShifts) {
                alerts.push({
                    type: 'flagged_shift',
                    severity: 'warning',
                    message: `Shift on ${new Date(s.opened_at).toLocaleDateString()} flagged for review`,
                    data: s,
                });
            }
        }

        // Low stock items
        const { data: lowStock } = await supabaseAdmin
            .from('store_items')
            .select('*')
            .filter('current_stock', 'lte', 'min_stock');

        if (lowStock) {
            for (const item of lowStock) {
                if (Number(item.current_stock) <= Number(item.min_stock)) {
                    alerts.push({
                        type: 'low_stock',
                        severity: 'info',
                        message: `${item.name} is low (${item.current_stock} ${item.unit})`,
                        data: item,
                    });
                }
            }
        }

        // Pending approvals count
        const [{ count: prCount }, { count: srrCount }] = await Promise.all([
            supabaseAdmin.from('purchase_requests').select('id', { count: 'exact' }).eq('status', 'pending'),
            supabaseAdmin.from('shop_replenishment_requests').select('id', { count: 'exact' }).eq('status', 'pending'),
        ]);

        const pendingCount = (prCount || 0) + (srrCount || 0);
        if (pendingCount > 0) {
            alerts.push({
                type: 'pending_approvals',
                severity: 'info',
                message: `${pendingCount} requests pending approval`,
                data: { prCount, srrCount },
            });
        }

        res.json(alerts);
    } catch (error: any) {
        log(`Error fetching alerts: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch alerts' });
    }
});

// ============================================================================
// LOCAL BUY TASK MANAGEMENT (Partner creates tasks)
// ============================================================================

// Get all local buy tasks
router.get('/local-buy-tasks', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('local_buy_tasks')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        log(`Error fetching local buy tasks: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch local buy tasks' });
    }
});

// Create local buy task
router.post('/local-buy-tasks', async (req, res) => {
    try {
        const schema = z.object({
            itemName: z.string(),
            storeItemId: z.string().uuid().optional(),
            maxQty: z.number().optional(),
            spendCap: z.number(),
            expiresInHours: z.number().default(24),
            notes: z.string().optional(),
            createdBy: z.string().optional(),
        });

        const data = schema.parse(req.body);
        const expiresAt = new Date(Date.now() + data.expiresInHours * 60 * 60 * 1000);

        const { data: task, error } = await supabaseAdmin
            .from('local_buy_tasks')
            .insert({
                item_name: data.itemName,
                store_item_id: data.storeItemId,
                max_qty: data.maxQty,
                spend_cap: data.spendCap,
                expires_at: expiresAt.toISOString(),
                created_by: data.createdBy || 'Partner',
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(task);
    } catch (error: any) {
        log(`Error creating local buy task: ${error.message}`);
        res.status(500).json({ message: 'Failed to create local buy task' });
    }
});

// Cancel local buy task
router.post('/local-buy-tasks/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('local_buy_tasks')
            .update({ status: 'cancelled' })
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error: any) {
        log(`Error cancelling local buy task: ${error.message}`);
        res.status(500).json({ message: 'Failed to cancel task' });
    }
});

// ============================================================================
// ITEMS MANAGEMENT (CRUD for store_items)
// ============================================================================

// Get all items
router.get('/items', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('store_items')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        log(`Error fetching items: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch items' });
    }
});

// Create item
router.post('/items', async (req, res) => {
    try {
        const schema = z.object({
            name: z.string(),
            category: z.string().default('general'),
            unit: z.string().default('pcs'),
            min_stock: z.number().default(0),
            current_stock: z.number().default(0),
            cost_per_unit: z.number().optional(),
            bought_by: z.enum(['store', 'shop']).default('store'),
        });

        const data = schema.parse(req.body);

        const { data: item, error } = await supabaseAdmin
            .from('store_items')
            .insert(data)
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(item);
    } catch (error: any) {
        log(`Error creating item: ${error.message}`);
        res.status(500).json({ message: 'Failed to create item' });
    }
});

// Update item
router.put('/items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const schema = z.object({
            name: z.string(),
            category: z.string(),
            unit: z.string(),
            min_stock: z.number(),
            current_stock: z.number(),
            cost_per_unit: z.number().optional(),
            bought_by: z.enum(['store', 'shop']),
        });

        const data = schema.parse(req.body);

        const { data: item, error } = await supabaseAdmin
            .from('store_items')
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(item);
    } catch (error: any) {
        log(`Error updating item: ${error.message}`);
        res.status(500).json({ message: 'Failed to update item' });
    }
});

// Delete item (soft delete)
router.delete('/items/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('store_items')
            .update({ is_active: false })
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error: any) {
        log(`Error deleting item: ${error.message}`);
        res.status(500).json({ message: 'Failed to delete item' });
    }
});

// Import item from PosterPOS
router.post('/items/sync-from-pos', async (req, res) => {
    try {
        const schema = z.object({
            posterPosId: z.number(),
            name: z.string(),
            unit: z.string(),
            currentStock: z.number().default(0),
        });

        const data = schema.parse(req.body);

        const { data: item, error } = await supabaseAdmin
            .from('store_items')
            .insert({
                name: data.name,
                unit: data.unit,
                current_stock: data.currentStock,
                category: 'posterpos',
                bought_by: 'store',
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(item);
    } catch (error: any) {
        log(`Error syncing item from POS: ${error.message}`);
        res.status(500).json({ message: 'Failed to sync item' });
    }
});

// Update item counting requirement
router.patch('/items/:id/counting', async (req, res) => {
    try {
        const { id } = req.params;
        const { requiresCounting } = req.body;

        const { data: item, error } = await supabaseAdmin
            .from('store_items')
            .update({ requires_counting: requiresCounting })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(item);
    } catch (error: any) {
        log(`Error updating item counting req: ${error.message}`);
        res.status(500).json({ message: 'Failed to update item' });
    }
});

export default router;

