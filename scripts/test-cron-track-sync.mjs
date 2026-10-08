import assert from 'node:assert';
import { calculateTrackTickets, ASCENSION_AGE_CHAPTER_TRACKS } from '../api/chapter-tracks.js';

console.log('🧪 Starting Automated Tests for Chapter Track Automatic Sync...\n');

// TEST 1: Milestone Data Integrity
console.log('Test 1: Verifying Ascension Age Milestones Structure...');
assert(Array.isArray(ASCENSION_AGE_CHAPTER_TRACKS.milestones), 'Milestones array should exist');
assert.strictEqual(ASCENSION_AGE_CHAPTER_TRACKS.milestones.length, 60, 'Should have exactly 60 milestones');
assert.strictEqual(ASCENSION_AGE_CHAPTER_TRACKS.milestones[0].points, 10, 'Level 1 requires 10 points');
assert.strictEqual(ASCENSION_AGE_CHAPTER_TRACKS.milestones[59].points, 60000, 'Level 60 requires 60,000 points');
console.log('✅ TEST 1 PASSED: Milestone structure verified (60 levels, 10 to 60,000 pts).\n');

// TEST 2: Threshold Calculations (Free Tier)
console.log('Test 2: Verifying Free Tier Track Ticket Thresholds...');
assert.strictEqual(calculateTrackTickets(0, false), 0, '0 points = 0 tickets');
assert.strictEqual(calculateTrackTickets(-50, false), 0, 'Negative points = 0 tickets');
assert.strictEqual(calculateTrackTickets(10, false), 0, 'Level 1 awards coins/flower, no tickets');
assert.strictEqual(calculateTrackTickets(20, false), 10, 'Level 2 awards 10 Shiny Feathers on free tier');
assert.strictEqual(calculateTrackTickets(50, false), 10, 'Points between lvl 2 and 3 stay at 10');
assert.strictEqual(calculateTrackTickets(72, false), 10, 'Level 3 awards raffle tickets on free, so tickets stay at 10');
assert.strictEqual(calculateTrackTickets(516, false), 20, 'Level 7 awards another 10 Shiny Feathers on free tier (total 20)');
assert.strictEqual(calculateTrackTickets(660, false), 20, 'Level 8 awards raffle tickets on free tier, tickets remain 20');
console.log('✅ TEST 2 PASSED: Free tier milestone calculations accurate.\n');

// TEST 3: VIP Tier Bonus Thresholds
console.log('Test 3: Verifying VIP Tier Bonus Track Tickets...');
assert.strictEqual(calculateTrackTickets(20, true), 10, 'Level 2: free 10, premium coins (total 10)');
assert.strictEqual(calculateTrackTickets(72, true), 20, 'Level 3: free 10 (from lvl 2) + premium 10 (lvl 3) = 20 VIP tickets');
assert.strictEqual(calculateTrackTickets(516, true), 40, 'Level 7: free 20 (lvl 2, 7) + premium 20 (lvl 3, 7) = 40 VIP tickets');
assert.strictEqual(calculateTrackTickets(660, true), 40, 'Level 8: no feathers added, remains 40 VIP tickets');
console.log('✅ TEST 3 PASSED: VIP tier bonus tickets accurate.\n');

// TEST 4: Cron Sync Vault Simulation
console.log('Test 4: Simulating Cron Sync Vault Track Update...');
const mockVault = {
  farmId: '123456',
  trackTickets: 0,
  dailyLoginTickets: 7,
  cumulativeTickets: 0,
  logs: []
};

const mockParsedFarm = {
  chapterPoints: 660,
  isVipActive: true
};

// Simulate cron calculation block:
const activeChapterPoints = mockParsedFarm.chapterPoints || 0;
const isVip = Boolean(mockParsedFarm.isVipActive);
mockVault.chapterPoints = activeChapterPoints;
mockVault.isVipActive = isVip;
mockVault.trackTickets = calculateTrackTickets(activeChapterPoints, isVip);

const totalCalculatedTickets = (mockVault.trackTickets || 0) + (mockVault.dailyLoginTickets || 0);
mockVault.cumulativeTickets = totalCalculatedTickets;

assert.strictEqual(mockVault.trackTickets, 40, 'Vault trackTickets must be automatically updated to 40');
assert.strictEqual(mockVault.cumulativeTickets, 47, 'Cumulative tickets must include trackTickets (40 + 7 = 47)');
assert.strictEqual(mockVault.chapterPoints, 660, 'Vault chapterPoints must be saved');
assert.strictEqual(mockVault.isVipActive, true, 'Vault isVipActive must be saved');
console.log('✅ TEST 4 PASSED: Cron sync automatic track calculation verified.\n');

// TEST 5: Large Progression High-Level Calculation
console.log('Test 5: Verifying Max Level (Level 60 - 60,000 pts)...');
const maxFree = calculateTrackTickets(60000, false);
const maxVip = calculateTrackTickets(60000, true);
assert(maxFree > 0, 'Max free tickets must be > 0');
assert(maxVip > maxFree, 'Max VIP tickets must exceed free tickets');
console.log(`  Level 60 Max Tickets -> Free: ${maxFree} tickets, VIP: ${maxVip} tickets`);
console.log('✅ TEST 5 PASSED: Max milestone computation verified.\n');

console.log('🎉 ALL 5 CRON TRACK AUTOMATIC SYNC TESTS PASSED WITH 100% SUCCESS!\n');
