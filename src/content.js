/**
 * Daily follower-growth content
 *
 * A rotating pool of engagement posts (questions, tips, hot takes) to keep the
 * account active between restock alerts and grow an organic following.
 *
 * Selection is deterministic by calendar day, so the pool cycles fully before
 * any post repeats — edit / add freely. Keep each entry under 280 characters.
 */

export const DAILY_CONTENT = [
  "What was the first Pokémon TCG card that got you hooked? 🃏 Drop it below 👇 #PokemonTCG #Pokemon",
  "Pull of the day energy ⚡ What's the best card you've pulled this week? #PokemonTCG #PokemonCards",
  "Sealed or singles — which way do you collect? 📦 vs 🃏 #PokemonTCG #Pokemon",
  "Reminder: the best card in your binder is the one you had fun pulling. Collect what you love. 💛 #PokemonTCG",
  "Charizard tax is real 🔥 What's a card you think is overpriced right now? #PokemonTCG #PokemonCards",
  "Tip: sleeve + toploader your hits before they ever leave the pack. Protect those pulls 🛡️ #PokemonTCG",
  "Which set has the best artwork of all time? I'll start: anything from the Galarian Gallery 🎨 #PokemonTCG",
  "Booster Bundle vs Elite Trainer Box — better value for the pulls? 🤔 #PokemonTCG #Pokemon",
  "Grading check: PSA, CGC, or proudly raw? Where do you land? #PokemonTCG #PokemonCards",
  "Nothing beats the smell of a fresh booster pack. IYKYK 📦✨ #PokemonTCG",
  "What set are you chasing a master set of right now? 🎯 #PokemonTCG #Pokemon",
  "Underrated tip: check retailer restocks early morning — the good drops don't last ⏰ #PokemonTCG #Restock",
  "Your binder, your rules. Sort by type, set, or pure vibes? 📖 #PokemonTCG",
  "Hot take: the artwork era we're in right now is the best the TCG has ever had. Agree? 🎨 #PokemonTCG",
  "First pack you ever opened — do you remember the set? 🕰️ #PokemonTCG #Pokemon",
  "Building a deck or building a collection? Both valid 🃏 What's your focus? #PokemonTCG",
];

/**
 * Pick the post for a given day. Cycles through the whole pool before repeating.
 * @param {Date} date
 * @returns {string}
 */
export function pickDailyContent(date = new Date()) {
  const dayIndex = Math.floor(date.getTime() / 86_400_000); // whole days since epoch
  return DAILY_CONTENT[dayIndex % DAILY_CONTENT.length];
}
