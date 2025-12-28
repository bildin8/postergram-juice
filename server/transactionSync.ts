import { getPosterPOSClient, isPosterPOSInitialized, PosterPOSTransaction } from './posterpos';
import { getTelegramBot, isTelegramBotInitialized } from './telegram';
import { storage } from './storage';
import { log } from './index';
import { logSaleConsumption } from './inventoryService';

const SYNC_INTERVAL_MS = 10 * 60 * 1000;

let lastSyncTimestamp: number | null = null;
let syncIntervalId: NodeJS.Timeout | null = null;

function parseCloseDate(dateValue: string): Date {
  if (!dateValue) return new Date();

  const timestamp = parseInt(dateValue);
  if (!isNaN(timestamp) && timestamp > 0) {
    return timestamp > 1e12 ? new Date(timestamp) : new Date(timestamp * 1000);
  }

  const date = new Date(dateValue.replace(' ', 'T'));
  if (!isNaN(date.getTime())) {
    return date;
  }

  return new Date();
}

export async function syncNewTransactions(): Promise<number> {
  if (!isPosterPOSInitialized()) {
    log('PosterPOS not initialized, skipping sync', 'transaction-sync');
    return 0;
  }

  try {
    const client = getPosterPOSClient();
    let transactions: PosterPOSTransaction[];

    if (lastSyncTimestamp) {
      transactions = await client.getTransactionsSince(lastSyncTimestamp);
      log(`Fetching transactions since ${new Date(lastSyncTimestamp * 1000).toISOString()}`, 'transaction-sync');
    } else {
      transactions = await client.getTodaysTransactions();
      log('Initial sync: fetching today\'s transactions', 'transaction-sync');
    }

    log(`Found ${transactions.length} transactions`, 'transaction-sync');

    if (transactions.length === 0) {
      return 0;
    }

    let notifiedCount = 0;
    let maxCloseTimestamp = lastSyncTimestamp || 0;

    for (const transaction of transactions) {
      const closeDate = parseCloseDate(transaction.date_close);
      const closeTimestamp = Math.floor(closeDate.getTime() / 1000);
      if (closeTimestamp > maxCloseTimestamp) {
        maxCloseTimestamp = closeTimestamp;
      }

      const products = transaction.products || [];
      if (products.length === 0) continue;

      const firstProductId = `${transaction.transaction_id}-${products[0].product_id}`;
      const existing = await storage.getSalesRecordByPosterPosId(firstProductId);

      if (existing) {
        continue;
      }

      const total = parseFloat(transaction.payed_sum || transaction.sum || '0');

      await sendTransactionNotification(transaction, total, products);
      notifiedCount++;

      await storeTransactionProducts(transaction, products);

      // Log ingredient consumption to Supabase for traceability
      try {
        const consumptionProducts = products.map(p => ({
          product_id: p.product_id.toString(),
          quantity: parseFloat(p.num) || 1,
          modifications: p.modifications?.map((m: any) => ({
            dish_modification_id: m.dish_modification_id,
            modification_id: m.modification_id
          }))
        }));
        await logSaleConsumption(transaction, consumptionProducts);
      } catch (consumptionError) {
        log(`Failed to log consumption for transaction ${transaction.transaction_id}: ${consumptionError}`, 'transaction-sync');
      }
    }

    lastSyncTimestamp = maxCloseTimestamp;
    log(`Notified ${notifiedCount} new transactions, updated lastSync to ${new Date(maxCloseTimestamp * 1000).toISOString()}`, 'transaction-sync');

    return notifiedCount;
  } catch (error) {
    log(`Transaction sync error: ${error}`, 'transaction-sync');
    return 0;
  }
}

async function sendTransactionNotification(
  transaction: PosterPOSTransaction,
  total: number,
  products: any[]
): Promise<void> {
  if (!isTelegramBotInitialized()) {
    return;
  }

  try {
    const bot = getTelegramBot();
    const message = formatReceiptMessage(transaction, total, products);
    await bot.sendNotification(message, 'sales');
  } catch (error) {
    log(`Failed to send transaction notification: ${error}`, 'transaction-sync');
  }
}

function formatReceiptMessage(
  transaction: PosterPOSTransaction,
  total: number,
  products: any[]
): string {
  const closeDate = parseCloseDate(transaction.date_close);
  const time = closeDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const date = closeDate.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short'
  });

  const displayTotal = total / 100;

  let message = `🧾 *Receipt #${transaction.transaction_id}*\n`;
  message += `📅 ${date} at ${time}\n\n`;

  if (products.length > 0) {
    message += `*Items:*\n`;
    products.forEach((product, index) => {
      const qty = parseFloat(product.num || '1');
      const price = (product.payed_sum || product.product_price || 0) / 100;
      message += `• x${qty} - KES ${price.toFixed(2)}\n`;
    });
    message += `\n`;
  }

  message += `💰 *Total: KES ${displayTotal.toFixed(2)}*\n`;

  const payType = transaction.pay_type === '0' ? 'Cash' :
    transaction.pay_type === '1' ? 'Card' :
      transaction.pay_type === '2' ? 'Mixed' : 'Other';
  message += `💳 ${payType}`;

  if (transaction.table_name) {
    message += ` | 📍 ${transaction.table_name}`;
  }

  return message;
}

async function storeTransactionProducts(
  transaction: PosterPOSTransaction,
  products: any[]
): Promise<void> {
  try {
    const closeDate = parseCloseDate(transaction.date_close);

    for (const product of products) {
      const posterPosId = `${transaction.transaction_id}-${product.product_id}`;

      const existing = await storage.getSalesRecordByPosterPosId(posterPosId);
      if (existing) continue;

      const amountInCents = product.payed_sum || product.product_price || 0;
      const amountInKES = (amountInCents / 100).toFixed(2);

      await storage.createSalesRecord({
        posterPosId,
        itemName: `Product #${product.product_id}`,
        quantity: product.num || '1',
        amount: amountInKES,
        timestamp: closeDate,
        syncedAt: new Date(),
      });
    }
  } catch (error) {
    log(`Failed to store transaction products: ${error}`, 'transaction-sync');
  }
}

export function startTransactionSync(): void {
  if (syncIntervalId) {
    log('Transaction sync already running', 'transaction-sync');
    return;
  }

  log(`Starting transaction sync with ${SYNC_INTERVAL_MS / 1000 / 60}-minute interval`, 'transaction-sync');

  syncNewTransactions().then(count => {
    log(`Initial sync completed: ${count} new transactions`, 'transaction-sync');
  });

  syncIntervalId = setInterval(async () => {
    const count = await syncNewTransactions();
    if (count > 0) {
      log(`Periodic sync: ${count} new transactions notified`, 'transaction-sync');
    }
  }, SYNC_INTERVAL_MS);
}

export function stopTransactionSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    log('Transaction sync stopped', 'transaction-sync');
  }
}

export function getLastSyncTimestamp(): number | null {
  return lastSyncTimestamp;
}

export function setLastSyncTimestamp(timestamp: number): void {
  lastSyncTimestamp = timestamp;
}
