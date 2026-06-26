'use client';

import React, { useState } from 'react';
import { ShieldCheck, Zap, Bell, Check, ArrowRight, Play, Loader2, Sparkles } from 'lucide-react';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    // Simulate Stripe Checkout API request and Webhook provisioning
    setTimeout(() => {
      setLoading(false);
      setIsSubscribed(true);
    }, 2000);
  };

  return (
    <div className="container">
      {/* Navigation */}
      <nav className="navbar">
        <a href="#" className="logo">
          <Zap size={28} /> FlipRadar<span>.AI</span>
        </a>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {!isSubscribed && (
            <button 
              onClick={() => {
                const el = document.getElementById('pricing-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="btn-secondary"
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px' }}
            >
              Pricing
            </button>
          )}
          {isSubscribed ? (
            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', fontWeight: 'bold' }}>
              <ShieldCheck size={18} /> Premium Active
            </span>
          ) : (
            <button 
              onClick={() => {
                const el = document.getElementById('pricing-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="btn-primary" 
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px' }}
            >
              Get Access
            </button>
          )}
        </div>
      </nav>

      {/* Conditional UI: If Subscribed, show the Mock Dashboard, else show Landing Page */}
      {isSubscribed ? (
        <div className="glass card" style={{ maxWidth: '800px', margin: '60px auto', textAlign: 'center', padding: '60px 40px' }}>
          <div className="card-icon" style={{ margin: '0 auto 24px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', width: '64px', height: '64px', borderRadius: '18px' }}>
            <Sparkles size={32} />
          </div>
          <h2 className="text-gradient-success" style={{ fontSize: '36px', marginBottom: '16px' }}>Subscription Verified!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '18px', marginBottom: '32px', maxWidth: '600px', margin: '0 auto 32px' }}>
            Stripe payment confirmed for <b>{email}</b>. Your automated arbitrage feed access has been provisioned.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px', margin: '0 auto', textAlign: 'left' }}>
            <div className="glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Check size={18} style={{ color: '#10b981' }} /> Discord Integration
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
                Join our premium channel to receive instant deal alerts with calculated resale ROI and AI summaries.
              </p>
              <a href="https://discord.gg/mock-radar-deals" target="_blank" className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px', width: '100%' }}>
                Join Private Discord
              </a>
            </div>

            <div className="glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Check size={18} style={{ color: '#6366f1' }} /> Telegram Alerts
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
                Prefer push notifications on your phone? Connect our Telegram Bot directly to your account.
              </p>
              <a href="https://t.me/mock_flip_radar_bot" target="_blank" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px', width: '100%' }}>
                Open Telegram Bot
              </a>
            </div>
          </div>

          <button 
            onClick={() => setIsSubscribed(false)} 
            className="btn-secondary" 
            style={{ marginTop: '40px', fontSize: '13px', padding: '8px 16px' }}
          >
            ← Back to Landing Page
          </button>
        </div>
      ) : (
        <>
          {/* Hero Section */}
          <section className="hero">
            <h1>
              Automate Your Side Income with <br />
              <span className="text-gradient">AI-Powered Arbitrage Alerts</span>
            </h1>
            <p>
              FlipRadar AI continuously scrapes marketplaces, values items using Gemini AI to filter scams, and pushes profitable flips directly to your phone.
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <button 
                onClick={() => {
                  const el = document.getElementById('pricing-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="btn-primary"
              >
                Start Automating <ArrowRight size={18} />
              </button>
              <a 
                href="#how-it-works"
                className="btn-secondary"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Play size={18} /> How it Works
              </a>
            </div>
          </section>

          {/* Features Grid */}
          <section id="how-it-works" className="grid">
            <div className="glass card">
              <div className="card-icon">
                <Zap size={24} />
              </div>
              <h3>24/7 Smart Scraping</h3>
              <p>
                Monitors newly listed "Buy It Now" items on eBay and tech deal directories the second they hit the internet, capturing underpriced gems instantly.
              </p>
            </div>

            <div className="glass card">
              <div className="card-icon">
                <ShieldCheck size={24} />
              </div>
              <h3>Gemini AI Risk Filter</h3>
              <p>
                LLM evaluation checks descriptions and item condition flags to filter out "for parts only", "icloud locked", "box only" listings, and scam alerts.
              </p>
            </div>

            <div className="glass card">
              <div className="card-icon">
                <Bell size={24} />
              </div>
              <h3>Instant Push Alerts</h3>
              <p>
                Calculates precise arbitrage profit, ROI percent, safety ratings, and logs detailed deal cards straight to your Discord or Telegram.
              </p>
            </div>
          </section>

          {/* Pricing Section */}
          <section id="pricing-section" className="pricing">
            <h2 className="pricing-title">Simple, Revenue-Driven Pricing</h2>
            <p className="pricing-subtitle">One flip pays for a full year. Get started in test mode below.</p>
            
            <div className="glass pricing-card">
              <div className="pricing-header">
                <h3>Premium Alerts Club</h3>
                <p>Perfect for full-time flippers and side-hustlers looking to automate.</p>
              </div>
              <div className="price">
                $49<span>/month</span>
              </div>
              
              <ul className="features-list">
                <li><Check size={16} /> Real-time scraper pipelines</li>
                <li><Check size={16} /> Live Gemini valuation reports</li>
                <li><Check size={16} /> Private Telegram bot alerts</li>
                <li><Check size={16} /> Private Discord server invites</li>
                <li><Check size={16} /> Custom keyword alert filters</li>
              </ul>

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
                <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} /> Connecting to Stripe...
                    </>
                  ) : (
                    'Subscribe (Stripe Sandbox)'
                  )}
                </button>
              </form>
            </div>
          </section>
        </>
      )}

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--card-border)', padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
        <p>© 2026 FlipRadar AI. All rights reserved. Built as an automated side-income micro-SaaS.</p>
      </footer>
    </div>
  );
}
