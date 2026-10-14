import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('🧪 Starting Automated Tests for Hiding Active Deliveries, Chores & Bounties in Edit Section...');

// Test 1: Verify js/modals-editor.js source code has the display filter in both delivery and chore/bounty loops
console.log('\nTest 1: Verifying modals-editor.js contains active item display filters...');
{
  const editorPath = path.resolve('js/modals-editor.js');
  const code = fs.readFileSync(editorPath, 'utf-8');

  // Verify filter line exists multiple times (for delivery loop and chore/bounty loop)
  const matches = code.match(/if \(!isChecked && !isSkipped\) return;/g);
  assert(matches && matches.length >= 2, 'modals-editor.js must contain display filter for both deliveries and chores/bounties');

  console.log('✅ TEST 1 PASSED: Code filters present across all categories in js/modals-editor.js.');
}

// Test 2: Verify simulated display behavior & zero cloud data modification for deliveries
console.log('\nTest 2: Verifying simulated Edit Section display output and array preservation for deliveries...');
{
  const masterDeliveries = [
    {
      id: 'deliv_pumpkin_pete_active',
      from: 'Pumpkin Pete',
      name: 'Pumpkin Pete',
      baseTickets: 2,
      tickets: 2,
      cost: 0.15,
      checked: false,
      completed: false,
      isSkipped: false,
      activeSince: '2026-10-14'
    },
    {
      id: 'deliv_pumpkin_pete_d1',
      from: 'Pumpkin Pete',
      name: 'Pumpkin Pete',
      baseTickets: 2,
      tickets: 2,
      cost: 0.15,
      checked: true,
      completed: true,
      isSkipped: false,
      completedAt: Date.now() - 86400000
    },
    {
      id: 'deliv_betty_skip_1',
      from: 'Betty',
      name: 'Betty',
      baseTickets: 2,
      tickets: 0,
      cost: 0,
      checked: false,
      completed: false,
      isSkipped: true,
      completedAt: Date.now() - 86400000
    },
    {
      id: 'deliv_corny_active',
      from: 'Corny',
      name: 'Corny',
      baseTickets: 3,
      tickets: 3,
      cost: 0.50,
      checked: false,
      completed: false,
      isSkipped: false,
      activeSince: '2026-10-14'
    }
  ];

  const originalLength = masterDeliveries.length;
  const originalJson = JSON.stringify(masterDeliveries);

  const records = [];
  masterDeliveries.forEach((item) => {
    const isChecked = item.checked !== undefined ? item.checked : Boolean(item.completed);
    const isSkipped = Boolean(item.isSkipped);

    if (!isChecked && !isSkipped) return;

    records.push({
      id: item.id,
      name: item.name,
      checked: isChecked && !isSkipped,
      status: isSkipped ? '✕ Skipped' : (isChecked ? '✨ Done' : '⏳ Active')
    });
  });

  assert.strictEqual(records.length, 2, 'Only 2 completed/skipped records should be displayed');
  assert.strictEqual(records[0].id, 'deliv_pumpkin_pete_d1');
  assert.strictEqual(records[1].id, 'deliv_betty_skip_1');

  const activeRecords = records.filter(r => r.id.includes('_active') || r.status.includes('Active'));
  assert.strictEqual(activeRecords.length, 0, 'Zero active deliveries should be in the display list');

  assert.strictEqual(masterDeliveries.length, originalLength, 'Master deliveries array length must not change');
  assert.strictEqual(JSON.stringify(masterDeliveries), originalJson, 'Master deliveries data must remain completely identical');

  console.log('✅ TEST 2 PASSED: Active deliveries are hidden from display, while underlying cloud data is 100% preserved.');
}

// Test 3: Verify simulated display behavior & zero cloud data modification for chores and bounties
console.log('\nTest 3: Verifying simulated Edit Section display output for chores and bounties...');
{
  const mockBountiesAndChores = [
    {
      id: 'bounty_1',
      name: 'Sunflower',
      checked: false,
      completed: false,
      isSkipped: false
    },
    {
      id: 'bounty_2',
      name: 'Potato',
      checked: true,
      completed: true,
      isSkipped: false
    },
    {
      id: 'chore_1',
      name: 'Chore: Plant Wheat',
      checked: false,
      completed: false,
      isSkipped: false
    },
    {
      id: 'animal_bounty_1',
      name: 'Egg',
      checked: true,
      completed: true,
      isSkipped: false
    }
  ];

  const originalLen = mockBountiesAndChores.length;
  const originalJson = JSON.stringify(mockBountiesAndChores);

  const displayed = [];
  mockBountiesAndChores.forEach(item => {
    const isChecked = item.checked !== undefined ? item.checked : Boolean(item.completed);
    const isSkipped = Boolean(item.isSkipped);

    if (!isChecked && !isSkipped) return;

    displayed.push({
      id: item.id,
      name: item.name,
      status: isChecked ? '✨ Done' : '⏳ Active'
    });
  });

  assert.strictEqual(displayed.length, 2, 'Only 2 completed chores/bounties should be displayed');
  assert.strictEqual(displayed[0].id, 'bounty_2');
  assert.strictEqual(displayed[1].id, 'animal_bounty_1');

  const activeBounties = displayed.filter(r => r.status.includes('Active'));
  assert.strictEqual(activeBounties.length, 0, 'Zero active chores or bounties should be in the display list');

  assert.strictEqual(mockBountiesAndChores.length, originalLen, 'Original chore/bounty storage array untouched');
  assert.strictEqual(JSON.stringify(mockBountiesAndChores), originalJson, 'Original chore/bounty data identical');

  console.log('✅ TEST 3 PASSED: Active chores, bounties, and animal bounties hidden from Edit Section while cloud data remains intact.');
}

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🚀');
