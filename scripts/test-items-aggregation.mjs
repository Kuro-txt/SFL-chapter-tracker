import { aggregateBurnedItems, detectItemCategory } from '../js/modals-items.js';
import { state } from '../js/state.js';

console.log('🧪 Starting Automated Tests for Chapter Items Burned Aggregator...');

// Mock data setup
state.globalData = {
  archiveDeliveries: [
    {
      id: 'deliv_pumpkin_pete_d1',
      from: 'pumpkin pete',
      checked: true,
      completed: true,
      isSkipped: false,
      itemDetails: [
        { name: 'Zucchini', qty: 15, unitPrice: 0.05, lineCost: 0.75 },
        { name: 'Potato', qty: 10, unitPrice: 0.01, lineCost: 0.10 }
      ]
    },
    {
      id: 'deliv_pumpkin_pete_d2',
      from: 'pumpkin pete',
      checked: true,
      completed: true,
      isSkipped: false,
      itemDetails: [
        { name: 'Zucchini', qty: 10, unitPrice: 0.05, lineCost: 0.50 },
        { name: 'Sunflower', qty: 50, unitPrice: 0.002, lineCost: 0.10 }
      ]
    },
    {
      id: 'deliv_blacksmith_active',
      from: 'blacksmith',
      checked: false,
      completed: false,
      isSkipped: false,
      itemDetails: [
        { name: 'Gold', qty: 5, unitPrice: 1.2, lineCost: 6.00 }
      ]
    },
    {
      id: 'deliv_skipped_order',
      from: 'corny',
      isSkipped: true,
      itemDetails: [
        { name: 'Corn', qty: 100, unitPrice: 0.05, lineCost: 5.00 }
      ]
    }
  ],
  bounties: [
    {
      id: 'bounty_soup',
      name: 'Pumpkin Soup',
      checked: true,
      completed: true,
      isSkipped: false,
      cost: 0.85
    },
    {
      id: 'bounty_active_egg',
      name: 'Egg',
      checked: false,
      completed: false,
      isSkipped: false,
      cost: 0.20
    }
  ],
  cloudHistory: {
    weeks: {
      '2026-09-28': {
        bounties: [
          {
            id: 'bounty_past_jam',
            name: 'Blueberry Jam',
            checked: true,
            completed: true,
            isSkipped: false,
            cost: 2.50
          }
        ]
      }
    }
  }
};

// Snapshot before execution for zero-mutation verification
const stateBefore = JSON.stringify(state.globalData);

// 1. Run Aggregation
const items = aggregateBurnedItems();

// 2. Zero-Mutation Verification
const stateAfter = JSON.stringify(state.globalData);
if (stateBefore === stateAfter) {
  console.log('✅ TEST 1 PASSED: Zero-Mutation Guarantee verified! State was completely unmutated.');
} else {
  console.error('❌ TEST 1 FAILED: State was mutated!');
  process.exit(1);
}

// 3. Mathematical Accuracy Tests
const zucchini = items.find(it => it.name.toLowerCase() === 'zucchini');
if (zucchini && zucchini.totalQty === 25 && zucchini.completedQty === 25 && Math.abs(zucchini.totalCost - 1.25) < 0.0001) {
  console.log(`✅ TEST 2 PASSED: Zucchini aggregated across deliveries: ${zucchini.totalQty}x for ${zucchini.totalCost} SFL.`);
} else {
  console.error('❌ TEST 2 FAILED: Zucchini aggregation mismatch:', zucchini);
  process.exit(1);
}

// Check Skipped Order Exclusion
const corn = items.find(it => it.name.toLowerCase() === 'corn');
if (!corn) {
  console.log('✅ TEST 3 PASSED: Skipped deliveries are cleanly excluded from burned items.');
} else {
  console.error('❌ TEST 3 FAILED: Skipped item was included in burned totals!');
  process.exit(1);
}

// Check Active Order
const gold = items.find(it => it.name.toLowerCase() === 'gold');
if (gold && gold.totalQty === 5 && gold.activeQty === 5 && gold.completedQty === 0 && gold.totalCost === 6.00) {
  console.log(`✅ TEST 4 PASSED: Active delivery correctly tracked: ${gold.activeQty}x pending (${gold.activeCost} SFL).`);
} else {
  console.error('❌ TEST 4 FAILED: Active delivery mismatch:', gold);
  process.exit(1);
}

// Check Bounties Inclusion
const soup = items.find(it => it.name.toLowerCase() === 'pumpkin soup');
const jam = items.find(it => it.name.toLowerCase() === 'blueberry jam');
if (soup && soup.completedQty === 1 && soup.bountyCount === 1 && soup.completedCost === 0.85 &&
    jam && jam.completedQty === 1 && jam.bountyCount === 1 && jam.completedCost === 2.50) {
  console.log('✅ TEST 5 PASSED: Current and past-week bounties correctly aggregated!');
} else {
  console.error('❌ TEST 5 FAILED: Bounty aggregation mismatch:', { soup, jam });
  process.exit(1);
}

// Check Category Detection
if (detectItemCategory('Zucchini') === 'crops' &&
    detectItemCategory('Pumpkin Soup') === 'food' &&
    detectItemCategory('Egg') === 'animals' &&
    detectItemCategory('Gold') === 'resources') {
  console.log('✅ TEST 6 PASSED: Category detection accurate (crops, food, animals, resources).');
} else {
  console.error('❌ TEST 6 FAILED: Category detection error');
  process.exit(1);
}

console.log('\n🎉 ALL 6 AUTOMATED TESTS PASSED WITH 100% SUCCESS!');
