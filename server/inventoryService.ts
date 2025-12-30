/**
 * Enhanced Inventory Service
 * Handles ingredient tracking, batch management, and consumption logging
 * with full traceability from purchases to sales
 */

import { supabaseAdmin } from './supabase';
import { getPosterPOSClient, isPosterPOSInitialized } from './posterpos';
import type { ProductWithRecipe, PosterPOSTransaction } from './posterpos';
import { log } from './index';

// Cache for unit IDs
let unitsCache: Map<string, string> | null = null;
let locationsCache: { store: string; kiosk: string } | null = null;

// ============================================================================
// INITIALIZATION & CACHING
// ============================================================================

async function getUnitsMap(): Promise<Map<string, string>> {
    if (unitsCache) return unitsCache;

    const { data: units } = await supabaseAdmin
        .from('units_of_measure')
        .select('id, abbreviation');

    unitsCache = new Map();
    units?.forEach(u => unitsCache!.set(u.abbreviation.toLowerCase(), u.id));
    return unitsCache;
}

async function getLocations(): Promise<{ store: string; kiosk: string }> {
    if (locationsCache) return locationsCache;

    const { data: locations } = await supabaseAdmin
        .from('locations')
        .select('id, type');

    locationsCache = {
        store: locations?.find(l => l.type === 'store')?.id || '',
        kiosk: locations?.find(l => l.type === 'kiosk')?.id || ''
    };

    return locationsCache;
}

// ============================================================================
// RECIPE SYNC FROM POSTER POS
// ============================================================================

export async function syncRecipesFromPoster(): Promise<{
    recipesCreated: number;
    ingredientsCreated: number;
    recipeIngredientsCreated: number;
}> {
    if (!isPosterPOSInitialized()) {
        log('Poster POS not initialized, skipping recipe sync', 'inventory');
        return { recipesCreated: 0, ingredientsCreated: 0, recipeIngredientsCreated: 0 };
    }

    const posterClient = getPosterPOSClient();
    const unitsMap = await getUnitsMap();

    let recipesCreated = 0;
    let ingredientsCreated = 0;
    let recipeIngredientsCreated = 0;

    try {
        // Step 1: Sync ingredients from Poster
        log('Starting ingredient sync from Poster...', 'inventory');
        const posterIngredients = await posterClient.getIngredients();

        for (const ing of posterIngredients) {
            const unitId = unitsMap.get(ing.ingredient_unit?.toLowerCase() || 'g') ||
                unitsMap.get('g');

            const { data: existing } = await supabaseAdmin
                .from('ingredients')
                .select('id')
                .eq('poster_ingredient_id', ing.ingredient_id.toString())
                .single();

            if (!existing) {
                const { error } = await supabaseAdmin.from('ingredients').insert({
                    poster_ingredient_id: ing.ingredient_id.toString(),
                    name: ing.ingredient_name,
                    default_unit_id: unitId,
                    is_active: true
                });

                if (!error) ingredientsCreated++;
            }
        }

        log(`Synced ${ingredientsCreated} new ingredients`, 'inventory');

        // Step 2: Sync products with recipes
        log('Starting recipe sync from Poster...', 'inventory');
        const productsWithRecipes = await posterClient.getAllProductsWithRecipes();
        log(`Found ${productsWithRecipes.length} products with recipes`, 'inventory');

        for (const product of productsWithRecipes) {
            const linked = await syncSingleRecipe(product, unitsMap);
            recipeIngredientsCreated += linked;
            recipesCreated++;
        }

        log(`Synced ${recipesCreated} recipes with ${recipeIngredientsCreated} recipe ingredients`, 'inventory');

        return { recipesCreated, ingredientsCreated, recipeIngredientsCreated };
    } catch (error) {
        log(`Error syncing recipes: ${error}`, 'inventory');
        throw error;
    }
}

