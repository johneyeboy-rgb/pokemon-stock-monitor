# Pokemon Stock Monitor

Monitors Pokemon TCG products across 4 retailers and auto-posts restock alerts to X.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Install Chromium (for Playwright)
npm run install-browsers

# 3. Add your API keys
cp .env.example .env
# Edit .env with your Anthropic + X API credentials

# 4. Run once
npm start
```

## Running on a schedule

Use `node-cron` or a cloud scheduler (GitHub Actions, Render cron job, Railway) to run `npm start` every 5 minutes.

**GitHub Actions example** (`.github/workflows/monitor.yml`):
```yaml
on:
  schedule:
    - cron: '*/5 * * * *'
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm install && npm run install-browsers
      - run: npm start
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          X_API_KEY: ${{ secrets.X_API_KEY }}
          X_API_SECRET: ${{ secrets.X_API_SECRET }}
          X_ACCESS_TOKEN: ${{ secrets.X_ACCESS_TOKEN }}
          X_ACCESS_SECRET: ${{ secrets.X_ACCESS_SECRET }}
```

## Daily follower-growth posts

Separate from restock alerts, `npm run promo` posts one piece of engagement
content per day (`src/content.js`) to keep the account active and grow
followers. It's safe to run more than once — a state guard ensures only one post
per calendar day.

Run it on its own **daily** schedule (not the 5-minute restock cron):

```yaml
# .github/workflows/promo.yml
on:
  schedule:
    - cron: '0 16 * * *'   # once a day, 16:00 UTC
jobs:
  post:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm install
      - run: npm run promo
        env:
          X_API_KEY: ${{ secrets.X_API_KEY }}
          X_API_SECRET: ${{ secrets.X_API_SECRET }}
          X_ACCESS_TOKEN: ${{ secrets.X_ACCESS_TOKEN }}
          X_ACCESS_SECRET: ${{ secrets.X_ACCESS_SECRET }}
```

Note: the promo job doesn't need Playwright/Chromium — it only posts to X, so
`npm run install-browsers` is omitted here.

**Edit the content:** add or change posts in the `DAILY_CONTENT` array in
`src/content.js`. The pool cycles fully before any post repeats.

## Project structure

```
src/
  index.js      — restock monitor loop (run on the 5-min cron)
  scraper.js    — Playwright scraper + Claude AI fallback
  retailers.js  — per-site selectors and config
  state.js      — tracks what's been posted (avoids duplicates)
  poster.js     — X API posting
  promo.js      — daily follower-growth post (run on the daily cron)
  content.js    — rotating pool of daily content
data/
  posted_state.json   — auto-created, tracks posted alerts + daily promo
```

## Customising

**Add a product:** edit `WATCHED_PRODUCTS` in `src/index.js`

**Add a retailer:** add a new entry to `src/retailers.js` following the same shape

**Change poll speed:** adjust `delayMs` per site in `retailers.js` (be respectful of rate limits)

**Walmart issues:** Walmart has the strongest bot protection. If it starts failing, try increasing `delayMs` to 8000+ or disable it and rely on the other three sites.
