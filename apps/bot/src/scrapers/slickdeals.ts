import axios from 'axios';
import * as cheerio from 'cheerio';
import { DealItem, Scraper } from '../types';

export class SlickdealsScraper implements Scraper {
  name = 'slickdeals';

  async scrape(keywords: string[]): Promise<DealItem[]> {
    console.log('[Slickdeals Scraper] Fetching Hot Deals RSS feed...');
    const allDeals: DealItem[] = [];

    try {
      // Fetch the Frontpage/Popular deals RSS feed to bypass Cloudflare web page blocks
      const feedUrl = 'https://slickdeals.net/newsearch.php?mode=popdeals&type=thread&firstonly=1&feed=rss2';
      
      const response = await axios.get(feedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/xml, text/xml, */*'
        }
      });

      const $ = cheerio.load(response.data, { xmlMode: true });
      const items = $('item');

      items.each((_, element) => {
        const rawTitle = $(element).find('title').text().trim();
        const url = $(element).find('link').text().trim();
        const descriptionHtml = $(element).find('description').text().trim();
        
        // Parse price from title (e.g. "SanDisk 1TB SSD $69.99" or "LG 65\" OLED TV: $1200 + Free Shipping")
        // Match things like $69, $1,200.50, $1200
        const priceRegex = /\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/;
        const match = rawTitle.match(priceRegex);
        
        if (!match) return; // Skip if no price listed

        const cleanPrice = parseFloat(match[1].replace(/,/g, ''));
        if (isNaN(cleanPrice) || cleanPrice <= 0) return;

        // Clean title
        const cleanTitle = rawTitle.replace(/\[.*?\]/g, '').trim(); // Remove brackets like [Amazon]

        // Scrape description text
        const descText = cheerio.load(descriptionHtml).text().trim().substring(0, 300);

        // Slickdeals prices are already low, so assume MSRP/Market value is ~40% higher
        const marketPriceEstimate = cleanPrice * 1.40;

        // Check keywords if specified
        if (keywords.length > 0) {
          const matchesKw = keywords.some(kw => 
            cleanTitle.toLowerCase().includes(kw.toLowerCase()) || 
            descText.toLowerCase().includes(kw.toLowerCase())
          );
          if (!matchesKw) return;
        }

        allDeals.push({
          id: `slickdeals-${url.match(/f\/(\d+)/)?.[1] || Math.random().toString(36).substring(2, 9)}`,
          title: cleanTitle,
          price: cleanPrice,
          shippingPrice: 0, // usually accounted for in Slickdeals summaries
          marketPriceEstimate,
          url,
          source: 'slickdeals',
          description: descText,
          condition: 'New',
          timestamp: Date.now()
        });
      });

    } catch (error: any) {
      console.error('[Slickdeals Scraper] Error fetching RSS feed:', error.message);
    }

    return allDeals;
  }
}
