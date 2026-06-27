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

  private twitterClient = (() => {
    // If OAuth 2.0 Access Token is directly provided (e.g. from the user screenshot)
    if (process.env.TWITTER_ACCESS_TOKEN && !process.env.TWITTER_ACCESS_SECRET) {
      console.log('[Notifier] Initializing Twitter client using OAuth 2.0 Access Token.');
      return new TwitterApi(process.env.TWITTER_ACCESS_TOKEN);
    }
    // Fallback to OAuth 1.0a if all credentials are set
    if (process.env.TWITTER_APP_KEY && process.env.TWITTER_APP_SECRET && process.env.TWITTER_ACCESS_TOKEN && process.env.TWITTER_ACCESS_SECRET) {
      console.log('[Notifier] Initializing Twitter client using OAuth 1.0a User Context.');
      return new TwitterApi({
        appKey: process.env.TWITTER_APP_KEY,
        appSecret: process.env.TWITTER_APP_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET,
      });
    }
    return null;
  })();

  async notify(item: DealItem, evaluation: EvaluationResult): Promise<void> {
    const totalCost = item.price + (item.shippingPrice || 0);
    const profit = evaluation.estimatedProfit;
    const roi = totalCost > 0 ? ((profit / totalCost) * 100).toFixed(0) : '0';
    const symbol = item.currency === 'INR' ? '₹' : '$';

    // 1. Generate Affiliate Link
    const affiliateUrl = this.affiliate.generate(item.url, item.source);

    // 2. Console Log Alert
    this.logToConsole(item, evaluation, totalCost, profit, roi, affiliateUrl, symbol);

    // 3. Save to live website JSON feed
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

    // 7. Auto-Post to Twitter/X
    await this.notifyTwitter(item, evaluation, affiliateUrl);

    // 8. Auto-Post to Reddit
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
    const color = evaluation.safetyScore > 80 ? '\x1b[32m' : '\x1b[33m';
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
      const embedColor = evaluation.safetyScore > 80 ? 3066993 : 15105570;

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

  /** Escape special HTML characters for Telegram HTML parse mode */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Safely truncate HTML text for Telegram captions without breaking tags.
   * Strips all HTML tags before truncating, then the message uses plain text within the template.
   */
  private safeTruncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;

    // Find the last complete HTML tag boundary before maxLen
    let truncated = text.substring(0, maxLen);

    // Check if we're in the middle of an HTML tag
    const lastOpenBracket = truncated.lastIndexOf('<');
    const lastCloseBracket = truncated.lastIndexOf('>');

    if (lastOpenBracket > lastCloseBracket) {
      // We're inside a tag — cut before it
      truncated = truncated.substring(0, lastOpenBracket);
    }

    // Close any unclosed tags
    const openTags: string[] = [];
    const tagRegex = /<\/?([a-z]+)[^>]*>/gi;
    let match;
    while ((match = tagRegex.exec(truncated)) !== null) {
      const tag = match[1].toLowerCase();
      if (match[0].startsWith('</')) {
        // Closing tag — remove from stack
        const idx = openTags.lastIndexOf(tag);
        if (idx !== -1) openTags.splice(idx, 1);
      } else if (!match[0].endsWith('/>')) {
        // Opening tag
        openTags.push(tag);
      }
    }

    // Close remaining open tags in reverse order
    for (let i = openTags.length - 1; i >= 0; i--) {
      truncated += `</${openTags[i]}>`;
    }

    return truncated;
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

      // Escape HTML entities in user-generated content
      const safeTitle = this.escapeHtml(item.title || 'Great Deal');
      const safeReasoning = this.escapeHtml(evaluation.reasoning || '');
      // Escape & in URLs for HTML mode
      const safeUrl = affiliateUrl.replace(/&/g, '&amp;');

      const text = `🔥 <b>DEAL ALERT: ${safeTitle}</b>

⚡ <b>Super discount on ${storeName}!</b>
❌ <b>Original Price:</b> ${symbol}${item.marketPriceEstimate.toLocaleString('en-IN')}
✅ <b>Deal Price:</b> ${symbol}${item.price.toLocaleString('en-IN')} (Save ${savingsPercent}%)

📝 <b>About this product:</b>
<i>${safeReasoning}</i>

👉 <a href="${safeUrl}"><b>BUY NOW ON ${storeName.toUpperCase()}</b></a>`;

      // Try sending with photo first
      if (item.imageUrl) {
        try {
          const photoText = this.safeTruncate(text, 1024);
          const url = `https://api.telegram.org/bot${this.telegramToken}/sendPhoto`;
          await axios.post(url, {
            chat_id: this.telegramChatId,
            photo: item.imageUrl,
            caption: photoText,
            parse_mode: 'HTML'
          });
          console.log('[Notifier] Telegram photo notification sent successfully.');
          return;
        } catch (photoError: any) {
          console.log(`[Notifier] sendPhoto failed (${photoError.response?.data?.description || photoError.message}), falling back to text message.`);
          // Fall through to sendMessage
        }
      }

      // Fallback: send as text message (with link preview)
      const msgUrl = `https://api.telegram.org/bot${this.telegramToken}/sendMessage`;
      await axios.post(msgUrl, {
        chat_id: this.telegramChatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      });
      console.log('[Notifier] Telegram text notification sent successfully.');
    } catch (error: any) {
      console.error('[Notifier] Error sending Telegram message:', error.message);
      if (error.response?.data) {
        console.error('[Notifier] Telegram API response:', JSON.stringify(error.response.data));
      }
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

      // Add to front, remove duplicates, limit to 50
      deals = [newDeal, ...deals.filter((d: any) => d.id !== item.id)];
      deals = deals.slice(0, 50);

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
      const storeName = item.source === 'amazon_in' ? 'Amazon' : 'Flipkart';
      const tags = `#DealsIndia #LootDeals #${storeName}Deals #DiscountIndia #DealsRadar`;

      // Truncate title to fit within 280 chars
      const maxTitleLen = 60;
      const shortTitle = item.title.length > maxTitleLen
        ? item.title.substring(0, maxTitleLen) + '...'
        : item.title;

      // Build the tweet — keep it compact
      let tweetText = `🔥 ${shortTitle}\n`;
      tweetText += `💰 ₹${item.price.toLocaleString('en-IN')}\n`;
      tweetText += `👉 ${affiliateUrl}\n`;
      tweetText += tags;

      // Hard truncate to 280 if still too long
      if (tweetText.length > 280) {
        tweetText = tweetText.substring(0, 277) + '...';
      }

      await this.twitterClient.v2.tweet(tweetText);
      console.log('[Notifier] Successfully posted to Twitter/X!');
    } catch (error: any) {
      console.error('[Notifier] Error posting to Twitter/X:', error.message);
      if (error.data) {
        console.error('[Notifier] Twitter API response:', JSON.stringify(error.data));
      }
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

      const postTitle = `[Deal Alert] ${item.title} - Only ₹${item.price.toLocaleString('en-IN')}!`;

      await axios.post('https://oauth.reddit.com/api/submit',
        new URLSearchParams({
          sr: subreddit,
          kind: 'link',
          title: postTitle.substring(0, 300),
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
