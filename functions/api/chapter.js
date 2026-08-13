// Base Chapter Ticket Table
const CHAPTER_NPC_TICKETS = {
  "pumpkin' pete": 1,
  "bert": 2,
  "finley": 2,
  "raven": 4,
  "miranda": 2,
  "finn": 5,
  "pharaoh": 6,
  "cornwell": 3,
  "timmy": 5,
  "tywin": 10,
  "jester": 4
};

export async function onRequest(context) {
  const { searchParams } = new URL(context.request.url);
  const farmId = searchParams.get('farmId') || '8472883706403914';
  const apiKey = context.env.SFL_API_KEY || '';

  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'CloudflarePagesWorker/1.0',
    'Referer': 'https://sunflower-land.com/',
    'Origin': 'https://sunflower-land.com'
  };

  if (apiKey.trim() !== '') {
    headers['x-api-key'] = apiKey.trim();
  }

  try {
    // Concurrent fetch: SFL Farm Data + SFL World Market Prices
    const [sflResponse, pricesResponse] = await Promise.all([
      fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { headers }),
      fetch(`https://sfl.world/api/v1/prices`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'CloudflarePagesWorker/1.0' }
      }).catch(() => null)
    ]);

    if (!sflResponse.ok) {
      return new Response(JSON.stringify({ error: `SFL API error: ${sflResponse.status}` }), { status: sflResponse.status });
    }

    const payload = await sflResponse.json();
    const farm = payload.farm || {};

    // Build lowercase price map for exact key matching
    let priceMap = {};
    if (pricesResponse && pricesResponse.ok) {
      const rawPrices = await pricesResponse.json().catch(() => ({}));
      Object.entries(rawPrices).forEach(([key, val]) => {
        if (val && typeof val.price === 'number') {
          priceMap[key.toLowerCase().trim()] = val.price;
        } else if (typeof val === 'number') {
          priceMap[key.toLowerCase().trim()] = val;
        }
      });
    }

    // Helper to calculate total SFL cost for items
    const calculateItemsCost = (items) => {
      let totalCost = 0;
      const details = [];

      Object.entries(items).forEach(([itemName, qty]) => {
        const cleanName = itemName.toLowerCase().trim();
        const unitPrice = priceMap[cleanName] || 0;
        const itemTotal = unitPrice * qty;
        totalCost += itemTotal;

        details.push({
          name: itemName,
          qty,
          unitPrice,
          totalPrice: itemTotal
        });
      });

      return { totalCost, details };
    };

    const isVipActive = !!(farm.vip?.expiresAt && farm.vip.expiresAt > Date.now());

    // 1. DELIVERIES
    const rawDeliveries = farm.delivery?.orders || [];
    const deliveryList = [];

    rawDeliveries.forEach(order => {
      const npcNameClean = (order.from || '').toLowerCase().trim();
      const baseTickets = CHAPTER_NPC_TICKETS[npcNameClean];

      let baseTicketCount = baseTickets !== undefined ? baseTickets : 0;

      if (order.reward?.items) {
        Object.entries(order.reward.items).forEach(([item, qty]) => {
          if (item === 'Shiny Feather' || item === 'Tickets') {
            baseTicketCount += qty;
          }
        });
      }

      if (baseTicketCount > 0) {
        const costData = calculateItemsCost(order.items || {});

        deliveryList.push({
          id: order.id,
          from: order.from,
          items: order.items || {},
          itemsCost: costData.totalCost,
          itemDetails: costData.details,
          baseTickets: baseTicketCount,
          isChapterNpc: baseTickets !== undefined
        });
      }
    });

    // 2. BOUNTIES
    const activeBounties = [];
    (farm.bounties?.requests || []).forEach(b => {
      let baseTicketCount = 0;
      if (b.items) {
        Object.entries(b.items).forEach(([item, qty]) => {
          if (item === 'Shiny Feather' || item === 'Tickets') {
            baseTicketCount += qty;
          }
        });
      }

      if (baseTicketCount > 0) {
        const targetItems = b.name ? { [b.name]: 1 } : {};
        const costData = calculateItemsCost(targetItems);

        activeBounties.push({
          id: b.id,
          name: b.name,
          level: b.level || null,
          baseTickets: baseTicketCount,
          itemsCost: costData.totalCost
        });
      }
    });

    // 3. CHORES
    const rawChores = farm.choreBoard?.chores || {};
    const choresList = Object.entries(rawChores).map(([npc, details]) => {
      let baseTicketCount = 0;
      if (details.reward?.items) {
        Object.entries(details.reward.items).forEach(([item, qty]) => {
          if (item === 'Shiny Feather' || item === 'Tickets') {
            baseTicketCount += qty;
          }
        });
      }

      return {
        npc: npc,
        task: details.name,
        baseTickets: baseTicketCount,
        progress: details.initialProgress || 0,
        completed: !!details.completedAt
      };
    });

    return new Response(JSON.stringify({
      farmId,
      isVipActive,
      deliveries: deliveryList,
      bounties: activeBounties,
      chores: choresList
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
