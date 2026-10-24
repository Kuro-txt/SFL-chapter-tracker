// Sunflower Land Item Icon Resolver (Resource Tracker v1 & Upstream Full Map)
// Transparent pixel-art game sprites with seamless fallback to emojis.

export function normalizeItemKey(rawInput) {
  if (!rawInput) return '';
  const str = typeof rawInput === 'object' ? (rawInput.item || rawInput.name || '') : String(rawInput);
  return str.replace(/\[.*?\]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

import { ITEM_IMAGE_PATHS, FALLBACK_EMOJIS } from './item-maps.js';
export { ITEM_IMAGE_PATHS, FALLBACK_EMOJIS } from './item-maps.js';

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

  const escapedFallback = safeFallback.replace(/'/g, "\\'");
  const onErrorJs = `if(!this.dataset.triedAlt){this.dataset.triedAlt='1';if(this.src.includes('public/icons/')){this.src=this.src.replace('public/icons/','icons/');}else{this.onerror=null;this.replaceWith(document.createTextNode('${escapedFallback}'));}}else{this.onerror=null;this.replaceWith(document.createTextNode('${escapedFallback}'));}`;

  return `<img src="${url}" alt="${name}" width="${numSize}" height="${numSize}" class="sfl-item-icon ${extraClass}" decoding="async" onerror="${onErrorJs}" style="width:${numSize}px; height:${numSize}px; object-fit:contain; image-rendering:pixelated; vertical-align:middle; display:inline-block; background:transparent; border:none;" />`;
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
        const m = it.trim().match(/^(\d+(?:\.\d+)?)\s*(?:x\s*)?(.+)$/i);
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
      const m = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:x\s*)?(.+)$/i);
      return m ? { qty: m[1], name: m[2].trim() } : { qty: '', name: trimmed };
    }).filter(p => p.name);
  }

  if (parsedItems.length === 0) return '';

  return parsedItems.map(it => {
    const iconHtml = renderItemIcon(it.name, '📦', iconSize, 'ingredient-icon');
    const qtyText = it.qty ? `${it.qty}x ` : '';
    return `<span class="delivery-ingredient-badge" style="display:inline-flex; align-items:center; gap:3px; background:rgba(0,0,0,0.05); padding:2px 6px; border-radius:4px; font-size:10.5px; font-weight:600; color:#5D4037; border:1px solid rgba(139,69,19,0.12); margin-right:4px; margin-bottom:2px;">${iconHtml}<span>${qtyText}${it.name}</span></span>`;
  }).join(' ');
}

/**
 * Renders the official in-game animal sprite (Chicken, Cow, Sheep) for Animal Bounties.
 *
 * @param {string|object} nameOrItem - e.g. "Cow Level 2", "Sheep Lvl 1", "Chicken"
 * @param {number} size - Desired pixel size (default 22)
 * @returns {string} HTML string
 */
export function renderAnimalIcon(nameOrItem, size = 22) {
  const raw = typeof nameOrItem === 'object' && nameOrItem !== null ? (nameOrItem.name || '') : String(nameOrItem || '');
  const clean = raw.toLowerCase();
  if (clean.includes('chicken')) {
    return renderItemIcon('chicken', '🐔', size);
  }
  if (clean.includes('sheep')) {
    return renderItemIcon('sheep', '🐑', size);
  }
  if (clean.includes('cow') || clean.includes('bull')) {
    return renderItemIcon('cow', '🐄', size);
  }
  return renderItemIcon('cow', '🐄', size);
}

if (typeof window !== 'undefined') {
  window.renderItemIcon = renderItemIcon;
  window.renderAnimalIcon = renderAnimalIcon;
  window.renderRequestedItemsHtml = renderRequestedItemsHtml;
  window.renderChapterTicketIcon = renderChapterTicketIcon;
  window.getChapterTicketName = getChapterTicketName;
  window.getItemIconUrl = getItemIconUrl;
  window.normalizeItemKey = normalizeItemKey;
}
