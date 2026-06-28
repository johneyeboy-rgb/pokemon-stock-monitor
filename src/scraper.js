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
 * Steps 1–3 run in a single in-page pass (scanForProduct) so we never hold element
 * handles across navigations — important because the stealth plugin and SPA
 * re-renders can otherwise invalidate them.
 *
 * NOTE: uses playwright-extra + the stealth plugin, which clears Walmart's
 * PerimeterX challenge from a residential IP but does NOT beat Pokemon Center's
 * Cloudflare edge block (still 403). Datacenter IPs (e.g. GitHub Actions) may be
 * blocked harder — for reliable Walmart/PC in CI, use a scraping API.
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import Anthropic from '@anthropic-ai/sdk';
import * as retailers from './retailers.js';

chromium.use(StealthPlugin());

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

    // Match the product, detect stock, and grab the link — all in one in-page pass.
    const found = await page.evaluate(scanForProduct, {
      cardSel: retailer.productCardSelector,
      titleSel: retailer.titleSelector ?? null,
      linkSel: retailer.linkSelector ?? null,
      priceSel: retailer.priceSelector ?? null,
      inSel: retailer.cardSelectors?.inStock ?? [],
      outSel: retailer.cardSelectors?.outOfStock ?? [],
      product,
      threshold: MATCH_THRESHOLD,
      stopwords: [...STOPWORDS],
      baseUrl: retailer.baseUrl,
    }).catch(() => null);

    if (!found || !found.matched) {
      // Product not present in the search results → treat as not in stock.
      return { retailer: name, product, inStock: false, price: null, url };
    }

    // Fall back to Claude on the matched card's text if the markup was inconclusive.
    let inStock = found.inStock; // true | false | null
    if (inStock === null) {
      inStock = await detectByAI(found.text, product, name);
    }

    const stockUrl = inStock ? (found.href ?? url) : url;
    return { retailer: name, product, inStock, price: found.price ?? null, url: stockUrl };
  } finally {
    await context.close();
  }
}

/**
 * Runs IN THE PAGE (serialized by page.evaluate — no access to Node scope).
 * Picks the best title-matched card, then reads in/out-of-stock signals and the
 * product link from it, returning plain serializable data.
 */
function scanForProduct({ cardSel, titleSel, linkSel, priceSel, inSel, outSel, product, threshold, stopwords, baseUrl }) {
  const stop = new Set(stopwords);
  const tokenize = s => (s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const want = tokenize(product).filter(t => t.length > 1 && !stop.has(t));
  const score = title => {
    if (!want.length) return 0;
    const have = new Set(tokenize(title));
    let hits = 0;
    for (const t of want) if (have.has(t)) hits++;
    return hits / want.length;
  };

  const cards = cardSel ? Array.from(document.querySelectorAll(cardSel)) : [];
  let best = null;
  let bestScore = 0;
  for (const c of cards) {
    const titleEl = titleSel ? c.querySelector(titleSel) : null;
    const title = ((titleEl || c).textContent || '').trim();
    const s = score(title);
    if (s > bestScore) { bestScore = s; best = c; }
  }
  if (!best || bestScore < threshold) return { matched: false };

  // In/out-of-stock indicators inside the matched card.
  let inStock = null;
  for (const sel of inSel) {
    const el = best.querySelector(sel);
    if (el) {
      const t = (el.textContent || '').toLowerCase();
      if (!/unavailable|out of stock|sold out/.test(t)) { inStock = true; break; }
    }
  }
  if (inStock === null) {
    for (const sel of outSel) {
      if (best.querySelector(sel)) { inStock = false; break; }
    }
  }

  // Product link.
  let href = null;
  if (linkSel) {
    const a = best.querySelector(linkSel);
    if (a) href = a.getAttribute('href');
  }
  if (href) {
    href = href.split('#')[0];
    if (!/^https?:/.test(href)) href = baseUrl + href;
  }

  // Price — prefer a dedicated element, else the first $-amount in the card text.
  let priceText = '';
  if (priceSel) { const pe = best.querySelector(priceSel); if (pe) priceText = pe.textContent || ''; }
  if (!priceText) priceText = best.innerText || best.textContent || '';
  const pm = priceText.match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
  const price = pm ? parseFloat(pm[1].replace(/,/g, '')) : null;

  const text = (best.innerText || best.textContent || '').slice(0, 2000);
  return { matched: true, score: bestScore, inStock, href, text, price };
}

/**
 * AI-based stock detection via Claude — handles cards without clean selectors.
 * Operates on the matched card's text only (not the whole page).
 */
async function detectByAI(cardText, product, retailerName) {
  if (!cardText || !cardText.trim()) return false;

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

// ── Product-name matching ────────────────────────────────────────────────────

// Fraction of the product's significant tokens a card title must contain to count
// as the same product. Set high so near-misses are rejected — e.g. a search for
// "151 Booster Bundle" should NOT match a "151 Booster Pack" listing (0.75).
const MATCH_THRESHOLD = 0.8;
const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'for', 'with', 'to']);

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

const sleep = ms => new Promise(r => setTimeout(r, ms));
