import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  posterPosId: varchar("poster_pos_id").unique(),
  name: text("name").notNull(),
  currentStock: decimal("current_stock", { precision: 10, scale: 2 }).notNull().default("0"),
  minStock: decimal("min_stock", { precision: 10, scale: 2 }).notNull().default("0"),
  unit: text("unit").notNull().default("units"),
  lastSyncedAt: timestamp("last_synced_at"),
});

export const salesRecords = pgTable("sales_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  posterPosId: varchar("poster_pos_id").unique(),
  itemName: text("item_name").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
});

export const despatchLogs = pgTable("despatch_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inventoryItemId: varchar("inventory_item_id").references(() => inventoryItems.id),
  itemName: text("item_name").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  destination: text("destination").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reorderRequests = pgTable("reorder_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itemName: text("item_name").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  vendor: text("vendor"),
  notes: text("notes"),
  requester: text("requester").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
  approvedBy: text("approved_by"),
});

export const telegramChats = pgTable("telegram_chats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: text("chat_id").notNull().unique(),
  chatType: text("chat_type").notNull(),
  role: text("role").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  registeredAt: timestamp("registered_at").notNull().defaultNow(),
});

export const posterPosConfig = pgTable("poster_pos_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  apiEndpoint: text("api_endpoint").notNull(),
  apiToken: text("api_token").notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
});

// Shop Stock Sessions (Opening/Closing stock counts)
export const shopStockSessions = pgTable("shop_stock_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionType: text("session_type").notNull(), // 'opening' or 'closing'
  status: text("status").notNull().default("in_progress"), // 'in_progress', 'completed'
  staffName: text("staff_name").notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  date: timestamp("date").notNull().defaultNow(), // The business date for this session
  totalItems: integer("total_items").default(0),
  countedItems: integer("counted_items").default(0),
});

// Individual item counts within a stock session
export const shopStockEntries = pgTable("shop_stock_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => shopStockSessions.id).notNull(),
  inventoryItemId: varchar("inventory_item_id").references(() => inventoryItems.id),
  itemName: text("item_name").notNull(),
  posterPosId: varchar("poster_pos_id"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull().default("units"),
  notes: text("notes"),
  countedAt: timestamp("counted_at").notNull().defaultNow(),
});

// Goods Received from Store
export const goodsReceipts = pgTable("goods_receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  despatchLogId: varchar("despatch_log_id").references(() => despatchLogs.id),
  receivedBy: text("received_by").notNull(),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  status: text("status").notNull().default("pending"), // 'pending', 'received', 'partial'
  notes: text("notes"),
  excelFilePath: text("excel_file_path"),
});

// Individual items in a goods receipt
export const goodsReceiptItems = pgTable("goods_receipt_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  receiptId: varchar("receipt_id").references(() => goodsReceipts.id).notNull(),
  inventoryItemId: varchar("inventory_item_id").references(() => inventoryItems.id),
  itemName: text("item_name").notNull(),
  posterPosId: varchar("poster_pos_id"),
  expectedQuantity: decimal("expected_quantity", { precision: 10, scale: 2 }).notNull(),
  receivedQuantity: decimal("received_quantity", { precision: 10, scale: 2 }),
  unit: text("unit").notNull().default("units"),
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 2 }),
  notes: text("notes"),
});

// Shop Expenses (Supermarket purchases and Petty Cash)
export const shopExpenses = pgTable("shop_expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  expenseType: text("expense_type").notNull(), // 'supermarket' or 'petty_cash'
  category: text("category"), // For petty cash: 'staff', 'transport', 'directors', 'mall_bills', 'other'
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paidBy: text("paid_by").notNull(),
  paidTo: text("paid_to"),
  receiptNumber: text("receipt_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Items linked to expenses (for supermarket purchases)
export const expenseItems = pgTable("expense_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  expenseId: varchar("expense_id").references(() => shopExpenses.id).notNull(),
  inventoryItemId: varchar("inventory_item_id").references(() => inventoryItems.id),
  itemName: text("item_name").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull().default("units"),
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 2 }),
});

// ============ MAIN STORE ADMIN TABLES ============

