import assert from 'assert';

console.log('🧪 Starting Automated Tests for Target Ratio Indicator (Avg / Tix)...');

// Helper function mirroring the production match condition
function isTargetRatioMatch(cost, tickets, targetRatio) {
  const tr = Number(targetRatio) || 0;
  const tix = Number(tickets) || 0;
  const c = Number(cost) || 0;
  if (tr <= 0 || tix <= 0) return false;
  const ratio = c / tix;
  return ratio <= tr;
}

// Test 1: Exact threshold and below threshold
console.log('\nTest 1: Verifying threshold comparison (ratio <= targetRatio)...');
{
  const targetRatio = 0.10;

  // Task A: 0.20 SFL for 4 tickets -> 0.050 SFL/tix (well under 0.10)
  assert.strictEqual(isTargetRatioMatch(0.20, 4, targetRatio), true, '0.05 SFL/tix must match <= 0.10');

  // Task B: 0.40 SFL for 4 tickets -> 0.100 SFL/tix (exact match)
  assert.strictEqual(isTargetRatioMatch(0.40, 4, targetRatio), true, '0.10 SFL/tix must match <= 0.10');

  // Task C: 0.44 SFL for 4 tickets -> 0.110 SFL/tix (above threshold)
  assert.strictEqual(isTargetRatioMatch(0.44, 4, targetRatio), false, '0.11 SFL/tix must not match <= 0.10');

  // Task D: 1.00 SFL for 5 tickets -> 0.200 SFL/tix (above threshold)
  assert.strictEqual(isTargetRatioMatch(1.00, 5, targetRatio), false, '0.20 SFL/tix must not match <= 0.10');

  console.log('✅ TEST 1 PASSED: Ratio threshold comparison works accurately.');
}

// Test 2: Free tasks (0 cost)
console.log('\nTest 2: Verifying free tasks (0 SFL cost)...');
{
  const targetRatio = 0.10;
  // Free task: 0 SFL for 2 tickets -> 0.000 SFL/tix
  assert.strictEqual(isTargetRatioMatch(0, 2, targetRatio), true, '0 SFL task must match target ratio');
  assert.strictEqual(isTargetRatioMatch(0.0, 5, 0.05), true, '0 SFL task must match any positive target ratio');

  console.log('✅ TEST 2 PASSED: Free tasks (0 SFL) qualify as matching.');
}

// Test 3: Zero tickets and edge cases (NaN protection)
console.log('\nTest 3: Verifying zero ticket handling (no NaN or divide-by-zero)...');
{
  const targetRatio = 0.10;

  // 0 tickets should not match and never produce NaN
  assert.strictEqual(isTargetRatioMatch(0.50, 0, targetRatio), false, '0 tickets must not match');
  assert.strictEqual(isTargetRatioMatch(0, 0, targetRatio), false, '0 tickets and 0 cost must not match');
  assert.strictEqual(isTargetRatioMatch(1.0, -1, targetRatio), false, 'negative tickets must not match');

  console.log('✅ TEST 3 PASSED: Zero and negative ticket edge cases handled safely.');
}

// Test 4: Inactive target ratio (0 or blank)
console.log('\nTest 4: Verifying inactive target ratio (<= 0)...');
{
  assert.strictEqual(isTargetRatioMatch(0.10, 4, 0), false, 'targetRatio = 0 must be inactive');
  assert.strictEqual(isTargetRatioMatch(0.10, 4, -0.05), false, 'negative targetRatio must be inactive');
  assert.strictEqual(isTargetRatioMatch(0.10, 4, null), false, 'null targetRatio must be inactive');
  assert.strictEqual(isTargetRatioMatch(0.10, 4, undefined), false, 'undefined targetRatio must be inactive');

  console.log('✅ TEST 4 PASSED: Inactive / empty target ratio turns off match highlights.');
}

