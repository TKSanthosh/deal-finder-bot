import { GoogleGenerativeAI } from '@google/generative-ai';
import { DealItem, EvaluationResult } from './types';

export class DealEvaluator {
  private ai: GoogleGenerativeAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      this.ai = new GoogleGenerativeAI(apiKey);
    } else {
      console.warn('[Evaluator] GEMINI_API_KEY not set. Running in Heuristic Fallback Mode.');
    }
  }

  async evaluate(item: DealItem): Promise<EvaluationResult> {
    // If this is a raw Telegram post, we first need to parse it using Gemini
    if (item.price === 0 && item.description) {
      if (this.ai) {
        return this.parseAndEvaluateTelegramWithAI(item);
      } else {
        return this.parseTelegramWithHeuristics(item);
      }
    }

    // Standard evaluation for pre-parsed mock/ebay items
    const totalCost = item.price + (item.shippingPrice || 0);
    const potentialMargin = item.marketPriceEstimate - totalCost;
    const minProfitThreshold = item.currency === 'INR' ? 1000 : 15;

    if (potentialMargin <= minProfitThreshold || totalCost >= item.marketPriceEstimate) {
      return {
        isDeal: false,
        reasoning: `Math checks out negative. Total cost is close to or above estimated market value.`,
        estimatedResaleValue: item.marketPriceEstimate,
        estimatedProfit: potentialMargin,
        confidenceScore: 90,
        safetyScore: 100
      };
    }

    if (this.ai) {
      return this.evaluateWithAI(item, totalCost);
    } else {
      return this.evaluateWithHeuristics(item, totalCost);
    }
  }

  private async parseAndEvaluateTelegramWithAI(item: DealItem): Promise<EvaluationResult> {
    try {
      const model = this.ai!.getGenerativeModel({ model: 'gemini-2.0-flash' });
      
      const prompt = `You are an expert shopping deal aggregator and consumer copywriter.
Analyze this social media post sharing a shopping offer and extract the underlying deal details.

Post Content:
"${item.description}"

You must return a raw JSON object (no markdown formatting, no \`\`\`json) matching this schema:
{
  "productTitle": "string (Clean product name without emojis or promotional buzzwords, e.g. 'OnePlus 12 Flowy Emerald')",
  "price": number (The actual deal purchase price in INR, e.g. 52999. If a range is given, use the lowest applicable price),
  "marketPriceEstimate": number (The typical normal retail price or MSRP of this item in India. If not specified, estimate a realistic market value),
  "isDeal": boolean (true if the deal price offers a significant discount of at least 20% compared to typical retail price),
  "reasoning": "string (A highly attractive, high-converting product description written for end customers. It must highlight 2-3 key features with emojis, specify who it is perfect for, and create urgency. Use simple unicode bullet points like '•' or emoji bullet points like '✨'. You can use standard HTML tags like <b>bold</b> and <i>italic</i> for formatting if needed, but do NOT use Markdown asterisk symbols. Keep it concise but extremely persuasive to drive immediate impulse buys)",
  "safetyScore": number // 0-100 (Deduct points if the post indicates the item is used, refurbished, damaged, box-only, or a suspicious clone. New items from Amazon/Flipkart should be 100)
}
`;

      const response = await model.generateContent(prompt);
      const text = response.response.text().trim();
      
      const jsonStr = text.replace(/^```json/i, '').replace(/```$/, '').trim();
      const result = JSON.parse(jsonStr);

      // Update the deal item details with parsed values
      item.title = result.productTitle;
      item.price = result.price;
      item.marketPriceEstimate = result.marketPriceEstimate;

      const totalCost = item.price + (item.shippingPrice || 0);
      const estimatedProfit = item.marketPriceEstimate - totalCost;

      return {
        isDeal: result.isDeal && result.safetyScore >= 70 && estimatedProfit > 100,
        reasoning: result.reasoning,
        estimatedResaleValue: item.marketPriceEstimate,
        estimatedProfit,
        confidenceScore: 85,
        safetyScore: result.safetyScore
      };

    } catch (error: any) {
      console.error(`[Evaluator] Error parsing Telegram post with Gemini: ${error.message}`);
      return this.parseTelegramWithHeuristics(item);
    }
  }

  private parseTelegramWithHeuristics(item: DealItem): EvaluationResult {
    // Simple regex fallback to extract prices from text (e.g. "Rs. 36990" or "at 36,990")
    const text = item.description || '';
    const prices = text.replace(/,/g, '').match(/\b\d{4,5}\b/g);
    
    let price = 0;
    if (prices && prices.length > 0) {
      price = Math.min(...prices.map(p => parseInt(p, 10)));
    }

    if (price > 0) {
      item.title = item.description?.split('\n')[0].substring(0, 60) || 'Telegram Deal Product';
      item.price = price;
      item.marketPriceEstimate = price * 1.3; // assume retail is 30% higher
      
      const totalCost = item.price;
      const estimatedProfit = item.marketPriceEstimate - totalCost;

      return {
        isDeal: true, // Always post deals from curated Telegram channels when we can parse a price
        reasoning: 'Parsed price from text using basic heuristics. Looks profitable.',
        estimatedResaleValue: item.marketPriceEstimate,
        estimatedProfit,
        confidenceScore: 50,
        safetyScore: 80
      };
    }

    return {
      isDeal: false,
      reasoning: 'Could not extract valid deal pricing from Telegram post using heuristics.',
      estimatedResaleValue: 0,
      estimatedProfit: 0,
      confidenceScore: 90,
      safetyScore: 100
    };
  }

  private async evaluateWithAI(item: DealItem, totalCost: number): Promise<EvaluationResult> {
    try {
      const model = this.ai!.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const currencySymbol = item.currency === 'INR' ? '₹' : '$';
      const currencyLabel = item.currency === 'INR' ? 'INR (Indian Rupees)' : 'USD (US Dollars)';
      
      const prompt = `You are an expert e-commerce arbitrage and product flipping assistant.
Analyze the following item listing and evaluate if it represents a highly profitable buy-and-resell opportunity (arbitrage).

Listing Info:
- Title: "${item.title}"
- Platform: ${item.source}
- Listed Price: ${currencySymbol}${item.price}
- Shipping: ${currencySymbol}${item.shippingPrice || 0}
- Currency Context: ${currencyLabel}
- Condition: ${item.condition || 'Not Specified'}
- Description: "${item.description || 'No description provided'}"
- Suggested Market Value (MSRP/Typical Resale): ${currencySymbol}${item.marketPriceEstimate}

Evaluate the text carefully:
1. Detect scams or red flags: "FOR PARTS ONLY", "parts only", "cracked", "shattered", "icloud locked", "bad imei/esn", "box only", "accessory only", "as-is", "untested", "water damaged".
2. Estimate the actual resale value in ${currencyLabel} based on typical current second-hand pricing for this item in this state.
3. Calculate if purchasing at ${currencySymbol}${totalCost} provides at least a 20% profit margin after resale.

Response Format:
You must output a JSON object matching this schema. Do NOT include markdown code block formatting. Output raw text JSON only.
{
  "isDeal": boolean,
  "reasoning": "string",
  "estimatedResaleValue": number,
  "confidenceScore": number,
  "safetyScore": number
}
`;

      const response = await model.generateContent(prompt);
      const text = response.response.text().trim();
      const jsonStr = text.replace(/^```json/i, '').replace(/```$/, '').trim();
      const aiResult = JSON.parse(jsonStr);

      const estimatedProfit = aiResult.estimatedResaleValue - totalCost;
      const minProfit = item.currency === 'INR' ? 1000 : 15;

      return {
        isDeal: aiResult.isDeal && aiResult.safetyScore >= 65 && estimatedProfit > minProfit,
        reasoning: aiResult.reasoning,
        estimatedResaleValue: aiResult.estimatedResaleValue,
        estimatedProfit,
        confidenceScore: aiResult.confidenceScore,
        safetyScore: aiResult.safetyScore
      };
    } catch (error: any) {
      console.error(`[Evaluator] Gemini API error: ${error.message}. Falling back to heuristics.`);
      return this.evaluateWithHeuristics(item, totalCost);
    }
  }

  private evaluateWithHeuristics(item: DealItem, totalCost: number): EvaluationResult {
    const titleLower = item.title.toLowerCase();
    const descLower = (item.description || '').toLowerCase();
    const conditionLower = (item.condition || '').toLowerCase();

    let safetyScore = 100;
    let reasoning = 'Matches positive arbitrage math. Condition looks good.';

    const redFlags = ['parts only', 'parts', 'cracked', 'shattered', 'icloud', 'locked', 'bad imei', 'box only', 'read desc', 'broken', 'water damage', 'damaged'];
    for (const flag of redFlags) {
      if (titleLower.includes(flag) || descLower.includes(flag) || conditionLower.includes(flag)) {
        safetyScore = 30;
        reasoning = `Warning: Detected red flag keyword "${flag}" indicating damaged or locked item.`;
        break;
      }
    }

    const estimatedResaleValue = item.marketPriceEstimate;
    const estimatedProfit = estimatedResaleValue - totalCost;
    
    const minProfit = item.currency === 'INR' ? 1500 : 20;
    const isDeal = safetyScore >= 70 && estimatedProfit > minProfit;

    return {
      isDeal,
      reasoning,
      estimatedResaleValue,
      estimatedProfit,
      confidenceScore: 70,
      safetyScore
    };
  }
}
