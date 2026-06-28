/**
 * Daily follower-growth post — separate entry point from the restock monitor.
 *
 * Run this on its own DAILY schedule (not the 5-minute restock cron). It posts
 * one piece of content per day; the state guard makes repeat/manual runs safe.
 *
 * Usage:
 *   node src/promo.js
 *
 * Env vars required:
 *   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
 */

import 'dotenv/config';
import { mkdirSync } from 'fs';
import { pickDailyContent } from './content.js';
import { alreadyPostedPromoToday, markPromoPosted } from './state.js';
import { postPromoTweet } from './poster.js';

async function run() {
  console.log(`\n[Promo] Daily content check — ${new Date().toLocaleString()}`);
  mkdirSync('./data', { recursive: true });

  if (alreadyPostedPromoToday()) {
    console.log('[Promo] Already posted today — skipping.');
    return;
  }

  const text = pickDailyContent();
  console.log(`[Promo] Posting: ${text}`);

  await postPromoTweet(text);
  markPromoPosted();
  console.log('[Promo] Done.');
}

run().catch(err => {
  console.error('[Promo] Fatal error:', err);
  process.exit(1);
});
