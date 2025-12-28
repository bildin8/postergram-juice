/**
 * Enhanced Inventory API Routes
 * New endpoints for the Supabase-powered inventory system
 */

import { Router, Request, Response } from 'express';
import { supabaseAdmin } from './supabase';
import {
    syncRecipesFromPoster,
    logSaleConsumption,
    createIngredientBatch,
    transferToKiosk,
    getProductProfitability,
    getCurrentStock,
    getDailyConsumption,
    processHistoricalTransactions
} from './inventoryService';
import { log } from './index';

const router = Router();

// ============================================================================
// RECIPE MANAGEMENT
// ============================================================================

/**
 * Sync recipes from Poster POS
 * POST /api/v2/recipes/sync
 */
router.post('/recipes/sync', async (req: Request, res: Response) => {
    try {
        log('Starting recipe sync from API request', 'api');
        const result = await syncRecipesFromPoster();
        res.json({
            success: true,
            message: 'Recipes synced successfully',
            data: result
        });
    } catch (error: any) {
        log(`Recipe sync failed: ${error.message}`, 'api');
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get all recipes with their ingredients
 * GET /api/v2/recipes
 */
router.get('/recipes', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('recipes')
            .select(`
        *,
        recipe_ingredients (
          id,
          quantity,
          is_optional,
          modification_group,
          modification_name,
          ingredients (
            id,
            name,
            poster_ingredient_id
          )
        )
      `)
            .eq('is_active', true)
            .order('name');

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get a single recipe with full details
 * GET /api/v2/recipes/:id
 */
router.get('/recipes/:id', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('recipes')
            .select(`
        *,
        recipe_ingredients (
          *,
          ingredients (*)
        )
      `)
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        if (!data) {
            return res.status(404).json({ success: false, error: 'Recipe not found' });
        }
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// INGREDIENTS
// ============================================================================

/**
 * Get all ingredients
 * GET /api/v2/ingredients
 */
router.get('/ingredients', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('ingredients')
            .select(`
        *,
        ingredient_stock (
          location_id,
          current_stock,
          weighted_avg_cost,
          locations (name, type)
        )
      `)
            .eq('is_active', true)
            .order('name');

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Create a new ingredient
 * POST /api/v2/ingredients
 */
router.post('/ingredients', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('ingredients')
            .insert(req.body)
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update an ingredient
 * PATCH /api/v2/ingredients/:id
 */
router.patch('/ingredients/:id', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('ingredients')
            .update({ ...req.body, updated_at: new Date().toISOString() })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// STOCK MANAGEMENT
// ============================================================================

/**
 * Get current stock levels (all locations or specific)
 * GET /api/v2/stock?location=store|kiosk
 */
router.get('/stock', async (req: Request, res: Response) => {
    try {
        const { location } = req.query;
        let locationId: string | undefined;

        if (location) {
            const { data: loc } = await supabaseAdmin
                .from('locations')
                .select('id')
                .eq('type', location)
                .single();
            locationId = loc?.id;
        }

        const data = await getCurrentStock(locationId);
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get low stock items
 * GET /api/v2/stock/low
 */
router.get('/stock/low', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('v_current_stock')
            .select('*')
            .in('stock_status', ['low_stock', 'out_of_stock']);

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// BATCHES
// ============================================================================

/**
 * Get all active batches
 * GET /api/v2/batches
 */
router.get('/batches', async (req: Request, res: Response) => {
    try {
        const { ingredient_id, location_id } = req.query;

        let query = supabaseAdmin
            .from('ingredient_batches')
            .select(`
        *,
        ingredients (name),
        locations (name, type)
      `)
            .eq('status', 'active')
            .order('purchase_date', { ascending: true });

        if (ingredient_id) {
            query = query.eq('ingredient_id', ingredient_id as string);
        }
        if (location_id) {
            query = query.eq('location_id', location_id as string);
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Create a batch (typically from a purchase)
 * POST /api/v2/batches
 */
router.post('/batches', async (req: Request, res: Response) => {
    try {
        const batchId = await createIngredientBatch(req.body);
        if (!batchId) {
            return res.status(400).json({ success: false, error: 'Failed to create batch' });
        }
        res.status(201).json({ success: true, data: { id: batchId } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// TRANSFERS (Store → Kiosk)
// ============================================================================

/**
 * Transfer ingredient from Store to Kiosk
 * POST /api/v2/transfers
 */
router.post('/transfers', async (req: Request, res: Response) => {
    try {
        const { ingredientId, quantity, unitId, performedBy, notes } = req.body;

        if (!ingredientId || !quantity || !performedBy) {
            return res.status(400).json({
                success: false,
                error: 'ingredientId, quantity, and performedBy are required'
            });
        }

        const success = await transferToKiosk({
            ingredientId,
            quantity,
            unitId,
            performedBy,
            notes
        });

        if (!success) {
            return res.status(400).json({
                success: false,
                error: 'Transfer failed - check stock levels'
            });
        }

        res.json({ success: true, message: 'Transfer completed successfully' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get transfer history
 * GET /api/v2/transfers
 */
router.get('/transfers', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('inventory_movements')
            .select(`
        *,
        ingredients (name),
        from_location:locations!from_location_id (name),
        to_location:locations!to_location_id (name)
      `)
            .in('movement_type', ['transfer_in', 'transfer_out'])
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// CONSUMPTION & ANALYTICS
// ============================================================================

/**
 * Get consumption history
 * GET /api/v2/consumption?start=YYYY-MM-DD&end=YYYY-MM-DD
 */
router.get('/consumption', async (req: Request, res: Response) => {
    try {
        const { start, end, ingredient_id, recipe_id } = req.query;

        let query = supabaseAdmin
            .from('ingredient_consumption')
            .select(`
        *,
        recipes (name),
        ingredients (name)
      `)
            .order('sale_timestamp', { ascending: false });

        if (start) {
            query = query.gte('sale_timestamp', start as string);
        }
        if (end) {
            query = query.lte('sale_timestamp', end as string);
        }
        if (ingredient_id) {
            query = query.eq('ingredient_id', ingredient_id as string);
        }
        if (recipe_id) {
            query = query.eq('recipe_id', recipe_id as string);
        }

        const { data, error } = await query.limit(500);
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get daily consumption summary
 * GET /api/v2/consumption/daily?start=YYYY-MM-DD&end=YYYY-MM-DD
 */
router.get('/consumption/daily', async (req: Request, res: Response) => {
    try {
        const start = (req.query.start as string) || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = (req.query.end as string) || new Date().toISOString().split('T')[0];
        const locationId = req.query.location_id as string | undefined;

        const data = await getDailyConsumption(start, end, locationId);
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get product profitability
 * GET /api/v2/analytics/profitability
 */
router.get('/analytics/profitability', async (req: Request, res: Response) => {
    try {
        const data = await getProductProfitability();
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// PURCHASES (Enhanced)
// ============================================================================

/**
 * Create a supplier purchase with automatic batch creation
 * POST /api/v2/purchases
 */
router.post('/purchases', async (req: Request, res: Response) => {
    try {
        const { supplier_name, invoice_number, location_id, items, created_by, notes } = req.body;

        // Create purchase record
        const { data: purchase, error: purchaseError } = await supabaseAdmin
            .from('supplier_purchases')
            .insert({
                supplier_name,
                invoice_number,
                location_id,
                status: 'received',
                created_by,
                notes,
                total_amount: items.reduce((sum: number, item: any) => sum + (item.quantity * item.cost_per_unit), 0)
            })
            .select()
            .single();

        if (purchaseError) throw purchaseError;

        // Create purchase items and batches
        for (const item of items) {
            // Create purchase item
            const { data: purchaseItem, error: itemError } = await supabaseAdmin
                .from('supplier_purchase_items')
                .insert({
                    purchase_id: purchase.id,
                    ingredient_id: item.ingredient_id,
                    ingredient_name: item.ingredient_name,
                    ordered_quantity: item.quantity,
                    received_quantity: item.quantity,
                    unit_id: item.unit_id,
                    unit_name: item.unit_name,
                    unit_cost: item.cost_per_unit,
                    total_cost: item.quantity * item.cost_per_unit,
                    status: 'received'
                })
                .select()
                .single();

            if (itemError) {
                log(`Error creating purchase item: ${itemError.message}`, 'api');
                continue;
            }

            // Create batch for this item
            await createIngredientBatch({
                ingredientId: item.ingredient_id,
                locationId: location_id,
                quantity: item.quantity,
                costPerUnit: item.cost_per_unit,
                purchaseId: purchase.id,
                purchaseItemId: purchaseItem?.id,
                batchNumber: invoice_number,
                expiryDate: item.expiry_date
            });
        }

        res.status(201).json({
            success: true,
            data: purchase,
            message: `Purchase created with ${items.length} items and batches`
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get purchase history
 * GET /api/v2/purchases
 */
router.get('/purchases', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('supplier_purchases')
            .select(`
        *,
        locations (name, type),
        supplier_purchase_items (
          *,
          ingredients (name)
        )
      `)
            .order('purchase_date', { ascending: false })
            .limit(50);

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// LOCATIONS
// ============================================================================

/**
 * Get all locations
 * GET /api/v2/locations
 */
router.get('/locations', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('locations')
            .select('*')
            .eq('is_active', true);

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// MIGRATION / HISTORICAL DATA
// ============================================================================

/**
 * Process historical transactions to create consumption records
 * POST /api/v2/migration/historical
 */
router.post('/migration/historical', async (req: Request, res: Response) => {
    try {
        const days = req.body.days || 30;
        log(`Starting historical migration for ${days} days`, 'api');

        const result = await processHistoricalTransactions(days);

        res.json({
            success: true,
            message: `Processed ${result.processed} transactions with ${result.errors} errors`,
            data: result
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// UNITS OF MEASURE
// ============================================================================

/**
 * Get all units of measure
 * GET /api/v2/units
 */
router.get('/units', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('units_of_measure')
            .select('*')
            .order('type')
            .order('name');

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
