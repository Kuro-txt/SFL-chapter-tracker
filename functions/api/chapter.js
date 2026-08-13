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

async function processFarmData(farmId, apiKey, env) {
  const browserHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };

  const sflHeaders = { ...browserHeaders, 'Referer': 'https://sunflower-land.com/', 'Origin': 'https://sunflower-land.com' };
  if (apiKey && apiKey.trim() !== '') sflHeaders['x-api-key'] = apiKey.trim();

  const [sflResponse, pricesResponse] = await Promise.all([
    fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { headers: sflHeaders }).catch(e => ({ ok: false, status: 500, statusText: e.message })),
    fetch(`https://sfl.world/api/v1/prices`, { headers: browserHeaders }).catch(() => null)
  ]);

  if (!sflResponse || !sflResponse.ok) {
    const status = sflResponse?.status || 500;
    throw new Error(`SFL API returned status ${status}. Check Farm ID.`);
  }

  const payload = await sflResponse.json().catch(() => ({}));
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

    const directPrice = getDirectMarketPrice(clean, priceMap);
    if (directPrice > 0) return directPrice;

    const recipe = SFL_RECIPES[clean] || SFL_RECIPES[stripped];
    if (recipe) {
      let recipeTotal = 0;
      Object.entries(recipe).forEach(([ingName, ingQty]) => {
        recipeTotal += getItemUnitPrice(ingName, depth + 1) * ingQty;
      });
      return recipeTotal;
    }

    return 0;
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

      const isCompleted = typeof order.completedAt === 'number' || order.status === 'completed' || order.completed === true;

      deliveryList.push({
        id: order.id,
        from: order.from,
        items: order.items || {},
        itemsCost,
        itemDetails,
        baseTickets: baseTicketCount,
        isChapterNpc: baseTickets !== undefined,
        completed: isCompleted
      });
    }
  });

  // 2. BOUNTIES
  const activeBounties = [];
  const completedBountiesRaw = farm.bounties?.completed || farm.bounties?.claimed || [];
  let completedBountyIds = [];
  if (Array.isArray(completedBountiesRaw)) {
    completedBountyIds = completedBountiesRaw.map(b => typeof b === 'object' ? String(b.id) : String(b));
  }

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

      const isCompleted = typeof b.completedAt === 'number' || 
                          b.completed === true || 
                          b.status === 'completed' ||
                          completedBountyIds.includes(String(b.id));

      activeBounties.push({
        id: b.id,
        name: b.name,
        level: b.level || null,
        baseTickets: baseTicketCount,
        itemsCost: unitPrice,
        completed: isCompleted
      });
    }
  });

  // 3. CHORES
  const choreObj = farm.choreBoard?.chores || farm.chores || {};
  const choresList = Object.entries(choreObj).map(([key, details]) => {
    let baseTicketCount = 0;
    if (details.reward?.items) {
      Object.entries(details.reward.items).forEach(([item, qty]) => {
        if (item === 'Shiny Feather' || item === 'Tickets') {
          baseTicketCount += qty;
        }
      });
    }

    const currentProgress = details.initialProgress ?? details.progress ?? 0;
    const requirement = details.requirement ?? details.target ?? details.total ?? 0;

    const isCompleted = typeof details.completedAt === 'number' || 
                        details.completed === true || 
                        details.isCompleted === true ||
                        (requirement > 0 && currentProgress >= requirement);

    const npcName = details.npc || details.from || key;

    return {
      npc: npcName,
      task: details.name || details.description || key,
      baseTickets: baseTicketCount,
      progress: currentProgress,
      requirement: requirement,
      completed: isCompleted
    };
  });

  // Read History from Cloud KV if available
  let cloudHistory = { logs: [], cumulativeTickets: 0, cumulativeCost: 0 };
  if (env?.TRACKER_KV) {
    try {
      cloudHistory = await env.TRACKER_KV.get(`farm_${farmId}_history`, 'json') || cloudHistory;
    } catch (_) {}
  }

  return {
    farmId,
    isVipActive,
    pricesLoadedCount: Object.keys(priceMap).length,
    deliveries: deliveryList,
    bounties: activeBounties,
    chores: choresList,
    cloudHistory
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const farmId = url.searchParams.get('farmId') || '8472883706403914';
  const apiKey = env?.SFL_API_KEY || '';

  // POST: Manual save to KV
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      if (env?.TRACKER_KV) {
        const kvKey = `farm_${farmId}_history`;
        const existingData = await env.TRACKER_KV.get(kvKey, 'json') || { logs: [], cumulativeTickets: 0, cumulativeCost: 0 };

        const logEntry = {
          date: new Date().toISOString().split('T')[0],
          timestamp: new Date().toISOString(),
          ticketsSaved: body.ticketsSaved || 0,
          costSaved: body.costSaved || 0,
          deliveries: body.deliveries || [],
          bounties: body.bounties || [],
          chores: body.chores || []
        };

        existingData.logs.unshift(logEntry);
        existingData.cumulativeTickets += (body.ticketsSaved || 0);
        existingData.cumulativeCost += (body.costSaved || 0);

        await env.TRACKER_KV.put(kvKey, JSON.stringify(existingData));

        return new Response(JSON.stringify({ success: true, cloudData: existingData }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } else {
        return new Response(JSON.stringify({ error: 'TRACKER_KV binding not configured.' }), { status: 400 });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // GET: Fetch Farm Data
  try {
    const data = await processFarmData(farmId, apiKey, env);
    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
}
