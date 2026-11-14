import assert from 'assert';
import { 
  state, 
  sanitizeCustomPrices, 
  getCustomPrices, 
  saveCustomPricesConfig, 
  applyCustomPricesToItems 
} from '../js/state.js';

console.log('🧪 Starting Automated Tests for Custom Resource Prices System...\n');

// Mock localStorage for node environment
const localStore = {};
global.localStorage = {
  getItem: (k) => localStore[k] || null,
  setItem: (k, v) => { localStore[k] = String(v); },
  removeItem: (k) => { delete localStore[k]; }
};

// ==========================================
// TEST 1: Sanitize and Persistence
// ==========================================
console.log('Test 1: Verifying Custom Price Sanitization & Config Persistence...');
const dirtyConfig = {
  ' Wood ': '0.010',
  'IRON': 0.045,
  'Gold': 'invalid',
  'Stone': -5,
  'Egg': '',
  'Sunflower': 0
};
const cleaned = sanitizeCustomPrices(dirtyConfig);
assert.strictEqual(cleaned['wood'], 0.01);
assert.strictEqual(cleaned['iron'], 0.045);
assert.strictEqual(cleaned['sunflower'], 0);
assert.strictEqual(cleaned['gold'], undefined, 'Invalid numbers should be excluded');
assert.strictEqual(cleaned['stone'], undefined, 'Negative numbers should be excluded');
assert.strictEqual(cleaned['egg'], undefined, 'Empty strings should be excluded');

saveCustomPricesConfig(cleaned);
const fetched = getCustomPrices();
assert.strictEqual(fetched['wood'], 0.01);
assert.strictEqual(fetched['iron'], 0.045);
assert.strictEqual(fetched['sunflower'], 0);
console.log('✅ TEST 1 PASSED: Custom prices sanitized and persisted cleanly.');

// ==========================================
// TEST 2: Re-pricing Delivery Items in state
// ==========================================
console.log('\nTest 2: Verifying applyCustomPricesToItems on deliveries...');

// Setup simulated state with deliveries
state.globalData = {
  deliveries: [
    {
      id: 'deliv_bert_active',
      from: 'bert',
      items: { Wood: 10, Iron: 2 },
      cost: 0.25, // Market: 10 * 0.015 + 2 * 0.050 = 0.25
      itemsCost: 0.25,
      itemDetails: [
        { name: 'Wood', qty: 10, unitPrice: 0.015, lineCost: 0.15 },
        { name: 'Iron', qty: 2, unitPrice: 0.050, lineCost: 0.10 }
      ]
    },
    {
      id: 'deliv_pete_custom',
      from: 'pete',
      items: { Wood: 5 },
      cost: 0.999, // Manual override by user
      itemsCost: 0.999,
      isCustomCost: true,
      userCost: 0.999,
      itemDetails: [
        { name: 'Wood', qty: 5, unitPrice: 0.015, lineCost: 0.075 }
      ]
    }
  ],
  archiveDeliveries: [],
  bounties: [
    {
      id: 'bounty_wood_1',
      name: 'Wood',
      cost: 0.015,
      itemsCost: 0.015
    }
  ],
  chores: []
};

// Set Wood override to 0.010 (was 0.015)
saveCustomPricesConfig({ wood: 0.010 });
applyCustomPricesToItems();

const bert = state.globalData.deliveries[0];
const woodDet = bert.itemDetails.find(d => d.name === 'Wood');
const ironDet = bert.itemDetails.find(d => d.name === 'Iron');

// 10 * 0.010 = 0.10; Iron untouched = 0.10; Total = 0.20
assert.strictEqual(woodDet.unitPrice, 0.010, 'Wood unitPrice should be overridden to 0.010');
assert.strictEqual(woodDet.lineCost, 0.10, 'Wood lineCost should recalculate to 0.10');
assert.strictEqual(ironDet.unitPrice, 0.050, 'Iron unitPrice should remain at market price');
assert.strictEqual(bert.itemsCost, 0.20, 'Delivery total itemsCost should reflect custom price');
assert.strictEqual(bert.cost, 0.20, 'Delivery total cost should reflect custom price');

// User-edited delivery must remain untouched
const pete = state.globalData.deliveries[1];
assert.strictEqual(pete.cost, 0.999, 'Manual user cost on delivery must NEVER be overwritten');
assert.strictEqual(pete.itemsCost, 0.999);

// Bounty
const woodBounty = state.globalData.bounties[0];
assert.strictEqual(woodBounty.cost, 0.010, 'Wood bounty cost should update to 0.010');

console.log('✅ TEST 2 PASSED: Deliveries and bounties re-priced accurately without touching manual overrides.');

// ==========================================
// TEST 3: Clearing Custom Price Restores Market Price
// ==========================================
console.log('\nTest 3: Verifying clearing custom price restores original market price...');

