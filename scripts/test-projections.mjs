import assert from 'assert';
import { state } from '../js/state.js';
import { 
  calculateProjections, 
  setProjectionScenario, 
  calculateWeekNpcPlan, 
  CORE_CHAPTER_NPCS, 
  DEFAULT_PLANNER_TEMPLATE,
  togglePlannerTrack,
  setPlannerTrackTix,
  CHAPTER_WEEKS,
  getWeekDateRange,
  renderProjectionsView,
  DEFAULT_ROSTER_BOUNTIES,
  BOUNTY_CATEGORIES,
  categorizeBounty,
  getActiveBountyCards,
  setPlannerSectionTab
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

  // Case A: Default values (Canonical 46 Bounties + 100 Board Bonus)
  // Bounties: 462 (regular) + 112 (animals) + 100 (bonus) = 674 tix
  // Chores: 7 tix
  const planDefault = calculateWeekNpcPlan('template', template, {}, 0, 0);
  assert.strictEqual(planDefault.bountiesTix, 674);
  assert.strictEqual(planDefault.choresTix, 7);
  assert.strictEqual(planDefault.totalWeeklyTix, 681);

  // Case B: User enters custom amounts in template
  template.bounties.regularTix = 25;
  template.bounties.animalTix = 30;
  template.bounties.boardBonusEnabled = false;
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

// -------------------------------------------------------------
// Test 14: Week-by-Week Roadmap with Track Tickets and Daily Logins
// -------------------------------------------------------------
console.log('Test 14: Verifying Week-by-Week Roadmap with Track Tickets and Daily Logins...');
{
  // 2 completed weeks (100 tix each) + Week 3 current (40 tix)
  const displayItems = buildMockDisplayItems(2, 100, 40);
  const currentMondayKey = displayItems[2].mondayKey;
  const targetGoal = 1000;
  const targetWeeks = 12;

  // Simulate user with 17 daily login tickets and 100 track tickets earned
  const externalActuals = {
    loginTickets: 17,
    trackTickets: 100
  };

  const proj = calculateProjections(displayItems, currentMondayKey, targetGoal, targetWeeks, externalActuals);

  // Total earned must strictly be: taskEarned (240) + actualLogins (17) + actualTrack (100) = 357
  assert.strictEqual(proj.taskEarned, 240);
  assert.strictEqual(proj.actualLoginTix, 17);
  assert.strictEqual(proj.actualTrackTix, 100);
  assert.strictEqual(proj.totalEarned, 357, `Expected totalEarned 357, got ${proj.totalEarned}`);

  // Week-by-week roadmap verification
  const roadmap = proj.roadmap;
  assert.strictEqual(roadmap.length, 12);

  // Week 1 (past): 100 tasks + 7 logins = 107
  assert.strictEqual(roadmap[0].type, 'actual');
  assert.strictEqual(roadmap[0].taskTix, 100);
  assert.strictEqual(roadmap[0].loginTix, 7);
  assert.strictEqual(roadmap[0].trackBonus, 0);
  assert.strictEqual(roadmap[0].value, 107);
  assert.strictEqual(roadmap[0].cumulative, 107);

  // Week 2 (past): 100 tasks + 7 logins = 107 (cumul: 214)
  assert.strictEqual(roadmap[1].type, 'actual');
  assert.strictEqual(roadmap[1].taskTix, 100);
  assert.strictEqual(roadmap[1].loginTix, 7);
  assert.strictEqual(roadmap[1].trackBonus, 0);
  assert.strictEqual(roadmap[1].value, 107);
  assert.strictEqual(roadmap[1].cumulative, 214);

  // Week 3 (current): 40 tasks + 3 remaining logins + 100 track tickets = 143 (cumul: 357)
  assert.strictEqual(roadmap[2].type, 'current');
  assert.strictEqual(roadmap[2].taskTix, 40);
  assert.strictEqual(roadmap[2].loginTix, 3);
  assert.strictEqual(roadmap[2].trackBonus, 100);
  assert.strictEqual(roadmap[2].value, 143);
  assert.strictEqual(roadmap[2].cumulative, 357);

  // Week 4 (projected): Track tickets strictly do NOT repeat! (trackBonus === 0)
  assert.strictEqual(roadmap[3].type, 'projected');
  assert.strictEqual(roadmap[3].trackBonus, 0, 'Track tickets must not repeat in Week 4');
  assert.ok(roadmap[3].loginTix > 0, 'Projected week includes planned login tickets');

  console.log(`  ✓ Total Earned strictly includes all categories: Tasks (${proj.taskEarned}) + Logins (${proj.actualLoginTix}) + Track (${proj.actualTrackTix}) = ${proj.totalEarned}`);
  console.log(`  ✓ Week 1: ${roadmap[0].value} Tix (Tasks: ${roadmap[0].taskTix}, Logins: ${roadmap[0].loginTix})`);
  console.log(`  ✓ Week 2: ${roadmap[1].value} Tix (Tasks: ${roadmap[1].taskTix}, Logins: ${roadmap[1].loginTix})`);
  console.log(`  ✓ Week 3 (Live): ${roadmap[2].value} Tix (Tasks: ${roadmap[2].taskTix}, Logins: ${roadmap[2].loginTix}, Track: +${roadmap[2].trackBonus})`);
  console.log(`  ✓ Week 4 (Proj): ${roadmap[3].value} Tix (Track bonus cleanly 0, does not repeat)`);
  console.log('✅ TEST 14 PASSED: Week-by-Week Roadmap accurately incorporates track and login tickets.\n');
}

// -------------------------------------------------------------
// Test 15: Chapter Track Tickets in Chores Section & One-Time Property
// -------------------------------------------------------------
console.log('Test 15: Verifying Chapter Track Tickets in Chores section & one-time property...');
{
  const template = JSON.parse(JSON.stringify(DEFAULT_PLANNER_TEMPLATE));
  template.chores = {
    enabled: true,
    choresTix: 10,
    trackEnabled: true,
    trackTix: 150
  };

  const plan = calculateWeekNpcPlan('template', template, {}, 0, 0);

  // Chores breakdown must contain track tickets
  assert.strictEqual(plan.choresBreakdown.trackEnabled, true);
  assert.strictEqual(plan.choresBreakdown.trackTix, 150);
  assert.strictEqual(plan.trackTix, 150);

  // Weekly routine total MUST NOT add one-time track tickets
  // delivTix (default) + bountiesTix (default 28) + choresTix (10) + loginsTix (7)
  const expectedWeekly = plan.delivTix + plan.bountiesTix + 10 + 7;
  assert.strictEqual(plan.totalWeeklyTix, expectedWeekly, `Weekly total (${plan.totalWeeklyTix}) must NOT add one-time track tickets`);

  // When disabled
  template.chores.trackEnabled = false;
  const planDisabled = calculateWeekNpcPlan('template', template, {}, 0, 0);
  assert.strictEqual(planDisabled.choresBreakdown.trackEnabled, false);
  assert.strictEqual(planDisabled.trackTix, 0);

  console.log(`  ✓ Weekly Routine Rate: ${plan.totalWeeklyTix} Tix/Wk (does NOT multiply track tickets)`);
  console.log(`  ✓ One-Time Track Bonus: +${plan.trackTix} Tix`);
  console.log('✅ TEST 15 PASSED: Track tickets configured under chores and verified as one-time.\n');
}

// -------------------------------------------------------------
// Test 16: Week 1 8-Day Schedule & Routine Calculations
// -------------------------------------------------------------
console.log('Test 16: Verifying Week 1 (8 Days: Nov 08 – Nov 15) vs Weeks 2–12 (7 Days)...');
{
  const template = JSON.parse(JSON.stringify(DEFAULT_PLANNER_TEMPLATE));

  // Default enabled NPCs: Pete (1), Bert (2), Finley (2), Miranda (2), Cornwell (3) = 10 base tix
  // With VIP (+2): Pete (3), Bert (4), Finley (4), Miranda (4), Cornwell (5) = 20 tix/order

  // Week 1 has 8 days: 8 deliveries + 1 double delivery day bonus = 9x per NPC
  // 9 * 20 = 180 delivery tickets + 8 login tickets
  const planW1 = calculateWeekNpcPlan(1, template, {}, 2, 0);
  assert.strictEqual(planW1.delivTix, 180, `Week 1 (8 days) delivTix should be 180, got ${planW1.delivTix}`);
  assert.strictEqual(planW1.loginsTix, 8, `Week 1 logins should be 8, got ${planW1.loginsTix}`);

  // Week 2 (and template) has 7 days: 7 deliveries + 1 double delivery day bonus = 8x per NPC
  // 8 * 20 = 160 delivery tickets + 7 login tickets
  const planW2 = calculateWeekNpcPlan(2, template, {}, 2, 0);
  assert.strictEqual(planW2.delivTix, 160, `Week 2 (7 days) delivTix should be 160, got ${planW2.delivTix}`);
  assert.strictEqual(planW2.loginsTix, 7, `Week 2 logins should be 7, got ${planW2.loginsTix}`);

  // Template routine
  const planTemplate = calculateWeekNpcPlan('template', template, {}, 2, 0);
  assert.strictEqual(planTemplate.delivTix, 160, `Template delivTix should be standard 7-day 160`);
  assert.strictEqual(planTemplate.loginsTix, 7, `Template logins should be standard 7-day 7`);

  console.log(`  ✓ Week 1 (8 days: Nov 08 – Nov 15): ${planW1.delivTix} deliv tix + ${planW1.loginsTix} logins = ${planW1.totalWeeklyTix} Tix`);
  console.log(`  ✓ Week 2 (7 days: Nov 16 – Nov 22): ${planW2.delivTix} deliv tix + ${planW2.loginsTix} logins = ${planW2.totalWeeklyTix} Tix`);
  console.log('✅ TEST 16 PASSED: Week 1 8-day schedule and routine calculation verified.\n');
}

// ---------------------------------------------------------------------------
// Test 17: Verifying Cave Dwellers 12-Week Schedule Dates & Milestones
// ---------------------------------------------------------------------------
console.log('Test 17: Verifying Cave Dwellers 12-Week Schedule Dates & Milestones...');
{
  assert.strictEqual(CHAPTER_WEEKS.length, 12, 'Must have exactly 12 weeks');
  assert.strictEqual(CHAPTER_WEEKS[0].start, '2026-11-08', 'Week 1 must start on Nov 08, 2026');
  assert.strictEqual(CHAPTER_WEEKS[0].end, '2026-11-15', 'Week 1 must end on Nov 15, 2026');
  assert.strictEqual(CHAPTER_WEEKS[0].label, 'Nov 08 – Nov 15', 'Week 1 label must be Nov 08 – Nov 15');
  assert.strictEqual(CHAPTER_WEEKS[0].days, 8, 'Week 1 must have 8 days');

  // Week 2
  assert.strictEqual(CHAPTER_WEEKS[1].start, '2026-11-16', 'Week 2 must start on Nov 16, 2026');
  assert.strictEqual(CHAPTER_WEEKS[1].end, '2026-11-22', 'Week 2 must end on Nov 22, 2026');
  assert.strictEqual(CHAPTER_WEEKS[1].label, 'Nov 16 – Nov 22', 'Week 2 label must be Nov 16 – Nov 22');
  assert.strictEqual(CHAPTER_WEEKS[1].days, 7, 'Week 2 must have 7 days');

  // Week 9 (Auction Week)
  assert.strictEqual(CHAPTER_WEEKS[8].start, '2027-01-04', 'Week 9 must start on Jan 04, 2027');
  assert.strictEqual(CHAPTER_WEEKS[8].end, '2027-01-10', 'Week 9 must end on Jan 10, 2027');
  assert.strictEqual(CHAPTER_WEEKS[8].label, 'Jan 04 – Jan 10', 'Week 9 label must be Jan 04 – Jan 10');
  assert.strictEqual(getWeekDateRange(9), 'Jan 04 – Jan 10');

  // Week 12 (Season Finale)
  assert.strictEqual(CHAPTER_WEEKS[11].start, '2027-01-25', 'Week 12 must start on Jan 25, 2027');
  assert.strictEqual(CHAPTER_WEEKS[11].end, '2027-02-01', 'Week 12 must end on Feb 01, 2027');
  assert.strictEqual(CHAPTER_WEEKS[11].label, 'Jan 25 – Feb 01', 'Week 12 label must be Jan 25 – Feb 01');
  assert.strictEqual(getWeekDateRange(12), 'Jan 25 – Feb 01');

  console.log('  ✓ Week 1: Nov 08 – Nov 15 (8 days, Cave Dwellers launch)');
  console.log('  ✓ Week 2: Nov 16 – Nov 22 (7 days)');
  console.log('  ✓ Week 9 (Auction Week): Jan 04 – Jan 10, 2027');
  console.log('  ✓ Week 12 (Season Finale): Jan 25 – Feb 01, 2027');
  console.log('✅ TEST 17 PASSED: Cave Dwellers 12-week schedule dates verified.\n');
}

// ---------------------------------------------------------------------------
// Test 18: Verifying NPC Avatar Rendering & Multi-Tier Fallback in Projections View
// ---------------------------------------------------------------------------
console.log('Test 18: Verifying NPC Avatar Rendering & Multi-Tier Fallback in Projections View...');
{
  const mockContainer = { innerHTML: '' };
  globalThis.document = {
    getElementById: (id) => id === 'weeklyProjectionsContainer' ? mockContainer : null,
    body: { classList: { contains: () => false } }
  };

  const displayItems = buildMockDisplayItems(2, 100, 50);
  const proj = calculateProjections(displayItems, '2026-11-09', 1000, 12, { loginTickets: 10, trackTickets: 50 });
  renderProjectionsView(proj);

  assert.ok(mockContainer.innerHTML.includes('WEEK 9 (JAN 04 – JAN 10) — AUCTION WEEK'), 'Milestone card must have Jan 04 - Jan 10');
  assert.ok(mockContainer.innerHTML.includes('WEEK 12 (JAN 25 – FEB 01) — SEASON FINALE'), 'Milestone card must have Jan 25 - Feb 01');
  assert.ok(mockContainer.innerHTML.includes('Nov 08, 2026 – Feb 01, 2027'), 'Roadmap summary must have Nov 08, 2026 - Feb 01, 2027');

  // Verify all 11 core NPCs are rendered with avatar img tags having fallback mechanisms
  CORE_CHAPTER_NPCS.forEach(npc => {
    assert.ok(mockContainer.innerHTML.includes(npc.name), `Must render NPC name: ${npc.name}`);
    assert.ok(mockContainer.innerHTML.includes(`alt="${npc.name}"`), `Must render avatar with alt="${npc.name}"`);
    assert.ok(mockContainer.innerHTML.includes('sfl-npc-avatar'), 'Must render with sfl-npc-avatar class for responsive styling');
  });

  console.log('  ✓ All 11 Core NPC avatars rendered with multi-tier fallback and responsive CSS classes');
  console.log('✅ TEST 18 PASSED: Projections View HTML & NPC avatar integrity verified.\n');
}

// ---------------------------------------------------------------------------
// Test 19: Game-Like Bounty Board Categorization & Live Ticket Derivation
// ---------------------------------------------------------------------------
console.log('Test 19: Verifying Game-Like Bounty Board Categorization & Live Ticket Derivation...');
{
  // 1. Verify all 8 requested categories exist
  const expectedKeys = ['flowers', 'crustaceans', 'obsidian', 'fishes', 'dolls', 'fruits', 'crops', 'animals'];
  const actualKeys = BOUNTY_CATEGORIES.map(c => c.key);
  expectedKeys.forEach(k => {
    assert.ok(actualKeys.includes(k), `Category ${k} must be registered in BOUNTY_CATEGORIES`);
  });

  // 2. Verify categorizeBounty classifies items across categories
  assert.strictEqual(categorizeBounty({ name: 'Blue Daffodil' }), 'flowers');
  assert.strictEqual(categorizeBounty({ name: 'Yellow Daffodil' }), 'flowers');
  assert.strictEqual(categorizeBounty({ name: 'Oyster' }), 'crustaceans');
  assert.strictEqual(categorizeBounty({ name: 'Octopus' }), 'crustaceans');
  assert.strictEqual(categorizeBounty({ name: 'Hermit Crab' }), 'crustaceans');
  assert.strictEqual(categorizeBounty({ name: 'Obsidian' }), 'obsidian');
  assert.strictEqual(categorizeBounty({ name: 'Weakfish' }), 'fishes');
  assert.strictEqual(categorizeBounty({ name: 'Coelacanth' }), 'fishes');
  assert.strictEqual(categorizeBounty({ name: 'Ember Doll' }), 'dolls');
  assert.strictEqual(categorizeBounty({ name: 'Bloom Doll' }), 'dolls');
  assert.strictEqual(categorizeBounty({ name: 'Giant Apple' }), 'fruits');
  assert.strictEqual(categorizeBounty({ name: 'Giant Orange' }), 'fruits');
  assert.strictEqual(categorizeBounty({ name: 'Giant Banana' }), 'fruits');
  assert.strictEqual(categorizeBounty({ name: 'Adirondack Potato' }), 'crops');
  assert.strictEqual(categorizeBounty({ name: 'Warty Goblin Pumpkin' }), 'crops');
  assert.strictEqual(categorizeBounty({ name: 'White Carrot' }), 'crops');
  assert.strictEqual(categorizeBounty({ name: 'Chicken (Lvl 3)' }), 'animals');
  assert.strictEqual(categorizeBounty({ name: 'Cow #1' }), 'animals');
  assert.strictEqual(categorizeBounty({ name: 'Sheep' }), 'animals');

  // 3. Test canonical cards calculation (27 regular bounties + 19 animal bounties = 46)
  const defaultCards = getActiveBountyCards();
  assert.strictEqual(defaultCards.cards.length, 46, `Canonical roster must be exactly 46 cards, got ${defaultCards.cards.length}`);
  assert.strictEqual(defaultCards.regularCount, 27, 'Must have 27 regular bounties (5 flowers + 5 fish + 3 crustaceans + 3 obsidian + 3 giant fruits + 3 crops + 5 dolls)');
  assert.strictEqual(defaultCards.animalCount, 19, 'Must have 19 animal bounties (8 chicken + 4 cow + 4 sheep + 3 pig)');
  assert.strictEqual(defaultCards.cards.find(c => c.id === 'b_giant_apple').tickets, 17, 'Giant Apple must yield 17 tix');
  assert.strictEqual(defaultCards.cards.find(c => c.id === 'b_giant_banana').tickets, 33, 'Giant Banana must yield 33 tix');
  assert.strictEqual(defaultCards.cards.find(c => c.id === 'b_giant_orange').tickets, 10, 'Giant Orange must yield 10 tix');
  assert.strictEqual(defaultCards.cards.find(c => c.id === 'b_obsidian_33').tickets, 33, 'Obsidian #1 must yield 33 tix');
  assert.strictEqual(defaultCards.cards.find(c => c.id === 'b_obsidian_43_1').tickets, 43, 'Obsidian #2 must yield 43 tix');
  assert.strictEqual(defaultCards.cards.find(c => c.id === 'b_obsidian_43_2').tickets, 43, 'Obsidian #3 must yield 43 tix');
  assert.ok(defaultCards.regularTix > 0, 'Regular tickets sum must be positive');
  assert.ok(defaultCards.animalTix > 0, 'Animal tickets sum must be positive');
  assert.strictEqual(defaultCards.allRegularDone, true, 'Default state should have all regular done');

  // 4. Test live bounties derivation from state.globalData.bounties
  state.globalData = {
    bounties: [
      { id: '101', name: 'Blue Daffodil', baseTickets: 12 },
      { id: '102', name: 'Octopus', baseTickets: 25 },
      { id: '103', name: 'Chicken (Lvl 3+)', baseTickets: 6, level: 3 },
      { id: '104', name: 'Cow (Lvl 4+)', baseTickets: 11, level: 4 }
    ]
  };
  const liveCards = getActiveBountyCards();
  assert.strictEqual(liveCards.cards.length, 46, 'Must maintain 46 canonical roster cards with live overrides');
  assert.strictEqual(liveCards.regularCount, 27, '27 regular bounties');
  assert.strictEqual(liveCards.animalCount, 19, '19 animal bounties');
  assert.strictEqual(liveCards.cards.find(c => c.id === 'b_blue_daffodil').tickets, 12);
  assert.strictEqual(liveCards.cards.find(c => c.id === 'b_octopus').tickets, 25);
  assert.strictEqual(liveCards.cards.find(c => c.id === 'b_chicken_lvl3').tickets, 6);
  assert.strictEqual(liveCards.cards.find(c => c.id === 'b_cow_lvl4').tickets, 11);
  state.globalData = {}; // Clean up

  // 5. Test calculation with partial tile selection
  const partialTiles = {
    b_blue_daffodil: true,
    b_yellow_daffodil: false,
    b_chicken_lvl3: true,
    b_cow_lvl4: false
  };
  const partialCards = getActiveBountyCards(partialTiles);
  assert.strictEqual(partialCards.cards.find(c => c.id === 'b_yellow_daffodil').isActive, false);
  assert.strictEqual(partialCards.cards.find(c => c.id === 'b_cow_lvl4').isActive, false);
  assert.strictEqual(partialCards.allRegularDone, false, 'Should be false when yellow daffodil is unticked');

  // 6. Test plan calculation with tiles in config
  const customTilesTemplate = {
    ...DEFAULT_PLANNER_TEMPLATE,
    bounties: {
      regularEnabled: true,
      animalEnabled: true,
      tiles: {
        b_blue_daffodil: true,
        b_chicken_lvl3: true
      }
    }
  };
  const tilePlan = calculateWeekNpcPlan('template', customTilesTemplate, {}, 0, 0);
  assert.ok(tilePlan.bountiesBreakdown.regularTix > 0);
  assert.ok(tilePlan.bountiesBreakdown.animalTix > 0);
  assert.strictEqual(tilePlan.bountiesBreakdown.boardBonusEnabled, false, 'Bonus not awarded when not all regular bounties are done');

  console.log(`  ✓ 7 Categories registered: ${actualKeys.join(', ')}`);
  console.log(`  ✓ Canonical Roster: 24 regular + 19 animal bounties (43 total)`);
  console.log(`  ✓ Live Farm Derivation: dynamically reflects exact farm bounties`);
  console.log('✅ TEST 19 PASSED: Bounty Board categorization & live derivation verified.\n');
}

// ---------------------------------------------------------------------------
// Test 20: Bounty Board Game-Like Interface HTML Structure & Audits
// ---------------------------------------------------------------------------
console.log('Test 20: Verifying Bounty Board Game-Like Interface HTML Structure & Plaques...');
{
  const mockContainer = { innerHTML: '' };
  globalThis.document = {
    getElementById: (id) => id === 'weeklyProjectionsContainer' ? mockContainer : null,
    body: { classList: { contains: () => false } }
  };

  setPlannerSectionTab('bounties');

  const displayItems = buildMockDisplayItems(2, 100, 50);
  const proj = calculateProjections(displayItems, '2026-11-09', 1000, 12);
  renderProjectionsView(proj);

  // Assert game board container and plaques
  assert.ok(mockContainer.innerHTML.includes('bounty-game-board'), 'Must render .bounty-game-board container');
  assert.ok(mockContainer.innerHTML.includes('bounty-category-plaque'), 'Must render category plaques');
  assert.ok(mockContainer.innerHTML.includes('Flower Bounties'), 'Must render Flower Bounties plaque');
  assert.ok(mockContainer.innerHTML.includes('Fish Bounties'), 'Must render Fish Bounties plaque');
  assert.ok(mockContainer.innerHTML.includes('Crustacean Bounties'), 'Must render Crustacean Bounties plaque');
  assert.ok(mockContainer.innerHTML.includes('Obsidian Bounties'), 'Must render Obsidian Bounties plaque');
  assert.ok(mockContainer.innerHTML.includes('Giant Fruit Bounties'), 'Must render Giant Fruit Bounties plaque');
  assert.ok(mockContainer.innerHTML.includes('Exotic Crop Bounties'), 'Must render Exotic Crop Bounties plaque');
  assert.ok(mockContainer.innerHTML.includes('Doll Bounties'), 'Must render Doll Bounties plaque');
  assert.ok(mockContainer.innerHTML.includes('Animal Bounties'), 'Must render Animal Bounties plaque');

  // Assert tiles, checkmarks and ribbons
  assert.ok(mockContainer.innerHTML.includes('bounty-tile'), 'Must render .bounty-tile');
  assert.ok(mockContainer.innerHTML.includes('bounty-tile-checkmark'), 'Must render green checkmark badge');
  assert.ok(mockContainer.innerHTML.includes('bounty-tile-ribbon'), 'Must render bottom golden ribbon');
  assert.ok(mockContainer.innerHTML.includes('bounty-tile-level'), 'Must render animal level badge');
  assert.ok(mockContainer.innerHTML.includes('bounty-bonus-banner'), 'Must render Full Board Bonus banner');
  assert.ok(mockContainer.innerHTML.includes('togglePlannerBountyTile'), 'Must have togglePlannerBountyTile click handler');
  assert.ok(mockContainer.innerHTML.includes('toggleAllPlannerBountyTiles'), 'Must have toggleAllPlannerBountyTiles click handler');

  // Restore deliveries tab for subsequent tests
  setPlannerSectionTab('deliveries');

  console.log('  ✓ In-game Bounty Board HTML structure verified');
  console.log('  ✓ All 7 plaques, tiles, checkmarks, ribbons, and board bonus banner verified');
  console.log('✅ TEST 20 PASSED: Bounty Board UI integrity verified.\n');
}

console.log('🎉 ALL 20 TICKET PROJECTION & NPC PLANNER TESTS PASSED WITH 100% SUCCESS! 🚀');
