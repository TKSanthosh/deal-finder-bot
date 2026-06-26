import axios from 'axios';
import * as cheerio from 'cheerio';
import { DealItem, Scraper } from '../types';

export class AmazonInScraper implements Scraper {
  name = 'amazon_in';

  // Typical market prices in INR (₹) for valuation estimation
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
      console.log(`[Amazon India Scraper] Searching for "${keyword}"...`);
      try {
        const url = `https://www.amazon.in/s?k=${encodeURIComponent(keyword)}`;
        
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'device-memory': '8'
          }
        });

        const $ = cheerio.load(response.data);
        const items = $('[data-component-type="s-search-result"]');

        items.each((_, element) => {
          const titleEl = $(element).find('h2 a span');
          const title = titleEl.text().trim();
          if (!title) return;

          const link = $(element).find('h2 a.a-link-normal').attr('href') || '';
          if (!link) return;

          const fullUrl = `https://www.amazon.in${link.split('?')[0]}`;

          // Parse Price
          const priceWhole = $(element).find('.a-price-whole').first().text().replace(/[^0-9]/g, '');
          const cleanPrice = parseInt(priceWhole, 10);
          if (isNaN(cleanPrice) || cleanPrice <= 0) return;

          // Extract Product Image
          const imageUrl = $(element).find('.s-image').attr('src') || '';

          // ID calculation from URL
          const match = fullUrl.match(/\/dp\/([A-Z0-9]{10})/i);
          const id = match ? `amazonin-${match[1]}` : `amazonin-${Math.random().toString(36).substring(2, 9)}`;

          // Find valuation benchmark
          let marketPriceEstimate = cleanPrice * 1.25; // fallback retail is 25% higher
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
            source: 'amazon_in',
            condition: 'New',
            currency: 'INR',
            timestamp: Date.now()
          });
        });

      } catch (error: any) {
        console.error(`[Amazon India Scraper] Error searching keyword "${keyword}":`, error.message);
      }
    }

    return allDeals;
  }
}
