/**
 * Sales Sync Service
 * Single source of truth for PosterPOS transaction syncing
 * 
 * This service:
 * 1. Polls PosterPOS for new transactions
 * 2. Stores raw transactions (idempotent)
 * 3. Calculates ingredient consumption via recipes
 * 4. Stores pre-calculated consumption
 */

import { supabaseAdmin } from './supabase';
import { getPosterPOSClient, isPosterPOSInitialized, PosterPOSTransaction } from './posterpos';
import { getTelegramBot, isTelegramBotInitialized } from './telegram';
import { log } from './index';

// Sync interval: 5 minutes
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

let syncIntervalId: NodeJS.Timeout | null = null;

// ============================================================================
// SYNC STATUS MANAGEMENT
// ============================================================================

interface SyncStatus {
    lastSyncAt: Date | null;
    lastSyncTimestamp: number | null;
    recordsSynced: number;
    status: 'idle' | 'syncing' | 'error';
    errorMessage: string | null;
}

async function getSyncStatus(): Promise<SyncStatus> {
    const { data } = await supabaseAdmin
        .from('op_sync_status')
        .select('*')
        .eq('sync_type', 'transactions')
        .single();

    return {
        lastSyncAt: data?.last_sync_at ? new Date(data.last_sync_at) : null,
        lastSyncTimestamp: data?.last_sync_timestamp || null,
        recordsSynced: data?.records_synced || 0,
        status: data?.status || 'idle',
        errorMessage: data?.error_message || null,
    };
}

async function updateSyncStatus(updates: Partial<{
    lastSyncAt: Date;
    lastSyncTimestamp: number;
    recordsSynced: number;
    status: string;
    errorMessage: string | null;
}>): Promise<void> {
    const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (updates.lastSyncAt) dbUpdates.last_sync_at = updates.lastSyncAt.toISOString();
    if (updates.lastSyncTimestamp) dbUpdates.last_sync_timestamp = updates.lastSyncTimestamp;
    if (updates.recordsSynced !== undefined) dbUpdates.records_synced = updates.recordsSynced;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.errorMessage !== undefined) dbUpdates.error_message = updates.errorMessage;

    await supabaseAdmin
        .from('op_sync_status')
        .update(dbUpdates)
        .eq('sync_type', 'transactions');
}

// ============================================================================
// CORE SYNC FUNCTION
// ============================================================================

export interface SyncResult {
    success: boolean;
    transactionsSynced: number;
    consumptionRecordsCreated: number;
    errors: string[];
}

export async function syncTransactions(): Promise<SyncResult> {
    const result: SyncResult = {
        success: true,
        transactionsSynced: 0,
        consumptionRecordsCreated: 0,
        errors: [],
    };

    if (!isPosterPOSInitialized()) {
        log('PosterPOS not initialized, skipping sync', 'sales-sync');
        return result;
    }

    try {
        await updateSyncStatus({ status: 'syncing' });

        const client = getPosterPOSClient();
        const status = await getSyncStatus();

        let transactions: PosterPOSTransaction[];

        // Incremental sync if we have a last timestamp
        if (status.lastSyncTimestamp) {
            transactions = await client.getTransactionsSince(status.lastSyncTimestamp);
            log(`Fetching transactions since ${new Date(status.lastSyncTimestamp * 1000).toISOString()}`, 'sales-sync');
        } else {
            // Initial sync: get today's transactions
            transactions = await client.getTodaysTransactions();
            log('Initial sync: fetching today\'s transactions', 'sales-sync');
        }

        log(`Found ${transactions.length} transactions to process`, 'sales-sync');

        let maxCloseTimestamp = status.lastSyncTimestamp || 0;


        for (const transaction of transactions) {
            try {
                // Process transaction
                const processed = await processTransaction(transaction, result);
                if (processed) {
                    if (parseCloseTimestamp(transaction.date_close) > maxCloseTimestamp) {
                        maxCloseTimestamp = parseCloseTimestamp(transaction.date_close);
                    }
                }
            } catch (txError: any) {
                result.errors.push(`Transaction ${transaction.transaction_id}: ${txError.message}`);
            }
        }

        // Update sync status
        await updateSyncStatus({
            lastSyncAt: new Date(),
            lastSyncTimestamp: maxCloseTimestamp,
            recordsSynced: result.transactionsSynced,
            status: 'idle',
            errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
        });

        log(`Sync complete: ${result.transactionsSynced} transactions, ${result.consumptionRecordsCreated} consumption records`, 'sales-sync');

    } catch (error: any) {
        result.success = false;
        result.errors.push(error.message);
        await updateSyncStatus({ status: 'error', errorMessage: error.message });
        log(`Sync failed: ${error.message}`, 'sales-sync');
    }

    return result;
}

