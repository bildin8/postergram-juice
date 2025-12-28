/**
 * Supabase Storage Layer
 * Replaces the old Drizzle-based storage.ts with Supabase client
 */

import { supabaseAdmin } from './supabase';
import { log } from './index';

// ============================================================================
// TELEGRAM CHATS
// ============================================================================

export async function getAllTelegramChats() {
    const { data, error } = await supabaseAdmin
        .from('telegram_chats')
        .select('*')
        .eq('is_active', true);

    if (error) {
        log(`Error fetching telegram chats: ${error.message}`, 'storage');
        return [];
    }
    return data || [];
}

export async function getTelegramChatByChatId(chatId: string) {
    const { data, error } = await supabaseAdmin
        .from('telegram_chats')
        .select('*')
        .eq('chat_id', chatId)
        .single();

    if (error && error.code !== 'PGRST116') {
        log(`Error fetching telegram chat: ${error.message}`, 'storage');
    }
    return data || undefined;
}

export async function createTelegramChat(chat: {
    chatId: string;
    chatType: string;
    role: string;
    isActive?: boolean;
}) {
    const { data, error } = await supabaseAdmin
        .from('telegram_chats')
        .insert({
            chat_id: chat.chatId,
            chat_type: chat.chatType,
            role: chat.role,
            is_active: chat.isActive ?? true,
        })
        .select()
        .single();

    if (error) {
        log(`Error creating telegram chat: ${error.message}`, 'storage');
        throw error;
    }
    return data;
}

export async function updateTelegramChat(id: string, updates: Partial<{
    role: string;
    isActive: boolean;
}>) {
    const { data, error } = await supabaseAdmin
        .from('telegram_chats')
        .update({
            role: updates.role,
            is_active: updates.isActive,
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        log(`Error updating telegram chat: ${error.message}`, 'storage');
        return undefined;
    }
    return data;
}

// ============================================================================
// SALES RECORDS  
// ============================================================================

export async function getAllSalesRecords(limit = 100) {
    const { data, error } = await supabaseAdmin
        .from('sales_records')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

    if (error) {
        log(`Error fetching sales records: ${error.message}`, 'storage');
        return [];
    }
    return data || [];
}

export async function getSalesRecordByPosterPosId(posterPosId: string) {
    const { data, error } = await supabaseAdmin
        .from('sales_records')
        .select('*')
        .eq('poster_pos_id', posterPosId)
        .single();

    if (error && error.code !== 'PGRST116') {
        log(`Error fetching sales record: ${error.message}`, 'storage');
    }
    return data || undefined;
}

export async function createSalesRecord(record: {
    posterPosId?: string;
    itemName: string;
    quantity: string;
    amount: string;
    timestamp?: Date;
    syncedAt?: Date;
}) {
    const { data, error } = await supabaseAdmin
        .from('sales_records')
        .insert({
            poster_pos_id: record.posterPosId,
            item_name: record.itemName,
            quantity: record.quantity,
            amount: record.amount,
            timestamp: record.timestamp?.toISOString() || new Date().toISOString(),
            synced_at: record.syncedAt?.toISOString() || new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
        log(`Error creating sales record: ${error.message}`, 'storage');
        throw error;
    }
    return data;
}

export async function getTodaysSales(): Promise<{ total: number; count: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabaseAdmin
        .from('sales_records')
        .select('amount')
        .gte('timestamp', today.toISOString());

    if (error) {
        log(`Error fetching today's sales: ${error.message}`, 'storage');
        return { total: 0, count: 0 };
    }

    const records = data || [];
    const total = records.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);
    return { total, count: records.length };
}

// ============================================================================
// INVENTORY ITEMS (Legacy - now use ingredients table)
// ============================================================================

export async function getAllInventoryItems() {
    const { data, error } = await supabaseAdmin
        .from('ingredients')
        .select(`
      *,
      ingredient_stock (
        current_stock,
        weighted_avg_cost,
        location_id
      )
    `)
        .eq('is_active', true)
        .order('name');

    if (error) {
        log(`Error fetching inventory items: ${error.message}`, 'storage');
        return [];
    }

    // Transform to legacy format
    return (data || []).map(item => ({
        id: item.id,
        posterPosId: item.poster_ingredient_id,
        name: item.name,
        currentStock: item.ingredient_stock?.[0]?.current_stock?.toString() || '0',
        minStock: item.min_stock_level?.toString() || '0',
        unit: 'units',
        lastSyncedAt: item.updated_at,
    }));
}

export async function getLowStockItems() {
    const { data, error } = await supabaseAdmin
        .from('v_current_stock')
        .select('*')
        .in('stock_status', ['low_stock', 'out_of_stock']);

    if (error) {
        log(`Error fetching low stock items: ${error.message}`, 'storage');
        return [];
    }

    return (data || []).map(item => ({
        id: item.ingredient_id,
        name: item.ingredient_name,
        currentStock: item.current_stock?.toString() || '0',
        minStock: item.min_stock_level?.toString() || '0',
        unit: item.unit || 'units',
    }));
}

export async function getInventoryItemByPosterPosId(posterPosId: string) {
    const { data, error } = await supabaseAdmin
        .from('ingredients')
        .select('*')
        .eq('poster_ingredient_id', posterPosId)
        .single();

    if (error && error.code !== 'PGRST116') {
        log(`Error fetching inventory item: ${error.message}`, 'storage');
    }

    if (!data) return undefined;

    return {
        id: data.id,
        posterPosId: data.poster_ingredient_id,
        name: data.name,
        currentStock: '0',
        minStock: data.min_stock_level?.toString() || '0',
        unit: 'units',
        lastSyncedAt: data.updated_at,
    };
}

export async function createInventoryItem(item: {
    posterPosId?: string;
    name: string;
    currentStock?: string;
    minStock?: string;
    unit?: string;
    lastSyncedAt?: Date;
}) {
    const { data, error } = await supabaseAdmin
        .from('ingredients')
        .insert({
            poster_ingredient_id: item.posterPosId,
            name: item.name,
            min_stock_level: parseFloat(item.minStock || '0'),
            is_active: true,
        })
        .select()
        .single();

    if (error) {
        log(`Error creating inventory item: ${error.message}`, 'storage');
        throw error;
    }

    return {
        id: data.id,
        posterPosId: data.poster_ingredient_id,
        name: data.name,
        currentStock: item.currentStock || '0',
        minStock: data.min_stock_level?.toString() || '0',
        unit: item.unit || 'units',
        lastSyncedAt: data.updated_at,
    };
}

export async function updateInventoryItem(id: string, updates: {
    currentStock?: string;
    minStock?: string;
    lastSyncedAt?: Date;
}) {
    const updateData: any = {};
    if (updates.minStock) updateData.min_stock_level = parseFloat(updates.minStock);
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
        .from('ingredients')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        log(`Error updating inventory item: ${error.message}`, 'storage');
        return undefined;
    }

    return {
        id: data.id,
        posterPosId: data.poster_ingredient_id,
        name: data.name,
        currentStock: updates.currentStock || '0',
        minStock: data.min_stock_level?.toString() || '0',
        unit: 'units',
        lastSyncedAt: data.updated_at,
    };
}

