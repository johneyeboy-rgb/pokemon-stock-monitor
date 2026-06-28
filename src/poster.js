/**
 * X (Twitter) API v2 poster
 * Requires: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET in env
 */

import { TwitterApi } from 'twitter-api-v2';

const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

const rwClient = client.readWrite;

const DRY_RUN = !!process.env.DRY_RUN;

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

  const tweet =
    `🚨 RESTOCK ALERT 🚨\n` +
    `${product} is IN STOCK at ${retailerLabel}!\n\n` +
    `🔗 ${url}\n\n` +
    `#Pokemon #PokemonTCG #TCG #Restock #PokemonCards`;

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would post restock tweet:\n${tweet}\n`);
    return { id: 'dry-run' };
  }

  const result = await rwClient.v2.tweet(tweet);
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

  const result = await rwClient.v2.tweet(text);
  console.log(`[X] Promo posted: ${result.data.id}`);
  return result.data;
}
