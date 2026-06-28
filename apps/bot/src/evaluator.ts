import axios from 'axios';
import { DealItem, EvaluationResult } from './types';

export class DealEvaluator {
  private hasAi: boolean = false;
  private nvidiaKey: string | undefined;

  constructor() {
    this.nvidiaKey = process.env.NVIDIA_API_KEY;
    if (this.nvidiaKey && this.nvidiaKey.startsWith('nvapi-')) {
      this.hasAi = true;
    } else {
      console.warn('[Evaluator] NVIDIA_API_KEY not set. Running in Heuristic Fallback Mode.');
    }
  }

  async evaluate(item: DealItem): Promise<EvaluationResult> {
    // If this is a raw Telegram post, we first need to parse it using AI
    if (item.price === 0 && item.description) {
      if (this.hasAi) {
        return this.parseAndEvaluateTelegramWithAI(item);
      } else {
        return this.parseTelegramWithHeuristics(item);
      }
    }

    // Standard evaluation for pre-parsed mock/ebay items
    const totalCost = item.price + (item.shippingPrice || 0);
    const potentialMargin = item.marketPriceEstimate - totalCost;
    const minProfitThreshold = item.currency === 'INR' ? 500 : 15;

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

    if (this.hasAi) {
      return this.evaluateWithAI(item, totalCost);
    } else {
      return this.evaluateWithHeuristics(item, totalCost);
    }
  }

  private async parseAndEvaluateTelegramWithAI(item: DealItem): Promise<EvaluationResult> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
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
}`;

        const response = await axios.post('https://integrate.api.nvidia.com/v1/chat/completions', {
          model: 'meta/llama-3.1-70b-instruct',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 1024
        }, {
          headers: {
            'Authorization': `Bearer ${this.nvidiaKey}`,
            'Content-Type': 'application/json'
          }
        });

        const text = response.data.choices[0].message.content.trim();

        // Parse JSON response — handle various markdown wrappers
        const jsonStr = text.replace(/^```(?:json|JSON)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        const result = JSON.parse(jsonStr);

        // Update the deal item details with parsed values (create a copy to avoid partial mutation)
        const parsedTitle = result.productTitle || item.title;
        const parsedPrice = result.price || 0;
        const parsedMarket = result.marketPriceEstimate || parsedPrice * 1.3;

        item.title = parsedTitle;
        item.price = parsedPrice;
        item.marketPriceEstimate = parsedMarket;

        const totalCost = parsedPrice + (item.shippingPrice || 0);
        const estimatedProfit = parsedMarket - totalCost;

        return {
          isDeal: result.isDeal && result.safetyScore >= 70 && estimatedProfit > 100,
          reasoning: result.reasoning,
          estimatedResaleValue: parsedMarket,
          estimatedProfit,
          confidenceScore: 85,
          safetyScore: result.safetyScore
        };

      } catch (error: any) {
        const isRateLimit = error.response?.status === 429;
        console.error(`[Evaluator] Error parsing Telegram post with NVIDIA AI (attempt ${attempt + 1}): ${error.message}`);

        if (isRateLimit && attempt === 0) {
          console.log('[Evaluator] Rate limited. Waiting 5s before retry...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }

        // Fall back to heuristics
        return this.parseTelegramWithHeuristics(item);
      }
    }

    return this.parseTelegramWithHeuristics(item);
  }

  private parseTelegramWithHeuristics(item: DealItem): EvaluationResult {
    const text = item.description || '';

    // Smarter price extraction — look for price patterns near keywords
    const pricePatterns = [
      /(?:Rs\.?|₹|INR|Price[:\s]*|at\s+)[\s]*([0-9,]+(?:\.\d{1,2})?)/gi,
      /([0-9,]+(?:\.\d{1,2})?)\s*(?:only|rupees|rs)/gi,
    ];

    const prices: number[] = [];
    for (const pattern of pricePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const num = parseInt(match[1].replace(/,/g, ''), 10);
        // Only accept reasonable prices (₹50 to ₹5,00,000)
        if (num >= 50 && num <= 500000) {
          prices.push(num);
        }
      }
    }

    // Fallback: find any 3-6 digit numbers that could be prices
    if (prices.length === 0) {
      const fallbackPrices = text.replace(/,/g, '').match(/\b\d{3,6}\b/g);
      if (fallbackPrices) {
        for (const p of fallbackPrices) {
          const num = parseInt(p, 10);
          // Skip numbers that look like years, model numbers, or other non-prices
          if (num >= 100 && num <= 500000 && num !== 2024 && num !== 2025 && num !== 2026) {
            prices.push(num);
          }
        }
      }
    }

    if (prices.length > 0) {
      const dealPrice = Math.min(...prices);
      const mrp = prices.length > 1 ? Math.max(...prices) : dealPrice * 1.3;

      // Extract title from the post text
      const title = item.title || text.split('\n')[0].substring(0, 80) || 'Deal Product';
      item.title = title;
      item.price = dealPrice;
      item.marketPriceEstimate = mrp;

      const estimatedProfit = mrp - dealPrice;
      const savingsPercent = mrp > 0 ? Math.round((estimatedProfit / mrp) * 100) : 0;

      // Build a helpful description from the text
      const firstLine = text.split('\n')[0].substring(0, 100);
      const reasoning = `${firstLine} — Deal at ₹${dealPrice.toLocaleString('en-IN')} (Save ${savingsPercent}% off ₹${mrp.toLocaleString('en-IN')})`;

      return {
        isDeal: true, // Always post deals from curated Telegram channels when price is found
        reasoning,
        estimatedResaleValue: mrp,
        estimatedProfit,
        confidenceScore: 55,
        safetyScore: 85
      };
    }

    return {
      isDeal: false,
      reasoning: 'Could not extract valid deal pricing from Telegram post.',
      estimatedResaleValue: 0,
      estimatedProfit: 0,
      confidenceScore: 90,
      safetyScore: 100
    };
  }

  private async evaluateWithAI(item: DealItem, totalCost: number): Promise<EvaluationResult> {
    try {
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
}`;

      const response = await axios.post('https://integrate.api.nvidia.com/v1/chat/completions', {
          model: 'meta/llama-3.1-70b-instruct',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1024
      }, {
        headers: {
          'Authorization': `Bearer ${this.nvidiaKey}`,
          'Content-Type': 'application/json'
        }
      });

      const text = response.data.choices[0].message.content.trim();
      const jsonStr = text.replace(/^```(?:json|JSON)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const aiResult = JSON.parse(jsonStr);

      const estimatedProfit = aiResult.estimatedResaleValue - totalCost;
      const minProfit = item.currency === 'INR' ? 500 : 15;

      return {
        isDeal: aiResult.isDeal && aiResult.safetyScore >= 65 && estimatedProfit > minProfit,
        reasoning: aiResult.reasoning,
        estimatedResaleValue: aiResult.estimatedResaleValue,
        estimatedProfit,
        confidenceScore: aiResult.confidenceScore,
        safetyScore: aiResult.safetyScore
      };
    } catch (error: any) {
      console.error(`[Evaluator] NVIDIA API error: ${error.message}. Falling back to heuristics.`);
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

    const minProfit = item.currency === 'INR' ? 500 : 20;
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
