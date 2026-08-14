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

  let searchNames = [
    clean, stripped, clean.replace(/\s+/g, '-'), clean.replace(/\s+/g, '_'),
    clean + 's', clean + 'es',
    clean.endsWith('s') ? clean.slice(0, -1) : clean,
    clean.endsWith('es') ? clean.slice(0, -2) : clean,
    clean.endsWith('ies') ? clean.slice(0, -3) + 'y' : clean
  ];

  if (clean.endsWith(' a') || clean.endsWith(' b')) {
    const baseName = clean.slice(0, -2).trim();
    searchNames.push(baseName, baseName + ' a', baseName + ' b');
  }

  let lowestPrice = 0;
  for (const v of searchNames) {
    if (priceMap[v] !== undefined && priceMap[v] > 0) {
      if (lowestPrice === 0 || priceMap[v] < lowestPrice) {
        lowestPrice = priceMap[v];
      }
    }
  }
  return lowestPrice;
}

function getMondayBasedWeekId(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Helper to extract tickets from any reward structure
function extractRewardTickets(rewardObj) {
  if (!rewardObj) return 0;
  let count = 0;
  
  const items = rewardObj.items || rewardObj;
  if (typeof items === 'object') {
    for (const [key, qty] of Object.entries(items)) {
      const lower = key.toLowerCase();
      if (
        lower.includes('ticket') || 
        lower.includes('feather') || 
        lower.includes('scale') || 
        lower.includes('scroll') ||
        lower.includes('token')
      ) {
        count += (typeof qty === 'number' ? qty : parseInt(qty) || 0);
      }
    }
  }
  return count;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const farmId = url.searchParams.get('farmId') || '8472883706403914';
  const apiKey = url.searchParams.get('apiKey') || env?.SFL_API_KEY || '';

  const getItemUnitPrice = (itemName, priceMap, depth = 0) => {
    if (depth > 5 || !itemName) return 0;
    const clean = itemName.toLowerCase().trim();
    const stripped = clean.replace(/[^a-z0-9]/g, '');
    const directPrice = getDirectMarketPrice(clean, priceMap);
    if (directPrice > 0) return directPrice;

    const recipe = SFL_RECIPES[clean] || SFL_RECIPES[stripped];
    if (recipe) {
      let recipeTotal = 0;
      Object.entries(recipe).forEach(([ingName, ingQty]) => {
        recipeTotal += getItemUnitPrice(ingName, priceMap, depth + 1) * ingQty;
      });
      return recipeTotal;
    }
    return 0;
  };

  // Secure External Cron Ping Endpoint
  if (action === 'cronBackup') {
    const secretKey = url.searchParams.get('key');
    const expectedKey = env?.CRON_SECRET || 'kuro123';
    if (secretKey !== expectedKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized cron key.' }), {
        status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    let backedUpCount = 0;
    const backupTimestamp = new Date().toISOString();
    const todayDate = backupTimestamp.split('T')[0];
    const currentWeekId = getMondayBasedWeekId();

    let priceMap = {};
    try {
      const pricesRes = await fetch(`https://sfl.world/api/v1/prices`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (pricesRes.ok) {
        const rawData = await pricesRes.json();
        if (rawData) priceMap = extractPricesRecursive(rawData);
      }
    } catch (e) {}

    if (env && env.TRACKER_KV) {
      const list = await env.TRACKER_KV.list({ prefix: "user_" });
      for (const keyObj of list.keys) {
        if (keyObj.name.endsWith("_vault")) {
          let vaultData = await env.TRACKER_KV.get(keyObj.name, "json");
          if (vaultData) {
            if (!vaultData.logs) vaultData.logs = [];
            if (!vaultData.weeks) vaultData.weeks = {};

            if (vaultData.bounties || vaultData.chores) {
              const currentWeekBounties = (vaultData.bounties || []).map(b => {
                let bCost = b.cost !== undefined ? b.cost : (b.itemsCost || 0);
                if (!bCost && b.name) bCost = getItemUnitPrice(b.name, priceMap);
                return {
                  name: b.name || 'Bounty',
                  cost: bCost,
                  tickets: b.tickets !== undefined ? b.tickets : (b.baseTickets || 1),
                  completed: b.completed || b.checked,
                  checked: b.completed || b.checked
                };
              });

              const currentWeekChores = (vaultData.chores || []).map(c => ({
                name: c.name || c.task || 'Chore',
                npc: c.npc || 'NPC',
                tickets: c.tickets !== undefined ? c.tickets : (c.baseTickets || 1),
                completed: c.completed || c.checked,
                checked: c.completed || c.checked
              }));

              vaultData.weeks[currentWeekId] = {
                weekId: currentWeekId,
                bounties: currentWeekBounties,
                chores: currentWeekChores
              };
            }

            let dailyDeliveryTickets = 0;
            let dailyDeliveryCost = 0;

            const formattedDeliveries = (vaultData.deliveries || []).map(d => {
              const dCost = d.cost !== undefined ? d.cost : (d.itemsCost || 0);
              const dTix = d.tickets !== undefined ? d.tickets : (d.baseTickets || 2);
              const isDone = d.completed || d.checked;
              if (isDone) {
                dailyDeliveryTickets += dTix;
                dailyDeliveryCost += dCost;
              }
              return {
                name: d.name || d.from || 'NPC',
                cost: dCost,
                tickets: dTix,
                completed: isDone,
                items: d.items || d.itemDetails || [],
                checked: isDone
              };
            });

            const existingTodayLogIndex = vaultData.logs.findIndex(l => l.date === todayDate);
            if (existingTodayLogIndex !== -1) {
              vaultData.logs[existingTodayLogIndex].ticketsSaved = dailyDeliveryTickets;
              vaultData.logs[existingTodayLogIndex].costSaved = dailyDeliveryCost;
              vaultData.logs[existingTodayLogIndex].timestamp = backupTimestamp;
              vaultData.logs[existingTodayLogIndex].deliveriesDone = formattedDeliveries;
            } else {
              vaultData.logs.unshift({
                date: todayDate,
                weekId: currentWeekId,
                timestamp: backupTimestamp,
                ticketsSaved: dailyDeliveryTickets,
                costSaved: dailyDeliveryCost,
                autoBackup: true,
                deliveriesDone: formattedDeliveries
              });
            }

            let totalTix = 0;
            let totalCost = 0;

            vaultData.logs.forEach(l => {
              totalTix += (l.ticketsSaved || 0);
              totalCost += (l.costSaved || 0);
            });

            Object.values(vaultData.weeks).forEach(wk => {
              (wk.bounties || []).forEach(b => {
                if (b.completed || b.checked) {
                  totalTix += (b.tickets || 1);
                  totalCost += (b.cost || 0);
                }
              });
              (wk.chores || []).forEach(c => {
                if (c.completed || c.checked) {
                  totalTix += (c.tickets || 1);
                }
              });
            });

            vaultData.cumulativeTickets = totalTix;
            vaultData.cumulativeCost = totalCost;

            await env.TRACKER_KV.put(keyObj.name, JSON.stringify(vaultData));
            backedUpCount++;
          }
        }
      }
      await env.TRACKER_KV.put(`system_last_cron_backup`, JSON.stringify({ timestamp: backupTimestamp, vaultsProcessed: backedUpCount }));
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Active KV Backup executed successfully at ${backupTimestamp}. Synced ${backedUpCount} user vaults.` 
    }), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  if (action === 'getVault') {
    const username = (url.searchParams.get('username') || '').toLowerCase().trim();
    if (env && env.TRACKER_KV && username) {
      const vaultKey = `user_${username}_vault`;
      let vaultData = await env.TRACKER_KV.get(vaultKey, 'json') || { logs: [], cumulativeTickets: 0, cumulativeCost: 0, weeks: {}, deliveries: [], bounties: [], chores: [] };
      return new Response(JSON.stringify({ success: true, vaultData }), {
        status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    return new Response(JSON.stringify({ vaultData: null }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

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
        
        const vaultKey = `user_${username}_vault`;
        await env.TRACKER_KV.put(vaultKey, JSON.stringify({ logs: [], cumulativeTickets: 0, cumulativeCost: 0, weeks: {}, deliveries: [], bounties: [], chores: [] }));

        return new Response(JSON.stringify({ success: true, username }), {
          status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      return new Response(JSON.stringify({ error: 'KV Database missing.' }), { status: 500 });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

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

        const vaultKey = `user_${username}_vault`;
        let vaultData = await env.TRACKER_KV.get(vaultKey, 'json') || { logs: [], cumulativeTickets: 0, cumulativeCost: 0, weeks: {} };

        return new Response(JSON.stringify({ success: true, username, vaultData }), {
          status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      return new Response(JSON.stringify({ error: 'KV Database missing.' }), { status: 500 });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  if (request.method === 'POST' && action === 'saveVault') {
    try {
      const body = await request.json().catch(() => ({}));
      const username = (body.username || '').toLowerCase().trim();
      if (!username) return new Response(JSON.stringify({ error: 'Not logged in.' }), { status: 401 });

      if (env && env.TRACKER_KV) {
        const vaultKey = `user_${username}_vault`;
        let existingData = await env.TRACKER_KV.get(vaultKey, 'json') || { logs: [], cumulativeTickets: 0, cumulativeCost: 0, weeks: {} };

        const todayDate = new Date().toISOString().split('T')[0];
        const currentWeekId = getMondayBasedWeekId();

        if (!existingData.weeks) existingData.weeks = {};

        const incomingBounties = (body.bounties || []).map(b => ({
          weekId: currentWeekId, name: b.name, cost: b.itemsCost || 0,
          tickets: b.baseTickets || 0, completed: b.completed, checked: b.completed
        }));

        const incomingChores = (body.chores || []).map(c => ({
          weekId: currentWeekId, name: c.task, npc: c.npc,
          tickets: c.baseTickets || 0, completed: c.completed, checked: c.completed
        }));

        existingData.weeks[currentWeekId] = {
          weekId: currentWeekId,
          bounties: incomingBounties,
          chores: incomingChores
        };

        if (body.logs && Array.isArray(body.logs)) {
          existingData.logs = body.logs;
        } else {
          const allDeliveries = (body.deliveries || []).map(d => ({
            name: d.from, cost: d.itemsCost || 0, tickets: d.baseTickets || 0,
            completed: d.completed, items: d.itemDetails || [], checked: d.completed
          }));

          const dailyTickets = body.dailyDeliveryTicketsSaved || 0;
          const dailyCost = body.dailyDeliveryCostSaved || 0;

          const existingTodayLogIndex = existingData.logs.findIndex(l => l.date === todayDate);
          if (existingTodayLogIndex !== -1) {
            existingData.logs[existingTodayLogIndex] = {
              date: todayDate, weekId: currentWeekId, timestamp: new Date().toISOString(),
              ticketsSaved: dailyTickets, costSaved: dailyCost,
              deliveriesDone: allDeliveries
            };
          } else {
            existingData.logs.unshift({
              date: todayDate, weekId: currentWeekId, timestamp: new Date().toISOString(),
              ticketsSaved: dailyTickets, costSaved: dailyCost,
              deliveriesDone: allDeliveries
            });
          }
        }

        let totalTix = 0;
        let totalCost = 0;
        existingData.logs.forEach(l => {
          totalTix += (l.ticketsSaved || 0);
          totalCost += (l.costSaved || 0);
        });

        Object.values(existingData.weeks).forEach(wk => {
          (wk.bounties || []).forEach(b => {
            if (b.completed || b.checked) {
              totalTix += (b.tickets || 0);
              totalCost += (b.cost || 0);
            }
          });
          (wk.chores || []).forEach(c => {
            if (c.completed || c.checked) {
              totalTix += (c.tickets || 0);
            }
          });
        });

        existingData.cumulativeTickets = totalTix;
        existingData.cumulativeCost = totalCost;
        existingData.deliveries = body.deliveries || [];
        existingData.bounties = incomingBounties;
        existingData.chores = incomingChores;

        await env.TRACKER_KV.put(vaultKey, JSON.stringify(existingData));

        return new Response(JSON.stringify({ success: true, vaultData: existingData }), {
          status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

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

    const isVipActive = !!(farm.vip?.expiresAt && farm.vip.expiresAt > Date.now());

    // 1. Deliveries Parser
    const rawDeliveries = farm.delivery?.orders || [];
    const deliveryList = [];
    rawDeliveries.forEach(order => {
      const npcNameClean = (order.from || '').toLowerCase().trim();
      const baseTickets = CHAPTER_NPC_TICKETS[npcNameClean];
      let baseTicketCount = baseTickets !== undefined ? baseTickets : 0;

      baseTicketCount += extractRewardTickets(order.reward);

      if (baseTicketCount > 0) {
        let itemsCost = 0;
        const itemDetails = [];
        Object.entries(order.items || {}).forEach(([itemName, qty]) => {
          const unitPrice = getItemUnitPrice(itemName, priceMap);
          const lineCost = unitPrice * qty;
          itemsCost += lineCost;
          itemDetails.push({ name: itemName, qty, unitPrice, lineCost, isRecipe: !getDirectMarketPrice(itemName, priceMap) && !!SFL_RECIPES[itemName.toLowerCase().trim()] });
        });

        const isCompleted = typeof order.completedAt === 'number' || order.status === 'completed' || order.completed === true;
        deliveryList.push({ id: order.id, from: order.from, items: order.items || {}, itemsCost, itemDetails, baseTickets: baseTicketCount, isChapterNpc: baseTickets !== undefined, completed: isCompleted });
      }
    });

    // 2. Bounties Parser (Support requests, active board, and direct lists)
    const activeBounties = [];
    const completedBountiesRaw = farm.bounties?.completed || farm.bounties?.claimed || [];
    let completedBountyIds = Array.isArray(completedBountiesRaw) ? completedBountiesRaw.map(b => typeof b === 'object' ? String(b.id) : String(b)) : [];

    const rawBountyArray = Array.isArray(farm.bounties) ? farm.bounties : (farm.bounties?.requests || farm.bounties?.board || []);

    rawBountyArray.forEach(b => {
      let baseTicketCount = extractRewardTickets(b.reward) + extractRewardTickets(b.items);
      // Fallback: If SFL didn't label the item as ticket, default to 1 ticket per bounty request
      if (baseTicketCount === 0) {
        baseTicketCount = b.tickets || b.reward?.tickets || 1;
      }

      const unitPrice = b.name ? getItemUnitPrice(b.name, priceMap) : 0;
      const isCompleted = typeof b.completedAt === 'number' || b.completed === true || b.status === 'completed' || completedBountyIds.includes(String(b.id));
      activeBounties.push({ id: b.id, name: b.name, level: b.level || null, baseTickets: baseTicketCount, itemsCost: unitPrice, completed: isCompleted });
    });

    // 3. Chores Parser
    const choreObj = farm.choreBoard?.chores || farm.chores || {};
    const choresList = Object.entries(choreObj).map(([key, details]) => {
      let baseTicketCount = extractRewardTickets(details.reward);
      if (baseTicketCount === 0) {
        baseTicketCount = details.tickets || details.baseTickets || 1;
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
