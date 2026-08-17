import { hashPassword } from '../utils/auth-crypto.js';
import { 
  CHAPTER_NPC_TICKETS, 
  extractPricesRecursive, 
  getDirectMarketPrice, 
  getItemUnitPrice, 
  extractRewardTickets 
} from '../utils/sfl-pricing.js';
import { SFL_RECIPES } from '../../recipes.js';

const jsonRes = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getMondayBasedWeekId(d) {
  let date;
  try {
    if (!d || d === 0 || d === '0') {
      date = new Date();
    } else if (typeof d === 'number') {
      date = new Date(d < 1e11 ? d * 1000 : d);
    } else if (typeof d === 'string') {
      if (/^\d+$/.test(d)) {
        const num = parseInt(d, 10);
        date = new Date(num < 1e11 ? num * 1000 : num);
      } else {
        date = new Date(d.includes('T') ? d : `${d}T00:00:00.000Z`);
      }
    } else if (d instanceof Date) {
      date = new Date(d.getTime());
    } else {
      date = new Date();
    }
  } catch (err) {
    date = new Date();
  }

  if (!date || isNaN(date.getTime())) {
    date = new Date();
  }

  const day = date.getUTCDay();
  const utcDate = date.getUTCDate();
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  date.setUTCDate(utcDate + diffToMonday);
  return date.toISOString().split('T')[0];
}

async function fetchFarmWithRetry(farmId, apiKey) {
  const retryDelays = [5000, 8000, 10000];
  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SunflowerTracker/2.0',
    'Referer': 'https://sunflower-land.com/',
    'Origin': 'https://sunflower-land.com'
  };
  if (apiKey && apiKey.trim() !== '') {
    headers['x-api-key'] = apiKey.trim();
  }

  let attempt = 0;
  while (attempt <= retryDelays.length) {
    try {
      const res = await fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { headers });
      if (res.ok) {
        const payload = await res.json().catch(() => null);
        if (payload && payload.farm) {
          return payload.farm;
        }
      }
      if (res.status === 401 || res.status === 404) {
        return null;
      }
    } catch (err) {}

    if (attempt < retryDelays.length) {
      await sleep(retryDelays[attempt]);
    }
    attempt++;
  }
  return null;
}

