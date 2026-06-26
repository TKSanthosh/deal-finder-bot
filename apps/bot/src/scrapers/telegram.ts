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
          // IMPORTANT: amzn.to and fkrt.it links that fail to resolve should still be treated as Amazon/Flipkart
          let source: 'amazon_in' | 'flipkart' | 'ebay' | 'mock';
          if (resolvedUrl.includes('amazon.in') || resolvedUrl.includes('amzn.to') || resolvedUrl.includes('amzn.in')) {
            source = 'amazon_in';
          } else if (resolvedUrl.includes('flipkart.com') || resolvedUrl.includes('fkrt.it') || resolvedUrl.includes('dl.flipkart.com')) {
            source = 'flipkart';
          } else {
            console.log(`[Telegram Scraper] Skipping unsupported store domain: ${resolvedUrl}`);
            continue;
          }

          // Extract post photo image URL (as a fallback)
          const photoEl = $(element).find('.tgme_widget_message_photo_wrap');
          let imageUrl = '';
          if (photoEl.length > 0) {
            const style = photoEl.attr('style') || '';
            const match = style.match(/background-image:\s*url\(['"]?(.*?)['"]?\)/i);
            if (match) {
              imageUrl = match[1];
            }
          }

          // Attempt to extract the real product image and clean title from the target store page
          console.log(`[Telegram Scraper] Fetching target page to extract real product image: ${resolvedUrl}`);
          const storeMeta = await this.fetchProductImageAndTitle(resolvedUrl);
          if (storeMeta.imageUrl && storeMeta.imageUrl.startsWith('http')) {
            console.log(`[Telegram Scraper] Found real product image: ${storeMeta.imageUrl}`);
            imageUrl = storeMeta.imageUrl;
          } else {
            console.log(`[Telegram Scraper] No product image found on store page. Using Telegram post photo as fallback.`);
          }

          // Generate stable ID from Telegram message path
          const msgLink = $(element).find('a.tgme_widget_message_date').attr('href') || '';
          const msgIdMatch = msgLink.match(/\/(\d+)$/);
          const id = msgIdMatch ? `tg-${channel}-${msgIdMatch[1]}` : `tg-${Math.random().toString(36).substring(2, 9)}`;

          // Deduplicate
          if (allDeals.some(deal => deal.id === id)) continue;

          // Prepare description. If we extracted a clean title from the store, append it so Gemini has better context
          const cleanStoreTitle = storeMeta.title ? `[Product Title: ${storeMeta.title}] ` : '';
          const descriptionWithContext = `${cleanStoreTitle}${text}`;

          allDeals.push({
            id,
            title: storeMeta.title || (text.substring(0, 100) + '...'),
            price: 0, // Gemini will parse the real price
            shippingPrice: 0,
            marketPriceEstimate: 0, // Gemini will parse the retail price
            url: resolvedUrl,
            imageUrl,
            source,
            description: descriptionWithContext, // pass description with context for Gemini to evaluate
            condition: 'New',
            currency: 'INR',
            timestamp: Date.now()
          });
        }
      } catch (error: any) {
        console.error(`[Telegram Scraper] Error scraping @${channel}:`, error.message);
      }
    }

    // Skip keyword filtering — the source Telegram channels are already curated deal channels.
    // Filtering here was causing 0 results because many posts don't contain exact tech keywords.
    // Let the AI evaluator (Gemini) decide what qualifies as a deal instead.
    console.log(`[Telegram Scraper] Total deals collected before evaluation: ${allDeals.length}`);

    return allDeals;
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
      // Try HEAD request first for speed — increased redirects and timeout for cloud reliability
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
