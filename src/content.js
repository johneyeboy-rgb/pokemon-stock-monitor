/**
 * Follower-growth content
 *
 * A mixed pool of text posts and native polls, posted across a few slots per day
 * to keep the account active and drive engagement. Selection is deterministic by
 * (day, slot), so the pool cycles fully before anything repeats.
 *
 * Limits to respect: text posts under ~270 chars; poll options 2–4 items, each
 * ≤ 25 characters (X's limits).
 */

import { readFileSync, existsSync } from 'fs';

// Agent-written content queue (see content/queue.json). Optional — when empty,
// the pipeline falls back to the evergreen POSTS pool below.
const QUEUE_FILE = './content/queue.json';

// UTC hours the content jobs fire at (≈10am, 1pm, 4pm, 7pm, 9pm ET — spread
// across US active hours, evening-weighted). KEEP IN SYNC with the cron entries
// in .github/workflows/promo.yml.
export const SLOT_HOURS = [14, 17, 20, 23, 1];

// Each item is either:
//   { kind: 'text', text }
//   { kind: 'poll', text, options: [2–4 strings] }
export const POSTS = [
  { kind: 'text', text: "What was the first Pokémon TCG card that got you hooked? 🃏 Drop it below 👇 #PokemonTCG #Pokemon" },
  { kind: 'poll', text: "How do you keep your chase cards? 🛡️", options: ["PSA", "CGC", "Raw & loose", "Depends on the card"] },
  { kind: 'text', text: "Pull of the day energy ⚡ What's the best card you've pulled this week? #PokemonTCG #PokemonCards" },
  { kind: 'poll', text: "Sealed or open? 📦 Be honest.", options: ["Rip everything", "Keep it sealed", "A bit of both"] },
  { kind: 'text', text: "Reminder: the best card in your binder is the one you had fun pulling. Collect what you love 💛 #PokemonTCG" },
  { kind: 'poll', text: "Pull luck this month? 🍀", options: ["On fire 🔥", "Ice cold 🧊", "Pretty average", "Haven't opened any"] },
  { kind: 'text', text: "🔔 New here? This account posts Pokémon TCG restock alerts the moment products go live at major retailers. Follow + turn on notifications so you never miss a drop. #PokemonTCG #Restock" },
  { kind: 'text', text: "Charizard tax is real 🔥 What's a card you think is overpriced right now? #PokemonTCG #PokemonCards" },
  { kind: 'poll', text: "What do you open the most? 🎴", options: ["Booster boxes", "Elite Trainer Boxes", "Single packs", "I only buy singles"] },
  { kind: 'text', text: "Tip: sleeve + toploader your hits before they ever leave the pack. Protect those pulls 🛡️ #PokemonTCG" },
  { kind: 'poll', text: "Which do you chase hardest? ✨", options: ["Alt arts", "Full arts", "Gold/secret rares", "Vintage WOTC"] },
  { kind: 'text', text: "Which set has the best artwork of all time? I'll start: anything from the Galarian Gallery 🎨 #PokemonTCG" },
  { kind: 'poll', text: "Booster Bundle vs ETB — better value for the pulls? 🤔", options: ["Booster Bundle", "Elite Trainer Box", "Neither, singles"] },
  { kind: 'text', text: "Nothing beats the smell of a fresh booster pack. IYKYK 📦✨ #PokemonTCG" },
  { kind: 'text', text: "Underrated tip: check retailer restocks early morning — the good drops don't last ⏰ #PokemonTCG #Restock" },
  { kind: 'poll', text: "Your binder is sorted by… 📖", options: ["Set / number", "Type", "Rarity", "Pure vibes"] },
  { kind: 'text', text: "Hot take: the artwork era we're in right now is the best the TCG has ever had. Agree? 🎨 #PokemonTCG" },
  { kind: 'text', text: "First pack you ever opened — do you remember the set? 🕰️ #PokemonTCG #Pokemon" },
  { kind: 'poll', text: "Biggest flex in your collection? 💪", options: ["Graded Charizard", "Sealed vintage box", "A full master set", "Childhood cards"] },
  { kind: 'text', text: "Building a deck or building a collection? Both valid 🃏 What's your focus? #PokemonTCG" },
  { kind: 'text', text: "Missed a restock and paid scalper prices? 😤 Follow for instant alerts so it doesn't happen again. #PokemonTCG #Restock" },
  { kind: 'poll', text: "Grade or send it raw? 🎯", options: ["Grade the big hits", "Raw all the way", "Only vintage", "Never grade"] },
];

/**
 * Pick the post for a given day + slot. Cycles through the whole pool before
 * anything repeats.
 * @param {Date} date
 * @param {number} slotIndex
 * @param {number} slotCount
 * @returns {{kind:'text',text:string}|{kind:'poll',text:string,options:string[]}}
 */
export function pickPost(date = new Date(), slotIndex = 0, slotCount = SLOT_HOURS.length) {
  const dayIndex = Math.floor(date.getTime() / 86_400_000); // whole days since epoch
  const i = (dayIndex * slotCount + slotIndex) % POSTS.length;
  return POSTS[i];
}

/**
 * Load the agent-written content queue (array). Returns [] if missing/invalid.
 */
export function loadQueue() {
  try {
    if (!existsSync(QUEUE_FILE)) return [];
    const arr = JSON.parse(readFileSync(QUEUE_FILE, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch (err) {
    console.error('[content] Could not read queue.json:', err.message);
    return [];
  }
}

/**
 * Pick the next eligible queued post, or null if none.
 * Eligible = has id + text, not already posted, postAfter reached, not expired.
 * Items are considered in file order, so order them by priority.
 * @param {Date} now
 * @param {(id: string) => boolean} isPosted
 */
export function pickQueuedPost(now = new Date(), isPosted = () => false) {
  for (const item of loadQueue()) {
    if (!item || !item.id || !item.text) continue;
    if (isPosted(item.id)) continue;
    if (item.postAfter && new Date(item.postAfter) > now) continue;
    if (item.expires && new Date(item.expires) <= now) continue;
    return item;
  }
  return null;
}
