/**
 * Insights Routes
 * Analytics and smart suggestions derived from PosterPOS and store data
 */

import { Router } from 'express';
import { supabaseAdmin } from './supabase';
import { getPosterPOSClient, isPosterPOSInitialized } from './posterpos';
import { log } from './index';

const router = Router();

// ============================================================================
// PAR SUGGESTIONS (Based on historic usage from write_offs)
// ============================================================================

router.get('/par-suggestions', async (req, res) => {
    try {
        const leadDays = Number(req.query.leadDays) || 3; // Days to cover
        const safetyPercent = Number(req.query.safetyPercent) || 20; // Safety buffer %
        const daysToAnalyze = Number(req.query.days) || 30;

        if (!isPosterPOSInitialized()) {
            return res.json({
                suggestions: [],
                message: 'PosterPOS not initialized'
            });
        }

        const client = getPosterPOSClient();

        // Get date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysToAnalyze);

        const dateFrom = startDate.toISOString().split('T')[0].replace(/-/g, '');
        const dateTo = endDate.toISOString().split('T')[0].replace(/-/g, '');

        // Fetch ingredient movements from PosterPOS
        const movements = await client.getIngredientMovements(dateFrom, dateTo);

        // IngredientMovement has: ingredient_id, ingredient_name, start, income, write_offs, end
        const suggestions = movements.map(item => {
            // write_offs is the consumption for the period
            const totalUsed = Math.abs(item.write_offs || 0);
            const avgDailyUsage = totalUsed / daysToAnalyze;
            const leadTimeStock = avgDailyUsage * leadDays;
            const safetyStock = leadTimeStock * (safetyPercent / 100);
            const suggestedPAR = Math.ceil(leadTimeStock + safetyStock);
            const currentStock = item.end || 0;

            return {
                ingredientId: item.ingredient_id,
                name: item.ingredient_name,
                unit: 'units', // POS movements don't include unit info directly
                currentStock: Math.round(currentStock * 100) / 100,
                stats: {
                    totalUsed: Math.round(totalUsed * 100) / 100,
                    avgDailyUsage: Math.round(avgDailyUsage * 100) / 100,
                    income: item.income || 0,
                },
                suggestion: {
                    leadDays,
                    safetyPercent,
                    suggestedPAR,
                    orderQty: Math.max(0, suggestedPAR - currentStock),
                    calculatedAs: `(${avgDailyUsage.toFixed(2)} × ${leadDays}) + ${safetyPercent}% buffer`,
                },
            };
        });

        // Sort by usage (highest first)
        suggestions.sort((a, b) => b.stats.totalUsed - a.stats.totalUsed);

        res.json({
            period: { from: startDate.toISOString(), to: endDate.toISOString(), days: daysToAnalyze },
            parameters: { leadDays, safetyPercent },
            suggestions: suggestions.filter(s => s.stats.totalUsed > 0).slice(0, 50),
            totalIngredients: suggestions.length,
        });
    } catch (error: any) {
        log(`Error generating PAR suggestions: ${error.message}`);
        res.status(500).json({ message: 'Failed to generate PAR suggestions' });
    }
});

// ============================================================================
// SALES INSIGHTS (From PosterPOS transactions)
// ============================================================================

