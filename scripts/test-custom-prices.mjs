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

console.log('\n🎉 ALL CUSTOM PRICES TESTS PASSED WITH 100% SUCCESS! 🚀');
