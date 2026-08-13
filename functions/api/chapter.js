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
    const sflResponse = await fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { headers });
    if (!sflResponse.ok) {
      return new Response(JSON.stringify({ error: `SFL API error: ${sflResponse.status}` }), { status: sflResponse.status });
    }

    const payload = await sflResponse.json();
    const farm = payload.farm || {};

    // Check if player currently has active VIP
    const isVipActive = !!(farm.vip?.expiresAt && farm.vip.expiresAt > Date.now());

    // 1. FILTER & CALCULATE CHAPTER DELIVERIES
    const rawDeliveries = farm.delivery?.orders || [];
    const deliveryList = rawDeliveries.map(order => {
      const npcNameClean = (order.from || '').toLowerCase().trim();
      const baseTickets = CHAPTER_NPC_TICKETS[npcNameClean];

      let ticketCalculation = null;

      if (baseTickets !== undefined) {
        const A = baseTickets;
        const B = isVipActive ? 2 : 0;
        const basePlusVip = A + B;

        ticketCalculation = {
          isChapterNpc: true,
          baseA: A,
          vipB: B,
          basePlusVip: basePlusVip,
          oneBoost: basePlusVip + 1,
          twoBoosts: basePlusVip + 2,
          threeBoosts: basePlusVip + 3
        };
      }

      // Map "Shiny Feather" inside delivery rewards directly to "Tickets"
      const rewardsFormatted = {};
      if (order.reward?.items) {
        Object.entries(order.reward.items).forEach(([item, qty]) => {
          if (item === 'Shiny Feather') {
            rewardsFormatted['Tickets'] = qty;
          } else {
            rewardsFormatted[item] = qty;
          }
        });
      }

      return {
        id: order.id,
        from: order.from,
        items: order.items || {},
        rewardCoins: order.reward?.coins || 0,
        rewardSFL: order.reward?.sfl || 0,
        rewardItems: rewardsFormatted,
        ticketCalculation
      };
    });

    // 2. FILTER BOUNTIES
    const activeBounties = (farm.bounties?.requests || []).map(b => {
      const rewardsFormatted = {};
      if (b.items) {
        Object.entries(b.items).forEach(([item, qty]) => {
          if (item === 'Shiny Feather') {
            rewardsFormatted['Tickets'] = qty;
          } else {
            rewardsFormatted[item] = qty;
          }
        });
      }

      return {
        id: b.id,
        name: b.name,
        level: b.level || null,
        coins: b.coins || 0,
        rewards: rewardsFormatted
      };
    });

    // 3. FILTER CHORES
    const rawChores = farm.choreBoard?.chores || {};
    const choresList = Object.entries(rawChores).map(([npc, details]) => {
      const rewardsFormatted = {};
      if (details.reward?.items) {
        Object.entries(details.reward.items).forEach(([item, qty]) => {
          if (item === 'Shiny Feather') {
            rewardsFormatted['Tickets'] = qty;
          } else {
            rewardsFormatted[item] = qty;
          }
        });
      }

      return {
        npc: npc,
        task: details.name,
        reward: rewardsFormatted,
        progress: details.initialProgress || 0,
        completed: !!details.completedAt
      };
    });

    // 4. FILTER NPCs
    const rawNpcs = farm.npcs || {};
    const npcList = Object.entries(rawNpcs).map(([name, data]) => ({
      npc: name,
      friendshipPoints: data.friendship?.points || 0,
      deliveriesCompleted: data.deliveryCount || 0,
      deliveriesSkipped: data.skippedCount || 0,
      choresCompleted: data.choreCount || 0
    }));

    return new Response(JSON.stringify({
      farmId,
      isVipActive,
      deliveries: deliveryList,
      bounties: activeBounties,
      chores: choresList,
      npcs: npcList
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
