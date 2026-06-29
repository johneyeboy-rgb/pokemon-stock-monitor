---
name: update-watchlist
description: Research and update the restock monitor's product watch list (config/watchlist.json). Finds newly released or upcoming sealed Pokemon TCG products, sets accurate search names + MSRP, proposes additions and prunes stale ones for review. Use when the user wants to add products to monitor, refresh the watch list, or check for new sealed releases worth tracking.
---

# Watch-list updater

Keep the restock monitor watching the *current* in-demand sealed products. Research
new releases, propose additions (and prunes), and — after the user approves — write
`config/watchlist.json`. **You propose; a human reviews the diff before it ships.**

Read `config/README.md` for the schema and `config/watchlist.json` for what's
already tracked.

## Workflow

### 1. Review the current list
Read `config/watchlist.json`. Note what's tracked and which sets are getting old.

### 2. Research (web search — verify, don't guess)
Find **sealed** Pokemon TCG products worth monitoring:
- Recently released or upcoming (next ~1–2 months) sets and their sealed products:
  Elite Trainer Boxes, Booster Bundles, Booster Boxes, Premium Collections, tins.
- Favor products that actually sell out / are in demand — the point is restock
  alerts, not cataloguing everything.
Use the official release calendar + reputable TCG news. **Every MSRP and release
fact needs a credible source.**

### 3. Build each candidate
For each product to add:
- **name** — the exact search string. Make it **specific to one sealed product**,
  using words retailers actually put in listings. AVOID vague/subset names that
  match singles or the wrong variant. Lessons learned:
  - "Crown Zenith Galarian Gallery" matched graded single cards — use the real
    sealed product (e.g. "Pokemon Crown Zenith Elite Trainer Box").
  - "151 Booster Bundle" must not collapse to "151 Booster Pack" (different product).
  Include the set/line + the product type.
- **msrp** — US retail price (number), sourced.

### 4. Curate
- **Sealed only** — no singles, no graded.
- Propose **prunes**: old sets no longer chased. Keep the list to ~6–10 products —
  every entry is checked at every retailer every 5 minutes, so the list is a
  cost/runtime budget, not a dumping ground.

### 5. Present + approve (the gate)
Show a table of the **proposed final watch list** (name, msrp, and add / keep /
remove) with a source and one-line reasoning per change. **Stop and ask the user
to approve.** Only after they say yes:
1. Write the new array to `config/watchlist.json` (valid JSON; validate it parses).
2. Strongly suggest a dry-run sanity check before/after pushing:
   `DRY_RUN=1 npm start` — posts nothing, and the `[diag]` lines + match results
   confirm each new name finds the *right* sealed product at a retailer.
3. Commit and push. Never push an unreviewed list.

## Notes
- If a name might be ambiguous, flag it and suggest a more specific alternative.
- The matcher needs ~80% token overlap with the listing title — names that are too
  long or contain words retailers omit can *fail* to match, so keep them tight.
- Pair this with `/weekly-content` for a single weekly maintenance session.
