/**
 * Daily restock recap — summarizes the last 24h of restock alerts in one post.
 * Posts nothing on a quiet day (the content/poll posts keep the account active).
 *
 * Usage:
 *   node src/recap.js
 *
 * Env vars required:
 *   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
 */

import 'dotenv/config';
import { mkdirSync } from 'fs';
import { recentRestocks, alreadyPostedRecapToday, markRecapPosted } from './state.js';
import { postPromoTweet } from './poster.js';

const DRY_RUN = !!process.env.DRY_RUN;

const RETAILER_LABEL = {
  pokemonCenter: 'Pokemon Center', target: 'Target', bestBuy: 'Best Buy',
  walmart: 'Walmart', amazon: 'Amazon', gameStop: 'GameStop',
};

function buildRecap(items) {
  const head = `📊 Today's Pokémon restocks (last 24h):\n`;
  const tail = `\n🔔 Follow + notifications on so you're first next time.\n#PokemonTCG #Restock`;
  let body = '';
  let shown = 0;
  for (const it of items) {
    const line = `• ${it.product} @ ${RETAILER_LABEL[it.retailer] ?? it.retailer}\n`;
    if ((head + body + line + tail).length > 270) break; // keep it under 280
    body += line;
    shown++;
  }
  const more = items.length - shown;
  if (more > 0) body += `• …and ${more} more\n`;
  return head + body + tail;
}

async function run() {
  console.log(`\n[Recap] Daily recap — ${new Date().toUTCString()}`);
  mkdirSync('./data', { recursive: true });

  if (alreadyPostedRecapToday()) {
    console.log('[Recap] Already posted today — skipping.');
    return;
  }

  const items = recentRestocks();
  if (items.length === 0) {
    console.log('[Recap] No restocks in the last 24h — nothing to recap.');
    return;
  }

  const text = buildRecap(items);
  console.log(`[Recap] ${items.length} restock(s). Posting:\n${text}`);

  await postPromoTweet(text);
  if (!DRY_RUN) markRecapPosted();
  console.log('[Recap] Done.');
}

run().catch(err => {
  console.error('[Recap] Fatal error:', err);
  process.exit(1);
});
