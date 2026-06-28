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

// Reserved key for the daily follower-growth post (won't collide with
// "retailer::product" alert keys).
const PROMO_KEY = '__promo__';

/**
 * Check if we've already posted today's follower-growth content
 */
export function alreadyPostedPromoToday() {
  const state = load();
  if (!state[PROMO_KEY]) return false;
  return new Date(state[PROMO_KEY]).toDateString() === new Date().toDateString();
}

/**
 * Mark today's follower-growth content as posted (now)
 */
export function markPromoPosted() {
  const state = load();
  state[PROMO_KEY] = new Date().toISOString();
  save(state);
}

/**
 * Clear all state (useful for testing)
 */
export function clearState() {
  save({});
}