async function executeCronBackupTask(env) {
  const backupTimestamp = new Date().toISOString();
  const todayDate = backupTimestamp.split('T')[0];
  const currentWeekMonday = getMondayBasedWeekId();
  const serverApiKey = env?.SFL_API_KEY || '';

  let priceMap = {};
  try {
    const pricesRes = await fetch(`https://sfl.world/api/v1/prices`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (pricesRes.ok) {
      const rawData = await pricesRes.json().catch(() => null);
      if (rawData) priceMap = extractPricesRecursive(rawData);
    }
  } catch (e) {}

  if (!env?.TRACKER_KV) return;

  const list = await env.TRACKER_KV.list({ prefix: "user_" });
  let processedCount = 0;

  for (const keyObj of list.keys) {
    if (!keyObj.name.endsWith("_vault")) continue;

    let vaultData = await env.TRACKER_KV.get(keyObj.name, "json");
    if (!vaultData) continue;

    if (!vaultData.logs) vaultData.logs = [];
    if (!vaultData.weeks) vaultData.weeks = {};

    const targetFarmId = vaultData.farmId;
    if (!targetFarmId) continue;

    const farm = await fetchFarmWithRetry(targetFarmId, serverApiKey);

    if (farm) {
      if (vaultData.lastDailyLoginDate !== todayDate) {
        vaultData.dailyLoginTickets = (vaultData.dailyLoginTickets || 0) + 1;
        vaultData.lastDailyLoginDate = todayDate;
      }

      const rawMilestones = farm.delivery?.milestones || farm.milestones || {};
      const liveMilestones = {};
      Object.entries(rawMilestones).forEach(([npc, count]) => {
        const cleanName = npc.toLowerCase().trim();
        if (CHAPTER_NPC_TICKETS[cleanName] !== undefined) {
          liveMilestones[cleanName] = count;
        }
      });

      const baselineMilestones = vaultData.logs[0]?.milestones || vaultData.milestones || {};

      const nowMs = Date.now();
      const calendarEvents = farm.calendar?.events || farm.calendar || farm.specialEvents || [];
      let isDoubleDeliveryActive = false;
      if (Array.isArray(calendarEvents)) {
        isDoubleDeliveryActive = calendarEvents.some(evt => {
          const title = (evt.name || evt.title || evt.type || '').toLowerCase();
          const matches = title.includes('double delivery') || title.includes('double_delivery') || title.includes('2x delivery');
          const started = typeof evt.startDate === 'number' ? evt.startDate <= nowMs : true;
          const notEnded = typeof evt.endDate === 'number' ? evt.endDate >= nowMs : true;
          return matches && started && notEnded;
        });
      }

      const deliveryList = [];
      const npcOrderCounts = {};
      (farm.delivery?.orders || []).forEach(order => {
        const npcClean = (order.from || '').toLowerCase().trim();
        let totalTickets = extractRewardTickets(order.reward) || extractRewardTickets(order.items);
        if (totalTickets === 0 && CHAPTER_NPC_TICKETS[npcClean] !== undefined) {
          totalTickets = CHAPTER_NPC_TICKETS[npcClean];
        }

        if (totalTickets > 0) {
          let itemsCost = 0;
          const itemDetails = [];
          Object.entries(order.items || {}).forEach(([itemName, qty]) => {
            const unitPrice = getItemUnitPrice(itemName, priceMap);
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
          if (isCompleted) {
            npcOrderCounts[npcClean] = (npcOrderCounts[npcClean] || 0) + 1;
          }

          deliveryList.push({
            name: order.from,
            from: order.from,
            itemsCost,
            cost: itemsCost,
            baseTickets: totalTickets,
            tickets: totalTickets,
            completed: isCompleted,
            checked: isCompleted,
            completedAt: typeof order.completedAt === 'number' ? order.completedAt : (isCompleted ? Date.now() : null),
            itemDetails,
            isStacked: false
          });
        }
      });

      Object.entries(liveMilestones).forEach(([npcClean, liveCount]) => {
        const prevCount = baselineMilestones[npcClean] !== undefined ? baselineMilestones[npcClean] : 0;
        const completedToday = Math.max(0, liveCount - prevCount);
        const inOrdersCompleted = npcOrderCounts[npcClean] || 0;

        if (completedToday > inOrdersCompleted && prevCount > 0) {
          const extraStacked = completedToday - inOrdersCompleted;
          const npcTickets = CHAPTER_NPC_TICKETS[npcClean] || 2;
          for (let i = 0; i < extraStacked; i++) {
            deliveryList.push({
              name: npcClean.charAt(0).toUpperCase() + npcClean.slice(1),
              from: npcClean.charAt(0).toUpperCase() + npcClean.slice(1),
              cost: 0,
              itemsCost: 0,
              baseTickets: npcTickets,
              tickets: npcTickets,
              completed: true,
              checked: true,
              completedAt: Date.now(),
              itemDetails: [{ name: 'Stacked Previous Order', qty: 1, unitPrice: 0, lineCost: 0 }],
              isStacked: true
            });
          }
        }
      });

      const bountiesList = [];
      const seenBounties = new Set();
      const rawBounties = Array.isArray(farm.bounties) ? farm.bounties : (farm.bounties?.requests || farm.bounties?.board || []);
      rawBounties.forEach(b => {
        let tix = extractRewardTickets(b.reward) || extractRewardTickets(b.items) || b.tickets || 0;
        if (tix <= 0) return;
        const key = b.id ? String(b.id) : `${(b.name || '').toLowerCase()}_${b.level || 0}`;
        if (seenBounties.has(key)) return;
        seenBounties.add(key);

        const bCost = b.name ? getItemUnitPrice(b.name, priceMap) : 0;
        const isCompleted = typeof b.completedAt === 'number' || b.completed === true || b.status === 'completed';
        bountiesList.push({
          id: b.id || key,
          name: b.name,
          level: b.level || null,
          cost: bCost,
          itemsCost: bCost,
          baseTickets: tix,
          tickets: tix,
          completed: isCompleted,
          checked: isCompleted,
          completedAt: typeof b.completedAt === 'number' ? b.completedAt : null
        });
      });

      const choresObj = farm.choreBoard?.chores || farm.chores || {};
      const choresList = Object.entries(choresObj).map(([key, details]) => {
        let tix = extractRewardTickets(details.reward) || details.tickets || details.baseTickets || 1;
        const prog = details.initialProgress ?? details.progress ?? 0;
        const req = details.requirement ?? details.target ?? details.total ?? 0;
        const isDone = typeof details.completedAt === 'number' || details.completed === true || (req > 0 && prog >= req);
        const taskLabel = details.name || details.description || key;
        return {
          npc: details.npc || details.from || 'NPC',
          task: taskLabel,
          name: taskLabel,
          baseTickets: tix,
          tickets: tix,
          cost: 0,
          itemsCost: 0,
          completed: isDone,
          checked: isDone,
          completedAt: typeof details.completedAt === 'number' ? details.completedAt : null
        };
      });

      vaultData.weeks[currentWeekMonday] = {
        weekId: currentWeekMonday,
        bounties: bountiesList,
        chores: choresList
      };

      let dailyTix = 0;
      let dailyCost = 0;
      let doubleApplied = false;

      const formattedDeliveries = deliveryList.map(d => {
        let yld = d.baseTickets;
        if (d.checked || d.completed) {
          if (isDoubleDeliveryActive && !doubleApplied) {
            yld = yld * 2;
            doubleApplied = true;
          }
          dailyTix += yld;
          dailyCost += d.cost;
        }
        return { ...d, tickets: yld };
      });

      const existingIndex = vaultData.logs.findIndex(l => (l.date || '').split('T')[0] === todayDate);
      const logEntry = {
        date: todayDate,
        weekId: currentWeekMonday,
        timestamp: backupTimestamp,
        ticketsSaved: dailyTix,
        costSaved: dailyCost,
        autoBackup: true,
        deliveriesDone: formattedDeliveries,
        milestones: liveMilestones
      };

      if (existingIndex !== -1) {
        vaultData.logs[existingIndex] = logEntry;
      } else {
        vaultData.logs.unshift(logEntry);
      }

      vaultData.deliveries = formattedDeliveries;
      vaultData.bounties = bountiesList;
      vaultData.chores = choresList;
      vaultData.milestones = liveMilestones;

      let totalTix = (vaultData.trackTickets || 0) + (vaultData.dailyLoginTickets || 0);
      let totalCost = vaultData.trackCost || 0;

      vaultData.logs.forEach(l => {
        (l.deliveriesDone || []).forEach(d => {
          if (d.checked || d.completed) {
            totalTix += (d.tickets || d.baseTickets || 0);
            totalCost += (d.cost || 0);
          }
        });
      });

      Object.values(vaultData.weeks).forEach(wk => {
        (wk.bounties || []).forEach(b => {
          if (b.completed || b.checked) {
            totalTix += (b.tickets || b.baseTickets || 0);
            totalCost += (b.cost || 0);
          }
        });
        (wk.chores || []).forEach(c => {
          if (c.completed || c.checked) {
            totalTix += (c.tickets || c.baseTickets || 0);
            totalCost += (c.cost || 0);
          }
        });
      });

      vaultData.cumulativeTickets = totalTix;
      vaultData.cumulativeCost = totalCost;

      delete vaultData.apiKey;
      await env.TRACKER_KV.put(keyObj.name, JSON.stringify(vaultData));
      processedCount++;

      await sleep(1000);
    }
  }

  await env.TRACKER_KV.put(`system_last_cron_backup`, JSON.stringify({ 
    timestamp: backupTimestamp, 
    vaultsProcessed: processedCount 
  }));
}

export async function onRequest(context) {
  const { request, env, waitUntil } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const farmId = url.searchParams.get('farmId') || '8472883706403914';
  const apiKey = url.searchParams.get('apiKey') || env?.SFL_API_KEY || '';

  if (action === 'cronBackup') {
    const secretKey = url.searchParams.get('key');
    const expectedKey = env?.CRON_SECRET || 'kuro123';
    if (secretKey !== expectedKey) {
      return jsonRes({ error: 'Unauthorized cron key.' }, 401);
    }

    if (waitUntil) {
      waitUntil(executeCronBackupTask(env));
    } else {
      context.waitUntil(executeCronBackupTask(env));
    }

    return jsonRes({
      success: true,
      status: "BACKGROUND_CRAWLER_STARTED",
      message: "Cron backup initiated in background. Processing all farms with retry engine."
    });
  }

  if (action === 'getVault') {
    const username = (url.searchParams.get('username') || '').toLowerCase().trim();
    if (env?.TRACKER_KV && username) {
      let vaultData = await env.TRACKER_KV.get(`user_${username}_vault`, 'json') || { 
        farmId,
        logs: [], 
        cumulativeTickets: 0, 
        cumulativeCost: 0, 
        weeks: {}, 
        trackTickets: 0, 
        trackCost: 0,
        dailyLoginTickets: 0,
        lastDailyLoginDate: null,
        deliveries: [], 
        bounties: [], 
        chores: [],
        milestones: {}
      };
      delete vaultData.apiKey;
      return jsonRes({ success: true, vaultData });
    }
    return jsonRes({ vaultData: null });
  }

  if (request.method === 'POST' && action === 'register') {
    try {
      const body = await request.json().catch(() => ({}));
      const username = (body.username || '').toLowerCase().trim();
      const password = body.password || '';
      const userFarmId = body.farmId || farmId;

      if (!username || !password) return jsonRes({ error: 'Username and password required.' }, 400);
      if (!env?.TRACKER_KV) return jsonRes({ error: 'KV Database missing.' }, 500);

      const userKey = `user_${username}_auth`;
      if (await env.TRACKER_KV.get(userKey)) return jsonRes({ error: 'Username already taken.' }, 400);

      const passwordHash = await hashPassword(password);
      await env.TRACKER_KV.put(userKey, JSON.stringify({ username, passwordHash, createdAt: new Date().toISOString() }));
      await env.TRACKER_KV.put(`user_${username}_vault`, JSON.stringify({ 
        farmId: userFarmId,
        logs: [], 
        cumulativeTickets: 0, 
        cumulativeCost: 0, 
        weeks: {}, 
        trackTickets: 0, 
        trackCost: 0,
        dailyLoginTickets: 0,
        lastDailyLoginDate: null,
        deliveries: [], 
        bounties: [], 
        chores: [],
        milestones: {}
      }));

      return jsonRes({ success: true, username, farmId: userFarmId });
    } catch (err) {
      return jsonRes({ error: err.message }, 500);
    }
  }

  if (request.method === 'POST' && action === 'login') {
    try {
      const body = await request.json().catch(() => ({}));
      const username = (body.username || '').toLowerCase().trim();
      const password = body.password || '';
      const userFarmId = body.farmId;

      if (!username || !password) return jsonRes({ error: 'Username and password required.' }, 400);
      if (!env?.TRACKER_KV) return jsonRes({ error: 'KV Database missing.' }, 500);

      const userDataStr = await env.TRACKER_KV.get(`user_${username}_auth`);
      if (!userDataStr) return jsonRes({ error: 'Account not found.' }, 401);

      const userData = JSON.parse(userDataStr);
      if (userData.passwordHash !== await hashPassword(password)) return jsonRes({ error: 'Incorrect password.' }, 401);

      let vaultData = await env.TRACKER_KV.get(`user_${username}_vault`, 'json') || { 
        logs: [], 
        cumulativeTickets: 0, 
        cumulativeCost: 0, 
        weeks: {}, 
        trackTickets: 0, 
        trackCost: 0,
        dailyLoginTickets: 0,
        lastDailyLoginDate: null,
        milestones: {}
      };

      if (userFarmId && !vaultData.farmId) {
        vaultData.farmId = userFarmId;
        await env.TRACKER_KV.put(`user_${username}_vault`, JSON.stringify(vaultData));
      }

      delete vaultData.apiKey;
      return jsonRes({ success: true, username, vaultData });
    } catch (err) {
      return jsonRes({ error: err.message }, 500);
    }
  }

  if (request.method === 'POST' && action === 'saveVault') {
    try {
      const body = await request.json().catch(() => ({}));
      const username = (body.username || '').toLowerCase().trim();
      if (!username) return jsonRes({ error: 'Not logged in.' }, 401);
      if (!env?.TRACKER_KV) return jsonRes({ error: 'KV Database missing.' }, 500);

      const vaultKey = `user_${username}_vault`;
      let existingData = await env.TRACKER_KV.get(vaultKey, 'json') || { 
        logs: [], 
        cumulativeTickets: 0, 
        cumulativeCost: 0, 
        weeks: {}, 
        trackTickets: 0, 
        trackCost: 0,
        dailyLoginTickets: 0,
        lastDailyLoginDate: null,
        milestones: {}
      };

      const todayDate = new Date().toISOString().split('T')[0];
      const currentWeekMonday = getMondayBasedWeekId();
      if (!existingData.weeks) existingData.weeks = {};

      if (body.farmId) existingData.farmId = body.farmId;
      if (body.trackTickets !== undefined) existingData.trackTickets = parseInt(body.trackTickets) || 0;
      if (body.trackCost !== undefined) existingData.trackCost = parseFloat(body.trackCost) || 0;
      
      if (body.dailyLoginTickets !== undefined) {
        existingData.dailyLoginTickets = parseInt(body.dailyLoginTickets, 10) || 0;
      }
      if (body.lastDailyLoginDate) {
        existingData.lastDailyLoginDate = body.lastDailyLoginDate;
      } else {
        existingData.lastDailyLoginDate = todayDate;
      }

      if (body.milestones) {
        const cleanedMilestones = {};
        Object.entries(body.milestones).forEach(([k, v]) => {
          if (CHAPTER_NPC_TICKETS[k.toLowerCase().trim()] !== undefined) {
            cleanedMilestones[k.toLowerCase().trim()] = v;
          }
        });
        existingData.milestones = cleanedMilestones;
      }

      const incomingBounties = (body.bounties || [])
        .filter(bItem => (bItem.baseTickets || bItem.tickets || 0) > 0)
        .map(bItem => {
          const isDone = bItem.checked !== undefined ? bItem.checked : Boolean(bItem.completed);
          return {
            id: bItem.id || null,
            level: bItem.level || null,
            weekId: currentWeekMonday, 
            name: bItem.name, 
            cost: bItem.itemsCost || bItem.cost || 0,
            baseTickets: bItem.baseTickets !== undefined ? bItem.baseTickets : (bItem.tickets || 0),
            tickets: bItem.baseTickets !== undefined ? bItem.baseTickets : (bItem.tickets || 0), 
            completed: isDone, 
            completedAt: bItem.completedAt || null,
            checked: isDone,
            checkedToday: bItem.checkedToday || false
          };
        });

      const incomingChores = (body.chores || []).map(cItem => {
        const isDone = cItem.checked !== undefined ? cItem.checked : Boolean(cItem.completed);
        const taskName = cItem.task || cItem.name || 'Chore';
        return {
          weekId: currentWeekMonday, 
          name: taskName, 
          task: taskName, 
          npc: cItem.npc || 'NPC',
          baseTickets: cItem.baseTickets !== undefined ? cItem.baseTickets : (cItem.tickets || 1),
          tickets: cItem.baseTickets !== undefined ? cItem.baseTickets : (cItem.tickets || 1), 
          cost: cItem.itemsCost || cItem.cost || 0,
          completed: isDone, 
          completedAt: cItem.completedAt || null,
          checked: isDone,
          checkedToday: cItem.checkedToday || false
        };
      });

      if (incomingBounties.length > 0 || incomingChores.length > 0) {
        existingData.weeks[currentWeekMonday] = { 
          weekId: currentWeekMonday, 
          bounties: incomingBounties.length > 0 ? incomingBounties : (existingData.weeks[currentWeekMonday]?.bounties || []), 
          chores: incomingChores.length > 0 ? incomingChores : (existingData.weeks[currentWeekMonday]?.chores || []) 
        };
      }

      if (body.logs && Array.isArray(body.logs)) {
        existingData.logs = body.logs;
      } else {
        const allDeliveries = (body.deliveries || []).map(d => {
          const isDone = d.checked !== undefined ? d.checked : Boolean(d.completed);
          return {
            name: d.from || d.name, 
            cost: d.itemsCost || d.cost || 0, 
            baseTickets: d.baseTickets !== undefined ? d.baseTickets : (d.tickets || 2),
            tickets: d.baseTickets !== undefined ? d.baseTickets : (d.tickets || 2),
            completed: isDone, 
            completedAt: d.completedAt || (isDone ? Date.now() : null),
            items: d.itemDetails || d.items || [], 
            itemDetails: d.itemDetails || d.items || [], 
            checked: isDone,
            isStacked: d.isStacked || false
          };
        });

        const dailyTickets = body.dailyDeliveryTicketsSaved || 0;
        const dailyCost = body.dailyDeliveryCostSaved || 0;

        const existingTodayLogIndex = existingData.logs.findIndex(l => (l.date || '').split('T')[0] === todayDate);
        if (existingTodayLogIndex !== -1) {
          existingData.logs[existingTodayLogIndex] = { 
            date: todayDate, 
            weekId: currentWeekMonday, 
            timestamp: new Date().toISOString(), 
            ticketsSaved: dailyTickets, 
            costSaved: dailyCost, 
            deliveriesDone: allDeliveries,
            milestones: existingData.milestones || {}
          };
        } else {
          existingData.logs.unshift({ 
            date: todayDate, 
            weekId: currentWeekMonday, 
            timestamp: new Date().toISOString(), 
            ticketsSaved: dailyTickets, 
            costSaved: dailyCost, 
            deliveriesDone: allDeliveries,
            milestones: existingData.milestones || {}
          });
        }
      }

      let totalTix = (existingData.trackTickets || 0) + (existingData.dailyLoginTickets || 0);
      let totalCost = existingData.trackCost || 0;
      existingData.logs.forEach(l => {
        (l.deliveriesDone || []).forEach(d => {
          if (d.checked !== undefined ? d.checked : d.completed) {
            totalTix += (d.baseTickets || d.tickets || 0);
            totalCost += (d.cost || 0);
          }
        });
      });

      Object.values(existingData.weeks).forEach(wk => {
        (wk.bounties || []).forEach(bItem => {
          if (bItem.completed || bItem.checked) {
            totalTix += (bItem.tickets || bItem.baseTickets || 0);
            totalCost += (bItem.cost || 0);
          }
        });
        (wk.chores || []).forEach(cItem => {
          if (cItem.completed || cItem.checked) {
            totalTix += (cItem.tickets || cItem.baseTickets || 0);
            totalCost += (cItem.cost || 0);
          }
        });
      });

      existingData.cumulativeTickets = totalTix;
      existingData.cumulativeCost = totalCost;
      existingData.deliveries = body.deliveries || existingData.deliveries || [];
      existingData.bounties = incomingBounties.length > 0 ? incomingBounties : (existingData.bounties || []);
      existingData.chores = incomingChores.length > 0 ? incomingChores : (existingData.chores || []);

      delete existingData.apiKey;
      await env.TRACKER_KV.put(vaultKey, JSON.stringify(existingData));
      return jsonRes({ success: true, vaultData: existingData });
    } catch (err) {
      return jsonRes({ error: err.message }, 500);
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
      throw new Error(status === 401 ? 'SFL API returned 401 Unauthorized.' : `SFL API error (${status}). Check Farm ID.`);
    }

    const payload = await sflResponse.json().catch(() => ({}));
    const farm = payload.farm || {};

    let priceMap = {};
    if (pricesResponse && pricesResponse.ok) {
      const rawPricesData = await pricesResponse.json().catch(() => null);
      if (rawPricesData) priceMap = extractPricesRecursive(rawPricesData);
    }

    const isVipActive = !!(farm.vip?.expiresAt && farm.vip.expiresAt > Date.now());
    
    const rawMilestones = farm.delivery?.milestones || farm.milestones || {};
    const liveMilestones = {};
    Object.entries(rawMilestones).forEach(([npc, count]) => {
      const cleanName = npc.toLowerCase().trim();
      if (CHAPTER_NPC_TICKETS[cleanName] !== undefined) {
        liveMilestones[cleanName] = count;
      }
    });

    const nowMs = Date.now();
    const calendarEvents = farm.calendar?.events || farm.calendar || farm.specialEvents || [];
    let isDoubleDeliveryActive = false;

    if (Array.isArray(calendarEvents)) {
      isDoubleDeliveryActive = calendarEvents.some(evt => {
        const title = (evt.name || evt.title || evt.type || '').toLowerCase();
        const matchesName = title.includes('double delivery') || title.includes('double_delivery') || title.includes('2x delivery');
        const started = typeof evt.startDate === 'number' ? evt.startDate <= nowMs : true;
        const notEnded = typeof evt.endDate === 'number' ? evt.endDate >= nowMs : true;
        return matchesName && started && notEnded;
      });
    }

    let baselineMilestones = {};
    const usernameParam = (url.searchParams.get('username') || '').toLowerCase().trim();
    let currentVault = null;

    if (env?.TRACKER_KV && usernameParam) {
      currentVault = await env.TRACKER_KV.get(`user_${usernameParam}_vault`, 'json');
      if (!currentVault) {
        currentVault = {
          farmId,
          logs: [],
          cumulativeTickets: 0,
          cumulativeCost: 0,
          weeks: {},
          trackTickets: 0,
          trackCost: 0,
          dailyLoginTickets: 0,
          lastDailyLoginDate: null,
          deliveries: [],
          bounties: [],
          chores: [],
          milestones: {}
        };
      }
      if (currentVault?.logs?.length > 0) {
        baselineMilestones = currentVault.logs[0]?.milestones || currentVault.milestones || {};
      }
    }

    const deliveryList = [];
    const npcOrderCounts = {};

    (farm.delivery?.orders || []).forEach(order => {
      const npcClean = (order.from || '').toLowerCase().trim();
      let totalTickets = extractRewardTickets(order.reward) || extractRewardTickets(order.items);
      
      if (totalTickets === 0 && CHAPTER_NPC_TICKETS[npcClean] !== undefined) {
        totalTickets = CHAPTER_NPC_TICKETS[npcClean];
      }

      if (totalTickets > 0) {
        let itemsCost = 0;
        const itemDetails = [];
        Object.entries(order.items || {}).forEach(([itemName, qty]) => {
          const unitPrice = getItemUnitPrice(itemName, priceMap);
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
        if (isCompleted) {
          npcOrderCounts[npcClean] = (npcOrderCounts[npcClean] || 0) + 1;
        }

        deliveryList.push({ 
          id: order.id, 
          from: order.from, 
          items: order.items || {}, 
          itemsCost, 
          itemDetails, 
          baseTickets: totalTickets, 
          isChapterNpc: CHAPTER_NPC_TICKETS[npcClean] !== undefined, 
          completed: isCompleted,
          checked: isCompleted,
          completedAt: (typeof order.completedAt === 'number') ? order.completedAt : (isCompleted ? Date.now() : null),
          isStacked: false
        });
      }
    });

    Object.entries(liveMilestones).forEach(([npcClean, liveCount]) => {
      const prevCount = baselineMilestones[npcClean] !== undefined ? baselineMilestones[npcClean] : 0;
      const completedTodayInMilestones = Math.max(0, liveCount - prevCount);
      const inOrdersCompleted = npcOrderCounts[npcClean] || 0;

      if (completedTodayInMilestones > inOrdersCompleted && prevCount > 0) {
        const extraStacked = completedTodayInMilestones - inOrdersCompleted;
        const npcTickets = CHAPTER_NPC_TICKETS[npcClean] || 2;

        for (let i = 0; i < extraStacked; i++) {
          deliveryList.push({
            id: `stacked_${npcClean}_${Date.now()}_${i}`,
            from: npcClean.charAt(0).toUpperCase() + npcClean.slice(1),
            items: {},
            itemsCost: 0,
            itemDetails: [{ name: 'Stacked Previous Order', qty: 1, unitPrice: 0, lineCost: 0 }],
            baseTickets: npcTickets,
            isChapterNpc: CHAPTER_NPC_TICKETS[npcClean] !== undefined,
            completed: true,
            checked: true,
            completedAt: Date.now(),
            isStacked: true
          });
        }
      }
    });

    const activeBounties = [];
    const seenBountyKeys = new Set();
    const completedBountiesRaw = farm.bounties?.completed || farm.bounties?.claimed || [];
    const completedMap = {};

    if (Array.isArray(completedBountiesRaw)) {
      completedBountiesRaw.forEach(b => {
        if (typeof b === 'object' && b.id) {
          const t = (typeof b.completedAt === 'number') ? b.completedAt : ((typeof b.claimedAt === 'number') ? b.claimedAt : null);
          completedMap[String(b.id)] = t;
        } else if (b) {
          completedMap[String(b)] = null;
        }
      });
    }

    const rawBountyArray = Array.isArray(farm.bounties) ? farm.bounties : (farm.bounties?.requests || farm.bounties?.board || []);

    rawBountyArray.forEach(b => {
      let baseTicketCount = 0;
      if (b.reward) baseTicketCount = extractRewardTickets(b.reward);
      if (baseTicketCount === 0 && b.items) baseTicketCount = extractRewardTickets(b.items);
      if (baseTicketCount === 0 && typeof b.tickets === 'number') baseTicketCount = b.tickets;

      if (baseTicketCount <= 0) return;

      const uniqueKey = b.id ? String(b.id) : `${(b.name || '').toLowerCase()}_${b.level || 0}`;
      if (seenBountyKeys.has(uniqueKey)) return;
      seenBountyKeys.add(uniqueKey);

      const unitPrice = b.name ? getItemUnitPrice(b.name, priceMap) : 0;
      const isCompleted = typeof b.completedAt === 'number' || b.completed === true || b.status === 'completed' || completedMap[String(b.id)] !== undefined;
      
      let completionTime = null;
      if (typeof b.completedAt === 'number') {
        completionTime = b.completedAt;
      } else if (typeof b.claimedAt === 'number') {
        completionTime = b.claimedAt;
      } else if (completedMap[String(b.id)] !== undefined && completedMap[String(b.id)] !== null) {
        completionTime = completedMap[String(b.id)];
      }

      activeBounties.push({ 
        id: b.id || uniqueKey, 
        name: b.name, 
        level: b.level || null, 
        baseTickets: baseTicketCount, 
        itemsCost: unitPrice, 
        completed: isCompleted,
        checked: isCompleted,
        completedAt: completionTime,
        checkedToday: false
      });
    });

    const choreObj = farm.choreBoard?.chores || farm.chores || {};
    const choresList = Object.entries(choreObj).map(([key, details]) => {
      let baseTicketCount = extractRewardTickets(details.reward);
      if (baseTicketCount === 0) baseTicketCount = details.tickets || details.baseTickets || 1;
      const currentProgress = details.initialProgress ?? details.progress ?? 0;
      const requirement = details.requirement ?? details.target ?? details.total ?? 0;
      const isCompleted = typeof details.completedAt === 'number' || details.completed === true || details.isCompleted === true || (requirement > 0 && currentProgress >= requirement);
      const completionTime = (typeof details.completedAt === 'number') ? details.completedAt : null;
      const taskLabel = details.name || details.description || key;

      return { 
        npc: details.npc || details.from || 'Chore NPC', 
        name: taskLabel,
        task: taskLabel, 
        baseTickets: baseTicketCount, 
        progress: currentProgress, 
        requirement, 
        completed: isCompleted,
        checked: isCompleted,
        completedAt: completionTime,
        checkedToday: false
      };
    });

    if (env?.TRACKER_KV && usernameParam && currentVault) {
      const todayDate = new Date().toISOString().split('T')[0];
      const currentWeekMonday = getMondayBasedWeekId();

      currentVault.farmId = farmId;
      currentVault.deliveries = deliveryList;
      currentVault.bounties = activeBounties;
      currentVault.chores = choresList;
      currentVault.milestones = liveMilestones;

      if (!currentVault.weeks) currentVault.weeks = {};
      currentVault.weeks[currentWeekMonday] = {
        weekId: currentWeekMonday,
        bounties: activeBounties,
        chores: choresList
      };

      let dailyTix = 0;
      let dailyCost = 0;
      deliveryList.forEach(d => {
        if (d.checked || d.completed) {
          dailyTix += d.baseTickets;
          dailyCost += d.itemsCost;
        }
      });

      if (!currentVault.logs) currentVault.logs = [];
      const existingLogIdx = currentVault.logs.findIndex(l => (l.date || '').split('T')[0] === todayDate);
      const logEntry = {
        date: todayDate,
        weekId: currentWeekMonday,
        timestamp: new Date().toISOString(),
        ticketsSaved: dailyTix,
        costSaved: dailyCost,
        deliveriesDone: deliveryList,
        milestones: liveMilestones
      };

      if (existingLogIdx !== -1) {
        currentVault.logs[existingLogIdx] = logEntry;
      } else {
        currentVault.logs.unshift(logEntry);
      }

      delete currentVault.apiKey;
      await env.TRACKER_KV.put(`user_${usernameParam}_vault`, JSON.stringify(currentVault));
    }

    return jsonRes({
      farmId, 
      isVipActive,
      isDoubleDeliveryActive,
      milestones: liveMilestones,
      pricesLoadedCount: Object.keys(priceMap).length,
      deliveries: deliveryList, 
      bounties: activeBounties, 
      chores: choresList,
      vaultData: currentVault
    });
  } catch (err) {
    return jsonRes({ error: err.message }, 500);
  }
}
