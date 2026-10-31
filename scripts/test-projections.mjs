import assert from 'assert';
import { 
  calculateProjections, 
  setProjectionScenario, 
  calculateWeekNpcPlan, 
  CORE_CHAPTER_NPCS, 
  DEFAULT_PLANNER_TEMPLATE 
} from '../js/projections.js';

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

  // Week 9 (Auction Week) projected should be totalEarned + pace * (9 - elapsed)
  const wAuction = proj.scenarios.current.auctionWeek;
  assert.ok(wAuction.projected > 375, `Auction Week projected should be greater than total earned`);
  assert.strictEqual(typeof wAuction.gapVsGoal, 'number');
  assert.strictEqual(typeof wAuction.dailyRequired, 'number');
  assert.strictEqual(proj.scenarios.current.week9.projected, wAuction.projected);

  // Week 12 projected should be totalEarned + pace * (12 - elapsed)
  const w12 = proj.scenarios.current.week12;
  assert.ok(w12.projected > wAuction.projected, `Week 12 projection should be greater than Week 9`);
  console.log(`  ✓ Total earned: ${proj.totalEarned}, Current Pace: ${Math.round(currentPace)} Tix/Wk`);
  console.log(`  ✓ Week 9 (Auction) Proj: ${wAuction.projected} Tix, Week 12 Proj: ${w12.projected} Tix`);
  console.log('✅ TEST 1 PASSED: Baseline projection math verified.\n');
}

// -------------------------------------------------------------
// Test 2: Comparing Current Pace vs Target Pace Scenarios
// -------------------------------------------------------------
console.log('Test 2: Verifying scenario differentiation (Current Pace vs Target Pace)...');
{
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
  const itemsDone = buildMockDisplayItems(6, 250, 50);
  const projDone = calculateProjections(itemsDone, itemsDone[6].mondayKey, 1000, 12);
  assert.strictEqual(projDone.scenarios.current.week12.dailyRequired, 0, 'Daily required should be 0 when goal is already exceeded');
  assert.ok(projDone.scenarios.current.week12.gapVsGoal > 0, 'Gap should be positive (ahead)');

  const itemsEmpty = buildMockDisplayItems(0, 0, 0);
  const projEmpty = calculateProjections(itemsEmpty, itemsEmpty[0].mondayKey, 1000, 12);
  assert.ok(projEmpty.scenarios.current.pace >= 0, 'Zero elapsed time should safely compute pace without NaN or throw');
  assert.ok(!isNaN(projEmpty.scenarios.current.auctionWeek.projected), 'Auction Week 9 projection should not be NaN');

  console.log('✅ TEST 3 PASSED: Edge cases handled safely.\n');
}

// -------------------------------------------------------------
// Test 4: Goal Completion Date Estimator
// -------------------------------------------------------------
console.log('Test 4: Verifying goal completion date estimator...');
{
  setProjectionScenario('current');
  const displayItems = buildMockDisplayItems(4, 150, 0);
  const proj = calculateProjections(displayItems, displayItems[4].mondayKey, 1000, 12);

  assert.ok(proj.goalDate !== null, 'Should estimate a goal date when pace is healthy');
  assert.ok(proj.goalDate.weekNum >= 6 && proj.goalDate.weekNum <= 10, `Goal estimated at Week ${proj.goalDate.weekNum}`);
  assert.strictEqual(typeof proj.goalDate.label, 'string');
  assert.strictEqual(proj.goalDate.isAfterWeek12, false, 'Healthy pace should hit goal within week 12');
  console.log(`  ✓ Predicted Goal Completion: ${proj.goalDate.label} (Week ${proj.goalDate.weekNum})`);

  // Case B: Slow pace where goal is estimated after week 12
  const slowItems = buildMockDisplayItems(2, 20, 0); // 40 earned in 2 weeks => ~13 tix/wk
  const projSlow = calculateProjections(slowItems, slowItems[2].mondayKey, 1000, 12);
  assert.ok(projSlow.goalDate !== null);
  assert.strictEqual(projSlow.goalDate.isAfterWeek12, true, 'Goal after week 12 should flag isAfterWeek12: true');
  assert.ok(projSlow.goalDate.weekNum > 12, `Week num should be > 12, got ${projSlow.goalDate.weekNum}`);
  console.log(`  ✓ Slow Pace (Goal after W12): Week ${projSlow.goalDate.weekNum} (isAfterWeek12: true)`);

  setProjectionScenario('planned');
  console.log('✅ TEST 4 PASSED: Goal date estimation accurate.\n');
}

