import { SFL_RECIPES } from '../../recipes.js';

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

async function hashPassword(password) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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
  if (clean === 'coins' || clean === 'coin') return 0.001;

  const variations = [
    clean, stripped, clean.replace(/\s+/g, '-'), clean.replace(/\s+/g, '_'),
    clean + 's', clean + 'es',
    clean.endsWith('s') ? clean.slice(0, -1) : clean,
    clean.endsWith('es') ? clean.slice(0, -2) : clean,
    clean.endsWith('ies') ? clean.slice(0, -3) + 'y' : clean,
    stripped + 's', stripped.endsWith('s') ? stripped.slice(0, -1) : stripped
  ];

  for (const v of variations) {
    if (priceMap[v] !== undefined && priceMap[v] > 0) return priceMap[v];
  }
  return 0;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const farmId = url.searchParams.get('farmId') || '8472883706403914';
  const apiKey = url.searchParams.get('apiKey') || env?.SFL_API_KEY || '';

  // 1. REGISTER ACCOUNT
  if (request.method === 'POST' && action === 'register') {
    try {
      const body = await request.json().catch(() => ({}));
      const username = (body.username || '').toLowerCase().trim();
      const password = body.password || '';

      if (!username || !password) return new Response(JSON.stringify({ error: 'Username and password required.' }), { status: 400 });

      if (env && env.TRACKER_KV) {
        const userKey = `user_${username}_auth`;
        const existing = await env.TRACKER_KV.get(userKey);
        if (existing) return new Response(JSON.stringify({ error: 'Username already taken.' }), { status: 400 });

        const passwordHash = await hashPassword(password);
        await env.TRACKER_KV.put(userKey, JSON.stringify({ username, passwordHash, createdAt: new Date().toISOString() }));
        
        // Initialize single master vault pair for this user
        const vaultKey = `user_${username}_vault`;
        await env.TRACKER_KV.put(vaultKey, JSON.stringify({ logs: [], cumulativeTickets: 0, cumulativeCost: 0, deliveries: [], bounties: [], chores: [] }));

        return new Response(JSON.stringify({ success: true, username }), {
          status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      return new Response(JSON.stringify({ error: 'KV Database missing.' }), { status: 500 });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  // 2. LOGIN ACCOUNT
  if (request.method === 'POST' && action === 'login') {
    try {
      const body = await request.json().catch(() => ({}));
      const username = (body.username || '').toLowerCase().trim();
      const password = body.password || '';

      if (!username || !password) return new Response(JSON.stringify({ error: 'Username and password required.' }), { status: 400 });

      if (env && env.TRACKER_KV) {
        const userKey = `user_${username}_auth`;
        const userDataStr = await env.TRACKER_KV.get(userKey);
        if (!userDataStr) return new Response(JSON.stringify({ error: 'Account not found.' }), { status: 401 });

        const userData = JSON.parse(userDataStr);
        const inputHash = await hashPassword(password);
        if (userData.passwordHash !== inputHash) return new Response(JSON.stringify({ error: 'Incorrect password.' }), { status: 401 });

        // Retrieve the single master KV pair
        const vaultKey = `user_${username}_vault`;
        let vaultData = await env.TRACKER_KV.get(vaultKey, 'json') || { logs: [], cumulativeTickets: 0, cumulativeCost: 0 };

        return new Response(JSON.stringify({ success: true, username, vaultData }), {
          status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      return new Response(JSON.stringify({ error: 'KV Database missing.' }), { status: 500 });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  // 3. SAVE TO SINGLE MASTER VAULT PAIR (POST)
  if (request.method === 'POST' && action === 'saveVault') {
    try {
      const body = await request.json().catch(() => ({}));
      const username = (body.username || '').toLowerCase().trim();
      if (!username) return new Response(JSON.stringify({ error: 'Not logged in.' }), { status: 401 });

      if (env && env.TRACKER_KV) {
        const vaultKey = `user_${username}_vault`;
        let existingData = await env.TRACKER_KV.get(vaultKey, 'json') || { logs: [], cumulativeTickets: 0, cumulativeCost: 0 };

        const todayDate = new Date().toISOString().split('T')[0];
        const completedDeliveries = (body.deliveries || []).filter(d => d.completed).map(d => ({
          name: d.from, cost: d.itemsCost || 0, tickets: d.baseTickets || 0
        }));
        const completedBounties = (body.bounties || []).filter(b => b.completed).map(b => ({
          name: b.name, cost: b.itemsCost || 0, tickets: b.baseTickets || 0
        }));
        const completedChores = (body.chores || []).filter(c => c.completed).map(c => ({
          name: c.task, npc: c.npc
        }));

        const newTickets = body.ticketsSaved || 0;
        const newCost = body.costSaved || 0;

        const existingTodayLogIndex = existingData.logs.findIndex(l => l.date === todayDate);
        if (existingTodayLogIndex !== -1) {
          const oldLog = existingData.logs[existingTodayLogIndex];
          existingData.cumulativeTickets -= (oldLog.ticketsSaved || 0);
          existingData.cumulativeCost -= (oldLog.costSaved || 0);

          existingData.logs[existingTodayLogIndex] = {
            date: todayDate, timestamp: new Date().toISOString(),
            ticketsSaved: newTickets, costSaved: newCost,
            deliveriesDone: completedDeliveries, bountiesDone: completedBounties, choresDone: completedChores
          };
        } else {
          existingData.logs.unshift({
            date: todayDate, timestamp: new Date().toISOString(),
            ticketsSaved: newTickets, costSaved: newCost,
            deliveriesDone: completedDeliveries, bountiesDone: completedBounties, choresDone: completedChores
          });
        }

        existingData.cumulativeTickets += newTickets;
        existingData.cumulativeCost += newCost;

        // Save complete list state into the single KV pair
        existingData.deliveries = body.deliveries || [];
        existingData.bounties = body.bounties || [];
        existingData.chores = body.chores || [];

        await env.TRACKER_KV.put(vaultKey, JSON.stringify(existingData));

        return new Response(JSON.stringify({ success: true, vaultData: existingData }), {
          status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  // 4. GET LIVE FARM DATA
  try {
    const sflHeaders = {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://sunflower-land.com/',
      'Origin': 'https://sunflower-land.com'
    };

    if (apiKey && apiKey.trim() !== '') sflHeaders['x-api-key'] = apiKey.trim();

    const [sflResponse, pricesResponse] = await Promise.all([
      fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { headers: sflHeaders }).catch(() => ({ ok: false, status: 500 })),
      fetch(`https://sfl.world/api/v1/prices`, { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(() => null)
    ]);

    if (!sflResponse || !sflResponse.ok) {
      const status = sflResponse?.status || 500;
      if (status === 401) throw new Error('SFL API returned 401 Unauthorized.');
      throw new Error(`SFL API error (${status}). Check Farm ID.`);
    }

    const payload = await sflResponse.json().catch(() => ({}));
    const farm = payload.farm || {};

    let priceMap = {};
    if (pricesResponse && pricesResponse.ok) {
      const rawPricesData = await pricesResponse.json().catch(() => null);
      if (rawPricesData) priceMap = extractPricesRecursive(rawPricesData);
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

    const rawDeliveries = farm.delivery?.orders || [];
    const deliveryList = [];
    rawDeliveries.forEach(order => {
      const npcNameClean = (order.from || '').toLowerCase().trim();
      const baseTickets = CHAPTER_NPC_TICKETS[npcNameClean];
      let baseTicketCount = baseTickets !== undefined ? baseTickets : 0;

      if (order.reward?.items) {
        Object.entries(order.reward.items).forEach(([item, qty]) => {
          if (item === 'Shiny Feather' || item === 'Tickets') baseTicketCount += qty;
        });
      }

      if (baseTicketCount > 0) {
        let itemsCost = 0;
        const itemDetails = [];
        Object.entries(order.items || {}).forEach(([itemName, qty]) => {
          const unitPrice = getItemUnitPrice(itemName);
          const lineCost = unitPrice * qty;
          itemsCost += lineCost;
          itemDetails.push({ name: itemName, qty, unitPrice, lineCost, isRecipe: !getDirectMarketPrice(itemName, priceMap) && !!SFL_RECIPES[itemName.toLowerCase().trim()] });
        });

        const isCompleted = typeof order.completedAt === 'number' || order.status === 'completed' || order.completed === true;
        deliveryList.push({ id: order.id, from: order.from, items: order.items || {}, itemsCost, itemDetails, baseTickets: baseTicketCount, isChapterNpc: baseTickets !== undefined, completed: isCompleted });
      }
    });

    const activeBounties = [];
    const completedBountiesRaw = farm.bounties?.completed || farm.bounties?.claimed || [];
    let completedBountyIds = Array.isArray(completedBountiesRaw) ? completedBountiesRaw.map(b => typeof b === 'object' ? String(b.id) : String(b)) : [];

    (farm.bounties?.requests || []).forEach(b => {
      let baseTicketCount = 0;
      if (b.items) {
        Object.entries(b.items).forEach(([item, qty]) => {
          if (item === 'Shiny Feather' || item === 'Tickets') baseTicketCount += qty;
        });
      }
      if (baseTicketCount > 0) {
        const unitPrice = b.name ? getItemUnitPrice(b.name) : 0;
        const isCompleted = typeof b.completedAt === 'number' || b.completed === true || b.status === 'completed' || completedBountyIds.includes(String(b.id));
        activeBounties.push({ id: b.id, name: b.name, level: b.level || null, baseTickets: baseTicketCount, itemsCost: unitPrice, completed: isCompleted });
      }
    });

    const choreObj = farm.choreBoard?.chores || farm.chores || {};
    const choresList = Object.entries(choreObj).map(([key, details]) => {
      let baseTicketCount = 0;
      if (details.reward?.items) {
        Object.entries(details.reward.items).forEach(([item, qty]) => {
          if (item === 'Shiny Feather' || item === 'Tickets') baseTicketCount += qty;
        });
      }
      const currentProgress = details.initialProgress ?? details.progress ?? 0;
      const requirement = details.requirement ?? details.target ?? details.total ?? 0;
      const isCompleted = typeof details.completedAt === 'number' || details.completed === true || details.isCompleted === true || (requirement > 0 && currentProgress >= requirement);
      return { npc: details.npc || details.from || key, task: details.name || details.description || key, baseTickets: baseTicketCount, progress: currentProgress, requirement, completed: isCompleted };
    });

    return new Response(JSON.stringify({
      farmId, isVipActive,
      pricesLoadedCount: Object.keys(priceMap).length,
      deliveries: deliveryList, bounties: activeBounties, chores: choresList
    }, null, 2), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }, null, 2), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
