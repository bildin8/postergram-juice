import { log } from "./index";

export interface PosterPOSProduct {
  product_id: number;
  product_name: string;
  menu_category_name?: string;
  workshop_name?: string;
}

export interface PosterPOSTransaction {
  incoming_order_id: number;
  transaction_id: number;
  date_close_date: string;
  client_id?: number;
  transaction_comment?: string;
  products: {
    product_id: number;
    product_name: string;
    count: string;
    product_price: string;
  }[];
}

export interface PosterPOSStockLevel {
  product_id: number;
  product_name: string;
  stock_count: number;
  unit_name: string;
}

export class PosterPOSClient {
  private apiEndpoint: string;
  private apiToken: string;

  constructor(apiEndpoint: string, apiToken: string) {
    this.apiEndpoint = apiEndpoint.replace(/\/$/, ''); // Remove trailing slash
    this.apiToken = apiToken;
  }

  private async request(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const url = `${this.apiEndpoint}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiToken}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`PosterPOS API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      log(`PosterPOS request failed: ${error}`, 'posterpos');
      throw error;
    }
  }

  async getProducts(): Promise<PosterPOSProduct[]> {
    const response = await this.request('/api/v2/menu/products');
    return response.response || [];
  }

  async getTransactions(dateFrom?: string, dateTo?: string): Promise<PosterPOSTransaction[]> {
    let endpoint = '/api/v2/transactions';
    const params = new URLSearchParams();
    
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }
    
    const response = await this.request(endpoint);
    return response.response || [];
  }

  async getStockLevels(): Promise<PosterPOSStockLevel[]> {
    const response = await this.request('/api/v2/storage/products');
    return response.response || [];
  }

  async getTodaysTransactions(): Promise<PosterPOSTransaction[]> {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    return this.getTransactions(today, today);
  }
}

// Singleton instance
let posterPOSClient: PosterPOSClient | null = null;

export function initPosterPOSClient(apiEndpoint: string, apiToken: string): PosterPOSClient {
  posterPOSClient = new PosterPOSClient(apiEndpoint, apiToken);
  log('PosterPOS client initialized', 'posterpos');
  return posterPOSClient;
}

export function getPosterPOSClient(): PosterPOSClient {
  if (!posterPOSClient) {
    throw new Error('PosterPOS client not initialized. Call initPosterPOSClient first.');
  }
  return posterPOSClient;
}
