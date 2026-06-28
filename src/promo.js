/**
 * Follower-growth post — separate entry point from the restock monitor.
 *
 * Runs on a multi-slot DAILY schedule (not the 5-minute restock cron). Each run
 * posts one item (text or poll) for the current time slot. The slot is derived
 * from the current UTC hour, and a state guard makes repeat/manual runs safe.
 *
 * Usage:
 *   node src/promo.js
 *
 * Env vars required:
 *   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
 */

import 'dotenv/config';
import { mkdirSync } from 'fs';
import { pickPost, SLOT_HOURS } from './content.js';
import { alreadyPostedPromoSlot, markPromoSlot } from './state.js';
import { postPromoTweet, postPoll } from './poster.js';

// Map the current UTC hour to a content slot. On an exact cron hit it matches a
// SLOT_HOURS entry; on a manual run it falls back to the nearest slot.
function currentSlot() {
  const hour = new Date().getUTCHours();
  const exact = SLOT_HOURS.indexOf(hour);
  if (exact !== -1) return exact;

  let best = 0;
  let bestDiff = 24;
  SLOT_HOURS.forEach((h, i) => {
    const diff = Math.abs(h - hour);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  });
  return best;
}

async function run() {
  console.log(`\n[Promo] Content check — ${new Date().toUTCString()}`);
  mkdirSync('./data', { recursive: true });

  const slot = currentSlot();
  const slotKey = String(slot);

  if (alreadyPostedPromoSlot(slotKey)) {
    console.log(`[Promo] Slot ${slot} already posted today — skipping.`);
    return;
  }

  const post = pickPost(new Date(), slot, SLOT_HOURS.length);

  if (post.kind === 'poll') {
    console.log(`[Promo] Posting poll (slot ${slot}): ${post.text}`);
    await postPoll(post.text, post.options);
  } else {
    console.log(`[Promo] Posting (slot ${slot}): ${post.text}`);
    await postPromoTweet(post.text);
  }

  markPromoSlot(slotKey);
  console.log('[Promo] Done.');
}

run().catch(err => {
  console.error('[Promo] Fatal error:', err);
  process.exit(1);
});