export async function backfillTransactions(days: number): Promise<SyncResult> {
    const result: SyncResult = {
        success: true,
        transactionsSynced: 0,
        consumptionRecordsCreated: 0,
        errors: [],
    };

    if (!isPosterPOSInitialized()) {
        log('PosterPOS not initialized, skipping backfill', 'sales-sync');
        return result;
    }

    try {
        log(`Starting backfill for last ${days} days`, 'sales-sync');
        await updateSyncStatus({ status: 'syncing' });

        const client = getPosterPOSClient();

        // Calculate timestamp for N days ago
        const date = new Date();
        date.setDate(date.getDate() - days);
        const timestamp = Math.floor(date.getTime() / 1000); // PosterPOS uses seconds

        log(`Fetching transactions since ${date.toISOString()} (timestamp: ${timestamp})`, 'sales-sync');

        // Use getTransactionsSince with explicit timestamp
        const transactions = await client.getTransactionsSince(timestamp);

        log(`Found ${transactions.length} transactions for backfill`, 'sales-sync');

        for (const transaction of transactions) {
            try {
                await processTransaction(transaction, result);
            } catch (txError: any) {
                result.errors.push(`Transaction ${transaction.transaction_id}: ${txError.message}`);
            }
        }

        // We don't necessarily update 'lastSyncTimestamp' here because backfill might be older than current sync head.
        // But we should update status to idle.
        await updateSyncStatus({
            status: 'idle',
            errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
        });

        log(`Backfill complete: ${result.transactionsSynced} new transactions imported`, 'sales-sync');

    } catch (error: any) {
        result.success = false;
        result.errors.push(error.message);
        await updateSyncStatus({ status: 'error', errorMessage: error.message });
        log(`Backfill failed: ${error.message}`, 'sales-sync');
    }

    return result;
}

async function processTransaction(transaction: PosterPOSTransaction, result: SyncResult): Promise<boolean> {
    // Skip if no products
    if (!transaction.products || transaction.products.length === 0) {
        return false;
    }

    // Check if already synced (idempotent)
    const { data: existing } = await supabaseAdmin
        .from('op_synced_transactions')
        .select('id')
        .eq('poster_transaction_id', transaction.transaction_id)
        .single();

    if (existing) {
        return false; // Already synced
    }

    // Store raw transaction
    const { data: syncedTx, error: txError } = await supabaseAdmin
        .from('op_synced_transactions')
        .insert({
            poster_transaction_id: transaction.transaction_id,
            transaction_date: parseCloseDate(transaction.date_close).toISOString(),
            total_amount: parseFloat(transaction.payed_sum || transaction.sum || '0') / 100,
            pay_type: getPayType(transaction.pay_type),
            payed_cash: parseFloat(transaction.payed_cash || '0') / 100,
            payed_card: parseFloat(transaction.payed_card || '0') / 100,
            products: transaction.products,
        })
        .select()
        .single();

    if (txError) {
        result.errors.push(`Transaction ${transaction.transaction_id}: ${txError.message}`);
        return false;
    }

    result.transactionsSynced++;

    // Calculate and store consumption
    const consumptionCount = await calculateAndStoreConsumption(syncedTx.id, transaction.products);
    result.consumptionRecordsCreated += consumptionCount;

    // Send Telegram notification for new sales
    // Only send notification if it's recent (e.g. within last hour), otherwise backfill spams channel
    const closeDate = parseCloseDate(transaction.date_close);
    const ageInHours = (Date.now() - closeDate.getTime()) / (1000 * 60 * 60);
    if (ageInHours < 1) {
        await sendSaleNotification(transaction);
    }

    return true;
}

// ============================================================================
// CONSUMPTION CALCULATION (Called during sync, NOT on demand)
// ============================================================================