// -------------------------------------------------------------
// Test 5: Custom "What-If" Pace Scenario Override
// -------------------------------------------------------------
console.log('Test 5: Verifying custom scenario override...');
{
  const displayItems = buildMockDisplayItems(3, 100, 0);
  const currentMondayKey = displayItems[3].mondayKey;

  setProjectionScenario('custom', 300);

  const proj = calculateProjections(displayItems, currentMondayKey, 1000, 12);
  assert.strictEqual(proj.activeScenario, 'custom');
  assert.strictEqual(proj.customPace, 300);
  assert.strictEqual(proj.activePace, 300);

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

  for (let i = 1; i < 12; i++) {
    assert.ok(proj.roadmap[i].cumulative >= proj.roadmap[i - 1].cumulative,
      `Cumulative tickets at W${i + 1} (${proj.roadmap[i].cumulative}) should be >= W${i} (${proj.roadmap[i - 1].cumulative})`);
  }

  console.log('✅ TEST 6 PASSED: 12-week roadmap cumulative array verified.\n');
}

// -------------------------------------------------------------
// Test 7: Deterministic NPC Yield & VIP/Boost Buffs
// -------------------------------------------------------------
console.log('Test 7: Verifying Deterministic NPC Yield with VIP & Boosters...');
{
  const template = JSON.parse(JSON.stringify(DEFAULT_PLANNER_TEMPLATE));
  // Only enable Pete (base 1) and Bert (base 2)
  Object.keys(template.npcs).forEach(k => {
    template.npcs[k].enabled = (k === 'pumpkin_pete' || k === 'bert');
    template.npcs[k].daysPerWeek = 7;
  });
  template.doubleDeliveryDays = 0; // Turn off double delivery for pure base test
  template.includeBounties = false;
  template.includeChores = false;
  template.includeLogins = false;

  // Case A: 0 VIP, 0 Boosts
  const planA = calculateWeekNpcPlan('template', template, {}, 0, 0);
  // Pete: 7 * 1 = 7, Bert: 7 * 2 = 14 => 21 tix
  assert.strictEqual(planA.delivTix, 21, `Expected 21 deliv tix, got ${planA.delivTix}`);

  // Case B: VIP (+2) + 2 Boosts (+2) = +4 buff per order
  // Pete: 7 * (1 + 4) = 35, Bert: 7 * (2 + 4) = 42 => 77 tix
  const planB = calculateWeekNpcPlan('template', template, {}, 2, 2);
  assert.strictEqual(planB.delivTix, 77, `Expected 77 deliv tix with VIP+Boosts, got ${planB.delivTix}`);

  console.log(`  ✓ 0 Buffs: ${planA.delivTix} Tix | VIP (+2) + 2 Boosts (+2): ${planB.delivTix} Tix`);
  console.log('✅ TEST 7 PASSED: Deterministic NPC yield math with VIP & Boosts verified.\n');
}

