export class AffiliateLinkGenerator {
  private ebayCampaignId = process.env.EBAY_CAMPAIGN_ID || '5339000000';
  private amazonTag = process.env.AMAZON_TAG || 'dealfinder-20';
  private amazonInTag = process.env.AMAZON_IN_TAG || 'dealfinderin-21';
  private flipkartAffid = process.env.FLIPKART_AFFID || 'mockaffid';

  /**
   * Translates raw product URLs into tracking affiliate links.
   * IMPORTANT: Always preserves the original product URL to prevent wrong redirects.
   */
  generate(url: string, source: string): string {
    if (!url) return url;

    try {
      if (source === 'ebay' || url.includes('ebay.com')) {
        return this.buildEbayAffiliateLink(url);
      }

      if (url.includes('amazon.in') || url.includes('amzn.to') || url.includes('amzn.in')) {
        return this.buildAmazonInAffiliateLink(url);
      }

      if (url.includes('amazon.com')) {
        return this.buildAmazonAffiliateLink(url);
      }

      if (source === 'flipkart' || url.includes('flipkart.com') || url.includes('fkrt.it')) {
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
    return this.appendAmazonTag(rawUrl, this.amazonTag);
  }

  private buildAmazonInAffiliateLink(rawUrl: string): string {
    return this.appendAmazonTag(rawUrl, this.amazonInTag);
  }

  /**
   * Appends affiliate tag to Amazon URL while preserving the original product link.
   * Handles all URL formats: /dp/ASIN, /gp/product/ASIN, short URLs, etc.
   */
  private appendAmazonTag(rawUrl: string, tag: string): string {
    try {
      const urlObj = new URL(rawUrl);
      // Remove any existing affiliate tag
      urlObj.searchParams.delete('tag');
      // Append our affiliate tag
      urlObj.searchParams.set('tag', tag);
      return urlObj.toString();
    } catch {
      // If URL parsing fails (e.g. malformed URL), append tag as simple string
      const separator = rawUrl.includes('?') ? '&' : '?';
      return `${rawUrl}${separator}tag=${tag}`;
    }
  }

  private buildFlipkartAffiliateLink(rawUrl: string): string {
    if (this.flipkartAffid === 'mockaffid') {
      // No real affiliate ID configured, return original URL
      return rawUrl;
    }

    // Flipkart Affiliate API redirect wrapper — preserve full URL including query params
    const base = 'https://dl.flipkart.com/dl/associate/open';
    const params = new URLSearchParams({
      affid: this.flipkartAffid,
      url: rawUrl   // Keep full URL with all query params intact
    });
    return `${base}?${params.toString()}`;
  }
}
