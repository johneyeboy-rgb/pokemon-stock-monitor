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
import { pickPost, pickQueuedPost, SLOT_HOURS } from './content.js';
import { alreadyPostedPromoSlot, markPromoSlot, alreadyPostedQueueItem, markQueueItem } from './state.js';
import { postPromoTweet, postPoll } from './poster.js';

// When DRY_RUN is set, nothing posts and we don't persist state — so a dry test
// can't suppress a real slot or consume a queued item.
const DRY_RUN = !!process.env.DRY_RUN;

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

  // Prefer an agent-queued post; fall back to the evergreen pool.
  const queued = pickQueuedPost(new Date(), alreadyPostedQueueItem);
  const post = queued ?? pickPost(new Date(), slot, SLOT_HOURS.length);
  const source = queued ? `queued "${queued.id}"` : 'evergreen';

  const isPoll = post.kind === 'poll' && Array.isArray(post.options) && post.options.length >= 2;
  console.log(`[Promo] Posting ${source} (slot ${slot}, ${isPoll ? 'poll' : 'text'}): ${post.text}`);

  if (isPoll) await postPoll(post.text, post.options);
  else await postPromoTweet(post.text, post.image ?? null);

  if (queued && !DRY_RUN) markQueueItem(queued.id);
  if (!DRY_RUN) markPromoSlot(slotKey);
  console.log('[Promo] Done.');
}

run().catch(err => {
  console.error('[Promo] Fatal error:', err);
  process.exit(1);
});
