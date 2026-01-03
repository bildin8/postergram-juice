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

      // Graceful handling of polling conflicts (dev mode / multi-instance)
      this.bot.on('polling_error', (error: any) => {
        // 409 Conflict: Terminated by other getUpdates request
        if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
          log('⚠️ Telegram polling conflict detected. Stopping polling on this instance to allow the other instance to work.', 'telegram');
          this.bot.stopPolling();
        } else {
          // Log other polling errors but don't crash
          log(`Telegram polling error: ${error.message}`, 'telegram');
        }
      });
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

        // Send welcome with channel setup options
        const keyboard: any = {
          inline_keyboard: [
            [{ text: '🧾 Sales Channel', callback_data: 'setup_sales' }],
            [{ text: '📦 Inventory Channel', callback_data: 'setup_inventory' }],
            [{ text: '📋 All Notifications', callback_data: 'setup_owner' }],
          ]
        };

        await this.bot.sendMessage(chatId,
          '✅ *Welcome to Juicee Manager!*\n\n' +
          '*Choose what notifications this chat should receive:*\n\n' +
          '🧾 *Sales Channel* - Real-time receipt alerts\n' +
          '📦 *Inventory Channel* - Stock usage & low stock\n' +
          '📋 *All Notifications* - Everything\n\n' +
          '_Tip: Add me to a group/channel and run /start to set it up_',
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
        // Handle channel setup
        if (query.data.startsWith('setup_')) {
          const role = query.data.replace('setup_', '');
          await this.setupChannel(chatId, query.message.chat.type, role);
          await this.bot.answerCallbackQuery(query.id, { text: 'Channel configured!' });
          return;
        }

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

    // Command to show main menu
    this.bot.onText(/\/menu/, async (msg) => {
      const chatId = msg.chat.id.toString();

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

      await this.bot.sendMessage(chatId, '*Quick Actions:*', {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
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
        '📱 /menu - Quick actions menu\n' +
        '⚙️ /status - Channel settings\n' +
        '/help - Show this message',
        { parse_mode: 'Markdown' }
      );
    });

    // Channel status command
    this.bot.onText(/\/status/, async (msg) => {
      const chatId = msg.chat.id.toString();
      const chat = await storage.getTelegramChatByChatId(chatId);

      if (!chat) {
        await this.bot.sendMessage(chatId, 'This chat is not registered. Use /start to set it up.');
        return;
      }

      const roleLabels: Record<string, string> = {
        sales: '🧾 Sales Channel',
        inventory: '📦 Inventory Channel',
        owner: '📋 All Notifications',
        store: '🏪 Store Manager',
        shop: '🛒 Shop/POS',
        partner: '👔 Partner',
      };

      await this.bot.sendMessage(chatId,
        `*Channel Status*\n\n` +
        `Type: ${roleLabels[chat.role] || chat.role}\n` +
        `Active: ${chat.isActive ? '✅ Yes' : '❌ No'}\n\n` +
        `Use /start to change notification type.`,
        { parse_mode: 'Markdown' }
      );
    });

    // ============================================================================
    // PARTNER COMMANDS
    // ============================================================================

    // Partner dashboard - daily overview
    this.bot.onText(/\/partner_status/, async (msg) => {
      const chatId = msg.chat.id.toString();

      try {
        // Verify partner access (for now, allow all - security enhancement pending)
        const isPartner = await this.verifyPartnerAccess(msg.from?.id?.toString());
        if (!isPartner) {
          await this.bot.sendMessage(chatId, '🔒 This command is for Partners only. Use /link to connect your account.');
          return;
        }

        // Fetch insights from API
        const baseUrl = `http://localhost:${process.env.PORT || 5000}`;
        const [salesRes, velocityRes, approvalsRes] = await Promise.all([
          fetch(`${baseUrl}/api/insights/sales?days=1`).then(r => r.json()).catch(() => null),
          fetch(`${baseUrl}/api/insights/consumption-velocity?days=7`).then(r => r.json()).catch(() => null),
          fetch(`${baseUrl}/api/partner/approvals`).then(r => r.json()).catch(() => []),
        ]);

        let message = `👔 *Partner Dashboard*\n\n`;

        // Today's sales
        if (salesRes?.summary) {
          message += `*Today's Sales:*\n`;
          message += `💰 Revenue: KES ${salesRes.summary.totalRevenue?.toLocaleString() || 0}\n`;
          message += `🧾 Transactions: ${salesRes.summary.transactionCount || 0}\n\n`;
        }

        // Approvals pending
        const approvalCount = Array.isArray(approvalsRes) ? approvalsRes.length : 0;
        message += `*Pending Approvals:* ${approvalCount}\n`;
        if (approvalCount > 0) {
          message += `⚠️ /approvals to view\n`;
        }
        message += `\n`;

        // Low stock alerts
        if (velocityRes?.alerts) {
          const critical = velocityRes.alerts.critical || 0;
          const warning = velocityRes.alerts.warning || 0;
          message += `*Stock Alerts:*\n`;
          message += `🔴 Critical: ${critical}\n`;
          message += `🟡 Warning: ${warning}\n`;

          if (velocityRes.items?.length > 0) {
            message += `\n*Urgent Items:*\n`;
            velocityRes.items.slice(0, 3).forEach((item: any) => {
              message += `• ${item.name}: ${item.daysRemaining} days left\n`;
            });
          }
        }

        await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } catch (error) {
        log(`Error in /partner_status: ${error}`, 'telegram');
        await this.bot.sendMessage(chatId, 'Failed to fetch partner status.');
      }
    });

    // List pending approvals
    this.bot.onText(/\/approvals/, async (msg) => {
      const chatId = msg.chat.id.toString();

      try {
        const isPartner = await this.verifyPartnerAccess(msg.from?.id?.toString());
        if (!isPartner) {
          await this.bot.sendMessage(chatId, '🔒 Partner access required.');
          return;
        }

        const baseUrl = `http://localhost:${process.env.PORT || 5000}`;
        const approvals = await fetch(`${baseUrl}/api/partner/approvals`).then(r => r.json()).catch(() => []);

        if (!Array.isArray(approvals) || approvals.length === 0) {
          await this.bot.sendMessage(chatId, '✅ No pending approvals!');
          return;
        }

        let message = `📋 *Pending Approvals (${approvals.length})*\n\n`;

        approvals.slice(0, 5).forEach((approval: any, idx: number) => {
          const type = approval.type === 'purchase_request' ? 'PR' : 'SRR';
          message += `*${idx + 1}. ${type}* - ${approval.itemCount} items\n`;
          message += `   By: ${approval.requestedBy}\n`;
          message += `   ID: \`${approval.id.slice(0, 8)}...\`\n\n`;
        });

        if (approvals.length > 5) {
          message += `_...and ${approvals.length - 5} more_\n\n`;
        }

        message += `Use /approve_[type]_[id] to approve`;

        await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } catch (error) {
        log(`Error in /approvals: ${error}`, 'telegram');
        await this.bot.sendMessage(chatId, 'Failed to fetch approvals.');
      }
    });

    // Approve a request
    this.bot.onText(/\/approve_(\w+)_(\w+)/, async (msg, match) => {
      const chatId = msg.chat.id.toString();

      if (!match) return;

      const type = match[1]; // 'pr' or 'srr'
      const shortId = match[2];

      try {
        const isPartner = await this.verifyPartnerAccess(msg.from?.id?.toString());
        if (!isPartner) {
          await this.bot.sendMessage(chatId, '🔒 Partner access required.');
          return;
        }

        const fullType = type === 'pr' ? 'purchase_request' : 'shop_replenishment_request';
        const baseUrl = `http://localhost:${process.env.PORT || 5000}`;

        // Find the full ID
        const approvals = await fetch(`${baseUrl}/api/partner/approvals`).then(r => r.json()).catch(() => []);
        const approval = approvals.find((a: any) => a.id.startsWith(shortId) && a.type === fullType);

        if (!approval) {
          await this.bot.sendMessage(chatId, `❌ Approval not found with ID starting: ${shortId}`);
          return;
        }

        // Execute approval
        const res = await fetch(`${baseUrl}/api/partner/approve/${fullType}/${approval.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approvedBy: `TG:${msg.from?.username || msg.from?.id}` }),
        });

        if (res.ok) {
          await this.bot.sendMessage(chatId, `✅ *Approved!*\n${type.toUpperCase()} ${shortId}... has been approved.`, { parse_mode: 'Markdown' });
        } else {
          const error = await res.json();
          await this.bot.sendMessage(chatId, `❌ Failed: ${error.message || 'Unknown error'}`);
        }
      } catch (error) {
        log(`Error in /approve: ${error}`, 'telegram');
        await this.bot.sendMessage(chatId, 'Failed to process approval.');
      }
    });

    // Cash variance report
    this.bot.onText(/\/variance/, async (msg) => {
      const chatId = msg.chat.id.toString();

      try {
        const isPartner = await this.verifyPartnerAccess(msg.from?.id?.toString());
        if (!isPartner) {
          await this.bot.sendMessage(chatId, '🔒 Partner access required.');
          return;
        }

        const baseUrl = `http://localhost:${process.env.PORT || 5000}`;
        const recon = await fetch(`${baseUrl}/api/partner/reconciliation/cash`).then(r => r.json()).catch(() => null);

        if (!recon) {
          await this.bot.sendMessage(chatId, 'Unable to fetch variance data.');
          return;
        }

        let message = `💰 *Cash Variance Report*\n\n`;

        if (recon.pos) {
          message += `*POS Totals:*\n`;
          message += `Total: KES ${recon.pos.total?.toLocaleString() || 0}\n`;
          message += `Cash: KES ${recon.pos.cash?.toLocaleString() || 0}\n`;
          message += `Card: KES ${recon.pos.card?.toLocaleString() || 0}\n\n`;
        }

        if (recon.declared !== undefined) {
          message += `*Declared:* KES ${recon.declared?.toLocaleString() || 0}\n`;
        }

        if (recon.variance) {
          const variance = recon.variance.amount || 0;
          const emoji = variance > 0 ? '📈' : variance < 0 ? '📉' : '✅';
          message += `\n*Variance:* ${emoji} KES ${variance.toLocaleString()}\n`;
          message += `Status: ${recon.variance.status || 'N/A'}`;
        }

        await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } catch (error) {
        log(`Error in /variance: ${error}`, 'telegram');
        await this.bot.sendMessage(chatId, 'Failed to fetch variance.');
      }
    });

    // Link partner account (security)
    this.bot.onText(/\/link(?:\s+(.+))?/, async (msg, match) => {
      const chatId = msg.chat.id.toString();
      const telegramUserId = msg.from?.id?.toString();
      const code = match?.[1]?.trim();

      if (!telegramUserId) {
        await this.bot.sendMessage(chatId, 'Unable to identify your Telegram account.');
        return;
      }

      try {
        if (!code) {
          // Generate a link code
          await this.bot.sendMessage(chatId,
            `🔐 *Account Linking*\n\n` +
            `To link your Partner account:\n` +
            `1. Go to the Partner Portal web app\n` +
            `2. Navigate to Settings > Telegram\n` +
            `3. Enter your Telegram ID: \`${telegramUserId}\`\n` +
            `4. Copy the 6-digit code generated\n` +
            `5. Send: /link YOUR_CODE\n\n` +
            `_This links your Telegram to enable secure Partner commands._`,
            { parse_mode: 'Markdown' }
          );
          return;
        }

        // Verify link code (via API)
        const baseUrl = `http://localhost:${process.env.PORT || 5000}`;
        const res = await fetch(`${baseUrl}/api/partner/telegram/verify-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegramUserId, code }),
        });

        if (res.ok) {
          await this.bot.sendMessage(chatId,
            `✅ *Account Linked!*\n\n` +
            `Your Telegram is now connected to your Partner account.\n\n` +
            `Available commands:\n` +
            `/partner_status - Daily overview\n` +
            `/approvals - Pending approvals\n` +
            `/variance - Cash variance\n` +
            `/approve_pr_[id] - Approve PRs`,
            { parse_mode: 'Markdown' }
          );
        } else {
          const error = await res.json().catch(() => ({}));
          await this.bot.sendMessage(chatId, `❌ Failed: ${error.message || 'Invalid or expired code'}`);
        }
      } catch (error) {
        log(`Error in /link: ${error}`, 'telegram');
        await this.bot.sendMessage(chatId, 'Failed to process link request.');
      }
    });
  }

  // Verify if user has partner access
  private async verifyPartnerAccess(telegramUserId?: string): Promise<boolean> {
    if (!telegramUserId) return false;

    // For now, allow all users (can be restricted later via partner_telegram_links table)
    // TODO: Query partner_telegram_links table to verify
    return true;
  }

  private async setupChannel(chatId: string, chatType: string, role: string) {
    try {
      const existing = await storage.getTelegramChatByChatId(chatId);

      if (existing) {
        await storage.updateTelegramChat(existing.id, { role, isActive: true });
      } else {
        await storage.createTelegramChat({
          chatId,
          chatType,
          role,
          isActive: true,
        });
      }

      const roleLabels: Record<string, string> = {
        sales: '🧾 Sales receipts',
        inventory: '📦 Inventory & stock alerts',
        owner: '📋 All notifications',
      };

      await this.bot.sendMessage(chatId,
        `✅ *Channel configured!*\n\n` +
        `This chat will now receive: ${roleLabels[role] || role}\n\n` +
        `Use /menu for quick actions or /status to check settings.`,
        { parse_mode: 'Markdown' }
      );

      log(`Channel ${chatId} configured for ${role} notifications`, 'telegram');
    } catch (error) {
      log(`Error setting up channel: ${error}`, 'telegram');
      throw error;
    }
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
        requests.forEach((req: any) => {
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

  async sendNotification(message: string, targetRoles?: string | string[]) {
    try {
      const chats = await storage.getAllTelegramChats();
      const roles = targetRoles
        ? (Array.isArray(targetRoles) ? targetRoles : [targetRoles])
        : null;

      for (const chat of chats) {
        if (!chat.isActive) continue;

        // owner role receives all notifications
        const shouldReceive = !roles ||
          roles.includes(chat.role) ||
          chat.role === 'owner';

        if (shouldReceive) {
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
    const message = `🧾 *New Receipt!*\n${itemName} x${quantity}\nAmount: KES ${amount}`;
    await this.sendNotification(message, 'sales');
  }

  async sendReceiptNotification(total: number, items: string[]) {
    const itemsList = items.slice(0, 3).join(', ') + (items.length > 3 ? ` +${items.length - 3} more` : '');
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const message = `🧾 *New Receipt!*\nAmount: KES ${total.toFixed(2)}\nItems: ${itemsList}\nTime: ${time}`;
    await this.sendNotification(message, 'sales');
  }

  async sendLowStockAlert(itemName: string, currentStock: string, minStock: string) {
    const message = `⚠️ *Low Stock Alert!*\n${itemName}\nCurrent: ${currentStock}\nMinimum: ${minStock}`;
    await this.sendNotification(message, 'inventory');
  }

  async sendInventoryUpdate(action: string, details?: string) {
    const message = `📦 *Inventory Update*\n${action}${details ? `\n${details}` : ''}`;
    await this.sendNotification(message, 'inventory');
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
