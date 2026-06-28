/**
 * Pokemon Stock Monitor — main agent loop
 * Run on a cron schedule (e.g. every 5 minutes via node-cron or a cloud function)
 *
 * Usage:
 *   node src/index.js
 *
 * Env vars required:
 *   ANTHROPIC_API_KEY
 *   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
 */

import 'dotenv/config';
import { mkdirSync } from 'fs';
import { checkAllRetailers } from './scraper.js';
import { alreadyPostedToday, markAsPosted } from './state.js';
import { postRestockAlert } from './poster.js';

// When DRY_RUN is set, nothing posts and we don't persist "posted" state —
// so a dry test can't suppress a later real run.
const DRY_RUN = !!process.env.DRY_RUN;

// ── Products to watch ───────────────────────────────────────────────────────
const WATCHED_PRODUCTS = [
  'Scarlet & Violet Elite Trainer Box',
  'Pokemon 151 Booster Bundle',
  'Crown Zenith Galarian Gallery',
];

// ── Run the agent loop ──────────────────────────────────────────────────────
async function run() {
  console.log(`\n[Agent] Starting check — ${new Date().toLocaleTimeString()}`);
  mkdirSync('./data', { recursive: true });

  const results = await checkAllRetailers(WATCHED_PRODUCTS);

  let alertsPosted = 0;

  for (const result of results) {
    if (!result.inStock) continue;
    if (result.error) continue;

    if (alreadyPostedToday(result.retailer, result.product)) {
      console.log(`[Agent] Already alerted today: ${result.product} @ ${result.retailer}`);
      continue;
    }

    console.log(`[Agent] 🎯 NEW STOCK: ${result.product} @ ${result.retailer}`);

    try {
      await postRestockAlert(result);
      if (!DRY_RUN) markAsPosted(result.retailer, result.product);
      alertsPosted++;
    } catch (err) {
      console.error(`[Agent] Failed to post for ${result.product}:`, err.message);
    }
  }

  console.log(`[Agent] Done — ${alertsPosted} new alert(s) posted.\n`);
}

run().catch(err => {
  console.error('[Agent] Fatal error:', err);
  process.exit(1);
});
