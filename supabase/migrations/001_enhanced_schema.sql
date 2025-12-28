-- PosterGram Enhanced Schema for Supabase
-- This migration creates the enhanced ingredient tracking system
-- with recipe-to-purchase linking and weighted average costing

-- ============================================================================
-- CORE TABLES: Locations, Units, and Ingredients
-- ============================================================================

-- Locations (Store vs Kiosk)
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('store', 'kiosk')),
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default locations
INSERT INTO locations (name, type) VALUES 
    ('Main Store', 'store'),
    ('Kiosk', 'kiosk')
ON CONFLICT (name) DO NOTHING;

-- Unit of Measure
CREATE TABLE IF NOT EXISTS units_of_measure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    abbreviation TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('mass', 'volume', 'count')),
    base_unit TEXT, -- e.g., 'g' for mass, 'ml' for volume
    conversion_to_base DECIMAL(10, 6) NOT NULL DEFAULT 1, -- e.g., kg = 1000 for grams
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert common units
INSERT INTO units_of_measure (name, abbreviation, type, base_unit, conversion_to_base) VALUES
    ('Kilogram', 'kg', 'mass', 'g', 1000),
    ('Gram', 'g', 'mass', 'g', 1),
    ('Milligram', 'mg', 'mass', 'g', 0.001),
    ('Liter', 'L', 'volume', 'ml', 1000),
    ('Milliliter', 'ml', 'volume', 'ml', 1),
    ('Pieces', 'pcs', 'count', 'pcs', 1),
    ('Units', 'units', 'count', 'units', 1)
ON CONFLICT (abbreviation) DO NOTHING;

-- Ingredient Categories
CREATE TABLE IF NOT EXISTS ingredient_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default categories
INSERT INTO ingredient_categories (name) VALUES
    ('Fruits'),
    ('Dairy'),
    ('Sweeteners'),
    ('Supplements'),
    ('Packaging'),
    ('Other')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- MASTER INGREDIENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Poster POS Integration
    poster_ingredient_id TEXT UNIQUE,
    poster_product_id TEXT, -- Some ingredients may be products
    
    -- Basic Info
    name TEXT NOT NULL,
    category_id UUID REFERENCES ingredient_categories(id),
    description TEXT,
    
    -- Default Unit (purchases/recipes use this or convert to it)
    default_unit_id UUID REFERENCES units_of_measure(id),
    
    -- Stock Levels (maintained per location via triggers)
    min_stock_level DECIMAL(12, 4) DEFAULT 0,
    max_stock_level DECIMAL(12, 4),
    reorder_point DECIMAL(12, 4),
    
    -- Cost Tracking (Weighted Average)
    weighted_avg_cost DECIMAL(12, 4) DEFAULT 0,
    last_purchase_cost DECIMAL(12, 4),
    currency TEXT DEFAULT 'KES',
    
    -- Metadata
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for Poster lookups
CREATE INDEX IF NOT EXISTS idx_ingredients_poster_id ON ingredients(poster_ingredient_id);

-- ============================================================================
-- INGREDIENT STOCK PER LOCATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS ingredient_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    
    -- Current Stock
    current_stock DECIMAL(12, 4) NOT NULL DEFAULT 0,
    unit_id UUID REFERENCES units_of_measure(id),
    
    -- Weighted Average Cost at this location
    weighted_avg_cost DECIMAL(12, 4) DEFAULT 0,
    
    -- Timestamps
    last_stock_update TIMESTAMPTZ,
    last_stock_take TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint: one stock record per ingredient per location
    UNIQUE(ingredient_id, location_id)
);

-- ============================================================================
-- INGREDIENT BATCHES (For Cost Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ingredient_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id),
    
    -- Source Tracking
    purchase_id UUID, -- Links to store_purchases or legacy purchases
    purchase_item_id UUID, -- Specific line item
    movement_id UUID, -- If received via inter-location transfer
    
    -- Batch Details
    batch_number TEXT,
    initial_quantity DECIMAL(12, 4) NOT NULL,
    remaining_quantity DECIMAL(12, 4) NOT NULL,
    unit_id UUID REFERENCES units_of_measure(id),
    
    -- Cost at time of purchase
    cost_per_unit DECIMAL(12, 4) NOT NULL,
    total_cost DECIMAL(12, 4) NOT NULL,
    currency TEXT DEFAULT 'KES',
    
    -- Dates
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'depleted', 'expired', 'written_off')),
    depleted_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for batch lookups
