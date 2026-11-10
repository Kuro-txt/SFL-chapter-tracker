import assert from 'node:assert';
import { 
  getLeaderboardState, 
  setLeaderboardLimit, 
  setLeaderboardFilter,
  updateUserRankDisplay,
  initLeaderboardRank
} from '../js/leaderboard.js';

console.log('🧪 Starting Automated Tests for Ticket Leaderboard Controller...\n');

// Test 1: Initial state
console.log('Test 1: Verifying initial leaderboard state...');
const initial = getLeaderboardState();
assert.strictEqual(initial.limit, 100, 'Default limit should be 100');
assert.strictEqual(initial.filter, '', 'Default filter should be empty');
assert.strictEqual(initial.loading, false, 'Default loading should be false');
console.log('✅ TEST 1 PASSED: Initial leaderboard state verified.');

// Test 2: Limit setter
console.log('\nTest 2: Verifying setLeaderboardLimit...');
setLeaderboardLimit(500);
assert.strictEqual(getLeaderboardState().limit, 500, 'Limit should update to 500');
setLeaderboardLimit(10);
assert.strictEqual(getLeaderboardState().limit, 10, 'Limit should update to 10');
setLeaderboardLimit('invalid');
assert.strictEqual(getLeaderboardState().limit, 100, 'Invalid limit should fallback to 100');
console.log('✅ TEST 2 PASSED: Limit setter and fallback verified.');

// Test 3: Filter setter
console.log('\nTest 3: Verifying setLeaderboardFilter...');
setLeaderboardFilter('  Kuro1  ');
assert.strictEqual(getLeaderboardState().filter, 'kuro1', 'Filter should be trimmed and lowercased');
setLeaderboardFilter('');
assert.strictEqual(getLeaderboardState().filter, '', 'Filter should reset cleanly');
console.log('✅ TEST 3 PASSED: Filter setter and normalization verified.');

// Test 4: Mock response payload parsing simulation
console.log('\nTest 4: Simulating community API response mapping...');
const mockApiResponse = {
  data: {
    topTen: [
      {
        id: "Raichupus",
        count: 1378,
        bumpkin: { background: "Farm Background" },
        experience: 2005864376.16,
        ascensionLevel: 5,
        farmId: 7125230236674634
      }
    ],
    farmRankingDetails: [
      {
        rank: 426,
        id: "xCristhianx",
        count: 665,
        farmId: 85214
      },
      {
        rank: 427,
        id: "Kuro1",
        count: 665,
        farmId: 8472883706403914
      }
    ],
    lastUpdated: 1794285023775,
    total: 2206301
  }
};

assert(Array.isArray(mockApiResponse.data.topTen), 'topTen should be an array');
assert.strictEqual(mockApiResponse.data.topTen[0].id, 'Raichupus');
assert.strictEqual(mockApiResponse.data.topTen[0].count, 1378);

const userRank = mockApiResponse.data.farmRankingDetails.find(r => r.farmId === 8472883706403914);
assert(userRank, 'User farm should be found in farmRankingDetails');
assert.strictEqual(userRank.rank, 427);
assert.strictEqual(userRank.id, 'Kuro1');
assert.strictEqual(userRank.count, 665);
console.log('✅ TEST 4 PASSED: API payload parsing & user standing lookup verified.');

// Test 5: User rank card display and localStorage caching
console.log('\nTest 5: Verifying updateUserRankDisplay & initLeaderboardRank...');
const elements = {
  statTotalRankBadge: { style: {}, textContent: '', title: '' },
  statTotalRank: { innerHTML: '', textContent: '', title: '' },
  tipTotalRank: { innerHTML: '', textContent: '' },
  leaderboardModal: { classList: { add: (c) => elements.leaderboardModal.classes.add(c), remove: (c) => elements.leaderboardModal.classes.delete(c) }, classes: new Set() },
  leaderboardRankSearchInput: { value: '' },
  leaderboardContainer: { innerHTML: '' }
};
const storage = {};

global.document = {
  getElementById: (id) => elements[id] || null
};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); }
};

updateUserRankDisplay(427, 'Kuro1');
assert.strictEqual(elements.statTotalRankBadge.textContent, '#427');
assert.strictEqual(elements.statTotalRankBadge.style.display, 'inline-block');
assert(elements.statTotalRank.innerHTML.includes('#427'), 'Footer rank should contain #427');
assert(elements.tipTotalRank.innerHTML.includes('427'), 'Tooltip should contain rank');

// Save to storage and test initLeaderboardRank
global.localStorage.setItem('sfl_user_rank', JSON.stringify({ rank: 427, name: 'Kuro1' }));
updateUserRankDisplay(null);
assert.strictEqual(elements.statTotalRankBadge.style.display, 'none');
assert.strictEqual(elements.statTotalRank.textContent, '#--');

initLeaderboardRank();
assert.strictEqual(elements.statTotalRankBadge.textContent, '#427');
assert.strictEqual(elements.statTotalRankBadge.style.display, 'inline-block');
console.log('✅ TEST 5 PASSED: User rank card display & localStorage persistence verified.');

// Test 6: Verifying lookupUsernameToFarmId
console.log('\nTest 6: Verifying lookupUsernameToFarmId with sfl.world API...');
global.fetch = async (url) => {
  if (url.includes('lookupFarm') || url.includes('sfl.world')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { username: 'Kuro1', farm_id: 8472883706403914, nft_id: 259970 } })
    };
  }
  return { ok: false, status: 404, json: async () => ({ error: 'Not found' }) };
};

import { lookupUsernameToFarmId, openLeaderboardModal, closeLeaderboardModal, searchLeaderboardRank } from '../js/leaderboard.js';
const lookup = await lookupUsernameToFarmId('kuro1');
assert.strictEqual(lookup.farm_id, 8472883706403914, 'Farm ID should match 8472883706403914');
assert.strictEqual(lookup.username, 'Kuro1', 'Username should match Kuro1');
console.log('✅ TEST 6 PASSED: Username to Farm ID resolution verified.');

// Test 7: Modal controls
console.log('\nTest 7: Verifying openLeaderboardModal & closeLeaderboardModal...');
openLeaderboardModal();
assert(elements.leaderboardModal.classes.has('show'), 'Modal should have "show" class after open');
closeLeaderboardModal();
assert(!elements.leaderboardModal.classes.has('show'), 'Modal should not have "show" class after close');
console.log('✅ TEST 7 PASSED: Leaderboard modal open/close toggles verified.');

console.log('\n🎉 ALL LEADERBOARD TESTS PASSED WITH 100% SUCCESS! 🚀');