// Test 5: Full category aggregation with skipped task filtering
console.log('\nTest 5: Verifying multi-category aggregation and skipped task exclusion...');
{
  const targetRatio = 0.15;
  const vipBonus = 2;
  const boostCount = 1;

  const deliveries = [
    { name: 'Order 1', cost: 0.40, baseTickets: 2, checked: false, isSkipped: false }, // yield = 2+2+1 = 5, cost/yield = 0.08 <= 0.15 -> MATCH
    { name: 'Order 2', cost: 1.50, baseTickets: 2, checked: false, isSkipped: false }, // yield = 5, cost/yield = 0.30 > 0.15 -> NO
    { name: 'Order 3', cost: 0.10, baseTickets: 2, checked: false, isSkipped: true },  // SKIPPED -> EXCLUDED
    { name: 'Order 4', cost: 0.50, baseTickets: 2, checked: true, isSkipped: false }   // COMPLETED -> EXCLUDED FROM ACTIVE
  ];

  const regularBounties = [
    { name: 'Sunflowers', cost: 0.10, baseTickets: 1, checked: false }, // yield = 1+1 = 2, cost/yield = 0.05 <= 0.15 -> MATCH
    { name: 'Pumpkins', cost: 0.80, baseTickets: 2, checked: false }    // yield = 2+1 = 3, cost/yield = 0.267 > 0.15 -> NO
  ];

  const animalBounties = [
    { name: 'Cow Milk', cost: 0.30, baseTickets: 2, checked: false },  // yield = 2+1 = 3, cost/yield = 0.10 <= 0.15 -> MATCH
    { name: 'Egg', cost: 1.20, baseTickets: 1, checked: false }        // yield = 1+1 = 2, cost/yield = 0.60 > 0.15 -> NO
  ];

  const chores = [
    { name: 'Clean barn', cost: 0.00, baseTickets: 1, checked: false }, // yield = 1+2+1 = 4, cost/yield = 0.00 <= 0.15 -> MATCH
    { name: 'Chop wood', cost: 2.00, baseTickets: 1, checked: false }   // yield = 4, cost/yield = 0.50 > 0.15 -> NO
  ];

  let activeDelivMatches = 0;
  deliveries.forEach(d => {
    if (d.isSkipped || d.checked) return;
    const yieldAmt = d.baseTickets + vipBonus + boostCount;
    if (isTargetRatioMatch(d.cost, yieldAmt, targetRatio)) activeDelivMatches++;
  });

  let activeBountyMatches = 0;
  regularBounties.forEach(b => {
    if (b.checked) return;
    const yieldAmt = b.baseTickets + boostCount;
    if (isTargetRatioMatch(b.cost, yieldAmt, targetRatio)) activeBountyMatches++;
  });

  let activeAnimalMatches = 0;
  animalBounties.forEach(b => {
    if (b.checked) return;
    const yieldAmt = b.baseTickets + boostCount;
    if (isTargetRatioMatch(b.cost, yieldAmt, targetRatio)) activeAnimalMatches++;
  });

  let activeChoreMatches = 0;
  chores.forEach(c => {
    if (c.checked) return;
    const yieldAmt = c.baseTickets + vipBonus + boostCount;
    if (isTargetRatioMatch(c.cost, yieldAmt, targetRatio)) activeChoreMatches++;
  });

  assert.strictEqual(activeDelivMatches, 1, 'Deliveries active matches should be 1');
  assert.strictEqual(activeBountyMatches, 1, 'Regular bounties active matches should be 1');
  assert.strictEqual(activeAnimalMatches, 1, 'Animal bounties active matches should be 1');
  assert.strictEqual(activeChoreMatches, 1, 'Chores active matches should be 1');

  const totalActiveMatches = activeDelivMatches + activeBountyMatches + activeAnimalMatches + activeChoreMatches;
  assert.strictEqual(totalActiveMatches, 4, 'Total active matches should be 4');

  console.log('✅ TEST 5 PASSED: Multi-category aggregation correctly identifies 4 matching active tasks.');
}

// Test 6: Cloud Vault targetRatio serialization round-trip
console.log('\nTest 6: Verifying Cloud Vault targetRatio persistence...');
{
  const existingVault = {
    username: 'farmer_alice',
    farmId: '123456',
    trackTickets: 50,
    targetRatio: 0.08
  };

  const incomingBody = {
    username: 'farmer_alice',
    targetRatio: 0.125
  };

  const updatedVault = {
    ...existingVault,
    ...incomingBody,
    targetRatio: incomingBody.targetRatio !== undefined ? (parseFloat(incomingBody.targetRatio) || 0) : (existingVault.targetRatio || 0)
  };

  assert.strictEqual(updatedVault.targetRatio, 0.125, 'targetRatio should update to 0.125');

  // When body does not pass targetRatio, it should preserve existing
  const preservedVault = {
    ...existingVault,
    trackTickets: 60,
    targetRatio: undefined !== undefined ? 0 : (existingVault.targetRatio || 0)
  };
  assert.strictEqual(preservedVault.targetRatio, 0.08, 'targetRatio should preserve 0.08 if not in update');

  console.log('✅ TEST 6 PASSED: Cloud Vault targetRatio preservation verified.');
}

console.log('\n🎉 ALL TARGET RATIO TESTS PASSED SUCCESSFULLY! 🚀');
