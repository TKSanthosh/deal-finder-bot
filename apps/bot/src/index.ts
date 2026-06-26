import * as dotenv from 'dotenv';
import * as path from 'path';
import { DealItem, Scraper } from './types';
import { MockScraper } from './scrapers/mock';
import { EbayScraper } from './scrapers/ebay';
import { SlickdealsScraper } from './scrapers/slickdeals';
import { TelegramScraper } from './scrapers/telegram';
import { DealEvaluator } from './evaluator';
import { DealNotifier } from './notifier';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const KEYWORDS = [
  'playstation', 'ps5', 'xbox', 'nintendo', 'switch', 'steam deck',
  'iphone', 'ipad', 'macbook', 'airpods',
  'oneplus', 'samsung galaxy', 'pixel', 'realme', 'redmi',
  'laptop', 'rtx', 'gpu', 'monitor', 'ssd', 'smartwatch', 'earbuds'
];

class DealFinderApp {
  private scrapers: Scraper[] = [];
  private evaluator = new DealEvaluator();
  private notifier = new DealNotifier();
  private notifiedDeals = new Set<string>();
  private intervalMs = parseInt(process.env.SCRAPE_INTERVAL_MS || '300000', 10);
  private isRunning = false;

  constructor() {
    const mockMode = process.env.MOCK_MODE !== 'false';
    
    if (mockMode) {
      console.log('[App] Booting in MOCK MODE (using mock listings feed).');
      this.scrapers.push(new MockScraper());
    } else {
      console.log('[App] Booting in LIVE MODE (Scraping live Telegram Curation channels).');
      // We use TelegramScraper as our primary cloud-safe scraper for Indian deals
      this.scrapers.push(new TelegramScraper());
      this.scrapers.push(new SlickdealsScraper());
      this.scrapers.push(new EbayScraper());
    }
  }

  async runOnce(): Promise<void> {
    console.log(`\n[${new Date().toLocaleTimeString()}] Starting scrape cycle...`);
    
    for (const scraper of this.scrapers) {
      try {
        console.log(`[App] Running scraper: ${scraper.name}`);
        const items = await scraper.scrape(KEYWORDS);
        console.log(`[App] Found ${items.length} raw items from ${scraper.name}`);

        for (const item of items) {
          if (this.notifiedDeals.has(item.id)) continue;

          console.log(`[App] Evaluating item: "${item.title}"`);
          const evaluation = await this.evaluator.evaluate(item);

          if (evaluation.isDeal) {
            console.log(`[App] Profit opportunity found! Title: "${item.title}" | Profit: +${item.currency === 'INR' ? '₹' : '$'}${evaluation.estimatedProfit.toFixed(2)}`);
            await this.notifier.notify(item, evaluation);
            this.notifiedDeals.add(item.id);
          } else {
            console.log(`[App] Filtered out: ${evaluation.reasoning}`);
          }
        }
      } catch (error: any) {
        console.error(`[App] Error executing scraper ${scraper.name}:`, error.message);
      }
    }
    console.log(`[App] Scrape cycle complete. Processed deals count: ${this.notifiedDeals.size}`);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('='.repeat(50));
    console.log('🚀 India Market Deal Finder & Arbitrage Engine Started');
    console.log(`Scan Interval: ${this.intervalMs / 1000}s`);
    console.log(`Keywords: ${KEYWORDS.join(', ')}`);
    console.log('='.repeat(50));

    await this.runOnce();

    setInterval(async () => {
      await this.runOnce();
    }, this.intervalMs);
  }
}

// Start the application
const app = new DealFinderApp();
app.start();