router.get('/sales', async (req, res) => {
    try {
        const days = Number(req.query.days) || 30;

        if (!isPosterPOSInitialized()) {
            return res.json({ message: 'PosterPOS not initialized' });
        }

        const client = getPosterPOSClient();
        const transactions = await client.getRecentTransactions(days);

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Aggregations
        let totalRevenue = 0;
        let totalCash = 0;
        let totalCard = 0;
        let transactionCount = 0;
        const dailyRevenue: Record<string, number> = {};
        const hourlyDistribution: Record<number, number> = {};
        const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};

        for (const tx of transactions) {
            const cash = parseFloat(tx.payed_cash || '0') / 100;
            const card = parseFloat(tx.payed_card || '0') / 100;
            const total = cash + card;

            totalRevenue += total;
            totalCash += cash;
            totalCard += card;
            transactionCount++;

            // Daily breakdown
            const date = tx.date_close?.split(' ')[0] || 'unknown';
            dailyRevenue[date] = (dailyRevenue[date] || 0) + total;

            // Hourly breakdown
            const hour = parseInt(tx.date_close?.split(' ')[1]?.split(':')[0] || '0');
            hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;

            // Product breakdown (from transaction products if available)
            if (tx.products) {
                for (const product of tx.products) {
                    const id = product.product_id.toString();
                    const existing = productSales[id] || {
                        name: `Product ${id}`, // PosterPOSTransactionProduct doesn't have product_name
                        qty: 0,
                        revenue: 0
                    };
                    existing.qty += parseInt(product.num || '1');
                    existing.revenue += (product.payed_sum || 0) / 100;
                    productSales[id] = existing;
                }
            }
        }

        // Find peak hour
        const peakHour = Object.entries(hourlyDistribution)
            .sort((a, b) => b[1] - a[1])[0];

        // Get product names from POS
        try {
            const products = await client.getProducts();
            for (const p of products) {
                const id = p.product_id.toString();
                if (productSales[id]) {
                    productSales[id].name = p.product_name;
                }
            }
        } catch (e) {
            // Continue without product names
        }

        // Top products
        const topProducts = Object.entries(productSales)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        // Daily trend
        const dailyTrend = Object.entries(dailyRevenue)
            .map(([date, revenue]) => ({ date, revenue: Math.round(revenue) }))
            .sort((a, b) => a.date.localeCompare(b.date));

        res.json({
            period: { from: startDate.toISOString(), to: endDate.toISOString(), days },
            summary: {
                totalRevenue: Math.round(totalRevenue),
                avgDailyRevenue: Math.round(totalRevenue / days),
                avgTransactionValue: transactionCount > 0 ? Math.round(totalRevenue / transactionCount) : 0,
                transactionCount,
                paymentSplit: {
                    cash: Math.round(totalCash),
                    card: Math.round(totalCard),
                    cashPercent: totalRevenue > 0 ? Math.round((totalCash / totalRevenue) * 100) : 0,
                },
            },
            peakHour: peakHour ? { hour: parseInt(peakHour[0]), transactions: peakHour[1] } : null,
            topProducts,
            dailyTrend,
            hourlyDistribution: Object.entries(hourlyDistribution)
                .map(([hour, count]) => ({ hour: parseInt(hour), transactions: count }))
                .sort((a, b) => a.hour - b.hour),
        });
    } catch (error: any) {
        log(`Error fetching sales insights: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch sales insights' });
    }
});

// ============================================================================
// CONSUMPTION VELOCITY (Items running out fastest)
// ============================================================================

router.get('/consumption-velocity', async (req, res) => {
    try {
        const days = Number(req.query.days) || 14;

        if (!isPosterPOSInitialized()) {
            return res.json({ items: [], message: 'PosterPOS not initialized' });
        }

        const client = getPosterPOSClient();

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const dateFrom = startDate.toISOString().split('T')[0].replace(/-/g, '');
        const dateTo = endDate.toISOString().split('T')[0].replace(/-/g, '');

        // Get movements
        const movements = await client.getIngredientMovements(dateFrom, dateTo);

        // Calculate velocity and days remaining
        const velocityItems = movements.map(item => {
            const totalConsumed = Math.abs(item.write_offs || 0);
            const avgDailyConsumption = totalConsumed / days;
            const currentStock = item.end || 0;
            const daysRemaining = avgDailyConsumption > 0
                ? currentStock / avgDailyConsumption
                : 999;

            return {
                ingredientId: item.ingredient_id,
                name: item.ingredient_name,
                unit: 'units',
                currentStock: Math.round(currentStock * 100) / 100,
                avgDailyConsumption: Math.round(avgDailyConsumption * 100) / 100,
                daysRemaining: Math.round(daysRemaining * 10) / 10,
                urgency: daysRemaining <= 2 ? 'critical' : daysRemaining <= 5 ? 'warning' : 'ok',
            };
        });

        // Filter items with consumption and sort by days remaining (most urgent first)
        const filteredItems = velocityItems
            .filter(i => i.avgDailyConsumption > 0)
            .sort((a, b) => a.daysRemaining - b.daysRemaining);

        res.json({
            period: { days },
            items: filteredItems.slice(0, 30),
            alerts: {
                critical: filteredItems.filter(i => i.urgency === 'critical').length,
                warning: filteredItems.filter(i => i.urgency === 'warning').length,
            },
        });
    } catch (error: any) {
        log(`Error calculating consumption velocity: ${error.message}`);
        res.status(500).json({ message: 'Failed to calculate consumption velocity' });
    }
});

// ============================================================================
// STORE INSIGHTS (For when store data accumulates)
// ============================================================================

router.get('/store', async (req, res) => {
    try {
        const days = Number(req.query.days) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get store purchases
        const { data: purchases } = await supabaseAdmin
            .from('store_purchases')
            .select('*, items:store_purchase_items(*)')
            .gte('purchase_date', startDate.toISOString());

        // Get dispatches
        const { data: dispatches } = await supabaseAdmin
            .from('store_despatches')
            .select('*, items:store_despatch_items(*)')
            .gte('despatch_date', startDate.toISOString());

        // Get processed items
        const { data: processed } = await supabaseAdmin
            .from('store_processed_items')
            .select('*')
            .gte('processed_at', startDate.toISOString());

        // Aggregate stats
        let totalPurchaseCost = 0;
        let purchaseItemCount = 0;
        const itemPurchases: Record<string, { name: string; qty: number; cost: number }> = {};

        for (const purchase of purchases || []) {
            totalPurchaseCost += Number(purchase.total_amount) || 0;
            for (const item of purchase.items || []) {
                purchaseItemCount++;
                const name = item.item_name;
                const existing = itemPurchases[name] || { name, qty: 0, cost: 0 };
                existing.qty += Number(item.quantity) || 0;
                existing.cost += Number(item.total_cost) || 0;
                itemPurchases[name] = existing;
            }
        }

        let totalDispatched = 0;
        for (const dispatch of dispatches || []) {
            totalDispatched += dispatch.items?.length || 0;
        }

        // Top purchased items
        const topPurchased = Object.values(itemPurchases)
            .sort((a, b) => b.cost - a.cost)
            .slice(0, 10);

        res.json({
            period: { days, from: startDate.toISOString() },
            hasData: (purchases?.length || 0) > 0,
            summary: {
                totalPurchases: purchases?.length || 0,
                totalPurchaseCost: Math.round(totalPurchaseCost),
                avgPurchaseCost: purchases?.length ? Math.round(totalPurchaseCost / purchases.length) : 0,
                purchaseItemCount,
                totalDispatches: dispatches?.length || 0,
                totalItemsDispatched: totalDispatched,
                totalProcessed: processed?.length || 0,
            },
            topPurchasedItems: topPurchased,
            // Placeholder metrics for when more data accumulates
            metrics: {
                processingEfficiency: null, // % items processed within X hours
                dispatchFillRate: null, // % SRRs fully fulfilled
                stockTurnover: null, // How fast inventory moves
            },
        });
    } catch (error: any) {
        log(`Error fetching store insights: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch store insights' });
    }
});

