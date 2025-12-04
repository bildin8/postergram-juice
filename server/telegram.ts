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
      const chat = await storage.getTelegramChatByChatId(chatId);

      if (!chat) {
        await storage.createTelegramChat({
          chatId,
          chatType: msg.chat.type,
          role: 'owner', // Default role, can be changed
          isActive: true,
        });
        
        await this.bot.sendMessage(chatId, 
          '✅ Welcome to PosterPOS Manager!\n\n' +
          'I can help you:\n' +
          '📊 /report - View today\'s sales\n' +
          '📦 /stock - Check inventory levels\n' +
          '⚠️ /alerts - Get low stock alerts\n' +
          '📋 /requests - View reorder requests\n\n' +
          'You\'ll receive real-time notifications for sales and stock alerts.'
        );
      } else {
        await this.bot.sendMessage(chatId, 'Welcome back! Use /help to see available commands.');
      }
    });

    this.bot.onText(/\/report/, async (msg) => {
      const chatId = msg.chat.id.toString();
      const sales = await storage.getTodaysSales();
      const recentSales = await storage.getAllSalesRecords(10);

      let message = `📊 *Today's Sales Report*\n\n`;
      message += `💰 Total: $${sales.total.toFixed(2)}\n`;
      message += `🛒 Transactions: ${sales.count}\n\n`;

      if (recentSales.length > 0) {
        message += `*Recent Sales:*\n`;
        recentSales.slice(0, 5).forEach(sale => {
          const time = new Date(sale.timestamp).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          message += `• ${sale.itemName} x${sale.quantity} - $${sale.amount} (${time})\n`;
        });
      }

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });

    this.bot.onText(/\/stock/, async (msg) => {
      const chatId = msg.chat.id.toString();
      const inventory = await storage.getAllInventoryItems();

      let message = `📦 *Inventory Status*\n\n`;
      
      if (inventory.length === 0) {
        message += 'No inventory items tracked yet.';
      } else {
        inventory.forEach(item => {
          const stock = Number(item.currentStock);
          const min = Number(item.minStock);
          const status = stock <= min ? '⚠️' : '✅';
          message += `${status} ${item.name}: ${stock} ${item.unit}\n`;
        });
      }

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });

    this.bot.onText(/\/alerts/, async (msg) => {
      const chatId = msg.chat.id.toString();
      const lowStock = await storage.getLowStockItems();

      let message = `⚠️ *Low Stock Alerts*\n\n`;
      
      if (lowStock.length === 0) {
        message += '✅ All items are well stocked!';
      } else {
        lowStock.forEach(item => {
          message += `• ${item.name}: ${item.currentStock} ${item.unit} (min: ${item.minStock})\n`;
        });
      }

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });

    this.bot.onText(/\/requests/, async (msg) => {
      const chatId = msg.chat.id.toString();
      const requests = await storage.getPendingReorderRequests();

      let message = `📋 *Pending Reorder Requests*\n\n`;
      
      if (requests.length === 0) {
        message += 'No pending requests.';
      } else {
        requests.forEach(req => {
          message += `• ${req.itemName} (${req.quantity} ${req.unit})\n`;
          message += `  Requested by: ${req.requester}\n`;
          if (req.estimatedCost) {
            message += `  Cost: $${req.estimatedCost}\n`;
          }
          message += `\n`;
        });
      }

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });

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

  async sendNotification(message: string, role?: string) {
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
