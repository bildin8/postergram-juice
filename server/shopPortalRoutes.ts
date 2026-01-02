/**
 * Shop Portal Routes
 * Execution-only: Shifts, Expenses, Receiving, Stock, Local Buys
 * Shop staff never see POS totals, expected values, or variances
 */

import { Router } from 'express';
import { supabaseAdmin } from './supabase';
import { log } from './index';
import { z } from 'zod';

const router = Router();

// ============================================================================
// SHIFT MANAGEMENT
// ============================================================================

// Get current open shift
router.get('/shifts/current', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('shifts')
            .select('*')
            .eq('status', 'open')
            .order('opened_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        res.json(data || null);
    } catch (error: any) {
        log(`Error fetching current shift: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch current shift' });
    }
});

// Open a new shift
router.post('/shifts/open', async (req, res) => {
    try {
        const schema = z.object({
            openedBy: z.string(),
            openingFloat: z.number(),
            staffOnDuty: z.array(z.string()).default([]),
        });

        const data = schema.parse(req.body);

        // Check if there's already an open shift
        const { data: existing } = await supabaseAdmin
            .from('shifts')
            .select('id')
            .eq('status', 'open')
            .limit(1);

        if (existing && existing.length > 0) {
            return res.status(400).json({ message: 'A shift is already open. Close it first.' });
        }

        // Create new shift
        const { data: shift, error } = await supabaseAdmin
            .from('shifts')
            .insert({
                opened_by: data.openedBy,
                opening_float: data.openingFloat,
                staff_on_duty: data.staffOnDuty,
                status: 'open',
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(shift);
    } catch (error: any) {
        log(`Error opening shift: ${error.message}`);
        res.status(500).json({ message: 'Failed to open shift' });
    }
});

// Close current shift
router.post('/shifts/close', async (req, res) => {
    try {
        const schema = z.object({
            closedBy: z.string(),
            closingCash: z.number(),
            closingStockSessionId: z.string().uuid().optional(),
        });

        const data = schema.parse(req.body);

        // Get current open shift
        const { data: currentShift } = await supabaseAdmin
            .from('shifts')
            .select('*')
            .eq('status', 'open')
            .limit(1)
            .single();

        if (!currentShift) {
            return res.status(400).json({ message: 'No open shift to close' });
        }

        // Close the shift
        const { data: closedShift, error } = await supabaseAdmin
            .from('shifts')
            .update({
                status: 'closed',
                closed_at: new Date().toISOString(),
                closed_by: data.closedBy,
                closing_cash: data.closingCash,
                closing_stock_session_id: data.closingStockSessionId,
            })
            .eq('id', currentShift.id)
            .select()
            .single();

        if (error) throw error;

        // Shop sees only "Closed" status, flagging happens internally for Partner
        res.json({
            ...closedShift,
            // Don't expose flag status to shop
            flagged: undefined,
            flag_reason: undefined,
        });
    } catch (error: any) {
        log(`Error closing shift: ${error.message}`);
        res.status(500).json({ message: 'Failed to close shift' });
    }
});

// Get shift history (limited view for shop)
router.get('/shifts/history', async (req, res) => {
    try {
        const limit = Number(req.query.limit) || 10;

        const { data, error } = await supabaseAdmin
            .from('shifts')
            .select(`
        id,
        status,
        opened_at,
        opened_by,
        opening_float,
        staff_on_duty,
        closed_at,
        closed_by,
        closing_cash
      `) // Excludes flagged, flag_reason - Partner only
            .order('opened_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        log(`Error fetching shift history: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch shift history' });
    }
});

// ============================================================================
// CASH HANDOVER
// ============================================================================

