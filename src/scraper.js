/**
 * Pokemon Stock Monitor — Scraper
 *
 * Checks retailer search pages for in-stock status. The logic is card-scoped:
 *   1. Load the retailer's search results page.
 *   2. Find the result card whose title actually matches the watched product
 *      (avoids reading another product's "Add to Cart" as a false positive).
 *   3. Look for in/out-of-stock indicators *inside that card*.
 *   4. If the markup is inconclusive, fall back to Claude on the card's text only.
 *
 * NOTE: this applies basic, dependency-free anti-detection hardening (launch
 * flags, realistic context, navigator.webdriver masking). That helps with naive
 * checks but will NOT reliably beat Cloudflare (Pokemon Center) or Walmart's
 * fingerprinting. If you still get walls/CAPTCHAs, escalate to playwright-extra +
 * the stealth plugin, residential proxies, or a scraping API.
 */

import { chromium } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import * as retailers from './retailers.js';

// Lazily construct the Anthropic client so a missing/placeholder API key doesn't
// crash selector-only / dry runs — it's only needed when the AI fallback fires.
let _anthropic;
const anthropic = () => (_anthropic ??= new Anthropic());

const DRY_RUN = !!process.env.DRY_RUN;

/**
 * Main entry: check all enabled retailers for the given products.
 * @param {string[]} products - product names to watch
 * @returns {Promise<object[]>}
 */
