import { z } from "zod";

// ============================================================================
// CORE TABLES (Legacy/Reference)
// ============================================================================

export const userSchema = z.object({
  id: z.string().uuid().optional(),
  username: z.string(),
  password: z.string(),
});

export const inventoryItemSchema = z.object({
  id: z.string().uuid().optional(),
  posterPosId: z.string().optional().nullable(),
  name: z.string(),
  currentStock: z.string().default("0"),
  minStock: z.string().default("0"),
  unit: z.string().default("units"),
  lastSyncedAt: z.string().datetime().optional().nullable(),
});

export const salesRecordSchema = z.object({
  id: z.string().uuid().optional(),
  posterPosId: z.string().optional().nullable(),
  itemName: z.string(),
  quantity: z.string(),
  amount: z.string(),
  timestamp: z.string().datetime().optional(),
  syncedAt: z.string().datetime().optional(),
});

export const despatchLogSchema = z.object({
  id: z.string().uuid().optional(),
  inventoryItemId: z.string().uuid().optional().nullable(),
  itemName: z.string(),
  quantity: z.string(),
  destination: z.string(),
  createdBy: z.string(),
  createdAt: z.string().datetime().optional(),
});

export const reorderRequestSchema = z.object({
  id: z.string().uuid().optional(),
  itemName: z.string(),
  quantity: z.string(),
  unit: z.string(),
  estimatedCost: z.string().optional().nullable(),
  vendor: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  requester: z.string(),
  status: z.string().default("pending"),
  createdAt: z.string().datetime().optional(),
  approvedAt: z.string().datetime().optional().nullable(),
  approvedBy: z.string().optional().nullable(),
});

export const telegramChatSchema = z.object({
  id: z.string().uuid().optional(),
  chatId: z.string(),
  chatType: z.string(),
  role: z.string(),
  isActive: z.boolean().default(true),
  registeredAt: z.string().datetime().optional(),
});

