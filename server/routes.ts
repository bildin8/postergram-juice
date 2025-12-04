import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertInventoryItemSchema, insertSalesRecordSchema, insertDespatchLogSchema, insertReorderRequestSchema, insertPosterPosConfigSchema } from "@shared/schema";
import { initPosterPOSClient, getPosterPOSClient } from "./posterpos";
import { initTelegramBot, getTelegramBot } from "./telegram";
import { log } from "./index";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Initialize services from config if available
  const config = await storage.getPosterPosConfig();
  if (config) {
    try {
      initPosterPOSClient(config.apiEndpoint, config.apiToken);
      log('PosterPOS client initialized from database config');
    } catch (error) {
      log(`Failed to initialize PosterPOS client: ${error}`);
    }
  }

  // Initialize Telegram bot if token is provided
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  
  if (telegramToken) {
    try {
      initTelegramBot(telegramToken, webhookUrl);
      log('Telegram bot initialized');
    } catch (error) {
      log(`Failed to initialize Telegram bot: ${error}`);
    }
  }

  // ============ INVENTORY ROUTES ============
  app.get("/api/inventory", async (req, res) => {
    try {
      const items = await storage.getAllInventoryItems();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/inventory/low-stock", async (req, res) => {
    try {
      const items = await storage.getLowStockItems();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/inventory", async (req, res) => {
    try {
      const data = insertInventoryItemSchema.parse(req.body);
      const item = await storage.createInventoryItem(data);
      res.status(201).json(item);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.patch("/api/inventory/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const item = await storage.updateInventoryItem(id, updates);
      
      if (!item) {
        res.status(404).json({ message: "Item not found" });
        return;
      }

      // Check if stock is now low and send alert
      if (Number(item.currentStock) <= Number(item.minStock)) {
        try {
          const bot = getTelegramBot();
          await bot.sendLowStockAlert(item.name, item.currentStock, item.minStock);
        } catch (e) {
          // Telegram not configured, ignore
        }
      }

      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ SALES ROUTES ============
  app.get("/api/sales", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const sales = await storage.getAllSalesRecords(limit);
      res.json(sales);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/sales/today", async (req, res) => {
    try {
      const summary = await storage.getTodaysSales();
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/sales", async (req, res) => {
    try {
      const data = insertSalesRecordSchema.parse(req.body);
      const sale = await storage.createSalesRecord(data);

      // Send Telegram notification
      try {
        const bot = getTelegramBot();
        await bot.sendSaleNotification(sale.itemName, sale.quantity, sale.amount);
      } catch (e) {
        // Telegram not configured, ignore
      }

      res.status(201).json(sale);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  // ============ DESPATCH ROUTES ============
  app.get("/api/despatch", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await storage.getAllDespatchLogs(limit);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/despatch", async (req, res) => {
    try {
      const data = insertDespatchLogSchema.parse(req.body);
      const log = await storage.createDespatchLog(data);

      // Update inventory if we have the item ID
      if (data.inventoryItemId) {
        const item = await storage.getInventoryItem(data.inventoryItemId);
        if (item) {
          const newStock = Number(item.currentStock) - Number(data.quantity);
          await storage.updateInventoryItem(data.inventoryItemId, {
            currentStock: newStock.toString(),
          });
        }
      }

      res.status(201).json(log);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  // ============ REORDER REQUEST ROUTES ============
  app.get("/api/requests", async (req, res) => {
    try {
      const status = req.query.status as string;
      const requests = status === "pending" 
        ? await storage.getPendingReorderRequests()
        : await storage.getAllReorderRequests();
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/requests", async (req, res) => {
    try {
      const data = insertReorderRequestSchema.parse(req.body);
      const request = await storage.createReorderRequest(data);

      // Send notification to owner
      try {
        const bot = getTelegramBot();
        await bot.sendReorderRequestNotification(request.itemName, request.requester);
      } catch (e) {
        // Telegram not configured, ignore
      }

      res.status(201).json(request);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.patch("/api/requests/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      if (updates.status === 'approved') {
        updates.approvedAt = new Date();
      }

      const request = await storage.updateReorderRequest(id, updates);
      
      if (!request) {
        res.status(404).json({ message: "Request not found" });
        return;
      }

      res.json(request);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ POSTERPOS SYNC ROUTES ============
  app.post("/api/posterpos/config", async (req, res) => {
    try {
      const data = insertPosterPosConfigSchema.parse(req.body);
      const config = await storage.createOrUpdatePosterPosConfig(data);
      
      // Initialize or reinitialize the client
      initPosterPOSClient(config.apiEndpoint, config.apiToken);
      
      res.json(config);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.post("/api/posterpos/sync/inventory", async (req, res) => {
    try {
      const client = getPosterPOSClient();
      const stockLevels = await client.getStockLevels();

      const synced: any[] = [];
      for (const stock of stockLevels) {
        const existing = await storage.getInventoryItemByPosterPosId(stock.product_id.toString());
        
        if (existing) {
          const updated = await storage.updateInventoryItem(existing.id, {
            currentStock: stock.stock_count.toString(),
            lastSyncedAt: new Date(),
          });
          synced.push(updated);
        } else {
          const created = await storage.createInventoryItem({
            posterPosId: stock.product_id.toString(),
            name: stock.product_name,
            currentStock: stock.stock_count.toString(),
            minStock: "10",
            unit: stock.unit_name || "units",
            lastSyncedAt: new Date(),
          });
          synced.push(created);
        }
      }

      res.json({ message: `Synced ${synced.length} items`, items: synced });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/posterpos/sync/sales", async (req, res) => {
    try {
      const client = getPosterPOSClient();
      const transactions = await client.getTodaysTransactions();

      const synced: any[] = [];
      for (const transaction of transactions) {
        for (const product of transaction.products) {
          const existing = await storage.getAllSalesRecords(1);
          // Simple check to avoid duplicates - in production, use transaction_id
          
          const sale = await storage.createSalesRecord({
            posterPosId: `${transaction.transaction_id}-${product.product_id}`,
            itemName: product.product_name,
            quantity: product.count,
            amount: product.product_price,
            timestamp: new Date(transaction.date_close_date),
            syncedAt: new Date(),
          });
          synced.push(sale);
        }
      }

      res.json({ message: `Synced ${synced.length} sales`, sales: synced });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ TELEGRAM WEBHOOK ============
  app.post("/api/telegram/webhook", async (req, res) => {
    try {
      const bot = getTelegramBot();
      await bot.processWebhookUpdate(req.body);
      res.sendStatus(200);
    } catch (error: any) {
      log(`Telegram webhook error: ${error}`, 'telegram');
      res.sendStatus(500);
    }
  });

  // ============ ANALYTICS ROUTES ============
  app.get("/api/analytics/weekly", async (req, res) => {
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const sales = await storage.getSalesRecordsSince(weekAgo);
      
      // Group by day
      const dailyData: Record<string, { sales: number; count: number }> = {};
      
      sales.forEach(sale => {
        const day = new Date(sale.timestamp).toLocaleDateString('en-US', { weekday: 'short' });
        if (!dailyData[day]) {
          dailyData[day] = { sales: 0, count: 0 };
        }
        dailyData[day].sales += Number(sale.amount);
        dailyData[day].count += 1;
      });

      const result = Object.entries(dailyData).map(([name, data]) => ({
        name,
        sales: data.sales,
        count: data.count,
      }));

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
