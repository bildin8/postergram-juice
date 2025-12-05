import { log } from "./index";

export interface PosterPOSProduct {
  product_id: number;
  product_name: string;
  menu_category_name?: string;
  workshop_name?: string;
  price?: { [key: string]: string };
  out?: number;
}

export interface PosterPOSTransactionProduct {
  product_id: number;
  modification_id?: number;
  product_price: number;
  num: string;
  payed_sum: number;
  product_cost?: number;
  product_profit?: number;
}

export interface PosterPOSTransaction {
  transaction_id: string;
  date_start: string;
  date_close: string;
  status: string;
  guests_count: string;
  discount: string;
  pay_type: string;
  payed_cash: string;
  payed_card: string;
  payed_sum: string;
  sum: string;
  spot_id: string;
  table_id: string;
  name: string;
  user_id: string;
  client_id: string;
  total_profit: string;
  table_name: string;
  date_close_date: string;
  products?: PosterPOSTransactionProduct[];
}

export interface PosterPOSIngredient {
  ingredient_id: number;
  ingredient_name: string;
  ingredient_unit: string;
}

export interface PosterPOSStorage {
  ingredient_id: number;
  ingredient_name: string;
  ingredient_left: string;
  ingredient_unit: string;
}

export class PosterPOSClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    // Poster API format: https://{account}.joinposter.com/api/{method}?token={token}
    this.baseUrl = baseUrl.replace(/\/$/, '').replace(/\/api$/, '');
    this.token = token;
  }

  private async request(method: string, params?: Record<string, string>): Promise<any> {
    // Poster API uses method names like "menu.getProducts" with token as query param
    const queryParams = new URLSearchParams({ token: this.token });
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        queryParams.append(key, value);
      });
    }
    
    const url = `${this.baseUrl}/api/${method}?${queryParams.toString()}`;
    
    log(`PosterPOS request: ${method}`, 'posterpos');
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const text = await response.text();
        log(`PosterPOS error response: ${text}`, 'posterpos');
        throw new Error(`PosterPOS API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`PosterPOS API error: ${data.error}`);
      }

      return data;
    } catch (error) {
      log(`PosterPOS request failed: ${error}`, 'posterpos');
      throw error;
    }
  }

  async getProducts(): Promise<PosterPOSProduct[]> {
    const response = await this.request('menu.getProducts');
    return response.response || [];
  }

  async getIngredients(): Promise<PosterPOSIngredient[]> {
    const response = await this.request('menu.getIngredients');
    return response.response || [];
  }

  async getStorages(): Promise<PosterPOSStorage[]> {
    const response = await this.request('storage.getStorages');
    return response.response || [];
  }

  async getStockLevels(): Promise<{ product_id: number; product_name: string; stock_count: number; unit_name: string }[]> {
    // Get ingredients with their stock levels
    try {
      const ingredients = await this.request('menu.getIngredients');
      
      if (!ingredients.response) {
        // Fallback: try to get products instead
        const products = await this.getProducts();
        return products.map(p => ({
          product_id: p.product_id,
          product_name: p.product_name,
          stock_count: p.out || 0,
          unit_name: 'units',
        }));
      }

      return (ingredients.response || []).map((ing: any) => ({
        product_id: ing.ingredient_id,
        product_name: ing.ingredient_name,
        stock_count: parseFloat(ing.ingredient_left || '0'),
        unit_name: ing.ingredient_unit || 'units',
      }));
    } catch (error) {
      log(`Failed to get stock levels: ${error}`, 'posterpos');
      // Try products as fallback
      const products = await this.getProducts();
      return products.map(p => ({
        product_id: p.product_id,
        product_name: p.product_name,
        stock_count: 0,
        unit_name: 'units',
      }));
    }
  }

  async getTransactions(options?: {
    dateFrom?: string;
    dateTo?: string;
    afterDateClose?: number;
    status?: number;
    includeProducts?: boolean;
  }): Promise<PosterPOSTransaction[]> {
    try {
      const params: Record<string, string> = {
        include_products: 'true',
        status: '2',
      };
      
      if (options?.dateFrom) params.dateFrom = options.dateFrom;
      if (options?.dateTo) params.dateTo = options.dateTo;
      if (options?.afterDateClose) params.after_date_close = options.afterDateClose.toString();
      if (options?.status !== undefined) params.status = options.status.toString();
      if (options?.includeProducts !== undefined) params.include_products = options.includeProducts ? 'true' : 'false';
      
      const response = await this.request('dash.getTransactions', params);
      return response.response || [];
    } catch (error) {
      log(`Failed to get transactions: ${error}`, 'posterpos');
      return [];
    }
  }

  async getTodaysTransactions(): Promise<PosterPOSTransaction[]> {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    return this.getTransactions({ dateFrom: today, dateTo: today });
  }

  async getRecentTransactions(days: number = 7): Promise<PosterPOSTransaction[]> {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    
    const dateFrom = from.toISOString().split('T')[0].replace(/-/g, '');
    const dateTo = to.toISOString().split('T')[0].replace(/-/g, '');
    
    return this.getTransactions({ dateFrom, dateTo });
  }

  async getTransactionsSince(afterTimestamp: number): Promise<PosterPOSTransaction[]> {
    return this.getTransactions({ afterDateClose: afterTimestamp });
  }

  async getSalesReport(): Promise<any> {
    const response = await this.request('dash.getAnalytics');
    return response.response || {};
  }

  async getIngredientMovements(dateFrom?: string, dateTo?: string, type?: number): Promise<IngredientMovement[]> {
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (type) params.type = type.toString();
      
      const response = await this.request('storage.getReportMovement', params);
      return response.response || [];
    } catch (error) {
      log(`Failed to get ingredient movements: ${error}`, 'posterpos');
      return [];
    }
  }

  async getTodaysIngredientMovements(): Promise<IngredientMovement[]> {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    return this.getIngredientMovements(today, today);
  }

  async getIngredientMovementsForRange(days: number = 7): Promise<IngredientMovement[]> {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    
    const dateFrom = from.toISOString().split('T')[0].replace(/-/g, '');
    const dateTo = to.toISOString().split('T')[0].replace(/-/g, '');
    
    return this.getIngredientMovements(dateFrom, dateTo);
  }
}

export interface IngredientMovement {
  ingredient_id: string;
  ingredient_name: string;
  cost_start: number;
  cost_end: number;
  start: number;
  income: number;
  write_offs: number;
  end: number;
}

// Singleton instance
let posterPOSClient: PosterPOSClient | null = null;

export function initPosterPOSClient(baseUrl: string, token: string): PosterPOSClient {
  posterPOSClient = new PosterPOSClient(baseUrl, token);
  log('PosterPOS client initialized', 'posterpos');
  return posterPOSClient;
}

export function getPosterPOSClient(): PosterPOSClient {
  if (!posterPOSClient) {
    throw new Error('PosterPOS client not initialized. Call initPosterPOSClient first.');
  }
  return posterPOSClient;
}

export function isPosterPOSInitialized(): boolean {
  return posterPOSClient !== null;
}