// Shop Stock Sessions
export const shopStockSessionSchema = z.object({
  id: z.string().uuid().optional(),
  sessionType: z.string(), // 'opening' or 'closing'
  status: z.string().default("in_progress"), // 'in_progress', 'completed'
  staffName: z.string(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional().nullable(),
  date: z.string().datetime().optional(),
  totalItems: z.number().default(0),
  countedItems: z.number().default(0),
});

export const shopStockEntrySchema = z.object({
  id: z.string().uuid().optional(),
  sessionId: z.string().uuid(),
  inventoryItemId: z.string().uuid().optional().nullable(),
  itemName: z.string(),
  posterPosId: z.string().optional().nullable(),
  quantity: z.string(),
  unit: z.string().default("units"),
  notes: z.string().optional().nullable(),
  countedAt: z.string().datetime().optional(),
});

// Goods Received
export const goodsReceiptSchema = z.object({
  id: z.string().uuid().optional(),
  despatchLogId: z.string().uuid().optional().nullable(),
  receivedBy: z.string(),
  receivedAt: z.string().datetime().optional(),
  status: z.string().default("pending"),
  notes: z.string().optional().nullable(),
  excelFilePath: z.string().optional().nullable(),
});

export const goodsReceiptItemSchema = z.object({
  id: z.string().uuid().optional(),
  receiptId: z.string().uuid(),
  inventoryItemId: z.string().uuid().optional().nullable(),
  itemName: z.string(),
  posterPosId: z.string().optional().nullable(),
  expectedQuantity: z.string(),
  receivedQuantity: z.string().optional().nullable(),
  unit: z.string().default("units"),
  costPerUnit: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Shop Expenses
export const shopExpenseSchema = z.object({
  id: z.string().uuid().optional(),
  expenseType: z.string(), // 'supermarket' or 'petty_cash'
  category: z.string().optional().nullable(),
  description: z.string(),
  amount: z.string(),
  paidBy: z.string(),
  paidTo: z.string().optional().nullable(),
  receiptNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  createdAt: z.string().datetime().optional(),
});

export const expenseItemSchema = z.object({
  id: z.string().uuid().optional(),
  expenseId: z.string().uuid(),
  inventoryItemId: z.string().uuid().optional().nullable(),
  itemName: z.string(),
  quantity: z.string(),
  unit: z.string().default("units"),
  costPerUnit: z.string().optional().nullable(),
});

// ============================================================================
// MAIN STORE ADMIN TABLES
// ============================================================================

export const storeItemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  category: z.string().default("general"),
  unit: z.string().default("pcs"),
  minStock: z.string().default("0"),
  currentStock: z.string().default("0"),
  costPerUnit: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const storePurchaseSchema = z.object({
  id: z.string().uuid().optional(),
  supplier: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  purchaseDate: z.string().datetime().optional(),
  totalAmount: z.string().optional().nullable(),
  status: z.string().default("received"),
  notes: z.string().optional().nullable(),
  createdBy: z.string(),
});

export const storePurchaseItemSchema = z.object({
  id: z.string().uuid().optional(),
  purchaseId: z.string().uuid(),
  storeItemId: z.string().uuid().optional().nullable(),
  itemName: z.string(),
  quantity: z.string(),
  unit: z.string().default("pcs"),
  costPerUnit: z.string().optional().nullable(),
  totalCost: z.string().optional().nullable(),
  quantityProcessed: z.string().default("0"),
  status: z.string().default("pending"),
});

export const storeProcessedItemSchema = z.object({
  id: z.string().uuid().optional(),
  storeItemId: z.string().uuid().optional().nullable(),
  purchaseItemId: z.string().uuid().optional().nullable(),
  itemName: z.string(),
  quantity: z.string(),
  unit: z.string().default("pcs"),
  batchNumber: z.string().optional().nullable(),
  processedBy: z.string(),
  processedAt: z.string().datetime().optional(),
  status: z.string().default("ready"),
  notes: z.string().optional().nullable(),
});

export const storeDespatchSchema = z.object({
  id: z.string().uuid().optional(),
  despatchDate: z.string().datetime().optional(),
  destination: z.string().default("Shop"),
  status: z.string().default("pending"),
  totalItems: z.number().default(0),
  sentBy: z.string(),
  receivedBy: z.string().optional().nullable(),
  receivedAt: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const storeDespatchItemSchema = z.object({
  id: z.string().uuid().optional(),
  despatchId: z.string().uuid(),
  processedItemId: z.string().uuid().optional().nullable(),
  storeItemId: z.string().uuid().optional().nullable(),
  itemName: z.string(),
  quantity: z.string(),
  unit: z.string().default("pcs"),
  receivedQuantity: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const storeReorderSchema = z.object({
  id: z.string().uuid().optional(),
  storeItemId: z.string().uuid().optional().nullable(),
  itemName: z.string(),
  currentStock: z.string(),
  minStock: z.string(),
  suggestedQuantity: z.string(),
  unit: z.string().default("pcs"),
  estimatedCost: z.string().optional().nullable(),
  priority: z.string().default("normal"),
  status: z.string().default("pending"),
  orderedAt: z.string().datetime().optional().nullable(),
  receivedAt: z.string().datetime().optional().nullable(),
  createdBy: z.string(),
});

export const stockReconciliationSchema = z.object({
  id: z.string().uuid().optional(),
  date: z.string().datetime(),
  openingSessionId: z.string().uuid().optional().nullable(),
  closingSessionId: z.string().uuid().optional().nullable(),
  status: z.string().default("pending"),
  overItems: z.number().default(0),
  underItems: z.number().default(0),
  matchedItems: z.number().default(0),
  sentToOwnerAt: z.string().datetime().optional().nullable(),
});

// ============================================================================
// INSERT SCHEMAS (Legacy/Reference)
// ============================================================================

export const insertUserSchema = userSchema;
export const insertInventoryItemSchema = inventoryItemSchema;
export const insertSalesRecordSchema = salesRecordSchema;
export const insertDespatchLogSchema = despatchLogSchema;
export const insertReorderRequestSchema = reorderRequestSchema;
export const insertTelegramChatSchema = telegramChatSchema;
export const insertShopStockSessionSchema = shopStockSessionSchema;
export const insertShopStockEntrySchema = shopStockEntrySchema;
export const insertGoodsReceiptSchema = goodsReceiptSchema;
export const insertGoodsReceiptItemSchema = goodsReceiptItemSchema;
export const insertShopExpenseSchema = shopExpenseSchema;
export const insertExpenseItemSchema = expenseItemSchema;
export const insertStockReconciliationSchema = stockReconciliationSchema;
export const insertStoreItemSchema = storeItemSchema;
export const insertStorePurchaseSchema = storePurchaseSchema;
export const insertStorePurchaseItemSchema = storePurchaseItemSchema;
export const insertStoreProcessedItemSchema = storeProcessedItemSchema;
export const insertStoreDespatchSchema = storeDespatchSchema;
export const insertStoreDespatchItemSchema = storeDespatchItemSchema;
export const insertStoreReorderSchema = storeReorderSchema;

// ============================================================================
// TYPES
// ============================================================================

export type User = z.infer<typeof userSchema>;
export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type SalesRecord = z.infer<typeof salesRecordSchema>;
export type DespatchLog = z.infer<typeof despatchLogSchema>;
export type ReorderRequest = z.infer<typeof reorderRequestSchema>;
export type TelegramChat = z.infer<typeof telegramChatSchema>;
export type ShopStockSession = z.infer<typeof shopStockSessionSchema>;
export type ShopStockEntry = z.infer<typeof shopStockEntrySchema>;
export type GoodsReceipt = z.infer<typeof goodsReceiptSchema>;
export type GoodsReceiptItem = z.infer<typeof goodsReceiptItemSchema>;
export type ShopExpense = z.infer<typeof shopExpenseSchema>;
export type ExpenseItem = z.infer<typeof expenseItemSchema>;
export type StockReconciliation = z.infer<typeof stockReconciliationSchema>;
export type StoreItem = z.infer<typeof storeItemSchema>;
export type StorePurchase = z.infer<typeof storePurchaseSchema>;
export type StorePurchaseItem = z.infer<typeof storePurchaseItemSchema>;
export type StoreProcessedItem = z.infer<typeof storeProcessedItemSchema>;
export type StoreDespatch = z.infer<typeof storeDespatchSchema>;
export type StoreDespatchItem = z.infer<typeof storeDespatchItemSchema>;
export type StoreReorder = z.infer<typeof storeReorderSchema>;

// Legacy Drizzle Object exports (stubs to prevent immediate breakage)
// These should be removed eventually

