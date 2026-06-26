import * as dotenv from 'dotenv';
import * as path from 'path';
import { DealItem, Scraper } from './types';
import { MockScraper } from './scrapers/mock';
import { EbayScraper } from './scrapers/ebay';
import { SlickdealsScraper } from './scrapers/slickdeals';
import { AmazonInScraper } from './scrapers/amazon_in';
import { FlipkartScraper } from './scrapers/flipkart';
import { DealEvaluator } from './evaluator';
import { DealNotifier } from './notifier';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const KEYWORDS = ['playstation 5', 'ps5 slim', 'iphone 15 pro', 'oneplus 12', 'rtx 4060', 'steam deck', 'nintendo switch'];

async function run() {
  console.log('🚀 Starting Single Scrape Cycle...');
  const scrapers: Scraper[] = [];
  const mockMode = process.env.MOCK_MODE === 'true'; // Default to false in cloud actions unless forced

  if (mockMode) {
    console.log('[RunOnce] Mock Mode Active.');
    scrapers.push(new MockScraper());
  } else {
    console.log('[RunOnce] Live Mode Active. Initializing Scrapers.');
    scrapers.push(new AmazonInScraper());
    scrapers.push(new FlipkartScraper());
    scrapers.push(new EbayScraper());
    scrapers.push(new SlickdealsScraper());
  }

  const evaluator = new DealEvaluator();
  const notifier = new DealNotifier();

  for (const scraper of scrapers) {
    try {
      console.log(`[RunOnce] Executing: ${scraper.name}`);
      const items = await scraper.scrape(KEYWORDS);
      console.log(`[RunOnce] Found ${items.length} items.`);

      for (const item of items) {
        console.log(`[RunOnce] Evaluating: "${item.title}"`);
        const evaluation = await evaluator.evaluate(item);

        if (evaluation.isDeal) {
          console.log(`[RunOnce] Profitable deal found: +${item.currency === 'INR' ? '₹' : '$'}${evaluation.estimatedProfit.toFixed(2)}`);
          await notifier.notify(item, evaluation);
        } else {
          console.log(`[RunOnce] Skipped: ${evaluation.reasoning}`);
        }
      }
    } catch (error: any) {
      console.error(`[RunOnce] Error running scraper ${scraper.name}:`, error.message);
    }
  }

  console.log('✅ Single Scrape Cycle Complete. Exiting.');
  process.exit(0);
}

run();
