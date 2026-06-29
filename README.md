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

Separate from restock alerts, `npm run promo` posts follower-growth content — a
mix of text posts and native polls — across a few slots per day (`src/content.js`)
to keep the account active and grow followers. The slot is derived from the
current UTC hour (`SLOT_HOURS`), and a state guard ensures one post per slot per
day, so manual re-runs are safe.

Run it on a multi-slot schedule (not the 5-minute restock cron):

```yaml
# .github/workflows/promo.yml
on:
  schedule:
    - cron: '0 14 * * *'   # content slots (UTC) — match SLOT_HOURS
    - cron: '0 17 * * *'
    - cron: '0 20 * * *'
    - cron: '0 23 * * *'
    - cron: '0 1 * * *'
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

**Edit the content:** add or change items in the `POSTS` array in
`src/content.js` (text posts or polls). The pool cycles fully before anything
repeats.

**Agent-written queue:** `content/queue.json` holds timely, research-based posts
(restock reminders, Pokémon news, drop-window tips) — typically generated and
reviewed weekly, then committed. The pipeline posts queued items first (one per
slot, each once, honoring optional `postAfter`/`expires` dates) and falls back to
the evergreen pool when the queue is empty. See `content/README.md` for the schema.

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
