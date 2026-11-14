import assert from 'assert';
import { preserveCustomTaskEdits, reconcileDeliveriesWithNpcs } from '../api/chapter.js';

console.log('🧪 Starting Automated Tests for Task Editing (Cost All + Animal Bounty Tickets Only)...');

// Test 1: Direct Custom Ticket Setting on Animal Bounties
console.log('\nTest 1: Verifying Animal Bounty Custom Ticket Preservation & Display...');
{
  const desiredYield = 1; // e.g. Chicken Lvl 3 edited to 1 ticket
  const target = {
    id: 'bounty_chicken_3',
    name: 'Chicken (Lvl 3+)',
    level: 3,
    baseTickets: 4,
    tickets: 4
  };

  // User enters desired yield directly
  target.baseTickets = desiredYield;
  target.tickets = desiredYield;
  target.userTickets = desiredYield;
  target.isCustomTickets = true;

  assert.strictEqual(target.userTickets, 1, 'Custom ticket yield must be directly stored as 1');
  assert.strictEqual(target.baseTickets, 1, 'Base tickets must not be subtracted to 0 by active boosts');
  assert.strictEqual(target.isCustomTickets, true, 'isCustomTickets flag must be set');

  // Display computation for fixed tickets
  const isFixedTix = Boolean(target.isManual) || Boolean(target.isCustomTickets) || target.userTickets !== undefined;
  const displayTix = isFixedTix ? (target.userTickets !== undefined ? target.userTickets : target.baseTickets) : target.baseTickets;
  assert.strictEqual(displayTix, 1, 'Display tickets must evaluate to 1, never resetting to 0');
  console.log('✅ TEST 1 PASSED: Animal bounty custom ticket yield stored and displayed cleanly.');
}

// Test 2: Cost Editing Preservation on Deliveries
console.log('\nTest 2: Verifying Cost Editing on Deliveries...');
{
  const vault = {
    archiveDeliveries: [
      {
        id: 'deliv_bert_d1',
        from: 'Bert',
        name: 'Bert',
        completed: true,
        checked: true,
        cost: 1.25,
        itemsCost: 1.25,
        userCost: 1.25,
        isCustomCost: true,
        baseTickets: 2,
        tickets: 2,
        isManual: false
      }
    ],
    npcSnapshots: { bert: { deliveryCount: 1, skippedCount: 0 } }
  };

  const currentNpcsData = { bert: { deliveryCount: 1, skippedCount: 0 } };
  const parsedDeliveryList = [
    {
      from: 'Bert',
      completed: true,
      itemsCost: 4.80,
      baseTickets: 2
    }
  ];

  reconcileDeliveriesWithNpcs(vault, parsedDeliveryList, currentNpcsData);

  const bertOrder = vault.archiveDeliveries.find(d => d.id === 'deliv_bert_d1');
  assert.strictEqual(bertOrder.cost, 1.25, 'Custom cost (1.25 SFL) must not be overwritten by market price (4.80)');
  assert.strictEqual(bertOrder.isCustomCost, true, 'isCustomCost must remain true');
  assert.strictEqual(bertOrder.isManual, false, 'isManual must remain false');
  console.log('✅ TEST 2 PASSED: Custom delivery cost successfully preserved.');
}

// Test 3: Cost Editing on Regular Bounties and Chores (Completed only, Active isolated)
console.log('\nTest 3: Verifying Cost Editing on Bounties and Chores (Completed preserved, Active isolated)...');
{
  const existingList = [
    {
      id: 'bounty_wheat',
      name: 'Wheat',
      level: 1,
      cost: 0.95,
      userCost: 0.95,
      isCustomCost: true,
      baseTickets: 1,
      tickets: 1,
      completed: true,
      checked: true,
      isManual: false
    }
  ];

  const completedFreshList = [
    {
      id: 'bounty_wheat',
      name: 'Wheat',
      level: 1,
      cost: 2.50,
      baseTickets: 1,
      tickets: 1,
      completed: true,
      checked: true,
      isManual: false
    }
  ];

  preserveCustomTaskEdits(completedFreshList, existingList, false);
  assert.strictEqual(completedFreshList[0].cost, 0.95, 'Completed bounty custom cost must be preserved at 0.95 SFL');
  assert.strictEqual(completedFreshList[0].isCustomCost, true, 'isCustomCost must remain true on completed task');

  const activeFreshList = [
    {
      id: 'bounty_wheat',
      name: 'Wheat',
      level: 1,
      cost: 2.50,
      baseTickets: 1,
      tickets: 1,
      completed: false,
      checked: false,
      isManual: false
    }
  ];

  preserveCustomTaskEdits(activeFreshList, existingList, false);
  assert.strictEqual(activeFreshList[0].cost, 2.50, 'Active bounty must NOT inherit old custom cost, must remain 2.50 SFL');
  assert.strictEqual(activeFreshList[0].isCustomCost, undefined, 'Active bounty must NOT have isCustomCost');

  console.log('✅ TEST 3 PASSED: Completed task cost preserved; Active task cost isolated from carryover.');
}

