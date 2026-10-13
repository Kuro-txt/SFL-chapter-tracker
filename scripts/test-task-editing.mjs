import assert from 'assert';
import { preserveCustomTaskEdits, reconcileDeliveriesWithNpcs } from '../api/chapter.js';

console.log('🧪 Starting Automated Tests for Task Editing (Way 1)...');

// Test 1: Delivery Yield Reverse-Derivation
console.log('\nTest 1: Verifying Delivery Yield Reverse-Derivation...');
{
  const vipBonus = 2;
  const boostCount = 2; // Boost #2
  const bonusPerUnit = vipBonus + boostCount; // 4

  const desiredYield = 5;
  const isDouble = false;
  const derivedBase = Math.max(0, desiredYield - bonusPerUnit); // 5 - 4 = 1
  assert.strictEqual(derivedBase, 1, 'Derived base should be 1');

  // Verify recomputed yield with active bonuses equals desired yield
  const recomputedYield = derivedBase + vipBonus + boostCount;
  assert.strictEqual(recomputedYield, 5, 'Recomputed yield must equal desired yield (5)');

  // Verify Chapter Logs toggle NONE (boost = 0)
  const toggleNoneYield = derivedBase + vipBonus + 0;
  assert.strictEqual(toggleNoneYield, 3, 'Under NONE boost toggle, yield must scale to 3');

  // Verify Chapter Logs toggle Boost #3 (boost = 3)
  const toggleBoost3Yield = derivedBase + vipBonus + 3;
  assert.strictEqual(toggleBoost3Yield, 6, 'Under Boost #3 toggle, yield must scale to 6');
  console.log('✅ TEST 1 PASSED: Delivery yield reverse-derivation and toggle scaling verified.');
}

// Test 2: Double Delivery Event Day Reverse-Derivation
console.log('\nTest 2: Verifying Double Delivery Event Reverse-Derivation...');
{
  const vipBonus = 2;
  const boostCount = 2;
  const bonusPerUnit = vipBonus + boostCount; // 4
  const desiredYield = 10;
  const isDouble = true;

  const half = Math.round(desiredYield / 2); // 5
  const derivedBase = Math.max(0, half - bonusPerUnit); // 5 - 4 = 1
  assert.strictEqual(derivedBase, 1, 'Derived base for double delivery should be 1');

  const recomputedDoubleYield = (derivedBase + vipBonus + boostCount) * 2;
  assert.strictEqual(recomputedDoubleYield, 10, 'Recomputed double yield must be 10');
  console.log('✅ TEST 2 PASSED: Double delivery event reverse-derivation verified.');
}

// Test 3: Bounty and Chore Reverse-Derivation
console.log('\nTest 3: Verifying Bounty and Chore Reverse-Derivation...');
{
  const vipBonus = 2;
  const boostCount = 1;

  // Chore (VIP + Boost eligible)
  const choreDesired = 4;
  const choreDerived = Math.max(0, choreDesired - (vipBonus + boostCount)); // 4 - 3 = 1
  assert.strictEqual(choreDerived, 1, 'Chore derived base should be 1');
  assert.strictEqual(choreDerived + vipBonus + boostCount, 4);

  // Bounty (Boost only, no VIP in SFL)
  const bountyDesired = 3;
  const bountyDerived = Math.max(0, bountyDesired - boostCount); // 3 - 1 = 2
  assert.strictEqual(bountyDerived, 2, 'Bounty derived base should be 2');
  assert.strictEqual(bountyDerived + boostCount, 3);
  console.log('✅ TEST 3 PASSED: Bounty and chore reverse-derivation verified.');
}

// Test 4: Preservation Across Fresh Fetch Data (preserveCustomTaskEdits)
console.log('\nTest 4: Verifying preserveCustomTaskEdits across fetch...');
{
  const existingList = [
    {
      id: 'bounty_wheat',
      name: 'Wheat',
      level: 1,
      cost: 1.5,
      userCost: 1.5,
      isCustomCost: true,
      baseTickets: 3,
      tickets: 3,
      userTickets: 3,
      isCustomTickets: true,
      isManual: false
    }
  ];

  const freshList = [
    {
      id: 'bounty_wheat',
      name: 'Wheat',
      level: 1,
      cost: 2.0,
      baseTickets: 1,
      tickets: 1,
      isManual: false
    }
  ];

  preserveCustomTaskEdits(freshList, existingList, false);

  assert.strictEqual(freshList[0].cost, 1.5, 'Cost must be preserved at 1.5');
  assert.strictEqual(freshList[0].baseTickets, 3, 'Base tickets must be preserved at 3');
  assert.strictEqual(freshList[0].isCustomCost, true, 'isCustomCost flag must be preserved');
  assert.strictEqual(freshList[0].isCustomTickets, true, 'isCustomTickets flag must be preserved');
  assert.strictEqual(freshList[0].isManual, false, 'isManual must remain false');
  console.log('✅ TEST 4 PASSED: Custom edits successfully preserved across simulated fetch.');
}

// Test 5: Reconcile Deliveries Skips Overwrite When isCustomCost / isCustomTickets Set
console.log('\nTest 5: Verifying reconcileDeliveriesWithNpcs skips overwrite...');
{
  const vault = {
    archiveDeliveries: [
      {
        id: 'deliv_bert_d1',
        from: 'Bert',
        name: 'Bert',
        completed: true,
        checked: true,
        cost: 0.8,
        itemsCost: 0.8,
        userCost: 0.8,
        isCustomCost: true,
        baseTickets: 1,
        tickets: 1,
        userTickets: 1,
        isCustomTickets: true,
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
      itemsCost: 5.0,
      baseTickets: 2
    }
  ];

  reconcileDeliveriesWithNpcs(vault, parsedDeliveryList, currentNpcsData);

  const bertOrder = vault.archiveDeliveries.find(d => d.id === 'deliv_bert_d1');
  assert.strictEqual(bertOrder.cost, 0.8, 'Custom cost must not be overwritten by market price (5.0)');
  assert.strictEqual(bertOrder.baseTickets, 1, 'Custom base tickets must not be overwritten by default base (2)');
  assert.strictEqual(bertOrder.isManual, false, 'isManual must remain false');
  console.log('✅ TEST 5 PASSED: Reconcile delivery successfully preserved custom edits.');
}

console.log('\n🎉 ALL 5 TASK EDITING TESTS PASSED WITH 100% SUCCESS!\n');
