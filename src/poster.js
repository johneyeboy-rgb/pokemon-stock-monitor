/**
 * X (Twitter) API v2 poster
 * Requires: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET in env
 */

import { TwitterApi } from 'twitter-api-v2';

const DRY_RUN = !!process.env.DRY_RUN;

// Lazily build the X read/write client so dry runs and tests need no credentials,
// and a missing token never crashes at import time.
let _rw;
function rw() {
  if (!_rw) {
    _rw = new TwitterApi({
      appKey: process.env.X_API_KEY,
      appSecret: process.env.X_API_SECRET,
      accessToken: process.env.X_ACCESS_TOKEN,
      accessSecret: process.env.X_ACCESS_SECRET,
    }).readWrite;
  }
  return _rw;
}

/**
 * Post a restock alert tweet
 */
export async function postRestockAlert({ product, retailer, url }) {
  const retailerLabel = {
    pokemonCenter: 'Pokemon Center',
    target: 'Target',
    bestBuy: 'Best Buy',
    walmart: 'Walmart',
  }[retailer] ?? retailer;

  const head = `🚨 RESTOCK ALERT 🚨\n${product} is IN STOCK at ${retailerLabel}!\n\n🔗 ${url}`;
  const cta = `\n\n🔔 Follow for instant restock alerts`;
  const tags = `\n\n#PokemonTCG #Restock #PokemonCards`;

  // X counts every URL as 23 chars regardless of length. Add the CTA + tags only
  // if the whole thing still fits under 280, so long product names never 400.
  const len = s => s.length - url.length + 23;
  let tweet = head;
  if (len(head + cta + tags) <= 280) tweet = head + cta + tags;
  else if (len(head + tags) <= 280) tweet = head + tags;
  else if (len(head + cta) <= 280) tweet = head + cta;

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would post restock tweet:\n${tweet}\n`);
    return { id: 'dry-run' };
  }

  const result = await rw().v2.tweet(tweet);
  console.log(`[X] Posted: ${result.data.id}`);
  return result.data;
}

/**
 * Post a daily engagement/promo tweet
 */
export async function postPromoTweet(text) {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would post promo tweet:\n${text}\n`);
    return { id: 'dry-run' };
  }

  const result = await rw().v2.tweet(text);
  console.log(`[X] Promo posted: ${result.data.id}`);
  return result.data;
}

/**
 * Post a native poll (strong engagement driver).
 * @param {string} text - the poll question / tweet body
 * @param {string[]} options - 2–4 choices, each ≤ 25 chars
 * @param {number} durationMinutes - how long the poll stays open (default 24h)
 */
export async function postPoll(text, options, durationMinutes = 1440) {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would post poll:\n${text}\n  [ ${options.join(' | ')} ]\n`);
    return { id: 'dry-run' };
  }

  const result = await rw().v2.tweet({
    text,
    poll: { options, duration_minutes: durationMinutes },
  });
  console.log(`[X] Poll posted: ${result.data.id}`);
  return result.data;
}