router.post('/shifts/handover', async (req, res) => {
    try {
        const schema = z.object({
            totalCash: z.number(),
            float: z.number(),
            handover: z.number(),
            method: z.enum(['physical', 'banking']),
            pin: z.string().optional(),
            mpesaCode: z.string().optional(),
        });

        const data = schema.parse(req.body);

        // 1. Validation
        if (data.method === 'physical') {
            const secretPin = process.env.APP_PIN || "1234";
            if (data.pin !== secretPin) {
                return res.status(401).json({ message: "Invalid Owner PIN" });
            }
        } else {
            if (!data.mpesaCode) {
                return res.status(400).json({ message: "M-Pesa Code required" });
            }
        }

        // 2. Log Handover (Update Current Open Shift)
        const { data: shift } = await supabaseAdmin
            .from('shifts')
            .select('id')
            .eq('status', 'open')
            .single();

        if (shift) {
            await supabaseAdmin
                .from('shifts')
                .update({
                    handover_amount: data.handover,
                    handover_method: data.method,
                    handover_ref: data.method === 'physical' ? 'Physical Signature' : data.mpesaCode
                })
                .eq('id', shift.id);
        } else {
            // If no open shift, maybe log to audit stream only? 
            // But Handover is usually PART of the shift flow.
            // We'll proceed but warn.
        }

        res.json({ success: true, message: "Handover recorded successfully" });
    } catch (error: any) {
        log(`Error recording handover: ${error.message}`);
        res.status(500).json({ message: 'Failed to record handover' });
    }
});

// ============================================================================
// SHIFT-GATED MIDDLEWARE HELPER
// ============================================================================


async function requireOpenShift(req: any, res: any, next: any) {
    try {
        const { data: shift } = await supabaseAdmin
            .from('shifts')
            .select('id')
            .eq('status', 'open')
            .limit(1)
            .single();

        if (!shift) {
            return res.status(403).json({
                message: 'No open shift. Please open a shift first.',
                code: 'SHIFT_REQUIRED'
            });
        }

        req.currentShiftId = shift.id;
        next();
    } catch (error) {
        return res.status(403).json({
            message: 'No open shift. Please open a shift first.',
            code: 'SHIFT_REQUIRED'
        });
    }
}

// ============================================================================
// LOCAL BUY TASKS (System-authorized supermarket purchases)
// ============================================================================

