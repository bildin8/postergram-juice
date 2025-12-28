# 🚀 PosterGram Enhanced - Supabase Migration Complete

## Overview

This document summarizes the enhanced PosterGram system with Supabase integration for full recipe-to-purchase traceability.

---

## ✅ What's Been Created

### 1. Database Schema (`supabase/migrations/001_enhanced_schema.sql`)

New tables for comprehensive ingredient tracking:

| Table | Purpose |
|-------|---------|
| `locations` | Store vs Kiosk tracking |
| `units_of_measure` | Unit conversion support (kg → g, L → ml) |
| `ingredients` | Master ingredient list with weighted avg cost |
| `ingredient_stock` | Stock levels per location |
| `ingredient_batches` | Purchase batches with FIFO-ready cost tracking |
| `recipes` | Products with their ingredient recipes |
| `recipe_ingredients` | Bill of materials (including modifiers) |
| `ingredient_consumption` | **KEY AUDIT TABLE** - links every sale to ingredient usage |
| `inventory_movements` | All stock movements (purchases, transfers, consumption, waste) |
| `supplier_purchases` | Enhanced purchase tracking |
| `supplier_purchase_items` | Line items with batch creation |
| `processing_records` | Store processing (kg → portions) |

**Views:**
- `v_current_stock` - Real-time stock levels with status
- `v_product_profitability` - Revenue - COGS per product
- `v_daily_consumption` - Daily usage summary

**Triggers:**
- `trg_batch_stock_update` - Automatically updates stock & weighted avg cost on new batches
- `trg_consumption_stock_update` - Automatically deducts stock on consumption

### 2. Server-Side Code

| File | Purpose |
|------|---------|
| `server/supabase.ts` | Supabase client configuration |
| `server/database.types.ts` | TypeScript type definitions |
| `server/inventoryService.ts` | Core business logic for the new system |
| `server/inventoryRoutes.ts` | REST API endpoints at `/api/v2/*` |

### 3. Configuration

| File | Purpose |
|------|---------|
| `.env` | Environment variables with Supabase credentials |
| `.env.example` | Template for developers |
| `.agent/workflows/supabase-migration.md` | Step-by-step migration workflow |

---

## 📋 Next Steps

### Step 1: Run the Database Migration

Go to your Supabase Dashboard and run the migration SQL:

1. Open https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Copy the contents of `supabase/migrations/001_enhanced_schema.sql`
5. Click **Run**

### Step 2: Get Your Service Role Key

1. In Supabase Dashboard, go to **Settings** → **API**
2. Copy the **service_role** key (anon/public)
3. Add it to your `.env` file as `SUPABASE_SERVICE_KEY`

### Step 3: Configure Poster POS (if not already)

Add your Poster POS credentials to `.env`:
```
POSTERPOS_API_ENDPOINT=https://YOUR_ACCOUNT.joinposter.com
POSTERPOS_API_TOKEN=your_token_here
```

### Step 4: Start the Application

```powershell
cd PosterGram
npm run dev
```

### Step 5: Sync Recipes from Poster

Call the sync endpoint to populate recipes:
```
POST http://localhost:5000/api/v2/recipes/sync
```

### Step 6: Process Historical Data (Optional)

To back-populate the last 30 days of consumption data:
```
POST http://localhost:5000/api/v2/migration/historical
Body: { "days": 30 }
```

---

## 🔗 New API Endpoints

All new endpoints are under `/api/v2/`:

### Recipes
- `POST /api/v2/recipes/sync` - Sync recipes from Poster POS
- `GET /api/v2/recipes` - List all recipes with ingredients
- `GET /api/v2/recipes/:id` - Get recipe details

### Ingredients
- `GET /api/v2/ingredients` - List all ingredients with stock
- `POST /api/v2/ingredients` - Create ingredient
- `PATCH /api/v2/ingredients/:id` - Update ingredient

### Stock
- `GET /api/v2/stock` - Current stock levels (optionally filter by location)
- `GET /api/v2/stock/low` - Low stock items

### Batches
- `GET /api/v2/batches` - Active ingredient batches
- `POST /api/v2/batches` - Create a batch manually

### Transfers
- `POST /api/v2/transfers` - Transfer ingredients from Store to Kiosk
- `GET /api/v2/transfers` - Transfer history

### Consumption & Analytics
- `GET /api/v2/consumption` - Consumption history
- `GET /api/v2/consumption/daily` - Daily summary
- `GET /api/v2/analytics/profitability` - Product profitability

### Purchases
- `POST /api/v2/purchases` - Create purchase with automatic batch creation
- `GET /api/v2/purchases` - Purchase history

### Utilities
- `GET /api/v2/locations` - List locations
- `GET /api/v2/units` - Units of measure

---

## 🔄 How It Works

### Purchase Flow
```
1. Record Purchase
   └── POST /api/v2/purchases
   
2. System Creates:
   ├── supplier_purchases record
   ├── supplier_purchase_items records
   └── ingredient_batches (one per line item)
   
3. Triggers Fire:
   ├── Update ingredient_stock.current_stock
   └── Recalculate weighted_avg_cost
```

### Sale Flow (Automatic)
```
1. Poster POS Transaction Received
   
2. Transaction Sync:
   ├── Store in sales_records (legacy)
   └── Call logSaleConsumption()
   
3. For Each Product Sold:
   ├── Look up recipe
   ├── Get recipe_ingredients
   └── For each ingredient:
       ├── Create ingredient_consumption record
       └── Trigger deducts from ingredient_stock
```

### Transfer Flow
```
1. Store Manager Initiates Transfer
   └── POST /api/v2/transfers
   
2. System:
   ├── Deduct from Store stock
   ├── Create batch at Kiosk
   ├── Record inventory_movements (transfer_out, transfer_in)
   └── Update stock levels
```

---

## 📊 Key Reports Now Available

### 1. Product Profitability
See which products are most profitable based on actual ingredient costs.

### 2. Ingredient Usage
Track which ingredients are consumed the most and from which products.

### 3. Stock by Location
View stock levels at Store vs Kiosk separately.

### 4. Full Traceability
For any ingredient, trace back:
- Which batches it came from
- Which purchases created those batches
- Which sales consumed it

---

## 🛠️ Troubleshooting

### "Supabase client not initialized"
Check that `.env` has the correct `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

### "Recipe not found for product"
Run the recipe sync: `POST /api/v2/recipes/sync`

### Consumption not being logged
Ensure:
1. Recipes are synced from Poster
2. Ingredient IDs in recipes match those in your database
3. Transaction sync is running

---

## 📝 Notes

- The system uses **Weighted Average Cost** for simplicity
- Old `/api/*` endpoints still work for backward compatibility
- New features are at `/api/v2/*`
- RLS policies are set up for authenticated access