async function syncSingleRecipe(
    product: ProductWithRecipe,
    unitsMap: Map<string, string>
): Promise<number> {
    let ingredientsLinked = 0;

    // Upsert the recipe
    const { data: recipe, error: recipeError } = await supabaseAdmin
        .from('recipes')
        .upsert({
            poster_product_id: product.product_id.toString(),
            name: product.product_name,
            recipe_type: product.type || 'product',
            is_active: true,
            last_synced_at: new Date().toISOString()
        }, { onConflict: 'poster_product_id' })
        .select('id')
        .single();

    if (recipeError || !recipe) {
        log(`Error upserting recipe ${product.product_name}: ${recipeError?.message}`, 'inventory');
        return 0;
    }

    // Delete existing recipe ingredients (refresh)
    await supabaseAdmin
        .from('recipe_ingredients')
        .delete()
        .eq('recipe_id', recipe.id);

    // Insert recipe ingredients
    if (product.ingredients && product.ingredients.length > 0) {
        log(`Product ${product.product_name} has ${product.ingredients.length} ingredients`, 'inventory');

        for (const ing of product.ingredients) {
            // Find the ingredient in our database
            const { data: dbIngredient, error: findError } = await supabaseAdmin
                .from('ingredients')
                .select('id')
                .eq('poster_ingredient_id', ing.ingredient_id.toString())
                .single();

            if (findError) {
                log(`Could not find ingredient ${ing.ingredient_id} (${ing.ingredient_name}): ${findError.message}`, 'inventory');
            }

            if (dbIngredient) {
                const unitId = unitsMap.get(ing.structure_unit?.toLowerCase() || 'g');

                const { error: insertError } = await supabaseAdmin.from('recipe_ingredients').insert({
                    recipe_id: recipe.id,
                    ingredient_id: dbIngredient.id,
                    quantity: ing.structure_netto || ing.structure_brutto,
                    unit_id: unitId,
                    is_optional: false,
                    is_default: true
                });

                if (!insertError) {
                    ingredientsLinked++;
                } else {
                    log(`Error inserting recipe_ingredient: ${insertError.message}`, 'inventory');
                }
            }
        }
    }

    // Handle modifications (optional ingredients)
    if (product.group_modifications && product.group_modifications.length > 0) {
        for (const group of product.group_modifications) {
            for (const mod of group.modifications) {
                if (mod.ingredient_id) {
                    const { data: dbIngredient } = await supabaseAdmin
                        .from('ingredients')
                        .select('id')
                        .eq('poster_ingredient_id', mod.ingredient_id.toString())
                        .single();

                    if (dbIngredient) {
                        const { error: insertError } = await supabaseAdmin.from('recipe_ingredients').insert({
                            recipe_id: recipe.id,
                            ingredient_id: dbIngredient.id,
                            quantity: mod.netto || mod.brutto,
                            unit_id: unitsMap.get(mod.ingredient_unit?.toLowerCase() || 'g'),
                            is_optional: true,
                            is_default: false,
                            modification_group: group.name,
                            modification_name: mod.name,
                            poster_modification_id: mod.dish_modification_id
                        });

                        if (!insertError) ingredientsLinked++;
                    }
                }
            }
        }
    }

    return ingredientsLinked;
}

// ============================================================================
// CONSUMPTION LOGGING
// ============================================================================