// Get pending local buy tasks
router.get('/local-buy-tasks', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('local_buy_tasks')
            .select('*')
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: true });

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        log(`Error fetching local buy tasks: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch local buy tasks' });
    }
});

// Execute a local buy task
router.post('/local-buy-tasks/:id/execute', requireOpenShift, async (req, res) => {
    try {
        const { id } = req.params;
        const schema = z.object({
            executedBy: z.string(),
            actualQty: z.number(),
            actualAmount: z.number(),
            receiptPhotoUrl: z.string().optional(),
            notes: z.string().optional(),
        });

        const data = schema.parse(req.body);
        const shiftId = (req as any).currentShiftId;

        // Get the task
        const { data: task, error: taskError } = await supabaseAdmin
            .from('local_buy_tasks')
            .select('*')
            .eq('id', id)
            .single();

        if (taskError || !task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        if (task.status !== 'pending') {
            return res.status(400).json({ message: 'Task already executed or cancelled' });
        }

        // Validate against caps if set
        if (task.max_qty && data.actualQty > task.max_qty) {
            return res.status(400).json({
                message: `Quantity ${data.actualQty} exceeds max allowed ${task.max_qty}`
            });
        }

        if (task.spend_cap && data.actualAmount > task.spend_cap) {
            return res.status(400).json({
                message: `Amount ${data.actualAmount} exceeds spend cap ${task.spend_cap}`
            });
        }

        // Create expense entry (auto-linked)
        const { data: expense, error: expenseError } = await supabaseAdmin
            .from('shop_expenses')
            .insert({
                expense_type: 'supermarket',
                description: `Local buy: ${task.item_name}`,
                amount: data.actualAmount,
                paid_by: data.executedBy,
                notes: data.notes,
                shift_id: shiftId,
            })
            .select()
            .single();

        if (expenseError) throw expenseError;

        // Update task status
        const { error: updateError } = await supabaseAdmin
            .from('local_buy_tasks')
            .update({
                status: 'executed',
                executed_at: new Date().toISOString(),
                executed_by: data.executedBy,
                actual_qty: data.actualQty,
                actual_amount: data.actualAmount,
                receipt_photo_url: data.receiptPhotoUrl,
                expense_id: expense.id,
                shift_id: shiftId,
            })
            .eq('id', id);

        if (updateError) throw updateError;

        res.json({ success: true, expenseId: expense.id });
    } catch (error: any) {
        log(`Error executing local buy: ${error.message}`);
        res.status(500).json({ message: 'Failed to execute local buy' });
    }
});

// ============================================================================
// EXPENSES (Enhanced with shift linking)
// ============================================================================

// Create expense - requires open shift
router.post('/expenses/with-shift', requireOpenShift, async (req, res) => {
    try {
        const schema = z.object({
            expenseType: z.enum(['supermarket', 'petty_cash']),
            category: z.string().optional(),
            description: z.string(),
            amount: z.number(),
            paidBy: z.string(),
            paidTo: z.string().optional(),
            receiptNumber: z.string().optional(),
            notes: z.string().optional(),
            evidenceUrl: z.string().optional(),
            items: z.array(z.object({
                itemName: z.string(),
                quantity: z.number(),
                unit: z.string().default('units'),
                costPerUnit: z.number().optional(),
            })).optional(),
        });

        const data = schema.parse(req.body);
        const shiftId = (req as any).currentShiftId;

        // 1. Fetch Financial Controls
        const { data: settings } = await supabaseAdmin
            .from('op_settings')
            .select('setting_value')
            .eq('setting_key', 'financial_controls')
            .single();

        const finControls = settings?.setting_value || {};
        const threshold = finControls.receipt_required_threshold || 1000;

        // Internal Control: Mandatory Evidence > threshold
        if (data.amount > threshold && !data.evidenceUrl) {
            return res.status(400).json({
                message: `Mandatory Receipt Evidence required for amounts over KES ${threshold.toLocaleString()}`
            });
        }

        // Create expense linked to shift
        const { data: expense, error } = await supabaseAdmin
            .from('shop_expenses')
            .insert({
                expense_type: data.expenseType,
                category: data.category,
                description: data.description,
                amount: data.amount,
                paid_by: data.paidBy,
                paid_to: data.paidTo,
                receipt_number: data.receiptNumber,
                notes: data.notes,
                shift_id: shiftId,
            })
            .select()
            .single();

        if (error) throw error;

        // Save evidence if provided
        if (data.evidenceUrl) {
            await supabaseAdmin.from('evidence_attachments').insert({
                record_type: 'expense',
                record_id: expense.id,
                file_url: data.evidenceUrl,
                uploaded_by: data.paidBy,
                notes: 'Mandatory evidence'
            });
        }

        // Add items if supermarket expense
        if (data.expenseType === 'supermarket' && data.items) {
            for (const item of data.items) {
                await supabaseAdmin.from('expense_items').insert({
                    expense_id: expense.id,
                    item_name: item.itemName,
                    quantity: item.quantity,
                    unit: item.unit,
                    cost_per_unit: item.costPerUnit,
                });
            }
        }

        res.status(201).json(expense);
    } catch (error: any) {
        log(`Error creating expense: ${error.message}`);
        res.status(500).json({ message: 'Failed to create expense' });
    }
});

// Simple expense creation endpoint (auto-links to open shift if available)
router.post('/expenses', async (req, res) => {
    try {
        const schema = z.object({
            type: z.enum(['supermarket', 'petty_cash']),
            items: z.array(z.object({
                description: z.string(),
                amount: z.number(),
            })).optional(),
            category: z.string().optional(),
            description: z.string().optional(),
            amount: z.number().optional(),
            notes: z.string().optional(),
            recordedBy: z.string(),
        });

        const data = schema.parse(req.body);

        // Get open shift if any
        const { data: shift } = await supabaseAdmin
            .from('shifts')
            .select('id')
            .eq('status', 'open')
            .limit(1)
            .single();

        // Calculate total amount
        let totalAmount = data.amount || 0;
        let description = data.description || '';

        if (data.type === 'supermarket' && data.items) {
            totalAmount = data.items.reduce((sum, item) => sum + (item.amount || 0), 0);
            description = data.items.map(i => i.description).filter(Boolean).join(', ');
        }

        // Create expense
        const { data: expense, error } = await supabaseAdmin
            .from('shop_expenses')
            .insert({
                expense_type: data.type,
                category: data.category,
                description: description || data.type,
                amount: totalAmount,
                paid_by: data.recordedBy,
                notes: data.notes,
                shift_id: shift?.id || null,
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(expense);
    } catch (error: any) {
        log(`Error creating expense: ${error.message}`);
        res.status(500).json({ message: 'Failed to create expense' });
    }
});

// Get today's expenses
router.get('/expenses/today', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data, error } = await supabaseAdmin
            .from('shop_expenses')
            .select('*')
            .gte('created_at', today.toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        log(`Error fetching today's expenses: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch expenses' });
    }
});

