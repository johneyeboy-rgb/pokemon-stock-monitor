# Watch list

The products the restock monitor checks at every retailer, every run. Edit this
file (or have the `/update-watchlist` agent edit it) to add/remove products —
`src/index.js` reads it. A built-in default is used if this file is missing or
invalid, so a bad edit can't silently stop monitoring.

`watchlist.json` is a JSON **array** of products.

## Item shape

```json
[
  { "name": "Pokemon 151 Booster Bundle", "msrp": 29.99 }
]
```

## Fields

| Field | Required | Notes |
|---|---|---|
| `name` | ✅ | The search term used at each retailer AND matched against result titles (token overlap ≥ 0.8). Make it **specific to a sealed product** — vague/subset names match the wrong thing (e.g. "Galarian Gallery" matched single cards; "151 Booster Bundle" must not collapse to a "Booster Pack"). |
| `msrp` | ✅ | US retail price (number). Drives the price filter: alerts fire only at ≤ `msrp` × 1.4 (40% over MSRP), which screens out scalper/marketplace listings. |

## Rules of thumb
- **Sealed products only** (ETBs, booster bundles/boxes, premium collections, tins) — not singles or graded cards.
- Keep the list **curated** (~6–10). Every product is checked at every retailer every 5 minutes, so more products = more runtime + AI-classifier cost. Prune sets nobody's chasing.
- After editing, sanity-check with a dry run: `DRY_RUN=1 npm start` (posts nothing; shows what each name matches).
