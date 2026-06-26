export interface DealItem {
  id: string;
  title: string;
  price: number;
  shippingPrice?: number;
  marketPriceEstimate: number; // Typical value for comparison
  url: string;
  imageUrl?: string;
  source: 'ebay' | 'slickdeals' | 'amazon_in' | 'flipkart' | 'mock';
  description?: string;
  condition?: string;
  currency?: 'USD' | 'INR'; // Support international pricing currencies
  timestamp: number;
}

export interface EvaluationResult {
  isDeal: boolean;
  reasoning: string;
  estimatedResaleValue: number;
  estimatedProfit: number;
  confidenceScore: number; // 0 to 100
  safetyScore: number;      // 0 to 100 (scam/damage flag)
}

export interface Scraper {
  name: string;
  scrape(keywords: string[]): Promise<DealItem[]>;
}
