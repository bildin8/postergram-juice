-- Add Suppliers and Reorder Templates

-- Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link Store Items to Suppliers
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS barcode TEXT;

-- Reorder Templates
CREATE TABLE IF NOT EXISTS reorder_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reorder_template_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES reorder_templates(id) ON DELETE CASCADE,
    store_item_id UUID REFERENCES store_items(id),
    item_name TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit TEXT DEFAULT 'units'
);

-- RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reorder_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reorder_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON suppliers FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON reorder_templates FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON reorder_template_items FOR ALL TO service_role USING (true);

CREATE POLICY "authenticated_read" ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON reorder_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON reorder_template_items FOR SELECT TO authenticated USING (true);