export async function logSaleConsumption(
    transaction: PosterPOSTransaction,
    products: Array<{
        product_id: string;
        product_name?: string;
        quantity: number;
        modifications?: Array<{ dish_modification_id: string; modification_id?: string }>;
    }>
): Promise<void> {
    const locations = await getLocations();
    const kioskLocationId = locations.kiosk;

    if (!kioskLocationId) {
        log('Kiosk location not found, skipping consumption logging', 'inventory');
        return;
    }

    // Convert timestamp to ISO date string for PostgreSQL
    const rawTimestamp = transaction.date_close || transaction.date_start;
    let saleTimestamp: string;
    if (typeof rawTimestamp === 'number' || /^\d+$/.test(String(rawTimestamp))) {
        // Unix timestamp - convert to ISO string
        const ts = Number(rawTimestamp);
        // If timestamp is in seconds (< 2000000000), convert to milliseconds
        const msTimestamp = ts < 2000000000 ? ts * 1000 : ts;
        saleTimestamp = new Date(msTimestamp).toISOString();
    } else if (rawTimestamp) {
        // Already a date string
        saleTimestamp = new Date(rawTimestamp).toISOString();
    } else {
        saleTimestamp = new Date().toISOString();
    }

    for (const product of products) {
        // Find the recipe for this product
        const { data: recipe } = await supabaseAdmin
            .from('recipes')
            .select(`
        id,
        name,
        recipe_ingredients (
          ingredient_id,
          quantity,
          unit_id,
          is_optional,
          is_default,
          poster_modification_id
        )
      `)
            .eq('poster_product_id', product.product_id)
            .single();

        if (!recipe) {
            log(`Recipe not found for product ${product.product_id}`, 'inventory');
            continue;
        }

        // Get ingredients to consume (default + selected modifications)
        const ingredientsToConsume = recipe.recipe_ingredients.filter(ri => {
            if (!ri.is_optional) return true; // Always include non-optional
            if (ri.is_default) return true; // Include default options

            // Check if this modification was selected
            if (product.modifications && ri.poster_modification_id) {
                return product.modifications.some(
                    m => m.dish_modification_id === ri.poster_modification_id
                );
            }
            return false;
        });

        // Log consumption for each ingredient
        for (const ri of ingredientsToConsume) {
            const quantityToConsume = Number(ri.quantity) * product.quantity;

            // Get current cost from stock
            const { data: stock } = await supabaseAdmin
                .from('ingredient_stock')
                .select('weighted_avg_cost')
                .eq('ingredient_id', ri.ingredient_id)
                .eq('location_id', kioskLocationId)
                .single();

            const costPerUnit = stock?.weighted_avg_cost || 0;

            // Get ingredient name
            const { data: ingredient } = await supabaseAdmin
                .from('ingredients')
                .select('name')
                .eq('id', ri.ingredient_id)
                .single();

            // Insert consumption record
            const { error: insertError } = await supabaseAdmin.from('ingredient_consumption').insert({
                sale_transaction_id: transaction.transaction_id,
                sale_product_id: product.product_id,
                sale_timestamp: saleTimestamp,
                recipe_id: recipe.id,
                recipe_name: recipe.name,
                quantity_sold: product.quantity,
                ingredient_id: ri.ingredient_id,
                ingredient_name: ingredient?.name,
                location_id: kioskLocationId,
                quantity_consumed: quantityToConsume,
                unit_id: ri.unit_id,
                cost_per_unit: costPerUnit,
                total_cost: quantityToConsume * costPerUnit,
                is_modification: ri.is_optional
            });

            if (insertError) {
                log(`ERROR inserting consumption: ${insertError.message}`, 'inventory');
            } else {
                // The trigger will automatically deduct from stock
                log(`Logged consumption: ${quantityToConsume} of ${ingredient?.name} for ${recipe.name}`, 'inventory');
            }
        }
    }
}

// ============================================================================
// BATCH MANAGEMENT
// ============================================================================

export async function createIngredientBatch(params: {
    ingredientId: string;
    locationId: string;
    quantity: number;
    costPerUnit: number;
    purchaseId?: string;
    purchaseItemId?: string;
    batchNumber?: string;
    expiryDate?: string;
}): Promise<string | null> {
    const { data, error } = await supabaseAdmin
        .from('ingredient_batches')
        .insert({
            ingredient_id: params.ingredientId,
            location_id: params.locationId,
            purchase_id: params.purchaseId,
            purchase_item_id: params.purchaseItemId,
            batch_number: params.batchNumber,
            initial_quantity: params.quantity,
            remaining_quantity: params.quantity,
            cost_per_unit: params.costPerUnit,
            total_cost: params.quantity * params.costPerUnit,
            expiry_date: params.expiryDate,
            status: 'active'
        })
        .select('id')
        .single();

    if (error) {
        log(`Error creating batch: ${error.message}`, 'inventory');
        return null;
    }

    // The trigger will automatically update stock and weighted avg cost
    log(`Created batch ${data.id} with ${params.quantity} units`, 'inventory');
    return data.id;
}

// ============================================================================
// STORE → KIOSK TRANSFER
// ============================================================================

export async function transferToKiosk(params: {
    ingredientId: string;
    quantity: number;
    unitId?: string;
    performedBy: string;
    notes?: string;
}): Promise<boolean> {
    const locations = await getLocations();

    if (!locations.store || !locations.kiosk) {
        log('Store or Kiosk location not configured', 'inventory');
        return false;
    }

    // Get current stock at store
    const { data: storeStock } = await supabaseAdmin
        .from('ingredient_stock')
        .select('current_stock, weighted_avg_cost')
        .eq('ingredient_id', params.ingredientId)
        .eq('location_id', locations.store)
        .single();

    if (!storeStock || storeStock.current_stock < params.quantity) {
        log(`Insufficient stock at store for transfer`, 'inventory');
        return false;
    }

    const costPerUnit = storeStock.weighted_avg_cost;

    // Record transfer out from store
    await supabaseAdmin.from('inventory_movements').insert({
        movement_type: 'transfer_out',
        from_location_id: locations.store,
        to_location_id: locations.kiosk,
        ingredient_id: params.ingredientId,
        quantity: -params.quantity, // Negative for outgoing
        unit_id: params.unitId,
        unit_cost: costPerUnit,
        total_cost: params.quantity * costPerUnit,
        performed_by: params.performedBy,
        notes: params.notes
    });

    // Deduct from store stock
    await supabaseAdmin
        .from('ingredient_stock')
        .update({
            current_stock: storeStock.current_stock - params.quantity,
            last_stock_update: new Date().toISOString()
        })
        .eq('ingredient_id', params.ingredientId)
        .eq('location_id', locations.store);

    // Create batch at kiosk (with cost from store)
    await createIngredientBatch({
        ingredientId: params.ingredientId,
        locationId: locations.kiosk,
        quantity: params.quantity,
        costPerUnit: costPerUnit
    });

    // Record transfer in at kiosk
    await supabaseAdmin.from('inventory_movements').insert({
        movement_type: 'transfer_in',
        from_location_id: locations.store,
        to_location_id: locations.kiosk,
        ingredient_id: params.ingredientId,
        quantity: params.quantity, // Positive for incoming
        unit_id: params.unitId,
        unit_cost: costPerUnit,
        total_cost: params.quantity * costPerUnit,
        performed_by: params.performedBy,
        notes: params.notes
    });

    log(`Transferred ${params.quantity} from Store to Kiosk`, 'inventory');
    return true;
}