// -------------------------------------------------------------
// Test 8: 2x Double Delivery Calculations per Week
// -------------------------------------------------------------
console.log('Test 8: Verifying 2x Double Delivery bonus tickets per week...');
{
  const template = JSON.parse(JSON.stringify(DEFAULT_PLANNER_TEMPLATE));
  // Enable Pete (base 1) 7 days/wk, and Raven (base 4) 1 day/wk
  Object.keys(template.npcs).forEach(k => {
    template.npcs[k].enabled = false;
  });
  template.npcs.pumpkin_pete = { enabled: true, daysPerWeek: 7 };
  template.npcs.raven = { enabled: true, daysPerWeek: 1 };
  template.includeBounties = false;
  template.includeChores = false;
  template.includeLogins = false;

  // No VIP or boosts: Pete = 1 tix, Raven = 4 tix
  // Without double delivery:
  template.doubleDeliveryDays = 0;
  const planNoDbl = calculateWeekNpcPlan('template', template, {}, 0, 0);
  assert.strictEqual(planNoDbl.delivTix, 11); // 7*1 + 1*4 = 11
  assert.strictEqual(planNoDbl.doubleBonusTix, 0);

  // With 1 Double Delivery day:
  // Pete: (7 + 1) * 1 = 8 tix (1 extra)
  // Raven: (1 + 1) * 4 = 8 tix (4 extra)
  // Total deliv = 16 tix, doubleBonus = 5 tix
  template.doubleDeliveryDays = 1;
  const planWithDbl = calculateWeekNpcPlan('template', template, {}, 0, 0);
  assert.strictEqual(planWithDbl.delivTix, 16, `Expected 16 deliv tix with double delivery, got ${planWithDbl.delivTix}`);
  assert.strictEqual(planWithDbl.doubleBonusTix, 5, `Expected 5 double bonus tix, got ${planWithDbl.doubleBonusTix}`);

  console.log(`  ✓ Normal Deliveries: ${planNoDbl.delivTix} Tix | With 1x Double Delivery Day: ${planWithDbl.delivTix} Tix (+${planWithDbl.doubleBonusTix} Bonus)`);
  console.log('✅ TEST 8 PASSED: 2x Double Delivery calculations verified.\n');
}

// -------------------------------------------------------------
// Test 9: Template Routine vs Week-Specific Overrides
// -------------------------------------------------------------
console.log('Test 9: Verifying Template Routine vs Week 8 Custom Override...');
{
  const template = JSON.parse(JSON.stringify(DEFAULT_PLANNER_TEMPLATE));
  // Template: Pete (1) + Bert (2)
  Object.keys(template.npcs).forEach(k => { template.npcs[k].enabled = false; });
  template.npcs.pumpkin_pete = { enabled: true, daysPerWeek: 7 };
  template.npcs.bert = { enabled: true, daysPerWeek: 7 };
  template.doubleDeliveryDays = 0;
  template.includeBounties = false;
  template.includeChores = false;
  template.includeLogins = false;

  // Week 8 Override: Player also delivers to Tywin (10 tix) 1x
  const overrides = {
    8: {
      ...template,
      npcs: {
        ...template.npcs,
        tywin: { enabled: true, daysPerWeek: 1 }
      }
    }
  };

  const planWeek7 = calculateWeekNpcPlan(7, template, overrides, 0, 0);
  assert.strictEqual(planWeek7.isOverride, false);
  assert.strictEqual(planWeek7.delivTix, 21); // Pete 7 + Bert 14

  const planWeek8 = calculateWeekNpcPlan(8, template, overrides, 0, 0);
  assert.strictEqual(planWeek8.isOverride, true);
  assert.strictEqual(planWeek8.delivTix, 31); // Pete 7 + Bert 14 + Tywin 10

  console.log(`  ✓ Week 7 (Standard Template): ${planWeek7.delivTix} Tix`);
  console.log(`  ✓ Week 8 (Auction Override with Tywin): ${planWeek8.delivTix} Tix`);
  console.log('✅ TEST 9 PASSED: Template vs week override resolution verified.\n');
}