// Store Items - Master list of items managed by the main store
export const storeItems = pgTable("store_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull().default("general"),
  unit: text("unit").notNull().default("pcs"), // pcs, kg, g, ml, L
  minStock: decimal("min_stock", { precision: 10, scale: 2 }).notNull().default("0"),
  currentStock: decimal("current_stock", { precision: 10, scale: 2 }).notNull().default("0"),
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Store Purchases - Items bought from suppliers
export const storePurchases = pgTable("store_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supplier: text("supplier"),
  invoiceNumber: text("invoice_number"),
  purchaseDate: timestamp("purchase_date").notNull().defaultNow(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("received"), // received, partially_processed, fully_processed
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Store Purchase Items - Individual items in a purchase
export const storePurchaseItems = pgTable("store_purchase_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseId: varchar("purchase_id").references(() => storePurchases.id).notNull(),
  storeItemId: varchar("store_item_id").references(() => storeItems.id),
  itemName: text("item_name").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull().default("pcs"),
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  quantityProcessed: decimal("quantity_processed", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("pending"), // pending, partially_processed, fully_processed
});

// Store Processed Items - Items packed and ready for dispatch
export const storeProcessedItems = pgTable("store_processed_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeItemId: varchar("store_item_id").references(() => storeItems.id),
  purchaseItemId: varchar("purchase_item_id").references(() => storePurchaseItems.id),
  itemName: text("item_name").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull().default("pcs"),
  batchNumber: text("batch_number"),
  processedBy: text("processed_by").notNull(),
  processedAt: timestamp("processed_at").notNull().defaultNow(),
  status: text("status").notNull().default("ready"), // ready, dispatched
  notes: text("notes"),
});

// Store Despatches - Shipments sent to the shop
export const storeDespatches = pgTable("store_despatches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  despatchDate: timestamp("despatch_date").notNull().defaultNow(),
  destination: text("destination").notNull().default("Shop"),
  status: text("status").notNull().default("pending"), // pending, in_transit, delivered, confirmed
  totalItems: integer("total_items").notNull().default(0),
  sentBy: text("sent_by").notNull(),
  receivedBy: text("received_by"),
  receivedAt: timestamp("received_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Store Despatch Items - Individual items in a despatch
export const storeDespatchItems = pgTable("store_despatch_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  despatchId: varchar("despatch_id").references(() => storeDespatches.id).notNull(),
  processedItemId: varchar("processed_item_id").references(() => storeProcessedItems.id),
  storeItemId: varchar("store_item_id").references(() => storeItems.id),
  itemName: text("item_name").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull().default("pcs"),
  receivedQuantity: decimal("received_quantity", { precision: 10, scale: 2 }),
  notes: text("notes"),
});

// Store Reorders - Items that need to be reordered from suppliers
export const storeReorders = pgTable("store_reorders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeItemId: varchar("store_item_id").references(() => storeItems.id),
  itemName: text("item_name").notNull(),
  currentStock: decimal("current_stock", { precision: 10, scale: 2 }).notNull(),
  minStock: decimal("min_stock", { precision: 10, scale: 2 }).notNull(),
  suggestedQuantity: decimal("suggested_quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull().default("pcs"),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
  status: text("status").notNull().default("pending"), // pending, ordered, received, cancelled
  orderedAt: timestamp("ordered_at"),
  receivedAt: timestamp("received_at"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Stock Reconciliation Reports
export const stockReconciliations = pgTable("stock_reconciliations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull(),
  openingSessionId: varchar("opening_session_id").references(() => shopStockSessions.id),
  closingSessionId: varchar("closing_session_id").references(() => shopStockSessions.id),
  status: text("status").notNull().default("pending"), // 'pending', 'completed', 'sent'
  overItems: integer("over_items").default(0),
  underItems: integer("under_items").default(0),
  matchedItems: integer("matched_items").default(0),
  sentToOwnerAt: timestamp("sent_to_owner_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({ id: true });
export const insertSalesRecordSchema = createInsertSchema(salesRecords).omit({ id: true });
export const insertDespatchLogSchema = createInsertSchema(despatchLogs).omit({ id: true });
export const insertReorderRequestSchema = createInsertSchema(reorderRequests).omit({ id: true });
export const insertTelegramChatSchema = createInsertSchema(telegramChats).omit({ id: true });
export const insertPosterPosConfigSchema = createInsertSchema(posterPosConfig).omit({ id: true });
export const insertShopStockSessionSchema = createInsertSchema(shopStockSessions).omit({ id: true });
export const insertShopStockEntrySchema = createInsertSchema(shopStockEntries).omit({ id: true });
export const insertGoodsReceiptSchema = createInsertSchema(goodsReceipts).omit({ id: true });
export const insertGoodsReceiptItemSchema = createInsertSchema(goodsReceiptItems).omit({ id: true });
export const insertShopExpenseSchema = createInsertSchema(shopExpenses).omit({ id: true });
export const insertExpenseItemSchema = createInsertSchema(expenseItems).omit({ id: true });
export const insertStockReconciliationSchema = createInsertSchema(stockReconciliations).omit({ id: true });

// Main Store Admin Insert Schemas
export const insertStoreItemSchema = createInsertSchema(storeItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStorePurchaseSchema = createInsertSchema(storePurchases).omit({ id: true, createdAt: true });
export const insertStorePurchaseItemSchema = createInsertSchema(storePurchaseItems).omit({ id: true });
export const insertStoreProcessedItemSchema = createInsertSchema(storeProcessedItems).omit({ id: true });
export const insertStoreDespatchSchema = createInsertSchema(storeDespatches).omit({ id: true, createdAt: true });
export const insertStoreDespatchItemSchema = createInsertSchema(storeDespatchItems).omit({ id: true });
export const insertStoreReorderSchema = createInsertSchema(storeReorders).omit({ id: true, createdAt: true });

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertSalesRecord = z.infer<typeof insertSalesRecordSchema>;
export type SalesRecord = typeof salesRecords.$inferSelect;
export type InsertDespatchLog = z.infer<typeof insertDespatchLogSchema>;
export type DespatchLog = typeof despatchLogs.$inferSelect;
export type InsertReorderRequest = z.infer<typeof insertReorderRequestSchema>;
export type ReorderRequest = typeof reorderRequests.$inferSelect;
export type InsertTelegramChat = z.infer<typeof insertTelegramChatSchema>;
export type TelegramChat = typeof telegramChats.$inferSelect;
export type InsertPosterPosConfig = z.infer<typeof insertPosterPosConfigSchema>;
export type PosterPosConfig = typeof posterPosConfig.$inferSelect;
export type InsertShopStockSession = z.infer<typeof insertShopStockSessionSchema>;
export type ShopStockSession = typeof shopStockSessions.$inferSelect;
export type InsertShopStockEntry = z.infer<typeof insertShopStockEntrySchema>;
export type ShopStockEntry = typeof shopStockEntries.$inferSelect;
export type InsertGoodsReceipt = z.infer<typeof insertGoodsReceiptSchema>;
export type GoodsReceipt = typeof goodsReceipts.$inferSelect;
export type InsertGoodsReceiptItem = z.infer<typeof insertGoodsReceiptItemSchema>;
export type GoodsReceiptItem = typeof goodsReceiptItems.$inferSelect;
export type InsertShopExpense = z.infer<typeof insertShopExpenseSchema>;
export type ShopExpense = typeof shopExpenses.$inferSelect;
export type InsertExpenseItem = z.infer<typeof insertExpenseItemSchema>;
export type ExpenseItem = typeof expenseItems.$inferSelect;
export type InsertStockReconciliation = z.infer<typeof insertStockReconciliationSchema>;
export type StockReconciliation = typeof stockReconciliations.$inferSelect;

// Main Store Admin Types
export type InsertStoreItem = z.infer<typeof insertStoreItemSchema>;
export type StoreItem = typeof storeItems.$inferSelect;
export type InsertStorePurchase = z.infer<typeof insertStorePurchaseSchema>;
export type StorePurchase = typeof storePurchases.$inferSelect;
export type InsertStorePurchaseItem = z.infer<typeof insertStorePurchaseItemSchema>;
export type StorePurchaseItem = typeof storePurchaseItems.$inferSelect;
export type InsertStoreProcessedItem = z.infer<typeof insertStoreProcessedItemSchema>;
export type StoreProcessedItem = typeof storeProcessedItems.$inferSelect;
export type InsertStoreDespatch = z.infer<typeof insertStoreDespatchSchema>;
export type StoreDespatch = typeof storeDespatches.$inferSelect;
export type InsertStoreDespatchItem = z.infer<typeof insertStoreDespatchItemSchema>;
export type StoreDespatchItem = typeof storeDespatchItems.$inferSelect;
export type InsertStoreReorder = z.infer<typeof insertStoreReorderSchema>;
export type StoreReorder = typeof storeReorders.$inferSelect;
