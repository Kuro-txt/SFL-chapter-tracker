import assert from 'assert';
import { calculateProjections, setProjectionScenario } from '../js/projections.js';

console.log('🧪 Starting Verification Tests for Ticket Projections & Forecasting Engine...\n');

// Mock data builder for 12 weeks
function buildMockDisplayItems(completedWeeksCount, tixPerCompletedWeek, currentWeekTix = 0) {
  const TOTAL_WEEKS = 12;
  const items = [];
  const baseEpoch = new Date('2026-08-10T00:00:00.000Z');

  for (let i = 0; i < TOTAL_WEEKS; i++) {
    const d = new Date(baseEpoch.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    const mondayKey = d.toISOString().split('T')[0];
    const isCurrent = i === completedWeeksCount;
    const isPast = i < completedWeeksCount;

    let tickets = 0;
    if (isPast) tickets = tixPerCompletedWeek;
    if (isCurrent) tickets = currentWeekTix;

    items.push({
      label: `Week ${i + 1}`,
      mondayKey,
      tickets,
      cost: 10,
      delivTix: tickets,
      bountyTix: 0,
      animalBountyTix: 0,
      choreTix: 0,
      isCurrent,
      hasData: tickets > 0
    });
  }
  return items;
}

// -------------------------------------------------------------
// Test 1: Baseline Projection Calculations (Week 3, Current Pace)
// -------------------------------------------------------------
console.log('Test 1: Verifying projection math at Week 3 (2 completed weeks + partial)...');
{
  // 2 weeks completed at 150 tickets each = 300 tix, current week has 75 tix
  const displayItems = buildMockDisplayItems(2, 150, 75);
  const currentMondayKey = displayItems[2].mondayKey;
  const targetGoal = 1200;
  const targetWeeks = 12;

  const proj = calculateProjections(displayItems, currentMondayKey, targetGoal, targetWeeks);

  assert.ok(proj.totalEarned === 375, `Expected 375 total earned, got ${proj.totalEarned}`);
  assert.ok(proj.elapsedWeeks >= 2 && proj.elapsedWeeks <= 3, `Expected elapsed weeks between 2 and 3, got ${proj.elapsedWeeks}`);

  // Current pace should be around 375 / elapsedWeeks
  const currentPace = proj.scenarios.current.pace;
  assert.ok(currentPace > 100 && currentPace < 200, `Expected pace between 100 and 200, got ${currentPace}`);

  // Week 8 projected should be totalEarned + pace * (8 - elapsed)
  const w8 = proj.scenarios.current.week8;
  assert.ok(w8.projected > 375, `Week 8 projected should be greater than total earned`);
  assert.strictEqual(typeof w8.gapVsGoal, 'number');
  assert.strictEqual(typeof w8.dailyRequired, 'number');

  // Week 12 projected should be totalEarned + pace * (12 - elapsed)
  const w12 = proj.scenarios.current.week12;
  assert.ok(w12.projected > w8.projected, `Week 12 projection should be greater than Week 8`);
  console.log(`  ✓ Total earned: ${proj.totalEarned}, Current Pace: ${Math.round(currentPace)} Tix/Wk`);
  console.log(`  ✓ Week 8 Proj: ${w8.projected} Tix, Week 12 Proj: ${w12.projected} Tix`);
  console.log('✅ TEST 1 PASSED: Baseline projection math verified.\n');
}

// -------------------------------------------------------------
// Test 2: Comparing Current Pace vs Target Pace Scenarios
// -------------------------------------------------------------
console.log('Test 2: Verifying scenario differentiation (Current Pace vs Target Pace)...');
{
  // 3 weeks at 200 tickets each = 600 tickets
  const displayItems = buildMockDisplayItems(3, 200, 50);
  const currentMondayKey = displayItems[3].mondayKey;
  const targetGoal = 1000;
  const targetWeeks = 12;

  const proj = calculateProjections(displayItems, currentMondayKey, targetGoal, targetWeeks);

  const targetPace = proj.scenarios.target.pace;
  const expectedTargetPace = 1000 / 12;
  assert.ok(Math.abs(targetPace - expectedTargetPace) < 0.001, `Target pace mismatch: got ${targetPace}, expected ${expectedTargetPace}`);

  assert.notStrictEqual(proj.scenarios.current.week12.projected, proj.scenarios.target.week12.projected,
    'Current and Target scenario projections should differ when paces differ');

  console.log(`  ✓ Current pace: ${Math.round(proj.scenarios.current.pace)}/wk vs Target pace: ${Math.round(targetPace)}/wk`);
  console.log('✅ TEST 2 PASSED: Scenario differentiation verified.\n');
}

// -------------------------------------------------------------
// Test 3: Daily Tickets Needed and Edge Cases
// -------------------------------------------------------------
console.log('Test 3: Verifying daily tickets needed & boundary edge cases...');
{
  // Case A: Goal already achieved (e.g. earned 1500 with goal 1000)
  const itemsDone = buildMockDisplayItems(6, 250, 50);
  const projDone = calculateProjections(itemsDone, itemsDone[6].mondayKey, 1000, 12);
  assert.strictEqual(projDone.scenarios.current.week12.dailyRequired, 0, 'Daily required should be 0 when goal is already exceeded');
  assert.ok(projDone.scenarios.current.week12.gapVsGoal > 0, 'Gap should be positive (ahead)');

  // Case B: Zero elapsed time / empty start
  const itemsEmpty = buildMockDisplayItems(0, 0, 0);
  const projEmpty = calculateProjections(itemsEmpty, itemsEmpty[0].mondayKey, 1000, 12);
  assert.ok(projEmpty.scenarios.current.pace >= 0, 'Zero elapsed time should safely compute pace without NaN or throw');
  assert.ok(!isNaN(projEmpty.scenarios.current.week8.projected), 'Week 8 projection should not be NaN');

  console.log('✅ TEST 3 PASSED: Edge cases handled safely.\n');
}

// -------------------------------------------------------------
// Test 4: Goal Completion Date Estimator
// -------------------------------------------------------------
console.log('Test 4: Verifying goal completion date estimator...');
{
  // 4 completed weeks at 150 = 600 tix. Goal = 1000. Pace ~150.
  // Remaining gap = 400 tix => ~2.67 more weeks => completion in Week 7
  const displayItems = buildMockDisplayItems(4, 150, 0);
  const proj = calculateProjections(displayItems, displayItems[4].mondayKey, 1000, 12);

  assert.ok(proj.goalDate !== null, 'Should estimate a goal date when pace is healthy');
  assert.ok(proj.goalDate.weekNum >= 6 && proj.goalDate.weekNum <= 10, `Goal estimated at Week ${proj.goalDate.weekNum}`);
  assert.strictEqual(typeof proj.goalDate.label, 'string');
  console.log(`  ✓ Predicted Goal Completion: ${proj.goalDate.label} (Week ${proj.goalDate.weekNum})`);
  console.log('✅ TEST 4 PASSED: Goal date estimation accurate.\n');
}

// -------------------------------------------------------------
// Test 5: Custom "What-If" Pace Scenario Override
// -------------------------------------------------------------
console.log('Test 5: Verifying custom scenario override...');
{
  const displayItems = buildMockDisplayItems(3, 100, 0);
  const currentMondayKey = displayItems[3].mondayKey;

  // Set custom pace to 300 tix/wk
  setProjectionScenario('custom', 300);

  const proj = calculateProjections(displayItems, currentMondayKey, 1000, 12);
  assert.strictEqual(proj.activeScenario, 'custom');
  assert.strictEqual(proj.customPace, 300);
  assert.strictEqual(proj.activePace, 300);

  // Switch back to current
  setProjectionScenario('current');
  const projCurrent = calculateProjections(displayItems, currentMondayKey, 1000, 12);
  assert.strictEqual(projCurrent.activeScenario, 'current');

  console.log('✅ TEST 5 PASSED: Custom pace override and switching verified.\n');
}

// -------------------------------------------------------------
// Test 6: 12-Week Roadmap Cumulative Generation
// -------------------------------------------------------------
console.log('Test 6: Verifying 12-week roadmap structure...');
{
  const displayItems = buildMockDisplayItems(2, 120, 40);
  const currentMondayKey = displayItems[2].mondayKey;
  const proj = calculateProjections(displayItems, currentMondayKey, 1000, 12);

  assert.strictEqual(proj.roadmap.length, 12, 'Roadmap must have 12 weeks');
  assert.strictEqual(proj.roadmap[0].type, 'actual', 'Week 1 must be actual');
  assert.strictEqual(proj.roadmap[1].type, 'actual', 'Week 2 must be actual');
  assert.strictEqual(proj.roadmap[2].type, 'current', 'Week 3 must be current');
  assert.strictEqual(proj.roadmap[3].type, 'projected', 'Week 4 must be projected');
  assert.strictEqual(proj.roadmap[11].type, 'projected', 'Week 12 must be projected');

  // Verify cumulative monotonicity
  for (let i = 1; i < 12; i++) {
    assert.ok(proj.roadmap[i].cumulative >= proj.roadmap[i - 1].cumulative,
      `Cumulative tickets at W${i + 1} (${proj.roadmap[i].cumulative}) should be >= W${i} (${proj.roadmap[i - 1].cumulative})`);
  }

  console.log('✅ TEST 6 PASSED: 12-week roadmap cumulative array verified.\n');
}

console.log('🎉 ALL 6 TICKET PROJECTION TESTS PASSED WITH 100% SUCCESS! 🚀');
