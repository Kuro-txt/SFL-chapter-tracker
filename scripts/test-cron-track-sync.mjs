import assert from 'node:assert';
import { 
  calculateTrackTickets, 
  CAVE_DWELLERS_CHAPTER_TRACKS, 
  ASCENSION_AGE_CHAPTER_TRACKS 
} from '../api/chapter-tracks.js';

console.log('🧪 Starting Automated Tests for Chapter Track Automatic Sync...\n');

// TEST 1: Milestone Data Integrity
console.log('Test 1: Verifying Cave Dwellers & Ascension Age Milestones Structure...');
assert(Array.isArray(CAVE_DWELLERS_CHAPTER_TRACKS.milestones), 'Cave Dwellers milestones array should exist');
assert.strictEqual(CAVE_DWELLERS_CHAPTER_TRACKS.milestones.length, 60, 'Cave Dwellers should have exactly 60 milestones');
assert.strictEqual(CAVE_DWELLERS_CHAPTER_TRACKS.milestones[0].points, 10, 'Level 1 requires 10 points');
assert.strictEqual(CAVE_DWELLERS_CHAPTER_TRACKS.milestones[59].points, 60000, 'Level 60 requires 60,000 points');

assert(Array.isArray(ASCENSION_AGE_CHAPTER_TRACKS.milestones), 'Ascension Age milestones array should exist');
assert.strictEqual(ASCENSION_AGE_CHAPTER_TRACKS.milestones.length, 60, 'Ascension Age should have exactly 60 milestones');
console.log('✅ TEST 1 PASSED: Milestone structures verified (60 levels each, 10 to 60,000 pts).\n');

// TEST 2: Threshold Calculations (Free Tier)
console.log('Test 2: Verifying Free Tier Track Ticket Thresholds...');
assert.strictEqual(calculateTrackTickets(0, false), 0, '0 points = 0 tickets');
assert.strictEqual(calculateTrackTickets(-50, false), 0, 'Negative points = 0 tickets');
assert.strictEqual(calculateTrackTickets(10, false), 0, 'Level 1 awards banner, no tickets on free');
assert.strictEqual(calculateTrackTickets(20, false), 0, 'Level 2 awards coins on free tier in Cave Dwellers');
assert.strictEqual(calculateTrackTickets(72, false), 0, 'Level 3 awards raffle tickets on free tier');
assert.strictEqual(calculateTrackTickets(157, false), 10, 'Level 4 awards 10 Duende Caps on free tier');
assert.strictEqual(calculateTrackTickets(516, false), 20, 'Level 7 awards another 10 Duende Caps on free tier (total 20)');
assert.strictEqual(calculateTrackTickets(660, false), 20, 'Level 8 awards raffle tickets on free tier, tickets remain 20');

// Backward compatibility check for Ascension Age
assert.strictEqual(calculateTrackTickets(20, false, 'Ascension Age'), 10, 'Level 2 awards 10 Shiny Feathers on Ascension Age');
assert.strictEqual(calculateTrackTickets(516, false, 'Ascension Age'), 20, 'Level 7 awards 20 Shiny Feathers on Ascension Age');
console.log('✅ TEST 2 PASSED: Free tier milestone calculations accurate for both chapters.\n');

// TEST 3: VIP Tier Bonus Thresholds
console.log('Test 3: Verifying VIP Tier Bonus Track Tickets...');
assert.strictEqual(calculateTrackTickets(10, true), 10, 'Level 1: 10 Duende Caps VIP bonus');
assert.strictEqual(calculateTrackTickets(20, true), 20, 'Level 2: free 0 + premium 20 = 20 VIP tickets');
assert.strictEqual(calculateTrackTickets(72, true), 30, 'Level 3: free 0 + premium 30 = 30 VIP tickets');
assert.strictEqual(calculateTrackTickets(157, true), 40, 'Level 4: free 10 + premium 30 = 40 VIP tickets');
assert.strictEqual(calculateTrackTickets(516, true), 60, 'Level 7: free 20 + premium 40 = 60 VIP tickets');
assert.strictEqual(calculateTrackTickets(660, true), 70, 'Level 8: free 20 + premium 50 = 70 VIP tickets');

// Backward compatibility check for Ascension Age
assert.strictEqual(calculateTrackTickets(20, true, 'Ascension Age'), 10, 'Ascension Level 2 VIP');
assert.strictEqual(calculateTrackTickets(72, true, 'Ascension Age'), 20, 'Ascension Level 3 VIP');
assert.strictEqual(calculateTrackTickets(516, true, 'Ascension Age'), 40, 'Ascension Level 7 VIP');
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

assert.strictEqual(mockVault.trackTickets, 70, 'Vault trackTickets must be automatically updated to 70 for Cave Dwellers');
assert.strictEqual(mockVault.cumulativeTickets, 77, 'Cumulative tickets must include trackTickets (70 + 7 = 77)');
assert.strictEqual(mockVault.chapterPoints, 660, 'Vault chapterPoints must be saved');
assert.strictEqual(mockVault.isVipActive, true, 'Vault isVipActive must be saved');
console.log('✅ TEST 4 PASSED: Cron sync automatic track calculation verified.\n');

// TEST 5: Large Progression High-Level Calculation
console.log('Test 5: Verifying Max Level (Level 60 - 60,000 pts)...');
const maxFree = calculateTrackTickets(60000, false);
const maxVip = calculateTrackTickets(60000, true);
assert.strictEqual(maxFree, 180, 'Max free Duende Caps must be exactly 180');
assert.strictEqual(maxVip, 360, 'Max VIP Duende Caps must be exactly 360 (180 free + 180 VIP)');
console.log(`  Level 60 Max Tickets -> Free: ${maxFree} tickets, VIP: ${maxVip} tickets`);
console.log('✅ TEST 5 PASSED: Max milestone computation verified.\n');

console.log('🎉 ALL 5 CRON TRACK AUTOMATIC SYNC TESTS PASSED WITH 100% SUCCESS!\n');
