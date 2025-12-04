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

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({ id: true });
export const insertSalesRecordSchema = createInsertSchema(salesRecords).omit({ id: true });
export const insertDespatchLogSchema = createInsertSchema(despatchLogs).omit({ id: true });
export const insertReorderRequestSchema = createInsertSchema(reorderRequests).omit({ id: true });
export const insertTelegramChatSchema = createInsertSchema(telegramChats).omit({ id: true });
export const insertPosterPosConfigSchema = createInsertSchema(posterPosConfig).omit({ id: true });

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
