import assert from 'node:assert';
import { isAnimalBountyHelper, isManualBountyHelper, hasWeeklyBountiesBonusHelper } from '../api/cron-sync.js';
import { isAnimalBounty, isManualBounty, hasWeeklyBountiesBonus, getMondayBasedWeekId } from '../js/state.js';
import { getMondayBasedWeekId as backendGetMondayBasedWeekId } from '../api/sfl-parser.js';

console.log('🧪 Starting Automated Tests for Cron Snapshot Parity & Animal Bounty Classification...\n');

// Test 1: Helper parity between frontend (state.js) and backend cron (cron-sync.js)
console.log('Test 1: Verifying isAnimalBounty parity between frontend and cron helper...');
const testBounties = [
  { name: 'Chicken (Lvl 3)', completed: true, baseTickets: 5 },
  { name: 'Cow #2', completed: true, baseTickets: 10 },
  { name: 'Sheep (Level 1)', completed: true, baseTickets: 7 },
  { name: 'Harvest 20 Corn', completed: true, baseTickets: 4 },
  { name: 'Sunflowers 100', completed: true, baseTickets: 2 },
  { name: 'Bounty with level field', level: 2, completed: true, baseTickets: 8 },
  { name: 'Bounty with category', category: 'animal', completed: true, baseTickets: 6 },
  { name: 'Generic delivery', completed: true, baseTickets: 3 }
];

testBounties.forEach(b => {
  const frontResult = isAnimalBounty(b);
  const cronResult = isAnimalBountyHelper(b);
  assert.strictEqual(cronResult, frontResult, `Mismatch for item "${b.name}": front=${frontResult}, cron=${cronResult}`);
});
console.log('✅ TEST 1 PASSED: Frontend and Backend animal classification are 100% identical.');

// Test 2: Verify categorization counts on mixed bounties list
console.log('\nTest 2: Verifying categorization on simulated user dataset...');
const simulatedBounties = [
  { name: 'Chicken (Lvl 1)', completed: true, baseTickets: 5, cost: 0.1 },
  { name: 'Chicken (Lvl 2)', completed: true, baseTickets: 6, cost: 0.2 },
  { name: 'Cow (Lvl 1)', completed: true, baseTickets: 10, cost: 0.5 },
  { name: 'Sheep #1', completed: true, baseTickets: 8, cost: 0.3 },
  { name: '100 Carrots', completed: true, baseTickets: 4, cost: 1.0 },
  { name: '50 Beetroots', completed: true, baseTickets: 5, cost: 1.5 }
];

let cronAnimalCount = 0, cronRegularCount = 0;
let cronAnimalTix = 0, cronRegularTix = 0;

simulatedBounties.forEach(b => {
  const isAnimal = isAnimalBountyHelper(b);
  if (isAnimal) {
    cronAnimalCount++;
    cronAnimalTix += b.baseTickets;
  } else {
    cronRegularCount++;
    cronRegularTix += b.baseTickets;
  }
});

assert.strictEqual(cronAnimalCount, 4, 'Expected 4 animal bounties');
assert.strictEqual(cronRegularCount, 2, 'Expected 2 regular crop bounties');
assert.strictEqual(cronAnimalTix, 29, 'Expected 29 animal tickets');
assert.strictEqual(cronRegularTix, 9, 'Expected 9 regular tickets');
console.log('✅ TEST 2 PASSED: 4 Animal Bounties (29 Tix) and 2 Regular Bounties (9 Tix) properly isolated.');

// Test 3: Verify Weekly Bonus parity
console.log('\nTest 3: Verifying weekly bonus helper parity...');
const allDoneRegular = [
  { name: '100 Carrots', completed: true, baseTickets: 4 },
  { name: '50 Beetroots', completed: true, baseTickets: 5 },
  { name: 'Chicken (Lvl 1)', completed: false, baseTickets: 5 } // incompleted animal bounty should NOT block regular bonus
];

assert.strictEqual(hasWeeklyBountiesBonus(allDoneRegular), true, 'Frontend detects bonus despite pending animal bounty');
assert.strictEqual(hasWeeklyBountiesBonusHelper(allDoneRegular), true, 'Cron helper detects bonus despite pending animal bounty');
console.log('✅ TEST 3 PASSED: Weekly bonus correctly triggers when all regular bounties are done.');

// Test 4: Verify Chapter 16 Week 1 Unification (Nov 08 - Nov 15 anchor: 2026-11-09)
console.log('\nTest 4: Verifying Chapter 16 Week 1 anchor parity (Nov 08 - Nov 15 maps to 2026-11-09)...');
const week1Dates = [
  '2026-11-08', // Launch Sunday
  '2026-11-09', // Monday
  '2026-11-10', // Tuesday
  '2026-11-11', // Wednesday
  '2026-11-12', // Thursday
  '2026-11-13', // Friday
  '2026-11-14', // Saturday
  '2026-11-15', // Sunday
  '2026-11-02'  // Legacy key normalization
];

week1Dates.forEach(d => {
  const frontWk = getMondayBasedWeekId(d);
  const backWk = backendGetMondayBasedWeekId(d);
  assert.strictEqual(frontWk, '2026-11-09', `Frontend: ${d} must map to 2026-11-09, got ${frontWk}`);
  assert.strictEqual(backWk, '2026-11-09', `Backend: ${d} must map to 2026-11-09, got ${backWk}`);
});

// Week 2 starts on Monday Nov 16
assert.strictEqual(getMondayBasedWeekId('2026-11-16'), '2026-11-16', 'Week 2 Monday must map to 2026-11-16');
assert.strictEqual(backendGetMondayBasedWeekId('2026-11-16'), '2026-11-16', 'Backend: Week 2 Monday must map to 2026-11-16');
console.log('✅ TEST 4 PASSED: Chapter 16 Week 1 (Nov 08 – Nov 15) and Week 2 (Nov 16) anchors 100% verified.');

console.log('\n🎉 ALL CRON SNAPSHOT PARITY TESTS PASSED SUCCESSFULLY! 🚀');
