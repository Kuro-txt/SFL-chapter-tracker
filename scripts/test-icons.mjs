import fs from 'fs';
import { renderItemIcon, getItemIconUrl, normalizeItemKey, AVAILABLE_SLUGS } from '../js/item-icons.js';
import { getNpcIconHtml, getNpcIconPath, normalizeNpcKey, AVAILABLE_NPCS } from '../js/npc-icons.js';

console.log('🧪 Starting Automated Tests for Item & NPC Icons...');

// Test 1: Core Game Items exist and render transparent sprites
const coreItems = [
  'Wood', 'Stone', 'Iron', 'Gold', 'Sunflower', 'Potato', 'Pumpkin',
  'Axe', 'Pickaxe', 'Fishing Rod', 'Beetle Wing', 'Egg', 'Feather', 'Leather',
  'Milk', 'Wool', 'Pumpkin Soup', 'Pancakes'
];

let itemsPassed = 0;
for (const item of coreItems) {
  const url = getItemIconUrl(item);
  if (!url) {
    throw new Error(`Failed to resolve icon URL for core item: ${item}`);
  }
  if (!fs.existsSync(url)) {
    throw new Error(`File does not exist on disk: ${url} for ${item}`);
  }
  const html = renderItemIcon(item, '✨', 22);
  if (!html.includes('<img') || !html.includes(url) || !html.includes('background:transparent')) {
    throw new Error(`Invalid renderItemIcon HTML for ${item}: ${html}`);
  }
  itemsPassed++;
}
console.log(`✅ TEST 1 PASSED: All ${itemsPassed} core items resolve to transparent sprites on disk.`);

// Test 2: Fallback for unknown item
const fallbackHtml = renderItemIcon('Unknown Mystery Gem', '💎', 20);
if (fallbackHtml !== '💎') {
  throw new Error(`Fallback test failed: expected '💎', got '${fallbackHtml}'`);
}
console.log('✅ TEST 2 PASSED: Graceful emoji fallback for unknown items verified.');

// Test 3: NPC Icons exist and render animated WebP sprites
const coreNpcs = [
  'Pumpkin Pete', "Pumpkin' Pete", 'Betty', 'Blacksmith', 'Corale', 'Finn',
  'Old Salty', 'Gunter', 'Raven', 'Hank', 'Tango'
];

let npcsPassed = 0;
for (const npc of coreNpcs) {
  const path = getNpcIconPath(npc);
  if (!path) {
    throw new Error(`Failed to resolve NPC icon path for: ${npc}`);
  }
  if (!fs.existsSync(path)) {
    throw new Error(`File does not exist on disk: ${path} for NPC ${npc}`);
  }
  const html = getNpcIconHtml(npc, { size: 22 });
  if (!html.includes('<img') || !html.includes(path) || !html.includes('background:transparent')) {
    throw new Error(`Invalid getNpcIconHtml output for NPC ${npc}: ${html}`);
  }
  npcsPassed++;
}
console.log(`✅ TEST 3 PASSED: All ${npcsPassed} core NPCs resolve to animated sprites on disk.`);

// Test 4: Fallback for unknown NPC
const npcFallback = getNpcIconHtml('Unknown Alien Bumpkin', { fallbackEmoji: '👾' });
if (!npcFallback.includes('👾')) {
  throw new Error(`NPC fallback failed: expected '👾', got '${npcFallback}'`);
}
console.log('✅ TEST 4 PASSED: Graceful emoji fallback for unknown NPCs verified.');

console.log('\n🎉 ALL 4 ICON TESTS PASSED WITH 100% SUCCESS!');
