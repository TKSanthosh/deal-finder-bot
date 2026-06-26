import axios from 'axios';
import * as cheerio from 'cheerio';
import { DealItem, Scraper } from '../types';

export class EbayScraper implements Scraper {
  name = 'ebay';

  // Default valuation lookups for popular resale categories
  private marketValuations: Record<string, number> = {
    'playstation 5': 450,
    'ps5': 450,
    'iphone 15 pro': 850,
    'iphone 14 pro': 650,
    'rtx 4070': 550,
    'rtx 4080': 950,
    'nintendo switch': 220,
    'steam deck': 350
  };

  async scrape(keywords: string[]): Promise<DealItem[]> {
    const allDeals: DealItem[] = [];

    for (const keyword of keywords) {
      console.log(`[eBay Scraper] Searching for "${keyword}" (Newly Listed, Buy It Now)...`);
      try {
        // LH_BIN=1 filters for "Buy It Now", _sop=10 sorts by "Newly Listed"
        const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}&_sop=10&LH_BIN=1`;
        
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache'
          }
        });

        const $ = cheerio.load(response.data);
        const items = $('.s-item');

        items.each((_, element) => {
          const titleEl = $(element).find('.s-item__title');
          const title = titleEl.text().trim().replace(/^New Listing\s+/i, '');
          if (!title || title.includes('Shop on eBay')) return; // Skip non-result placeholders

          const link = $(element).find('a.s-item__link').attr('href') || '';
          if (!link) return;

          // Extract eBay Item ID
          let id = '';
          const match = link.match(/\/itm\/(\d+)/);
          if (match) {
            id = `ebay-${match[1]}`;
          } else {
            id = `ebay-${Math.random().toString(36).substring(2, 9)}`;
          }

          // Parse Price
          const priceText = $(element).find('.s-item__price').text().trim();
          // Filter characters like $ or commas and parse float
          const cleanPrice = parseFloat(priceText.replace(/[^0-9.]/g, ''));
          if (isNaN(cleanPrice) || cleanPrice <= 0) return;

          // Parse Shipping
          const shippingText = $(element).find('.s-item__shipping, .s-item__logisticsCost').text().trim();
          let shippingPrice = 0;
          if (shippingText.toLowerCase().includes('free')) {
            shippingPrice = 0;
          } else {
            const shipPrice = parseFloat(shippingText.replace(/[^0-9.]/g, ''));
            if (!isNaN(shipPrice)) {
              shippingPrice = shipPrice;
            }
          }

          // Parse Condition
          const condition = $(element).find('.secondary-info, .s-item__subtitle').text().trim() || 'Used';

          // Extract Image URL
          const imgEl = $(element).find('.s-item__image-img img, .s-item__image-img');
          const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || '';

          // Market valuation heuristic
          let marketPriceEstimate = cleanPrice * 1.35; // Default fallback: assume resale is 35% higher
          
          const titleLower = title.toLowerCase();
          for (const [key, val] of Object.entries(this.marketValuations)) {
            if (titleLower.includes(key)) {
              marketPriceEstimate = val;
              break;
            }
          }

          allDeals.push({
            id,
            title,
            price: cleanPrice,
            shippingPrice,
            marketPriceEstimate,
            url: link.split('?')[0], // Remove tracking parameters
            imageUrl,
            source: 'ebay',
            condition,
            timestamp: Date.now()
          });
        });

      } catch (error: any) {
        console.error(`[eBay Scraper] Error scraping keyword "${keyword}":`, error.message);
      }
    }

    return allDeals;
  }
}
