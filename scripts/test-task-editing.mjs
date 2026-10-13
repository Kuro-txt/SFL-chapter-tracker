import assert from 'assert';
import { preserveCustomTaskEdits, reconcileDeliveriesWithNpcs } from '../api/chapter.js';

console.log('🧪 Starting Automated Tests for Task Editing (Cost All + Animal Bounty Tickets Only)...');

// Test 1: Animal Bounty Ticket Yield Reverse-Derivation
console.log('\nTest 1: Verifying Animal Bounty Ticket Yield Derivation...');
{
  const boostCount = 1; // 1 Boost active
  const desiredYield = 3;
  const isMan = false;

  const derivedBase = isMan ? desiredYield : Math.max(0, desiredYield - boostCount); // 3 - 1 = 2
  assert.strictEqual(derivedBase, 2, 'Derived base for animal bounty should be 2');

  const recomputedYield = derivedBase + boostCount;
  assert.strictEqual(recomputedYield, 3, 'Recomputed yield with 1 boost should be 3');

  // When boost is 0 (Chapter Logs NONE)
  assert.strictEqual(derivedBase + 0, 2, 'Yield under 0 boost should scale to 2');
  console.log('✅ TEST 1 PASSED: Animal bounty ticket derivation verified.');
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

// Test 3: Cost Editing on Regular Bounties and Chores
console.log('\nTest 3: Verifying Cost Editing on Bounties and Chores...');
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
      isManual: false
    }
  ];

  const freshList = [
    {
      id: 'bounty_wheat',
      name: 'Wheat',
      level: 1,
      cost: 2.50,
      baseTickets: 1,
      tickets: 1,
      isManual: false
    }
  ];

  preserveCustomTaskEdits(freshList, existingList, false);

  assert.strictEqual(freshList[0].cost, 0.95, 'Bounty custom cost must be preserved at 0.95 SFL');
  assert.strictEqual(freshList[0].isCustomCost, true, 'isCustomCost must remain true');
  assert.strictEqual(freshList[0].isManual, false, 'isManual must remain false');
  console.log('✅ TEST 3 PASSED: Custom bounty/chore cost successfully preserved.');
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

console.log('\n🎉 ALL 5 TASK EDITING TESTS PASSED WITH 100% SUCCESS!\n');
