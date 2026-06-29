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

/**
 * Clear all state (useful for testing)
 */
export function clearState() {
  save({});
}
