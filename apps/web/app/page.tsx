'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Zap, Bell, Check, ArrowRight, Loader2, Sparkles, ExternalLink, RefreshCw } from 'lucide-react';

export default function Home() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(true);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);

  useEffect(() => {
    // Fetch live deals from raw GitHub master feed
    const fetchDeals = async () => {
      try {
        setLoadingDeals(true);
        const res = await fetch('https://raw.githubusercontent.com/TKSanthosh001/deal-finder-bot/master/apps/web/public/deals.json');
        if (res.ok) {
          const data = await res.json();
          setDeals(data);
        }
      } catch (err) {
        console.error('Failed to fetch deals feed:', err);
      } finally {
        setLoadingDeals(false);
      }
    };

    fetchDeals();
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStripeLoading(true);
    setTimeout(() => {
      setStripeLoading(false);
      setSubscribed(true);
    }, 1500);
  };

  return (
    <div className="container">
      {/* Dynamic Ambient Background Glows */}
      <div className="glow-bg glow-top-left"></div>
      <div className="glow-bg glow-bottom-right"></div>

      {/* Floating Telegram Urgency Banner */}
      <div 
        style={{
          background: 'linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%)',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '12px',
          marginTop: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)',
          zIndex: 100,
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#ef4444', borderRadius: '50%', animation: 'pulse 1.5s infinite' }}></span>
          <span style={{ fontSize: '14px', fontWeight: '500' }}>
            🔥 <b>Limited Time Offers:</b> Prices on these items go up in minutes. Join our Telegram for instant alerts!
          </span>
        </div>
        <a 
          href="https://t.me/dealradarindia2002" 
          target="_blank" 
          rel="noopener noreferrer"
          className="btn-primary"
          style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', boxShadow: 'none' }}
        >
          Join Deals Radar India <ArrowRight size={14} />
        </a>
      </div>

      {/* Navigation */}
      <nav className="navbar">
        <a href="#" className="logo">
          <Zap size={28} /> DealsRadar<span>.AI</span>
        </a>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <button 
            onClick={() => {
              const el = document.getElementById('live-feed-section');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="btn-secondary"
            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px' }}
          >
            Live Deals
          </button>
          <a 
            href="https://t.me/dealradarindia2002" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn-primary" 
            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', textDecoration: 'none' }}
          >
            Get Free Access
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero" style={{ padding: '80px 0 50px' }}>
        <h1 style={{ fontSize: '56px' }}>
          Never Miss a Price Drop on <br />
          <span className="text-gradient">Tech & Electronics in India</span>
        </h1>
        <p style={{ maxWidth: '750px' }}>
          Our AI scraper monitors Amazon India and Flipkart 24/7, finds massive price drops, verifies listings, and broadcasts them immediately with affiliate discounts.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a 
            href="https://t.me/dealradarindia2002" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ textDecoration: 'none', padding: '16px 32px', fontSize: '16px' }}
          >
            ⚡ Join Telegram Channel (Free) <ArrowRight size={18} />
          </a>
          <button 
            onClick={() => {
              const el = document.getElementById('live-feed-section');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="btn-secondary"
            style={{ padding: '16px 32px', fontSize: '16px' }}
          >
            View Live Deals Feed
          </button>
        </div>
      </section>

      {/* Live Deals Section */}
      <section id="live-feed-section" style={{ padding: '60px 0 100px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid var(--card-border)', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '50%', animation: 'pulse 1.5s infinite' }}></span>
            <h2 style={{ fontSize: '32px', margin: 0 }}>Live Deals Feed</h2>
          </div>
          <button 
            onClick={async () => {
              try {
                setLoadingDeals(true);
                const res = await fetch('https://raw.githubusercontent.com/TKSanthosh001/deal-finder-bot/master/apps/web/public/deals.json?t=' + Date.now());
                if (res.ok) {
                  const data = await res.json();
                  setDeals(data);
                }
              } catch (e) {
                console.error(e);
              } finally {
                setLoadingDeals(false);
              }
            }}
            className="btn-secondary"
            style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loadingDeals ? 'animate-spin' : ''} /> Refresh Feed
          </button>
        </div>

        {loadingDeals ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0', gap: '8px', alignItems: 'center' }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Loading latest deals...</span>
          </div>
        ) : deals.length === 0 ? (
          <div className="glass card" style={{ textAlign: 'center', padding: '60px 40px' }}>
            <Sparkles size={36} style={{ color: 'var(--text-secondary)', marginBottom: '16px', opacity: 0.5 }} />
            <h3>No Active Deals in Feed</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
              We are currently scanning the marketplaces. Deals will appear here as soon as price drops are detected!
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '30px' }}>
            {deals.map((deal) => {
              const symbol = '₹';
              return (
                <div key={deal.id} className="glass" style={{ borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--card-border)', transition: 'transform 0.3s ease' }}>
                  {/* Image & Badges */}
                  <div style={{ position: 'relative', width: '100%', height: '220px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    {deal.imageUrl ? (
                      <img 
                        src={deal.imageUrl} 
                        alt={deal.title} 
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#6b7280' }}>
                        <Zap size={32} />
                        <span style={{ fontSize: '12px' }}>No Product Image</span>
                      </div>
                    )}
                    {/* Discount Badge */}
                    <div style={{ position: 'absolute', top: '12px', left: '12px', backgroundColor: '#ef4444', color: '#fff', fontSize: '13px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '20px', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)' }}>
                      Save {deal.savingsPercent}%
                    </div>
                    {/* Source Platform Badge */}
                    <div style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: deal.source === 'amazon_in' ? '#232f3e' : '#2874f0', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '6px' }}>
                      {deal.source === 'amazon_in' ? 'Amazon IN' : 'Flipkart'}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', flexGrow: 1, backgroundColor: 'rgba(255, 255, 255, 0.01)' }}>
                    <h4 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '12px', color: '#fff', lineHeight: '1.4', height: '48px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {deal.title}
                    </h4>

                    {/* Pricing Grid */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981' }}>
                        {symbol}{deal.price.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '15px', color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
                        {symbol}{deal.marketPriceEstimate.toLocaleString('en-IN')}
                      </div>
                    </div>

                    {/* AI Curation reasoning */}
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)', marginBottom: '20px', flexGrow: 1 }}>
                      <p style={{ fontStyle: 'italic' }}>{deal.description}</p>
                    </div>

                    {/* Action Button */}
                    <a 
                      href={deal.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn-primary" 
                      style={{ width: '100%', textDecoration: 'none', padding: '12px 0', fontSize: '14px', borderRadius: '10px' }}
                    >
                      Buy on {deal.source === 'amazon_in' ? 'Amazon' : 'Flipkart'} <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Monetization / Pro Pricing Section */}
      <section id="pricing-section" className="pricing" style={{ borderTop: '1px solid var(--card-border)', paddingTop: '100px' }}>
        <h2 className="pricing-title">Get Alerts Instantly in Your Inbox</h2>
        <p className="pricing-subtitle">Optionally subscribe to our premium email notification sandbox list.</p>
        
        <div className="glass pricing-card">
          <div className="pricing-header">
            <h3>Premium Alerts Club</h3>
            <p>For power users and shoppers looking to get priority push notifications.</p>
          </div>
          <div className="price">
            ₹249<span>/month</span>
          </div>
          
          <ul className="features-list">
            <li><Check size={16} /> 1-second Telegram notification push</li>
            <li><Check size={16} /> Premium Email Alerts</li>
            <li><Check size={16} /> AI-curated deal confidence reports</li>
            <li><Check size={16} /> Exclusive coupons and card offers</li>
          </ul>

          {subscribed ? (
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>
              ✓ Subscribed Successfully (Sandbox Mode)
            </div>
          ) : (
            <form onSubmit={handleSubscribe} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                type="email" 
                placeholder="Enter your email to test" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '12px',
                  padding: '14px',
                  color: '#fff',
                  outline: 'none',
                  fontSize: '14px',
                  fontFamily: 'inherit'
                }}
              />
              <button type="submit" className="btn-primary" disabled={stripeLoading} style={{ width: '100%' }}>
                {stripeLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} /> Connecting...
                  </>
                ) : (
                  'Subscribe (Sandbox Checkout)'
                )}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--card-border)', padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
        <p>© 2026 DealsRadar AI. All rights reserved. Built as an automated growth funnel for Deals Radar India.</p>
      </footer>

      {/* CSS Keyframes for Pulsing animation */}
      <style jsx global>{`
        @keyframes pulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
            opacity: 0.8;
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
            opacity: 1;
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}
