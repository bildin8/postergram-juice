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

        // 3. Fetch SALES data from PosterPOS (transaction sync runs every 10 mins, but let's get live or recent)
        // We'll fetch transactions between opening and closing times
        // If closing is open/null, use 'now'

        let salesMap = new Map<string, number>();

        if (recon && isPosterPOSInitialized()) {
            const client = getPosterPOSClient();

            // Get session times
            const { data: openingSession } = await supabaseAdmin.from('shop_stock_sessions').select('started_at').eq('id', recon.opening_session_id).single();
            const { data: closingSession } = await supabaseAdmin.from('shop_stock_sessions').select('completed_at').eq('id', recon.closing_session_id).single();

            if (openingSession) {
                const fromDate = new Date(openingSession.started_at).toISOString().split('T')[0].replace(/-/g, '');
                const toDate = closingSession?.completed_at
                    ? new Date(closingSession.completed_at).toISOString().split('T')[0].replace(/-/g, '')
                    : new Date().toISOString().split('T')[0].replace(/-/g, '');

                // Fetch transactions
                try {
                    const transactions = await client.getTransactions({
                        dateFrom: fromDate,
                        dateTo: toDate
                    });

                    // Aggregate sales by product
                    for (const tx of transactions) {
                        if (tx.products) {
                            for (const product of tx.products) {
                                // Match by name (imperfect but works for "Management Engine" v1)
                                // Better: Match by product_id if stored in inventory_items
                                const productName = product.product_name;
                                const qty = parseFloat(product.num || '0');

                                const current = salesMap.get(productName) || 0;
                                salesMap.set(productName, current + qty);
                            }
                        }
                    }
                } catch (e) {
                    log(`Error fetching POS sales for recon: ${e}`);
                }
            }
        }

        const variances = Array.from(allItems).map(itemName => {
            const openingData = openingMap.get(itemName) || { qty: 0, id: null };
            const closingData = closingMap.get(itemName) || { qty: 0, id: null };
            const opening = openingData.qty;
            const closing = closingData.qty;

            // Get sold qty from PosterPOS Map
            const sold = salesMap.get(itemName) || 0;

            // Simple variance calculation 
            // Expected = Opening - Sold (assuming no restocks for this shift, needs enhancement for "Received")
            // Ideally: Expected = Opening + Received - Sold
            const expected = opening - sold;
            const actual = closing;
            const variance = actual - expected;
            const variancePercent = expected > 0 ? Math.round((variance / expected) * 100) : 0;

            return {
                itemId: openingData.id || closingData.id || itemName,
                itemName,
                opening,
                closing,
                sold,
                dispatched: 0, // Placeholder
                wastage: 0, // Placeholder
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

// ============================================================================
// AUDIT STREAM
// ============================================================================

// ============================================================================
// PROFITABILITY & COSTS
// ============================================================================

router.get('/profitability', async (req, res) => {
    try {
        if (!isPosterPOSInitialized()) {
            return res.status(503).json({ message: "PosterPOS not configured" });
        }
        const client = getPosterPOSClient();

        // 1. Get Products with detailed Recipes (Ingredients)
        const productsWithRecipes = await client.getAllProductsWithRecipes();

        // 2. Get Products to get Selling Price
        const allProducts = await client.getProducts();

        // 3. Get Ingredient Costs (Use 30-day movement report for weighted avg cost)
        const movements = await client.getIngredientMovementsForRange(30);

        // Build Cost Map: Ingredient ID -> Cost Per Unit
        const costMap = new Map<string, number>();
        for (const m of movements) {
            // cost_end is usually cost per unit in cents (or base currency * 100)
            // We use cost_end (current value) or cost_start if end is 0
            const cost = (Number(m.cost_end) || Number(m.cost_start)) / 100;
            if (cost > 0) {
                costMap.set(m.ingredient_id, cost);
            }
        }

        // Also get raw ingredients to name them if needed
        const ingredientsRaw = await client.getIngredients();
        const ingredientNameMap = new Map(ingredientsRaw.map((i: any) => [i.ingredient_id, i.ingredient_name]));

        const profitability = [];

        for (const p of productsWithRecipes) {
            // Find matching product for price
            // PosterPOS uses numeric IDs, but getProducts might return string/number mix. Stringify for safety.
            const productInfo = allProducts.find((x: any) => x.product_id.toString() === p.product_id.toString());

            // Get Price (Standard price)
            // Product price might be an object { "1": "50000" } for different spots/stations. 
            // We'll take the first one or 'price' property if simple.
            let price = 0;
            if (productInfo) {
                if (typeof productInfo.price === 'object') {
                    const firstPrice = Object.values(productInfo.price)[0];
                    price = parseFloat(firstPrice as string) / 100; // Assuming cents
                } else if (productInfo.price) {
                    price = parseFloat(productInfo.price as any) / 100;
                }
            }

            if (price === 0) continue; // Skip items with no price (modifiers, ingredients)

            let totalCost = 0;
            let recipeDetails = [];

            // Calculate Ingredient Costs
            if (p.ingredients) {
                for (const ing of p.ingredients) {
                    const costPerUnit = costMap.get(ing.ingredient_id.toString()) || 0;
                    const qty = ing.structure_netto; // Usage quantity
                    const lineCost = qty * costPerUnit;

                    totalCost += lineCost;

                    recipeDetails.push({
                        name: ing.ingredient_name,
                        qty,
                        unit: ing.ingredient_unit,
                        costPerUnit,
                        lineCost
                    });
                }
            }

            const margin = price - totalCost;
            const marginPercent = price > 0 ? (margin / price) * 100 : 0;

            profitability.push({
                id: p.product_id,
                name: p.product_name,
                category: productInfo?.menu_category_name || 'Uncategorized',
                price,
                cost: totalCost,
                margin,
                marginPercent,
                recipe: recipeDetails
            });
        }

        // Sort by Margin % (Lowest first - to highlight issues)
        profitability.sort((a, b) => a.marginPercent - b.marginPercent);

        res.json(profitability);

    } catch (error: any) {
        log(`Error calculating profitability: ${error.message}`);
        res.status(500).json({ message: 'Failed to calculate profitability' });
    }
});

// ============================================================================
// DATA SYNC ENDPOINTS (Sync from PosterPOS to local DB)
// ============================================================================

// Import the inventory service functions dynamically to avoid circular deps
import { syncRecipesFromPoster, processHistoricalTransactions } from './inventoryService';

// Sync recipes from PosterPOS to local database
router.post('/sync/recipes', async (req, res) => {
    try {
        const result = await syncRecipesFromPoster();
        res.json({
            success: true,
            message: 'Recipes synced from PosterPOS',
            ...result
        });
    } catch (error: any) {
        log(`Error syncing recipes: ${error.message}`);
        res.status(500).json({ message: 'Failed to sync recipes' });
    }
});

// Process historical transactions to populate ingredient_consumption table
router.post('/sync/historical-transactions', async (req, res) => {
    try {
        const days = parseInt(req.body.days as string) || 30;
        const result = await processHistoricalTransactions(days);
        res.json({
            success: true,
            message: `Processed ${result.processed} transactions from the last ${days} days`,
            ...result
        });
    } catch (error: any) {
        log(`Error processing historical transactions: ${error.message}`);
        res.status(500).json({ message: 'Failed to process transactions' });
    }
});

// Populate store_items from synced ingredients (move to local DB)
router.post('/sync/populate-items', async (req, res) => {
    try {
        // Get all ingredients (already synced from PosterPOS)
        const { data: ingredients, error: ingError } = await supabaseAdmin
            .from('ingredients')
            .select('id, name, poster_ingredient_id, default_unit_id, min_stock_level')
            .eq('is_active', true);

        if (ingError) throw ingError;

        // Get existing store_items names to avoid duplicates
        const { data: existingItems } = await supabaseAdmin
            .from('store_items')
            .select('name');

        const existingNames = new Set((existingItems || []).map(i => i.name.toLowerCase()));

        let created = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const ing of ingredients || []) {
            // Skip if already exists
            if (existingNames.has(ing.name.toLowerCase())) {
                skipped++;
                continue;
            }

            // Get unit abbreviation
            let unitAbbrev = 'units';
            if (ing.default_unit_id) {
                const { data: unitData } = await supabaseAdmin
                    .from('units_of_measure')
                    .select('abbreviation')
                    .eq('id', ing.default_unit_id)
                    .single();
                unitAbbrev = unitData?.abbreviation || 'units';
            }

            // Insert new store_item
            const { error: insertError } = await supabaseAdmin
                .from('store_items')
                .insert({
                    name: ing.name,
                    category: 'ingredient',
                    unit: unitAbbrev,
                    min_stock: 0,
                    current_stock: 0,
                    // bought_by default is 'store' in DB
                    is_active: true
                });

            if (insertError) {
                errors.push(`${ing.name}: ${insertError.message}`);
            } else {
                created++;
            }
        }

        res.json({
            success: true,
            message: `Populated store_items from ingredients`,
            created,
            skipped,
            totalIngredients: ingredients?.length || 0,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error: any) {
        log(`Error populating items: ${error.message}`);
        res.status(500).json({ message: 'Failed to populate items', error: error.message });
    }
});

// ============================================================================
// SMART REPLENISHMENT (Forecast based on past sales - uses LOCAL synced data)
// ============================================================================

router.get('/insights/smart-replenishment', async (req, res) => {
    try {
        // 1. Timeframe - Accept custom date range or default to last 30 days
        const coverageDays = parseInt(req.query.coverage as string) || 7;

        let todaysDate: Date;
        let pastDate: Date;
        let days: number;

        if (req.query.from && req.query.to) {
            pastDate = new Date(req.query.from as string);
            todaysDate = new Date(req.query.to as string);
            days = Math.ceil((todaysDate.getTime() - pastDate.getTime()) / (1000 * 60 * 60 * 24));
        } else {
            days = parseInt(req.query.days as string) || 30;
            todaysDate = new Date();
            pastDate = new Date();
            pastDate.setDate(todaysDate.getDate() - days);
        }

        // 2. Query existing sales_records table (already synced from PosterPOS)
        const { data: salesData, error: salesError } = await supabaseAdmin
            .from('sales_records')
            .select('item_name, quantity, timestamp')
            .gte('timestamp', pastDate.toISOString())
            .lte('timestamp', todaysDate.toISOString());

        if (salesError) {
            log(`Error fetching sales: ${salesError.message}`);
            return await fallbackToAPIReplenishment(req, res, days, coverageDays);
        }

        // 3. Aggregate product sales by item_name
        const productSales = new Map<string, number>();
        for (const sale of salesData || []) {
            const qty = parseFloat(sale.quantity) || 0;
            productSales.set(sale.item_name, (productSales.get(sale.item_name) || 0) + qty);
        }

        // 4. Get recipes from local DB (synced from PosterPOS)
        const { data: recipes } = await supabaseAdmin
            .from('recipes')
            .select(`
                id,
                name,
                poster_product_id,
                recipe_ingredients (
                    ingredient_id,
                    quantity,
                    is_optional,
                    ingredient:ingredients (
                        id,
                        name,
                        default_unit_id
                    )
                )
            `)
            .eq('is_active', true);

        // 5. Calculate ingredient usage from sales × recipe
        const ingredientUsage = new Map<string, {
            id: string;
            name: string;
            used: number;
        }>();

        for (const recipe of recipes || []) {
            // Match by recipe name to sales item_name
            const soldQty = productSales.get(recipe.name) || 0;
            if (soldQty > 0 && recipe.recipe_ingredients) {
                for (const ri of recipe.recipe_ingredients as any[]) {
                    if (ri.is_optional) continue; // Skip optional ingredients for base calculation

                    const ingId = ri.ingredient_id;
                    const usageQty = soldQty * (parseFloat(ri.quantity) || 0);
                    const ingName = ri.ingredient?.name || 'Unknown';

                    const current = ingredientUsage.get(ingId) || { id: ingId, name: ingName, used: 0 };
                    current.used += usageQty;
                    ingredientUsage.set(ingId, current);
                }
            }
        }

        // 4. Get ingredient details (unit) from local tables
        const ingredientIds = Array.from(ingredientUsage.keys());

        let ingredientDetails: Map<string, { unit: string }> = new Map();

        if (ingredientIds.length > 0) {
            const { data: ingredients } = await supabaseAdmin
                .from('ingredients')
                .select(`
                    id,
                    name,
                    default_unit:units_of_measure(abbreviation)
                `)
                .in('id', ingredientIds);

            for (const ing of ingredients || []) {
                ingredientDetails.set(ing.id, {
                    unit: (ing.default_unit as any)?.abbreviation || 'units'
                });
            }
        }

        // 5. Generate Simple Forecast Report (Usage-Based Only)
        // NOTE: We're NOT using PosterPOS stock levels as they're unreliable (owner hasn't updated supply entries)
        const report = [];

        for (const [ingId, data] of ingredientUsage.entries()) {
            const details = ingredientDetails.get(ingId) || { unit: 'units' };
            const dailyAvg = data.used / days;
            const weeklyNeed = dailyAvg * 7;
            const biweeklyNeed = dailyAvg * 14;

            report.push({
                ingredientId: ingId,
                name: data.name,
                unit: details.unit,
                // Usage stats
                totalUsedInPeriod: Math.round(data.used * 100) / 100,
                dailyAvgUsage: Math.round(dailyAvg * 100) / 100,
                // Order suggestions (pure usage-based)
                weeklyNeed: Math.round(weeklyNeed * 100) / 100,
                biweeklyNeed: Math.round(biweeklyNeed * 100) / 100,
                // Urgency indicator based on usage volume
                usageLevel: dailyAvg > 10 ? 'high' : dailyAvg > 5 ? 'medium' : 'low'
            });
        }

        // Sort by highest daily usage
        report.sort((a, b) => b.dailyAvgUsage - a.dailyAvgUsage);

        res.json({
            period: {
                from: pastDate.toISOString().split('T')[0],
                to: todaysDate.toISOString().split('T')[0],
                days
            },
            note: "Order quantities based on usage only. PosterPOS stock levels not used as they may be inaccurate.",
            dataSource: 'local_db',
            items: report
        });

    } catch (error: any) {
        log(`Error generating smart replenishment: ${error.message}`);
        res.status(500).json({ message: 'Failed to generate forecast' });
    }
});

// Fallback function if local consumption data doesn't exist yet
async function fallbackToAPIReplenishment(req: any, res: any, days: number, coverageDays: number) {
    if (!isPosterPOSInitialized()) {
        return res.status(503).json({ message: "No local data and PosterPOS not configured" });
    }
    const client = getPosterPOSClient();

    const todaysDate = new Date();
    const pastDate = new Date();
    pastDate.setDate(todaysDate.getDate() - days);

    const dateTo = todaysDate.toISOString().split('T')[0].replace(/-/g, '');
    const dateFrom = pastDate.toISOString().split('T')[0].replace(/-/g, '');

    // Fetch from PosterPOS API
    const transactions = await client.getTransactions({
        dateFrom,
        dateTo,
        includeProducts: true,
        status: 2
    });

    const productSales = new Map<string, number>();
    for (const tx of transactions) {
        if (tx.products) {
            for (const p of tx.products) {
                const pid = p.product_id.toString();
                const qty = parseFloat(p.num || '0');
                productSales.set(pid, (productSales.get(pid) || 0) + qty);
            }
        }
    }

    const productsWithRecipes = await client.getAllProductsWithRecipes();

    const ingredientUsage = new Map<string, { name: string; unit: string; used: number }>();
    for (const p of productsWithRecipes) {
        const soldQty = productSales.get(p.product_id.toString()) || 0;
        if (soldQty > 0 && p.ingredients) {
            for (const ing of p.ingredients) {
                const ingId = ing.ingredient_id.toString();
                const usage = soldQty * ing.structure_netto;
                const current = ingredientUsage.get(ingId) || { name: ing.ingredient_name, unit: ing.ingredient_unit, used: 0 };
                current.used += usage;
                ingredientUsage.set(ingId, current);
            }
        }
    }

    const stockLevels = await client.getStockLevels();
    const stockMap = new Map(stockLevels.map(s => [s.product_id.toString(), s.stock_count]));

    const report = [];
    for (const [ingId, data] of ingredientUsage.entries()) {
        const dailyAvg = data.used / days;
        const requiredStock = dailyAvg * coverageDays;
        const currentStock = stockMap.get(ingId) || 0;
        const toOrder = Math.max(0, requiredStock - currentStock);

        report.push({
            ingredientId: ingId,
            name: data.name,
            unit: data.unit,
            totalUsed30d: Math.round(data.used * 100) / 100,
            dailyAvgUsage: Math.round(dailyAvg * 100) / 100,
            currentStock: Math.round(currentStock * 100) / 100,
            requiredForCoverage: Math.round(requiredStock * 100) / 100,
            recommendedOrder: Math.round(toOrder * 100) / 100,
            status: toOrder > 0 ? 'reorder' : 'ok'
        });
    }

    report.sort((a, b) => b.recommendedOrder - a.recommendedOrder);

    res.json({
        period: { from: dateFrom, to: dateTo, days },
        coverageTargetDays: coverageDays,
        dataSource: 'posterpos_api', // Indicates we used live API (fallback)
        items: report
    });
}

// ============================================================================
// CONSUMPTION / USAGE REPORT (What ingredients were used)
// ============================================================================

router.get('/insights/consumption', async (req, res) => {
    try {
        // Date range
        const days = parseInt(req.query.days as string) || 30;
        const todaysDate = new Date();
        const pastDate = new Date();

        if (req.query.from && req.query.to) {
            pastDate.setTime(new Date(req.query.from as string).getTime());
            todaysDate.setTime(new Date(req.query.to as string).getTime());
        } else {
            pastDate.setDate(todaysDate.getDate() - days);
        }

        // 1. Get sales data
        const { data: salesData, error: salesError } = await supabaseAdmin
            .from('sales_records')
            .select('item_name, quantity, timestamp, amount')
            .gte('timestamp', pastDate.toISOString())
            .lte('timestamp', todaysDate.toISOString())
            .order('timestamp', { ascending: false });

        if (salesError) {
            log(`Error fetching sales: ${salesError.message}`);
            return res.status(500).json({ message: 'Failed to fetch sales data' });
        }

        // 2. Aggregate product sales
        const productSales = new Map<string, { qty: number; revenue: number; count: number }>();
        for (const sale of salesData || []) {
            const qty = parseFloat(sale.quantity) || 0;
            const revenue = parseFloat(sale.amount) || 0;
            const current = productSales.get(sale.item_name) || { qty: 0, revenue: 0, count: 0 };
            current.qty += qty;
            current.revenue += revenue;
            current.count += 1;
            productSales.set(sale.item_name, current);
        }

        // 3. Get recipes with ingredients
        const { data: recipes } = await supabaseAdmin
            .from('recipes')
            .select(`
                id, name, poster_product_id,
                recipe_ingredients (
                    ingredient_id, quantity, is_optional,
                    ingredient:ingredients (id, name, default_unit_id)
                )
            `)
            .eq('is_active', true);

        // 4. Calculate ingredient consumption
        const ingredientConsumption = new Map<string, {
            name: string;
            totalUsed: number;
            usedByProducts: Array<{ product: string; qty: number }>;
        }>();

        for (const recipe of recipes || []) {
            const sales = productSales.get(recipe.name);
            if (!sales || sales.qty === 0) continue;

            for (const ri of (recipe.recipe_ingredients || []) as any[]) {
                if (ri.is_optional) continue;

                const ingId = ri.ingredient_id;
                const ingName = ri.ingredient?.name || 'Unknown';
                const usageQty = sales.qty * (parseFloat(ri.quantity) || 0);

                const current = ingredientConsumption.get(ingId) || {
                    name: ingName,
                    totalUsed: 0,
                    usedByProducts: []
                };
                current.totalUsed += usageQty;
                current.usedByProducts.push({ product: recipe.name, qty: usageQty });
                ingredientConsumption.set(ingId, current);
            }
        }

        // 5. Build response
        const productReport = Array.from(productSales.entries()).map(([name, data]) => ({
            name,
            quantitySold: data.qty,
            revenue: data.revenue,
            transactionCount: data.count
        })).sort((a, b) => b.quantitySold - a.quantitySold);

        const ingredientReport = Array.from(ingredientConsumption.entries()).map(([id, data]) => ({
            ingredientId: id,
            name: data.name,
            totalUsed: Math.round(data.totalUsed * 100) / 100,
            usedByProducts: data.usedByProducts.map(p => ({
                product: p.product,
                qty: Math.round(p.qty * 100) / 100
            }))
        })).sort((a, b) => b.totalUsed - a.totalUsed);

        res.json({
            period: {
                from: pastDate.toISOString().split('T')[0],
                to: todaysDate.toISOString().split('T')[0],
                days: Math.ceil((todaysDate.getTime() - pastDate.getTime()) / (1000 * 60 * 60 * 24))
            },
            summary: {
                totalProducts: productReport.length,
                totalIngredients: ingredientReport.length,
                totalRevenue: productReport.reduce((s, p) => s + p.revenue, 0),
                totalTransactions: salesData?.length || 0
            },
            products: productReport,
            ingredients: ingredientReport
        });

    } catch (error: any) {
        log(`Error generating consumption report: ${error.message}`);
        res.status(500).json({ message: 'Failed to generate consumption report' });
    }
});


// ============================================================================
// SUPPLIER MANAGEMENT
// ============================================================================

// Get all suppliers
router.get('/suppliers', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('suppliers')
            .select('*')
            .order('name');

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        log(`Error fetching suppliers: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch suppliers' });
    }
});

// Create supplier
router.post('/suppliers', async (req, res) => {
    try {
        const schema = z.object({
            name: z.string().min(1),
            contact_person: z.string().optional(),
            phone: z.string().optional(),
            email: z.string().email().optional().or(z.literal('')),
            category: z.string().optional(),
            payment_terms: z.string().optional(),
            is_active: z.boolean().optional()
        });

        const data = schema.parse(req.body);

        const { data: supplier, error } = await supabaseAdmin
            .from('suppliers')
            .insert({
                ...data,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        res.json(supplier);
    } catch (error: any) {
        log(`Error creating supplier: ${error.message}`);
        res.status(500).json({ message: 'Failed to create supplier' });
    }
});

// Update supplier
router.put('/suppliers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const schema = z.object({
            name: z.string().min(1).optional(),
            contact_person: z.string().optional(),
            phone: z.string().optional(),
            email: z.string().email().optional().or(z.literal('')),
            category: z.string().optional(),
            payment_terms: z.string().optional(),
            is_active: z.boolean().optional()
        });

        const data = schema.parse(req.body);

        const { data: supplier, error } = await supabaseAdmin
            .from('suppliers')
            .update({
                ...data,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(supplier);
    } catch (error: any) {
        log(`Error updating supplier: ${error.message}`);
        res.status(500).json({ message: 'Failed to update supplier' });
    }
});

// Delete supplier
router.delete('/suppliers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('suppliers')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ message: 'Supplier deleted successfully' });
    } catch (error: any) {
        log(`Error deleting supplier: ${error.message}`);
        res.status(500).json({ message: 'Failed to delete supplier' });
    }
});


// ============================================================================
// PROFITABILITY ENGINE
// ============================================================================

router.get('/insights/profitability', async (req, res) => {
    try {
        // 1. Get recipes with ingredients
        const { data: recipes, error: recipeError } = await supabaseAdmin
            .from('recipes')
            .select(`
                id, name,
                recipe_ingredients (
                    quantity,
                    ingredient:ingredients (name)
                )
            `)
            .eq('is_active', true);

        if (recipeError) throw recipeError;

        // 2. Get item costs from store_items
        const { data: items, error: itemError } = await supabaseAdmin
            .from('store_items')
            .select('name, cost_per_unit, unit');

        if (itemError) throw itemError;

        // Map item costs for quick lookup (ensure lowercase matching)
        const costMap = new Map<string, number>();
        for (const item of items || []) {
            costMap.set(item.name.toLowerCase(), item.cost_per_unit || 0);
        }

        // 3. Get recent sales for simple pricing check (last 30 days)
        // Note: Ideally we'd sync current prices from Poster, but sales records give actual realized price
        const { data: sales } = await supabaseAdmin
            .from('sales_records')
            .select('item_name, amount, quantity')
            .order('timestamp', { ascending: false })
            .limit(1000); // Sample recent sales

        // Calculate average selling price per item
        const priceMap = new Map<string, number>();
        for (const sale of sales || []) {
            if (!priceMap.has(sale.item_name)) {
                const price = (parseFloat(sale.amount) / parseFloat(sale.quantity));
                if (!isNaN(price) && price > 0) {
                    priceMap.set(sale.item_name, price);
                }
            }
        }

        const report = [];

        for (const recipe of recipes || []) {
            let totalCost = 0;
            const ingredientsList = [];

            // Calculate recipe cost
            for (const ri of (recipe.recipe_ingredients || []) as any[]) {
                const ingName = ri.ingredient?.name;
                const costPerUnit = costMap.get(ingName?.toLowerCase()) || 0;
                const cost = costPerUnit * ri.quantity;

                totalCost += cost;

                ingredientsList.push({
                    name: ingName,
                    quantity: ri.quantity,
                    costPerUnit,
                    totalCost: cost
                });
            }

            // Determine selling price (fallback to 0 if no sales found)
            const sellingPrice = priceMap.get(recipe.name) || 0;
            const margin = sellingPrice - totalCost;
            const marginPercent = sellingPrice > 0 ? (margin / sellingPrice) * 100 : 0;

            report.push({
                id: recipe.id,
                name: recipe.name,
                category: 'Standard', // Placeholder, could map from Poster
                price: Math.round(sellingPrice),
                cost: Math.round(totalCost),
                profit: Math.round(margin),
                marginPercent: Math.round(marginPercent),
                ingredients: ingredientsList
            });
        }

        // Sort by lowest margin first to highlight issues
        report.sort((a, b) => a.marginPercent - b.marginPercent);

        res.json(report);

    } catch (error: any) {
        log(`Error generating profitability report: ${error.message}`);
        res.status(500).json({ message: 'Failed to generate profitability report' });
    }
});


// ============================================================================
// SUPPLIER MANAGEMENT & ANALYTICS
// ============================================================================

// Get all suppliers
router.get('/suppliers', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('suppliers')
            .select('*')
            .order('name');

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        log(`Error fetching suppliers: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch suppliers' });
    }
});

// Create supplier
router.post('/suppliers', async (req, res) => {
    try {
        const schema = z.object({
            name: z.string().min(1),
            contactPerson: z.string().optional(),
            phone: z.string().optional(),
            email: z.string().email().optional().or(z.literal('')),
        });

        const data = schema.parse(req.body);

        const { data: supplier, error } = await supabaseAdmin
            .from('suppliers')
            .insert({
                name: data.name,
                contact_person: data.contactPerson,
                phone: data.phone,
                email: data.email || null,
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(supplier);
    } catch (error: any) {
        log(`Error creating supplier: ${error.message}`);
        res.status(500).json({ message: 'Failed to create supplier' });
    }
});

// Get Supplier Analytics (Price trends for items linked to supplier)
router.get('/suppliers/:id/analytics', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Get items linked to this supplier
        const { data: items } = await supabaseAdmin
            .from('store_items')
            .select('id, name')
            .eq('supplier_id', id);

        if (!items || items.length === 0) {
            return res.json({ priceHistory: [] });
        }

        const itemIds = items.map(i => i.id);

        // 2. Get purchase history for these items
        // We need to join store_purchase_items with store_purchases(status=received)
        // But Supabase JS client doesn't do deep filtering easily in one go for m:n relations 
        // without RPC or complex query.
        // We'll fetch purchase items where item_id is in our list, ordered by created_at.

        const { data: history, error } = await supabaseAdmin
            .from('store_purchase_items')
            .select(`
                actual_cost,
                quantity,
                created_at,
                item:store_items(name)
            `)
            .in('item_id', itemIds)
            .order('created_at', { ascending: true })
            .limit(100); // Last 100 purchases

        if (error) throw error;

        res.json({ priceHistory: history });
    } catch (error: any) {
        log(`Error fetching supplier analytics: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch analytics' });
    }
});

router.get('/audit-stream', async (req, res) => {

    try {
        const events = [];

        // 1. Approvals
        const { data: approvals } = await supabaseAdmin
            .from('purchase_requests')
            .select('id, requested_by, approved_by, approved_at, status')
            .eq('status', 'approved')
            .order('approved_at', { ascending: false })
            .limit(10);

        if (approvals) {
            events.push(...approvals.map(a => ({
                id: a.id,
                type: 'approval',
                message: `${a.approved_by} approved purchase request`,
                timestamp: a.approved_at,
                user: a.approved_by
            })));
        }

        // 2. Expenses
        const { data: expenses } = await supabaseAdmin
            .from('shop_expenses')
            .select('id, description, amount, paid_by, created_at')
            .order('created_at', { ascending: false })
            .limit(10);

        if (expenses) {
            events.push(...expenses.map(e => ({
                id: e.id,
                type: 'expense',
                message: `${e.paid_by} spent KES ${e.amount} on ${e.description}`,
                timestamp: e.created_at,
                user: e.paid_by
            })));
        }

        // 3. Shifts
        const { data: shifts } = await supabaseAdmin
            .from('shifts')
            .select('id, opened_by, opened_at, status')
            .order('opened_at', { ascending: false })
            .limit(5);

        if (shifts) {
            events.push(...shifts.map(s => ({
                id: s.id,
                type: 'shift',
                message: `${s.opened_by} opened register`,
                timestamp: s.opened_at,
                user: s.opened_by
            })));
        }

        // Sort by timestamp
        events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        res.json(events.slice(0, 20));
    } catch (error: any) {
        log(`Error fetching audit stream: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch audit stream' });
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
// Get all items (from operational schema)
router.get('/items', async (req, res) => {
    try {
        // Fetch from op_ingredients and join with stock view data
        const { data, error } = await supabaseAdmin
            .from('op_ingredients')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (error) throw error;

        // Also fetch stock levels to complement the data
        const { data: stockData } = await supabaseAdmin
            .from('v_op_ingredient_stock')
            .select('*');

        const stockMap = new Map(stockData?.map(s => [s.id, s]) || []);

        // Transform to match the frontend expected StoreItem interface
        const result = (data || []).map(item => {
            const stock = stockMap.get(item.id);
            return {
                id: item.id,
                name: item.name,
                category: item.category || 'general',
                unit: item.unit,
                min_stock: item.min_stock_level || 0,
                current_stock: stock ? (stock.store_stock + stock.shop_stock) : 0,
                cost_per_unit: item.last_cost || 0,
                is_active: item.is_active,
                bought_by: 'store', // Default in new schema
                store_stock: stock?.store_stock || 0,
                shop_stock: stock?.shop_stock || 0
            };
        });

        res.json(result);
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
            cost_per_unit: z.number().optional(),
        });

        const data = schema.parse(req.body);

        const { data: item, error } = await supabaseAdmin
            .from('op_ingredients')
            .insert({
                name: data.name,
                category: data.category,
                unit: data.unit,
                min_stock_level: data.min_stock,
                last_cost: data.cost_per_unit || 0,
                is_active: true
            })
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
            cost_per_unit: z.number().optional(),
        });

        const data = schema.parse(req.body);

        const { data: item, error } = await supabaseAdmin
            .from('op_ingredients')
            .update({
                name: data.name,
                category: data.category,
                unit: data.unit,
                min_stock_level: data.min_stock,
                last_cost: data.cost_per_unit || 0,
                updated_at: new Date().toISOString()
            })
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
            .from('op_ingredients')
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
            .from('op_ingredients')
            .upsert({
                poster_ingredient_id: data.posterPosId.toString(),
                name: data.name,
                unit: data.unit,
                is_active: true
            }, { onConflict: 'poster_ingredient_id' })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(item);
    } catch (error: any) {
        log(`Error syncing item from POS: ${error.message}`);
        res.status(500).json({ message: 'Failed to sync item' });
    }
});

// Bulk import items from PosterPOS
router.post('/items/bulk-sync', async (req, res) => {
    try {
        const schema = z.object({
            items: z.array(z.object({
                posterPosId: z.number(),
                name: z.string(),
                unit: z.string(),
                currentStock: z.number().default(0),
            })),
        });

        const { items } = schema.parse(req.body);

        const upsertData = items.map(item => ({
            poster_ingredient_id: item.posterPosId.toString(),
            name: item.name,
            unit: item.unit,
            is_active: true
        }));

        const { data, error } = await supabaseAdmin
            .from('op_ingredients')
            .upsert(upsertData, { onConflict: 'poster_ingredient_id' })
            .select();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error: any) {
        log(`Error bulk syncing from POS: ${error.message}`);
        res.status(500).json({ message: 'Failed to bulk sync items' });
    }
});

// ============================================================================
// SUPPLIERS
// ============================================================================

router.get('/suppliers', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('suppliers')
            .select('*')
            .eq('is_active', true)
            .order('name');
        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        log(`Error fetching suppliers: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch suppliers' });
    }
});

router.post('/suppliers', async (req, res) => {
    try {
        const schema = z.object({
            name: z.string(),
            contact_person: z.string().optional(),
            phone: z.string().optional(),
            email: z.string().optional(),
        });
        const data = schema.parse(req.body);
        const { data: supplier, error } = await supabaseAdmin
            .from('suppliers')
            .insert(data)
            .select()
            .single();
        if (error) throw error;
        res.status(201).json(supplier);
    } catch (error: any) {
        log(`Error creating supplier: ${error.message}`);
        res.status(500).json({ message: 'Failed to create supplier' });
    }
});

// ============================================================================
// REORDER TEMPLATES
// ============================================================================

router.get('/reorder-templates', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('reorder_templates')
            .select(`
                *,
                items:reorder_template_items(*)
            `)
            .order('name');
        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        log(`Error fetching templates: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch templates' });
    }
});

router.post('/reorder-templates', async (req, res) => {
    try {
        const schema = z.object({
            name: z.string(),
            description: z.string().optional(),
            items: z.array(z.object({
                storeItemId: z.string().uuid().optional(),
                itemName: z.string(),
                quantity: z.number(),
                unit: z.string().default('units'),
            })),
            createdBy: z.string().optional(),
        });

        const data = schema.parse(req.body);

        const { data: template, error: tError } = await supabaseAdmin
            .from('reorder_templates')
            .insert({
                name: data.name,
                description: data.description,
                created_by: data.createdBy,
            })
            .select()
            .single();

        if (tError) throw tError;

        const itemInserts = data.items.map(i => ({
            template_id: template.id,
            store_item_id: i.storeItemId,
            item_name: i.itemName,
            quantity: i.quantity,
            unit: i.unit,
        }));

        const { error: iError } = await supabaseAdmin
            .from('reorder_template_items')
            .insert(itemInserts);

        if (iError) throw iError;

        res.status(201).json(template);
    } catch (error: any) {
        log(`Error creating template: ${error.message}`);
        res.status(500).json({ message: 'Failed to create template' });
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

