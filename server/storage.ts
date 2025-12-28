/**
 * Storage Layer - Now using Supabase
 * Provides backward-compatible interface for existing code
 */

import { supabaseAdmin } from './supabase';
import { log } from './index';

// ============================================================================
// TELEGRAM CHATS
// ============================================================================

async function getAllTelegramChats() {
  const { data, error } = await supabaseAdmin
    .from('telegram_chats')
    .select('*')
    .eq('is_active', true);

  if (error) {
    log(`Error fetching telegram chats: ${error.message}`, 'storage');
    return [];
  }

  // Map to legacy format
  return (data || []).map(chat => ({
    id: chat.id,
    chatId: chat.chat_id,
    chatType: chat.chat_type,
    role: chat.role,
    isActive: chat.is_active,
    registeredAt: new Date(chat.registered_at),
  }));
}

async function getTelegramChatByChatId(chatId: string) {
  const { data, error } = await supabaseAdmin
    .from('telegram_chats')
    .select('*')
    .eq('chat_id', chatId)
    .single();

  if (error && error.code !== 'PGRST116') {
    log(`Error fetching telegram chat: ${error.message}`, 'storage');
    return undefined;
  }

  if (!data) return undefined;

  return {
    id: data.id,
    chatId: data.chat_id,
    chatType: data.chat_type,
    role: data.role,
    isActive: data.is_active,
    registeredAt: new Date(data.registered_at),
  };
}

async function createTelegramChat(chat: {
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

  return {
    id: data.id,
    chatId: data.chat_id,
    chatType: data.chat_type,
    role: data.role,
    isActive: data.is_active,
    registeredAt: new Date(data.registered_at),
  };
}

async function updateTelegramChat(id: string, updates: { role?: string; isActive?: boolean }) {
  const updateData: any = {};
  if (updates.role !== undefined) updateData.role = updates.role;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

  const { data, error } = await supabaseAdmin
    .from('telegram_chats')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    log(`Error updating telegram chat: ${error.message}`, 'storage');
    return undefined;
  }

  return {
    id: data.id,
    chatId: data.chat_id,
    chatType: data.chat_type,
    role: data.role,
    isActive: data.is_active,
    registeredAt: new Date(data.registered_at),
  };
}

// ============================================================================
// SALES RECORDS
// ============================================================================

async function getAllSalesRecords(limit = 100) {
  const { data, error } = await supabaseAdmin
    .from('sales_records')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    log(`Error fetching sales records: ${error.message}`, 'storage');
    return [];
  }

  return (data || []).map(r => ({
    id: r.id,
    posterPosId: r.poster_pos_id,
    itemName: r.item_name,
    quantity: r.quantity,
    amount: r.amount,
    timestamp: new Date(r.timestamp),
    syncedAt: new Date(r.synced_at),
  }));
}

async function getSalesRecordByPosterPosId(posterPosId: string) {
  const { data, error } = await supabaseAdmin
    .from('sales_records')
    .select('*')
    .eq('poster_pos_id', posterPosId)
    .single();

  if (error && error.code !== 'PGRST116') {
    log(`Error fetching sales record: ${error.message}`, 'storage');
  }

  if (!data) return undefined;

  return {
    id: data.id,
    posterPosId: data.poster_pos_id,
    itemName: data.item_name,
    quantity: data.quantity,
    amount: data.amount,
    timestamp: new Date(data.timestamp),
    syncedAt: new Date(data.synced_at),
  };
}

