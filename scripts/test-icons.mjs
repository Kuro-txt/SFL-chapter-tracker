import fs from 'fs';
import { 
  renderItemIcon, 
  getItemIconUrl, 
  normalizeItemKey, 
  AVAILABLE_SLUGS, 
  renderRequestedItemsHtml,
  renderChapterTicketIcon,
  getChapterTicketName
} from '../js/item-icons.js';
import { getNpcIconHtml, getNpcIconPath, getNpcCdnUrl, normalizeNpcKey, AVAILABLE_NPCS, NPC_TOKENS } from '../js/npc-icons.js';

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

// Test 5: Ingredient Recipe Parser & Inline Sprites (renderRequestedItemsHtml)
const testRecipeStr = "20x Wood, 10x Stone, 5 Gold";
const renderedStr = renderRequestedItemsHtml(testRecipeStr, 14);
if (!renderedStr.includes('delivery-ingredient-badge') || !renderedStr.includes('20x Wood') || !renderedStr.includes('10x Stone')) {
  throw new Error(`renderRequestedItemsHtml failed on string input: ${renderedStr}`);
}

const testRecipeArr = [{ name: 'Sunflower', qty: 100 }, { name: 'Potato', qty: 50 }];
const renderedArr = renderRequestedItemsHtml(testRecipeArr, 16);
if (!renderedArr.includes('100x Sunflower') || !renderedArr.includes('50x Potato')) {
  throw new Error(`renderRequestedItemsHtml failed on array input: ${renderedArr}`);
}
console.log('✅ TEST 5 PASSED: Delivery ingredient parser renders inline pixel-art badges for strings and arrays.');

// Test 6: Sunflower Land CDN Token Generator for all 11 Delivery NPCs
const deliveryNpcNames = [
  "pumpkin_pete", "bert", "finley", "miranda", "cornwell",
  "raven", "jester", "finn", "timmy", "pharaoh", "tywin"
];
for (const dNpc of deliveryNpcNames) {
  const cdnUrl = getNpcCdnUrl(dNpc);
  if (!cdnUrl || !cdnUrl.startsWith('https://animations.sunflower-land.com/animated_webp/0_v1_')) {
    throw new Error(`Invalid CDN URL for ${dNpc}: ${cdnUrl}`);
  }
}
console.log('✅ TEST 6 PASSED: All 11 chapter delivery NPCs resolve official animation CDN URLs.');

// Test 7: Current Chapter Ticket (Shiny Feather) & Next Chapter (Beetle Wing)
const currentTicketName = getChapterTicketName();
if (currentTicketName !== 'shiny_feather') {
  throw new Error(`Expected current chapter ticket to be shiny_feather, got: ${currentTicketName}`);
}
const shinyFeatherUrl = getItemIconUrl('shiny_feather');
if (!fs.existsSync(shinyFeatherUrl)) {
  throw new Error(`Shiny feather asset missing on disk: ${shinyFeatherUrl}`);
}
const beetleWingUrl = getItemIconUrl('beetle_wing');
if (!fs.existsSync(beetleWingUrl)) {
  throw new Error(`Beetle wing asset missing on disk: ${beetleWingUrl}`);
}
const ticketHtml = renderChapterTicketIcon(16);
if (!ticketHtml.includes('shiny_feather.webp')) {
  throw new Error(`renderChapterTicketIcon did not render shiny_feather: ${ticketHtml}`);
}
console.log('✅ TEST 7 PASSED: Current ticket (Shiny Feather) and next chapter ticket (Beetle Wing) correctly verified on disk.');

console.log('\n🎉 ALL 7 ICON & AVATAR TESTS PASSED WITH 100% SUCCESS!');