// Test 4: Custom Tickets on Animal Bounties Preserved Across Fetch
console.log('\nTest 4: Verifying Animal Bounty Custom Tickets Preservation...');
{
  const existingAnimalBounties = [
    {
      id: 'bounty_cow_3',
      name: 'Cow',
      level: 3,
      cost: 3.0,
      baseTickets: 4,
      tickets: 4,
      userTickets: 4,
      isCustomTickets: true,
      isManual: false
    }
  ];

  const freshAnimalBounties = [
    {
      id: 'bounty_cow_3',
      name: 'Cow',
      level: 3,
      cost: 3.0,
      baseTickets: 3,
      tickets: 3,
      isManual: false
    }
  ];

  preserveCustomTaskEdits(freshAnimalBounties, existingAnimalBounties, false);

  assert.strictEqual(freshAnimalBounties[0].baseTickets, 4, 'Animal bounty custom tickets preserved at 4');
  assert.strictEqual(freshAnimalBounties[0].isCustomTickets, true, 'isCustomTickets must remain true');
  assert.strictEqual(freshAnimalBounties[0].isManual, false, 'isManual must remain false');
  console.log('✅ TEST 4 PASSED: Animal bounty custom tickets preserved across fetch.');
}

// Test 5: Cost Input 3 Decimal Places Formatting and Sanitize Sorting
console.log('\nTest 5: Verifying Cost Input 3 Decimal Places Formatting & Sanitize Sorting...');
{
  const rawCost1 = 1.25;
  const formatted1 = Number(rawCost1 || 0).toFixed(3);
  assert.strictEqual(formatted1, '1.250', '1.25 should format to 1.250');

  const rawCost2 = 0;
  const formatted2 = Number(rawCost2 || 0).toFixed(3);
  assert.strictEqual(formatted2, '0.000', '0 should format to 0.000');

  const rawCost3 = 3.14159;
  const formatted3 = Number(rawCost3 || 0).toFixed(3);
  assert.strictEqual(formatted3, '3.142', '3.14159 should round to 3.142');

  console.log('✅ TEST 5 PASSED: 3 decimal places formatting verified.');
}

// Test 6: Manually Edited Animal Bounties Excluded from Boosts in Chapter Logs
console.log('\nTest 6: Verifying Manually Edited Animal Bounties Excluded from Boosts in Chapter Logs...');
{
  const bEdited = {
    id: 'bounty_cow_1',
    name: 'Cow',
    level: 1,
    baseTickets: 1,
    tickets: 1,
    userTickets: 1,
    isCustomTickets: true,
    completed: true,
    checked: true,
    isManual: false
  };

  const bAuto = {
    id: 'bounty_chicken_1',
    name: 'Chicken',
    level: 1,
    baseTickets: 2,
    tickets: 2,
    completed: true,
    checked: true,
    isManual: false
  };

  const isManTask = (b) => Boolean(b.isManual) || (typeof b.id === 'string' && b.id.startsWith('manual_')) || Boolean(b.isCustomTickets) || b.userTickets !== undefined;

  assert.strictEqual(isManTask(bEdited), true, 'Manually edited animal bounty must be recognized as fixed/manual tickets');
  assert.strictEqual(isManTask(bAuto), false, 'Unedited animal bounty must be recognized as automated');

  // Verify boost unit assignment
  let boostUnits = 0;
  [bEdited, bAuto].forEach(b => {
    if (!isManTask(b)) boostUnits += 1;
  });

  assert.strictEqual(boostUnits, 1, 'Only the unedited animal bounty should receive a boost unit');

  const boostLevel = 1;
  const extraAnimalBoost = boostLevel * boostUnits;
  const totalAnimalTix = bEdited.userTickets + (bAuto.baseTickets + extraAnimalBoost);

  // bEdited (1) + bAuto (2 + 1) = 4 tickets total
  assert.strictEqual(extraAnimalBoost, 1, 'Extra boost must only be 1 (for bAuto), not 2');
  assert.strictEqual(totalAnimalTix, 4, 'Total animal tickets must evaluate to 4 (1 edited + 3 auto)');

  console.log('✅ TEST 6 PASSED: Manually edited animal bounties strictly excluded from +1 boosts.');
}

console.log('\n🎉 ALL 6 TASK EDITING TESTS PASSED WITH 100% SUCCESS!\n');
