export class AffiliateLinkGenerator {
  private ebayCampaignId = process.env.EBAY_CAMPAIGN_ID || '5339000000';
  private amazonTag = process.env.AMAZON_TAG || 'dealfinder-20';
  private amazonInTag = process.env.AMAZON_IN_TAG || 'dealfinderin-21';
  private flipkartAffid = process.env.FLIPKART_AFFID || 'mockaffid';

  /**
   * Translates raw product URLs into tracking affiliate links
   */
  generate(url: string, source: string): string {
    if (!url) return url;

    try {
      if (source === 'ebay' || url.includes('ebay.com')) {
        return this.buildEbayAffiliateLink(url);
      }

      if (url.includes('amazon.in')) {
        return this.buildAmazonInAffiliateLink(url);
      }

      if (url.includes('amazon.com')) {
        return this.buildAmazonAffiliateLink(url);
      }

      if (source === 'flipkart' || url.includes('flipkart.com')) {
        return this.buildFlipkartAffiliateLink(url);
      }

      return url;
    } catch (error) {
      console.error('[Affiliate] Error generating link:', error);
      return url;
    }
  }

  private buildEbayAffiliateLink(rawUrl: string): string {
    const cleanUrl = rawUrl.split('?')[0];
    const base = 'https://rover.ebay.com/rover/1/711-53200-19255-0/1';
    const params = new URLSearchParams({
      mpre: cleanUrl,
      campid: this.ebayCampaignId,
      toolid: '10001',
      customid: 'pinterest-deal-bot'
    });
    return `${base}?${params.toString()}`;
  }

  private buildAmazonAffiliateLink(rawUrl: string): string {
    const asinMatch = rawUrl.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})/i);
    const asin = asinMatch ? (asinMatch[1] || asinMatch[2]) : null;
    if (!asin) return rawUrl;
    return `https://www.amazon.com/dp/${asin}/?tag=${this.amazonTag}`;
  }

  private buildAmazonInAffiliateLink(rawUrl: string): string {
    // Amazon India uses standard ASIN structure but localized tag (-21 suffix)
    const asinMatch = rawUrl.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})/i);
    const asin = asinMatch ? (asinMatch[1] || asinMatch[2]) : null;
    if (!asin) return rawUrl;
    return `https://www.amazon.in/dp/${asin}/?tag=${this.amazonInTag}`;
  }

  private buildFlipkartAffiliateLink(rawUrl: string): string {
    // Strip existing URL parameters for clean tracking
    const cleanUrl = rawUrl.split('?')[0];
    
    // Flipkart Affiliate API redirect wrapper
    const base = 'https://dl.flipkart.com/dl/associate/open';
    const params = new URLSearchParams({
      affid: this.flipkartAffid,
      url: cleanUrl
    });
    return `${base}?${params.toString()}`;
  }
}
