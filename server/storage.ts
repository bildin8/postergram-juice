import { db } from "./db";
import { 
  users, 
  inventoryItems, 
  salesRecords, 
  despatchLogs, 
  reorderRequests,
  telegramChats,
  posterPosConfig,
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
  type PosterPosConfig,
  type InsertPosterPosConfig
} from "@shared/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";

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
  createSalesRecord(record: InsertSalesRecord): Promise<SalesRecord>;
  getTodaysSales(): Promise<{ total: number; count: number }>;

  // Despatch Logs
  getAllDespatchLogs(limit?: number): Promise<DespatchLog[]>;
  createDespatchLog(log: InsertDespatchLog): Promise<DespatchLog>;

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

  // PosterPOS Config
  getPosterPosConfig(): Promise<PosterPosConfig | undefined>;
  createOrUpdatePosterPosConfig(config: InsertPosterPosConfig): Promise<PosterPosConfig>;
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
      sql`${inventoryItems.currentStock} <= ${inventoryItems.minStock}`
    );
  }

  // Sales Records
  async getAllSalesRecords(limit: number = 100): Promise<SalesRecord[]> {
    return db.select().from(salesRecords).orderBy(desc(salesRecords.timestamp)).limit(limit);
  }

  async getSalesRecordsSince(since: Date): Promise<SalesRecord[]> {
    return db.select().from(salesRecords).where(gte(salesRecords.timestamp, since)).orderBy(desc(salesRecords.timestamp));
  }

  async createSalesRecord(record: InsertSalesRecord): Promise<SalesRecord> {
    const result = await db.insert(salesRecords).values(record).returning();
    return result[0];
  }

  async getTodaysSales(): Promise<{ total: number; count: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(${salesRecords.amount}), 0)`,
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

  // PosterPOS Config
  async getPosterPosConfig(): Promise<PosterPosConfig | undefined> {
    const result = await db.select().from(posterPosConfig).limit(1);
    return result[0];
  }

  async createOrUpdatePosterPosConfig(config: InsertPosterPosConfig): Promise<PosterPosConfig> {
    const existing = await this.getPosterPosConfig();
    if (existing) {
      const result = await db.update(posterPosConfig).set(config).where(eq(posterPosConfig.id, existing.id)).returning();
      return result[0];
    } else {
      const result = await db.insert(posterPosConfig).values(config).returning();
      return result[0];
    }
  }
}

export const storage = new PostgresStorage();
