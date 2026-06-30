# Content queue

Agent-written posts the bot drips out across its daily slots. When this queue is
empty (or every item is already posted / expired), the pipeline falls back to the
evergreen pool in `src/content.js`.

`queue.json` is a JSON **array** of items. The pipeline only *reads* it (never
writes it), so a weekly agent — or you — can regenerate it freely. Items are
considered in **array order (order = priority)**, one is posted per slot, and each
posts **at most once** (tracked by `id`).

## Item shape

```json
[
  {
    "id": "2026-07-04-pc-window",
    "kind": "text",
    "text": "Heads up: Pokémon Center usually restocks Thursday mornings (ET). Set an alarm ⏰ #PokemonTCG #Restock",
    "postAfter": "2026-07-01T00:00:00Z",
    "expires":   "2026-07-05T00:00:00Z"
  },
  {
    "id": "2026-07-07-chaos-rising-news",
    "kind": "text",
    "text": "Chaos Rising is out July 17 — the ME04 set brings 180+ cards including Mega Charizard ex and Mega Mewtwo ex alt arts. ETBs are $49.99 at retail. We'll be watching for restocks the moment they drop 👀 #PokemonTCG #ChaosRising",
    "image": "https://assets.pokemon.com/assets/cms2/img/cards/web/ME04/ME04_EN_1.png",
    "postAfter": "2026-07-07T00:00:00Z",
    "expires":   "2026-07-18T00:00:00Z"
  },
  {
    "id": "2026-07-02-poll-chase",
    "kind": "poll",
    "text": "What are you chasing this week? 🎯",
    "options": ["151 Bundle", "Prismatic ETB", "Surging Sparks", "Singles"]
  }
]
```

## Fields

| Field | Required | Notes |
|---|---|---|
| `id` | ✅ | Unique string. Used for dedup — reusing an id means it won't post again. |
| `text` | ✅ | The post body. Keep under ~270 chars. |
| `kind` | – | `"text"` (default) or `"poll"`. |
| `options` | poll only | 2–4 choices, each ≤ 25 chars. |
| `image` | – | Direct URL to an image to attach. Must be publicly accessible, ≤ 5 MB. Best-effort — falls back to text-only if the URL fails to load. Only include URLs you have verified exist. |
| `postAfter` | – | ISO date/time. Item is ineligible until now ≥ this. |
| `expires` | – | ISO date/time. Item is skipped once now ≥ this (freshness guard). |

## Rules of thumb
- For **time-sensitive** posts (restock reminders), set `postAfter` so it fires
  near the relevant day and `expires` so a stale reminder never goes out.
- Polls need 2–4 `options`.
- **Always source/verify facts** (news, dates, drop windows) before queuing —
  these post unattended once committed.
