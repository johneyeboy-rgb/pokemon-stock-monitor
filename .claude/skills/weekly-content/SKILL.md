---
name: weekly-content
description: Generate the weekly Pokemon TCG social content queue for the restock bot. Researches upcoming restocks, Pokemon Center drop windows, and Pokemon TCG news, then drafts sourced X posts into content/queue.json for review. Use when the user wants to refresh the weekly content, fill the content queue, or plan the week's posts.
---

# Weekly content generator

Produce a week of timely X posts for the Pokemon restock bot and write them to
`content/queue.json` for the user to review. The bot drips these out across its
daily slots (queued items post before the evergreen pool). **You write the queue;
a human reviews the diff before it ships — never commit/push without approval.**

Read `content/README.md` first for the exact queue schema.

## Workflow

### 1. Establish the window
Determine today's date and plan for roughly the next **7–10 days**. Time-sensitive
posts must carry dates (see step 4).

### 2. Research (use web search — verify, don't guess)
Gather material in these buckets. **Every factual claim needs a credible source**
(official Pokemon channels, major retailers, reputable TCG news like Bulbapedia/
Bulbanews/PokeBeach). If you can't verify it, don't post it.
- **Upcoming restocks / releases** — known Pokemon TCG set releases, retailer
  restock dates or drop events in the window.
- **Pokemon Center drop window** — confirm the *current* typical day/time pattern
  (it changes; verify before claiming "Thursdays").
- **Pokemon / TCG news** — set reveals, official announcements, notable events.

### 3. Draft 8–12 posts, mixed
A good week blends:
- 2–4 **restock/release reminders** (date-targeted)
- 1–2 **drop-window / how-to tips** (e.g. PC timing)
- 1–3 **news** items (sourced, accurate)
- 2–3 **engagement** posts/polls (questions, "what are you chasing", etc.)
Don't try to fill every slot — the evergreen pool covers gaps. Keep at most ~1
follow/CTA post in the batch.

#### Writing news posts — more detail, not less
News posts should give followers actual substance, not just a headline:
- Include the set name, card count, notable chase cards or alt arts, retail price,
  and release date in 2–3 sentences.
- Explain *why it matters* for restock hunters — e.g. "high pull rate on alt arts
  means ETBs will sell out fast" or "bundle-only exclusives drive secondary prices."
- Cite the source naturally in the text ("via PokeBeach", "per the official reveal").

#### Writing tips — specific and actionable
Tips should be concrete enough to act on immediately:
- Instead of "check Target early" → "Target restocks usually go live between 6–8am
  ET — add to cart fast, checkout slows when servers spike."
- Instead of "watch for bundles" → "Booster Bundles sell out before ETBs at most
  retailers — they're cheaper and collectors skip them, so stock lasts ~10 min."
- Include the *why* behind the tip so it reads as insider knowledge, not generic advice.

#### Images
Queue items can carry an optional `image` field (a direct URL to attach to the post).
Include one when you can verify a public, high-quality image URL that matches the post:
- **Official product art** — Pokemon.com press images, retailer product images (Target/
  Best Buy CDN URLs from search results), or official social media post images.
- **Card art** — for notable card reveals, the official card image from the Pokemon
  TCG website or a reputable TCG database (e.g. Bulbapedia, TCGPlayer).
- **Only include URLs you have actually fetched and confirmed exist.** A broken image
  URL silently falls back to text-only (no error), but a wrong image looks unprofessional.
- Polls cannot have images — omit the field for poll items.
- Do not invent or guess image URLs. If you can't find a verified image, omit the field.

### 4. Dates & freshness (critical)
- For anything time-sensitive, set `postAfter` so it fires near the relevant day
  and `expires` so a stale reminder is never posted (e.g. a "drops Friday" post:
  `postAfter` Wed, `expires` Fri evening).
- Evergreen-ish posts (polls, tips) can omit dates.
- Order the array by priority — earlier = posted first when multiple are eligible.

### 5. Accuracy & ToS guardrails (non-negotiable)
- **Source facts.** Attribute where natural ("via PokeBeach"). Never fabricate
  dates, prices, or news.
- **Label uncertainty:** prefix unconfirmed items with "RUMOR (unconfirmed) —"
  and only if from a real source. Never invent leaks.
- "Typically"/"usually" for patterns, not false certainty.
- No misleading claims, no spam, no duplicated content.

### 6. Format constraints
- `id`: unique, date-prefixed (e.g. `2026-07-04-pc-window`).
- `text`: <= ~270 chars; tasteful hashtags (2–3 max).
- Polls: `kind: "poll"`, 2–4 `options`, each <= 25 chars. No `image` on polls.
- `image`: optional direct URL to a publicly accessible image (≤ 5 MB). Only include
  if you have verified the URL is live and shows the correct content.
- Valid JSON array. Validate it parses before writing.

### 7. Write + review (the approval gate)
1. Build the new queue array for the coming week. You may keep still-relevant,
   unexpired items from the current `content/queue.json`; drop expired ones.
2. Write it to `content/queue.json`.
3. Present a **summary table** of every drafted post (id, type, when it posts,
   source) and the raw JSON.
4. **Stop and ask the user to approve.** Only after they say yes, commit and push
   (`git add content/queue.json && git commit -F <msg> && git push`). If they want
   edits, revise and re-show. Never push unreviewed content.

## Notes
- Post budget is ~3/day; a dozen queued items per week is plenty (evergreen fills
  the rest). Don't overload.
- The bot dedups by `id`, so reusing an id will NOT repost — give genuinely new
  items fresh ids each week.