async function createSalesRecord(record: {
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

  return {
    id: data.id,
    posterPosId: data.poster_pos_id,
    itemName: data.item_name,
    quantity: data.quantity,
    amount: data.amount,
    timestamp: new Date(data.timestamp),
    syncedAt: new Date(data.synced_at),
  };
}

async function getTodaysSales(): Promise<{ total: number; count: number }> {
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
// INVENTORY ITEMS (maps to ingredients table)
// ============================================================================

async function getAllInventoryItems() {
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

  return (data || []).map(item => ({
    id: item.id,
    posterPosId: item.poster_ingredient_id,
    name: item.name,
    currentStock: item.ingredient_stock?.[0]?.current_stock?.toString() || '0',
    minStock: item.min_stock_level?.toString() || '0',
    unit: 'units',
    lastSyncedAt: new Date(item.updated_at),
  }));
}

async function getInventoryItem(id: string) {
  const { data, error } = await supabaseAdmin
    .from('ingredients')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return undefined;

  return {
    id: data.id,
    posterPosId: data.poster_ingredient_id,
    name: data.name,
    currentStock: '0',
    minStock: data.min_stock_level?.toString() || '0',
    unit: 'units',
    lastSyncedAt: new Date(data.updated_at),
  };
}

async function getInventoryItemByPosterPosId(posterPosId: string) {
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
    lastSyncedAt: new Date(data.updated_at),
  };
}

async function createInventoryItem(item: {
  posterPosId?: string;
  name: string;
  currentStock?: string;
  minStock?: string;
  unit?: string;
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
    lastSyncedAt: new Date(data.updated_at),
  };
}

async function updateInventoryItem(id: string, updates: { currentStock?: string; minStock?: string }) {
  const updateData: any = { updated_at: new Date().toISOString() };
  if (updates.minStock) updateData.min_stock_level = parseFloat(updates.minStock);

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
    lastSyncedAt: new Date(data.updated_at),
  };
}

