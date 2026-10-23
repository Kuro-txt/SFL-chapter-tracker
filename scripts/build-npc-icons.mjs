import fs from 'fs';
import path from 'path';

const tokensPath = path.resolve('data/npc-tokens.json');
const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));

const code = `/**
 * NPC Icon Resolver for Sunflower Land NPCs.
 * Renders pixel-art animated WebP icons from Sunflower Land's official animation CDN
 * with seamless fallback to local cached assets and emojis.
 * Matches the reference architecture from eliasSFL/sunflower-land-overview.
 */

export const NPC_TOKENS = ${JSON.stringify(tokens, null, 2)};

export const AVAILABLE_NPCS = new Set(Object.keys(NPC_TOKENS));

/**
 * Normalizes an NPC name or ID to the canonical asset/token key.
 * e.g., "Pumpkin' Pete" -> "pumpkin_pete", "Old Salty" -> "old_salty"
 */
export function normalizeNpcKey(nameOrId) {
  if (!nameOrId || typeof nameOrId !== 'string') return '';
  return nameOrId.toLowerCase().trim().replace(/['\\s-]+/g, '_');
}

/**
 * Returns the local asset path for an NPC icon, or null if not found.
 */
export function getNpcIconPath(nameOrId) {
  const key = normalizeNpcKey(nameOrId);
  if (AVAILABLE_NPCS.has(key)) {
    return \`public/icons/npcs/\${key}.webp\`;
  }
  return null;
}

/**
 * Returns the official Sunflower Land CDN URL for the bumpkin's animated webp.
 * Format: https://animations.sunflower-land.com/animated_webp/0_v1_\${token}/idle-small
 */
export function getNpcCdnUrl(nameOrId) {
  const key = normalizeNpcKey(nameOrId);
  const token = NPC_TOKENS[key];
  if (token) {
    return \`https://animations.sunflower-land.com/animated_webp/0_v1_\${token}/idle-small\`;
  }
  return null;
}

/**
 * Renders an HTML string for an NPC icon.
 * Includes pixelated rendering style, zero background, and multi-tier fallback:
 * 1. Primary local/CDN asset
 * 2. Alternate static path (/icons/ vs public/icons/)
 * 3. CDN animation fallback
 * 4. High-contrast bumpkin farmer emoji
 *
 * @param {string} nameOrId - NPC name (e.g. "Pumpkin' Pete", "Bert", "Raven")
 * @param {object} options - { size = 24, className = '', fallbackEmoji = '🧑‍🌾' }
 * @returns {string} HTML string
 */
export function getNpcIconHtml(nameOrId, options = {}) {
  const key = normalizeNpcKey(nameOrId);
  const fallback = options.fallbackEmoji || '🧑‍🌾';
  const size = options.size || 24;
  const sizeClass = options.className || '';
  const imgPath = getNpcIconPath(key);
  const token = NPC_TOKENS[key] || '';
  const cdnUrl = token ? \`https://animations.sunflower-land.com/animated_webp/0_v1_\${token}/idle-small\` : '';

  if (imgPath || cdnUrl) {
    const primarySrc = imgPath || cdnUrl;
    const escapedFallback = fallback.replace(/'/g, "\\\\'");
    const onErrorJs = \`if(!this.dataset.triedFallback){this.dataset.triedFallback='1';if(this.src.includes('public/icons/')){this.src=this.src.replace('public/icons/','icons/');}else if('\${cdnUrl}' && !this.src.includes('animations.sunflower-land.com')){this.src='\${cdnUrl}';}else{this.onerror=null;this.replaceWith(document.createTextNode('\${escapedFallback}'));}}else if(!this.dataset.triedCdn && '\${cdnUrl}' && !this.src.includes('animations.sunflower-land.com')){this.dataset.triedCdn='1';this.src='\${cdnUrl}';}else{this.onerror=null;this.replaceWith(document.createTextNode('\${escapedFallback}'));}\`;

    return \`<img src="\${primarySrc}" class="sfl-npc-avatar \${sizeClass}" width="\${size}" height="\${size}" alt="\${nameOrId}" decoding="async" onerror="\${onErrorJs}" style="width:\${size}px; height:\${size}px; object-fit:contain; image-rendering:pixelated; vertical-align:middle; display:inline-block; background:transparent; border:none;" />\`;
  }

  return \`<span class="\${sizeClass}" style="display:inline-block; vertical-align:middle; font-size:\${Math.round(size * 0.75)}px;">\${fallback}</span>\`;
}

if (typeof window !== 'undefined') {
  window.getNpcIconHtml = getNpcIconHtml;
  window.getNpcIconPath = getNpcIconPath;
  window.getNpcCdnUrl = getNpcCdnUrl;
  window.normalizeNpcKey = normalizeNpcKey;
  window.NPC_TOKENS = NPC_TOKENS;
}
`;

fs.writeFileSync(path.resolve('js/npc-icons.js'), code, 'utf8');
console.log('✅ js/npc-icons.js generated with 124 NPC tokens!');