// ============================================================================
// WASTAGE ANALYSIS (From stock entries marked as wastage)
// ============================================================================

router.get('/wastage', async (req, res) => {
    try {
        const days = Number(req.query.days) || 14;

        // Get reconciliation data
        const { data: reconciliations } = await supabaseAdmin
            .from('stock_reconciliations')
            .select('*')
            .order('date', { ascending: false })
            .limit(days);

        // Get stock entries marked as wastage
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data: wastageEntries } = await supabaseAdmin
            .from('shop_stock_entries')
            .select('*')
            .gte('counted_at', startDate.toISOString())
            .ilike('notes', '%WASTAGE%');

        const wastageByItem: Record<string, { name: string; qty: number; reasons: string[] }> = {};

        for (const entry of wastageEntries || []) {
            const name = entry.item_name;
            const existing = wastageByItem[name] || { name, qty: 0, reasons: [] };
            existing.qty += Math.abs(Number(entry.quantity)) || 0;
            if (entry.notes && !existing.reasons.includes(entry.notes)) {
                existing.reasons.push(entry.notes);
            }
            wastageByItem[name] = existing;
        }

        const wastageList = Object.values(wastageByItem)
            .sort((a, b) => b.qty - a.qty);

        res.json({
            period: { days },
            totalWastageEntries: wastageEntries?.length || 0,
            itemsAffected: wastageList.length,
            wastageByItem: wastageList,
            recentReconciliations: reconciliations?.slice(0, 5) || [],
        });
    } catch (error: any) {
        log(`Error fetching wastage analysis: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch wastage analysis' });
    }
});

// ============================================================================
// DASHBOARD SUMMARY (All key metrics at once)
// ============================================================================

router.get('/dashboard', async (req, res) => {
    try {
        const days = Number(req.query.days) || 7;

        // Build internal responses
        let salesData: any = null;
        let velocityData: any = null;
        let storeData: any = null;

        // Sales insights
        if (isPosterPOSInitialized()) {
            try {
                const client = getPosterPOSClient();
                const transactions = await client.getRecentTransactions(days);

                let totalRevenue = 0;
                let totalCash = 0;
                let totalCard = 0;

                for (const tx of transactions) {
                    totalRevenue += (parseFloat(tx.payed_cash || '0') + parseFloat(tx.payed_card || '0')) / 100;
                    totalCash += parseFloat(tx.payed_cash || '0') / 100;
                    totalCard += parseFloat(tx.payed_card || '0') / 100;
                }

                salesData = {
                    totalRevenue: Math.round(totalRevenue),
                    avgDailyRevenue: Math.round(totalRevenue / days),
                    transactionCount: transactions.length,
                    paymentSplit: {
                        cash: Math.round(totalCash),
                        card: Math.round(totalCard),
                    },
                };

                // Velocity
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - days);
                const dateFrom = startDate.toISOString().split('T')[0].replace(/-/g, '');
                const dateTo = endDate.toISOString().split('T')[0].replace(/-/g, '');

                const movements = await client.getIngredientMovements(dateFrom, dateTo);
                const velocityItems = movements
                    .map(item => {
                        const consumed = Math.abs(item.write_offs || 0);
                        const avgDaily = consumed / days;
                        const current = item.end || 0;
                        const daysLeft = avgDaily > 0 ? current / avgDaily : 999;
                        return {
                            name: item.ingredient_name,
                            daysRemaining: Math.round(daysLeft * 10) / 10,
                            urgency: daysLeft <= 2 ? 'critical' : daysLeft <= 5 ? 'warning' : 'ok',
                        };
                    })
                    .filter(i => i.urgency !== 'ok')
                    .sort((a, b) => a.daysRemaining - b.daysRemaining);

                velocityData = {
                    criticalItems: velocityItems.filter(i => i.urgency === 'critical').length,
                    warningItems: velocityItems.filter(i => i.urgency === 'warning').length,
                    topUrgent: velocityItems.slice(0, 5),
                };
            } catch (e) {
                // Continue without POS data
            }
        }

        // Store data
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const [{ count: purchaseCount }, { count: dispatchCount }] = await Promise.all([
                supabaseAdmin.from('store_purchases').select('id', { count: 'exact' }).gte('purchase_date', startDate.toISOString()),
                supabaseAdmin.from('store_despatches').select('id', { count: 'exact' }).gte('despatch_date', startDate.toISOString()),
            ]);

            storeData = {
                totalPurchases: purchaseCount || 0,
                totalDispatches: dispatchCount || 0,
            };
        } catch (e) {
            // Continue without store data
        }

        // Wastage count
        let wastageCount = 0;
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            const { count } = await supabaseAdmin
                .from('shop_stock_entries')
                .select('id', { count: 'exact' })
                .gte('counted_at', startDate.toISOString())
                .ilike('notes', '%WASTAGE%');
            wastageCount = count || 0;
        } catch (e) {
            // Continue
        }

        res.json({
            period: { days },
            sales: salesData,
            velocity: velocityData,
            store: storeData,
            wastage: { totalEntries: wastageCount },
        });
    } catch (error: any) {
        log(`Error fetching dashboard: ${error.message}`);
        res.status(500).json({ message: 'Failed to fetch dashboard' });
    }
});

export default router;