// ============================================================================
// ANALYTICS
// ============================================================================

export async function getProductProfitability(): Promise<Array<{
    recipe_id: string;
    product_name: string;
    selling_price: number;
    calculated_cogs: number;
    gross_profit: number;
    margin_percentage: number;
}>> {
    const { data, error } = await supabaseAdmin
        .from('v_product_profitability')
        .select('*');

    if (error) {
        log(`Error fetching profitability: ${error.message}`, 'inventory');
        return [];
    }

    return data || [];
}

export async function getCurrentStock(locationId?: string): Promise<Array<{
    ingredient_id: string;
    ingredient_name: string;
    location_name: string;
    current_stock: number;
    unit: string;
    avg_cost: number;
    stock_status: string;
}>> {
    let query = supabaseAdmin
        .from('v_current_stock')
        .select('*');

    if (locationId) {
        query = query.eq('location_id', locationId);
    }

    const { data, error } = await query;

    if (error) {
        log(`Error fetching stock: ${error.message}`, 'inventory');
        return [];
    }

    return data || [];
}

export async function getDailyConsumption(
    startDate: string,
    endDate: string,
    locationId?: string
): Promise<Array<{
    sale_date: string;
    ingredient_name: string;
    total_consumed: number;
    total_cost: number;
    transaction_count: number;
}>> {
    let query = supabaseAdmin
        .from('v_daily_consumption')
        .select('*')
        .gte('sale_date', startDate)
        .lte('sale_date', endDate);

    if (locationId) {
        query = query.eq('location_id', locationId);
    }

    const { data, error } = await query;

    if (error) {
        log(`Error fetching consumption: ${error.message}`, 'inventory');
        return [];
    }

    return data || [];
}

// ============================================================================
// MIGRATION HELPER - Process Historical Transactions
// ============================================================================

export async function processHistoricalTransactions(days: number = 30): Promise<{
    processed: number;
    errors: number;
}> {
    if (!isPosterPOSInitialized()) {
        log('Poster POS not initialized', 'inventory');
        return { processed: 0, errors: 0 };
    }

    const posterClient = getPosterPOSClient();
    let processed = 0;
    let errors = 0;

    try {
        log(`Fetching ${days} days of historical transactions...`, 'inventory');
        const transactions = await posterClient.getRecentTransactions(days);
        log(`Found ${transactions.length} transactions to process`, 'inventory');

        for (const transaction of transactions) {
            if (!transaction.products || transaction.products.length === 0) continue;

            try {
                const products = transaction.products.map(p => ({
                    product_id: p.product_id.toString(),
                    quantity: parseFloat(p.num) || 1,
                    modifications: p.modifications?.map(m => ({
                        dish_modification_id: m.dish_modification_id,
                        modification_id: m.modification_id
                    }))
                }));

                await logSaleConsumption(transaction, products);
                processed++;

                if (processed % 50 === 0) {
                    log(`Processed ${processed}/${transactions.length} transactions`, 'inventory');
                }
            } catch (e) {
                errors++;
                log(`Error processing transaction ${transaction.transaction_id}: ${e}`, 'inventory');
            }
        }

        log(`Historical processing complete: ${processed} processed, ${errors} errors`, 'inventory');
        return { processed, errors };
    } catch (error) {
        log(`Error in historical processing: ${error}`, 'inventory');
        throw error;
    }
}
