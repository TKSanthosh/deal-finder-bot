import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { DealItem, Scraper } from './types';
import { TelegramScraper } from './scrapers/telegram';
import { DealEvaluator } from './evaluator';
import { DealNotifier } from './notifier';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

// No keyword filtering — the Telegram source channels are already curated deal channels.
// The AI evaluator decides what's a good deal.
const KEYWORDS: string[] = [];

/**
 * Load previously posted deal IDs from deals.json to prevent duplicate notifications.
 */
function loadPostedDealIds(): Set<string> {
  const feedPath = path.join(__dirname, '../../web/public/deals.json');
  const ids = new Set<string>();

  try {
    if (fs.existsSync(feedPath)) {
      const content = fs.readFileSync(feedPath, 'utf8');
      const deals = JSON.parse(content);
      if (Array.isArray(deals)) {
        for (const deal of deals) {
          if (deal.id) ids.add(deal.id);
        }
      }
    }
  } catch (e) {
    console.log('[RunOnce] Could not load existing deals for dedup, starting fresh.');
  }

  console.log(`[RunOnce] Loaded ${ids.size} previously posted deal IDs for deduplication.`);
  return ids;
}

async function run() {
  console.log('🚀 Starting Single Scrape Cycle...');

  // Only use Telegram scraper — eBay and Slickdeals consistently return 403/0 items
  const scrapers: Scraper[] = [new TelegramScraper()];
  console.log('[RunOnce] Live Mode Active. Using Telegram Scraper only.');

  const evaluator = new DealEvaluator();
  const notifier = new DealNotifier();
  const postedIds = loadPostedDealIds();

  let dealsPosted = 0;
  let dealsSkippedDup = 0;
  let dealsSkippedEval = 0;

  for (const scraper of scrapers) {
    try {
      console.log(`[RunOnce] Executing: ${scraper.name}`);
      const items = await scraper.scrape(KEYWORDS);
      console.log(`[RunOnce] Found ${items.length} items.`);

      for (const item of items) {
        // Skip already-posted deals
        if (postedIds.has(item.id)) {
          console.log(`[RunOnce] Skipping duplicate: "${item.title}" (${item.id})`);
          dealsSkippedDup++;
          continue;
        }

        console.log(`[RunOnce] Evaluating: "${item.title}"`);
        const evaluation = await evaluator.evaluate(item);

        if (evaluation.isDeal) {
          console.log(`[RunOnce] ✅ Profitable deal found: +${item.currency === 'INR' ? '₹' : '$'}${evaluation.estimatedProfit.toFixed(2)}`);
          await notifier.notify(item, evaluation);
          postedIds.add(item.id);
          dealsPosted++;

          // Small delay between posts to avoid Telegram rate limits
          await new Promise(resolve => setTimeout(resolve, 1500));
        } else {
          console.log(`[RunOnce] ❌ Skipped: ${evaluation.reasoning}`);
          dealsSkippedEval++;
        }
      }
    } catch (error: any) {
      console.error(`[RunOnce] Error running scraper ${scraper.name}:`, error.message);
    }
  }

  console.log(`\n📊 Scrape Cycle Summary:`);
  console.log(`   ✅ Deals posted: ${dealsPosted}`);
  console.log(`   🔁 Skipped (duplicate): ${dealsSkippedDup}`);
  console.log(`   ❌ Skipped (not a deal): ${dealsSkippedEval}`);
  console.log('✅ Single Scrape Cycle Complete. Exiting.');
  process.exit(0);
}

run();
