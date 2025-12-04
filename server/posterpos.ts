import { log } from "./index";

export interface PosterPOSProduct {
  product_id: number;
  product_name: string;
  menu_category_name?: string;
  workshop_name?: string;
  price?: { [key: string]: string };
  out?: number;
}

export interface PosterPOSTransaction {
  incoming_order_id?: number;
  transaction_id: number;
  date_close: string;
  sum: number;
  payed_sum?: number;
  products: {
    product_id: number;
    product_name: string;
    num: string;
    product_sum: number;
  }[];
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

  private async request(method: string): Promise<any> {
    // Poster API uses method names like "menu.getProducts" with token as query param
    const url = `${this.baseUrl}/api/${method}?token=${this.token}`;
    
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

  async getTransactions(dateFrom?: string, dateTo?: string): Promise<PosterPOSTransaction[]> {
    // Poster uses YYYYMMDD format for dates
    // For transactions, we need to use finance.getTransactions
    try {
      const response = await this.request('finance.getTransactions');
      return response.response || [];
    } catch (error) {
      log(`Failed to get transactions: ${error}`, 'posterpos');
      return [];
    }
  }

  async getTodaysTransactions(): Promise<PosterPOSTransaction[]> {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    return this.getTransactions(today, today);
  }

  async getSalesReport(): Promise<any> {
    const response = await this.request('dash.getAnalytics');
    return response.response || {};
  }
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
