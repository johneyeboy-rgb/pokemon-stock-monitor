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
import { mkdirSync, readFileSync, existsSync } from 'fs';
import { checkAllRetailers } from './scraper.js';
import { alreadyPostedToday, markAsPosted } from './state.js';
import { postRestockAlert } from './poster.js';

// When DRY_RUN is set, nothing posts and we don't persist "posted" state —
// so a dry test can't suppress a later real run.
const DRY_RUN = !!process.env.DRY_RUN;

// ── Products to watch ───────────────────────────────────────────────────────
// The watch list lives in config/watchlist.json (data, not code) so the
// /update-watchlist agent — or you — can edit it and review changes as a diff.
// msrp drives the price filter below. A built-in default is used if the file is
// missing or invalid, so a bad edit never silently stops all monitoring.
const WATCHLIST_FILE = './config/watchlist.json';
const DEFAULT_WATCHLIST = [
  { name: 'Scarlet & Violet Elite Trainer Box', msrp: 49.99 },
  { name: 'Pokemon 151 Booster Bundle', msrp: 29.99 },
  { name: 'Pokemon Crown Zenith Elite Trainer Box', msrp: 49.99 },
];

function loadWatchlist() {
  try {
    if (!existsSync(WATCHLIST_FILE)) return DEFAULT_WATCHLIST;
    const arr = JSON.parse(readFileSync(WATCHLIST_FILE, 'utf8'));
    const valid = Array.isArray(arr)
      ? arr.filter(p => p && typeof p.name === 'string' && typeof p.msrp === 'number')
      : [];
    return valid.length ? valid : DEFAULT_WATCHLIST;
  } catch (err) {
    console.error('[Agent] Could not read watchlist.json, using default:', err.message);
    return DEFAULT_WATCHLIST;
  }
}

const WATCHED_PRODUCTS = loadWatchlist();

// Only alert when detected price ≤ max(MSRP × 1.4, MSRP + $10).
// The flat $10 gives cheap products (mini tins, etc.) extra headroom so a
// modest retail premium doesn't suppress a real restock; the percentage rule
// governs more expensive items where $10 is already below 40%.
const MAX_MARKUP = 1.4;
const MAX_FLAT_PREMIUM = 10;
// Reject prices suspiciously below MSRP — signals a wrong-product match
// (e.g. a single booster pack matched instead of a 6-pack bundle).
const MIN_PRICE_RATIO = 0.6;
const msrpByName = new Map(WATCHED_PRODUCTS.map(p => [p.name, p.msrp]));

// ── Run the agent loop ──────────────────────────────────────────────────────
async function run() {
  console.log(`\n[Agent] Starting check — ${new Date().toLocaleTimeString()}`);
  mkdirSync('./data', { recursive: true });

  const results = await checkAllRetailers(WATCHED_PRODUCTS.map(p => p.name));

  let alertsPosted = 0;

  for (const result of results) {
    if (!result.inStock) continue;
    if (result.error) continue;

    // Price filter — skip scalper/marketplace listings and wrong-product matches.
    const msrp = msrpByName.get(result.product);
    const maxPrice = msrp != null ? Math.max(msrp * MAX_MARKUP, msrp + MAX_FLAT_PREMIUM) : null;
    const minPrice = msrp != null ? msrp * MIN_PRICE_RATIO : null;
    if (maxPrice != null && result.price != null && result.price > maxPrice) {
      console.log(`[Agent] Skipping over-MSRP: ${result.product} @ ${result.retailer} — $${result.price} > $${maxPrice.toFixed(2)} cap`);
      continue;
    }
    if (minPrice != null && result.price != null && result.price < minPrice) {
      console.log(`[Agent] Skipping under-floor: ${result.product} @ ${result.retailer} — $${result.price} < $${minPrice.toFixed(2)} floor (likely wrong product matched)`);
      continue;
    }

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