async function calculateAndStoreConsumption(
    transactionId: string,
    products: any[]
): Promise<number> {
    let recordsCreated = 0;

    for (const product of products) {
        const productId = product.product_id?.toString();
        if (!productId) continue;

        const quantity = parseFloat(product.num) || 1;

        // Get recipe for this product
        const { data: recipe } = await supabaseAdmin
            .from('op_recipes')
            .select(`
        id,
        name,
        op_recipe_ingredients(
          ingredient_id,
          quantity,
          unit,
          is_modifier,
          poster_modification_id,
          op_ingredients(name)
        )
      `)
            .eq('poster_product_id', productId)
            .single();

        if (!recipe || !recipe.op_recipe_ingredients) {
            continue; // No recipe found - skip
        }

        // Process base ingredients
        for (const recipeIng of recipe.op_recipe_ingredients) {
            if (recipeIng.is_modifier) continue; // Skip modifiers, handle separately

            const consumptionRecord = {
                transaction_id: transactionId,
                ingredient_id: recipeIng.ingredient_id,
                ingredient_name: (recipeIng as any).op_ingredients?.name || 'Unknown',
                recipe_id: recipe.id,
                recipe_name: recipe.name,
                quantity_consumed: recipeIng.quantity * quantity,
                unit: recipeIng.unit,
                is_modifier: false,
            };

            const { error } = await supabaseAdmin
                .from('op_calculated_consumption')
                .insert(consumptionRecord);

            if (!error) recordsCreated++;
        }

        // Process modifiers if present
        if (product.modifications && Array.isArray(product.modifications)) {
            for (const mod of product.modifications) {
                const modId = mod.dish_modification_id || mod.modification_id;
                if (!modId) continue;

                // Find matching recipe ingredient
                const modIngredient = recipe.op_recipe_ingredients.find(
                    (ri: any) => ri.poster_modification_id === modId.toString()
                );

                if (modIngredient) {
                    const consumptionRecord = {
                        transaction_id: transactionId,
                        ingredient_id: modIngredient.ingredient_id,
                        ingredient_name: (modIngredient as any).op_ingredients?.name || 'Unknown',
                        recipe_id: recipe.id,
                        recipe_name: recipe.name,
                        quantity_consumed: modIngredient.quantity * quantity,
                        unit: modIngredient.unit,
                        is_modifier: true,
                    };

                    const { error } = await supabaseAdmin
                        .from('op_calculated_consumption')
                        .insert(consumptionRecord);

                    if (!error) recordsCreated++;
                }
            }
        }
    }

    return recordsCreated;
}

// ============================================================================
// RECIPE SYNC (Separate from transaction sync)
// ============================================================================

export async function syncRecipes(): Promise<{ recipesUpserted: number; ingredientsUpserted: number }> {
    if (!isPosterPOSInitialized()) {
        return { recipesUpserted: 0, ingredientsUpserted: 0 };
    }

    const client = getPosterPOSClient();
    let recipesUpserted = 0;
    let ingredientsUpserted = 0;

    try {
        // Get all products with recipes
        const products = await client.getAllProductsWithRecipes();

        for (const product of products) {
            // Upsert recipe
            const { data: recipe, error: recipeError } = await supabaseAdmin
                .from('op_recipes')
                .upsert({
                    poster_product_id: product.product_id.toString(),
                    name: product.product_name,
                    category: product.type,
                    last_synced_at: new Date().toISOString(),
                }, { onConflict: 'poster_product_id' })
                .select()
                .single();

            if (recipeError || !recipe) continue;
            recipesUpserted++;

            // Process ingredients
            if (product.ingredients) {
                for (const ing of product.ingredients) {
                    // Upsert ingredient
                    const { data: ingredient } = await supabaseAdmin
                        .from('op_ingredients')
                        .upsert({
                            poster_ingredient_id: ing.ingredient_id,
                            name: ing.ingredient_name,
                            unit: ing.ingredient_unit || 'g',
                        }, { onConflict: 'poster_ingredient_id' })
                        .select()
                        .single();

                    if (!ingredient) continue;
                    ingredientsUpserted++;

                    // Upsert recipe ingredient
                    await supabaseAdmin
                        .from('op_recipe_ingredients')
                        .upsert({
                            recipe_id: recipe.id,
                            ingredient_id: ingredient.id,
                            quantity: ing.structure_netto || ing.structure_brutto || 0,
                            unit: ing.structure_unit || ing.ingredient_unit || 'g',
                            is_modifier: false,
                        }, { onConflict: 'recipe_id,ingredient_id,poster_modification_id' });
                }
            }

            // Process modifications
            if (product.group_modifications) {
                for (const group of product.group_modifications) {
                    for (const mod of group.modifications) {
                        if (!mod.ingredient_id) continue;

                        // Upsert ingredient
                        const { data: ingredient } = await supabaseAdmin
                            .from('op_ingredients')
                            .upsert({
                                poster_ingredient_id: mod.ingredient_id,
                                name: mod.ingredient_name || mod.name,
                                unit: mod.ingredient_unit || 'g',
                            }, { onConflict: 'poster_ingredient_id' })
                            .select()
                            .single();

                        if (!ingredient) continue;

                        // Upsert recipe ingredient (modifier)
                        await supabaseAdmin
                            .from('op_recipe_ingredients')
                            .upsert({
                                recipe_id: recipe.id,
                                ingredient_id: ingredient.id,
                                quantity: mod.netto || mod.brutto || 0,
                                unit: mod.ingredient_unit || 'g',
                                is_modifier: true,
                                modifier_group: group.name,
                                poster_modification_id: mod.dish_modification_id,
                            }, { onConflict: 'recipe_id,ingredient_id,poster_modification_id' });
                    }
                }
            }
        }

        // Update recipe sync status
        await supabaseAdmin
            .from('op_sync_status')
            .update({
                last_sync_at: new Date().toISOString(),
                records_synced: recipesUpserted,
                status: 'idle',
                updated_at: new Date().toISOString(),
            })
            .eq('sync_type', 'recipes');

        log(`Recipe sync complete: ${recipesUpserted} recipes, ${ingredientsUpserted} ingredients`, 'sales-sync');

    } catch (error: any) {
        log(`Recipe sync failed: ${error.message}`, 'sales-sync');
    }

    return { recipesUpserted, ingredientsUpserted };
}

