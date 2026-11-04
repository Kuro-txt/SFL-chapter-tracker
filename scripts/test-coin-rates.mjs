import assert from 'assert';
import { getCoinRatio, recomputeCoinCosts, getActiveBoostsCostSfl, state } from '../js/state.js';
import { getDirectMarketPrice } from '../api/sfl-parser.js';

console.log('🧪 Starting Automated Tests for Coin Rate Selector & Free Mode...\n');

// ------------------------------------------------------------------
// Test 1: recomputeCoinCosts with free mode (0 and 'free') and rates
// ------------------------------------------------------------------
console.log('Test 1: Verifying recomputeCoinCosts with 0 and "free"...');
state.priceMap = {};

recomputeCoinCosts(0);
assert.strictEqual(state.priceMap['coins'], 0, 'Price of coins should be 0 SFL when ratio is 0');
assert.strictEqual(state.priceMap['coin'], 0, 'Price of coin should be 0 SFL when ratio is 0');

recomputeCoinCosts('free');
assert.strictEqual(state.priceMap['coins'], 0, 'Price of coins should be 0 SFL when ratio is "free"');

recomputeCoinCosts(1000);
assert.strictEqual(state.priceMap['coins'], 0.001, 'Price of coins should be 0.001 SFL when ratio is 1000');

recomputeCoinCosts(1500);
assert.strictEqual(state.priceMap['coins'], 1 / 1500, 'Price of coins should be 1/1500 SFL when ratio is 1500');

recomputeCoinCosts(2000);
assert.strictEqual(state.priceMap['coins'], 1 / 2000, 'Price of coins should be 1/2000 SFL when ratio is 2000');
console.log('✅ TEST 1 PASSED: recomputeCoinCosts handles 0, free, 1000, 1500, and custom rates.\n');

// ------------------------------------------------------------------
// Test 2: Active Boosts cost with Free Coins
// ------------------------------------------------------------------
console.log('Test 2: Verifying active boost costs with Free Coins...');
const elements = {
  boost1: { checked: true }, // 5000 coins
  boost2: { checked: true }, // 5 SFL
  boost3: { checked: false },
  coinRatioSelect: { value: '1000' },
  coinsPerSflInput: { value: '1000' }
};

globalThis.document = {
  getElementById: (id) => elements[id] || null
};

// When coin ratio is 1000: 5000 / 1000 + 5 = 10 SFL
elements.coinRatioSelect.value = '1000';
elements.coinsPerSflInput.value = '1000';
assert.strictEqual(getCoinRatio(), 1000);
const costAt1000 = getActiveBoostsCostSfl();
assert.strictEqual(costAt1000, 10, `Expected 10 SFL, got ${costAt1000}`);

// When coin ratio is 1500: 5000 / 1500 + 5 = 8.333 SFL
elements.coinRatioSelect.value = '1500';
elements.coinsPerSflInput.value = '1500';
assert.strictEqual(getCoinRatio(), 1500);
const costAt1500 = getActiveBoostsCostSfl();
assert.strictEqual(Number(costAt1500.toFixed(3)), 8.333, `Expected 8.333 SFL, got ${costAt1500}`);

// When coin ratio is 0 (Free): 0 + 5 = 5 SFL
elements.coinRatioSelect.value = '0';
elements.coinsPerSflInput.value = '0';
assert.strictEqual(getCoinRatio(), 0, 'getCoinRatio should return 0 when select is 0');
const costAtFree = getActiveBoostsCostSfl();
assert.strictEqual(costAtFree, 5, `Expected 5 SFL when coins are free, got ${costAtFree}`);

// When custom coin ratio is selected:
elements.coinRatioSelect.value = 'custom';
elements.coinsPerSflInput.value = '2500';
assert.strictEqual(getCoinRatio(), 2500);
const costAt2500 = getActiveBoostsCostSfl();
assert.strictEqual(costAt2500, 7, `Expected 7 SFL (5000/2500 + 5), got ${costAt2500}`);

// When custom is 'free' or '0'
elements.coinsPerSflInput.value = 'free';
assert.strictEqual(getCoinRatio(), 0);
const costAtCustomFree = getActiveBoostsCostSfl();
assert.strictEqual(costAtCustomFree, 5);

console.log('✅ TEST 2 PASSED: Active boost coin cost evaluates to 0 SFL in free mode across dropdown & custom inputs.\n');

// ------------------------------------------------------------------
// Test 3: Backend sfl-parser price resolution for coins
// ------------------------------------------------------------------
console.log('Test 3: Verifying backend parser market prices for coins...');
const mockPriceMapFree = { coins: 0 };
const freeCoinCost = getDirectMarketPrice('coins', mockPriceMapFree);
assert.strictEqual(freeCoinCost, 0, 'Direct coin cost must be 0 SFL in free mode');

const mockPriceMap1000 = { coins: 0.001 };
const coinCost1000 = getDirectMarketPrice('coins', mockPriceMap1000);
assert.strictEqual(coinCost1000, 0.001, 'Direct coin cost must be 0.001 SFL for 1000 ratio');
console.log('✅ TEST 3 PASSED: Backend sfl-parser handles free coins accurately.\n');

console.log('🎉 ALL COIN RATE & FREE MODE TESTS PASSED WITH 100% SUCCESS! 🚀');
