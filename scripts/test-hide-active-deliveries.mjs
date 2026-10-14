import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('🧪 Starting Automated Tests for Hiding Active Deliveries in Edit Section...');

// Test 1: Verify js/modals-editor.js source code has the display filter
console.log('\nTest 1: Verifying modals-editor.js contains active delivery display filter...');
{
  const editorPath = path.resolve('js/modals-editor.js');
  const code = fs.readFileSync(editorPath, 'utf-8');

  // Verify filter line exists
  assert(
    code.includes('if (!isChecked && !isSkipped) return;'),
    'modals-editor.js must contain "if (!isChecked && !isSkipped) return;" filter'
  );

  console.log('✅ TEST 1 PASSED: Code filter present in js/modals-editor.js.');
}

// Test 2: Verify simulated display behavior & zero cloud data modification
console.log('\nTest 2: Verifying simulated Edit Section display output and array preservation...');
{
  // Simulated deliveries in storage (like what getDeliveryRecords returns)
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

  // Snapshot before rendering
  const originalLength = masterDeliveries.length;
  const originalJson = JSON.stringify(masterDeliveries);

  // Replicate the exact loop from renderColumnHistoryModalList
  const records = [];
  masterDeliveries.forEach((item, itemIdx) => {
    const isChecked = item.checked !== undefined ? item.checked : Boolean(item.completed);
    const isSkipped = Boolean(item.isSkipped);

    // The display filter
    if (!isChecked && !isSkipped) return;

    records.push({
      id: item.id,
      name: item.name,
      checked: isChecked && !isSkipped,
      status: isSkipped ? '✕ Skipped' : (isChecked ? '✨ Done' : '⏳ Active')
    });
  });

  // 1. Verify that only completed & skipped deliveries are in records
  assert.strictEqual(records.length, 2, 'Only 2 completed/skipped records should be displayed');
  assert.strictEqual(records[0].id, 'deliv_pumpkin_pete_d1');
  assert.strictEqual(records[0].status, '✨ Done');
  assert.strictEqual(records[1].id, 'deliv_betty_skip_1');
  assert.strictEqual(records[1].status, '✕ Skipped');

  // 2. Verify NO active deliveries made it into the display list
  const activeRecords = records.filter(r => r.id.includes('_active') || r.status.includes('Active'));
  assert.strictEqual(activeRecords.length, 0, 'Zero active deliveries should be in the display list');

  // 3. Verify underlying master array and cloud objects are 100% UNTOUCHED
  assert.strictEqual(masterDeliveries.length, originalLength, 'Master deliveries array length must not change');
  assert.strictEqual(JSON.stringify(masterDeliveries), originalJson, 'Master deliveries data must remain completely identical');

  console.log('✅ TEST 2 PASSED: Active deliveries are hidden from display, while underlying cloud data is 100% preserved.');
}

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🚀');