// ============================================================================
// BACKGROUND SYNC CONTROL
// ============================================================================

export function startSalesSync(): void {
    if (syncIntervalId) {
        log('Sales sync already running', 'sales-sync');
        return;
    }

    log(`Starting sales sync with ${SYNC_INTERVAL_MS / 1000 / 60}-minute interval`, 'sales-sync');

    // Run initial sync
    syncTransactions().then(result => {
        log(`Initial sync: ${result.transactionsSynced} transactions`, 'sales-sync');
    });

    // Schedule periodic sync
    syncIntervalId = setInterval(async () => {
        const result = await syncTransactions();
        if (result.transactionsSynced > 0) {
            log(`Periodic sync: ${result.transactionsSynced} new transactions`, 'sales-sync');
        }
    }, SYNC_INTERVAL_MS);
}

export function stopSalesSync(): void {
    if (syncIntervalId) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
        log('Sales sync stopped', 'sales-sync');
    }
}

// ============================================================================
// HELPERS
// ============================================================================

function parseCloseDate(dateValue: string): Date {
    if (!dateValue) return new Date();

    const timestamp = parseInt(dateValue);
    if (!isNaN(timestamp) && timestamp > 0) {
        return timestamp > 1e12 ? new Date(timestamp) : new Date(timestamp * 1000);
    }

    const date = new Date(dateValue.replace(' ', 'T'));
    if (!isNaN(date.getTime())) {
        return date;
    }

    return new Date();
}

function parseCloseTimestamp(dateValue: string): number {
    const date = parseCloseDate(dateValue);
    return Math.floor(date.getTime() / 1000);
}

function getPayType(payType: string): string {
    switch (payType) {
        case '0': return 'cash';
        case '1': return 'card';
        case '2': return 'mixed';
        default: return 'other';
    }
}

async function sendSaleNotification(transaction: PosterPOSTransaction): Promise<void> {
    if (!isTelegramBotInitialized()) return;

    try {
        const bot = getTelegramBot();
        const total = parseFloat(transaction.payed_sum || transaction.sum || '0') / 100;
        const productCount = transaction.products?.length || 0;

        const message = `🧾 *Sale #${transaction.transaction_id}*\n` +
            `💰 KES ${total.toFixed(2)}\n` +
            `📦 ${productCount} items`;

        await bot.sendNotification(message, 'sales');
    } catch (error) {
        // Non-critical, just log
        log(`Failed to send sale notification: ${error}`, 'sales-sync');
    }
}

// ============================================================================
// EXPORTS FOR API ROUTES
// ============================================================================

export { getSyncStatus };
