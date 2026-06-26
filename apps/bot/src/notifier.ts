import axios from 'axios';
import { DealItem, EvaluationResult } from './types';
import { AffiliateLinkGenerator } from './affiliate';
import { PinterestClient } from './pinterest';

export class DealNotifier {
  private discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
  private telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  private telegramChatId = process.env.TELEGRAM_CHAT_ID;

  private affiliate = new AffiliateLinkGenerator();
  private pinterest = new PinterestClient();

  async notify(item: DealItem, evaluation: EvaluationResult): Promise<void> {
    const totalCost = item.price + (item.shippingPrice || 0);
    const profit = evaluation.estimatedProfit;
    const roi = ((profit / totalCost) * 100).toFixed(0);
    const symbol = item.currency === 'INR' ? '₹' : '$';

    // 1. Generate Affiliate Link
    const affiliateUrl = this.affiliate.generate(item.url, item.source);

    // 2. Console Log Alert
    this.logToConsole(item, evaluation, totalCost, profit, roi, affiliateUrl, symbol);

    // 3. Auto-Pin to Pinterest Board
    await this.pinterest.createPin(item, evaluation, affiliateUrl);

    // 4. Dispatch to Discord Webhook
    if (this.discordWebhookUrl) {
      await this.notifyDiscord(item, evaluation, totalCost, profit, roi, affiliateUrl, symbol);
    }

    // 5. Dispatch to Telegram Channel
    if (this.telegramToken && this.telegramChatId) {
      await this.notifyTelegram(item, evaluation, totalCost, profit, roi, affiliateUrl, symbol);
    }
  }

  private logToConsole(
    item: DealItem,
    evaluation: EvaluationResult,
    totalCost: number,
    profit: number,
    roi: string,
    affiliateUrl: string,
    symbol: string
  ): void {
    const color = evaluation.safetyScore > 80 ? '\x1b[32m' : '\x1b[33m'; // Green vs Yellow
    const reset = '\x1b[0m';
    const bold = '\x1b[1m';

    console.log('\n' + '='.repeat(60));
    console.log(`${color}${bold}🚨 ARBITRAGE DEAL ALERT! [${item.source.toUpperCase()}]${reset}`);
    console.log(`${bold}Title:${reset} ${item.title}`);
    console.log(`${bold}Affiliate Link:${reset} ${affiliateUrl}`);
    console.log('-'.repeat(60));
    console.log(`${bold}Cost:${reset} ${symbol}${item.price} (+${symbol}${item.shippingPrice || 0} shipping)`);
    console.log(`${bold}Resale Value:${reset} ${symbol}${evaluation.estimatedResaleValue}`);
    console.log(`${color}${bold}Est. Profit:${reset} ${color}+${symbol}${profit.toFixed(2)} (${roi}% ROI)${reset}`);
    console.log(`${bold}Safety Score:${reset} ${evaluation.safetyScore}/100`);
    console.log(`${bold}Condition:${reset} ${item.condition || 'Used'}`);
    console.log(`${bold}AI Reasoning:${reset} ${evaluation.reasoning}`);
    console.log('='.repeat(60) + '\n');
  }

  private async notifyDiscord(
    item: DealItem,
    evaluation: EvaluationResult,
    totalCost: number,
    profit: number,
    roi: string,
    affiliateUrl: string,
    symbol: string
  ): Promise<void> {
    try {
      const embedColor = evaluation.safetyScore > 80 ? 3066993 : 15105570; // Green or Orange

      const embed: any = {
        title: `🚨 Arbitrage Deal Alert: ${item.source.toUpperCase()}`,
        description: `**[${item.title}](${affiliateUrl})**`,
        url: affiliateUrl,
        color: embedColor,
        fields: [
          { name: '💰 Buy Price', value: `${symbol}${item.price.toFixed(2)}`, inline: true },
          { name: '📦 Shipping', value: `${symbol}${(item.shippingPrice || 0).toFixed(2)}`, inline: true },
          { name: '📉 Resale Est.', value: `${symbol}${evaluation.estimatedResaleValue.toFixed(2)}`, inline: true },
          { name: '💵 Profit Est.', value: `**+${symbol}${profit.toFixed(2)}**`, inline: true },
          { name: '📈 Est. ROI', value: `${roi}%`, inline: true },
          { name: '🛡️ Safety Score', value: `${evaluation.safetyScore}/100`, inline: true },
          { name: '🏷️ Condition', value: item.condition || 'Used', inline: true }
        ],
        footer: { text: `Gemini AI Evaluator • ${new Date().toLocaleTimeString()}` }
      };

      if (evaluation.reasoning) {
        embed.fields.push({ name: '🤖 AI Analysis', value: evaluation.reasoning, inline: false });
      }

      if (item.imageUrl) {
        embed.image = { url: item.imageUrl };
      }

      await axios.post(this.discordWebhookUrl!, { embeds: [embed] });
      console.log('[Notifier] Discord notification sent successfully.');
    } catch (error: any) {
      console.error('[Notifier] Error sending Discord webhook:', error.message);
    }
  }

  private async notifyTelegram(
    item: DealItem,
    evaluation: EvaluationResult,
    totalCost: number,
    profit: number,
    roi: string,
    affiliateUrl: string,
    symbol: string
  ): Promise<void> {
    try {
      const savings = item.marketPriceEstimate - item.price;
      const savingsPercent = item.marketPriceEstimate > 0 ? ((savings / item.marketPriceEstimate) * 100).toFixed(0) : '0';
      const storeName = item.source === 'amazon_in' ? 'Amazon India' : 'Flipkart';

      const text = `🔥 <b>DEAL ALERT: ${item.title}</b>

⚡ <b>Super discount on ${storeName}!</b>
❌ <b>Original Price:</b> ${symbol}${item.marketPriceEstimate.toLocaleString('en-IN')}
✅ <b>Deal Price:</b> ${symbol}${item.price.toLocaleString('en-IN')} (Save ${savingsPercent}%)

📝 <b>About this product:</b>
<i>${evaluation.reasoning}</i>

👉 <a href="${affiliateUrl}"><b>BUY NOW ON ${storeName.toUpperCase()}</b></a>`;

      if (item.imageUrl) {
        const url = `https://api.telegram.org/bot${this.telegramToken}/sendPhoto`;
        await axios.post(url, {
          chat_id: this.telegramChatId,
          photo: item.imageUrl,
          caption: text,
          parse_mode: 'HTML'
        });
      } else {
        const url = `https://api.telegram.org/bot${this.telegramToken}/sendMessage`;
        await axios.post(url, {
          chat_id: this.telegramChatId,
          text: text,
          parse_mode: 'HTML',
          disable_web_page_preview: false
        });
      }
      console.log('[Notifier] Telegram notification sent successfully.');
    } catch (error: any) {
      console.error('[Notifier] Error sending Telegram message:', error.message);
    }
  }
}
