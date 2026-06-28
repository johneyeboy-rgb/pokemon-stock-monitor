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
    // DISABLED: Cloudflare returns HTTP 403 to headless Chromium. Needs a stealth
    // plugin, residential proxies, or a scraping API. Re-enable once you have one.
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
    // DISABLED: serves a "Robot or human?" bot-challenge page to headless
    // Chromium. Needs heavier anti-bot tooling. Re-enable once you have one.
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
      inStock: [
        '[data-automation-id="add-to-cart-btn"]',
        '[data-automation-id="addToCartButton"]',
      ],
      outOfStock: [
        '[data-automation-id="out-of-stock"]',
        '.out-of-stock-message',
      ],
    },
  },
};
