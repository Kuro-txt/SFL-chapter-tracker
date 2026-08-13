import { SFL_RECIPES } from '../../recipes.js';

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

function extractPricesRecursive(obj, map = {}) {
  if (!obj || typeof obj !== 'object') return map;
  if (Array.isArray(obj)) {
    obj.forEach(item => extractPricesRecursive(item, map));
    return map;
  }

  for (const [key, val] of Object.entries(obj)) {
    const cleanKey = key.toLowerCase().trim();
    const strippedKey = cleanKey.replace(/[^a-z0-9]/g, '');

    if (typeof val === 'number') {
      map[cleanKey] = val;
      map[strippedKey] = val;
    } else if (val && typeof val === 'object') {
      const priceVal = val.price ?? val.sfl ?? val.buy ?? val.cost ?? val.value ?? val.unitPrice;
      if (typeof priceVal === 'number') {
        map[cleanKey] = priceVal;
        map[strippedKey] = priceVal;
      }
      if (val.name && typeof val.name === 'string') {
        const itemClean = val.name.toLowerCase().trim();
        const itemStripped = itemClean.replace(/[^a-z0-9]/g, '');
        if (typeof priceVal === 'number') {
          map[itemClean] = priceVal;
          map[itemStripped] = priceVal;
        }
      }
      extractPricesRecursive(val, map);
    }
  }
  return map;
}

function getDirectMarketPrice(name, priceMap) {
  if (!name || !priceMap) return 0;

  const clean = name.toLowerCase().trim();
  const stripped = clean.replace(/[^a-z0-9]/g, '');

  if (clean === 'coins' || clean === 'coin') {
    return 0.001; // 1,000 Coins = 1 SFL
  }

  const variations = [
    clean,
    stripped,
    clean.replace(/\s+/g, '-'),
    clean.replace(/\s+/g, '_'),
    clean + 's',
    clean + 'es',
    clean.endsWith('s') ? clean.slice(0, -1) : clean,
    clean.endsWith('es') ? clean.slice(0, -2) : clean,
    clean.endsWith('ies') ? clean.slice(0, -3) + 'y' : clean,
    stripped + 's',
    stripped.endsWith('s') ? stripped.slice(0, -1) : stripped
  ];

  for (const v of variations) {
    if (priceMap[v] !== undefined && priceMap[v] > 0) {
      return priceMap[v];
    }
  }

  return 0;
}

export async function onRequest(context) {
  const { searchParams } = new URL(context.request.url);
  const farmId = searchParams.get('farmId') || '8472883706403914';
  const apiKey = context.env?.SFL_API_KEY || '';

  const browserHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  };

  const sflHeaders = { ...browserHeaders, 'Referer': 'https://sunflower-land.com/', 'Origin': 'https://sunflower-land.com' };
  if (apiKey.trim() !== '') sflHeaders['x-api-key'] = apiKey.trim();

  try {
    const [sflResponse, pricesResponse] = await Promise.all([
      fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { headers: sflHeaders }),
      fetch(`https://sfl.world/api/v1/prices`, { headers: browserHeaders }).catch(() => null)
    ]);

    if (!sflResponse.ok) {
      return new Response(JSON.stringify({ error: `SFL API error: ${sflResponse.status}` }), { status: sflResponse.status });
    }

    const payload = await sflResponse.json();
    const farm = payload.farm || {};

    let priceMap = {};
    if (pricesResponse && pricesResponse.ok) {
      const rawPricesData = await pricesResponse.json().catch(() => null);
      if (rawPricesData) {
        priceMap = extractPricesRecursive(rawPricesData);
      }
    }

    const getItemUnitPrice = (itemName, depth = 0) => {
      if (depth > 5 || !itemName) return 0;

      const clean = itemName.toLowerCase().trim();
      const stripped = clean.replace(/[^a-z0-9]/g, '');

      // 1. Direct Market Price
      const directPrice = getDirectMarketPrice(clean, priceMap);
      if (directPrice > 0) {
        return directPrice;
      }

      // 2. Recipe Ingredient Calculation
      const recipe = SFL_RECIPES[clean] || SFL_RECIPES[stripped];
      if (recipe) {
        let recipeTotal = 0;
        Object.entries(recipe).forEach(([ingName, ingQty]) => {
          const ingPrice = getItemUnitPrice(ingName, depth + 1);
          recipeTotal += ingPrice * ingQty;
        });
        return recipeTotal;
      }

      return 0;
    };

    const isVipActive = !!(farm.vip?.expiresAt && farm.vip.expiresAt > Date.now());

    // DELIVERIES
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
        let itemsCost = 0;
        const itemDetails = [];

        Object.entries(order.items || {}).forEach(([itemName, qty]) => {
          const unitPrice = getItemUnitPrice(itemName);
          const lineCost = unitPrice * qty;
          itemsCost += lineCost;

          itemDetails.push({
            name: itemName,
            qty,
            unitPrice,
            lineCost,
            isRecipe: !getDirectMarketPrice(itemName, priceMap) && !!SFL_RECIPES[itemName.toLowerCase().trim()]
          });
        });

        deliveryList.push({
          id: order.id,
          from: order.from,
          items: order.items || {},
          itemsCost,
          itemDetails,
          baseTickets: baseTicketCount,
          isChapterNpc: baseTickets !== undefined
        });
      }
    });

    // BOUNTIES
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
        const unitPrice = b.name ? getItemUnitPrice(b.name) : 0;

        activeBounties.push({
          id: b.id,
          name: b.name,
          level: b.level || null,
          baseTickets: baseTicketCount,
          itemsCost: unitPrice
        });
      }
    });

    // CHORES
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
      pricesLoadedCount: Object.keys(priceMap).length,
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
