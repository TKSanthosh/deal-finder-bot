import './globals.css';
import React from 'react';

export const metadata = {
  title: 'FlipRadar AI - Premium Arbitrage & Deal Alert Club',
  description: 'Automated deal finder scraping eBay, Amazon, and Slickdeals, using Gemini AI to verify high-margin reselling opportunities in real-time.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="glow-bg glow-top-left"></div>
        <div className="glow-bg glow-bottom-right"></div>
        {children}
      </body>
    </html>
  );
}