// ============================================================================
// REORDER REQUESTS
// ============================================================================

export async function getAllReorderRequests() {
    const { data, error } = await supabaseAdmin
        .from('reorder_requests')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        log(`Error fetching reorder requests: ${error.message}`, 'storage');
        return [];
    }
    return data || [];
}

export async function getPendingReorderRequests() {
    const { data, error } = await supabaseAdmin
        .from('reorder_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) {
        log(`Error fetching pending reorder requests: ${error.message}`, 'storage');
        return [];
    }
    return data || [];
}

export async function createReorderRequest(request: {
    itemName: string;
    quantity: string;
    unit: string;
    estimatedCost?: string;
    vendor?: string;
    notes?: string;
    requester: string;
}) {
    const { data, error } = await supabaseAdmin
        .from('reorder_requests')
        .insert({
            item_name: request.itemName,
            quantity: request.quantity,
            unit: request.unit,
            estimated_cost: request.estimatedCost,
            vendor: request.vendor,
            notes: request.notes,
            requester: request.requester,
            status: 'pending',
        })
        .select()
        .single();

    if (error) {
        log(`Error creating reorder request: ${error.message}`, 'storage');
        throw error;
    }
    return data;
}

export async function updateReorderRequest(id: string, updates: any) {
    const { data, error } = await supabaseAdmin
        .from('reorder_requests')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        log(`Error updating reorder request: ${error.message}`, 'storage');
        return undefined;
    }
    return data;
}

// ============================================================================
// DESPATCH LOGS
// ============================================================================

export async function getAllDespatchLogs(limit = 50) {
    const { data, error } = await supabaseAdmin
        .from('despatch_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        log(`Error fetching despatch logs: ${error.message}`, 'storage');
        return [];
    }
    return data || [];
}

export async function createDespatchLog(logData: {
    inventoryItemId?: string;
    itemName: string;
    quantity: string;
    destination: string;
    createdBy: string;
}) {
    const { data, error } = await supabaseAdmin
        .from('despatch_logs')
        .insert({
            inventory_item_id: logData.inventoryItemId,
            item_name: logData.itemName,
            quantity: logData.quantity,
            destination: logData.destination,
            created_by: logData.createdBy,
        })
        .select()
        .single();

    if (error) {
        log(`Error creating despatch log: ${error.message}`, 'storage');
        throw error;
    }
    return data;
}

export async function createDespatchWithInventoryUpdate(logData: {
    inventoryItemId?: string;
    itemName: string;
    quantity: string;
    destination: string;
    createdBy: string;
}) {
    // Create the despatch log
    const despatch = await createDespatchLog(logData);

    // Note: Inventory update is now handled by the new Supabase triggers
    // when using the enhanced inventory system

    return despatch;
}

// ============================================================================
// EXPORT STORAGE OBJECT (Backward Compatibility)
// ============================================================================

export const storage = {
    // Telegram
    getAllTelegramChats,
    getTelegramChatByChatId,
    createTelegramChat,
    updateTelegramChat,

    // Sales
    getAllSalesRecords,
    getSalesRecordByPosterPosId,
    createSalesRecord,
    getTodaysSales,

    // Inventory
    getAllInventoryItems,
    getInventoryItem: async (id: string) => undefined, // Deprecated
    getInventoryItemByPosterPosId,
    createInventoryItem,
    updateInventoryItem,
    getLowStockItems,

    // Reorder
    getAllReorderRequests,
    getPendingReorderRequests,
    getReorderRequest: async (id: string) => undefined, // Not needed
    createReorderRequest,
    updateReorderRequest,

    // Despatch
    getAllDespatchLogs,
    createDespatchLog,
    createDespatchWithInventoryUpdate,
    getPendingDespatchForShop: async () => [],
    getDespatchLog: async (id: string) => undefined,
};

export default storage;
