import { hashPassword } from '../utils/auth-crypto.js';
import { getMondayBasedWeekId } from '../utils/dates.js';
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

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const farmId = url.searchParams.get('farmId') || '8472883706403914';
  const apiKey = url.searchParams.get('apiKey') || env?.SFL_API_KEY || '';

  // 1. Cron Backup Handler
  if (action === 'cronBackup') {
    const secretKey = url.searchParams.get('key');
    const expectedKey = env?.CRON_SECRET || 'kuro123';
    if (secretKey !== expectedKey) return jsonRes({ error: 'Unauthorized cron key.' }, 401);

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
                  completedAt: b.completedAt || null,
                  checked: b.completed || b.checked
                };
              });

              const currentWeekChores = (vaultData.chores || []).map(c => ({
                name: c.name || c.task || 'Chore',
                npc: c.npc || 'NPC',
                tickets: c.tickets !== undefined ? c.tickets : (c.baseTickets || 1),
                completed: c.completed || c.checked,
                completedAt: c.completedAt || null,
                checked: c.completed || c.checked
              }));

              vaultData.weeks[currentWeekId] = { weekId: currentWeekId, bounties: currentWeekBounties, chores: currentWeekChores };
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
                completedAt: d.completedAt || null,
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

            let totalTix = vaultData.trackTickets || 0;
            let totalCost = vaultData.trackCost || 0;

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
                if (c.completed || c.checked) totalTix += (c.tickets || 1);
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

    return jsonRes({ success: true, message: `Active KV Backup executed successfully at ${backupTimestamp}. Synced ${backedUpCount} vaults.` });
  }

  // 2. Fetch Vault
  if (action === 'getVault') {
    const username = (url.searchParams.get('username') || '').toLowerCase().trim();
    if (env?.TRACKER_KV && username) {
      let vaultData = await env.TRACKER_KV.get(`user_${username}_vault`, 'json') || { logs: [], cumulativeTickets: 0, cumulativeCost: 0, weeks: {}, trackTickets: 0, trackCost: 0, deliveries: [], bounties: [], chores: [] };
      return jsonRes({ success: true, vaultData });
    }
    return jsonRes({ vaultData: null });
  }

  // 3. User Registration
  if (request.method === 'POST' && action === 'register') {
    try {
      const body = await request.json().catch(() => ({}));
      const username = (body.username || '').toLowerCase().trim();
      const password = body.password || '';

      if (!username || !password) return jsonRes({ error: 'Username and password required.' }, 400);
      if (!env?.TRACKER_KV) return jsonRes({ error: 'KV Database missing.' }, 500);

      const userKey = `user_${username}_auth`;
      if (await env.TRACKER_KV.get(userKey)) return jsonRes({ error: 'Username already taken.' }, 400);

      const passwordHash = await hashPassword(password);
      await env.TRACKER_KV.put(userKey, JSON.stringify({ username, passwordHash, createdAt: new Date().toISOString() }));
      await env.TRACKER_KV.put(`user_${username}_vault`, JSON.stringify({ logs: [], cumulativeTickets: 0, cumulativeCost: 0, weeks: {}, trackTickets: 0, trackCost: 0, deliveries: [], bounties: [], chores: [] }));

      return jsonRes({ success: true, username });
    } catch (err) {
      return jsonRes({ error: err.message }, 500);
    }
  }

  // 4. User Login
  if (request.method === 'POST' && action === 'login') {
    try {
      const body = await request.json().catch(() => ({}));
      const username = (body.username || '').toLowerCase().trim();
      const password = body.password || '';

      if (!username || !password) return jsonRes({ error: 'Username and password required.' }, 400);
      if (!env?.TRACKER_KV) return jsonRes({ error: 'KV Database missing.' }, 500);

      const userDataStr = await env.TRACKER_KV.get(`user_${username}_auth`);
      if (!userDataStr) return jsonRes({ error: 'Account not found.' }, 401);

      const userData = JSON.parse(userDataStr);
      if (userData.passwordHash !== await hashPassword(password)) return jsonRes({ error: 'Incorrect password.' }, 401);

      let vaultData = await env.TRACKER_KV.get(`user_${username}_vault`, 'json') || { logs: [], cumulativeTickets: 0, cumulativeCost: 0, weeks: {}, trackTickets: 0, trackCost: 0 };
      return jsonRes({ success: true, username, vaultData });
    } catch (err) {
      return jsonRes({ error: err.message }, 500);
    }
  }

  // 5. Save Vault Progress (Stores permanent Track Tickets & Cost)
  if (request.method === 'POST' && action === 'saveVault') {
    try {
      const body = await request.json().catch(() => ({}));
      const username = (body.username || '').toLowerCase().trim();
      if (!username) return jsonRes({ error: 'Not logged in.' }, 401);
      if (!env?.TRACKER_KV) return jsonRes({ error: 'KV Database missing.' }, 500);

      const vaultKey = `user_${username}_vault`;
      let existingData = await env.TRACKER_KV.get(vaultKey, 'json') || { logs: [], cumulativeTickets: 0, cumulativeCost: 0, weeks: {}, trackTickets: 0, trackCost: 0 };

      const todayDate = new Date().toISOString().split('T')[0];
      const currentWeekId = getMondayBasedWeekId();
      if (!existingData.weeks) existingData.weeks = {};

      if (body.trackTickets !== undefined) existingData.trackTickets = parseInt(body.trackTickets) || 0;
      if (body.trackCost !== undefined) existingData.trackCost = parseFloat(body.trackCost) || 0;

      const incomingBounties = (body.bounties || []).map(b => ({
        weekId: currentWeekId, 
        name: b.name, 
        cost: b.itemsCost || b.cost || 0,
        tickets: b.baseTickets || b.tickets || 0, 
        completed: b.completed, 
        completedAt: b.completedAt || null,
        checked: b.completed
      }));

      const incomingChores = (body.chores || []).map(c => ({
        weekId: currentWeekId, 
        name: c.task || c.name, 
        npc: c.npc,
        tickets: c.baseTickets || c.tickets || 0, 
        completed: c.completed, 
        completedAt: c.completedAt || null,
        checked: c.completed
      }));

      existingData.weeks[currentWeekId] = { weekId: currentWeekId, bounties: incomingBounties, chores: incomingChores };

      if (body.logs && Array.isArray(body.logs)) {
        existingData.logs = body.logs;
      } else {
        const allDeliveries = (body.deliveries || []).map(d => ({
          name: d.from || d.name, 
          cost: d.itemsCost || d.cost || 0, 
          tickets: d.baseTickets || d.tickets || 0,
          completed: d.completed, 
          completedAt: d.completedAt || null,
          items: d.itemDetails || d.items || [], 
          checked: d.completed
        }));

        const dailyTickets = body.dailyDeliveryTicketsSaved || 0;
        const dailyCost = body.dailyDeliveryCostSaved || 0;

        const existingTodayLogIndex = existingData.logs.findIndex(l => l.date === todayDate);
        if (existingTodayLogIndex !== -1) {
          existingData.logs[existingTodayLogIndex] = { date: todayDate, weekId: currentWeekId, timestamp: new Date().toISOString(), ticketsSaved: dailyTickets, costSaved: dailyCost, deliveriesDone: allDeliveries };
        } else {
          existingData.logs.unshift({ date: todayDate, weekId: currentWeekId, timestamp: new Date().toISOString(), ticketsSaved: dailyTickets, costSaved: dailyCost, deliveriesDone: allDeliveries });
        }
      }

      let totalTix = existingData.trackTickets || 0;
      let totalCost = existingData.trackCost || 0;
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
          if (c.completed || c.checked) totalTix += (c.tickets || 0);
        });
      });

      existingData.cumulativeTickets = totalTix;
      existingData.cumulativeCost = totalCost;
      existingData.deliveries = body.deliveries || [];
      existingData.bounties = incomingBounties;
      existingData.chores = incomingChores;

      await env.TRACKER_KV.put(vaultKey, JSON.stringify(existingData));
      return jsonRes({ success: true, vaultData: existingData });
    } catch (err) {
      return jsonRes({ error: err.message }, 500);
    }
  }

  // 6. Default Live SFL Fetch Handler
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

    // Deliveries Parser
    const deliveryList = [];
    (farm.delivery?.orders || []).forEach(order => {
      const npcNameClean = (order.from || '').toLowerCase().trim();
      const baseTickets = CHAPTER_NPC_TICKETS[npcNameClean] !== undefined ? CHAPTER_NPC_TICKETS[npcNameClean] : 0;
      const totalTickets = baseTickets + extractRewardTickets(order.reward);

      if (totalTickets > 0) {
        let itemsCost = 0;
        const itemDetails = [];
        Object.entries(order.items || {}).forEach(([itemName, qty]) => {
          const unitPrice = getItemUnitPrice(itemName, priceMap);
          const lineCost = unitPrice * qty;
          itemsCost += lineCost;
          itemDetails.push({ name: itemName, qty, unitPrice, lineCost, isRecipe: !getDirectMarketPrice(itemName, priceMap) && !!SFL_RECIPES[itemName.toLowerCase().trim()] });
        });

        const isCompleted = typeof order.completedAt === 'number' || order.status === 'completed' || order.completed === true;
        deliveryList.push({ 
          id: order.id, 
          from: order.from, 
          items: order.items || {}, 
          itemsCost, 
          itemDetails, 
          baseTickets: totalTickets, 
          isChapterNpc: CHAPTER_NPC_TICKETS[npcNameClean] !== undefined, 
          completed: isCompleted,
          completedAt: order.completedAt || null
        });
      }
    });

    // Bounties Parser
    const activeBounties = [];
    const completedBountiesRaw = farm.bounties?.completed || farm.bounties?.claimed || [];
    const completedBountyIds = Array.isArray(completedBountiesRaw) ? completedBountiesRaw.map(b => typeof b === 'object' ? String(b.id) : String(b)) : [];
    const rawBountyArray = Array.isArray(farm.bounties) ? farm.bounties : (farm.bounties?.requests || farm.bounties?.board || []);

    rawBountyArray.forEach(b => {
      let baseTicketCount = extractRewardTickets(b.reward) + extractRewardTickets(b.items);
      if (baseTicketCount === 0) baseTicketCount = b.tickets || b.reward?.tickets || 1;

      const unitPrice = b.name ? getItemUnitPrice(b.name, priceMap) : 0;
      const isCompleted = typeof b.completedAt === 'number' || b.completed === true || b.status === 'completed' || completedBountyIds.includes(String(b.id));
      activeBounties.push({ 
        id: b.id, 
        name: b.name, 
        level: b.level || null, 
        baseTickets: baseTicketCount, 
        itemsCost: unitPrice, 
        completed: isCompleted,
        completedAt: b.completedAt || null
      });
    });

    // Chores Parser
    const choreObj = farm.choreBoard?.chores || farm.chores || {};
    const choresList = Object.entries(choreObj).map(([key, details]) => {
      let baseTicketCount = extractRewardTickets(details.reward);
      if (baseTicketCount === 0) baseTicketCount = details.tickets || details.baseTickets || 1;
      const currentProgress = details.initialProgress ?? details.progress ?? 0;
      const requirement = details.requirement ?? details.target ?? details.total ?? 0;
      const isCompleted = typeof details.completedAt === 'number' || details.completed === true || details.isCompleted === true || (requirement > 0 && currentProgress >= requirement);
      return { 
        npc: details.npc || details.from || key, 
        task: details.name || details.description || key, 
        baseTickets: baseTicketCount, 
        progress: currentProgress, 
        requirement, 
        completed: isCompleted,
        completedAt: details.completedAt || null
      };
    });

    return jsonRes({
      farmId, isVipActive,
      pricesLoadedCount: Object.keys(priceMap).length,
      deliveries: deliveryList, bounties: activeBounties, chores: choresList
    });
  } catch (err) {
    return jsonRes({ error: err.message }, 500);
  }
}