async function getLowStockItems() {
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

// ============================================================================
// REORDER REQUESTS
// ============================================================================

async function getAllReorderRequests() {
  const { data, error } = await supabaseAdmin
    .from('reorder_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    log(`Error fetching reorder requests: ${error.message}`, 'storage');
    return [];
  }

  return (data || []).map(r => ({
    id: r.id,
    itemName: r.item_name,
    quantity: r.quantity,
    unit: r.unit,
    estimatedCost: r.estimated_cost,
    vendor: r.vendor,
    notes: r.notes,
    requester: r.requester,
    status: r.status,
    createdAt: new Date(r.created_at),
    approvedAt: r.approved_at ? new Date(r.approved_at) : undefined,
    approvedBy: r.approved_by,
  }));
}

async function getPendingReorderRequests() {
  const { data, error } = await supabaseAdmin
    .from('reorder_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) return [];

  return (data || []).map(r => ({
    id: r.id,
    itemName: r.item_name,
    quantity: r.quantity,
    unit: r.unit,
    requester: r.requester,
    status: r.status,
    createdAt: new Date(r.created_at),
  }));
}

async function createReorderRequest(request: {
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

  if (error) throw error;

  return {
    id: data.id,
    itemName: data.item_name,
    quantity: data.quantity,
    unit: data.unit,
    requester: data.requester,
    status: data.status,
    createdAt: new Date(data.created_at),
  };
}

async function updateReorderRequest(id: string, updates: any) {
  const { data, error } = await supabaseAdmin
    .from('reorder_requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return undefined;
  return data;
}

// ============================================================================
// DESPATCH LOGS
// ============================================================================

async function getAllDespatchLogs(limit = 50) {
  const { data, error } = await supabaseAdmin
    .from('despatch_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];

  return (data || []).map(d => ({
    id: d.id,
    inventoryItemId: d.inventory_item_id,
    itemName: d.item_name,
    quantity: d.quantity,
    destination: d.destination,
    createdBy: d.created_by,
    createdAt: new Date(d.created_at),
  }));
}

async function createDespatchLog(logData: {
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

  if (error) throw error;

  return {
    id: data.id,
    itemName: data.item_name,
    quantity: data.quantity,
    destination: data.destination,
    createdBy: data.created_by,
    createdAt: new Date(data.created_at),
  };
}

async function createDespatchWithInventoryUpdate(logData: {
  inventoryItemId?: string;
  itemName: string;
  quantity: string;
  destination: string;
  createdBy: string;
}) {
  return createDespatchLog(logData);
}

// ============================================================================
// STUB FUNCTIONS (for backward compatibility)
// ============================================================================

async function getUser(id: string) { return undefined; }
async function getUserByUsername(username: string) { return undefined; }
async function createUser(user: any) { throw new Error('Not implemented'); }
async function getSalesRecordsSince(since: Date) { return []; }
async function getReorderRequest(id: string) { return undefined; }
async function createStockSession(session: any) { throw new Error('Not implemented'); }
async function getStockSession(id: string) { return undefined; }
async function getTodaysStockSession(type: string) { return undefined; }
async function getLatestStockSession(type: string) { return undefined; }
async function updateStockSession(id: string, updates: any) { return undefined; }
async function createStockEntry(entry: any) { throw new Error('Not implemented'); }
async function getStockEntriesBySession(sessionId: string) { return []; }
async function updateStockEntry(id: string, updates: any) { return undefined; }
async function createGoodsReceipt(receipt: any) { throw new Error('Not implemented'); }
async function getGoodsReceipt(id: string) { return undefined; }
async function getPendingGoodsReceipts() { return []; }
async function getAllGoodsReceipts(limit?: number) { return []; }
async function updateGoodsReceipt(id: string, updates: any) { return undefined; }
async function createGoodsReceiptItem(item: any) { throw new Error('Not implemented'); }
async function getGoodsReceiptItems(receiptId: string) { return []; }
async function updateGoodsReceiptItem(id: string, updates: any) { return undefined; }
async function createExpense(expense: any) { throw new Error('Not implemented'); }
async function getExpense(id: string) { return undefined; }
async function getAllExpenses(limit?: number) { return []; }
async function getExpensesByType(type: string) { return []; }
async function getTodaysExpenses() { return []; }
async function createExpenseItem(item: any) { throw new Error('Not implemented'); }
async function getExpenseItems(expenseId: string) { return []; }
async function createReconciliation(recon: any) { throw new Error('Not implemented'); }
async function getReconciliation(id: string) { return undefined; }
async function getTodaysReconciliation() { return undefined; }
async function updateReconciliation(id: string, updates: any) { return undefined; }
async function getPendingDespatchForShop() { return []; }
async function getDespatchLog(id: string) { return undefined; }

// ============================================================================
// EXPORT STORAGE OBJECT
// ============================================================================

export const storage = {
  // Users
  getUser,
  getUserByUsername,
  createUser,

  // Telegram
  getAllTelegramChats,
  getTelegramChatByChatId,
  createTelegramChat,
  updateTelegramChat,

  // Sales
  getAllSalesRecords,
  getSalesRecordsSince,
  getSalesRecordByPosterPosId,
  createSalesRecord,
  getTodaysSales,

  // Inventory
  getAllInventoryItems,
  getInventoryItem,
  getInventoryItemByPosterPosId,
  createInventoryItem,
  updateInventoryItem,
  getLowStockItems,

  // Reorder
  getAllReorderRequests,
  getPendingReorderRequests,
  getReorderRequest,
  createReorderRequest,
  updateReorderRequest,

  // Despatch
  getAllDespatchLogs,
  createDespatchLog,
  createDespatchWithInventoryUpdate,
  getPendingDespatchForShop,
  getDespatchLog,

  // Stock Sessions (stubs)
  createStockSession,
  getStockSession,
  getTodaysStockSession,
  getLatestStockSession,
  updateStockSession,
  createStockEntry,
  getStockEntriesBySession,
  updateStockEntry,

  // Goods Receipts (stubs)
  createGoodsReceipt,
  getGoodsReceipt,
  getPendingGoodsReceipts,
  getAllGoodsReceipts,
  updateGoodsReceipt,
  createGoodsReceiptItem,
  getGoodsReceiptItems,
  updateGoodsReceiptItem,

  // Expenses (stubs)
  createExpense,
  getExpense,
  getAllExpenses,
  getExpensesByType,
  getTodaysExpenses,
  createExpenseItem,
  getExpenseItems,

  // Reconciliation (stubs)
  createReconciliation,
  getReconciliation,
  getTodaysReconciliation,
  updateReconciliation,
};

export default storage;