// -------------------------------------------------------------
// Test 10: Per-NPC Double Delivery Toggle
// -------------------------------------------------------------
console.log('Test 10: Verifying Per-NPC Double Delivery selective toggling...');
{
  const template = JSON.parse(JSON.stringify(DEFAULT_PLANNER_TEMPLATE));
  Object.keys(template.npcs).forEach(k => { template.npcs[k].enabled = false; });

  // Pete has 2x checked, Bert has 2x UNCHECKED
  template.doubleDeliveryDays = 1;
  template.npcs.pumpkin_pete = { enabled: true, daysPerWeek: 7, doubleDelivery: true };
  template.npcs.bert = { enabled: true, daysPerWeek: 7, doubleDelivery: false };
  template.includeBounties = false;
  template.includeChores = false;
  template.includeLogins = false;

  const plan = calculateWeekNpcPlan('template', template, {}, 0, 0);
  assert.strictEqual(plan.npcBreakdown.pumpkin_pete.isDoubleTicked, true);
  assert.strictEqual(plan.npcBreakdown.pumpkin_pete.doubleBonusTix, 1);
  assert.strictEqual(plan.npcBreakdown.pumpkin_pete.totalTix, 8); // (7 + 1) * 1

  assert.strictEqual(plan.npcBreakdown.bert.isDoubleTicked, false);
  assert.strictEqual(plan.npcBreakdown.bert.doubleBonusTix, 0); // No 2x bonus
  assert.strictEqual(plan.npcBreakdown.bert.totalTix, 14); // 7 * 2

  assert.strictEqual(plan.delivTix, 22); // 8 + 14 = 22
  assert.strictEqual(plan.doubleBonusTix, 1);

  // Now toggle Bert to 2x checked
  template.npcs.bert.doubleDelivery = true;
  const planUpdated = calculateWeekNpcPlan('template', template, {}, 0, 0);
  assert.strictEqual(planUpdated.npcBreakdown.bert.isDoubleTicked, true);
  assert.strictEqual(planUpdated.npcBreakdown.bert.doubleBonusTix, 2);
  assert.strictEqual(planUpdated.npcBreakdown.bert.totalTix, 16); // (7 + 1) * 2
  assert.strictEqual(planUpdated.delivTix, 24); // 8 + 16 = 24
  assert.strictEqual(planUpdated.doubleBonusTix, 3);

  console.log('  ✓ Selective 2x: Pete (8 Tix, +1 ⚡) + Bert (14 Tix, no 2x) = ' + plan.delivTix + ' Tix');
  console.log('  ✓ Both 2x: Pete (8 Tix, +1 ⚡) + Bert (16 Tix, +2 ⚡) = ' + planUpdated.delivTix + ' Tix');
  console.log('✅ TEST 10 PASSED: Individual NPC double delivery toggling verified.\n');
}


// -------------------------------------------------------------
// Test 11: Direct Bounties Input (Regular, Board Bonus +100, Animals)
// -------------------------------------------------------------
console.log('Test 11: Verifying Bounties input (Regular, Board Bonus +100, Animals)...');
{
  const template = JSON.parse(JSON.stringify(DEFAULT_PLANNER_TEMPLATE));
  // Disable deliveries and chores
  Object.keys(template.npcs).forEach(k => { template.npcs[k].enabled = false; });
  template.chores.enabled = false;
  template.logins.enabled = false;

  template.bounties = {
    regularEnabled: true,
    regularTix: 15,
    boardBonusEnabled: false,
    animalEnabled: true,
    animalTix: 20
  };

  // Regular (15) + Animals (20) = 35 tix (no bonus)
  const planNoBonus = calculateWeekNpcPlan('template', template, {}, 0, 0);
  assert.strictEqual(planNoBonus.bountiesBreakdown.regularTix, 15);
  assert.strictEqual(planNoBonus.bountiesBreakdown.boardBonusTix, 0);
  assert.strictEqual(planNoBonus.bountiesBreakdown.animalTix, 20);
  assert.strictEqual(planNoBonus.bountiesTix, 35);

  // Now enable +100 Board Bonus
  template.bounties.boardBonusEnabled = true;
  const planWithBonus = calculateWeekNpcPlan('template', template, {}, 0, 0);
  assert.strictEqual(planWithBonus.bountiesBreakdown.boardBonusTix, 100);
  assert.strictEqual(planWithBonus.bountiesTix, 135);

  console.log('  ✓ Bounties (No Bonus): ' + planNoBonus.bountiesTix + ' Tix');
  console.log('  ✓ Bounties (+100 Board Bonus): ' + planWithBonus.bountiesTix + ' Tix');
  console.log('✅ TEST 11 PASSED: Bounties direct inputs & +100 Board Bonus verified.\n');
}

// -------------------------------------------------------------
// Test 12: Weekly Chores Direct Ticket Input
// -------------------------------------------------------------
console.log('Test 12: Verifying Weekly Chores direct ticket input...');
{
  const template = JSON.parse(JSON.stringify(DEFAULT_PLANNER_TEMPLATE));
  Object.keys(template.npcs).forEach(k => { template.npcs[k].enabled = false; });
  template.bounties.regularEnabled = false;
  template.bounties.boardBonusEnabled = false;
  template.bounties.animalEnabled = false;
  template.logins.enabled = false;

  template.chores = {
    enabled: true,
    choresTix: 18
  };

  const plan = calculateWeekNpcPlan('template', template, {}, 0, 0);
  assert.strictEqual(plan.choresBreakdown.enabled, true);
  assert.strictEqual(plan.choresTix, 18);

  // When disabled
  template.chores.enabled = false;
  const planDisabled = calculateWeekNpcPlan('template', template, {}, 0, 0);
  assert.strictEqual(planDisabled.choresTix, 0);

  console.log('  ✓ Weekly Chores Enabled: ' + plan.choresTix + ' Tix');
  console.log('  ✓ Weekly Chores Disabled: ' + planDisabled.choresTix + ' Tix');
  console.log('✅ TEST 12 PASSED: Weekly Chores direct input verified.\n');
}