CREATE INDEX IF NOT EXISTS idx_batches_ingredient ON ingredient_batches(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_batches_location ON ingredient_batches(location_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON ingredient_batches(status) WHERE status = 'active';

-- ============================================================================
-- RECIPES (Synced from Poster POS Products)
-- ============================================================================

CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Poster POS Integration
    poster_product_id TEXT UNIQUE NOT NULL,
    
    -- Recipe Details
    name TEXT NOT NULL,
    category TEXT,
    
    -- Type: dish, semi-finished, etc.
    recipe_type TEXT DEFAULT 'product',
    
    -- Base yield (how much this recipe makes)
    yield_quantity DECIMAL(10, 4) DEFAULT 1,
    yield_unit_id UUID REFERENCES units_of_measure(id),
    
    -- Pricing
    selling_price DECIMAL(12, 2),
    theoretical_cost DECIMAL(12, 4), -- Calculated from ingredients
    target_margin DECIMAL(5, 2),
    
    -- Metadata
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for Poster lookups
CREATE INDEX IF NOT EXISTS idx_recipes_poster_id ON recipes(poster_product_id);

-- ============================================================================
-- RECIPE INGREDIENTS (Bill of Materials)
-- ============================================================================

CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    
    -- Quantity per unit of recipe output
    quantity DECIMAL(12, 6) NOT NULL,
    unit_id UUID REFERENCES units_of_measure(id),
    
    -- Is this optional (e.g., a modification)?
    is_optional BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT true, -- Included by default if optional
    
    -- For modifications/variations
    modification_group TEXT, -- e.g., "size", "milk_type"
    modification_name TEXT, -- e.g., "Large", "Oat Milk"
    poster_modification_id TEXT,
    
    -- Extra charge for this ingredient
    additional_price DECIMAL(12, 2) DEFAULT 0,
    
    -- Ordering
    sort_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(recipe_id, ingredient_id, modification_group, modification_name)
);

-- ============================================================================
-- INVENTORY MOVEMENTS (Store → Kiosk Transfers)
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Movement Details
    movement_type TEXT NOT NULL CHECK (movement_type IN (
        'purchase',           -- Received from supplier
        'transfer_out',       -- Sent to another location
        'transfer_in',        -- Received from another location
        'sale_consumption',   -- Used in a sale (recipe)
        'processing',         -- Converted during processing (kg → portions)
        'adjustment',         -- Manual stock adjustment
        'waste',              -- Written off/spoiled
        'stock_take'          -- Adjustment from stock count
    )),
    
    -- Locations
    from_location_id UUID REFERENCES locations(id),
    to_location_id UUID REFERENCES locations(id),
    
    -- Ingredient Details
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    batch_id UUID REFERENCES ingredient_batches(id),
    
    -- Quantities
    quantity DECIMAL(12, 4) NOT NULL, -- Positive for in, negative for out
    unit_id UUID REFERENCES units_of_measure(id),
    
    -- Cost at time of movement
    unit_cost DECIMAL(12, 4),
    total_cost DECIMAL(12, 4),
    
    -- Unit Conversion (if applicable)
    from_unit_id UUID REFERENCES units_of_measure(id),
    from_quantity DECIMAL(12, 4),
    conversion_factor DECIMAL(12, 6),
    
    -- Reference to related records
    sale_transaction_id UUID,
    despatch_id UUID,
    purchase_id UUID,
    
    -- Metadata
    notes TEXT,
    performed_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for movement tracking
CREATE INDEX IF NOT EXISTS idx_movements_ingredient ON inventory_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_movements_location_from ON inventory_movements(from_location_id);
CREATE INDEX IF NOT EXISTS idx_movements_location_to ON inventory_movements(to_location_id);
CREATE INDEX IF NOT EXISTS idx_movements_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_movements_date ON inventory_movements(created_at);

-- ============================================================================
-- INGREDIENT CONSUMPTION LOG (THE KEY AUDIT TABLE)
-- Links every sale back to specific ingredients and their costs
-- ============================================================================

CREATE TABLE IF NOT EXISTS ingredient_consumption (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Sale Reference
    sale_transaction_id TEXT NOT NULL, -- Poster transaction ID
    sale_product_id TEXT, -- Poster product ID sold
    sale_timestamp TIMESTAMPTZ NOT NULL,
    
    -- Recipe Used
    recipe_id UUID REFERENCES recipes(id),
    recipe_name TEXT,
    quantity_sold DECIMAL(10, 4) NOT NULL DEFAULT 1,
    
    -- Ingredient Consumed
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    ingredient_name TEXT,
    
    -- Batch tracking (which batch was consumed from)
    batch_id UUID REFERENCES ingredient_batches(id),
    
    -- Location where consumed
    location_id UUID NOT NULL REFERENCES locations(id),
    
    -- Consumption Details
    quantity_consumed DECIMAL(12, 6) NOT NULL,
    unit_id UUID REFERENCES units_of_measure(id),
    
    -- Cost at time of consumption
    cost_per_unit DECIMAL(12, 4),
    total_cost DECIMAL(12, 4),
    
    -- Was this a modification/add-on?
    is_modification BOOLEAN DEFAULT false,
    modification_name TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for consumption analysis
CREATE INDEX IF NOT EXISTS idx_consumption_sale ON ingredient_consumption(sale_transaction_id);
CREATE INDEX IF NOT EXISTS idx_consumption_ingredient ON ingredient_consumption(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_consumption_recipe ON ingredient_consumption(recipe_id);
CREATE INDEX IF NOT EXISTS idx_consumption_location ON ingredient_consumption(location_id);
CREATE INDEX IF NOT EXISTS idx_consumption_date ON ingredient_consumption(sale_timestamp);
CREATE INDEX IF NOT EXISTS idx_consumption_batch ON ingredient_consumption(batch_id);

-- ============================================================================
-- ENHANCED STORE PURCHASES (Links to batches)
-- ============================================================================

-- Add columns to existing store_purchases if migrating, or create fresh
CREATE TABLE IF NOT EXISTS supplier_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Supplier Info
    supplier_name TEXT,
    supplier_id UUID,
    
    -- Purchase Details
    invoice_number TEXT,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    received_date DATE,
    
    -- Totals
    subtotal DECIMAL(12, 2),
    tax_amount DECIMAL(12, 2),
    shipping_cost DECIMAL(12, 2),
    total_amount DECIMAL(12, 2),
    currency TEXT DEFAULT 'KES',
    
    -- Payment
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
    payment_method TEXT,
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    
    -- Receiving Location
    location_id UUID NOT NULL REFERENCES locations(id),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('ordered', 'received', 'partially_received', 'cancelled')),
    
    -- Metadata
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES supplier_purchases(id) ON DELETE CASCADE,
    
    -- Ingredient
    ingredient_id UUID REFERENCES ingredients(id),
    ingredient_name TEXT NOT NULL, -- Denormalized for history
    
    -- Quantity & Units
    ordered_quantity DECIMAL(12, 4) NOT NULL,
    received_quantity DECIMAL(12, 4),
    unit_id UUID REFERENCES units_of_measure(id),
    unit_name TEXT, -- Denormalized
    
    -- Pricing
    unit_cost DECIMAL(12, 4) NOT NULL,
    total_cost DECIMAL(12, 4) NOT NULL,
    
    -- Batch created from this item
    batch_id UUID REFERENCES ingredient_batches(id),
    
    -- Status
    status TEXT DEFAULT 'received',
    
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PROCESSING RECORDS (Store processes kg → portions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS processing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES locations(id),
    
    -- Input ingredient (consumed)
    input_ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    input_batch_id UUID REFERENCES ingredient_batches(id),
    input_quantity DECIMAL(12, 4) NOT NULL,
    input_unit_id UUID REFERENCES units_of_measure(id),
    
    -- Output ingredient (produced)
    output_ingredient_id UUID REFERENCES ingredients(id),
    output_quantity DECIMAL(12, 4) NOT NULL,
    output_unit_id UUID REFERENCES units_of_measure(id),
    
    -- Cost allocation
    input_cost DECIMAL(12, 4),
    output_cost_per_unit DECIMAL(12, 4), -- input_cost / output_quantity
    
    -- Processing Details
    processing_type TEXT, -- e.g., 'portioning', 'juicing', 'prep'
    yield_percentage DECIMAL(5, 2), -- Actual yield vs theoretical
    
    -- Waste
    waste_quantity DECIMAL(12, 4) DEFAULT 0,
    waste_unit_id UUID REFERENCES units_of_measure(id),
    
    -- Metadata
    processed_by TEXT,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

-- Current Stock View (per location)
CREATE OR REPLACE VIEW v_current_stock AS
SELECT 
    i.id AS ingredient_id,
    i.name AS ingredient_name,
    i.poster_ingredient_id,
    l.id AS location_id,
    l.name AS location_name,
    l.type AS location_type,
    COALESCE(s.current_stock, 0) AS current_stock,
    u.abbreviation AS unit,
    i.min_stock_level,
    i.reorder_point,
    COALESCE(s.weighted_avg_cost, i.weighted_avg_cost, 0) AS avg_cost,
    CASE 
        WHEN COALESCE(s.current_stock, 0) <= 0 THEN 'out_of_stock'
        WHEN COALESCE(s.current_stock, 0) <= COALESCE(i.reorder_point, i.min_stock_level, 0) THEN 'low_stock'
        ELSE 'in_stock'
    END AS stock_status
FROM ingredients i
CROSS JOIN locations l
LEFT JOIN ingredient_stock s ON i.id = s.ingredient_id AND l.id = s.location_id
LEFT JOIN units_of_measure u ON i.default_unit_id = u.id
WHERE i.is_active = true;

-- Product Profitability View
CREATE OR REPLACE VIEW v_product_profitability AS
SELECT 
    r.id AS recipe_id,
    r.name AS product_name,
    r.poster_product_id,
    r.selling_price,
    COALESCE(SUM(ri.quantity * COALESCE(i.weighted_avg_cost, 0)), 0) AS calculated_cogs,
    r.selling_price - COALESCE(SUM(ri.quantity * COALESCE(i.weighted_avg_cost, 0)), 0) AS gross_profit,
    CASE 
        WHEN r.selling_price > 0 
        THEN ((r.selling_price - COALESCE(SUM(ri.quantity * COALESCE(i.weighted_avg_cost, 0)), 0)) / r.selling_price * 100)
        ELSE 0
    END AS margin_percentage
FROM recipes r
LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id AND ri.is_optional = false
LEFT JOIN ingredients i ON ri.ingredient_id = i.id
WHERE r.is_active = true
GROUP BY r.id, r.name, r.poster_product_id, r.selling_price;

-- Daily Consumption Summary
CREATE OR REPLACE VIEW v_daily_consumption AS
SELECT 
    DATE(sale_timestamp) AS sale_date,
    location_id,
    ingredient_id,
    ingredient_name,
    SUM(quantity_consumed) AS total_consumed,
    SUM(total_cost) AS total_cost,
    COUNT(DISTINCT sale_transaction_id) AS transaction_count
FROM ingredient_consumption
GROUP BY DATE(sale_timestamp), location_id, ingredient_id, ingredient_name;

-- ============================================================================
-- FUNCTIONS FOR STOCK MANAGEMENT
-- ============================================================================

-- Function to update weighted average cost when new batch arrives
CREATE OR REPLACE FUNCTION update_weighted_avg_cost()
RETURNS TRIGGER AS $$
DECLARE
    current_stock DECIMAL(12, 4);
    current_avg_cost DECIMAL(12, 4);
    new_weighted_avg DECIMAL(12, 4);
BEGIN
    -- Get current stock and avg cost for this ingredient at this location
    SELECT COALESCE(s.current_stock, 0), COALESCE(s.weighted_avg_cost, 0)
    INTO current_stock, current_avg_cost
    FROM ingredient_stock s
    WHERE s.ingredient_id = NEW.ingredient_id 
      AND s.location_id = NEW.location_id;
    
    -- Calculate new weighted average
    IF current_stock + NEW.initial_quantity > 0 THEN
        new_weighted_avg := (
            (current_stock * current_avg_cost) + (NEW.initial_quantity * NEW.cost_per_unit)
        ) / (current_stock + NEW.initial_quantity);
    ELSE
        new_weighted_avg := NEW.cost_per_unit;
    END IF;
    
    -- Update or insert stock record
    INSERT INTO ingredient_stock (ingredient_id, location_id, current_stock, weighted_avg_cost, last_stock_update)
    VALUES (NEW.ingredient_id, NEW.location_id, NEW.initial_quantity, new_weighted_avg, NOW())
    ON CONFLICT (ingredient_id, location_id) 
    DO UPDATE SET 
        current_stock = ingredient_stock.current_stock + NEW.initial_quantity,
        weighted_avg_cost = new_weighted_avg,
        last_stock_update = NOW(),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new batches
DROP TRIGGER IF EXISTS trg_batch_stock_update ON ingredient_batches;
CREATE TRIGGER trg_batch_stock_update
AFTER INSERT ON ingredient_batches
FOR EACH ROW
EXECUTE FUNCTION update_weighted_avg_cost();

-- Function to deduct stock on consumption
CREATE OR REPLACE FUNCTION deduct_stock_on_consumption()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE ingredient_stock
    SET current_stock = current_stock - NEW.quantity_consumed,
        last_stock_update = NOW(),
        updated_at = NOW()
    WHERE ingredient_id = NEW.ingredient_id 
      AND location_id = NEW.location_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for consumption
DROP TRIGGER IF EXISTS trg_consumption_stock_update ON ingredient_consumption;
CREATE TRIGGER trg_consumption_stock_update
AFTER INSERT ON ingredient_consumption
FOR EACH ROW
EXECUTE FUNCTION deduct_stock_on_consumption();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on key tables
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_purchases ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all data (for now - can be refined by role)
CREATE POLICY "Allow authenticated read" ON ingredients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON ingredient_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON ingredient_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON ingredient_consumption FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON supplier_purchases FOR SELECT TO authenticated USING (true);

-- Allow service role full access (for backend operations)
CREATE POLICY "Allow service role all" ON ingredients FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role all" ON ingredient_stock FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role all" ON ingredient_batches FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role all" ON recipes FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role all" ON ingredient_consumption FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role all" ON supplier_purchases FOR ALL TO service_role USING (true);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON v_current_stock TO authenticated;
GRANT SELECT ON v_product_profitability TO authenticated;
GRANT SELECT ON v_daily_consumption TO authenticated;

