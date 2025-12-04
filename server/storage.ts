import { db } from "./db";
import { 
  users, 
  inventoryItems, 
  salesRecords, 
  despatchLogs, 
  reorderRequests,
  telegramChats,
  shopStockSessions,
  shopStockEntries,
  goodsReceipts,
  goodsReceiptItems,
  shopExpenses,
  expenseItems,
  stockReconciliations,
  type User, 
  type InsertUser,
  type InventoryItem,
  type InsertInventoryItem,
  type SalesRecord,
  type InsertSalesRecord,
  type DespatchLog,
  type InsertDespatchLog,
  type ReorderRequest,
  type InsertReorderRequest,
  type TelegramChat,
  type InsertTelegramChat,
  type ShopStockSession,
  type InsertShopStockSession,
  type ShopStockEntry,
  type InsertShopStockEntry,
  type GoodsReceipt,
  type InsertGoodsReceipt,
  type GoodsReceiptItem,
  type InsertGoodsReceiptItem,
  type ShopExpense,
  type InsertShopExpense,
  type ExpenseItem,
  type InsertExpenseItem,
  type StockReconciliation,
  type InsertStockReconciliation,
} from "@shared/schema";
import { eq, desc, gte, sql, and, between } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Inventory
  getAllInventoryItems(): Promise<InventoryItem[]>;
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  getInventoryItemByPosterPosId(posterPosId: string): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: string, item: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined>;
  getLowStockItems(): Promise<InventoryItem[]>;

  // Sales Records
  getAllSalesRecords(limit?: number): Promise<SalesRecord[]>;
  getSalesRecordsSince(since: Date): Promise<SalesRecord[]>;
  getSalesRecordByPosterPosId(posterPosId: string): Promise<SalesRecord | undefined>;
  createSalesRecord(record: InsertSalesRecord): Promise<SalesRecord>;
  getTodaysSales(): Promise<{ total: number; count: number }>;

  // Despatch Logs
  getAllDespatchLogs(limit?: number): Promise<DespatchLog[]>;
  createDespatchLog(log: InsertDespatchLog): Promise<DespatchLog>;
  createDespatchWithInventoryUpdate(log: InsertDespatchLog): Promise<DespatchLog>;

  // Reorder Requests
  getAllReorderRequests(): Promise<ReorderRequest[]>;
  getPendingReorderRequests(): Promise<ReorderRequest[]>;
  getReorderRequest(id: string): Promise<ReorderRequest | undefined>;
  createReorderRequest(request: InsertReorderRequest): Promise<ReorderRequest>;
  updateReorderRequest(id: string, updates: Partial<InsertReorderRequest>): Promise<ReorderRequest | undefined>;

  // Telegram Chats
  getAllTelegramChats(): Promise<TelegramChat[]>;
  getTelegramChatByChatId(chatId: string): Promise<TelegramChat | undefined>;
  createTelegramChat(chat: InsertTelegramChat): Promise<TelegramChat>;
  updateTelegramChat(id: string, updates: Partial<InsertTelegramChat>): Promise<TelegramChat | undefined>;

  // Shop Stock Sessions
  createStockSession(session: InsertShopStockSession): Promise<ShopStockSession>;
  getStockSession(id: string): Promise<ShopStockSession | undefined>;
  getTodaysStockSession(type: 'opening' | 'closing'): Promise<ShopStockSession | undefined>;
  getLatestStockSession(type: 'opening' | 'closing'): Promise<ShopStockSession | undefined>;
  updateStockSession(id: string, updates: Partial<InsertShopStockSession>): Promise<ShopStockSession | undefined>;
  
  // Shop Stock Entries
  createStockEntry(entry: InsertShopStockEntry): Promise<ShopStockEntry>;
  getStockEntriesBySession(sessionId: string): Promise<ShopStockEntry[]>;
  updateStockEntry(id: string, updates: Partial<InsertShopStockEntry>): Promise<ShopStockEntry | undefined>;

  // Goods Receipts
  createGoodsReceipt(receipt: InsertGoodsReceipt): Promise<GoodsReceipt>;
  getGoodsReceipt(id: string): Promise<GoodsReceipt | undefined>;
  getPendingGoodsReceipts(): Promise<GoodsReceipt[]>;
  getAllGoodsReceipts(limit?: number): Promise<GoodsReceipt[]>;
  updateGoodsReceipt(id: string, updates: Partial<InsertGoodsReceipt>): Promise<GoodsReceipt | undefined>;

  // Goods Receipt Items
  createGoodsReceiptItem(item: InsertGoodsReceiptItem): Promise<GoodsReceiptItem>;
  getGoodsReceiptItems(receiptId: string): Promise<GoodsReceiptItem[]>;
  updateGoodsReceiptItem(id: string, updates: Partial<InsertGoodsReceiptItem>): Promise<GoodsReceiptItem | undefined>;

  // Shop Expenses
  createExpense(expense: InsertShopExpense): Promise<ShopExpense>;
  getExpense(id: string): Promise<ShopExpense | undefined>;
  getAllExpenses(limit?: number): Promise<ShopExpense[]>;
  getExpensesByType(type: string): Promise<ShopExpense[]>;
  getTodaysExpenses(): Promise<ShopExpense[]>;

  // Expense Items
  createExpenseItem(item: InsertExpenseItem): Promise<ExpenseItem>;
  getExpenseItems(expenseId: string): Promise<ExpenseItem[]>;

  // Stock Reconciliation
  createReconciliation(recon: InsertStockReconciliation): Promise<StockReconciliation>;
  getReconciliation(id: string): Promise<StockReconciliation | undefined>;
  getTodaysReconciliation(): Promise<StockReconciliation | undefined>;
  updateReconciliation(id: string, updates: Partial<InsertStockReconciliation>): Promise<StockReconciliation | undefined>;

  // Pending Despatch for Shop
  getPendingDespatchForShop(): Promise<DespatchLog[]>;
  getDespatchLog(id: string): Promise<DespatchLog | undefined>;
}

