import axios from 'axios';
import * as cheerio from 'cheerio';
import { DealItem, Scraper } from '../types';

export class TelegramScraper implements Scraper {
  name = 'telegram';

  // List of popular public Telegram deals channels to scrape
  private channels = ['idoffers', 'GoPaisa'];

  async scrape(keywords: string[]): Promise<DealItem[]> {
    const allDeals: DealItem[] = [];

    for (const channel of this.channels) {
      console.log(`[Telegram Scraper] Scraping public channel preview: @${channel}...`);
      try {
        const url = `https://t.me/s/${channel}`;
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });

        const $ = cheerio.load(response.data);
        const messages = $('.tgme_widget_message');

        for (let i = 0; i < messages.length; i++) {
          const element = messages[i];
          const textEl = $(element).find('.tgme_widget_message_text');
          const text = textEl.text().trim();
          if (!text) continue;

          // Find all links inside the message text
          const links: string[] = [];
          textEl.find('a').each((_, a) => {
            const href = $(a).attr('href');
            if (href) links.push(href);
          });

          // Check if any link goes to a shopping portal or link shortener
          const dealLink = links.find(link => 
            link.includes('amazon') || 
            link.includes('amzn') || 
            link.includes('flipkart') || 
            link.includes('fkrt') || 
            link.includes('bit.ly') || 
            link.includes('wishlink')
          );

          if (!dealLink) continue;

          // Resolve the link (follow redirects to get final Amazon/Flipkart URL)
          console.log(`[Telegram Scraper] Found deal link candidate: ${dealLink}. Resolving redirects...`);
          const resolvedUrl = await this.resolveShortLink(dealLink);
          console.log(`[Telegram Scraper] Resolved URL: ${resolvedUrl}`);

          // Classify source platform and filter out unsupported stores (like Meesho, Myntra, etc.)
          let source: 'amazon_in' | 'flipkart' | 'ebay' | 'mock';
          if (resolvedUrl.includes('amazon.in')) {
            source = 'amazon_in';
          } else if (resolvedUrl.includes('flipkart.com')) {
            source = 'flipkart';
          } else {
            console.log(`[Telegram Scraper] Skipping unsupported store domain: ${resolvedUrl}`);
            continue;
          }

          // Extract post photo image URL
          const photoEl = $(element).find('.tgme_widget_message_photo_wrap');
          let imageUrl = '';
          if (photoEl.length > 0) {
            const style = photoEl.attr('style') || '';
            const match = style.match(/background-image:\s*url\(['"]?(.*?)['"]?\)/i);
            if (match) {
              imageUrl = match[1];
            }
          }

          // Generate stable ID from Telegram message path
          const msgLink = $(element).find('a.tgme_widget_message_date').attr('href') || '';
          const msgIdMatch = msgLink.match(/\/(\d+)$/);
          const id = msgIdMatch ? `tg-${channel}-${msgIdMatch[1]}` : `tg-${Math.random().toString(36).substring(2, 9)}`;

          // Deduplicate
          if (allDeals.some(deal => deal.id === id)) continue;

          allDeals.push({
            id,
            title: text.substring(0, 100) + '...', // placeholder, Gemini will parse the real title
            price: 0, // Gemini will parse the real price
            shippingPrice: 0,
            marketPriceEstimate: 0, // Gemini will parse the retail price
            url: resolvedUrl,
            imageUrl,
            source,
            description: text, // pass the full post content as description for Gemini to evaluate
            condition: 'New',
            currency: 'INR',
            timestamp: Date.now()
          });
        }
      } catch (error: any) {
        console.error(`[Telegram Scraper] Error scraping @${channel}:`, error.message);
      }
    }

    // Filter deals by keywords if user has specified any search restrictions
    if (keywords.length > 0) {
      return allDeals.filter(deal => 
        keywords.some(kw => 
          deal.description && deal.description.toLowerCase().includes(kw.toLowerCase())
        )
      );
    }

    return allDeals;
  }

  /**
   * Follows HTTP redirects to expand shorteners like amzn.to or bit.ly to target product pages
   */
  private async resolveShortLink(url: string): Promise<string> {
    try {
      // Try HEAD request first for speed
      const res = await axios.head(url, {
        maxRedirects: 4,
        timeout: 4000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      return res.request.res.responseUrl || url;
    } catch (err) {
      // Fallback to GET if HEAD is rejected by server
      try {
        const res = await axios.get(url, {
          maxRedirects: 4,
          timeout: 4000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        return res.request.res.responseUrl || url;
      } catch (e: any) {
        // Return original URL if redirect check times out or fails
        return url;
      }
    }
  }
}