// ============================================================================
// RECEIVE DISPATCH (Enhanced)
// ============================================================================

// Get pending dispatches for shop
router.get('/pending-dispatches', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('store_despatches')
            .select(`
        *,
        items:store_despatch_items(*)
      `)
            .eq('status', 'in_transit')
            .order('despatch_date', { ascending: true });

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        log(`Error fetching pending dispatches: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch pending dispatches' });
    }
});

// Confirm dispatch receipt
router.post('/dispatches/:id/confirm', requireOpenShift, async (req, res) => {
    try {
        const { id } = req.params;
        const schema = z.object({
            receivedBy: z.string().optional(),
            confirmedBy: z.string().optional(),
            items: z.array(z.object({
                itemId: z.string().uuid(),
                receivedQty: z.number(),
                varianceReason: z.string().optional(),
            })).optional(),
            notes: z.string().optional(),
        });

        const data = schema.parse(req.body);
        const receivedBy = data.receivedBy || data.confirmedBy || 'Shop Staff';

        // If items provided, update each with received quantity
        if (data.items && data.items.length > 0) {
            for (const item of data.items) {
                await supabaseAdmin
                    .from('store_despatch_items')
                    .update({
                        received_quantity: item.receivedQty,
                        notes: item.varianceReason,
                    })
                    .eq('id', item.itemId);
            }
        } else {
            // Auto-confirm all items at their picked quantity
            const { data: dispatchItems } = await supabaseAdmin
                .from('store_despatch_items')
                .select('id, picked_qty')
                .eq('despatch_id', id);

            if (dispatchItems) {
                for (const item of dispatchItems) {
                    await supabaseAdmin
                        .from('store_despatch_items')
                        .update({ received_quantity: item.picked_qty })
                        .eq('id', item.id);
                }
            }
        }

        // Update despatch status
        const { error } = await supabaseAdmin
            .from('store_despatches')
            .update({
                status: 'confirmed',
                received_by: receivedBy,
                received_at: new Date().toISOString(),
                notes: data.notes,
            })
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true });
    } catch (error: any) {
        log(`Error confirming dispatch: ${error.message}`);
        res.status(500).json({ message: 'Failed to confirm dispatch' });
    }
});

// ============================================================================
// STOCK COUNTS (Wastage/Consumption)
// ============================================================================

// Record wastage
router.post('/stock/wastage', requireOpenShift, async (req, res) => {
    try {
        const schema = z.object({
            items: z.array(z.object({
                itemName: z.string(),
                quantity: z.number(),
                unit: z.string().default('units'),
                reason: z.string(),
            })),
            recordedBy: z.string(),
        });

        const data = schema.parse(req.body);
        const results = [];

        for (const item of data.items) {
            const { data: entry, error } = await supabaseAdmin
                .from('shop_stock_entries')
                .insert({
                    session_id: null, // Independent of session
                    item_name: item.itemName,
                    quantity: -Math.abs(item.quantity), // Negative for wastage
                    unit: item.unit,
                    notes: `WASTAGE: ${item.reason}`,
                })
                .select()
                .single();

            if (error) throw error;
            results.push(entry);
        }

        res.json({ success: true, entries: results });
    } catch (error: any) {
        log(`Error recording wastage: ${error.message}`);
        res.status(500).json({ message: 'Failed to record wastage' });
    }
});

// Record consumption (staff meals, etc.)
router.post('/stock/consumption', requireOpenShift, async (req, res) => {
    try {
        const schema = z.object({
            items: z.array(z.object({
                itemName: z.string(),
                quantity: z.number(),
                unit: z.string().default('units'),
                reason: z.string().default('staff consumption'),
            })),
            recordedBy: z.string(),
        });

        const data = schema.parse(req.body);
        const results = [];

        for (const item of data.items) {
            const { data: entry, error } = await supabaseAdmin
                .from('shop_stock_entries')
                .insert({
                    session_id: null,
                    item_name: item.itemName,
                    quantity: -Math.abs(item.quantity),
                    unit: item.unit,
                    notes: `CONSUMPTION: ${item.reason}`,
                })
                .select()
                .single();

            if (error) throw error;
            results.push(entry);
        }

        res.json({ success: true, entries: results });
    } catch (error: any) {
        log(`Error recording consumption: ${error.message}`);
        res.status(500).json({ message: 'Failed to record consumption' });
    }
});

// ============================================================================
// STAFF LIST (For shift selection)
// ============================================================================

router.get('/staff', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('staff')
            .select('id, name')
            .eq('role', 'shop')
            .eq('is_active', true)
            .order('name');

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        log(`Error fetching shop staff: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch staff' });
    }
});