export class PostgresStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  // Inventory
  async getAllInventoryItems(): Promise<InventoryItem[]> {
    return db.select().from(inventoryItems);
  }

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    const result = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1);
    return result[0];
  }

  async getInventoryItemByPosterPosId(posterPosId: string): Promise<InventoryItem | undefined> {
    const result = await db.select().from(inventoryItems).where(eq(inventoryItems.posterPosId, posterPosId)).limit(1);
    return result[0];
  }

  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    const result = await db.insert(inventoryItems).values(item).returning();
    return result[0];
  }

  async updateInventoryItem(id: string, item: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    const result = await db.update(inventoryItems).set(item).where(eq(inventoryItems.id, id)).returning();
    return result[0];
  }

  async getLowStockItems(): Promise<InventoryItem[]> {
    return db.select().from(inventoryItems).where(
      sql`CAST(${inventoryItems.currentStock} AS DECIMAL) <= CAST(${inventoryItems.minStock} AS DECIMAL)`
    );
  }

  // Sales Records
  async getAllSalesRecords(limit: number = 100): Promise<SalesRecord[]> {
    return db.select().from(salesRecords).orderBy(desc(salesRecords.timestamp)).limit(limit);
  }

  async getSalesRecordsSince(since: Date): Promise<SalesRecord[]> {
    return db.select().from(salesRecords).where(gte(salesRecords.timestamp, since)).orderBy(desc(salesRecords.timestamp));
  }

  async getSalesRecordByPosterPosId(posterPosId: string): Promise<SalesRecord | undefined> {
    const result = await db.select().from(salesRecords).where(eq(salesRecords.posterPosId, posterPosId)).limit(1);
    return result[0];
  }

  async createSalesRecord(record: InsertSalesRecord): Promise<SalesRecord> {
    const result = await db.insert(salesRecords).values(record).returning();
    return result[0];
  }

  async getTodaysSales(): Promise<{ total: number; count: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(CAST(${salesRecords.amount} AS DECIMAL)), 0)`,
      count: sql<number>`COUNT(*)::int`
    }).from(salesRecords).where(gte(salesRecords.timestamp, today));

    return {
      total: Number(result[0].total),
      count: result[0].count
    };
  }

  // Despatch Logs
  async getAllDespatchLogs(limit: number = 50): Promise<DespatchLog[]> {
    return db.select().from(despatchLogs).orderBy(desc(despatchLogs.createdAt)).limit(limit);
  }

  async createDespatchLog(log: InsertDespatchLog): Promise<DespatchLog> {
    const result = await db.insert(despatchLogs).values(log).returning();
    return result[0];
  }

  async createDespatchWithInventoryUpdate(log: InsertDespatchLog): Promise<DespatchLog> {
    // Use a transaction to ensure atomic operations
    return await db.transaction(async (tx) => {
      // Create the despatch log
      const [despatch] = await tx.insert(despatchLogs).values(log).returning();
      
      // Update inventory if we have the item ID
      if (log.inventoryItemId) {
        const [item] = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, log.inventoryItemId)).limit(1);
        
        if (item) {
          const newStock = Math.max(0, Number(item.currentStock) - Number(log.quantity));
          await tx.update(inventoryItems).set({
            currentStock: newStock.toString(),
          }).where(eq(inventoryItems.id, log.inventoryItemId));
        }
      }
      
      return despatch;
    });
  }

  // Reorder Requests
  async getAllReorderRequests(): Promise<ReorderRequest[]> {
    return db.select().from(reorderRequests).orderBy(desc(reorderRequests.createdAt));
  }

  async getPendingReorderRequests(): Promise<ReorderRequest[]> {
    return db.select().from(reorderRequests).where(eq(reorderRequests.status, "pending")).orderBy(desc(reorderRequests.createdAt));
  }

  async getReorderRequest(id: string): Promise<ReorderRequest | undefined> {
    const result = await db.select().from(reorderRequests).where(eq(reorderRequests.id, id)).limit(1);
    return result[0];
  }

  async createReorderRequest(request: InsertReorderRequest): Promise<ReorderRequest> {
    const result = await db.insert(reorderRequests).values(request).returning();
    return result[0];
  }

  async updateReorderRequest(id: string, updates: Partial<InsertReorderRequest>): Promise<ReorderRequest | undefined> {
    const result = await db.update(reorderRequests).set(updates).where(eq(reorderRequests.id, id)).returning();
    return result[0];
  }

  // Telegram Chats
  async getAllTelegramChats(): Promise<TelegramChat[]> {
    return db.select().from(telegramChats).where(eq(telegramChats.isActive, true));
  }

  async getTelegramChatByChatId(chatId: string): Promise<TelegramChat | undefined> {
    const result = await db.select().from(telegramChats).where(eq(telegramChats.chatId, chatId)).limit(1);
    return result[0];
  }

  async createTelegramChat(chat: InsertTelegramChat): Promise<TelegramChat> {
    const result = await db.insert(telegramChats).values(chat).returning();
    return result[0];
  }

  async updateTelegramChat(id: string, updates: Partial<InsertTelegramChat>): Promise<TelegramChat | undefined> {
    const result = await db.update(telegramChats).set(updates).where(eq(telegramChats.id, id)).returning();
    return result[0];
  }

  // Shop Stock Sessions
  async createStockSession(session: InsertShopStockSession): Promise<ShopStockSession> {
    const result = await db.insert(shopStockSessions).values(session).returning();
    return result[0];
  }

  async getStockSession(id: string): Promise<ShopStockSession | undefined> {
    const result = await db.select().from(shopStockSessions).where(eq(shopStockSessions.id, id)).limit(1);
    return result[0];
  }

  async getTodaysStockSession(type: 'opening' | 'closing'): Promise<ShopStockSession | undefined> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const result = await db.select().from(shopStockSessions)
      .where(and(
        eq(shopStockSessions.sessionType, type),
        gte(shopStockSessions.date, today),
        sql`${shopStockSessions.date} < ${tomorrow}`
      ))
      .orderBy(desc(shopStockSessions.startedAt))
      .limit(1);
    return result[0];
  }

  async getLatestStockSession(type: 'opening' | 'closing'): Promise<ShopStockSession | undefined> {
    const result = await db.select().from(shopStockSessions)
      .where(eq(shopStockSessions.sessionType, type))
      .orderBy(desc(shopStockSessions.startedAt))
      .limit(1);
    return result[0];
  }

  async updateStockSession(id: string, updates: Partial<InsertShopStockSession>): Promise<ShopStockSession | undefined> {
    const result = await db.update(shopStockSessions).set(updates).where(eq(shopStockSessions.id, id)).returning();
    return result[0];
  }

  // Shop Stock Entries
  async createStockEntry(entry: InsertShopStockEntry): Promise<ShopStockEntry> {
    const result = await db.insert(shopStockEntries).values(entry).returning();
    return result[0];
  }

  async getStockEntriesBySession(sessionId: string): Promise<ShopStockEntry[]> {
    return db.select().from(shopStockEntries).where(eq(shopStockEntries.sessionId, sessionId));
  }

  async updateStockEntry(id: string, updates: Partial<InsertShopStockEntry>): Promise<ShopStockEntry | undefined> {
    const result = await db.update(shopStockEntries).set(updates).where(eq(shopStockEntries.id, id)).returning();
    return result[0];
  }

  // Goods Receipts
  async createGoodsReceipt(receipt: InsertGoodsReceipt): Promise<GoodsReceipt> {
    const result = await db.insert(goodsReceipts).values(receipt).returning();
    return result[0];
  }

  async getGoodsReceipt(id: string): Promise<GoodsReceipt | undefined> {
    const result = await db.select().from(goodsReceipts).where(eq(goodsReceipts.id, id)).limit(1);
    return result[0];
  }

  async getPendingGoodsReceipts(): Promise<GoodsReceipt[]> {
    return db.select().from(goodsReceipts)
      .where(eq(goodsReceipts.status, 'pending'))
      .orderBy(desc(goodsReceipts.receivedAt));
  }

  async getAllGoodsReceipts(limit: number = 50): Promise<GoodsReceipt[]> {
    return db.select().from(goodsReceipts).orderBy(desc(goodsReceipts.receivedAt)).limit(limit);
  }

  async updateGoodsReceipt(id: string, updates: Partial<InsertGoodsReceipt>): Promise<GoodsReceipt | undefined> {
    const result = await db.update(goodsReceipts).set(updates).where(eq(goodsReceipts.id, id)).returning();
    return result[0];
  }

  // Goods Receipt Items
  async createGoodsReceiptItem(item: InsertGoodsReceiptItem): Promise<GoodsReceiptItem> {
    const result = await db.insert(goodsReceiptItems).values(item).returning();
    return result[0];
  }

  async getGoodsReceiptItems(receiptId: string): Promise<GoodsReceiptItem[]> {
    return db.select().from(goodsReceiptItems).where(eq(goodsReceiptItems.receiptId, receiptId));
  }

  async updateGoodsReceiptItem(id: string, updates: Partial<InsertGoodsReceiptItem>): Promise<GoodsReceiptItem | undefined> {
    const result = await db.update(goodsReceiptItems).set(updates).where(eq(goodsReceiptItems.id, id)).returning();
    return result[0];
  }

  // Shop Expenses
  async createExpense(expense: InsertShopExpense): Promise<ShopExpense> {
    const result = await db.insert(shopExpenses).values(expense).returning();
    return result[0];
  }

  async getExpense(id: string): Promise<ShopExpense | undefined> {
    const result = await db.select().from(shopExpenses).where(eq(shopExpenses.id, id)).limit(1);
    return result[0];
  }

  async getAllExpenses(limit: number = 50): Promise<ShopExpense[]> {
    return db.select().from(shopExpenses).orderBy(desc(shopExpenses.createdAt)).limit(limit);
  }

  async getExpensesByType(type: string): Promise<ShopExpense[]> {
    return db.select().from(shopExpenses)
      .where(eq(shopExpenses.expenseType, type))
      .orderBy(desc(shopExpenses.createdAt));
  }

  async getTodaysExpenses(): Promise<ShopExpense[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return db.select().from(shopExpenses)
      .where(gte(shopExpenses.createdAt, today))
      .orderBy(desc(shopExpenses.createdAt));
  }

  // Expense Items
  async createExpenseItem(item: InsertExpenseItem): Promise<ExpenseItem> {
    const result = await db.insert(expenseItems).values(item).returning();
    return result[0];
  }

  async getExpenseItems(expenseId: string): Promise<ExpenseItem[]> {
    return db.select().from(expenseItems).where(eq(expenseItems.expenseId, expenseId));
  }

  // Stock Reconciliation
  async createReconciliation(recon: InsertStockReconciliation): Promise<StockReconciliation> {
    const result = await db.insert(stockReconciliations).values(recon).returning();
    return result[0];
  }

  async getReconciliation(id: string): Promise<StockReconciliation | undefined> {
    const result = await db.select().from(stockReconciliations).where(eq(stockReconciliations.id, id)).limit(1);
    return result[0];
  }

  async getTodaysReconciliation(): Promise<StockReconciliation | undefined> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const result = await db.select().from(stockReconciliations)
      .where(and(
        gte(stockReconciliations.date, today),
        sql`${stockReconciliations.date} < ${tomorrow}`
      ))
      .limit(1);
    return result[0];
  }

  async updateReconciliation(id: string, updates: Partial<InsertStockReconciliation>): Promise<StockReconciliation | undefined> {
    const result = await db.update(stockReconciliations).set(updates).where(eq(stockReconciliations.id, id)).returning();
    return result[0];
  }

  // Pending Despatch for Shop (items sent from Store to Shop)
  async getPendingDespatchForShop(): Promise<DespatchLog[]> {
    return db.select().from(despatchLogs)
      .where(eq(despatchLogs.destination, 'shop'))
      .orderBy(desc(despatchLogs.createdAt));
  }

  async getDespatchLog(id: string): Promise<DespatchLog | undefined> {
    const result = await db.select().from(despatchLogs).where(eq(despatchLogs.id, id)).limit(1);
    return result[0];
  }
}

export const storage = new PostgresStorage();
