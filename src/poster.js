/**
 * X (Twitter) API v2 poster
 * Requires: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET in env
 */

import { TwitterApi, EUploadMimeType } from 'twitter-api-v2';

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

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Referer': 'https://www.pokemon.com/',
  'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
};

// Download a product image and upload it to X; returns a media_id or null.
// Best-effort — any failure (fetch, size, type, upload) falls back to text-only.
async function uploadImage(imageUrl) {
  try {
    const res = await fetch(imageUrl, { headers: FETCH_HEADERS });
    if (!res.ok) {
      console.warn(`[image] Fetch failed ${res.status} for ${imageUrl} — posting text-only`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 5_000_000) return null; // X image limit ~5MB
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const mime = ct.includes('png') ? EUploadMimeType.Png
      : ct.includes('webp') ? EUploadMimeType.Webp
      : ct.includes('gif') ? EUploadMimeType.Gif
      : EUploadMimeType.Jpeg;
    return await rw().v2.uploadMedia(buf, { media_type: mime });
  } catch (err) {
    console.warn(`[image] Upload error for ${imageUrl}: ${err.message} — posting text-only`);
    return null;
  }
}

/**
 * Post a restock alert tweet (with the product image when available)
 */
export async function postRestockAlert({ product, retailer, url, price, image }) {
  const retailerLabel = {
    pokemonCenter: 'Pokemon Center',
    target: 'Target',
    bestBuy: 'Best Buy',
    walmart: 'Walmart',
    amazon: 'Amazon',
    gameStop: 'GameStop',
  }[retailer] ?? retailer;

  // Restock alerts only ever fire at ≤ MSRP × 1.4 (see the price filter), so when
  // we have a price we can honestly flag it as a real retail deal — that "deal"
  // framing + urgency is what gets a post reshared (the main reach lever).
  const priceStr = price != null ? ` — $${price}` : '';
  const line1 = `🚨 RESTOCK ALERT 🚨\n${product} is IN STOCK at ${retailerLabel}${priceStr}!`;
  const value = price != null ? `\n✅ At retail — not scalper prices` : '';
  const link = `\n\n🔗 ${url}`;
  const cta = `\n\n🔔 Follow for instant alerts — these sell out fast`;
  const tags = `\n\n#PokemonTCG #Restock #PokemonCards`;

  // X counts every URL as 23 chars. Keep the highest-value parts that fit ≤ 280,
  // dropping tags → cta → value in that order; (line1 + link) is the floor.
  const len = s => s.length - url.length + 23;
  const tweet = [
    line1 + value + link + cta + tags,
    line1 + value + link + cta,
    line1 + value + link,
    line1 + link,
  ].find(t => len(t) <= 280) ?? (line1 + link);

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would post restock tweet${image ? ' (with image: ' + image + ')' : ''}:\n${tweet}\n`);
    return { id: 'dry-run' };
  }

  const mediaId = image ? await uploadImage(image) : null;
  const payload = mediaId ? { text: tweet, media: { media_ids: [mediaId] } } : tweet;
  const result = await rw().v2.tweet(payload);
  console.log(`[X] Posted: ${result.data.id}${mediaId ? ' (with image)' : ''}`);
  return result.data;
}

/**
 * Post a daily engagement/promo tweet, with an optional image attachment.
 * @param {string} text
 * @param {string|null} imageUrl - direct URL to an image to attach (best-effort)
 */
export async function postPromoTweet(text, imageUrl = null) {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would post promo tweet${imageUrl ? ' (with image: ' + imageUrl + ')' : ''}:\n${text}\n`);
    return { id: 'dry-run' };
  }

  const mediaId = imageUrl ? await uploadImage(imageUrl) : null;
  const payload = mediaId ? { text, media: { media_ids: [mediaId] } } : text;
  const result = await rw().v2.tweet(payload);
  console.log(`[X] Promo posted: ${result.data.id}${mediaId ? ' (with image)' : ''}`);
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
