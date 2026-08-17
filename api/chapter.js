import crypto from 'crypto';
import pkg from 'pg';
const { Pool } = pkg;

const CHAPTER_NPC_TICKETS = {
  'pumpkin pete': 2,
  'blacksmith': 2,
  'betty': 2,
  'grimtooth': 2,
  'corny': 2,
  'tango': 2,
  'miranda': 2,
  'raven': 2,
  'finn': 2,
  'findlay': 2,
  'tyreless timmy': 2,
  'greg': 2,
  'cornwell': 2,
  'buttercup': 2,
  'bert': 2,
  'timmy': 2,
  'misty': 2,
  'phobos': 2,
  'jester': 2,
  'craig': 2,
  'peggy': 2,
  'flint': 2
};

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function extractRewardTickets(rewardObj) {
  if (!rewardObj) return 0;
  if (typeof rewardObj === 'number') return rewardObj;
  if (rewardObj.tickets !== undefined) return Number(rewardObj.tickets) || 0;
  if (rewardObj['Seasonal Ticket'] !== undefined) return Number(rewardObj['Seasonal Ticket']) || 0;
  if (rewardObj['Chapter Ticket'] !== undefined) return Number(rewardObj['Chapter Ticket']) || 0;
  if (rewardObj.items) {
    if (rewardObj.items['Seasonal Ticket']) return Number(rewardObj.items['Seasonal Ticket']) || 0;
    if (rewardObj.items['Chapter Ticket']) return Number(rewardObj.items['Chapter Ticket']) || 0;
  }
  return 0;
}

function extractPricesRecursive(data) {
  const map = {};
  if (!data || typeof data !== 'object') return map;
  
  function traverse(obj) {
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === 'object') {
        if (typeof v.price === 'number') {
          map[k.toLowerCase().trim()] = v.price;
        } else if (typeof v.sfl === 'number') {
          map[k.toLowerCase().trim()] = v.sfl;
        }
        traverse(v);
      } else if (typeof v === 'number') {
        map[k.toLowerCase().trim()] = v;
      }
    }
  }
  traverse(data);
  return map;
}

