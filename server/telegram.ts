import TelegramBot from 'node-telegram-bot-api';
import { storage } from './storage';
import { log } from './index';

export class TelegramBotService {
  private bot: TelegramBot;
  private webhookUrl?: string;

  constructor(token: string, webhookUrl?: string) {
    this.webhookUrl = webhookUrl;
    
    if (webhookUrl) {
      this.bot = new TelegramBot(token);
      this.setupWebhook();
    } else {
      this.bot = new TelegramBot(token, { polling: true });
    }

    this.setupCommands();
    log('Telegram bot initialized', 'telegram');
  }

  private async setupWebhook() {
    if (!this.webhookUrl) return;
    
    try {
      await this.bot.setWebHook(`${this.webhookUrl}/api/telegram/webhook`);
      log(`Webhook set to ${this.webhookUrl}/api/telegram/webhook`, 'telegram');
    } catch (error) {
      log(`Failed to set webhook: ${error}`, 'telegram');
    }
  }

  private setupCommands() {
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id.toString();
      
      try {
        const chat = await storage.getTelegramChatByChatId(chatId);

        if (!chat) {
          await storage.createTelegramChat({
            chatId,
            chatType: msg.chat.type,
            role: 'owner',
            isActive: true,
          });
        }
        
        // Send welcome with Mini App button
        const webAppUrl = process.env.REPL_SLUG 
          ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER?.toLowerCase()}.repl.co`
          : process.env.WEBAPP_URL || '';
          
        const keyboard: any = {
          inline_keyboard: []
        };
        
        if (webAppUrl) {
          keyboard.inline_keyboard.push([
            { text: '📱 Open Mini App', web_app: { url: webAppUrl } }
          ]);
        }
        
        keyboard.inline_keyboard.push([
          { text: '📊 Sales Report', callback_data: 'report' },
          { text: '📦 Stock Levels', callback_data: 'stock' }
        ]);
        keyboard.inline_keyboard.push([
          { text: '⚠️ Low Stock', callback_data: 'alerts' },
          { text: '📋 Requests', callback_data: 'requests' }
        ]);
        
        await this.bot.sendMessage(chatId, 
          '✅ *Welcome to Juicee Manager!*\n\n' +
          'I\'ll send you real-time notifications for:\n' +
          '🧾 New receipts and sales\n' +
          '⚠️ Low stock alerts\n' +
          '📋 Reorder requests\n\n' +
          'Use the buttons below or type commands:',
          { 
            parse_mode: 'Markdown',
            reply_markup: keyboard
          }
        );
      } catch (error) {
        log(`Error in /start command: ${error}`, 'telegram');
        await this.bot.sendMessage(chatId, 'An error occurred. Please try again later.');
      }
    });

    // Handle callback queries from inline buttons
    this.bot.on('callback_query', async (query) => {
      if (!query.message || !query.data) return;
      
      const chatId = query.message.chat.id.toString();
      
      try {
        switch (query.data) {
          case 'report':
            await this.handleReport(chatId);
            break;
          case 'stock':
            await this.handleStock(chatId);
            break;
          case 'alerts':
            await this.handleAlerts(chatId);
            break;
          case 'requests':
            await this.handleRequests(chatId);
            break;
        }
        await this.bot.answerCallbackQuery(query.id);
      } catch (error) {
        log(`Error handling callback: ${error}`, 'telegram');
        await this.bot.answerCallbackQuery(query.id, { text: 'Error occurred' });
      }
    });

    this.bot.onText(/\/report/, (msg) => this.handleReport(msg.chat.id.toString()));
    this.bot.onText(/\/stock/, (msg) => this.handleStock(msg.chat.id.toString()));
    this.bot.onText(/\/alerts/, (msg) => this.handleAlerts(msg.chat.id.toString()));
    this.bot.onText(/\/requests/, (msg) => this.handleRequests(msg.chat.id.toString()));

    this.bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id.toString();
      await this.bot.sendMessage(chatId,
        '*Available Commands:*\n\n' +
        '📊 /report - Today\'s sales summary\n' +
        '📦 /stock - Inventory levels\n' +
        '⚠️ /alerts - Low stock warnings\n' +
        '📋 /requests - Reorder requests\n' +
        '/help - Show this message',
        { parse_mode: 'Markdown' }
      );
    });
  }

  private async handleReport(chatId: string) {
    try {
      const sales = await storage.getTodaysSales();
      const recentSales = await storage.getAllSalesRecords(10);

      let message = `📊 *Today's Sales Report*\n\n`;
      message += `💰 Total: KES ${sales.total.toFixed(2)}\n`;
      message += `🛒 Transactions: ${sales.count}\n\n`;

      if (recentSales.length > 0) {
        message += `*Recent Sales:*\n`;
        recentSales.slice(0, 5).forEach(sale => {
          const time = new Date(sale.timestamp).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          message += `• ${sale.itemName} x${sale.quantity} - KES ${sale.amount} (${time})\n`;
        });
      }

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      log(`Error in report: ${error}`, 'telegram');
      await this.bot.sendMessage(chatId, 'Failed to fetch sales report.');
    }
  }

  private async handleStock(chatId: string) {
    try {
      const inventory = await storage.getAllInventoryItems();
      
      let message = `📦 *Inventory Status*\n\n`;
      
      if (inventory.length === 0) {
        message += 'No inventory items tracked yet.';
      } else {
        const sorted = [...inventory].sort((a, b) => Number(a.currentStock) - Number(b.currentStock));
        sorted.slice(0, 15).forEach(item => {
          const stock = Number(item.currentStock);
          const min = Number(item.minStock);
          const status = stock <= min ? '🔴' : stock <= min * 1.5 ? '🟡' : '🟢';
          message += `${status} ${item.name}: ${stock} ${item.unit}\n`;
        });
        if (inventory.length > 15) {
          message += `\n_...and ${inventory.length - 15} more items_`;
        }
      }

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      log(`Error in stock: ${error}`, 'telegram');
      await this.bot.sendMessage(chatId, 'Failed to fetch inventory.');
    }
  }

  private async handleAlerts(chatId: string) {
    try {
      const lowStock = await storage.getLowStockItems();

      let message = `⚠️ *Low Stock Alerts*\n\n`;
      
      if (lowStock.length === 0) {
        message += '✅ All items are well stocked!';
      } else {
        lowStock.forEach(item => {
          message += `🔴 ${item.name}: ${item.currentStock} ${item.unit} (min: ${item.minStock})\n`;
        });
      }

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      log(`Error in alerts: ${error}`, 'telegram');
      await this.bot.sendMessage(chatId, 'Failed to fetch alerts.');
    }
  }

  private async handleRequests(chatId: string) {
    try {
      const requests = await storage.getPendingReorderRequests();

      let message = `📋 *Pending Reorder Requests*\n\n`;
      
      if (requests.length === 0) {
        message += 'No pending requests.';
      } else {
        requests.forEach(req => {
          message += `• ${req.itemName} (${req.quantity} ${req.unit})\n`;
          message += `  By: ${req.requester}`;
          if (req.estimatedCost) {
            message += ` | KES ${req.estimatedCost}`;
          }
          message += `\n\n`;
        });
      }

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      log(`Error in requests: ${error}`, 'telegram');
      await this.bot.sendMessage(chatId, 'Failed to fetch requests.');
    }
  }

  async sendNotification(message: string, role?: string) {
    try {
      const chats = await storage.getAllTelegramChats();
      
      for (const chat of chats) {
        if (!role || chat.role === role) {
          try {
            await this.bot.sendMessage(chat.chatId, message, { parse_mode: 'Markdown' });
          } catch (error) {
            log(`Failed to send message to ${chat.chatId}: ${error}`, 'telegram');
          }
        }
      }
    } catch (error) {
      log(`Failed to get chats for notification: ${error}`, 'telegram');
    }
  }

  async sendSaleNotification(itemName: string, quantity: string, amount: string) {
    const message = `💰 *New Sale!*\n${itemName} x${quantity}\nAmount: $${amount}`;
    await this.sendNotification(message);
  }

  async sendLowStockAlert(itemName: string, currentStock: string, minStock: string) {
    const message = `⚠️ *Low Stock Alert!*\n${itemName}\nCurrent: ${currentStock}\nMinimum: ${minStock}`;
    await this.sendNotification(message, 'store');
  }

  async sendReorderRequestNotification(itemName: string, requester: string) {
    const message = `📋 *New Reorder Request*\n${itemName}\nRequested by: ${requester}`;
    await this.sendNotification(message, 'owner');
  }

  getBot(): TelegramBot {
    return this.bot;
  }

  async processWebhookUpdate(update: any) {
    await this.bot.processUpdate(update);
  }
}

let telegramService: TelegramBotService | null = null;

export function initTelegramBot(token: string, webhookUrl?: string): TelegramBotService {
  telegramService = new TelegramBotService(token, webhookUrl);
  return telegramService;
}

export function getTelegramBot(): TelegramBotService {
  if (!telegramService) {
    throw new Error('Telegram bot not initialized');
  }
  return telegramService;
}

export function isTelegramBotInitialized(): boolean {
  return telegramService !== null;
}
