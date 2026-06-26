# FlipRadar AI - Automated Deal Finder & Arbitrage Bot

FlipRadar AI is a micro-SaaS application that automates deal finding, values items using Gemini AI, filters out scams and damaged items, sends alerts to a private Telegram/Discord server, and features a premium Next.js subscription landing page.

---

## Repository Structure

```
deal-finder-bot/
├── apps/
│   ├── bot/                 # Node.js/TypeScript scraper & evaluation engine
│   │   ├── src/
│   │   │   ├── scrapers/    # Scraper engines (eBay, Slickdeals, Mock)
│   │   │   ├── evaluator.ts # Gemini AI & heuristic risk evaluator
│   │   │   ├── notifier.ts  # Notification dispatcher (Console, Telegram, Discord)
│   │   │   ├── types.ts     # Data structures
│   │   │   └── index.ts     # Main scheduler entry point
│   │   └── .env             # Bot config and API keys
│   └── web/                 # Next.js 14 subscriber landing page & dashboard
│       ├── app/             # Routing and page layout files
│       └── next.config.js   # Next.js configurations
├── package.json             # Root monorepo npm workspace configuration
└── README.md                # Documentation
```

---

## Getting Started

### Prerequisites

You need **Node.js (v18+)** and **npm** installed on your system.

### Installation

1. Open a terminal in the project directory:
   ```bash
   cd deal-finder-bot
   ```
2. Install dependencies for the entire project workspace:
   ```bash
   npm install
   ```

---

## 1. Running the Bot Engine (`apps/bot`)

The bot operates in two modes: **Mock Mode** (for safe, instant sandbox testing) and **Live Mode** (which scrapes real data from eBay and Slickdeals).

### Configuration

Open the configuration file `apps/bot/.env` and update the parameters:

* `GEMINI_API_KEY`: Set your Google Gemini API key to enable AI scam checking and retail valuations. If left blank, the bot runs in a rule-based heuristic fallback mode.
* `MOCK_MODE`: Set to `true` (default) to generate realistic test items, or `false` to query live sites.
* `DISCORD_WEBHOOK_URL`: (Optional) Paste a Discord webhook URL to send formatted deal cards to a Discord server.
* `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID`: (Optional) Set up a Telegram bot to send push alerts directly to a Telegram channel.

### Execution

To run the bot in development mode:
```bash
npm run dev:bot
```

To build and run in production:
```bash
npm run build:bot
npm run start:bot
```

---

## 2. Running the Landing Page (`apps/web`)

The landing page represents your user-facing SaaS. It simulates Stripe subscriptions and redirects users to join the premium Telegram/Discord channels upon signup.

### Execution

To run the Next.js development server:
```bash
npm run dev:web
```

Access the application in your browser at: **`http://localhost:3000`**

---

## 3. Scaling to Passive Side Income

To make this a fully automated, continuous income generator:
1. **Deploy the Bot to a Cloud Server (VPS):** Deploy the bot to a hosting platform like **Render**, **Railway**, or a **digitalOcean VPS** ($5/month). This ensures the bot scrapes and sends alerts 24/7 without needing your laptop to be open.
2. **Deploy the Frontend:** Deploy the Next.js web application to **Vercel** (free tier).
3. **Connect Real Stripe:** Switch the Stripe client from test mode to live mode, linking it to your bank account.
4. **Marketing:** Share the link to your landing page in flipping/deal communities, vintage groups, or gaming forums. Once a user subscribes, Stripe calls your webhook, sending them the invite links to your premium Telegram/Discord channel automatically!
