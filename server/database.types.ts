// Database types for Supabase
// These types are auto-generated from your Supabase schema
// Run: npx supabase gen types typescript --project-id mnksseywxoeswgsanzll > server/database.types.ts

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            locations: {
                Row: {
                    id: string
                    name: string
                    type: 'store' | 'kiosk'
                    address: string | null
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    type: 'store' | 'kiosk'
                    address?: string | null
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    type?: 'store' | 'kiosk'
                    address?: string | null
                    is_active?: boolean
                    created_at?: string
                }
            }
            units_of_measure: {
                Row: {
                    id: string
                    name: string
                    abbreviation: string
                    type: 'mass' | 'volume' | 'count'
                    base_unit: string | null
                    conversion_to_base: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    abbreviation: string
                    type: 'mass' | 'volume' | 'count'
                    base_unit?: string | null
                    conversion_to_base?: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    abbreviation?: string
                    type?: 'mass' | 'volume' | 'count'
                    base_unit?: string | null
                    conversion_to_base?: number
                    created_at?: string
                }
            }
            ingredients: {
                Row: {
                    id: string
                    poster_ingredient_id: string | null
                    poster_product_id: string | null
                    name: string
                    category_id: string | null
                    description: string | null
                    default_unit_id: string | null
                    min_stock_level: number
                    max_stock_level: number | null
                    reorder_point: number | null
                    weighted_avg_cost: number
                    last_purchase_cost: number | null
                    currency: string
                    is_active: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    poster_ingredient_id?: string | null
                    poster_product_id?: string | null
                    name: string
                    category_id?: string | null
                    description?: string | null
                    default_unit_id?: string | null
                    min_stock_level?: number
                    max_stock_level?: number | null
                    reorder_point?: number | null
                    weighted_avg_cost?: number
                    last_purchase_cost?: number | null
                    currency?: string
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    poster_ingredient_id?: string | null
                    poster_product_id?: string | null
                    name?: string
                    category_id?: string | null
                    description?: string | null
                    default_unit_id?: string | null
                    min_stock_level?: number
                    max_stock_level?: number | null
                    reorder_point?: number | null
                    weighted_avg_cost?: number
                    last_purchase_cost?: number | null
                    currency?: string
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
            }
            ingredient_stock: {
                Row: {
                    id: string
                    ingredient_id: string
                    location_id: string
                    current_stock: number
                    unit_id: string | null
                    weighted_avg_cost: number
                    last_stock_update: string | null
                    last_stock_take: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    ingredient_id: string
                    location_id: string
                    current_stock?: number
                    unit_id?: string | null
                    weighted_avg_cost?: number
                    last_stock_update?: string | null
                    last_stock_take?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    ingredient_id?: string
                    location_id?: string
                    current_stock?: number
                    unit_id?: string | null
                    weighted_avg_cost?: number
                    last_stock_update?: string | null
                    last_stock_take?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            ingredient_batches: {
                Row: {
                    id: string
                    ingredient_id: string
                    location_id: string
                    purchase_id: string | null
                    purchase_item_id: string | null
                    movement_id: string | null
                    batch_number: string | null
                    initial_quantity: number
                    remaining_quantity: number
                    unit_id: string | null
                    cost_per_unit: number
                    total_cost: number
                    currency: string
                    purchase_date: string
                    expiry_date: string | null
                    received_at: string
                    status: 'active' | 'depleted' | 'expired' | 'written_off'
                    depleted_at: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    ingredient_id: string
                    location_id: string
                    purchase_id?: string | null
                    purchase_item_id?: string | null
                    movement_id?: string | null
                    batch_number?: string | null
                    initial_quantity: number
                    remaining_quantity: number
                    unit_id?: string | null
                    cost_per_unit: number
                    total_cost: number
                    currency?: string
                    purchase_date?: string
                    expiry_date?: string | null
                    received_at?: string
                    status?: 'active' | 'depleted' | 'expired' | 'written_off'
                    depleted_at?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    ingredient_id?: string
                    location_id?: string
                    purchase_id?: string | null
                    purchase_item_id?: string | null
                    movement_id?: string | null
                    batch_number?: string | null
                    initial_quantity?: number
                    remaining_quantity?: number
                    unit_id?: string | null
                    cost_per_unit?: number
                    total_cost?: number
                    currency?: string
                    purchase_date?: string
                    expiry_date?: string | null
                    received_at?: string
                    status?: 'active' | 'depleted' | 'expired' | 'written_off'
                    depleted_at?: string | null
                    created_at?: string
                }
            }
            recipes: {
                Row: {
                    id: string
                    poster_product_id: string
                    name: string
                    category: string | null
                    recipe_type: string
                    yield_quantity: number
                    yield_unit_id: string | null
                    selling_price: number | null
                    theoretical_cost: number | null
                    target_margin: number | null
                    is_active: boolean
                    last_synced_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    poster_product_id: string
                    name: string
                    category?: string | null
                    recipe_type?: string
                    yield_quantity?: number
                    yield_unit_id?: string | null
                    selling_price?: number | null
                    theoretical_cost?: number | null
                    target_margin?: number | null
                    is_active?: boolean
                    last_synced_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    poster_product_id?: string
                    name?: string
                    category?: string | null
                    recipe_type?: string
                    yield_quantity?: number
                    yield_unit_id?: string | null
                    selling_price?: number | null
                    theoretical_cost?: number | null
                    target_margin?: number | null
                    is_active?: boolean
                    last_synced_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            recipe_ingredients: {
                Row: {
                    id: string
                    recipe_id: string
                    ingredient_id: string
                    quantity: number
                    unit_id: string | null
                    is_optional: boolean
                    is_default: boolean
                    modification_group: string | null
                    modification_name: string | null
                    poster_modification_id: string | null
                    additional_price: number
                    sort_order: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    recipe_id: string
                    ingredient_id: string
                    quantity: number
                    unit_id?: string | null
                    is_optional?: boolean
                    is_default?: boolean
                    modification_group?: string | null
                    modification_name?: string | null
                    poster_modification_id?: string | null
                    additional_price?: number
                    sort_order?: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    recipe_id?: string
                    ingredient_id?: string
                    quantity?: number
                    unit_id?: string | null
                    is_optional?: boolean
                    is_default?: boolean
                    modification_group?: string | null
                    modification_name?: string | null
                    poster_modification_id?: string | null
                    additional_price?: number
                    sort_order?: number
                    created_at?: string
                }
            }
            ingredient_consumption: {
                Row: {
                    id: string
                    sale_transaction_id: string
                    sale_product_id: string | null
                    sale_timestamp: string
                    recipe_id: string | null
                    recipe_name: string | null
                    quantity_sold: number
                    ingredient_id: string
                    ingredient_name: string | null
                    batch_id: string | null
                    location_id: string
                    quantity_consumed: number
                    unit_id: string | null
                    cost_per_unit: number | null
                    total_cost: number | null
                    is_modification: boolean
                    modification_name: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    sale_transaction_id: string
                    sale_product_id?: string | null
                    sale_timestamp: string
                    recipe_id?: string | null
                    recipe_name?: string | null
                    quantity_sold?: number
                    ingredient_id: string
                    ingredient_name?: string | null
                    batch_id?: string | null
                    location_id: string
                    quantity_consumed: number
                    unit_id?: string | null
                    cost_per_unit?: number | null
                    total_cost?: number | null
                    is_modification?: boolean
                    modification_name?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    sale_transaction_id?: string
                    sale_product_id?: string | null
                    sale_timestamp?: string
                    recipe_id?: string | null
                    recipe_name?: string | null
                    quantity_sold?: number
                    ingredient_id?: string
                    ingredient_name?: string | null
                    batch_id?: string | null
                    location_id?: string
                    quantity_consumed?: number
                    unit_id?: string | null
                    cost_per_unit?: number | null
                    total_cost?: number | null
                    is_modification?: boolean
                    modification_name?: string | null
                    created_at?: string
                }
            }
            inventory_movements: {
                Row: {
                    id: string
                    movement_type: 'purchase' | 'transfer_out' | 'transfer_in' | 'sale_consumption' | 'processing' | 'adjustment' | 'waste' | 'stock_take'
                    from_location_id: string | null
                    to_location_id: string | null
                    ingredient_id: string
                    batch_id: string | null
                    quantity: number
                    unit_id: string | null
                    unit_cost: number | null
                    total_cost: number | null
                    from_unit_id: string | null
                    from_quantity: number | null
                    conversion_factor: number | null
                    sale_transaction_id: string | null
                    despatch_id: string | null
                    purchase_id: string | null
                    notes: string | null
                    performed_by: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    movement_type: 'purchase' | 'transfer_out' | 'transfer_in' | 'sale_consumption' | 'processing' | 'adjustment' | 'waste' | 'stock_take'
                    from_location_id?: string | null
                    to_location_id?: string | null
                    ingredient_id: string
                    batch_id?: string | null
                    quantity: number
                    unit_id?: string | null
                    unit_cost?: number | null
                    total_cost?: number | null
                    from_unit_id?: string | null
                    from_quantity?: number | null
                    conversion_factor?: number | null
                    sale_transaction_id?: string | null
                    despatch_id?: string | null
                    purchase_id?: string | null
                    notes?: string | null
                    performed_by?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    movement_type?: 'purchase' | 'transfer_out' | 'transfer_in' | 'sale_consumption' | 'processing' | 'adjustment' | 'waste' | 'stock_take'
                    from_location_id?: string | null
                    to_location_id?: string | null
                    ingredient_id?: string
                    batch_id?: string | null
                    quantity?: number
                    unit_id?: string | null
                    unit_cost?: number | null
                    total_cost?: number | null
                    from_unit_id?: string | null
                    from_quantity?: number | null
                    conversion_factor?: number | null
                    sale_transaction_id?: string | null
                    despatch_id?: string | null
                    purchase_id?: string | null
                    notes?: string | null
                    performed_by?: string | null
                    created_at?: string
                }
            }
            supplier_purchases: {
                Row: {
                    id: string
                    supplier_name: string | null
                    supplier_id: string | null
                    invoice_number: string | null
                    purchase_date: string
                    received_date: string | null
                    subtotal: number | null
                    tax_amount: number | null
                    shipping_cost: number | null
                    total_amount: number | null
                    currency: string
                    payment_status: 'pending' | 'partial' | 'paid'
                    payment_method: string | null
                    paid_amount: number
                    location_id: string
                    status: 'ordered' | 'received' | 'partially_received' | 'cancelled'
                    notes: string | null
                    created_by: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    supplier_name?: string | null
                    supplier_id?: string | null
                    invoice_number?: string | null
                    purchase_date?: string
                    received_date?: string | null
                    subtotal?: number | null
                    tax_amount?: number | null
                    shipping_cost?: number | null
                    total_amount?: number | null
                    currency?: string
                    payment_status?: 'pending' | 'partial' | 'paid'
                    payment_method?: string | null
                    paid_amount?: number
                    location_id: string
                    status?: 'ordered' | 'received' | 'partially_received' | 'cancelled'
                    notes?: string | null
                    created_by?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    supplier_name?: string | null
                    supplier_id?: string | null
                    invoice_number?: string | null
                    purchase_date?: string
                    received_date?: string | null
                    subtotal?: number | null
                    tax_amount?: number | null
                    shipping_cost?: number | null
                    total_amount?: number | null
                    currency?: string
                    payment_status?: 'pending' | 'partial' | 'paid'
                    payment_method?: string | null
                    paid_amount?: number
                    location_id?: string
                    status?: 'ordered' | 'received' | 'partially_received' | 'cancelled'
                    notes?: string | null
                    created_by?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            supplier_purchase_items: {
                Row: {
                    id: string
                    purchase_id: string
                    ingredient_id: string | null
                    ingredient_name: string
                    ordered_quantity: number
                    received_quantity: number | null
                    unit_id: string | null
                    unit_name: string | null
                    unit_cost: number
                    total_cost: number
                    batch_id: string | null
                    status: string | null
                    notes: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    purchase_id: string
                    ingredient_id?: string | null
                    ingredient_name: string
                    ordered_quantity: number
                    received_quantity?: number | null
                    unit_id?: string | null
                    unit_name?: string | null
                    unit_cost: number
                    total_cost: number
                    batch_id?: string | null
                    status?: string | null
                    notes?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    purchase_id?: string
                    ingredient_id?: string | null
                    ingredient_name?: string
                    ordered_quantity?: number
                    received_quantity?: number | null
                    unit_id?: string | null
                    unit_name?: string | null
                    unit_cost?: number
                    total_cost?: number
                    batch_id?: string | null
                    status?: string | null
                    notes?: string | null
                    created_at?: string
                }
            }
        }
        Views: {
            v_current_stock: {
                Row: {
                    ingredient_id: string
                    ingredient_name: string
                    poster_ingredient_id: string | null
                    location_id: string
                    location_name: string
                    location_type: string
                    current_stock: number
                    unit: string | null
                    min_stock_level: number | null
                    reorder_point: number | null
                    avg_cost: number
                    stock_status: string
                }
            }
            v_product_profitability: {
                Row: {
                    recipe_id: string
                    product_name: string
                    poster_product_id: string
                    selling_price: number | null
                    calculated_cogs: number
                    gross_profit: number
                    margin_percentage: number
                }
            }
            v_daily_consumption: {
                Row: {
                    sale_date: string
                    location_id: string
                    ingredient_id: string
                    ingredient_name: string
                    total_consumed: number
                    total_cost: number
                    transaction_count: number
                }
            }
        }
        Functions: {}
        Enums: {}
    }
}
