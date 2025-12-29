import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { z } from "zod";
import {
  insertInventoryItemSchema, insertSalesRecordSchema, insertDespatchLogSchema, insertReorderRequestSchema,
  storeItems, storePurchases, storePurchaseItems, storeProcessedItems, storeDespatches, storeDespatchItems, storeReorders,
  insertStoreItemSchema, insertStorePurchaseSchema, insertStorePurchaseItemSchema, insertStoreProcessedItemSchema,
  insertStoreDespatchSchema, insertStoreDespatchItemSchema, insertStoreReorderSchema
} from "@shared/schema";
import { initPosterPOSClient, getPosterPOSClient, isPosterPOSInitialized } from "./posterpos";
import { initTelegramBot, getTelegramBot, isTelegramBotInitialized } from "./telegram";
import { startTransactionSync, syncNewTransactions, getLastSyncTimestamp } from "./transactionSync";
import { initMpesaClient, getMpesaClient, isMpesaInitialized } from "./mpesa";
import { supabaseAdmin } from "./supabase";
import { log } from "./index";
import inventoryRoutes from "./inventoryRoutes";
import storePortalRoutes from "./storePortalRoutes";
import shopPortalRoutes from "./shopPortalRoutes";
import partnerPortalRoutes from "./partnerPortalRoutes";
import insightsRoutes from "./insightsRoutes";
import { requirePartnerAuth } from "./authMiddleware";

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

  // Start background transaction sync (10-minute polling)
  if (posterEndpoint && posterToken && telegramToken) {
    startTransactionSync();
    log('Transaction sync started (10-minute interval)');
  }

  // Initialize M-Pesa client
  if (initMpesaClient()) {
    log('M-Pesa client initialized from environment');
  }

  // ============ AUTH ROUTES ============

  // Verify PIN for app access
  app.post("/api/auth/verify-pin", (req, res) => {
    const { pin } = req.body;
    const appPin = process.env.APP_PIN || "1234"; // Default PIN for dev

    if (pin === appPin) {
      // Return success but also expect client to use this PIN in headers
      res.json({ valid: true });
    } else {
      res.json({ valid: false });
    }
  });

  // Protect Partner Routes
  app.use("/api/partner", requirePartnerAuth, partnerPortalRoutes);
  app.use("/api/store", storePortalRoutes);
  app.use("/api/shop", shopPortalRoutes);
  app.use("/api/insights", insightsRoutes);

  // ============ M-PESA STK PUSH ROUTES ============

  // Check M-Pesa configuration status
  app.get("/api/mpesa/config-status", (req, res) => {
    res.json({
      configured: isMpesaInitialized(),
      environment: process.env.MPESA_ENV || 'sandbox',
    });
  });

  // Initiate STK Push
  app.post("/api/mpesa/stk-push", async (req, res) => {
    try {
      if (!isMpesaInitialized()) {
        return res.status(503).json({ success: false, error: "M-Pesa not configured" });
      }

      const { phoneNumber, amount, orderRef } = req.body;

      if (!phoneNumber || !amount) {
        return res.status(400).json({
          success: false,
          error: "phoneNumber and amount are required",
        });
      }

      const client = getMpesaClient();
      const result = await client.stkPush({
        phoneNumber,
        amount: parseFloat(amount),
        accountReference: orderRef || `POS-${Date.now()}`,
        transactionDesc: 'POS Payment',
      });

      res.json(result);
    } catch (error: any) {
      log(`M-Pesa STK Push error: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // M-Pesa callback webhook (called by Safaricom)
  app.post("/api/mpesa/callback", async (req, res) => {
    try {
      log(`M-Pesa Callback received: ${JSON.stringify(req.body)}`);

      if (isMpesaInitialized()) {
        const client = getMpesaClient();
        client.processCallback(req.body);
      }

      // Always respond with success to M-Pesa
      res.json({ ResultCode: 0, ResultDesc: "Success" });
    } catch (error: any) {
      log(`M-Pesa Callback error: ${error.message}`);
      // Still respond success to avoid M-Pesa retries
      res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }
  });

  // Query transaction status
  app.get("/api/mpesa/status/:checkoutRequestId", async (req, res) => {
    try {
      if (!isMpesaInitialized()) {
        return res.status(503).json({ error: "M-Pesa not configured" });
      }

      const { checkoutRequestId } = req.params;

      // First check Supabase (where Edge Function stores callbacks)
      const { data: dbTransaction } = await supabaseAdmin
        .from('mpesa_transactions')
        .select('*')
        .eq('checkout_request_id', checkoutRequestId)
        .single();

      if (dbTransaction && dbTransaction.status !== 'pending') {
        return res.json({
          status: dbTransaction.status,
          result: {
            resultCode: dbTransaction.result_code?.toString(),
            resultDesc: dbTransaction.result_desc,
            mpesaReceiptNumber: dbTransaction.mpesa_receipt_number,
            amount: dbTransaction.amount,
            phoneNumber: dbTransaction.phone_number,
          },
          source: 'supabase',
        });
      }

      // If pending or not found, query M-Pesa directly
      const client = getMpesaClient();

      // If pending or not found, query M-Pesa directly
      const queryResult = await client.queryTransaction(checkoutRequestId);

      let status: 'pending' | 'success' | 'failed' | 'cancelled' = 'pending';
      if (queryResult.resultCode === '0') {
        status = 'success';
      } else if (queryResult.resultCode === '1032') {
        status = 'cancelled'; // User cancelled
      } else if (queryResult.resultCode === '1037') {
        status = 'failed'; // Timeout - no response from user (only after M-Pesa times out)
      } else if (queryResult.resultCode === '1') {
        status = 'failed'; // Insufficient balance
      }
      // Any other code (including errors like "transaction being processed") stays as 'pending'

      res.json({
        status,
        result: queryResult,
        source: 'query',
      });
    } catch (error: any) {
      log(`M-Pesa status query error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Verify payment by phone (fallback for manual payments)
  app.post("/api/mpesa/verify", async (req, res) => {
    try {
      const { phoneNumber, amount } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({ error: "phoneNumber is required" });
      }

      // Normalize phone number
      let normalizedPhone = phoneNumber.replace(/\D/g, '');
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = '254' + normalizedPhone.substring(1);
      }

      // Check Supabase for recent successful transactions from this phone
      const { data: transactions } = await supabaseAdmin
        .from('mpesa_transactions')
        .select('*')
        .eq('status', 'success')
        .ilike('phone_number', `%${normalizedPhone.slice(-9)}%`)
        .order('created_at', { ascending: false })
        .limit(5);

      if (transactions && transactions.length > 0) {
        // Check if any match the amount (if provided)
        const matching = amount
          ? transactions.filter((t: any) => Math.abs(parseFloat(t.amount) - parseFloat(amount)) < 1)
          : transactions;

        if (matching.length > 0) {
          return res.json({
            verified: true,
            transaction: matching[0],
            message: `Found matching payment: ${matching[0].mpesa_receipt_number}`,
          });
        }
      }

      res.json({
        verified: false,
        message: "No matching payment found in recent transactions.",
        hint: `Searched for payment of KES ${amount || 'any amount'} from ${phoneNumber}`,
      });
    } catch (error: any) {
      log(`M-Pesa verify error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

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

  app.post("/api/despatch/batch", async (req, res) => {
    try {
      const batchSchema = z.object({
        items: z.array(z.object({
          inventoryItemId: z.string(),
          itemName: z.string(),
          quantity: z.string(),
          unit: z.string(),
        })),
        destination: z.string(),
        createdBy: z.string(),
      });

      const { items, destination, createdBy } = batchSchema.parse(req.body);
      const results = [];

      for (const item of items) {
        const data = {
          inventoryItemId: item.inventoryItemId,
          itemName: item.itemName,
          quantity: item.quantity,
          destination,
          createdBy,
        };
        const result = await storage.createDespatchWithInventoryUpdate(data);
        results.push(result);
      }

      res.status(201).json({ count: results.length, despatches: results });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        log(`Error creating batch despatch: ${error.message}`);
        res.status(500).json({ message: "Failed to create batch despatch" });
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
      const days = Number(req.query.days) || 7;
      const transactions = await client.getRecentTransactions(days);

      log(`Fetched ${transactions.length} transactions from last ${days} days`);

      const synced: any[] = [];
      for (const transaction of transactions) {
        if (!transaction.products) continue;

        for (const product of transaction.products) {
          const posterPosId = `${transaction.transaction_id}-${product.product_id}`;

          const existing = await storage.getSalesRecordByPosterPosId(posterPosId);
          if (existing) continue;

          const sale = await storage.createSalesRecord({
            posterPosId,
            itemName: `Product #${product.product_id}`,
            quantity: product.num || '1',
            amount: (product.payed_sum || product.product_price || 0).toString(),
            timestamp: new Date(transaction.date_close),
            syncedAt: new Date(),
          });
          synced.push(sale);
        }
      }

      res.json({ message: `Synced ${synced.length} sales from ${transactions.length} transactions`, sales: synced });
    } catch (error: any) {
      log(`Error syncing sales: ${error.message}`);
      res.status(500).json({ message: error.message || "Failed to sync sales" });
    }
  });

  // Manual trigger for transaction sync (posts new receipts to Sales channel)
  app.post("/api/posterpos/sync/transactions", async (req, res) => {
    try {
      if (!isPosterPOSInitialized()) {
        res.status(503).json({ message: "PosterPOS not configured" });
        return;
      }

      const count = await syncNewTransactions();
      const lastSync = getLastSyncTimestamp();

      res.json({
        message: `Synced ${count} new transactions`,
        notified: count,
        lastSyncTimestamp: lastSync,
        lastSyncTime: lastSync ? new Date(lastSync * 1000).toISOString() : null,
      });
    } catch (error: any) {
      log(`Error in manual transaction sync: ${error.message}`);
      res.status(500).json({ message: error.message || "Failed to sync transactions" });
    }
  });

  // Get sync status
  app.get("/api/posterpos/sync/status", async (req, res) => {
    const lastSync = getLastSyncTimestamp();
    res.json({
      posterPosConfigured: isPosterPOSInitialized(),
      telegramConfigured: isTelegramBotInitialized(),
      lastSyncTimestamp: lastSync,
      lastSyncTime: lastSync ? new Date(lastSync * 1000).toISOString() : null,
      syncInterval: '10 minutes',
    });
  });

  // ============ DEBUG: Test transaction products lookup ============
  app.get("/api/posterpos/transaction-products/:id", async (req, res) => {
    try {
      const client = getPosterPOSClient();
      const txId = req.params.id;
      const result = await client.getTransactionProducts(txId);
      res.json({ transaction_id: txId, products: result });
    } catch (error: any) {
      log(`Error fetching transaction products: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });

  // ============ INGREDIENT MOVEMENTS ============
  app.get("/api/posterpos/movements", async (req, res) => {
    try {
      const client = getPosterPOSClient();
      const { from, to, type } = req.query;

      let dateFrom: string | undefined;
      let dateTo: string | undefined;

      if (from) {
        dateFrom = new Date(from as string).toISOString().split('T')[0].replace(/-/g, '');
      } else {
        // Default to today
        dateFrom = new Date().toISOString().split('T')[0].replace(/-/g, '');
      }

      if (to) {
        dateTo = new Date(to as string).toISOString().split('T')[0].replace(/-/g, '');
      } else {
        dateTo = new Date().toISOString().split('T')[0].replace(/-/g, '');
      }

      const movements = await client.getIngredientMovements(dateFrom, dateTo, type ? Number(type) : 1);

      // Filter to show only items with usage (write_offs > 0)
      const withUsage = movements.filter(m => m.write_offs > 0);

      // Calculate summary
      const totalUsage = movements.reduce((sum, m) => sum + m.write_offs, 0);
      const totalCost = movements.reduce((sum, m) => sum + (m.write_offs * m.cost_end), 0);

      res.json({
        movements,
        withUsage,
        summary: {
          totalItems: movements.length,
          itemsWithUsage: withUsage.length,
          totalUsage,
          totalCost: totalCost.toFixed(2),
          dateFrom,
          dateTo,
        }
      });
    } catch (error: any) {
      log(`Error fetching movements: ${error.message}`);
      res.status(500).json({ message: error.message || "Failed to fetch ingredient movements" });
    }
  });

  app.get("/api/posterpos/movements/today", async (req, res) => {
    try {
      const client = getPosterPOSClient();
      const movements = await client.getTodaysIngredientMovements();

      // Filter to show only items with usage
      const withUsage = movements.filter(m => m.write_offs > 0);

      res.json({
        movements: withUsage,
        summary: {
          totalItems: movements.length,
          itemsWithUsage: withUsage.length,
          totalUsage: withUsage.reduce((sum, m) => sum + m.write_offs, 0),
        }
      });
    } catch (error: any) {
      log(`Error fetching today's movements: ${error.message}`);
      res.status(500).json({ message: error.message || "Failed to fetch movements" });
    }
  });

  // Get all PosterPOS ingredients with stock levels
  app.get("/api/posterpos/ingredients", async (req, res) => {
    try {
      if (!isPosterPOSInitialized()) {
        return res.status(503).json({ message: "PosterPOS not configured" });
      }
      const client = getPosterPOSClient();

      // Try getting ingredients directly first
      const ingredients = await client.getIngredients();
      log(`PosterPOS getIngredients raw: ${JSON.stringify(ingredients).slice(0, 500)}`, 'posterpos');

      // Also get storages to combine stock levels
      const storages = await client.getStorages();
      log(`PosterPOS getStorages raw: ${JSON.stringify(storages).slice(0, 500)}`, 'posterpos');

      // Create a map of storage stock levels by ingredient_id
      const stockMap = new Map<number, string>();
      for (const s of storages) {
        if (s.ingredient_id) {
          stockMap.set(s.ingredient_id, s.ingredient_left || "0");
        }
      }

      // Transform to expected format - use ingredients list and add stock from storages
      const result = ingredients.map((ing: any) => ({
        ingredient_id: ing.ingredient_id,
        ingredient_name: ing.ingredient_name,
        ingredient_unit: ing.ingredient_unit,
        ingredient_left: stockMap.get(ing.ingredient_id) || "0",
      }));

      res.json(result);
    } catch (error: any) {
      log(`Error fetching PosterPOS ingredients: ${error.message}`);
      res.status(500).json({ message: error.message || "Failed to fetch ingredients" });
    }
  });

  // Ingredient usage endpoint for Owner Usage page
  app.get("/api/usage", async (req, res) => {
    try {
      const client = getPosterPOSClient();
      const { from, to } = req.query;

      let dateFrom: string;
      let dateTo: string;

      if (from) {
        dateFrom = new Date(from as string).toISOString().split('T')[0].replace(/-/g, '');
      } else {
        dateFrom = new Date().toISOString().split('T')[0].replace(/-/g, '');
      }

      if (to) {
        dateTo = new Date(to as string).toISOString().split('T')[0].replace(/-/g, '');
      } else {
        dateTo = new Date().toISOString().split('T')[0].replace(/-/g, '');
      }

      // No type filter - get all movements and filter for write_offs
      const movements = await client.getIngredientMovements(dateFrom, dateTo);

      log(`Usage API: Got ${movements.length} ingredients for ${dateFrom} to ${dateTo}`);

      // Filter to only ingredients with POSITIVE write_offs (expense/usage)
      // Ignore negative values which are corrections/reversals
      const usage = movements
        .filter(m => {
          const writeOff = Number(m.write_offs) || 0;
          return writeOff > 0;
        })
        .map(m => {
          const writeOff = Math.abs(Number(m.write_offs) || 0);
          const costEnd = Number(m.cost_end) || 0;
          return {
            id: m.ingredient_id,
            name: m.ingredient_name,
            quantity: writeOff,
            unit: '',
            costPerUnit: costEnd / 100,
            totalCost: (writeOff * costEnd) / 100,
          };
        })
        .sort((a, b) => b.totalCost - a.totalCost);

      const totalCost = usage.reduce((sum, u) => sum + u.totalCost, 0);
      const totalItems = usage.length;

      log(`Usage API: Filtered to ${totalItems} ingredients with usage, total cost: ${totalCost.toFixed(2)}`);

      res.json({
        usage,
        summary: {
          totalCost,
          totalItems,
          from: from || new Date().toISOString(),
          to: to || new Date().toISOString(),
        }
      });
    } catch (error: any) {
      log(`Error fetching usage: ${error.message}`);
      res.status(500).json({ message: error.message || "Failed to fetch usage data" });
    }
  });

  // ============ STORE PURCHASE ITEMS (for Process page) ============
  app.get("/api/store-purchase-items", async (req, res) => {
    try {
      const status = req.query.status as string;

      let query = supabaseAdmin
        .from('store_purchase_items')
        .select('*')
        .order('created_at', { ascending: true });

      if (status === 'pending') {
        // Items that still need processing
        query = query.or('status.eq.pending,status.is.null');
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter to show only items with remaining quantity
      const items = (data || []).filter((item: any) => {
        const qty = Number(item.quantity) || 0;
        const processed = Number(item.quantity_processed) || 0;
        return qty > processed;
      });

      res.json(items);
    } catch (error: any) {
      log(`Error fetching store purchase items: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch purchase items" });
    }
  });

  // ============ STORE PROCESSED ITEMS (for Process/Despatch pages) ============
  app.get("/api/store-processed-items", async (req, res) => {
    try {
      const status = req.query.status as string;

      let query = supabaseAdmin
        .from('store_processed_items')
        .select('*')
        .order('processed_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      res.json(data || []);
    } catch (error: any) {
      log(`Error fetching processed items: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch processed items" });
    }
  });

  // Create processed item (pack for dispatch)
  app.post("/api/store-processed-items", async (req, res) => {
    try {
      const { purchaseItemId, quantity, batchNumber, processedBy } = req.body;

      // Get the purchase item
      const { data: purchaseItem, error: fetchError } = await supabaseAdmin
        .from('store_purchase_items')
        .select('*')
        .eq('id', purchaseItemId)
        .single();

      if (fetchError || !purchaseItem) {
        return res.status(404).json({ message: "Purchase item not found" });
      }

      // Create processed item
      const { data: processed, error: createError } = await supabaseAdmin
        .from('store_processed_items')
        .insert({
          purchase_item_id: purchaseItemId,
          item_name: purchaseItem.item_name,
          quantity: parseFloat(quantity),
          unit: purchaseItem.unit,
          batch_number: batchNumber,
          processed_by: processedBy,
          status: 'ready',
          processed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) throw createError;

      // Update the purchase item's processed quantity
      const newProcessed = (Number(purchaseItem.quantity_processed) || 0) + parseFloat(quantity);
      const totalQty = Number(purchaseItem.quantity) || 0;

      await supabaseAdmin
        .from('store_purchase_items')
        .update({
          quantity_processed: newProcessed,
          status: newProcessed >= totalQty ? 'fully_processed' : 'partially_processed',
        })
        .eq('id', purchaseItemId);

      res.json(processed);
    } catch (error: any) {
      log(`Error creating processed item: ${error.message}`);
      res.status(500).json({ message: "Failed to create processed item" });
    }
  });

  // ============ STORE DESPATCHES (for Despatch page) ============
  app.get("/api/store-despatches", async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('store_despatches')
        .select('*')
        .order('despatch_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      res.json(data || []);
    } catch (error: any) {
      log(`Error fetching despatches: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch despatches" });
    }
  });

  // Create despatch
  app.post("/api/store-despatches", async (req, res) => {
    try {
      const { itemIds, sentBy, notes } = req.body;

      if (!itemIds || itemIds.length === 0) {
        return res.status(400).json({ message: "No items selected" });
      }

      // Get the items being dispatched
      const { data: items, error: fetchError } = await supabaseAdmin
        .from('store_processed_items')
        .select('*')
        .in('id', itemIds);

      if (fetchError) throw fetchError;

      // Calculate totals
      const totalItems = items?.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0) || 0;

      // Create the despatch record
      const { data: despatch, error: createError } = await supabaseAdmin
        .from('store_despatches')
        .insert({
          destination: 'shop', // Default destination
          total_items: totalItems,
          sent_by: sentBy,
          notes: notes,
          status: 'pending',
          despatch_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) throw createError;

      // Update processed items to 'dispatched'
      await supabaseAdmin
        .from('store_processed_items')
        .update({ status: 'dispatched', despatch_id: despatch.id })
        .in('id', itemIds);

      res.json(despatch);
    } catch (error: any) {
      log(`Error creating despatch: ${error.message}`);
      res.status(500).json({ message: "Failed to create despatch" });
    }
  });

  // Real-time ingredient usage based on transactions and recipes
  app.get("/api/realtime-usage", async (req, res) => {
    try {
      const client = getPosterPOSClient();
      const { from, to } = req.query;

      let dateFrom: string;
      let dateTo: string;

      // Frontend now sends dates in YYYYMMDD format directly (local timezone)
      if (from && /^\d{8}$/.test(from as string)) {
        dateFrom = from as string;
      } else if (from) {
        dateFrom = new Date(from as string).toISOString().split('T')[0].replace(/-/g, '');
      } else {
        dateFrom = new Date().toISOString().split('T')[0].replace(/-/g, '');
      }

      if (to && /^\d{8}$/.test(to as string)) {
        dateTo = to as string;
      } else if (to) {
        dateTo = new Date(to as string).toISOString().split('T')[0].replace(/-/g, '');
      } else {
        dateTo = new Date().toISOString().split('T')[0].replace(/-/g, '');
      }

      log(`Realtime usage: Fetching transactions from ${dateFrom} to ${dateTo}`);

      // Get transactions for the date range
      const transactions = await client.getTransactions({ dateFrom, dateTo });

      log(`Realtime usage: Got ${transactions.length} transactions`);

      // Build a map of product recipes (cached per request)
      const recipeCache: Map<string, any> = new Map();
      // Track visited modifiers to prevent infinite loops
      const processedModifiers: Set<string> = new Set();

      // Aggregate ingredient usage from all transactions
      const ingredientUsage: Map<string, {
        id: string;
        name: string;
        quantity: number;
        unit: string;
        productsSold: Map<string, { name: string; count: number }>;
      }> = new Map();

      let totalProductsSold = 0;

      // Build a modifier name to recipe modifier lookup for faster matching
      const buildModifierNameLookup = (recipe: any): Map<string, any> => {
        const lookup = new Map<string, any>();
        if (recipe.group_modifications) {
          for (const group of recipe.group_modifications) {
            for (const mod of group.modifications) {
              // Store by lowercase trimmed name for fuzzy matching
              const normalizedName = mod.name.toLowerCase().trim();
              lookup.set(normalizedName, mod);
            }
          }
        }
        return lookup;
      };

      for (const transaction of transactions) {
        if (!transaction.products || transaction.products.length === 0) continue;

        // Fetch detailed transaction products with modificator_name
        const txProducts = await client.getTransactionProducts(transaction.transaction_id);

        for (let lineIdx = 0; lineIdx < txProducts.length; lineIdx++) {
          const txProduct = txProducts[lineIdx];
          const productId = txProduct.product_id.toString();
          const quantitySold = parseFloat(txProduct.num) || 1;
          totalProductsSold += quantitySold;

          // Get recipe for this product (cached)
          let recipe = recipeCache.get(productId);
          if (!recipe) {
            recipe = await client.getProductWithRecipe(productId);
            if (recipe) {
              recipeCache.set(productId, recipe);
            }
          }

          if (recipe) {
            // Process base recipe ingredients
            if (recipe.ingredients && recipe.ingredients.length > 0) {
              for (const ingredient of recipe.ingredients) {
                const ingredientId = ingredient.ingredient_id;
                const usageAmount = (ingredient.structure_netto || ingredient.structure_brutto) * quantitySold;

                const existing = ingredientUsage.get(ingredientId);
                if (existing) {
                  existing.quantity += usageAmount;
                  const productEntry = existing.productsSold.get(productId);
                  if (productEntry) {
                    productEntry.count += quantitySold;
                  } else {
                    existing.productsSold.set(productId, { name: recipe.product_name, count: quantitySold });
                  }
                } else {
                  const productsSold = new Map<string, { name: string; count: number }>();
                  productsSold.set(productId, { name: recipe.product_name, count: quantitySold });
                  ingredientUsage.set(ingredientId, {
                    id: ingredientId,
                    name: ingredient.ingredient_name,
                    quantity: usageAmount,
                    unit: ingredient.structure_unit || ingredient.ingredient_unit || '',
                    productsSold,
                  });
                }
              }
            }

            // Process selected modifiers using modificator_name from transaction products
            if (txProduct.modificator_name && recipe.group_modifications) {
              const modifierLookup = buildModifierNameLookup(recipe);

              // Parse comma-separated modifier names
              const selectedModifierNames = txProduct.modificator_name
                .split(',')
                .map((name: string) => name.toLowerCase().trim())
                .filter((name: string) => name.length > 0);

              // Debug: Log modifier matching for Pure & Simple
              if (recipe.product_name?.toLowerCase().includes('pure') || recipe.product_name?.toLowerCase().includes('simple')) {
                log(`DEBUG Pure&Simple: Matched modifiers from "${txProduct.modificator_name}": [${selectedModifierNames.join(', ')}]`);
              }

              for (const modName of selectedModifierNames) {
                // Track to prevent double-processing within same line item
                const modKey = `${transaction.transaction_id}-${lineIdx}-${modName}`;
                if (processedModifiers.has(modKey)) continue;
                processedModifiers.add(modKey);

                // Find the matching modifier in the recipe
                const mod = modifierLookup.get(modName);
                if (mod) {
                  const modQty = 1; // Each selected modifier counts once
                  const trackingKey = `${productId}-mod-${modName}`;

                  // Process modifier with ingredient_id (type 10 = ingredient modifier)
                  if (mod.ingredient_id && mod.ingredient_id !== '0' && mod.ingredient_id !== 0) {
                    // Normalize ingredient ID to string
                    const modIngredientId = mod.ingredient_id.toString();
                    // Direct ingredient modifier - use netto with brutto fallback
                    const usageAmount = (mod.netto || mod.brutto) * modQty * quantitySold;

                    if (usageAmount > 0) {
                      const existing = ingredientUsage.get(modIngredientId);
                      if (existing) {
                        existing.quantity += usageAmount;
                        if (!existing.productsSold.has(trackingKey)) {
                          existing.productsSold.set(trackingKey, { name: `${recipe.product_name} + ${mod.name}`, count: modQty * quantitySold });
                        } else {
                          const entry = existing.productsSold.get(trackingKey)!;
                          entry.count += modQty * quantitySold;
                        }
                      } else {
                        const productsSold = new Map<string, { name: string; count: number }>();
                        productsSold.set(trackingKey, { name: `${recipe.product_name} + ${mod.name}`, count: modQty * quantitySold });
                        ingredientUsage.set(modIngredientId, {
                          id: modIngredientId,
                          name: mod.ingredient_name || mod.name,
                          quantity: usageAmount,
                          unit: mod.ingredient_unit || '',
                          productsSold,
                        });
                      }
                    }
                  }

                  // Check if modifier references a product/dish (type 2/3) that needs recipe lookup
                  if ((mod.type === '2' || mod.type === '3') && mod.product_id) {
                    const modProductId = mod.product_id;
                    let modRecipe = recipeCache.get(modProductId);
                    if (!modRecipe) {
                      modRecipe = await client.getProductWithRecipe(modProductId);
                      if (modRecipe) recipeCache.set(modProductId, modRecipe);
                    }

                    if (modRecipe && modRecipe.ingredients) {
                      for (const modIng of modRecipe.ingredients) {
                        const modSubIngId = modIng.ingredient_id.toString();
                        const usageAmount = (modIng.structure_netto || modIng.structure_brutto) * modQty * quantitySold;

                        const existing = ingredientUsage.get(modSubIngId);
                        if (existing) {
                          existing.quantity += usageAmount;
                          if (!existing.productsSold.has(trackingKey)) {
                            existing.productsSold.set(trackingKey, { name: `${recipe.product_name} + ${mod.name}`, count: modQty * quantitySold });
                          } else {
                            const entry = existing.productsSold.get(trackingKey)!;
                            entry.count += modQty * quantitySold;
                          }
                        } else {
                          const productsSold = new Map<string, { name: string; count: number }>();
                          productsSold.set(trackingKey, { name: `${recipe.product_name} + ${mod.name}`, count: modQty * quantitySold });
                          ingredientUsage.set(modSubIngId, {
                            id: modSubIngId,
                            name: modIng.ingredient_name,
                            quantity: usageAmount,
                            unit: modIng.structure_unit || modIng.ingredient_unit || '',
                            productsSold,
                          });
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Convert to array and sort by quantity
      const usage = Array.from(ingredientUsage.values())
        .map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          products: Array.from(item.productsSold.values()),
        }))
        .sort((a, b) => b.quantity - a.quantity);

      log(`Realtime usage: Found ${usage.length} ingredients used across ${transactions.length} transactions`);

      res.json({
        usage,
        summary: {
          totalIngredients: usage.length,
          totalTransactions: transactions.length,
          totalProductsSold,
          from: from || new Date().toISOString(),
          to: to || new Date().toISOString(),
        }
      });
    } catch (error: any) {
      log(`Error fetching realtime usage: ${error.message}`);
      res.status(500).json({ message: error.message || "Failed to fetch realtime usage data" });
    }
  });

  // Debug endpoint to inspect product recipes and modifiers
  app.get("/api/debug/product/:productId", async (req, res) => {
    try {
      const client = getPosterPOSClient();
      const { productId } = req.params;

      // Get the product recipe
      const recipe = await client.getProductWithRecipe(productId);

      if (!recipe) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Get recent transactions that include this product
      const today = new Date();
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const dateFrom = weekAgo.toISOString().split('T')[0].replace(/-/g, '');
      const dateTo = today.toISOString().split('T')[0].replace(/-/g, '');

      const transactions = await client.getTransactions({ dateFrom, dateTo });

      // Filter transactions that contain this product
      const productTransactions = transactions
        .filter(tx => tx.products?.some(p => p.product_id.toString() === productId))
        .slice(0, 10) // Limit to 10 most recent
        .map(tx => ({
          transaction_id: tx.transaction_id,
          date_close: tx.date_close,
          products: tx.products?.filter(p => p.product_id.toString() === productId).map(p => ({
            product_id: p.product_id,
            num: p.num,
            modifications: p.modifications,
          })),
        }));

      res.json({
        recipe: {
          product_id: recipe.product_id,
          product_name: recipe.product_name,
          ingredients: recipe.ingredients,
          group_modifications: recipe.group_modifications,
        },
        recentTransactions: productTransactions,
        summary: {
          totalTransactionsWithProduct: productTransactions.length,
          hasIngredients: (recipe.ingredients?.length || 0) > 0,
          hasModifiers: (recipe.group_modifications?.length || 0) > 0,
          modifierGroups: recipe.group_modifications?.map(g => ({
            name: g.name,
            modifierCount: g.modifications.length,
            modifiers: g.modifications.map(m => ({
              id: m.dish_modification_id,
              name: m.name,
              type: m.type,
              ingredient_id: m.ingredient_id,
              product_id: m.product_id,
              brutto: m.brutto,
              netto: m.netto,
            })),
          })),
        },
      });
    } catch (error: any) {
      log(`Error debugging product: ${error.message}`);
      res.status(500).json({ message: error.message || "Failed to debug product" });
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

        // Send Telegram notification for new sale to sales channel
        if (isTelegramBotInitialized()) {
          try {
            const bot = getTelegramBot();
            await bot.sendReceiptNotification(totalAmount, items);
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

      // Handle inventory changes - send to inventory channel
      if (object === 'storage' || object === 'ingredient') {
        if (isTelegramBotInitialized()) {
          try {
            const bot = getTelegramBot();
            await bot.sendInventoryUpdate(`Stock ${action}`, data?.ingredient_name || data?.product_name);
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

  // ============ PAYMENTS BY METHOD ============
  app.get("/api/payments", async (req, res) => {
    try {
      if (!isPosterPOSInitialized()) {
        return res.status(503).json({ message: "PosterPOS not configured" });
      }

      const client = getPosterPOSClient();
      const { from, to } = req.query;

      let dateFrom: string;
      let dateTo: string;

      // Helper to get local date in YYYYMMDD format (EAT timezone)
      const getLocalDateYYYYMMDD = (date: Date = new Date()): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
      };

      // Frontend sends dates in YYYYMMDD format directly (local timezone)
      if (from && /^\d{8}$/.test(from as string)) {
        dateFrom = from as string;
      } else if (from) {
        dateFrom = getLocalDateYYYYMMDD(new Date(from as string));
      } else {
        dateFrom = getLocalDateYYYYMMDD();
      }

      if (to && /^\d{8}$/.test(to as string)) {
        dateTo = to as string;
      } else if (to) {
        dateTo = getLocalDateYYYYMMDD(new Date(to as string));
      } else {
        dateTo = getLocalDateYYYYMMDD();
      }

      log(`Payments: Fetching transactions from ${dateFrom} to ${dateTo}`);

      // Get transactions for the date range
      const transactions = await client.getTransactions({ dateFrom, dateTo });

      log(`Payments: Got ${transactions.length} transactions`);

      // Aggregate by payment method
      let cashTotal = 0;
      let cardTotal = 0;
      let cashCount = 0;
      let cardCount = 0;
      const cashTransactions: any[] = [];
      const cardTransactions: any[] = [];

      for (const tx of transactions) {
        const payedCash = parseFloat(tx.payed_cash || '0') / 100; // Convert from cents
        const payedCard = parseFloat(tx.payed_card || '0') / 100; // Convert from cents
        const txSum = parseFloat(tx.payed_sum || tx.sum || '0') / 100;

        // Robust date parsing: handle both numeric epoch (milliseconds) and ISO strings
        let dateCloseTs: number;
        if (/^\d+$/.test(tx.date_close)) {
          dateCloseTs = Number(tx.date_close);
        } else {
          dateCloseTs = new Date(tx.date_close).getTime();
        }

        const txInfo = {
          transaction_id: tx.transaction_id,
          date_close: new Date(dateCloseTs).toISOString(),
          amount: txSum,
          table_name: tx.table_name || 'Counter',
        };

        if (payedCash > 0) {
          cashTotal += payedCash;
          cashCount++;
          cashTransactions.push({ ...txInfo, amount: payedCash, method: 'Cash' });
        }

        if (payedCard > 0) {
          cardTotal += payedCard;
          cardCount++;
          cardTransactions.push({ ...txInfo, amount: payedCard, method: 'Card/M-Pesa' });
        }
      }

      const grandTotal = cashTotal + cardTotal;

      res.json({
        summary: {
          total: grandTotal,
          totalTransactions: transactions.length,
          cash: {
            total: cashTotal,
            count: cashCount,
            percentage: grandTotal > 0 ? (cashTotal / grandTotal) * 100 : 0,
          },
          card: {
            total: cardTotal,
            count: cardCount,
            percentage: grandTotal > 0 ? (cardTotal / grandTotal) * 100 : 0,
          },
          from: dateFrom,
          to: dateTo,
        },
        transactions: {
          cash: cashTransactions.slice(0, 50), // Limit to 50 most recent
          card: cardTransactions.slice(0, 50),
        },
      });
    } catch (error: any) {
      log(`Error fetching payments: ${error.message}`);
      res.status(500).json({ message: error.message || "Failed to fetch payment data" });
    }
  });

  // ============ MAIN STORE ADMIN ROUTES ============

  // Store Items CRUD
  app.get("/api/store/items", async (req, res) => {
    try {
      const items = await db.select().from(storeItems).orderBy(storeItems.name);
      res.json(items);
    } catch (error: any) {
      log(`Error fetching store items: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch store items" });
    }
  });

  app.post("/api/store/items", async (req, res) => {
    try {
      const data = insertStoreItemSchema.parse(req.body);
      const [item] = await db.insert(storeItems).values(data).returning();
      res.status(201).json(item);
    } catch (error: any) {
      log(`Error creating store item: ${error.message}`);
      res.status(500).json({ message: "Failed to create store item" });
    }
  });

  app.patch("/api/store/items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const { eq } = await import("drizzle-orm");
      const [item] = await db.update(storeItems).set({ ...updates, updatedAt: new Date() }).where(eq(storeItems.id, id)).returning();
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (error: any) {
      log(`Error updating store item: ${error.message}`);
      res.status(500).json({ message: "Failed to update store item" });
    }
  });

  app.delete("/api/store/items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { eq } = await import("drizzle-orm");
      await db.update(storeItems).set({ isActive: false }).where(eq(storeItems.id, id));
      res.json({ success: true });
    } catch (error: any) {
      log(`Error deleting store item: ${error.message}`);
      res.status(500).json({ message: "Failed to delete store item" });
    }
  });

  // Store Purchases
  app.get("/api/store/purchases", async (req, res) => {
    try {
      const { desc } = await import("drizzle-orm");
      const purchases = await db.select().from(storePurchases).orderBy(desc(storePurchases.createdAt)).limit(50);
      res.json(purchases);
    } catch (error: any) {
      log(`Error fetching store purchases: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch store purchases" });
    }
  });

  app.post("/api/store/purchases", async (req, res) => {
    try {
      const { purchase, items } = req.body;
      const { eq, sql } = await import("drizzle-orm");

      // Create purchase record
      const purchaseData = insertStorePurchaseSchema.parse(purchase);
      const [newPurchase] = await db.insert(storePurchases).values(purchaseData).returning();

      // Create purchase items and update stock
      const createdItems = [];
      for (const item of items) {
        const itemData = {
          ...item,
          purchaseId: newPurchase.id,
        };
        const [purchaseItem] = await db.insert(storePurchaseItems).values(itemData).returning();
        createdItems.push(purchaseItem);

        // Update store item stock if linked
        if (item.storeItemId) {
          await db.update(storeItems)
            .set({
              currentStock: sql`${storeItems.currentStock} + ${item.quantity}`,
              updatedAt: new Date()
            })
            .where(eq(storeItems.id, item.storeItemId));
        }
      }

      res.status(201).json({ purchase: newPurchase, items: createdItems });
    } catch (error: any) {
      log(`Error creating store purchase: ${error.message}`);
      res.status(500).json({ message: "Failed to create store purchase" });
    }
  });

  app.get("/api/store/purchases/:id/items", async (req, res) => {
    try {
      const { id } = req.params;
      const { eq } = await import("drizzle-orm");
      const items = await db.select().from(storePurchaseItems).where(eq(storePurchaseItems.purchaseId, id));
      res.json(items);
    } catch (error: any) {
      log(`Error fetching purchase items: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch purchase items" });
    }
  });

  // Store Processed Items
  app.get("/api/store/processed", async (req, res) => {
    try {
      const { desc, eq } = await import("drizzle-orm");
      const status = req.query.status as string;
      let query = db.select().from(storeProcessedItems);
      if (status) {
        query = query.where(eq(storeProcessedItems.status, status)) as any;
      }
      const items = await query.orderBy(desc(storeProcessedItems.processedAt)).limit(100);
      res.json(items);
    } catch (error: any) {
      log(`Error fetching processed items: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch processed items" });
    }
  });

  app.post("/api/store/processed", async (req, res) => {
    try {
      const data = insertStoreProcessedItemSchema.parse(req.body);
      const { eq, sql } = await import("drizzle-orm");

      // Validate quantity bounds if linked to purchase item
      if (data.purchaseItemId) {
        const [purchaseItem] = await db.select().from(storePurchaseItems)
          .where(eq(storePurchaseItems.id, data.purchaseItemId));

        if (!purchaseItem) {
          return res.status(400).json({ message: "Purchase item not found" });
        }

        const pendingQty = Number(purchaseItem.quantity) - Number(purchaseItem.quantityProcessed);
        if (Number(data.quantity) > pendingQty) {
          return res.status(400).json({
            message: `Cannot process ${data.quantity}. Only ${pendingQty} pending.`
          });
        }
      }

      const [item] = await db.insert(storeProcessedItems).values(data).returning();

      // Update purchase item processed quantity if linked
      if (data.purchaseItemId) {
        await db.update(storePurchaseItems)
          .set({
            quantityProcessed: sql`${storePurchaseItems.quantityProcessed} + ${data.quantity}`,
            status: 'partially_processed'
          })
          .where(eq(storePurchaseItems.id, data.purchaseItemId));
      }

      // Reduce store stock (items are packed from warehouse stock)
      if (data.storeItemId) {
        await db.update(storeItems)
          .set({
            currentStock: sql`${storeItems.currentStock} - ${data.quantity}`,
            updatedAt: new Date()
          })
          .where(eq(storeItems.id, data.storeItemId));
      }

      res.status(201).json(item);
    } catch (error: any) {
      log(`Error creating processed item: ${error.message}`);
      res.status(500).json({ message: "Failed to create processed item" });
    }
  });

  // Get items pending processing (from purchases)
  app.get("/api/store/pending-process", async (req, res) => {
    try {
      const { ne, sql } = await import("drizzle-orm");
      const items = await db.select().from(storePurchaseItems)
        .where(ne(storePurchaseItems.status, 'fully_processed'));
      res.json(items);
    } catch (error: any) {
      log(`Error fetching pending items: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch pending items" });
    }
  });

  // Store Despatches
  app.get("/api/store/despatches", async (req, res) => {
    try {
      const { desc } = await import("drizzle-orm");
      const despatches = await db.select().from(storeDespatches).orderBy(desc(storeDespatches.createdAt)).limit(50);
      res.json(despatches);
    } catch (error: any) {
      log(`Error fetching despatches: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch despatches" });
    }
  });

  app.post("/api/store/despatches", async (req, res) => {
    try {
      const { despatch, items } = req.body;
      const { eq } = await import("drizzle-orm");

      // Create despatch record
      const despatchData = insertStoreDespatchSchema.parse({
        ...despatch,
        totalItems: items.length,
      });
      const [newDespatch] = await db.insert(storeDespatches).values(despatchData).returning();

      // Create despatch items and update processed item status
      const createdItems = [];
      for (const item of items) {
        const itemData = {
          ...item,
          despatchId: newDespatch.id,
        };
        const [despatchItem] = await db.insert(storeDespatchItems).values(itemData).returning();
        createdItems.push(despatchItem);

        // Update processed item status
        if (item.processedItemId) {
          await db.update(storeProcessedItems)
            .set({ status: 'dispatched' })
            .where(eq(storeProcessedItems.id, item.processedItemId));
        }
      }

      res.status(201).json({ despatch: newDespatch, items: createdItems });
    } catch (error: any) {
      log(`Error creating despatch: ${error.message}`);
      res.status(500).json({ message: "Failed to create despatch" });
    }
  });

  app.patch("/api/store/despatches/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const { eq } = await import("drizzle-orm");
      const [despatch] = await db.update(storeDespatches).set(updates).where(eq(storeDespatches.id, id)).returning();
      if (!despatch) {
        return res.status(404).json({ message: "Despatch not found" });
      }
      res.json(despatch);
    } catch (error: any) {
      log(`Error updating despatch: ${error.message}`);
      res.status(500).json({ message: "Failed to update despatch" });
    }
  });

  app.get("/api/store/despatches/:id/items", async (req, res) => {
    try {
      const { id } = req.params;
      const { eq } = await import("drizzle-orm");
      const items = await db.select().from(storeDespatchItems).where(eq(storeDespatchItems.despatchId, id));
      res.json(items);
    } catch (error: any) {
      log(`Error fetching despatch items: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch despatch items" });
    }
  });

  // Store Reorders
  app.get("/api/store/reorders", async (req, res) => {
    try {
      const { desc } = await import("drizzle-orm");
      const reorders = await db.select().from(storeReorders).orderBy(desc(storeReorders.createdAt)).limit(50);
      res.json(reorders);
    } catch (error: any) {
      log(`Error fetching reorders: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch reorders" });
    }
  });

  app.post("/api/store/reorders", async (req, res) => {
    try {
      const data = insertStoreReorderSchema.parse(req.body);
      const [reorder] = await db.insert(storeReorders).values(data).returning();
      res.status(201).json(reorder);
    } catch (error: any) {
      log(`Error creating reorder: ${error.message}`);
      res.status(500).json({ message: "Failed to create reorder" });
    }
  });

  app.patch("/api/store/reorders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const { eq } = await import("drizzle-orm");
      const [reorder] = await db.update(storeReorders).set(updates).where(eq(storeReorders.id, id)).returning();
      if (!reorder) {
        return res.status(404).json({ message: "Reorder not found" });
      }
      res.json(reorder);
    } catch (error: any) {
      log(`Error updating reorder: ${error.message}`);
      res.status(500).json({ message: "Failed to update reorder" });
    }
  });

  // Get low stock items for reorder suggestions
  app.get("/api/store/low-stock", async (req, res) => {
    try {
      const { sql, lte } = await import("drizzle-orm");
      const items = await db.select().from(storeItems)
        .where(lte(storeItems.currentStock, storeItems.minStock));
      res.json(items);
    } catch (error: any) {
      log(`Error fetching low stock items: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch low stock items" });
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

  // ============ SHOP STOCK SESSIONS ============

  // Get current or create new stock session
  app.get("/api/shop/stock/session/:type", async (req, res) => {
    try {
      const type = req.params.type as 'opening' | 'closing';
      if (type !== 'opening' && type !== 'closing') {
        res.status(400).json({ message: "Invalid session type" });
        return;
      }

      const session = await storage.getTodaysStockSession(type);
      if (session) {
        const entries = await storage.getStockEntriesBySession(session.id);
        res.json({ session, entries });
      } else {
        res.json({ session: null, entries: [] });
      }
    } catch (error: any) {
      log(`Error fetching stock session: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  // Start a new stock session (opening or closing)
  app.post("/api/shop/stock/session", async (req, res) => {
    try {
      const { sessionType, staffName } = req.body;

      if (!sessionType || !staffName) {
        res.status(400).json({ message: "sessionType and staffName are required" });
        return;
      }

      // Check if session already exists for today
      const existing = await storage.getTodaysStockSession(sessionType);
      if (existing && existing.status === 'in_progress') {
        const entries = await storage.getStockEntriesBySession(existing.id);
        res.json({ session: existing, entries, resumed: true });
        return;
      }

      // Get inventory items count
      const items = await storage.getAllInventoryItems();

      const session = await storage.createStockSession({
        sessionType,
        staffName,
        status: 'in_progress',
        totalItems: items.length,
        countedItems: 0,
      });

      res.status(201).json({ session, entries: [], items });
    } catch (error: any) {
      log(`Error creating stock session: ${error.message}`);
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  // Save a stock entry (individual item count)
  app.post("/api/shop/stock/entry", async (req, res) => {
    try {
      const { sessionId, itemName, quantity, unit, inventoryItemId, posterPosId, notes } = req.body;

      if (!sessionId || !itemName || quantity === undefined) {
        res.status(400).json({ message: "sessionId, itemName, and quantity are required" });
        return;
      }

      const entry = await storage.createStockEntry({
        sessionId,
        itemName,
        quantity: quantity.toString(),
        unit: unit || 'units',
        inventoryItemId,
        posterPosId,
        notes,
      });

      // Update session counted items
      const session = await storage.getStockSession(sessionId);
      if (session) {
        await storage.updateStockSession(sessionId, {
          countedItems: (session.countedItems || 0) + 1,
        });
      }

      res.status(201).json(entry);
    } catch (error: any) {
      log(`Error saving stock entry: ${error.message}`);
      res.status(500).json({ message: "Failed to save entry" });
    }
  });

  // Complete a stock session
  app.patch("/api/shop/stock/session/:id/complete", async (req, res) => {
    try {
      const { id } = req.params;

      const session = await storage.updateStockSession(id, {
        status: 'completed',
        completedAt: new Date(),
      });

      if (!session) {
        res.status(404).json({ message: "Session not found" });
        return;
      }

      // If this is closing stock, trigger reconciliation
      if (session.sessionType === 'closing') {
        const openingSession = await storage.getTodaysStockSession('opening');
        if (openingSession && openingSession.status === 'completed') {
          // Trigger reconciliation calculation
          try {
            await calculateAndSendReconciliation(openingSession.id, session.id);
          } catch (e) {
            log(`Reconciliation failed: ${e}`);
          }
        }
      }

      res.json(session);
    } catch (error: any) {
      log(`Error completing session: ${error.message}`);
      res.status(500).json({ message: "Failed to complete session" });
    }
  });

  // Get inventory items for wizard
  app.get("/api/shop/stock/items", async (req, res) => {
    try {
      const items = await storage.getAllInventoryItems();
      res.json(items);
    } catch (error: any) {
      log(`Error fetching items: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch items" });
    }
  });

  // ============ GOODS RECEIVED ============

  // Get pending dispatches from store
  app.get("/api/shop/goods/pending", async (req, res) => {
    try {
      const despatchLogs = await storage.getPendingDespatchForShop();
      res.json(despatchLogs);
    } catch (error: any) {
      log(`Error fetching pending goods: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch pending goods" });
    }
  });

  // Get all goods receipts
  app.get("/api/shop/goods/receipts", async (req, res) => {
    try {
      const receipts = await storage.getAllGoodsReceipts();
      res.json(receipts);
    } catch (error: any) {
      log(`Error fetching receipts: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch receipts" });
    }
  });

  // Create goods receipt from despatch
  app.post("/api/shop/goods/receive", async (req, res) => {
    try {
      const { despatchLogId, receivedBy, items, notes } = req.body;

      if (!receivedBy || !items || !Array.isArray(items)) {
        res.status(400).json({ message: "receivedBy and items array are required" });
        return;
      }

      // Create the receipt
      const receipt = await storage.createGoodsReceipt({
        despatchLogId,
        receivedBy,
        status: 'received',
        notes,
      });

      // Add items to receipt
      for (const item of items) {
        await storage.createGoodsReceiptItem({
          receiptId: receipt.id,
          itemName: item.itemName,
          expectedQuantity: item.expectedQuantity?.toString() || '0',
          receivedQuantity: item.receivedQuantity?.toString() || item.expectedQuantity?.toString() || '0',
          unit: item.unit || 'units',
          costPerUnit: item.costPerUnit?.toString(),
          inventoryItemId: item.inventoryItemId,
          posterPosId: item.posterPosId,
          notes: item.notes,
        });
      }

      // Generate Excel file
      const excelPath = await generateGoodsReceiptExcel(receipt.id);
      if (excelPath) {
        await storage.updateGoodsReceipt(receipt.id, { excelFilePath: excelPath });
      }

      res.status(201).json({ receipt, excelPath });
    } catch (error: any) {
      log(`Error receiving goods: ${error.message}`);
      res.status(500).json({ message: "Failed to receive goods" });
    }
  });

  // Download goods receipt Excel
  app.get("/api/shop/goods/receipt/:id/excel", async (req, res) => {
    try {
      const { id } = req.params;
      const receipt = await storage.getGoodsReceipt(id);

      if (!receipt) {
        res.status(404).json({ message: "Receipt not found" });
        return;
      }

      // Generate fresh Excel file
      const excelBuffer = await generateGoodsReceiptExcelBuffer(id);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=goods_receipt_${id}.xlsx`);
      res.send(excelBuffer);
    } catch (error: any) {
      log(`Error generating Excel: ${error.message}`);
      res.status(500).json({ message: "Failed to generate Excel" });
    }
  });

  // ============ SHOP EXPENSES ============

  // Get all expenses
  app.get("/api/shop/expenses", async (req, res) => {
    try {
      const { type } = req.query;

      let expenses;
      if (type) {
        expenses = await storage.getExpensesByType(type as string);
      } else {
        expenses = await storage.getAllExpenses();
      }

      // Get items for supermarket expenses
      const expensesWithItems = await Promise.all(
        expenses.map(async (expense) => {
          const items = expense.expenseType === 'supermarket'
            ? await storage.getExpenseItems(expense.id)
            : [];
          return { ...expense, items };
        })
      );

      res.json(expensesWithItems);
    } catch (error: any) {
      log(`Error fetching expenses: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  // Get today's expenses summary
  app.get("/api/shop/expenses/today", async (req, res) => {
    try {
      const expenses = await storage.getTodaysExpenses();
      const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

      // Group by category
      const byCategory: Record<string, number> = {};
      expenses.forEach(e => {
        const cat = e.category || e.expenseType;
        byCategory[cat] = (byCategory[cat] || 0) + Number(e.amount);
      });

      res.json({ expenses, total, byCategory });
    } catch (error: any) {
      log(`Error fetching today's expenses: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  // Create expense (supermarket or petty cash)
  app.post("/api/shop/expenses", async (req, res) => {
    try {
      const { expenseType, category, description, amount, paidBy, paidTo, receiptNumber, notes, items } = req.body;

      if (!expenseType || !description || !amount || !paidBy) {
        res.status(400).json({ message: "expenseType, description, amount, and paidBy are required" });
        return;
      }

      const expense = await storage.createExpense({
        expenseType,
        category,
        description,
        amount: amount.toString(),
        paidBy,
        paidTo,
        receiptNumber,
        notes,
      });

      // If supermarket expense with items, add them
      if (expenseType === 'supermarket' && items && Array.isArray(items)) {
        for (const item of items) {
          await storage.createExpenseItem({
            expenseId: expense.id,
            itemName: item.itemName,
            quantity: item.quantity?.toString() || '1',
            unit: item.unit || 'units',
            costPerUnit: item.costPerUnit?.toString(),
            inventoryItemId: item.inventoryItemId,
          });
        }
      }

      res.status(201).json(expense);
    } catch (error: any) {
      log(`Error creating expense: ${error.message}`);
      res.status(500).json({ message: "Failed to create expense" });
    }
  });

  // ============ RECONCILIATION ============

  // Get today's reconciliation
  app.get("/api/shop/reconciliation/today", async (req, res) => {
    try {
      const recon = await storage.getTodaysReconciliation();
      res.json(recon || { status: 'pending' });
    } catch (error: any) {
      log(`Error fetching reconciliation: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch reconciliation" });
    }
  });

  // Trigger manual reconciliation
  app.post("/api/shop/reconciliation/calculate", async (req, res) => {
    try {
      const openingSession = await storage.getTodaysStockSession('opening');
      const closingSession = await storage.getTodaysStockSession('closing');

      if (!openingSession || openingSession.status !== 'completed') {
        res.status(400).json({ message: "Opening stock must be completed first" });
        return;
      }

      if (!closingSession || closingSession.status !== 'completed') {
        res.status(400).json({ message: "Closing stock must be completed first" });
        return;
      }

      const result = await calculateAndSendReconciliation(openingSession.id, closingSession.id);
      res.json(result);
    } catch (error: any) {
      log(`Error calculating reconciliation: ${error.message}`);
      res.status(500).json({ message: "Failed to calculate reconciliation" });
    }
  });

  // Helper function for reconciliation
  async function calculateAndSendReconciliation(openingId: string, closingId: string) {
    const openingEntries = await storage.getStockEntriesBySession(openingId);
    const closingEntries = await storage.getStockEntriesBySession(closingId);

    // Get goods received today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const receipts = await storage.getAllGoodsReceipts(20);
    const todayReceipts = receipts.filter(r => new Date(r.receivedAt) >= today);

    // Build lookup maps
    const openingMap = new Map(openingEntries.map(e => [e.itemName, Number(e.quantity)]));
    const closingMap = new Map(closingEntries.map(e => [e.itemName, Number(e.quantity)]));

    // Calculate received quantities per item
    const receivedMap = new Map<string, number>();
    for (const receipt of todayReceipts) {
      const items = await storage.getGoodsReceiptItems(receipt.id);
      for (const item of items) {
        const current = receivedMap.get(item.itemName) || 0;
        receivedMap.set(item.itemName, current + Number(item.receivedQuantity || 0));
      }
    }

    // Calculate variances
    const allItems = new Set([...Array.from(openingMap.keys()), ...Array.from(closingMap.keys())]);
    let overItems = 0;
    let underItems = 0;
    let matchedItems = 0;

    const details: Array<{
      item: string;
      opening: number;
      received: number;
      expected: number;
      closing: number;
      variance: number;
      status: 'over' | 'under' | 'equal';
    }> = [];

    allItems.forEach(itemName => {
      const opening = openingMap.get(itemName) || 0;
      const received = receivedMap.get(itemName) || 0;
      const closing = closingMap.get(itemName) || 0;
      const expected = opening + received;
      const variance = closing - expected;

      let status: 'over' | 'under' | 'equal';
      if (variance > 0) {
        status = 'over';
        overItems++;
      } else if (variance < 0) {
        status = 'under';
        underItems++;
      } else {
        status = 'equal';
        matchedItems++;
      }

      details.push({ item: itemName, opening, received, expected, closing, variance, status });
    });

    // Save reconciliation
    const recon = await storage.createReconciliation({
      date: new Date(),
      openingSessionId: openingId,
      closingSessionId: closingId,
      status: 'completed',
      overItems,
      underItems,
      matchedItems,
    });

    // Send to owner via Telegram
    if (isTelegramBotInitialized()) {
      try {
        const bot = getTelegramBot();

        const overDetails = details.filter(d => d.status === 'over').map(d =>
          `  ${d.item}: +${d.variance} (expected ${d.expected}, found ${d.closing})`
        ).join('\n');

        const underDetails = details.filter(d => d.status === 'under').map(d =>
          `  ${d.item}: ${d.variance} (expected ${d.expected}, found ${d.closing})`
        ).join('\n');

        let message = `📊 *Daily Stock Reconciliation*\n\n`;
        message += `📅 Date: ${new Date().toLocaleDateString()}\n\n`;
        message += `✅ Matched: ${matchedItems} items\n`;
        message += `⬆️ Over: ${overItems} items\n`;
        message += `⬇️ Under: ${underItems} items\n\n`;

        if (overItems > 0) {
          message += `*Items OVER:*\n${overDetails}\n\n`;
        }

        if (underItems > 0) {
          message += `*Items UNDER:*\n${underDetails}\n`;
        }

        await bot.sendNotification(message, 'owner');

        await storage.updateReconciliation(recon.id, {
          status: 'sent',
          sentToOwnerAt: new Date(),
        });
      } catch (e) {
        log(`Failed to send reconciliation to owner: ${e}`);
      }
    }

    return { reconciliation: recon, details };
  }

  // Helper function to generate Excel for goods receipt
  async function generateGoodsReceiptExcel(receiptId: string): Promise<string | null> {
    try {
      const ExcelJS = require('exceljs');
      const fs = require('fs');
      const path = require('path');

      const receipt = await storage.getGoodsReceipt(receiptId);
      if (!receipt) return null;

      const items = await storage.getGoodsReceiptItems(receiptId);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Goods Receipt');

      // PosterPOS Add Supply format
      worksheet.columns = [
        { header: 'Product Name', key: 'name', width: 30 },
        { header: 'Quantity', key: 'qty', width: 12 },
        { header: 'Unit', key: 'unit', width: 12 },
        { header: 'Cost per Unit', key: 'cost', width: 15 },
        { header: 'Total Cost', key: 'total', width: 15 },
        { header: 'Notes', key: 'notes', width: 20 },
      ];

      items.forEach(item => {
        const cost = Number(item.costPerUnit || 0);
        const qty = Number(item.receivedQuantity || 0);
        worksheet.addRow({
          name: item.itemName,
          qty: qty,
          unit: item.unit,
          cost: cost,
          total: cost * qty,
          notes: item.notes || '',
        });
      });

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Create exports directory if needed
      const dir = './exports';
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const filename = `goods_receipt_${receiptId}_${Date.now()}.xlsx`;
      const filepath = path.join(dir, filename);

      await workbook.xlsx.writeFile(filepath);

      return filepath;
    } catch (error) {
      log(`Error generating Excel: ${error}`);
      return null;
    }
  }

  // Helper to generate Excel buffer for download
  async function generateGoodsReceiptExcelBuffer(receiptId: string): Promise<Buffer> {
    const ExcelJS = require('exceljs');

    const receipt = await storage.getGoodsReceipt(receiptId);
    if (!receipt) throw new Error('Receipt not found');

    const items = await storage.getGoodsReceiptItems(receiptId);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Goods Receipt');

    worksheet.columns = [
      { header: 'Product Name', key: 'name', width: 30 },
      { header: 'Quantity', key: 'qty', width: 12 },
      { header: 'Unit', key: 'unit', width: 12 },
      { header: 'Cost per Unit', key: 'cost', width: 15 },
      { header: 'Total Cost', key: 'total', width: 15 },
      { header: 'Notes', key: 'notes', width: 20 },
    ];

    items.forEach(item => {
      const cost = Number(item.costPerUnit || 0);
      const qty = Number(item.receivedQuantity || 0);
      worksheet.addRow({
        name: item.itemName,
        qty: qty,
        unit: item.unit,
        cost: cost,
        total: cost * qty,
        notes: item.notes || '',
      });
    });

    worksheet.getRow(1).font = { bold: true };

    return await workbook.xlsx.writeBuffer();
  }

  // ============ CONFIG STATUS ROUTES ============
  app.get("/api/config/status", async (req, res) => {
    res.json({
      posterpos: !!posterEndpoint && !!posterToken,
      telegram: !!telegramToken,
    });
  });

  // ============ ENHANCED INVENTORY ROUTES (Supabase-powered) ============
  // Mount the new v2 API routes for enhanced inventory tracking
  app.use("/api/v2", inventoryRoutes);
  log('Enhanced inventory routes mounted at /api/v2');

  // ============ PORTAL ROUTES ============
  app.use("/api/store-portal", storePortalRoutes);
  app.use("/api/shop-portal", shopPortalRoutes);
  app.use("/api/partner", partnerPortalRoutes);
  app.use("/api/insights", insightsRoutes);
  log('Portal routes mounted: /api/store-portal, /api/shop-portal, /api/partner, /api/insights');

  return httpServer;
}
