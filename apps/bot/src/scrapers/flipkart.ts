import axios from 'axios';
import * as cheerio from 'cheerio';
import { DealItem, Scraper } from '../types';

export class FlipkartScraper implements Scraper {
  name = 'flipkart';

  // Indian Rupees (₹) market estimates
  private marketValuations: Record<string, number> = {
    'playstation 5': 55000,
    'ps5': 55000,
    'iphone 15 pro': 130000,
    'iphone 15': 70000,
    'rtx 4060': 30000,
    'oneplus 12': 65000,
    'nintendo switch': 28000,
    'steam deck': 45000
  };

  async scrape(keywords: string[]): Promise<DealItem[]> {
    const allDeals: DealItem[] = [];

    for (const keyword of keywords) {
      console.log(`[Flipkart Scraper] Searching for "${keyword}"...`);
      try {
        const url = `https://www.flipkart.com/search?q=${encodeURIComponent(keyword)}`;
        
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache'
          }
        });

        const $ = cheerio.load(response.data);
        
        // Flipkart has a few layouts. We look for product containers or anchors containing product detail paths (/p/)
        const links = $('a');
        
        links.each((_, element) => {
          const href = $(element).attr('href') || '';
          if (!href.includes('/p/')) return; // Must be a product link

          const fullUrl = `https://www.flipkart.com${href.split('?')[0]}`;

          // Locate title inside this anchor or in immediate siblings
          // Flipkart grid card structure has titles in .s1Q9rs, list card in ._4rR01T or .w1Z1nQ
          let title = $(element).find('._4rR01T, .s1Q9rs, ._3wU53n').text().trim();
          if (!title) {
            title = $(element).attr('title')?.trim() || '';
          }
          if (!title) return;

          // Parse Price
          // Flipkart prices have class ._30jeq3 or ._1vC4OI
          const priceText = $(element).find('._30jeq3, ._16Jk6d').first().text().trim();
          if (!priceText) return;
          
          const cleanPrice = parseInt(priceText.replace(/[^0-9]/g, ''), 10);
          if (isNaN(cleanPrice) || cleanPrice <= 0) return;

          // Extract Image
          const imgEl = $(element).find('img');
          const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || '';

          // Parse ID from URL
          const idMatch = href.match(/pid=([A-Z0-9]{16})/i);
          const id = idMatch ? `flipkart-${idMatch[1]}` : `flipkart-${Math.random().toString(36).substring(2, 9)}`;

          // Deduplicate within the cycle
          if (allDeals.some(deal => deal.id === id)) return;

          // Valuation check
          let marketPriceEstimate = cleanPrice * 1.25;
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
            shippingPrice: 0,
            marketPriceEstimate,
            url: fullUrl,
            imageUrl,
            source: 'flipkart',
            condition: 'New',
            currency: 'INR',
            timestamp: Date.now()
          });
        });

      } catch (error: any) {
        console.error(`[Flipkart Scraper] Error searching keyword "${keyword}":`, error.message);
      }
    }

    return allDeals;
  }
}
