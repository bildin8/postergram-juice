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

async function getSalesRecordsSince(since: Date) {
  const { data, error } = await supabaseAdmin
    .from('sales_records')
    .select('*')
    .gte('timestamp', since.toISOString());
  if (error) return [];
  return (data || []).map(r => ({
    ...r,
    timestamp: new Date(r.timestamp),
  }));
}

async function getReorderRequest(id: string) {
  const { data, error } = await supabaseAdmin
    .from('reorder_requests')
    .select('*')
    .eq('id', id)
    .single();
  return data || undefined;
}

async function createStockSession(session: any) {
  const { data, error } = await supabaseAdmin
    .from('shop_stock_sessions')
    .insert({
      session_type: session.sessionType,
      staff_name: session.staffName,
      status: session.status || 'in_progress',
      total_items: session.totalItems || 0,
      counted_items: session.countedItems || 0,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    ...data,
    sessionType: data.session_type,
    staffName: data.staff_name,
    totalItems: data.total_items,
    countedItems: data.counted_items,
    startedAt: new Date(data.started_at),
  };
}

async function getStockSession(id: string) {
  const { data, error } = await supabaseAdmin
    .from('shop_stock_sessions')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return undefined;
  return {
    ...data,
    sessionType: data.session_type,
    staffName: data.staff_name,
    totalItems: data.total_items,
    countedItems: data.counted_items,
    startedAt: new Date(data.started_at),
  };
}

async function getTodaysStockSession(type: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data, error } = await supabaseAdmin
    .from('shop_stock_sessions')
    .select('*')
    .eq('session_type', type)
    .gte('date', today.toISOString())
    .order('started_at', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return undefined;
  const session = data[0];
  return {
    ...session,
    sessionType: session.session_type,
    staffName: session.staff_name,
    totalItems: session.total_items,
    countedItems: session.counted_items,
    startedAt: new Date(session.started_at),
  };
}

async function getLatestStockSession(type: string) {
  const { data, error } = await supabaseAdmin
    .from('shop_stock_sessions')
    .select('*')
    .eq('session_type', type)
    .order('started_at', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return undefined;
  const session = data[0];
  return {
    ...session,
    sessionType: session.session_type,
    staffName: session.staff_name,
    totalItems: session.total_items,
    countedItems: session.counted_items,
    startedAt: new Date(session.started_at),
  };
}

async function updateStockSession(id: string, updates: any) {
  const updateData: any = {};
  if (updates.status) updateData.status = updates.status;
  if (updates.countedItems !== undefined) updateData.counted_items = updates.countedItems;
  if (updates.completedAt) updateData.completed_at = updates.completedAt.toISOString();

  const { data, error } = await supabaseAdmin
    .from('shop_stock_sessions')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  if (error) return undefined;
  return {
    ...data,
    sessionType: data.session_type,
    staffName: data.staff_name,
    totalItems: data.total_items,
    countedItems: data.counted_items,
  };
}

async function createStockEntry(entry: any) {
  const { data, error } = await supabaseAdmin
    .from('shop_stock_entries')
    .insert({
      session_id: entry.sessionId,
      inventory_item_id: entry.inventoryItemId,
      item_name: entry.itemName,
      poster_pos_id: entry.posterPosId,
      quantity: parseFloat(entry.quantity),
      unit: entry.unit || 'units',
      notes: entry.notes,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getStockEntriesBySession(sessionId: string) {
  const { data, error } = await supabaseAdmin
    .from('shop_stock_entries')
    .select('*')
    .eq('session_id', sessionId);
  if (error) return [];
  return data.map(e => ({
    ...e,
    sessionId: e.session_id,
    itemName: e.item_name,
    posterPosId: e.poster_pos_id,
    inventoryItemId: e.inventory_item_id,
  }));
}

async function updateStockEntry(id: string, updates: any) {
  const { data, error } = await supabaseAdmin
    .from('shop_stock_entries')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) return undefined;
  return data;
}

async function createGoodsReceipt(receipt: any) {
  const { data, error } = await supabaseAdmin
    .from('goods_receipts')
    .insert({
      despatch_log_id: receipt.despatchLogId,
      received_by: receipt.receivedBy,
      status: receipt.status || 'pending',
      notes: receipt.notes,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    ...data,
    despatchLogId: data.despatch_log_id,
    receivedBy: data.received_by,
    receivedAt: new Date(data.received_at),
  };
}

async function getGoodsReceipt(id: string) {
  const { data, error } = await supabaseAdmin
    .from('goods_receipts')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return undefined;
  return {
    ...data,
    despatchLogId: data.despatch_log_id,
    receivedBy: data.received_by,
    receivedAt: new Date(data.received_at),
  };
}

async function getPendingGoodsReceipts() {
  const { data, error } = await supabaseAdmin
    .from('goods_receipts')
    .select('*')
    .eq('status', 'pending');
  if (error) return [];
  return data.map(r => ({
    ...r,
    despatchLogId: r.despatch_log_id,
    receivedBy: r.received_by,
    receivedAt: new Date(r.received_at),
  }));
}

async function getAllGoodsReceipts(limit = 20) {
  const { data, error } = await supabaseAdmin
    .from('goods_receipts')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data.map(r => ({
    ...r,
    despatchLogId: r.despatch_log_id,
    receivedBy: r.received_by,
    receivedAt: new Date(r.received_at),
  }));
}

async function updateGoodsReceipt(id: string, updates: any) {
  const updateData: any = { ...updates };
  if (updates.excelFilePath) {
    updateData.excel_file_path = updates.excelFilePath;
    delete updateData.excelFilePath;
  }
  const { data, error } = await supabaseAdmin
    .from('goods_receipts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  if (error) return undefined;
  return data;
}

async function createGoodsReceiptItem(item: any) {
  const { data, error } = await supabaseAdmin
    .from('goods_receipt_items')
    .insert({
      receipt_id: item.receiptId,
      inventory_item_id: item.inventoryItemId,
      item_name: item.itemName,
      poster_pos_id: item.posterPosId,
      expected_quantity: parseFloat(item.expectedQuantity),
      received_quantity: parseFloat(item.receivedQuantity),
      unit: item.unit || 'units',
      cost_per_unit: item.cost_per_unit ? parseFloat(item.cost_per_unit) : null,
      notes: item.notes,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getGoodsReceiptItems(receiptId: string) {
  const { data, error } = await supabaseAdmin
    .from('goods_receipt_items')
    .select('*')
    .eq('receipt_id', receiptId);
  if (error) return [];
  return data.map(i => ({
    ...i,
    receiptId: i.receipt_id,
    itemName: i.item_name,
    expectedQuantity: i.expected_quantity,
    receivedQuantity: i.received_quantity,
    costPerUnit: i.cost_per_unit,
  }));
}

async function updateGoodsReceiptItem(id: string, updates: any) {
  const { data, error } = await supabaseAdmin
    .from('goods_receipt_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) return undefined;
  return data;
}

async function createExpense(expense: any) {
  const { data, error } = await supabaseAdmin
    .from('shop_expenses')
    .insert({
      expense_type: expense.expenseType,
      category: expense.category,
      description: expense.description,
      amount: parseFloat(expense.amount),
      paid_by: expense.paidBy,
      paid_to: expense.paidTo,
      receipt_number: expense.receiptNumber,
      notes: expense.notes,
      shift_id: expense.shiftId,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    ...data,
    expenseType: data.expense_type,
    receiptNumber: data.receipt_number,
    paidBy: data.paid_by,
    paidTo: data.paid_to,
    shiftId: data.shift_id,
  };
}

async function getExpense(id: string) {
  const { data, error } = await supabaseAdmin
    .from('shop_expenses')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return undefined;
  return {
    ...data,
    expenseType: data.expense_type,
    paidBy: data.paid_by,
  };
}

async function getAllExpenses(limit = 50) {
  const { data, error } = await supabaseAdmin
    .from('shop_expenses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data.map(e => ({
    ...e,
    expenseType: e.expense_type,
  }));
}

async function getExpensesByType(type: string) {
  const { data, error } = await supabaseAdmin
    .from('shop_expenses')
    .select('*')
    .eq('expense_type', type)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data.map(e => ({
    ...e,
    expenseType: e.expense_type,
  }));
}

async function getTodaysExpenses() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data, error } = await supabaseAdmin
    .from('shop_expenses')
    .select('*')
    .gte('created_at', today.toISOString());
  if (error) return [];
  return data.map(e => ({
    ...e,
    expenseType: e.expense_type,
  }));
}

async function createExpenseItem(item: any) {
  const { data, error } = await supabaseAdmin
    .from('expense_items')
    .insert({
      expense_id: item.expenseId,
      inventory_item_id: item.inventoryItemId,
      item_name: item.itemName,
      quantity: parseFloat(item.quantity),
      unit: item.unit || 'units',
      cost_per_unit: item.costPerUnit ? parseFloat(item.costPerUnit) : null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getExpenseItems(expenseId: string) {
  const { data, error } = await supabaseAdmin
    .from('expense_items')
    .select('*')
    .eq('expense_id', expenseId);
  if (error) return [];
  return data.map(i => ({
    ...i,
    expenseId: i.expense_id,
    itemName: i.item_name,
    costPerUnit: i.cost_per_unit,
  }));
}

async function createReconciliation(recon: any) {
  const { data, error } = await supabaseAdmin
    .from('stock_reconciliations')
    .insert({
      date: recon.date || new Date().toISOString(),
      opening_session_id: recon.openingSessionId,
      closing_session_id: recon.closingSessionId,
      status: recon.status || 'pending',
      over_items: recon.overItems || 0,
      under_items: recon.underItems || 0,
      matched_items: recon.matchedItems || 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getReconciliation(id: string) {
  const { data, error } = await supabaseAdmin
    .from('stock_reconciliations')
    .select('*')
    .eq('id', id)
    .single();
  return data || undefined;
}

async function getTodaysReconciliation() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data, error } = await supabaseAdmin
    .from('stock_reconciliations')
    .select('*')
    .gte('date', today.toISOString())
    .limit(1);
  return (data && data.length > 0) ? data[0] : undefined;
}

async function updateReconciliation(id: string, updates: any) {
  const updateData: any = {};
  if (updates.status) updateData.status = updates.status;
  if (updates.sentToOwnerAt) updateData.sent_to_owner_at = updates.sentToOwnerAt.toISOString();

  const { data, error } = await supabaseAdmin
    .from('stock_reconciliations')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  return data || undefined;
}

async function getPendingDespatchForShop() {
  const { data, error } = await supabaseAdmin
    .from('despatch_logs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return [];
  return data.map(d => ({
    ...d,
    itemName: d.item_name,
    inventoryItemId: d.inventory_item_id,
  }));
}

async function getDespatchLog(id: string) {
  const { data, error } = await supabaseAdmin
    .from('despatch_logs')
    .select('*')
    .eq('id', id)
    .single();
  return data || undefined;
}

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

