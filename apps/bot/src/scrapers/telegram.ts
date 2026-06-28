import axios from 'axios';
import * as cheerio from 'cheerio';
import { DealItem, Scraper } from '../types';

export class TelegramScraper implements Scraper {
  name = 'telegram';

  // List of popular public Telegram deals channels to scrape
  private channels = ['idoffers', 'GoPaisa', 'LootDealsIndia', 'DesiDime'];

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

          // Filter to only shopping links
          const dealLinks = links.filter(link =>
            link.includes('amazon') ||
            link.includes('amzn') ||
            link.includes('flipkart') ||
            link.includes('fkrt') ||
            link.includes('bit.ly') ||
            link.includes('wishlink')
          );

          if (dealLinks.length === 0) continue;

          // Process EACH deal link separately (fixes multi-product post bug)
          for (const dealLink of dealLinks) {
            // Resolve the link (follow redirects to get final Amazon/Flipkart URL)
            console.log(`[Telegram Scraper] Found deal link candidate: ${dealLink}. Resolving redirects...`);
            const resolvedUrl = await this.resolveShortLink(dealLink);
            console.log(`[Telegram Scraper] Resolved URL: ${resolvedUrl}`);

            // Classify source platform
            let source: 'amazon_in' | 'flipkart' | 'ebay' | 'mock';
            if (resolvedUrl.includes('amazon.in') || resolvedUrl.includes('amzn.to') || resolvedUrl.includes('amzn.in')) {
              source = 'amazon_in';
            } else if (resolvedUrl.includes('flipkart.com') || resolvedUrl.includes('fkrt.it') || resolvedUrl.includes('dl.flipkart.com')) {
              source = 'flipkart';
            } else {
              console.log(`[Telegram Scraper] Skipping unsupported store domain: ${resolvedUrl}`);
              continue;
            }

            // Extract post photo image URL from Telegram (most reliable source)
            const photoEl = $(element).find('.tgme_widget_message_photo_wrap');
            let imageUrl = '';
            if (photoEl.length > 0) {
              const style = photoEl.attr('style') || '';
              const match = style.match(/background-image:\s*url\(['"]?(.*?)['"]?\)/i);
              if (match) {
                imageUrl = match[1];
              }
            }

            // Try to get product title from the store page
            let productTitle = '';
            try {
              const storeMeta = await this.fetchProductImageAndTitle(resolvedUrl);
              // Only use store title if it's a real product name, not a generic page title
              if (storeMeta.title &&
                  !storeMeta.title.includes('Amazon.in') &&
                  !storeMeta.title.includes('Amazon India') &&
                  !storeMeta.title.includes('Flipkart.com') &&
                  !storeMeta.title.includes('Online Shopping') &&
                  storeMeta.title.length > 10) {
                productTitle = storeMeta.title;
              }

              // Only use store image if it looks like a real product image
              if (storeMeta.imageUrl &&
                  storeMeta.imageUrl.startsWith('http') &&
                  !storeMeta.imageUrl.includes('favicon') &&
                  !storeMeta.imageUrl.includes('logo')) {
                // Store images can sometimes be higher quality — use them if no Telegram photo
                if (!imageUrl) {
                  imageUrl = storeMeta.imageUrl;
                }
              }
            } catch (e: any) {
              console.log(`[Telegram Scraper] Could not fetch store metadata: ${e.message}`);
            }

            // Extract a clean title from the Telegram post text if store title failed
            if (!productTitle) {
              productTitle = this.extractTitleFromText(text);
            }

            // Generate stable ID from Telegram message path + link hash
            const msgLink = $(element).find('a.tgme_widget_message_date').attr('href') || '';
            const msgIdMatch = msgLink.match(/\/(\d+)$/);
            // Include a hash of the dealLink to create unique IDs for multi-link posts
            const linkHash = dealLink.replace(/[^a-zA-Z0-9]/g, '').slice(-8);
            const id = msgIdMatch ? `tg-${channel}-${msgIdMatch[1]}-${linkHash}` : `tg-${Math.random().toString(36).substring(2, 9)}`;

            // Deduplicate
            if (allDeals.some(deal => deal.id === id)) continue;

            allDeals.push({
              id,
              title: productTitle,
              price: 0, // Evaluator will parse the real price from description
              shippingPrice: 0,
              marketPriceEstimate: 0,
              url: resolvedUrl,
              imageUrl,
              source,
              description: text,
              condition: 'New',
              currency: 'INR',
              timestamp: Date.now()
            });

            // Only process the first deal link per post to avoid duplicating descriptions
            break;
          }
        }
      } catch (error: any) {
        console.error(`[Telegram Scraper] Error scraping @${channel}:`, error.message);
      }
    }

    console.log(`[Telegram Scraper] Total deals collected before evaluation: ${allDeals.length}`);
    return allDeals;
  }

  /**
   * Extract a clean product title from Telegram post text.
   * Takes the first meaningful line, strips emojis, URLs, and promotional noise.
   */
  private extractTitleFromText(text: string): string {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    for (const line of lines) {
      // Skip lines that are just emojis, hashtags, or URLs
      const cleaned = line
        .replace(/https?:\/\/\S+/g, '')     // Remove URLs
        .replace(/[#@]\S+/g, '')            // Remove hashtags/mentions
        .replace(/[\u{1F300}-\u{1FAFF}]/gu, '') // Remove emojis
        .replace(/[🔥⚡🚨❌✅💰📦🏷️👉📝🎯💥🔗💵📉📈🛡️]/g, '') // Remove common deal emojis
        .replace(/\s+/g, ' ')
        .trim();

      // Use the first non-empty line that looks like a product title (>5 chars)
      if (cleaned.length > 5 && !cleaned.toLowerCase().startsWith('buy') && !cleaned.toLowerCase().startsWith('use code')) {
        return cleaned.substring(0, 120);
      }
    }

    return text.substring(0, 80).replace(/\n/g, ' ') + '...';
  }

  /**
   * Attempts to fetch the product page and extract the real product image (from og:image)
   * and clean product title. Falls back to original values if blocked or failed.
   */
  private async fetchProductImageAndTitle(url: string): Promise<{ imageUrl?: string; title?: string }> {
    try {
      const res = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });
      const $ = cheerio.load(res.data);

      // Amazon/Flipkart standard OpenGraph tags
      const ogImage = $('meta[property="og:image"]').attr('content') ||
                      $('meta[name="twitter:image"]').attr('content') ||
                      $('#landingImage').attr('src') ||
                      $('#imgBlkFront').attr('src');

      const ogTitle = $('meta[property="og:title"]').attr('content') ||
                      $('title').text();

      return {
        imageUrl: ogImage?.trim(),
        title: ogTitle?.trim()
      };
    } catch (error: any) {
      console.log(`[Telegram Scraper] Fetching product page metadata failed or was blocked: ${error.message}`);
      return {};
    }
  }

  /**
   * Follows HTTP redirects to expand shorteners like amzn.to or bit.ly to target product pages
   */
  private async resolveShortLink(url: string): Promise<string> {
    try {
      // Try HEAD request first for speed
      const res = await axios.head(url, {
        maxRedirects: 10,
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      return res.request.res.responseUrl || url;
    } catch (err) {
      // Fallback to GET if HEAD is rejected by server
      try {
        const res = await axios.get(url, {
          maxRedirects: 10,
          timeout: 8000,
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
