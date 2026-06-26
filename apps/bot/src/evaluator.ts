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
    const totalCost = item.price + (item.shippingPrice || 0);
    const potentialMargin = item.marketPriceEstimate - totalCost;

    // Minimum profit threshold (₹1,000 for INR, $15 for USD)
    const minProfitThreshold = item.currency === 'INR' ? 1000 : 15;

    // Phase 1: Basic Arbitrage Heuristic Check
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

    // Phase 2: AI Verification (or Heuristic Fallback)
    if (this.ai) {
      return this.evaluateWithAI(item, totalCost);
    } else {
      return this.evaluateWithHeuristics(item, totalCost);
    }
  }

  private async evaluateWithAI(item: DealItem, totalCost: number): Promise<EvaluationResult> {
    try {
      const model = this.ai!.getGenerativeModel({ model: 'gemini-1.5-flash' });
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
2. Estimate the actual resale value in ${currencyLabel} based on typical current second-hand pricing for this item in this condition in India/US.
3. Calculate if purchasing at ${currencySymbol}${totalCost} provides at least a 20% profit margin after resale.

Response Format:
You must output a JSON object matching this schema. Do NOT include markdown code block formatting (like \`\`\`json). Output raw text JSON only.
{
  "isDeal": boolean, // true only if true resale value is higher than cost and has low risk
  "reasoning": "string (1-2 sentences summarizing profit potential or warning)",
  "estimatedResaleValue": number, // true market value in current state in the target currency
  "confidenceScore": number, // 0-100 (rating of your valuation confidence)
  "safetyScore": number // 0-100 (score safety. Deduct points for lock status, damage, parts only. Below 60 is unsafe)
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

    // Check common red flags
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
