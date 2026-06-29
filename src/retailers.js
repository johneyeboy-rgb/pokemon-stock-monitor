/**
 * Retailer site configurations
 *
 * Each site defines: a search-URL builder, the selector for a single search-result
 * "card", how to read a card's title/link, and the in/out-of-stock indicators to
 * look for *within* that card.
 *
 * ⚠️ SELECTORS NEED LIVE VERIFICATION. These sites change their markup often and
 * sit behind bot protection, so the exact selectors below are best-effort starting
 * points — confirm them against a real (non-blocked) page before trusting alerts.
 * The detection *logic* in scraper.js is correct regardless; only these strings are
 * site-specific guesses.
 *
 * Shape:
 *   productCardSelector — container for one result in the search grid
 *   titleSelector       — title text inside a card (relative to the card)
 *   linkSelector        — product link inside a card (relative to the card)
 *   cardSelectors.inStock / .outOfStock — availability indicators inside a card
 */

export const SITES = {

  // ─── Pokemon Center ────────────────────────────────────────────────────────
  // Cloudflare protected — needs realistic UA + headers.
  pokemonCenter: {
    // DISABLED: Cloudflare returns HTTP 403 even with the stealth plugin — it
    // blocks at the edge before the page renders. Realistically needs a scraping
    // API / residential-proxy unblocker. Re-enable once you have one.
    enabled: false,
    baseUrl: 'https://www.pokemoncenter.com',
    delayMs: 3000,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    buildSearchUrl: (product) =>
      `https://www.pokemoncenter.com/search?q=${encodeURIComponent(product)}`,
    waitSelector: '[data-testid="product-card"]',
    productCardSelector: '[data-testid="product-card"]',
    titleSelector: '[data-testid="product-title"], a',
    linkSelector: 'a',
    cardSelectors: {
      inStock: [
        'button[data-testid="add-to-cart"]:not([disabled])',
        'button.add-to-cart:not(.disabled)',
      ],
      outOfStock: [
        '[data-testid="out-of-stock"]',
        '.product-form__sold-out',
        'button[disabled][data-testid="add-to-cart"]',
      ],
    },
  },

  // ─── Target ────────────────────────────────────────────────────────────────
  // React-rendered SPA. Needs wait time. Reliable data-test attributes.
  target: {
    enabled: true,
    baseUrl: 'https://www.target.com',
    delayMs: 2500,
    buildSearchUrl: (product) =>
      `https://www.target.com/s?searchTerm=${encodeURIComponent(product)}`,
    waitSelector: '[data-test="product-details"]',
    productCardSelector: '[data-test="product-details"]',
    titleSelector: '[data-test="@web/ProductCard/title"]',
    linkSelector: 'a[data-test="@web/ProductCard/title"], a[href*="/p/"]',
    priceSelector: '[data-test="current-price"]',
    cardSelectors: {
      inStock: [
        'button[data-test="shipItButton"]:not([disabled])',
        'button[data-test="orderPickupButton"]:not([disabled])',
        '[data-test="addToCartButton"]:not([disabled])',
      ],
      outOfStock: [
        '[data-test="soldOutMessage"]',
        '[data-test="outOfStockText"]',
        'button[data-test="shipItButton"][disabled]',
      ],
    },
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  },

  // ─── Best Buy ──────────────────────────────────────────────────────────────
  // Server-rendered + JS hydration. Clean class names.
  bestBuy: {
    enabled: true,
    baseUrl: 'https://www.bestbuy.com',
    delayMs: 3500, // sensitive to fast polling
    buildSearchUrl: (product) =>
      `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(product)}&cp=1&intl=nosplash`,
    // Best Buy redesigned search (2026): cards are .product-list-item, title is
    // .product-title, link is a.product-list-item-link. (The old .sku-item markup
    // is gone.) If card-level buy/sold-out selectors miss, the AI fallback reads
    // the card text — so detection still works even if these need re-tuning.
    waitSelector: '.product-list-item',
    productCardSelector: '.product-list-item',
    titleSelector: '.product-title, .sku-block-content-title',
    linkSelector: 'a.product-list-item-link, .product-title a',
    cardSelectors: {
      inStock: [
        '.add-to-cart-button:not(.btn-disabled)',
        'button[data-button-state="ADD_TO_CART"]',
      ],
      outOfStock: [
        '.add-to-cart-button.btn-disabled',
        '.sold-out-messaging',
        'button[data-button-state="SOLD_OUT"]',
      ],
    },
  },

  // ─── Walmart ───────────────────────────────────────────────────────────────
  // Most aggressive bot protection. Higher delay + AI fallback most likely here.
  walmart: {
    // DISABLED for the cloud bot: stealth clears it locally, but GitHub Actions'
    // datacenter IP gets 0 cards (blocked). Re-enable with a scraping API or a
    // self-hosted (residential-IP) runner. Still works if you run locally.
    enabled: false,
    baseUrl: 'https://www.walmart.com',
    delayMs: 5000, // Walmart rate-limits aggressively — keep this high
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
      '(KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
    },
    buildSearchUrl: (product) =>
      `https://www.walmart.com/search?q=${encodeURIComponent(product)}&sort=best_seller`,
    waitSelector: '[data-item-id]',
    productCardSelector: '[data-item-id]',
    titleSelector: 'a[link-identifier="productName"], span[data-automation-id="product-title"]',
    linkSelector: 'a[link-identifier="productName"]',
    cardSelectors: {
      // Walmart search tiles show a generic CTA on every result, so a positive
      // selector over-matches (everything reads "in stock"). Leave inStock empty
      // and let the AI fallback judge from the card text; only trust an explicit
      // out-of-stock marker.
      inStock: [],
      outOfStock: [
        '[data-automation-id="out-of-stock"]',
        '.out-of-stock-message',
      ],
    },
  },

  // ─── Amazon ──────────────────────────────────────────────────────────────
  // Heavy bot detection; loads via stealth from a residential IP (datacenter /
  // CI IPs may hit a CAPTCHA — that just yields 0 cards, never a false alert).
  // Search tiles show a price when available, so detection leans on the AI
  // fallback. NOTE: Amazon is marketplace-heavy, so items are often "in stock"
  // via third-party sellers at inflated prices — consider a price filter.
  amazon: {
    // DISABLED for the cloud bot: loads locally via stealth, but blocked from
    // GitHub Actions' datacenter IP. Re-enable with a scraping API / residential
    // runner. Still works if you run locally.
    enabled: false,
    baseUrl: 'https://www.amazon.com',
    delayMs: 4000,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    buildSearchUrl: (product) =>
      `https://www.amazon.com/s?k=${encodeURIComponent(product)}`,
    waitSelector: '[data-component-type="s-search-result"]',
    productCardSelector: '[data-component-type="s-search-result"]',
    titleSelector: 'h2 a span, h2 span',
    linkSelector: 'h2 a, a.a-link-normal.s-no-outline',
    priceSelector: '.a-price .a-offscreen',
    cardSelectors: {
      // No reliable positive add-to-cart on search tiles; the AI fallback judges
      // from card text (price shown = available; "Currently unavailable" = not).
      inStock: [],
      outOfStock: [],
    },
  },

  // ─── GameStop ────────────────────────────────────────────────────────────
  // Carries Pokemon TCG at retail; loads cleanly with stealth (lighter bot
  // protection than Walmart/Amazon — survives CI? watch the logs). Tiles don't
  // expose stock state, so the AI fallback judges from card text. Matching uses
  // the full tile text (no title selector); price comes from the tile text.
  gameStop: {
    enabled: true,
    baseUrl: 'https://www.gamestop.com',
    delayMs: 3500,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    buildSearchUrl: (product) =>
      `https://www.gamestop.com/search/?q=${encodeURIComponent(product)}`,
    waitSelector: '.product-tile',
    productCardSelector: '.product-tile',
    linkSelector: 'a[href*="/products/"]',
    // Skip graded singles — GameStop lists lots of PSA/CGC cards whose titles
    // contain the product words (e.g. "...Elite Trainer Box Miraidon PSA 9").
    excludePattern: 'graded|psa|cgc|bgs',
    cardSelectors: {
      inStock: [],
      outOfStock: [],
    },
  },
};