function getItemUnitPrice(itemName, priceMap = {}) {
  if (!itemName) return 0;
  const clean = itemName.toLowerCase().trim();
  return priceMap[clean] || 0;
}

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

  if (!date || isNaN(date.getTime())) date = new Date();

  const day = date.getUTCDay();
  const utcDate = date.getUTCDate();
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  date.setUTCDate(utcDate + diffToMonday);
  return date.toISOString().split('T')[0];
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;
  const farmId = req.query.farmId || '8472883706403914';
  const apiKey = req.query.apiKey || process.env.SFL_API_KEY || '';

  try {
    // 1. Fetch User Vault
    if (action === 'getVault') {
      const username = (req.query.username || '').toLowerCase().trim();
      if (!username) return res.status(200).json({ vaultData: null });

      const client = await pool.connect();
      try {
        const queryRes = await client.query('SELECT vault_data FROM user_vaults WHERE username = $1', [username]);
        if (queryRes.rows.length > 0) {
          let vaultData = queryRes.rows[0].vault_data;
          delete vaultData.apiKey;
          return res.status(200).json({ success: true, vaultData });
        }
        return res.status(200).json({ vaultData: null });
      } finally {
        client.release();
      }
    }

    // 2. User Registration
    if (req.method === 'POST' && action === 'register') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const username = (body.username || '').toLowerCase().trim();
      const password = body.password || '';
      const userFarmId = body.farmId || farmId;

      if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

      const client = await pool.connect();
      try {
        const check = await client.query('SELECT username FROM user_vaults WHERE username = $1', [username]);
        if (check.rows.length > 0) return res.status(400).json({ error: 'Username already taken.' });

        const passwordHash = hashPassword(password);
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

        await client.query(
          'INSERT INTO user_vaults (username, auth_data, vault_data) VALUES ($1, $2, $3)',
          [username, JSON.stringify({ username, passwordHash }), JSON.stringify(initialVault)]
        );

        return res.status(200).json({ success: true, username, farmId: userFarmId });
      } finally {
        client.release();
      }
    }

    // 3. User Login
    if (req.method === 'POST' && action === 'login') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const username = (body.username || '').toLowerCase().trim();
      const password = body.password || '';
      const userFarmId = body.farmId;

      if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

      const client = await pool.connect();
      try {
        const queryRes = await client.query('SELECT auth_data, vault_data FROM user_vaults WHERE username = $1', [username]);
        if (queryRes.rows.length === 0) return res.status(401).json({ error: 'Account not found.' });

        const authData = queryRes.rows[0].auth_data;
        if (authData.passwordHash !== hashPassword(password)) return res.status(401).json({ error: 'Incorrect password.' });

        let vaultData = queryRes.rows[0].vault_data;
        if (userFarmId && !vaultData.farmId) {
          vaultData.farmId = userFarmId;
          await client.query('UPDATE user_vaults SET vault_data = $1 WHERE username = $2', [JSON.stringify(vaultData), username]);
        }

        delete vaultData.apiKey;
        return res.status(200).json({ success: true, username, vaultData });
      } finally {
        client.release();
      }
    }

    // 4. Save Vault
    if (req.method === 'POST' && action === 'saveVault') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const username = (body.username || '').toLowerCase().trim();
      if (!username) return res.status(401).json({ error: 'Not logged in.' });

      const client = await pool.connect();
      try {
        const queryRes = await client.query('SELECT vault_data FROM user_vaults WHERE username = $1', [username]);
        let existingData = queryRes.rows.length > 0 ? queryRes.rows[0].vault_data : {
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

        await client.query(
          'UPDATE user_vaults SET vault_data = $1 WHERE username = $2',
          [JSON.stringify(existingData), username]
        );

        return res.status(200).json({ success: true, vaultData: existingData });
      } finally {
        client.release();
      }
    }

    // 5. Live Sunflower Land API Data Fetch
    const sflHeaders = {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://sunflower-land.com/',
      'Origin': 'https://sunflower-land.com'
    };
    if (apiKey && apiKey.trim() !== '') sflHeaders['x-api-key'] = apiKey.trim();

    const [sflResponse, pricesResponse] = await Promise.all([
      fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { headers: sflHeaders }).catch(() => null),
      fetch(`https://sfl.world/api/v1/prices`, { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(() => null)
    ]);

    if (!sflResponse || !sflResponse.ok) {
      const status = sflResponse?.status || 500;
      return res.status(status).json({ error: status === 401 ? 'SFL API 401 Unauthorized.' : `SFL API error (${status}). Check Farm ID.` });
    }

    const payload = await sflResponse.json().catch(() => ({}));
    const farm = payload.farm || {};

    let priceMap = {};
    if (pricesResponse && pricesResponse.ok) {
      const rawPricesData = await pricesResponse.json().catch(() => null);
      if (rawPricesData) priceMap = extractPricesRecursive(rawPricesData);
    }

    const isVipActive = !!(farm.vip?.expiresAt && farm.vip.expiresAt > Date.now());

    // Milestones
    const rawMilestones = farm.delivery?.milestones || farm.milestones || {};
    const liveMilestones = {};
    Object.entries(rawMilestones).forEach(([npc, count]) => {
      const cleanName = npc.toLowerCase().trim();
      if (CHAPTER_NPC_TICKETS[cleanName] !== undefined) {
        liveMilestones[cleanName] = count;
      }
    });

    // Calendar & Double Deliveries
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

    // Deliveries
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
          itemDetails.push({ name: itemName, qty, unitPrice, lineCost });
        });

        const isCompleted = typeof order.completedAt === 'number' || order.status === 'completed' || order.completed === true;
        if (isCompleted) {
          npcOrderCounts[npcClean] = (npcOrderCounts[npcClean] || 0) + 1;
        }

        deliveryList.push({
          id: order.id,
          from: order.from,
          name: order.from,
          items: order.items || {},
          itemsCost,
          cost: itemsCost,
          itemDetails,
          baseTickets: totalTickets,
          tickets: totalTickets,
          isChapterNpc: CHAPTER_NPC_TICKETS[npcClean] !== undefined,
          completed: isCompleted,
          checked: isCompleted,
          completedAt: typeof order.completedAt === 'number' ? order.completedAt : (isCompleted ? Date.now() : null),
          isStacked: false
        });
      }
    });

    // Bounties
    const activeBounties = [];
    const seenBountyKeys = new Set();
    const completedBountiesRaw = farm.bounties?.completed || farm.bounties?.claimed || [];
    const completedMap = {};

    if (Array.isArray(completedBountiesRaw)) {
      completedBountiesRaw.forEach(b => {
        if (typeof b === 'object' && b.id) {
          const t = typeof b.completedAt === 'number' ? b.completedAt : (typeof b.claimedAt === 'number' ? b.claimedAt : null);
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
        tickets: baseTicketCount,
        cost: unitPrice,
        itemsCost: unitPrice,
        completed: isCompleted,
        checked: isCompleted,
        completedAt: completionTime,
        checkedToday: false
      });
    });

    // Chores
    const choreObj = farm.choreBoard?.chores || farm.chores || {};
    const choresList = Object.entries(choreObj).map(([key, details]) => {
      let baseTicketCount = extractRewardTickets(details.reward);
      if (baseTicketCount === 0) baseTicketCount = details.tickets || details.baseTickets || 1;
      const currentProgress = details.initialProgress ?? details.progress ?? 0;
      const requirement = details.requirement ?? details.target ?? details.total ?? 0;
      const isCompleted = typeof details.completedAt === 'number' || details.completed === true || details.isCompleted === true || (requirement > 0 && currentProgress >= requirement);
      const completionTime = typeof details.completedAt === 'number' ? details.completedAt : null;
      const taskLabel = details.name || details.description || key;

      return {
        npc: details.npc || details.from || 'Chore NPC',
        name: taskLabel,
        task: taskLabel,
        baseTickets: baseTicketCount,
        tickets: baseTicketCount,
        cost: 0,
        itemsCost: 0,
        progress: currentProgress,
        requirement,
        completed: isCompleted,
        checked: isCompleted,
        completedAt: completionTime,
        checkedToday: false
      };
    });

    // Auto-update logged in user vault snapshot if username provided
    const usernameParam = (req.query.username || '').toLowerCase().trim();
    let currentVault = null;

    if (usernameParam) {
      const client = await pool.connect();
      try {
        const queryRes = await client.query('SELECT vault_data FROM user_vaults WHERE username = $1', [usernameParam]);
        if (queryRes.rows.length > 0) {
          currentVault = queryRes.rows[0].vault_data;
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

          await client.query('UPDATE user_vaults SET vault_data = $1 WHERE username = $2', [JSON.stringify(currentVault), usernameParam]);
        }
      } finally {
        client.release();
      }
    }

    return res.status(200).json({
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
    return res.status(500).json({ error: `Server Error: ${err.message}` });
  }
}