export async function checkAllRetailers(products) {
  const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
  const results = [];

  try {
    for (const [name, retailer] of Object.entries(retailers.SITES)) {
      if (!retailer.enabled) continue;
      console.log(`[${name}] Checking ${products.length} product(s)...`);

      for (const product of products) {
        try {
          const result = await checkRetailer(browser, name, retailer, product);
          results.push(result);
          console.log(`[${name}] ${product}: ${result.inStock ? '✅ IN STOCK' : '❌ out of stock'}`);
        } catch (err) {
          console.error(`[${name}] Error checking "${product}":`, err.message);
          results.push({ retailer: name, product, inStock: false, error: err.message });
        }

        // Polite delay between requests
        await sleep(retailer.delayMs ?? 2000);
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

/**
 * Check a single retailer for a single product.
 */
async function checkRetailer(browser, name, retailer, product) {
  const context = await browser.newContext({
    userAgent: retailer.userAgent ?? DEFAULT_UA,
    extraHTTPHeaders: retailer.headers ?? {},
    locale: 'en-US',
    timezoneId: 'America/New_York',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  await context.addInitScript(STEALTH_INIT);

  try {
    const page = await context.newPage();

    // Block images/fonts to speed up loading
    await page.route('**/*.{png,jpg,jpeg,gif,webp,woff,woff2,ttf}', r => r.abort());

    const url = retailer.buildSearchUrl(product);
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });

    // Give JS-rendered pages a moment to settle
    if (retailer.waitSelector) {
      await page.waitForSelector(retailer.waitSelector, { timeout: 8000 }).catch(() => {});
    } else {
      await page.waitForTimeout(1500);
    }

    // Dry-run diagnostics: did the page load, or did we hit a bot wall?
    // status 403/429 or a "Just a moment…" / "Access Denied" title = blocked.
    if (DRY_RUN) {
      const title = await page.title().catch(() => '');
      const cards = retailer.productCardSelector
        ? (await page.$$(retailer.productCardSelector)).length
        : 0;
      console.log(`   [diag] status=${response?.status() ?? '?'} cards=${cards} title="${title.slice(0, 70)}"`);
    }

    // Find the result card that actually matches the product we're watching.
    const card = await findMatchingCard(page, retailer, product);
    if (!card) {
      // Product not present in the search results → treat as not in stock.
      return { retailer: name, product, inStock: false, url };
    }

    // Fast, card-scoped CSS detection first
    let inStock = await detectBySelectors(card, retailer.cardSelectors);

    // Fall back to Claude on the matched card's text if markup was inconclusive
    if (inStock === null) {
      const cardText = (await card.innerText().catch(() => '')).slice(0, 2000);
      inStock = await detectByAI(cardText, product, name);
    }

    const stockUrl = inStock ? (await extractCardUrl(card, retailer)) ?? url : url;
    return { retailer: name, product, inStock, url: stockUrl };
  } finally {
    await context.close();
  }
}

/**
 * Scan the search-result cards and return the ElementHandle whose title best
 * matches the watched product. Returns null if nothing clears the threshold.
 */
async function findMatchingCard(page, retailer, product) {
  if (!retailer.productCardSelector) return null;

  const cards = await page.$$(retailer.productCardSelector);
  let best = null;
  let bestScore = 0;

  for (const card of cards) {
    const titleEl = retailer.titleSelector ? await card.$(retailer.titleSelector) : null;
    const title = await (titleEl ?? card).innerText().catch(() => '');
    const score = matchScore(product, title);
    if (score > bestScore) {
      bestScore = score;
      best = card;
    }
  }

  return bestScore >= MATCH_THRESHOLD ? best : null;
}

/**
 * Card-scoped CSS detection — fast, no AI cost.
 * Returns true / false / null (null = inconclusive).
 */
async function detectBySelectors(card, selectors) {
  if (!selectors) return null;

  // Explicit "add to cart" / "in stock" indicators inside the card
  for (const sel of selectors.inStock ?? []) {
    const el = await card.$(sel);
    if (el) {
      const text = (await el.innerText().catch(() => '')).toLowerCase();
      if (!/unavailable|out of stock|sold out/i.test(text)) return true;
    }
  }

  // Explicit "out of stock" indicators inside the card
  for (const sel of selectors.outOfStock ?? []) {
    const el = await card.$(sel);
    if (el) return false;
  }

  return null; // inconclusive
}

/**
 * AI-based stock detection via Claude — handles cards without clean selectors.
 * Operates on the matched card's text only (not the whole page).
 */
async function detectByAI(cardText, product, retailerName) {
  if (!cardText.trim()) return false;

  const msg = await anthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 64,
    messages: [{
      role: 'user',
      content: `You are a stock-detection tool. Below is the text of a single ` +
        `search-result card from ${retailerName} for the product "${product}". ` +
        `Determine if it is currently IN STOCK and available to add to cart.\n\n` +
        `Respond with ONLY one word: INSTOCK or OUTOFSTOCK.\n\n` +
        `Card text:\n${cardText}`,
    }],
  });

  const block = msg.content.find(b => b.type === 'text');
  const answer = (block?.text ?? '').trim().toUpperCase();
  return answer === 'INSTOCK';
}

/**
 * Extract the product URL from the matched card.
 */
async function extractCardUrl(card, retailer) {
  if (!retailer.linkSelector) return null;
  const el = await card.$(retailer.linkSelector);
  if (!el) return null;
  let href = await el.getAttribute('href');
  if (!href) return null;
  href = href.split('#')[0]; // drop tracking fragments like #lnk=sametab
  return href.startsWith('http') ? href : retailer.baseUrl + href;
}

// ── Product-name matching ────────────────────────────────────────────────────

// Fraction of the product's significant tokens a card title must contain to count
// as the same product. Set high so near-misses are rejected — e.g. a search for
// "151 Booster Bundle" should NOT match a "151 Booster Pack" listing (0.75).
const MATCH_THRESHOLD = 0.8;
const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'for', 'with', 'to']);

function tokenize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Fraction of the product's significant tokens that appear in the card title.
 * 1.0 = every meaningful word matched; 0 = no overlap.
 */
function matchScore(product, cardTitle) {
  const want = tokenize(product).filter(t => t.length > 1 && !STOPWORDS.has(t));
  if (want.length === 0) return 0;

  const have = new Set(tokenize(cardTitle));
  let hits = 0;
  for (const t of want) if (have.has(t)) hits++;
  return hits / want.length;
}

const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Chromium launch flags that hide the most obvious automation signals.
// --no-sandbox / --disable-dev-shm-usage are needed when running in CI/Docker
// (e.g. the GitHub Actions ubuntu runner).
const LAUNCH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--disable-dev-shm-usage',
  '--no-sandbox',
];

// Runs in the page before any site script. Masks the cheap "is this a bot?"
// tells. Kept UA-consistent: window.chrome is only added for Chrome UAs.
const STEALTH_INIT = () => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  if (/Chrome/.test(navigator.userAgent) && !window.chrome) {
    window.chrome = { runtime: {} };
  }
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
