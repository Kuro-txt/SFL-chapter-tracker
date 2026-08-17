import { hashPassword } from '../utils/auth-crypto.js';
import { 
  CHAPTER_NPC_TICKETS, 
  extractPricesRecursive, 
  getDirectMarketPrice, 
  getItemUnitPrice, 
  extractRewardTickets 
} from '../utils/sfl-pricing.js';
import { SFL_RECIPES } from '../../recipes.js';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function ensureTableExists() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_vaults (
      username TEXT PRIMARY KEY,
      auth_data JSONB,
      vault_data JSONB
    );
  `);
}
ensureTableExists().catch(console.error);

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

export async function GET(request) {
  return handleRequest(request);
}

export async function POST(request) {
  return handleRequest(request);
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const farmId = url.searchParams.get('farmId') || '8472883706403914';
  const apiKey = url.searchParams.get('apiKey') || process.env.SFL_API_KEY || '';

  if (action === 'getVault') {
    const username = (url.searchParams.get('username') || '').toLowerCase().trim();
    if (username) {
      const res = await pool.query('SELECT vault_data FROM user_vaults WHERE username = $1', [username]);
      if (res.rows.length > 0) {
        let vaultData = res.rows[0].vault_data;
        delete vaultData.apiKey;
        return jsonRes({ success: true, vaultData });
      }
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

      const check = await pool.query('SELECT username FROM user_vaults WHERE username = $1', [username]);
      if (check.rows.length > 0) return jsonRes({ error: 'Username already taken.' }, 400);

      const passwordHash = await hashPassword(password);
      const initialVault = {
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
      };

      await pool.query(
        'INSERT INTO user_vaults (username, auth_data, vault_data) VALUES ($1, $2, $3)',
        [username, JSON.stringify({ username, passwordHash }), JSON.stringify(initialVault)]
      );

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

      const res = await pool.query('SELECT auth_data, vault_data FROM user_vaults WHERE username = $1', [username]);
      if (res.rows.length === 0) return jsonRes({ error: 'Account not found.' }, 401);

      const authData = res.rows[0].auth_data;
      if (authData.passwordHash !== await hashPassword(password)) return jsonRes({ error: 'Incorrect password.' }, 401);

      let vaultData = res.rows[0].vault_data;
      if (userFarmId && !vaultData.farmId) {
        vaultData.farmId = userFarmId;
        await pool.query('UPDATE user_vaults SET vault_data = $1 WHERE username = $2', [JSON.stringify(vaultData), username]);
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

      const res = await pool.query('SELECT vault_data FROM user_vaults WHERE username = $1', [username]);
      let existingData = res.rows.length > 0 ? res.rows[0].vault_data : {
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

      if (body.farmId) existingData.farmId = body.farmId;
      if (body.trackTickets !== undefined) existingData.trackTickets = parseInt(body.trackTickets) || 0;
      if (body.trackCost !== undefined) existingData.trackCost = parseFloat(body.trackCost) || 0;
      if (body.dailyLoginTickets !== undefined) existingData.dailyLoginTickets = parseInt(body.dailyLoginTickets, 10) || 0;
      if (body.lastDailyLoginDate) existingData.lastDailyLoginDate = body.lastDailyLoginDate;
      if (body.weeks && typeof body.weeks === 'object') existingData.weeks = body.weeks;
      if (body.deliveries) existingData.deliveries = body.deliveries;
      if (body.bounties) existingData.bounties = body.bounties;
      if (body.chores) existingData.chores = body.chores;
      if (body.logs && Array.isArray(body.logs)) existingData.logs = body.logs;

      await pool.query(
        'UPDATE user_vaults SET vault_data = $1 WHERE username = $2',
        [JSON.stringify(existingData), username]
      );

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

    if (usernameParam) {
      const res = await pool.query('SELECT vault_data FROM user_vaults WHERE username = $1', [usernameParam]);
      if (res.rows.length > 0) {
        currentVault = res.rows[0].vault_data;
      }
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

    if (usernameParam && currentVault) {
      const todayDate = new Date().toISOString().split('T')[0];
      const currentWeekMonday = getMondayBasedWeekId();

      currentVault.farmId = farmId;
      currentVault.deliveries = deliveryList;
      currentVault.bounties = activeBounties;
      currentVault.chores = choresList;
      currentVault.milestones = liveMilestones;

      if (!currentVault.weeks) currentVault.weeks = {};
      if (!currentVault.weeks[currentWeekMonday]) {
        currentVault.weeks[currentWeekMonday] = {
          weekId: currentWeekMonday,
          bounties: activeBounties,
          chores: choresList
        };
      }

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

      await pool.query('UPDATE user_vaults SET vault_data = $1 WHERE username = $2', [JSON.stringify(currentVault), usernameParam]);
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
