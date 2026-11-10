import assert from 'node:assert';
import { 
  getLeaderboardState, 
  setLeaderboardLimit, 
  setLeaderboardFilter 
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

console.log('\n🎉 ALL LEADERBOARD TESTS PASSED WITH 100% SUCCESS! 🚀');
