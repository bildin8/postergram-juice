---
description: Migrate PosterGram to Supabase with enhanced recipe-to-purchase tracking
---

# Supabase Migration & Enhancement Workflow

## Overview
This workflow migrates PosterGram from direct PostgreSQL/Drizzle to Supabase, adding comprehensive ingredient tracking that links store purchases through to POS sales via recipes.

## Key Features Being Added
1. **Weighted Average Cost Tracking** - Running average cost per ingredient
2. **Unit Conversion System** - Convert between kg/g/ml as items move from store processing to kiosk
3. **Location-Based Inventory** - Separate stock for Store vs Kiosk with movement tracking
4. **Recipe-to-Purchase Linking** - Full traceability from sale → recipe → ingredient → purchase
5. **30-Day Historical Migration** - Back-populate consumption data

---

## Phase 1: Database Setup

### Step 1.1: Run Supabase Migrations
// turbo
```bash
cd PosterGram && npx supabase db push
```

Or manually run the SQL in `supabase/migrations/` via Supabase Dashboard.

### Step 1.2: Sync Recipes from Poster
Run the recipe sync script to populate recipes and ingredients from Poster POS.

---

## Phase 2: Application Updates

### Step 2.1: Install Supabase Client
// turbo
```bash
cd PosterGram && npm install @supabase/supabase-js
```

### Step 2.2: Update Environment Variables
Add to `.env`:
```
SUPABASE_URL=https://mnksseywxoeswgsanzll.supabase.co
SUPABASE_ANON_KEY=sb_publishable_6b1yqJxH8_qPG9fWbEss9A_RdvUhTf1
```

### Step 2.3: Update Server Code
- Replace Drizzle calls with Supabase client
- Add new API endpoints for enhanced features
- Update transaction sync to log consumption

---

## Phase 3: Data Migration

### Step 3.1: Migrate Last 30 Days
Run the migration script to:
1. Import existing ingredients from Poster
2. Create batches from recent purchases
3. Process historical transactions to create consumption logs
4. Reconcile stock levels

---

## Phase 4: New Features

### Step 4.1: Store → Kiosk Movement
Enable tracking of:
- Processing at store (unit conversion)
- Despatch to kiosk
- Receipt at kiosk
- Stock updates at both locations

### Step 4.2: Enhanced Analytics
- Product profitability (revenue - COGS)
- Ingredient velocity
- Variance analysis

---

## Key Tables Added

| Table | Purpose |
|-------|---------|
| `ingredients` | Master ingredient list with stock levels per location |
| `ingredient_batches` | Purchase batches with cost tracking |
| `unit_conversions` | Conversion factors (kg → g, L → ml) |
| `recipes` | Product-to-ingredient mappings from Poster |
| `recipe_ingredients` | Bill of materials per product |
| `ingredient_consumption` | Audit log linking sales to ingredient usage |
| `inventory_movements` | Stock transfers between Store and Kiosk |

---

## Architecture

```
                    ┌─────────────┐
                    │  Poster POS │
                    └──────┬──────┘
                           │ Webhooks/Sync
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      SUPABASE                                 │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │   Auth &    │  │  Realtime   │  │   PostgreSQL DB     │   │
│  │    RLS      │  │ Subscriptions│  │  (Enhanced Schema)  │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
├──────────────────────────────────────────────────────────────┤
│  Edge Functions: Poster Webhook Handler                       │
└──────────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ Web App  │    │ Telegram │    │ Mobile   │
    │ (React)  │    │   Bot    │    │   PWA    │
    └──────────┘    └──────────┘    └──────────┘
```
