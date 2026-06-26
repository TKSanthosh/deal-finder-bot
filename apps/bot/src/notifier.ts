import axios from 'axios';
import { DealItem, EvaluationResult } from './types';
import { AffiliateLinkGenerator } from './affiliate';
import { PinterestClient } from './pinterest';
import { TwitterApi } from 'twitter-api-v2';
import * as fs from 'fs';
import * as path from 'path';

export class DealNotifier {
  private discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
  private telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  private telegramChatId = process.env.TELEGRAM_CHAT_ID;

  private affiliate = new AffiliateLinkGenerator();
  private pinterest = new PinterestClient();

  private twitterClient = (process.env.TWITTER_APP_KEY && process.env.TWITTER_APP_SECRET && process.env.TWITTER_ACCESS_TOKEN && process.env.TWITTER_ACCESS_SECRET)
    ? new TwitterApi({
        appKey: process.env.TWITTER_APP_KEY,
        appSecret: process.env.TWITTER_APP_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET,
      })
    : null;

  async notify(item: DealItem, evaluation: EvaluationResult): Promise<void> {
    const totalCost = item.price + (item.shippingPrice || 0);
    const profit = evaluation.estimatedProfit;
    const roi = ((profit / totalCost) * 100).toFixed(0);
    const symbol = item.currency === 'INR' ? '₹' : '$';

    // 1. Generate Affiliate Link
    const affiliateUrl = this.affiliate.generate(item.url, item.source);

    // 2. Console Log Alert
    this.logToConsole(item, evaluation, totalCost, profit, roi, affiliateUrl, symbol);

    // 3. Save to live website JSON feed (Option A)
    this.saveToJSONFeed(item, evaluation, affiliateUrl);

    // 4. Auto-Pin to Pinterest Board
    await this.pinterest.createPin(item, evaluation, affiliateUrl);

    // 5. Dispatch to Discord Webhook
    if (this.discordWebhookUrl) {
      await this.notifyDiscord(item, evaluation, totalCost, profit, roi, affiliateUrl, symbol);
    }

    // 6. Dispatch to Telegram Channel
    if (this.telegramToken && this.telegramChatId) {
      await this.notifyTelegram(item, evaluation, totalCost, profit, roi, affiliateUrl, symbol);
    }

    // 7. Auto-Post to Twitter/X (Option B)
    await this.notifyTwitter(item, evaluation, affiliateUrl);

    // 8. Auto-Post to Reddit (Option B)
    await this.notifyReddit(item, evaluation, affiliateUrl);
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

  private saveToJSONFeed(item: DealItem, evaluation: EvaluationResult, affiliateUrl: string): void {
    try {
      const feedPath = path.join(__dirname, '../../web/public/deals.json');
      const feedDir = path.dirname(feedPath);

      if (!fs.existsSync(feedDir)) {
        fs.mkdirSync(feedDir, { recursive: true });
      }

      let deals: any[] = [];
      if (fs.existsSync(feedPath)) {
        try {
          const content = fs.readFileSync(feedPath, 'utf8');
          deals = JSON.parse(content);
        } catch (e) {
          console.error('[Notifier] Error reading existing deals.json:', e);
          deals = [];
        }
      }

      const savings = item.marketPriceEstimate - item.price;
      const savingsPercent = item.marketPriceEstimate > 0 ? ((savings / item.marketPriceEstimate) * 100).toFixed(0) : '0';

      const newDeal = {
        id: item.id,
        title: item.title,
        price: item.price,
        marketPriceEstimate: item.marketPriceEstimate,
        savingsPercent,
        imageUrl: item.imageUrl || '',
        url: affiliateUrl,
        description: evaluation.reasoning,
        source: item.source,
        timestamp: Date.now()
      };

      // Add to front, remove duplicates, limit to 10
      deals = [newDeal, ...deals.filter((d: any) => d.id !== item.id)];
      deals = deals.slice(0, 10);

      fs.writeFileSync(feedPath, JSON.stringify(deals, null, 2), 'utf8');
      console.log(`[Notifier] Updated deals.json with new deal: ${item.title}`);
    } catch (error: any) {
      console.error('[Notifier] Failed to write to deals.json:', error.message);
    }
  }

  private async notifyTwitter(item: DealItem, evaluation: EvaluationResult, affiliateUrl: string): Promise<void> {
    try {
      if (!this.twitterClient) {
        console.log('[Notifier] Twitter credentials not configured. Skipping Twitter post.');
        return;
      }

      console.log(`[Notifier] Posting deal to Twitter/X...`);

      const cleanReasoning = evaluation.reasoning.replace(/<[^>]*>/g, ''); // strip HTML tags
      const tags = `#DealsIndia #LootDeals #AmazonDeals #FlipkartDeals #TechDeals #DiscountIndia #DealsRadar`;

      // Build the tweet dynamically
      let tweetText = `🔥 DEAL ALERT: ${item.title}\n\n`;
      tweetText += `💰 Deal Price: ₹${item.price.toLocaleString('en-IN')}\n`;
      tweetText += `📝 ${cleanReasoning.substring(0, 80)}...\n\n`;
      tweetText += `👉 Buy: ${affiliateUrl}\n`;
      tweetText += `⚡ Telegram: t.me/dealradarindia2002\n\n`;
      tweetText += tags;

      // Adjust length if it exceeds 280 characters
      if (tweetText.length > 280) {
        const diff = tweetText.length - 280;
        const availableReasoning = 80 - diff - 5;
        const shortReasoning = availableReasoning > 0 ? cleanReasoning.substring(0, availableReasoning) + '...' : '';
        
        tweetText = `🔥 DEAL ALERT: ${item.title}\n\n`;
        tweetText += `💰 Price: ₹${item.price.toLocaleString('en-IN')}\n`;
        if (shortReasoning) tweetText += `📝 ${shortReasoning}\n\n`;
        tweetText += `👉 Buy: ${affiliateUrl}\n`;
        tweetText += `⚡ Telegram: t.me/dealradarindia2002\n\n`;
        tweetText += tags;
      }

      await this.twitterClient.v2.tweet(tweetText);
      console.log('[Notifier] Successfully posted to Twitter/X!');
    } catch (error: any) {
      console.error('[Notifier] Error posting to Twitter/X:', error.message);
    }
  }

  private async notifyReddit(item: DealItem, evaluation: EvaluationResult, affiliateUrl: string): Promise<void> {
    try {
      const clientId = process.env.REDDIT_CLIENT_ID;
      const clientSecret = process.env.REDDIT_CLIENT_SECRET;
      const username = process.env.REDDIT_USERNAME;
      const password = process.env.REDDIT_PASSWORD;
      const subreddit = process.env.REDDIT_SUBREDDIT || 'dealsindia';

      if (!clientId || !clientSecret || !username || !password) {
        console.log('[Notifier] Reddit credentials not configured. Skipping Reddit post.');
        return;
      }

      console.log(`[Notifier] Posting deal to Reddit r/${subreddit}...`);

      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const tokenRes = await axios.post('https://www.reddit.com/api/v1/access_token',
        `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'DealBot/1.0 by DealsRadarBot'
          }
        }
      );

      const token = tokenRes.data.access_token;
      if (!token) throw new Error('Failed to retrieve access token from Reddit.');

      const cleanReasoning = evaluation.reasoning.replace(/<[^>]*>/g, ''); // strip HTML tags
      const postTitle = `[Deal Alert] ${item.title} - Only ₹${item.price.toLocaleString('en-IN')}!`;

      await axios.post('https://oauth.reddit.com/api/submit',
        new URLSearchParams({
          sr: subreddit,
          kind: 'link',
          title: postTitle,
          url: affiliateUrl,
          sendreplies: 'true'
        }),
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'DealBot/1.0 by DealsRadarBot',
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      console.log(`[Notifier] Successfully posted to Reddit r/${subreddit}!`);
    } catch (error: any) {
      console.error('[Notifier] Error posting to Reddit:', error.response?.data || error.message);
    }
  }
}
