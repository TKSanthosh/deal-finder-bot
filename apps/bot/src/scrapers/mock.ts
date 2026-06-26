import { DealItem, Scraper } from '../types';

export class MockScraper implements Scraper {
  name = 'mock';

  async scrape(keywords: string[]): Promise<DealItem[]> {
    console.log(`[Mock Scraper] Generating mock Indian listings for keywords: ${keywords.join(', ')}`);
    
    await new Promise((resolve) => setTimeout(resolve, 800));

    const mockDeals: DealItem[] = [
      {
        id: 'mock-amazon-in-1',
        title: 'Sony PlayStation 5 Console (slim edition) - Disc Version',
        price: 36990,
        shippingPrice: 150,
        marketPriceEstimate: 54990,
        url: 'https://www.amazon.in/dp/B0CX9SZGQD',
        imageUrl: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&q=80&w=400',
        source: 'amazon_in',
        description: 'Brand new PlayStation 5 Slim Disc Edition. Indian retail unit with official warranty. Free fast delivery for Prime members. Selling due to stock clearance.',
        condition: 'New',
        currency: 'INR',
        timestamp: Date.now()
      },
      {
        id: 'mock-flipkart-2',
        title: 'OnePlus 12 (Flowy Emerald, 256 GB)  (12 GB RAM) (FOR PARTS ONLY - WATER DAMAGED)',
        price: 24999,
        shippingPrice: 0,
        marketPriceEstimate: 64999,
        url: 'https://www.flipkart.com/oneplus-12-flowy-emerald-256-gb/p/itm53',
        imageUrl: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&q=80&w=400',
        source: 'flipkart',
        description: 'OnePlus 12 Flowy Emerald. Fell into water. Display does not light up. Back panel has a minor hairline crack. Board issue. Selling strictly as-is for parts only. No warranty or return.',
        condition: 'For parts or not working',
        currency: 'INR',
        timestamp: Date.now()
      },
      {
        id: 'mock-flipkart-3',
        title: 'Apple iPhone 15 (Blue, 128 GB)',
        price: 52999,
        shippingPrice: 40,
        marketPriceEstimate: 70990,
        url: 'https://www.flipkart.com/apple-iphone-15-blue-128-gb/p/itm2b',
        imageUrl: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&q=80&w=400',
        source: 'flipkart',
        description: 'Superb discount on Apple iPhone 15 Blue 128GB on Flipkart deal of the day. A16 Bionic chip, 48MP main camera, USB-C compatibility.',
        condition: 'New',
        currency: 'INR',
        timestamp: Date.now()
      }
    ];

    // Filter by keywords if specified
    if (keywords.length > 0) {
      return mockDeals.filter(deal => 
        keywords.some(kw => 
          deal.title.toLowerCase().includes(kw.toLowerCase()) || 
          (deal.description && deal.description.toLowerCase().includes(kw.toLowerCase()))
        )
      );
    }

    return mockDeals;
  }
}
