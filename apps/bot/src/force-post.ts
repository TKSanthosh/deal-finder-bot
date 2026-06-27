import * as dotenv from 'dotenv';
import * as path from 'path';
import { DealNotifier } from './notifier';
import { DealItem } from './types';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

async function main() {
  console.log('🚀 Force-posting a real active product with B2C layout...');
  
  const notifier = new DealNotifier();
  
  const item: DealItem = {
    id: `force-amzn-test-twitter-${Date.now()}`,
    title: "Carlton London Men's Casual Slip-On Clogs",
    price: 660,
    shippingPrice: 0,
    marketPriceEstimate: 1899,
    url: 'https://www.amazon.in/dp/B0DCC6YM6R/', // Real active product
    imageUrl: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&q=80&w=400', // Real photo of footwear
    source: 'amazon_in',
    description: "Carlton London Men's Casual Slip-On Clogs.",
    condition: 'New',
    currency: 'INR',
    timestamp: Date.now()
  };

  const evaluation = {
    isDeal: true,
    reasoning: 'Step into premium comfort with these Carlton London slip-on clogs. Lightweight, breathable, and water-friendly design makes them perfect for daily wear at a massive 65% discount!',
    estimatedResaleValue: 1899,
    estimatedProfit: 1239,
    confidenceScore: 100,
    safetyScore: 100
  };

  console.log('[ForcePost] Sending to chat:', process.env.TELEGRAM_CHAT_ID);
  await notifier.notify(item, evaluation);
  console.log('✅ Successfully posted to your Telegram channel!');
}

main().catch(console.error);