// ============================================================================
// STOCK SESSIONS AND ENTRIES
// ============================================================================

// Get today's stock sessions
router.get('/stock/sessions/today', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data, error } = await supabaseAdmin
            .from('shop_stock_sessions')
            .select('*')
            .gte('started_at', today.toISOString())
            .order('started_at', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        log(`Error fetching today's sessions: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch sessions' });
    }
});

// Get common items for quick add
router.get('/stock/common-items', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('store_items')
            .select('id, name, unit, category')
            .eq('is_active', true)
            .eq('requires_counting', true)
            .order('name')
            .limit(100);

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        log(`Error fetching common items: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch items' });
    }
});

// Create stock session
router.post('/stock/sessions', async (req, res) => {
    try {
        const schema = z.object({
            sessionType: z.enum(['opening', 'closing']),
            staffName: z.string(),
        });

        const data = schema.parse(req.body);

        const { data: session, error } = await supabaseAdmin
            .from('shop_stock_sessions')
            .insert({
                session_type: data.sessionType,
                staff_name: data.staffName,
                status: 'in_progress',
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(session);
    } catch (error: any) {
        log(`Error creating stock session: ${error.message}`);
        res.status(500).json({ message: 'Failed to create session' });
    }
});

// Save stock entries
router.post('/stock/entries', async (req, res) => {
    try {
        const schema = z.object({
            sessionId: z.string().uuid().optional(),
            sessionType: z.enum(['opening', 'closing']),
            staffName: z.string(),
            entries: z.array(z.object({
                itemName: z.string(),
                quantity: z.number(),
                unit: z.string(),
                notes: z.string().optional(),
            })),
        });

        const data = schema.parse(req.body);

        // Create session if not provided
        let sessionId = data.sessionId;
        if (!sessionId) {
            const { data: session, error: sessionError } = await supabaseAdmin
                .from('shop_stock_sessions')
                .insert({
                    session_type: data.sessionType,
                    staff_name: data.staffName,
                    status: 'completed',
                    total_items: data.entries.length,
                    counted_items: data.entries.length,
                    completed_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (sessionError) throw sessionError;
            sessionId = session.id;
        }

        // Insert entries
        const entryInserts = data.entries.map(entry => ({
            session_id: sessionId,
            item_name: entry.itemName,
            quantity: entry.quantity,
            unit: entry.unit,
            notes: entry.notes,
        }));

        const { error: entriesError } = await supabaseAdmin
            .from('shop_stock_entries')
            .insert(entryInserts);

        if (entriesError) throw entriesError;

        // Update session as completed
        await supabaseAdmin
            .from('shop_stock_sessions')
            .update({
                status: 'completed',
                total_items: data.entries.length,
                counted_items: data.entries.length,
                completed_at: new Date().toISOString(),
            })
            .eq('id', sessionId);

        res.json({ success: true, sessionId, entriesCount: data.entries.length });
    } catch (error: any) {
        log(`Error saving stock entries: ${error.message}`);
        res.status(500).json({ message: 'Failed to save entries' });
    }
});

export default router;

