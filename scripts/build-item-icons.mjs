import fs from 'fs';
import path from 'path';

// 1. Collect all available icon files from public/icons recursively
const publicFiles = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name).replace(/\\/g, '/');
    if (f.isDirectory()) walk(full);
    else if (/\.(webp|png|svg|jpg)$/i.test(f.name)) publicFiles.push(full);
  }
}
walk('public/icons');

const assetIcons = fs.existsSync('assets/icons')
  ? fs.readdirSync('assets/icons').filter(f => /\.(webp|png)$/i.test(f)).map(f => `assets/icons/${f}`)
  : [];

function normalizeKey(str) {
  if (!str) return '';
  return str.replace(/\[.*?\]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

const map = {};

// Register public/icons first
for (const file of publicFiles) {
  const baseName = path.basename(file).replace(/\.(webp|png|svg|jpg)$/i, '');
  const key = normalizeKey(baseName);
  if (!map[key]) {
    map[key] = file;
  }
}

// Register assets/icons (priority for tickets, currency & chapter UI)
for (const file of assetIcons) {
  const baseName = path.basename(file).replace(/\.(webp|png)$/i, '');
  const key = normalizeKey(baseName);
  map[key] = file;
}

// Explicit canonical overrides & aliases
const overrides = {
  // Current Chapter ticket (Shiny Feather) & Next Chapter (Beetle Wing)
  "shinyfeather": "assets/icons/shiny_feather.webp",
  "shinyfeathers": "assets/icons/shiny_feather.webp",
  "ticket": "assets/icons/shiny_feather.webp",
  "tickets": "assets/icons/shiny_feather.webp",
  "chapterticket": "assets/icons/shiny_feather.webp",
  "chaptertickets": "assets/icons/shiny_feather.webp",
  "beetlewing": "assets/icons/beetle_wing.webp",
  "beetlewings": "assets/icons/beetle_wing.webp",
  "bettlewing": "assets/icons/beetle_wing.webp",
  "bettlewings": "assets/icons/beetle_wing.webp",
  "cavedwellersraffle": "assets/icons/cave_dwellers_raffle_ticket.png",
  "ascensionageraffle": "assets/icons/ascension_age_raffle_ticket.png",
  "cavedwellerspoints": "assets/icons/chapter_points.webp",
  "cavedwellerpoints": "assets/icons/chapter_points.webp",
  "chapterpoints": "assets/icons/chapter_points.webp",
  "coins": "assets/icons/coins.webp",
  "coin": "assets/icons/coins.webp",
  "sfl": "assets/icons/sfl.webp",
  "flowertoken": "assets/icons/sfl.webp",
  "feather": "public/icons/animals/feather.webp",
  "wood": "public/icons/wood.png",
  "stone": "public/icons/stone.png",
  "iron": "public/icons/iron.png",
  "gold": "public/icons/gold.png",
  "crimstone": "public/icons/crimstone.png",
  "crimsonstone": "public/icons/crimstone.png",
  "sunstone": "public/icons/sunstone.png",
  "honey": "public/icons/honey.png",
  "oil": "public/icons/oil.webp",
  "salt": "public/icons/salt.webp",
  "sand": "public/icons/sand.webp",
  "gem": "public/icons/gem.webp",
  "gems": "public/icons/gem.webp",
  "obsidian": "public/icons/obsidian.webp",
  "egg": "public/icons/animals/egg.png",
  "eggs": "public/icons/animals/egg.png",
  "milk": "public/icons/animals/milk.webp",
  "wool": "public/icons/animals/wool.webp",
  "leather": "public/icons/animals/leather.webp",
  "merinowool": "public/icons/animals/merino_wool.webp",

  // Recipe typo & variant aliases
  "chioggia": map["chiogga"] || "public/icons/chiogga.png",
  "spaghetttiallimone": map["spaghettiallimone"] || "public/icons/spaghetti_al_limone.webp",
  "powersmothie": map["powersmoothie"] || "public/icons/food/power_smoothie.png",
  "purplesmoothies": map["purplesmoothie"] || "public/icons/food/purple_smoothie.png",
  "olivefounder": map["oliveflounder"] || "public/icons/fish/olive_flounder.png",
  "syntheticfibre": map["syntheticfabric"] || "public/icons/processed/crab_stick.webp",
  "treasurecrab": map["bluecrab"] || "public/icons/blue_crab.webp",
  "goblinsbrunch": map["goblinbrunch"] || map["bumpkinroast"] || "public/icons/food/bumpkin_roast.png",
  "oil1": "public/icons/oil.webp",
  "oil503harvest": "public/icons/oil.webp",
  "mackerel": map["horsemackerel"] || "public/icons/horse_mackerel.png"
};

for (const [k, v] of Object.entries(overrides)) {
  if (v) map[k] = v;
}

// Sort keys alphabetically
const sortedMap = {};
for (const k of Object.keys(map).sort()) {
  sortedMap[k] = map[k];
}

const fallbackEmojis = {
  "wood": "🪵", "stone": "🪨", "iron": "⛓️", "gold": "🪙", "crimstone": "💎",
  "sunstone": "☀️", "obsidian": "⬛", "oil": "🛢️", "salt": "🧂", "honey": "🍯",
  "sunflower": "🌻", "potato": "🥔", "pumpkin": "🎃", "carrot": "🥕", "cabbage": "🥬",
  "beetroot": "🟣", "cauliflower": "🥦", "parsnip": "🥕", "eggplant": "🍆", "corn": "🌽",
  "radish": "🔴", "wheat": "🌾", "kale": "🥬", "soybean": "🫘", "barley": "🌾",
  "rhubarb": "🌱", "zucchini": "🥒", "yam": "🍠", "broccoli": "🥦", "pepper": "🌶️",
  "onion": "🧅", "turnip": "🪴", "artichoke": "🌿", "apple": "🍎", "orange": "🍊",
  "blueberry": "🫐", "banana": "🍌", "lemon": "🍋", "tomato": "🍅", "grape": "🍇",
  "olive": "🫒", "rice": "🌾", "egg": "🥚", "feather": "🪶", "shinyfeather": "🪶", "leather": "👞",
  "milk": "🥛", "wool": "🧶", "merinowool": "🐑", "axe": "🪓", "pickaxe": "⛏️",
  "fishingrod": "🎣", "rod": "🎣", "beetlewing": "🪲", "coins": "🪙", "coin": "🪙",
  "sfl": "🌻", "flowertoken": "🌻", "cavedwellerspoints": "👑", "ticket": "🪶", "tickets": "🪶"
};

const code = `// Sunflower Land Item Icon Resolver (Resource Tracker v1 & Upstream Full Map)
// Transparent pixel-art game sprites with seamless fallback to emojis.

export function normalizeItemKey(rawInput) {
  if (!rawInput) return '';
  const str = typeof rawInput === 'object' ? (rawInput.item || rawInput.name || '') : String(rawInput);
  return str.replace(/\\[.*?\\]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

export const ITEM_IMAGE_PATHS = ${JSON.stringify(sortedMap, null, 2)};

export const FALLBACK_EMOJIS = ${JSON.stringify(fallbackEmojis, null, 2)};

// Aliases for slug compatibility
export const AVAILABLE_SLUGS = new Set(Object.keys(ITEM_IMAGE_PATHS));

export function getItemIconSlug(name) {
  return normalizeItemKey(name);
}

export function getItemIconUrl(name) {
  const key = normalizeItemKey(name);
  return ITEM_IMAGE_PATHS[key] || '';
}

/**
 * Returns current active chapter ticket slug ('shiny_feather' or 'beetle_wing')
 */
export function getChapterTicketName() {
  if (typeof window !== 'undefined' && window.state && window.state.globalData) {
    const ch = (window.state.globalData.chapter?.name || window.state.globalData.chapterName || '').toLowerCase();
    if (ch.includes('cave')) {
      return 'beetle_wing';
    }
  }
  return 'shiny_feather';
}

/**
 * Renders an in-game item icon with zero background and bulletproof fallback to emoji.
 *
 * @param {string} name - Item name (e.g., 'Wood', 'Stone', 'Shiny Feather', 'Beetle Wing')
 * @param {string|number} fallbackEmoji - Emoji fallback if icon not found (or size if 2nd arg)
 * @param {number} size - Desired pixel size (e.g., 16, 18, 20 or 24)
 * @param {string} extraClass - Additional CSS class name
 * @returns {string} HTML string
 */
export function renderItemIcon(name, fallbackEmoji = '✨', size = 20, extraClass = '') {
  if (typeof fallbackEmoji === 'number') {
    size = fallbackEmoji;
    fallbackEmoji = '✨';
  }

  const numSize = parseInt(size, 10) || 20;
  const key = normalizeItemKey(name);
  const safeFallback = typeof fallbackEmoji === 'string' ? fallbackEmoji : (FALLBACK_EMOJIS[key] || '✨');
  const url = ITEM_IMAGE_PATHS[key];

  if (!url) {
    return safeFallback;
  }

  const escapedFallback = safeFallback.replace(/'/g, "\\\\'");
  const onErrorJs = \`if(!this.dataset.triedAlt){this.dataset.triedAlt='1';if(this.src.includes('public/icons/')){this.src=this.src.replace('public/icons/','icons/');}else{this.onerror=null;this.replaceWith(document.createTextNode('\${escapedFallback}'));}}else{this.onerror=null;this.replaceWith(document.createTextNode('\${escapedFallback}'));}\`;

  return \`<img src="\${url}" alt="\${name}" width="\${numSize}" height="\${numSize}" class="sfl-item-icon \${extraClass}" onerror="\${onErrorJs}" style="width:\${numSize}px; height:\${numSize}px; object-fit:contain; image-rendering:pixelated; vertical-align:middle; display:inline-block; background:transparent; border:none;" loading="lazy" />\`;
}

/**
 * Renders the chapter ticket icon for the currently active chapter.
 * Current: Shiny Feather (🪶), Next Chapter: Beetle Wing (🪲).
 */
export function renderChapterTicketIcon(size = 16) {
  const ticketSlug = getChapterTicketName();
  return renderItemIcon(ticketSlug, '🪶', size);
}

/**
 * Renders a structured or string recipe of required items with inline pixel-art sprites.
 * Matches the delivery ingredient format from eliasSFL/sunflower-land-overview.
 *
 * @param {string|Array|Object} items - e.g. "20x Wood, 10x Stone" or [{ name: "Wood", qty: 20 }] or { Wood: 20 }
 * @param {number} iconSize - Size of each inline icon in px (default 16)
 * @returns {string} HTML string
 */
export function renderRequestedItemsHtml(items, iconSize = 16) {
  if (!items) return '';

  let parsedItems = [];

  if (Array.isArray(items)) {
    parsedItems = items.map(it => {
      if (typeof it === 'string') {
        const m = it.trim().match(/^(\\d+(?:\\.\\d+)?)\\s*(?:x\\s*)?(.+)$/i);
        return m ? { qty: m[1], name: m[2].trim() } : { qty: '', name: it.trim() };
      }
      return { qty: it.qty || it.amount || 1, name: it.name || it.item || '' };
    });
  } else if (typeof items === 'object') {
    parsedItems = Object.entries(items).map(([name, qty]) => ({
      qty,
      name
    }));
  } else if (typeof items === 'string') {
    const parts = items.split(/[,;]/);
    parsedItems = parts.map(p => {
      const trimmed = p.trim();
      const m = trimmed.match(/^(\\d+(?:\\.\\d+)?)\\s*(?:x\\s*)?(.+)$/i);
      return m ? { qty: m[1], name: m[2].trim() } : { qty: '', name: trimmed };
    }).filter(p => p.name);
  }

  if (parsedItems.length === 0) return '';

  return parsedItems.map(it => {
    const iconHtml = renderItemIcon(it.name, '📦', iconSize, 'ingredient-icon');
    const qtyText = it.qty ? \`\${it.qty}x \` : '';
    return \`<span class="delivery-ingredient-badge" style="display:inline-flex; align-items:center; gap:3px; background:rgba(0,0,0,0.05); padding:2px 6px; border-radius:4px; font-size:10.5px; font-weight:600; color:#5D4037; border:1px solid rgba(139,69,19,0.12); margin-right:4px; margin-bottom:2px;">\${iconHtml}<span>\${qtyText}\${it.name}</span></span>\`;
  }).join(' ');
}

if (typeof window !== 'undefined') {
  window.renderItemIcon = renderItemIcon;
  window.renderRequestedItemsHtml = renderRequestedItemsHtml;
  window.renderChapterTicketIcon = renderChapterTicketIcon;
  window.getChapterTicketName = getChapterTicketName;
  window.getItemIconUrl = getItemIconUrl;
  window.normalizeItemKey = normalizeItemKey;
}
`;

fs.writeFileSync('js/item-icons.js', code, 'utf8');
console.log(`✅ Generated js/item-icons.js with ${Object.keys(sortedMap).length} mapped items!`);
