/**
 * State tracker — remembers what's already been posted so we don't spam
 * Uses a simple JSON file. Swap db.set/db.get for Redis/Supabase in production.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

const STATE_FILE = './data/posted_state.json';

function load() {
  if (!existsSync(STATE_FILE)) return {};
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

function save(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Check if we've already posted an alert for this retailer+product combo today
 */
export function alreadyPostedToday(retailer, product) {
  const state = load();
  const key = `${retailer}::${product}`;
  if (!state[key]) return false;
  const lastPosted = new Date(state[key]);
  const now = new Date();
  // Reset daily — same calendar day counts as "already posted"
  return lastPosted.toDateString() === now.toDateString();
}

/**
 * Mark a retailer+product as posted (now)
 */
export function markAsPosted(retailer, product) {
  const state = load();
  const key = `${retailer}::${product}`;
  state[key] = new Date().toISOString();
  save(state);
}

// Reserved key prefix for follower-growth posts (won't collide with
// "retailer::product" alert keys). One entry per content slot per day.
const PROMO_KEY = '__promo__';

/**
 * Check if we've already posted this content slot today
 */
export function alreadyPostedPromoSlot(slotKey) {
  const state = load();
  const key = `${PROMO_KEY}:${slotKey}`;
  if (!state[key]) return false;
  return new Date(state[key]).toDateString() === new Date().toDateString();
}

/**
 * Mark this content slot as posted (now)
 */
export function markPromoSlot(slotKey) {
  const state = load();
  state[`${PROMO_KEY}:${slotKey}`] = new Date().toISOString();
  save(state);
}

// Agent-queued items post at most once, ever (not daily) — keyed by item id.
const QUEUE_PREFIX = '__queue__';

/**
 * Has this queued content item already been posted?
 */
export function alreadyPostedQueueItem(id) {
  const state = load();
  return !!state[`${QUEUE_PREFIX}:${id}`];
}

/**
 * Mark a queued content item as posted (now).
 */
export function markQueueItem(id) {
  const state = load();
  state[`${QUEUE_PREFIX}:${id}`] = new Date().toISOString();
  save(state);
}

// Reserved key for the daily restock recap (once per UTC day).
const RECAP_KEY = '__recap__';

/**
 * Has today's restock recap already been posted?
 */
export function alreadyPostedRecapToday() {
  const state = load();
  if (!state[RECAP_KEY]) return false;
  return new Date(state[RECAP_KEY]).toDateString() === new Date().toDateString();
}

/**
 * Mark today's restock recap as posted (now).
 */
export function markRecapPosted() {
  const state = load();
  state[RECAP_KEY] = new Date().toISOString();
  save(state);
}

/**
 * Restock alerts (retailer::product keys) posted within the last `sinceMs`.
 * @returns {{retailer:string, product:string, at:string}[]} newest first
 */
export function recentRestocks(sinceMs = 24 * 60 * 60 * 1000) {
  const state = load();
  const cutoff = Date.now() - sinceMs;
  const out = [];
  for (const [key, val] of Object.entries(state)) {
    if (!key.includes('::')) continue; // skip __promo__ / __queue__ / __recap__ markers
    const t = new Date(val).getTime();
    if (Number.isFinite(t) && t >= cutoff) {
      const [retailer, product] = key.split('::');
      out.push({ retailer, product, at: val });
    }
  }
  return out.sort((a, b) => new Date(b.at) - new Date(a.at));
}

/**
 * Clear all state (useful for testing)
 */
export function clearState() {
  save({});
}