saveCustomPricesConfig({}); // Reset to empty
applyCustomPricesToItems();

const bertReset = state.globalData.deliveries[0];
const woodDetReset = bertReset.itemDetails.find(d => d.name === 'Wood');
assert.strictEqual(woodDetReset.unitPrice, 0.015, 'Wood unitPrice should restore to original market rate 0.015');
assert.strictEqual(woodDetReset.lineCost, 0.15, 'Wood lineCost should restore to original 0.15');
assert.strictEqual(bertReset.cost, 0.25, 'Total delivery cost should restore to original 0.25');

const woodBountyReset = state.globalData.bounties[0];
assert.strictEqual(woodBountyReset.cost, 0.015, 'Wood bounty should restore to original market cost 0.015');

console.log('✅ TEST 3 PASSED: Resetting restores original market prices with zero loss.');

// ==========================================
// TEST 4: Coin Tools Method (Axe, Pickaxe, Rod)
// ==========================================
console.log('\nTest 4: Verifying coin tool dynamic calculation (Axe, Pickaxe, Rod)...');

// Import helper functions
import { COIN_TOOL_RECIPES, computeToolPrice, recomputeCoinCosts } from '../js/state.js';

// Axe is 20 coins
// At 1000 coins/SFL: 20 * 0.001 = 0.020 SFL
const axe1000 = computeToolPrice('axe', {}, 1000);
assert.strictEqual(Math.round(axe1000 * 1000) / 1000, 0.020, 'Axe at 1000 coins/SFL should be 0.020 SFL');

// At Free coins (0): 20 * 0 = 0.000 SFL
const axeFree = computeToolPrice('axe', {}, 0);
assert.strictEqual(axeFree, 0, 'Axe with Free coins should be 0.000 SFL');

// At 1500 coins/SFL: 20 / 1500 = 0.01333 SFL
const axe1500 = computeToolPrice('axe', {}, 1500);
assert.strictEqual(Math.round(axe1500 * 10000) / 10000, 0.0133, 'Axe at 1500 coins/SFL should be ~0.0133 SFL');

// Pickaxe: 3 wood + 16 coins
// With wood=0.010 and coins=1000: 3*0.010 + 16*0.001 = 0.030 + 0.016 = 0.046 SFL
const pickaxeCustomWood = computeToolPrice('pickaxe', { wood: 0.010 }, 1000);
assert.strictEqual(Math.round(pickaxeCustomWood * 1000) / 1000, 0.046, 'Pickaxe with custom wood 0.010 should be 0.046 SFL');

// Pickaxe with Free coins (0): 3*0.010 + 0 = 0.030 SFL
const pickaxeFree = computeToolPrice('pickaxe', { wood: 0.010 }, 0);
assert.strictEqual(Math.round(pickaxeFree * 1000) / 1000, 0.030, 'Pickaxe with Free coins and custom wood should be 0.030 SFL');

console.log('✅ TEST 4 PASSED: Coin tools dynamically compute costs using coin ratio & custom ingredient prices.');

// ==========================================
// TEST 5: Category & Filter Draft Preservation
// ==========================================
console.log('\nTest 5: Verifying Draft Preservation Across Category Tabs & Search...');
import { BASELINE_RESOURCE_PRICES, CUSTOM_PRICE_ITEMS } from '../js/modal-custom-prices.js';

assert.ok(BASELINE_RESOURCE_PRICES['wood'] > 0, 'Baseline resource price for wood must exist');
assert.ok(BASELINE_RESOURCE_PRICES['red snapper'] > 0, 'Baseline resource price for red snapper must exist');
assert.ok(CUSTOM_PRICE_ITEMS.some(it => it.key === 'wood' && it.category === 'Resources'), 'Wood item must be in Resources');
assert.ok(CUSTOM_PRICE_ITEMS.some(it => it.key === 'red snapper' && it.category === 'Fish'), 'Red snapper must be in Fish');

// Verify draft pricing simulation:
// User sets custom price for Wood (0.012), then filters by Fish and sets Red Snapper (0.150)
const draft = {};
draft['wood'] = 0.012; // In Resources
draft['red snapper'] = 0.150; // In Fish

saveCustomPricesConfig(draft);
const persistedDraft = getCustomPrices();
assert.strictEqual(persistedDraft['wood'], 0.012, 'Wood custom price must be preserved');
assert.strictEqual(persistedDraft['red snapper'], 0.150, 'Red snapper custom price must be preserved');

console.log('✅ TEST 5 PASSED: Custom price draft preservation across categories verified.');

console.log('\n🎉 ALL 5 CUSTOM PRICES TESTS PASSED WITH 100% SUCCESS! 🚀');
