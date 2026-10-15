import assert from 'assert';
import { sanitizeDeliveries, preserveCustomDeliveryEdits, slugifyNpc } from '../js/state.js';

console.log('🧪 Starting Automated Tests for Independent Delivery Costs & Safe Slugs...');

// Test 1: Verify slugifyNpc properly cleans names with apostrophes and spaces
console.log('\nTest 1: Verifying slugifyNpc...');
{
  assert.strictEqual(slugifyNpc("Pumpkin' Pete"), 'pumpkin_pete', "Pumpkin' Pete should slugify to pumpkin_pete");
  assert.strictEqual(slugifyNpc("Tyreless Timmy"), 'tyreless_timmy', "Tyreless Timmy should slugify to tyreless_timmy");
  assert.strictEqual(slugifyNpc("Cornwell"), 'cornwell', "Cornwell should slugify to cornwell");
  assert.strictEqual(slugifyNpc("Pete's Order"), 'petes_order', "Pete's Order should strip apostrophes");
  console.log('✅ TEST 1 PASSED: slugifyNpc cleans names properly.');
}

// Test 2: Cost Isolation Between Deliveries of the Same NPC
console.log('\nTest 2: Verifying Cost Isolation between different deliveries of the same NPC...');
{
  const targetDeliveries = [
    {
      id: 'deliv_pumpkin_pete_d1',
      from: 'Pumpkin Pete',
      name: 'Pumpkin Pete',
      cost: 0.15,
      itemsCost: 0.15,
      completed: true,
      checked: true
    },
    {
      id: 'deliv_pumpkin_pete_d2',
      from: 'Pumpkin Pete',
      name: 'Pumpkin Pete',
      cost: 0.85,
      itemsCost: 0.85,
      completed: true,
      checked: true
    }
  ];

  // User edits d1 cost to 0.50
  const sourceDeliveries = [
    {
      id: 'deliv_pumpkin_pete_d1',
      from: 'Pumpkin Pete',
      name: 'Pumpkin Pete',
      cost: 0.50,
      itemsCost: 0.50,
      userCost: 0.50,
      isCustomCost: true
    }
  ];

  preserveCustomDeliveryEdits(targetDeliveries, sourceDeliveries);

  // d1 should have updated to 0.50
  assert.strictEqual(targetDeliveries[0].cost, 0.50, 'Delivery #1 should have updated custom cost 0.50');
  assert.strictEqual(targetDeliveries[0].isCustomCost, true, 'Delivery #1 should be marked custom');

  // d2 must REMAIN 0.85 (NOT OVERWRITTEN)
  assert.strictEqual(targetDeliveries[1].cost, 0.85, 'Delivery #2 must NOT be overwritten with Delivery #1 cost');
  assert.strictEqual(targetDeliveries[1].isCustomCost, undefined, 'Delivery #2 should NOT be marked custom');

  console.log('✅ TEST 2 PASSED: Deliveries of the same NPC have 100% isolated costs.');
}

// Test 3: Apostrophe & Quote Safety in sanitizeDeliveries
console.log('\nTest 3: Verifying ID generation for NPCs with apostrophes...');
{
  const testDelivs = [
    {
      from: "Pumpkin' Pete",
      name: "Pumpkin' Pete",
      completed: true,
      checked: true,
      deliveryCountAtCreation: 1
    }
  ];

  const cleaned = sanitizeDeliveries(testDelivs);
  assert.strictEqual(cleaned.length, 1);
  assert.strictEqual(cleaned[0].id, 'deliv_pumpkin_pete_d1', 'ID must not contain apostrophes');
  assert(!cleaned[0].id.includes("'"), 'ID must be safe for single-quote HTML attributes');

  console.log('✅ TEST 3 PASSED: Clean alphanumeric IDs generated without quotes.');
}

// Test 4: Collision Disambiguation (Distinct deliveries must never be collapsed)
console.log('\nTest 4: Verifying collision disambiguation for deliveries of the same NPC...');
{
  const distinctDeliveries = [
    {
      from: 'Corny',
      name: 'Corny',
      completed: true,
      checked: true,
      completedAt: 1728000000000,
      cost: 0.40
    },
    {
      from: 'Corny',
      name: 'Corny',
      completed: true,
      checked: true,
      completedAt: 1728003600000, // Different timestamp!
      cost: 0.90
    }
  ];

  const cleaned = sanitizeDeliveries(distinctDeliveries);
  assert.strictEqual(cleaned.length, 2, 'Both distinct deliveries must be preserved');
  assert.notStrictEqual(cleaned[0].id, cleaned[1].id, 'Each delivery must receive a unique ID');
  const costs = cleaned.map(d => d.cost).sort();
  assert.deepStrictEqual(costs, [0.40, 0.90], 'Both delivery costs must be preserved');

  console.log('✅ TEST 4 PASSED: Distinct deliveries are preserved with unique IDs and never collapsed.');
}

console.log('\n🎉 ALL INDEPENDENT DELIVERY COST TESTS PASSED SUCCESSFULLY! 🚀');
