/**
 * NPC Icon Resolver for Sunflower Land NPCs.
 * Renders local pixel-art animated WebP icons with graceful fallback to emojis.
 * Matches the proven implementation from Resource Tracker v1.
 */

export const AVAILABLE_NPCS = new Set([
  "adam", "bailey", "barlow", "bella", "bert", "betty", "billy", "birdie", "blacksmith",
  "boneyard_betty", "bruce", "buttercup", "buttons", "chaac", "chase", "chef_ebon",
  "chef_lumen", "chef_maple", "chef_tuck", "chicken", "chun_long", "cluck_e_cheese",
  "corale", "cornwell", "craig", "damien", "daphne", "digby", "dreadhorn", "dusk",
  "eins", "eldric", "elf", "evie", "farmer_flesh", "felga", "finley", "finn", "flopsy",
  "flora", "frankie", "gabi", "gambit", "garbo", "garth", "gaucho", "gilda", "ginger",
  "glinteye", "gloomwick", "goblet", "goldtooth", "gordo", "gordy", "gorga", "grabnab",
  "graxle", "greedclaw", "grimbly", "grimtooth", "grizzle", "grommy", "grubnuk",
  "gunter", "guria", "hammerin_harry", "hank", "haymitch", "hopper", "igor", "jafar",
  "jake", "jester", "lady_day", "luna", "marcus", "maximus", "mayor", "memory",
  "minewhack", "miranda", "misty", "misty_marvel", "murmur", "neville", "new_year_pete",
  "nyx", "old_salty", "orlin", "otis", "peggy", "pet", "petro", "phantom_face", "pharaoh",
  "pirate_skeleton", "poppy", "portaller", "pumpkin_pete", "raven", "reelin_roy",
  "reginald", "richie", "robert", "rocket_man", "santa", "shadow", "skelly_joe",
  "slime_jim", "slime_joe", "sofia", "solara", "stella", "stevie", "streamer", "tango",
  "timmy", "tywin", "vampire_jim", "victoria", "wanderleaf", "wizard", "wobble", "worried_pete"
]);

/**
 * Normalizes an NPC name or ID to the asset filename key.
 * e.g., "Pumpkin' Pete" -> "pumpkin_pete", "old salty" -> "old_salty"
 */
export function normalizeNpcKey(nameOrId) {
  if (!nameOrId || typeof nameOrId !== 'string') return '';
  return nameOrId.toLowerCase().trim().replace(/['\s-]+/g, '_');
}

/**
 * Returns the local asset path for an NPC icon, or null if not found.
 */
export function getNpcIconPath(nameOrId) {
  const key = normalizeNpcKey(nameOrId);
  if (AVAILABLE_NPCS.has(key)) {
    return `public/icons/npcs/${key}.webp`;
  }
  return null;
}

/**
 * Renders an HTML string for an NPC icon.
 * Includes pixelated rendering style, zero background, and fallback to emoji.
 */
export function getNpcIconHtml(nameOrId, options = {}) {
  const key = normalizeNpcKey(nameOrId);
  const fallback = options.fallbackEmoji || '🧑‍🌾';
  const size = options.size || 22;
  const sizeClass = options.className || '';
  const imgPath = getNpcIconPath(key);

  if (imgPath) {
    const escapedFallback = fallback.replace(/'/g, "\\'");
    return `<img src="${imgPath}" class="${sizeClass}" style="width:${size}px; height:${size}px; object-fit:contain; image-rendering:pixelated; vertical-align:middle; display:inline-block; background:transparent; border:none;" alt="${nameOrId}" loading="lazy" onerror="this.onerror=null;this.replaceWith(document.createTextNode('${escapedFallback}'));" />`;
  }

  return `<span class="${sizeClass}" style="display:inline-block; vertical-align:middle;">${fallback}</span>`;
}

if (typeof window !== 'undefined') {
  window.getNpcIconHtml = getNpcIconHtml;
  window.getNpcIconPath = getNpcIconPath;
}
