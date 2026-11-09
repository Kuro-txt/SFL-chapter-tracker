import assert from 'node:assert';

console.log('🧪 Starting Automated Tests for Delivery & Bounty Ticket-per-Flower Sorting...\n');

// Mock data items
const mockDeliveries = [
  { from: 'tywin', name: 'tywin', tickets: 10, itemsCost: 8.0, completed: false }, // 1.25 tix/flower
  { from: 'finn', name: 'finn', tickets: 5, itemsCost: 1.0, completed: false },    // 5.0 tix/flower
  { from: 'miranda', name: 'miranda', tickets: 2, itemsCost: 0.05, completed: false }, // 40.0 tix/flower
  { from: 'pete', name: 'pete', tickets: 1, itemsCost: 0.0, completed: false },    // Infinity tix/flower (FREE)
  { from: 'bert', name: 'bert', tickets: 4, itemsCost: 0.0, completed: false },    // Infinity tix/flower (FREE, 4 tix)
  { from: 'raven', name: 'raven', tickets: 6, itemsCost: 0.6, completed: true },   // 10.0 tix/flower (DONE)
  { from: 'timmy', name: 'timmy', tickets: 5, itemsCost: 0.1, completed: true }    // 50.0 tix/flower (DONE)
];

function computeRatioStats(item) {
  const tix = item.tickets || 0;
  const cost = item.itemsCost || 0;
  const tixPerFlower = cost <= 0 ? (tix > 0 ? Infinity : 0) : (tix / cost);
  const flowerPerTix = tix > 0 ? (cost / tix) : Infinity;
  return {
    ...item,
    done: Boolean(item.completed),
    finalTickets: tix,
    itemCost: cost,
    tixPerFlower,
    flowerPerTix
  };
}

function compareItems(a, b, sortMode = 'ticket_per_flower') {
  if (a.done !== b.done) {
    return a.done ? 1 : -1;
  }

  if (sortMode === 'ticket_per_flower') {
    if (a.tixPerFlower !== b.tixPerFlower) {
      return b.tixPerFlower - a.tixPerFlower;
    }
    if (a.tixPerFlower === Infinity && b.tixPerFlower === Infinity) {
      if (b.finalTickets !== a.finalTickets) return b.finalTickets - a.finalTickets;
    }
    if (a.itemCost !== b.itemCost) return a.itemCost - b.itemCost;
    if (b.finalTickets !== a.finalTickets) return b.finalTickets - a.finalTickets;
  } else if (sortMode === 'flower_per_ticket') {
    if (a.flowerPerTix !== b.flowerPerTix) {
      return a.flowerPerTix - b.flowerPerTix;
    }
    if (a.itemCost !== b.itemCost) return a.itemCost - b.itemCost;
    if (b.finalTickets !== a.finalTickets) return b.finalTickets - a.finalTickets;
  }

  return (a.name || '').localeCompare(b.name || '');
}

// TEST 1: Sorting Deliveries by Ticket per Flower
console.log('Test 1: Verifying Deliveries Sorting by Ticket per Flower...');
const processed = mockDeliveries.map(computeRatioStats);
processed.sort((a, b) => compareItems(a, b, 'ticket_per_flower'));

const activeNames = processed.filter(x => !x.done).map(x => x.name);
console.log('  Active deliveries sorted:', activeNames);

// bert (free, 4 tix) > pete (free, 1 tix) > miranda (40 tix/flower) > finn (5 tix/flower) > tywin (1.25 tix/flower)
assert.deepStrictEqual(
  activeNames,
  ['bert', 'pete', 'miranda', 'finn', 'tywin'],
  'Active deliveries must be ordered highest tickets-per-flower first with free items prioritizing highest yield'
);

const doneNames = processed.filter(x => x.done).map(x => x.name);
console.log('  Done deliveries sorted:', doneNames);
// timmy (50 tix/flower) > raven (10 tix/flower)
assert.deepStrictEqual(
  doneNames,
  ['timmy', 'raven'],
  'Completed deliveries must also be ordered highest tickets-per-flower first'
);

console.log('✅ TEST 1 PASSED: Delivery ticket-per-flower ranking verified.\n');

// TEST 2: Sorting Bounties by Ticket per Flower
console.log('Test 2: Verifying Bounties Sorting by Ticket per Flower...');
const mockBounties = [
  { name: 'Cauliflower Bounty', tickets: 3, itemsCost: 1.5, completed: false }, // 2.0 tix/flower
  { name: 'Apple Bounty', tickets: 8, itemsCost: 0.8, completed: false },       // 10.0 tix/flower
  { name: 'Eggplant Bounty', tickets: 4, itemsCost: 0.2, completed: false },    // 20.0 tix/flower
  { name: 'Free Bounty', tickets: 2, itemsCost: 0.0, completed: false }         // Infinity
];

const processedBounties = mockBounties.map(computeRatioStats);
processedBounties.sort((a, b) => compareItems(a, b, 'ticket_per_flower'));
const bountyNames = processedBounties.map(b => b.name);
console.log('  Bounties sorted:', bountyNames);

assert.deepStrictEqual(
  bountyNames,
  ['Free Bounty', 'Eggplant Bounty', 'Apple Bounty', 'Cauliflower Bounty'],
  'Bounties must be ordered from highest ticket-per-flower (best ratio) to lowest'
);

console.log('✅ TEST 2 PASSED: Bounty ticket-per-flower ranking verified.\n');

// TEST 3: Sorting by Flower per Ticket (Cheapest SFL / Ticket First)
console.log('Test 3: Verifying Alternative Flower per Ticket (Cheapest Ticket)...');
const flowerFirst = mockDeliveries.map(computeRatioStats);
flowerFirst.sort((a, b) => compareItems(a, b, 'flower_per_ticket'));
const flowerFirstActive = flowerFirst.filter(x => !x.done).map(x => x.name);
assert.deepStrictEqual(
  flowerFirstActive,
  ['bert', 'pete', 'miranda', 'finn', 'tywin'],
  'Flower per ticket and Ticket per flower must produce equivalent value-first ordering'
);
console.log('✅ TEST 3 PASSED: Flower per ticket ordering verified.\n');

console.log('🎉 ALL 3 TICKET PER FLOWER SORT TESTS PASSED WITH 100% SUCCESS!\n');