// -------------------------------------------------------------
// Test 13: Direct Custom Ticket Inputs & Week 9 Auction Overrides
// -------------------------------------------------------------
console.log('Test 13: Verifying direct ticket inputs & Week 9 Auction overrides...');
{
  const template = JSON.parse(JSON.stringify(DEFAULT_PLANNER_TEMPLATE));
  Object.keys(template.npcs).forEach(k => { template.npcs[k].enabled = false; });
  template.logins.enabled = false;

  // Case A: Default values
  // Bounties: 12 (regular) + 16 (animals) = 28 tix
  // Chores: 7 tix
  const planDefault = calculateWeekNpcPlan('template', template, {}, 0, 0);
  assert.strictEqual(planDefault.bountiesTix, 28);
  assert.strictEqual(planDefault.choresTix, 7);
  assert.strictEqual(planDefault.totalWeeklyTix, 35);

  // Case B: User enters custom amounts in template
  template.bounties.regularTix = 25;
  template.bounties.animalTix = 30;
  template.chores.choresTix = 14;
  const planCustom = calculateWeekNpcPlan('template', template, {}, 0, 0);
  assert.strictEqual(planCustom.bountiesTix, 55, `Expected 55 bounties tix, got ${planCustom.bountiesTix}`);
  assert.strictEqual(planCustom.choresTix, 14, `Expected 14 chores tix, got ${planCustom.choresTix}`);
  assert.strictEqual(planCustom.totalWeeklyTix, 69, `Expected 69 total weekly tix, got ${planCustom.totalWeeklyTix}`);

  // Case C: Week 9 (Auction Week) specific override with higher custom input & board bonus
  const overrides = {
    9: {
      ...template,
      bounties: { ...template.bounties, regularTix: 40, animalTix: 45, boardBonusEnabled: true },
      chores: { ...template.chores, choresTix: 25 }
    }
  };

  const planW8 = calculateWeekNpcPlan(8, template, overrides, 0, 0);
  assert.strictEqual(planW8.isOverride, false);
  assert.strictEqual(planW8.bountiesTix, 55);

  const planW9 = calculateWeekNpcPlan(9, template, overrides, 0, 0);
  assert.strictEqual(planW9.isOverride, true);
  // 40 regular + 45 animal + 100 bonus = 185
  assert.strictEqual(planW9.bountiesTix, 185, `Week 9 auction bounties should be 185, got ${planW9.bountiesTix}`);
  assert.strictEqual(planW9.choresTix, 25, `Week 9 auction chores should be 25, got ${planW9.choresTix}`);
  assert.strictEqual(planW9.totalWeeklyTix, 210, `Week 9 auction total should be 210, got ${planW9.totalWeeklyTix}`);

  console.log(`  ✓ Default: Bounties ${planDefault.bountiesTix} Tix, Chores ${planDefault.choresTix} Tix (Total: ${planDefault.totalWeeklyTix})`);
  console.log(`  ✓ Template Inputs: Bounties ${planCustom.bountiesTix} Tix, Chores ${planCustom.choresTix} Tix (Total: ${planCustom.totalWeeklyTix})`);
  console.log(`  ✓ Week 9 (Auction) Override: Bounties ${planW9.bountiesTix} Tix, Chores ${planW9.choresTix} Tix (Total: ${planW9.totalWeeklyTix})`);
  console.log('✅ TEST 13 PASSED: Custom ticket inputs for bounties and chores verified.\n');
}

console.log('🎉 ALL 13 TICKET PROJECTION & NPC PLANNER TESTS PASSED WITH 100% SUCCESS! 🚀');
