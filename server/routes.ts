import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { z } from "zod";
import { insertInventoryItemSchema, insertSalesRecordSchema, insertDespatchLogSchema, insertReorderRequestSchema } from "@shared/schema";
import { initPosterPOSClient, getPosterPOSClient, isPosterPOSInitialized } from "./posterpos";
import { initTelegramBot, getTelegramBot, isTelegramBotInitialized } from "./telegram";
import { startTransactionSync, syncNewTransactions, getLastSyncTimestamp } from "./transactionSync";
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

  // Start background transaction sync (10-minute polling)
  if (posterEndpoint && posterToken && telegramToken) {
    startTransactionSync();
    log('Transaction sync started (10-minute interval)');
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

  return httpServer;
}
