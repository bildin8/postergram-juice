import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { z } from "zod";
import { insertInventoryItemSchema, insertSalesRecordSchema, insertDespatchLogSchema, insertReorderRequestSchema } from "@shared/schema";
import { initPosterPOSClient, getPosterPOSClient } from "./posterpos";
import { initTelegramBot, getTelegramBot, isTelegramBotInitialized } from "./telegram";
import { log } from "./index";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Initialize PosterPOS from environment variables (secure)
  const posterEndpoint = process.env.POSTERPOS_API_ENDPOINT;
  const posterToken = process.env.POSTERPOS_API_TOKEN;
  
  if (posterEndpoint && posterToken) {
    try {
      initPosterPOSClient(posterEndpoint, posterToken);
      log('PosterPOS client initialized from environment');
    } catch (error) {
      log(`Failed to initialize PosterPOS client: ${error}`);
    }
  }

  // Initialize Telegram bot from environment variables (secure)
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  
  if (telegramToken) {
    try {
      initTelegramBot(telegramToken, webhookUrl);
      log('Telegram bot initialized from environment');
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
      log(`Error fetching inventory: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch inventory" });
    }
  });

  app.get("/api/inventory/low-stock", async (req, res) => {
    try {
      const items = await storage.getLowStockItems();
      res.json(items);
    } catch (error: any) {
      log(`Error fetching low stock: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch low stock items" });
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
        log(`Error creating inventory item: ${error.message}`);
        res.status(500).json({ message: "Failed to create inventory item" });
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
      const currentStock = Number(item.currentStock);
      const minStock = Number(item.minStock);
      
      if (currentStock <= minStock && isTelegramBotInitialized()) {
        try {
          const bot = getTelegramBot();
          await bot.sendLowStockAlert(item.name, item.currentStock, item.minStock);
        } catch (e) {
          log(`Failed to send low stock alert: ${e}`);
        }
      }

      res.json(item);
    } catch (error: any) {
      log(`Error updating inventory: ${error.message}`);
      res.status(500).json({ message: "Failed to update inventory" });
    }
  });

  // ============ SALES ROUTES ============
  app.get("/api/sales", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const sales = await storage.getAllSalesRecords(limit);
      res.json(sales);
    } catch (error: any) {
      log(`Error fetching sales: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch sales" });
    }
  });

  app.get("/api/sales/today", async (req, res) => {
    try {
      const summary = await storage.getTodaysSales();
      res.json(summary);
    } catch (error: any) {
      log(`Error fetching today's sales: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch today's sales" });
    }
  });

  app.post("/api/sales", async (req, res) => {
    try {
      const data = insertSalesRecordSchema.parse(req.body);
      const sale = await storage.createSalesRecord(data);

      // Send Telegram notification if bot is configured
      if (isTelegramBotInitialized()) {
        try {
          const bot = getTelegramBot();
          await bot.sendSaleNotification(sale.itemName, sale.quantity, sale.amount);
        } catch (e) {
          log(`Failed to send sale notification: ${e}`);
        }
      }

      res.status(201).json(sale);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        log(`Error creating sale: ${error.message}`);
        res.status(500).json({ message: "Failed to create sale" });
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
      log(`Error fetching despatch logs: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch despatch logs" });
    }
  });

  app.post("/api/despatch", async (req, res) => {
    try {
      const data = insertDespatchLogSchema.parse(req.body);
      
      // Use transaction to ensure atomic update
      const result = await storage.createDespatchWithInventoryUpdate(data);
      
      res.status(201).json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        log(`Error creating despatch: ${error.message}`);
        res.status(500).json({ message: "Failed to create despatch log" });
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
      log(`Error fetching requests: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch requests" });
    }
  });

  app.post("/api/requests", async (req, res) => {
    try {
      const data = insertReorderRequestSchema.parse(req.body);
      const request = await storage.createReorderRequest(data);

      // Send notification to owner if bot is configured
      if (isTelegramBotInitialized()) {
        try {
          const bot = getTelegramBot();
          await bot.sendReorderRequestNotification(request.itemName, request.requester);
        } catch (e) {
          log(`Failed to send reorder notification: ${e}`);
        }
      }

      res.status(201).json(request);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        log(`Error creating request: ${error.message}`);
        res.status(500).json({ message: "Failed to create request" });
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
      log(`Error updating request: ${error.message}`);
      res.status(500).json({ message: "Failed to update request" });
    }
  });

  // ============ POSTERPOS SYNC ROUTES ============
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
      log(`Error syncing inventory: ${error.message}`);
      res.status(500).json({ message: error.message || "Failed to sync inventory" });
    }
  });

  app.post("/api/posterpos/sync/sales", async (req, res) => {
    try {
      const client = getPosterPOSClient();
      const transactions = await client.getTodaysTransactions();

      const synced: any[] = [];
      for (const transaction of transactions) {
        for (const product of transaction.products) {
          const posterPosId = `${transaction.transaction_id}-${product.product_id}`;
          
          // Check if already synced to avoid duplicates
          const existing = await storage.getSalesRecordByPosterPosId(posterPosId);
          if (existing) continue;
          
          const sale = await storage.createSalesRecord({
            posterPosId,
            itemName: product.product_name,
            quantity: product.num,
            amount: product.product_sum.toString(),
            timestamp: new Date(transaction.date_close),
            syncedAt: new Date(),
          });
          synced.push(sale);
        }
      }

      res.json({ message: `Synced ${synced.length} sales`, sales: synced });
    } catch (error: any) {
      log(`Error syncing sales: ${error.message}`);
      res.status(500).json({ message: error.message || "Failed to sync sales" });
    }
  });

  // ============ POSTERPOS WEBHOOK (Real-time receipts) ============
  app.post("/api/posterpos/webhook", async (req, res) => {
    try {
      const { object, action, data } = req.body;
      log(`PosterPOS webhook: ${object}.${action}`, 'posterpos');

      // Handle transaction events
      if (object === 'transaction' && (action === 'added' || action === 'closed')) {
        const transaction = data;
        
        // Calculate total
        let totalAmount = 0;
        const items: string[] = [];
        
        if (transaction.products) {
          for (const product of transaction.products) {
            totalAmount += Number(product.product_sum || 0);
            items.push(product.product_name);
          }
        }

        // Send Telegram notification for new sale
        if (isTelegramBotInitialized()) {
          try {
            const bot = getTelegramBot();
            const itemsList = items.slice(0, 3).join(', ') + (items.length > 3 ? ` +${items.length - 3} more` : '');
            await bot.sendNotification(
              `🧾 *New Receipt!*\n` +
              `Amount: KES ${totalAmount.toFixed(2)}\n` +
              `Items: ${itemsList}\n` +
              `Time: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
            );
          } catch (e) {
            log(`Failed to send receipt notification: ${e}`);
          }
        }

        // Store in database
        if (transaction.products) {
          for (const product of transaction.products) {
            const posterPosId = `${transaction.transaction_id}-${product.product_id}`;
            const existing = await storage.getSalesRecordByPosterPosId(posterPosId);
            if (!existing) {
              await storage.createSalesRecord({
                posterPosId,
                itemName: product.product_name,
                quantity: product.num || '1',
                amount: (product.product_sum || 0).toString(),
                timestamp: new Date(),
                syncedAt: new Date(),
              });
            }
          }
        }
      }

      // Handle inventory changes
      if (object === 'storage' || object === 'ingredient') {
        // Trigger inventory sync on stock changes
        if (isTelegramBotInitialized()) {
          try {
            const bot = getTelegramBot();
            await bot.sendNotification(`📦 Inventory updated: ${action}`, 'store');
          } catch (e) {
            log(`Failed to send inventory notification: ${e}`);
          }
        }
      }

      res.json({ ok: true });
    } catch (error: any) {
      log(`PosterPOS webhook error: ${error.message}`);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // ============ SALES BY DATE RANGE ============
  app.get("/api/sales/range", async (req, res) => {
    try {
      const { from, to } = req.query;
      
      let fromDate = from ? new Date(from as string) : new Date();
      let toDate = to ? new Date(to as string) : new Date();
      
      // Default to last 7 days if no dates provided
      if (!from) {
        fromDate.setDate(fromDate.getDate() - 7);
      }
      
      // Set end of day for toDate
      toDate.setHours(23, 59, 59, 999);
      
      const sales = await storage.getSalesRecordsSince(fromDate);
      const filtered = sales.filter(s => new Date(s.timestamp) <= toDate);
      
      const total = filtered.reduce((sum, s) => sum + Number(s.amount), 0);
      
      res.json({
        sales: filtered,
        summary: {
          total,
          count: filtered.length,
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        }
      });
    } catch (error: any) {
      log(`Error fetching sales range: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch sales" });
    }
  });

  // ============ TELEGRAM WEBHOOK ============
  app.post("/api/telegram/webhook", async (req, res) => {
    try {
      if (!isTelegramBotInitialized()) {
        res.status(503).json({ message: "Telegram bot not configured" });
        return;
      }
      
      const bot = getTelegramBot();
      await bot.processWebhookUpdate(req.body);
      res.sendStatus(200);
    } catch (error: any) {
      log(`Telegram webhook error: ${error}`);
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
      log(`Error fetching analytics: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // ============ CONFIG STATUS ROUTES ============
  app.get("/api/config/status", async (req, res) => {
    res.json({
      posterpos: !!posterEndpoint && !!posterToken,
      telegram: !!telegramToken,
    });
  });

  return httpServer;
}
