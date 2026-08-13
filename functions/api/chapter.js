// Base Chapter Ticket Table for Deliveries
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

  const browserHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  };

  const sflHeaders = { ...browserHeaders, 'Referer': 'https://sunflower-land.com/', 'Origin': 'https://sunflower-land.com' };
  if (apiKey.trim() !== '') sflHeaders['x-api-key'] = apiKey.trim();

  try {
    // Concurrent fetch: Farm Data + sfl.world API
    const [sflResponse, pricesResponse] = await Promise.all([
      fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { headers: sflHeaders }),
      fetch(`https://sfl.world/api/v1/prices`, { headers: browserHeaders }).catch(() => null)
    ]);

    if (!sflResponse.ok) {
      return new Response(JSON.stringify({ error: `SFL API error: ${sflResponse.status}` }), { status: sflResponse.status });
    }

    const payload = await sflResponse.json();
    const farm = payload.farm || {};

    let rawPricesData = null;
    if (pricesResponse && pricesResponse.ok) {
      rawPricesData = await pricesResponse.json().catch(() => null);
    }

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
        deliveryList.push({
          id: order.id,
          from: order.from,
          items: order.items || {},
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
        activeBounties.push({
          id: b.id,
          name: b.name,
          level: b.level || null,
          baseTickets: baseTicketCount
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
      rawPricesData,
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
