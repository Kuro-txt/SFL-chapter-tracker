import assert from 'assert';
import {
  cleanVaultDeliveriesAndSnapshots,
  recomputeVaultCumulative,
  reconcileDeliveriesWithNpcs,
  slugifyNpc
} from '../api/chapter.js';

console.log('🧪 Starting Automated Tests for Vault Security Guard & Sanitizer...\n');

// Test 1: slugifyNpc produces clean, apostrophe-free slugs
console.log('Test 1: Verifying slugifyNpc...');
assert.strictEqual(slugifyNpc("pumpkin' pete"), 'pumpkin_pete');
assert.strictEqual(slugifyNpc('tyreless timmy'), 'tyreless_timmy');
assert.strictEqual(slugifyNpc(''), '');
console.log('✅ TEST 1 PASSED: slugifyNpc cleans names properly without quotes or spaces.\n');

// Test 2: Ghost delivery purge and counter regression detection
console.log('Test 2: Verifying Ghost Delivery Purge in cleanVaultDeliveriesAndSnapshots...');
const mockVault = {
  isVipActive: true,
  archiveDeliveries: [
    // Legitimate deliveries on Nov 19
    { id: 'deliv_tywin_d220', from: 'tywin', completedDate: '2026-11-19', completedAt: 1795050107075, completed: true, deliveryCountAtCreation: 220, cost: 13.208, baseTickets: 10 },
    { id: 'deliv_bert_d585', from: 'bert', completedDate: '2026-11-19', completedAt: 1795050110000, completed: true, deliveryCountAtCreation: 585, cost: 1.563, baseTickets: 2 },
    { id: 'deliv_bert_d586', from: 'bert', completedDate: '2026-11-19', completedAt: 1795050120000, completed: true, deliveryCountAtCreation: 586, cost: 1.897, baseTickets: 2 },
    // Ghost deliveries on Nov 19 (anomalously lower counter)
    { id: 'deliv_tywin_d36', from: 'tywin', completedDate: '2026-11-19', completedAt: 1795050108000, completed: true, deliveryCountAtCreation: 36, cost: 14.894, baseTickets: 10 },
    { id: 'deliv_bert_d420', from: 'bert', completedDate: '2026-11-19', completedAt: 1795050115000, completed: true, deliveryCountAtCreation: 420, cost: 1.899, baseTickets: 2 },
    // Nov 21 foreign bleed deliveries
    { id: 'deliv_bert_d173', from: 'bert', completedDate: '2026-11-21', completedAt: 1795255111000, completed: true, deliveryCountAtCreation: 173, cost: 1.049, baseTickets: 2 },
    { id: "deliv_pumpkin' pete_d808", from: "pumpkin' pete", completedDate: '2026-11-21', completedAt: 1795255039000, completed: true, deliveryCountAtCreation: 808, cost: 0.016, baseTickets: 1 },
    { id: 'deliv_pumpkin_pete_d808', from: "pumpkin' pete", completedDate: '2026-11-21', completedAt: 1795255039000, completed: true, deliveryCountAtCreation: 808, cost: 0.016, baseTickets: 1 }
  ],
  logs: [
    {
      date: '2026-11-19',
      deliveriesDone: [
        { name: 'tywin', cost: 13.208, yield: 24 },
        { name: 'bert', cost: 1.563, yield: 8 },
        { name: 'bert', cost: 1.897, yield: 4 },
        { name: 'tywin', cost: 14.894, yield: 12 },
        { name: 'bert', cost: 1.899, yield: 4 }
      ]
    }
  ]
};

const modified = cleanVaultDeliveriesAndSnapshots(mockVault);
assert.strictEqual(modified, true);

// Verify ghost IDs purged
const remainingIds = new Set(mockVault.archiveDeliveries.map(x => x.id));
assert.strictEqual(remainingIds.has('deliv_tywin_d36'), false, 'deliv_tywin_d36 should be purged');
assert.strictEqual(remainingIds.has('deliv_bert_d420'), false, 'deliv_bert_d420 should be purged');
assert.strictEqual(remainingIds.has('deliv_bert_d173'), false, 'deliv_bert_d173 should be purged');
// Verify deduplicated and canonicalized pumpkin pete
assert.strictEqual(remainingIds.has("deliv_pumpkin' pete_d808"), false, "Raw apostrophe ID should not exist");
assert.strictEqual(remainingIds.has('deliv_pumpkin_pete_d808'), true, 'Canonical deliv_pumpkin_pete_d808 should exist');
assert.strictEqual(mockVault.archiveDeliveries.filter(x => x.id === 'deliv_pumpkin_pete_d808').length, 1, 'Should be deduplicated to exactly 1');

// Verify Nov 19 Double Delivery Bonus restored
const tywin220 = mockVault.archiveDeliveries.find(x => x.id === 'deliv_tywin_d220');
assert.strictEqual(tywin220.hasDoubleBonus, true, 'Tywin d220 should have double bonus');

// Verify daily log updated
const log19 = mockVault.logs.find(l => l.date === '2026-11-19');
assert.strictEqual(log19.deliveriesDone.length, 3, 'Nov 19 log should have 3 deliveries (ghosts removed)');
console.log('✅ TEST 2 PASSED: Ghost delivery purge, deduplication, and log healing verified.\n');

// Test 3: Reconciler Counter Regression Guard
console.log('Test 3: Verifying Reconciler Counter Regression Guard...');
const reconcilerVault = {
  archiveDeliveries: [],
  npcSnapshots: {
    tywin: { deliveryCount: 220, skippedCount: 392, deliveryCompletedAt: 1795050107075 }
  }
};
// Foreign farm reports tywin count = 36
reconcileDeliveriesWithNpcs(reconcilerVault, [], {
  tywin: { deliveryCount: 36, skippedCount: 50, deliveryCompletedAt: 1795000000000 }
});
// Snapshot must NOT regress to 36
assert.strictEqual(reconcilerVault.npcSnapshots.tywin.deliveryCount, 220, 'Snapshot counter must never regress');
console.log('✅ TEST 3 PASSED: Counter regression guard prevents foreign farm counter contamination.\n');

console.log('🎉 ALL VAULT SECURITY GUARD & SANITIZER TESTS PASSED WITH 100% SUCCESS! 🚀');
