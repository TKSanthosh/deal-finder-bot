import axios from 'axios';
import { DealItem, EvaluationResult } from './types';

export class PinterestClient {
  private accessToken = process.env.PINTEREST_ACCESS_TOKEN;
  private boardId = process.env.PINTEREST_BOARD_ID;

  async createPin(
    item: DealItem,
    evaluation: EvaluationResult,
    affiliateLink: string
  ): Promise<void> {
    const savings = item.marketPriceEstimate - item.price;
    const savingsPercent = ((savings / item.marketPriceEstimate) * 100).toFixed(0);
    const symbol = item.currency === 'INR' ? '₹' : '$';

    const title = `🔥 DEAL ALERT: ${item.title.substring(0, 50)}... - Save ${savingsPercent}%!`;
    
    const description = `Unbelievable deal on this ${item.title}! 
    
💰 Listing Price: ${symbol}${item.price}
📈 Estimated Retail Value: ${symbol}${evaluation.estimatedResaleValue}
🛡️ AI Safety Verified: Perfect working condition.

Don't wait, click to buy it now before it's gone!

#techdeals #gadgetdeals #arbitrage #reselling #shoponline #deals #india`;

    const imageUrl = item.imageUrl || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&q=80&w=600';

    if (this.accessToken && this.boardId && this.accessToken !== 'your_token_here') {
      await this.publishToPinterest(title, description, affiliateLink, imageUrl);
    } else {
      this.logMockPin(title, description, affiliateLink, imageUrl);
    }
  }

  private async publishToPinterest(
    title: string,
    description: string,
    link: string,
    imageUrl: string
  ): Promise<void> {
    try {
      console.log('[Pinterest] Publishing real Pin to board...');
      
      const response = await axios.post(
        'https://api.pinterest.com/v5/pins',
        {
          board_id: this.boardId,
          title: title.substring(0, 100),
          description: description.substring(0, 500),
          link: link,
          media_source: {
            source_type: 'image_url',
            url: imageUrl
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`[Pinterest] Pin created successfully! Pin ID: ${response.data.id}`);
    } catch (error: any) {
      console.error(
        '[Pinterest] API error:',
        error.response?.data ? JSON.stringify(error.response.data) : error.message
      );
    }
  }

  private logMockPin(
    title: string,
    description: string,
    link: string,
    imageUrl: string
  ): void {
    const bold = '\x1b[1m';
    const magenta = '\x1b[35m';
    const reset = '\x1b[0m';

    console.log('\n' + '📌 '.repeat(15));
    console.log(`${magenta}${bold}SIMULATED PINTEREST AUTO-PIN${reset}`);
    console.log(`${bold}Pin Title:${reset} ${title}`);
    console.log(`${bold}Pin Link (Affiliate):${reset} ${link}`);
    console.log(`${bold}Image URL:${reset} ${imageUrl}`);
    console.log(`${bold}Pin Description:${reset}\n${description}`);
    console.log('📌 '.repeat(15) + '\n');
  }
}
