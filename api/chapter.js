import { pool, hashPassword } from './db.js';
import { 
  extractPricesRecursive, 
  getMondayBasedWeekId, 
  parseFarmData,
  CHAPTER_NPC_TICKETS 
} from './sfl-parser.js';

async function ensureTableExists(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_vaults (
      username VARCHAR(255) PRIMARY KEY,
      auth_data JSONB NOT NULL,
      vault_data JSONB NOT NULL
    );
  `);
}

export function reconcileDeliveriesWithNpcs(vault, parsedDeliveryList, currentNpcsData) {
  if (!vault.archiveDeliveries) vault.archiveDeliveries = [];
  if (!vault.npcSnapshots) vault.npcSnapshots = {};

  const currentWeekMonday = getMondayBasedWeekId();
  const nowMs = Date.now();
  const todayDateStr = new Date(nowMs).toISOString().split('T')[0];

  // 1. Reconcile NPC counters and state transitions for existing archive entries
  Object.entries(CHAPTER_NPC_TICKETS).forEach(([npcName, defaultTix]) => {
    const npcClean = npcName.toLowerCase().trim();
    const currStat = currentNpcsData[npcClean] || { deliveryCount: 0, skippedCount: 0, deliveryCompletedAt: null };
    const prevStat = vault.npcSnapshots[npcClean];

    if (prevStat) {
      const delivDelta = currStat.deliveryCount - prevStat.deliveryCount;
      const skipDelta = currStat.skippedCount - prevStat.skippedCount;

      // Find pending uncompleted/unskipped orders for this NPC in the persistent archive
      const activeOrders = vault.archiveDeliveries.filter(d => {
        const dNpc = (d.from || d.name || '').toLowerCase().trim();
        const isPending = !(d.checked !== undefined ? d.checked : Boolean(d.completed)) && !d.isSkipped;
        return dNpc === npcClean && isPending;
      });

      if (delivDelta > 0) {
        const completionTime = currStat.deliveryCompletedAt || nowMs;
        const compDate = new Date(completionTime).toISOString().split('T')[0];
        const compWeek = getMondayBasedWeekId(completionTime);

        // Mark previously pending board order as Completed (Ticked)
        if (activeOrders.length > 0) {
          const orderToComplete = activeOrders[0];
          orderToComplete.completed = true;
          orderToComplete.checked = true;
          orderToComplete.isSkipped = false;
          orderToComplete.status = 'completed';
          orderToComplete.completedAt = completionTime;
          orderToComplete.completedDate = compDate;
          orderToComplete.weekId = compWeek;
        }

        // If delivDelta >= 2, stacked orders were turned in back-to-back
        if (delivDelta >= 2) {
          for (let s = 1; s < delivDelta; s++) {
            const stackedId = `deliv_${npcClean}_stacked_d${prevStat.deliveryCount + s}`;
            const exists = vault.archiveDeliveries.some(d => d.id === stackedId);
            if (!exists) {
              vault.archiveDeliveries.push({
                id: stackedId,
                from: npcName,
                name: npcName,
                baseTickets: defaultTix,
                tickets: defaultTix,
                cost: 0,
                itemsCost: 0,
                itemDetails: [],
                items: {},
                completed: true,
                checked: true,
                isSkipped: false,
                isStacked: true,
                status: 'completed',
                completedAt: completionTime,
                completedDate: compDate,
                weekId: compWeek,
                isManual: false
              });
            }
          }
        }
      }

      if (skipDelta > 0) {
        if (activeOrders.length > 0) {
          const orderToSkip = activeOrders[0];
          orderToSkip.isSkipped = true;
          orderToSkip.completed = false;
          orderToSkip.checked = false;
          orderToSkip.status = 'skipped';
          orderToSkip.completedAt = nowMs;
          orderToSkip.completedDate = todayDateStr;
          orderToSkip.weekId = currentWeekMonday;
        }
      }
    }

    // Update snapshot baseline
    vault.npcSnapshots[npcClean] = {
      deliveryCount: currStat.deliveryCount,
      skippedCount: currStat.skippedCount,
      deliveryCompletedAt: currStat.deliveryCompletedAt
    };
  });

  // 2. Add / Update currently active board orders into vault.archiveDeliveries
  parsedDeliveryList.forEach(order => {
    const npcClean = (order.from || order.name || '').toLowerCase().trim();
    const currStat = currentNpcsData[npcClean] || { deliveryCount: 0, skippedCount: 0, deliveryCompletedAt: null };

    const orderUniqueId = order.id 
      ? `deliv_${order.id}` 
      : `deliv_${npcClean}_d${currStat.deliveryCount}_s${currStat.skippedCount}`;

    const isCompleted = order.completed || (typeof order.completedAt === 'number' && order.completedAt > 0);
    const compTime = order.completedAt || (isCompleted ? nowMs : null);
    const compDate = compTime ? new Date(compTime).toISOString().split('T')[0] : todayDateStr;
    const compWeek = compTime ? getMondayBasedWeekId(compTime) : currentWeekMonday;

    const existingIdx = vault.archiveDeliveries.findIndex(d => 
      d.id === orderUniqueId || 
      (order.id && d.id === `deliv_${order.id}`) ||
      ((d.from || d.name || '').toLowerCase().trim() === npcClean && 
       d.deliveryCountAtCreation === currStat.deliveryCount && 
       d.skippedCountAtCreation === currStat.skippedCount)
    );

    if (existingIdx !== -1) {
      const target = vault.archiveDeliveries[existingIdx];
      if (!target.isManual) {
        target.items = order.items || target.items;
        target.itemsCost = order.itemsCost || target.itemsCost;
        target.cost = order.itemsCost || target.cost;
        target.itemDetails = order.itemDetails || target.itemDetails;
        target.baseTickets = order.baseTickets || target.baseTickets;
        target.tickets = order.baseTickets || target.tickets;
        if (isCompleted && !target.completed) {
          target.completed = true;
          target.checked = true;
          target.isSkipped = false;
          target.status = 'completed';
          target.completedAt = compTime;
          target.completedDate = compDate;
          target.weekId = compWeek;
        }
      }
    } else {
      vault.archiveDeliveries.push({
        id: orderUniqueId,
        from: order.from,
        name: order.from,
        items: order.items || {},
        itemsCost: order.itemsCost || 0,
        cost: order.itemsCost || 0,
        itemDetails: order.itemDetails || [],
        baseTickets: order.baseTickets || 2,
        tickets: order.baseTickets || 2,
        isChapterNpc: true,
        completed: isCompleted,
        checked: isCompleted,
        isSkipped: false,
        isStacked: false,
        status: isCompleted ? 'completed' : 'active',
        completedAt: isCompleted ? compTime : null,
        completedDate: compDate,
        weekId: compWeek,
        deliveryCountAtCreation: currStat.deliveryCount,
        skippedCountAtCreation: currStat.skippedCount,
        isManual: false
      });
    }
  });

  vault.deliveries = parsedDeliveryList;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;
  const farmId = req.query.farmId || '8472883706403914';
  const apiKey = req.query.apiKey || process.env.SFL_API_KEY || '';
  
  const rawUsername = (req.query.username || '').trim();
  const username = rawUsername && rawUsername !== ':' ? rawUsername.toLowerCase().replace(/[^a-z0-9_]/g, '') : '';

  const sflHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://sunflower-land.com/',
    'Origin': 'https://sunflower-land.com'
  };
  if (apiKey && apiKey.trim() !== '') sflHeaders['x-api-key'] = apiKey.trim();

  // RAW SFL API PROXY
  if (action === 'rawSfl') {
    try {
      const response = await fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { headers: sflHeaders });
      const data = await response.json().catch(() => ({}));
      return res.status(response.status).json(data);
    } catch (err) {
      return res.status(500).json({ error: `Raw Proxy Error: ${err.message}` });
    }
  }

  // RAW PRICES PROXY
  if (action === 'rawPrices') {
    try {
      const response = await fetch(`https://sfl.world/api/v1/prices`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const data = await response.json().catch(() => ({}));
      return res.status(response.status).json(data);
    } catch (err) {
      return res.status(500).json({ error: `Prices Proxy Error: ${err.message}` });
    }
  }

  try {
    if (action === 'getVault') {
      if (!username) return res.status(200).json({ success: true, vaultData: null });
      let client;
      try {
        client = await pool.connect();
        await ensureTableExists(client);
        const queryRes = await client.query('SELECT vault_data FROM user_vaults WHERE username = $1', [username]);
        if (queryRes.rows.length > 0) {
          const vaultData = queryRes.rows[0].vault_data || {};
          delete vaultData.apiKey;
          return res.status(200).json({ success: true, vaultData });
        }
        return res.status(200).json({ success: true, vaultData: null });
      } catch (dbErr) {
        console.error('getVault DB error:', dbErr.message);
        return res.status(200).json({ success: true, vaultData: null });
      } finally {
        if (client) client.release();
      }
    }

    if (req.method === 'POST' && action === 'register') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const regUsername = (body.username || '').toLowerCase().replace(/[^a-z0-9_]/g, '').trim();
      const password = body.password || '';
      const userFarmId = body.farmId || farmId;

      if (!regUsername || !password) return res.status(400).json({ error: 'Valid alphanumeric username and password required.' });

      const client = await pool.connect();
      try {
        await ensureTableExists(client);
        const check = await client.query('SELECT username FROM user_vaults WHERE username = $1', [regUsername]);
        if (check.rows.length > 0) return res.status(400).json({ error: 'Username already taken.' });

        const passwordHash = hashPassword(password);
        const initialVault = {
          farmId: userFarmId,
          archiveDeliveries: [],
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
          milestones: {},
          npcSnapshots: {}
        };

        await client.query(
          'INSERT INTO user_vaults (username, auth_data, vault_data) VALUES ($1, $2, $3)',
          [regUsername, JSON.stringify({ username: regUsername, passwordHash }), JSON.stringify(initialVault)]
        );

        return res.status(200).json({ success: true, username: regUsername, farmId: userFarmId });
      } finally {
        client.release();
      }
    }

    if (req.method === 'POST' && action === 'login') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const loginUsername = (body.username || '').toLowerCase().replace(/[^a-z0-9_]/g, '').trim();
      const password = body.password || '';
      const userFarmId = body.farmId;

      if (!loginUsername || !password) return res.status(400).json({ error: 'Username and password required.' });

      const client = await pool.connect();
      try {
        await ensureTableExists(client);
        const queryRes = await client.query('SELECT auth_data, vault_data FROM user_vaults WHERE username = $1', [loginUsername]);
        if (queryRes.rows.length === 0) return res.status(401).json({ error: 'Account not found.' });

        const authData = queryRes.rows[0].auth_data;
        if (authData.passwordHash !== hashPassword(password)) return res.status(401).json({ error: 'Incorrect password.' });

        const vaultData = queryRes.rows[0].vault_data || {};
        if (userFarmId && !vaultData.farmId) {
          vaultData.farmId = userFarmId;
          await client.query('UPDATE user_vaults SET vault_data = $1 WHERE username = $2', [JSON.stringify(vaultData), loginUsername]);
        }

        delete vaultData.apiKey;
        return res.status(200).json({ success: true, username: loginUsername, vaultData });
      } finally {
        client.release();
      }
    }

    if (req.method === 'POST' && action === 'saveVault') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const saveUsername = (body.username || '').toLowerCase().replace(/[^a-z0-9_]/g, '').trim();
      if (!saveUsername) return res.status(401).json({ error: 'Not logged in.' });

      const client = await pool.connect();
      try {
        await ensureTableExists(client);
        const queryRes = await client.query('SELECT vault_data FROM user_vaults WHERE username = $1', [saveUsername]);
        let existingData = queryRes.rows.length > 0 ? queryRes.rows[0].vault_data : {
          archiveDeliveries: [],
          cumulativeTickets: 0,
          cumulativeCost: 0,
          weeks: {},
          trackTickets: 0,
          trackCost: 0,
          dailyLoginTickets: 0,
          lastDailyLoginDate: null,
          milestones: {},
          npcSnapshots: {}
        };

        if (body.farmId) existingData.farmId = body.farmId;
        if (body.trackTickets !== undefined) existingData.trackTickets = parseInt(body.trackTickets, 10) || 0;
        if (body.trackCost !== undefined) existingData.trackCost = parseFloat(body.trackCost) || 0;
        if (body.dailyLoginTickets !== undefined) existingData.dailyLoginTickets = parseInt(body.dailyLoginTickets, 10) || 0;
        if (body.lastDailyLoginDate) existingData.lastDailyLoginDate = body.lastDailyLoginDate;
        if (body.cumulativeTickets !== undefined) existingData.cumulativeTickets = parseInt(body.cumulativeTickets, 10) || 0;
        if (body.cumulativeCost !== undefined) existingData.cumulativeCost = parseFloat(body.cumulativeCost) || 0;

        if (body.weeks && typeof body.weeks === 'object') existingData.weeks = body.weeks;
        if (body.deliveries) existingData.deliveries = body.deliveries;
        if (body.archiveDeliveries) existingData.archiveDeliveries = body.archiveDeliveries;
        if (body.bounties) existingData.bounties = body.bounties;
        if (body.chores) existingData.chores = body.chores;
        if (body.milestones) existingData.milestones = body.milestones;
        if (body.npcSnapshots) existingData.npcSnapshots = body.npcSnapshots;

        await client.query('UPDATE user_vaults SET vault_data = $1 WHERE username = $2', [JSON.stringify(existingData), saveUsername]);
        return res.status(200).json({ success: true, vaultData: existingData });
      } finally {
        client.release();
      }
    }

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

    const parsed = parseFarmData(farm, priceMap);
    let currentVault = null;

    if (username) {
      let client;
      try {
        client = await pool.connect();
        await ensureTableExists(client);
        const queryRes = await client.query('SELECT vault_data FROM user_vaults WHERE username = $1', [username]);
        if (queryRes.rows.length > 0) {
          currentVault = queryRes.rows[0].vault_data || {};
          const currentWeekMonday = getMondayBasedWeekId();
          currentVault.farmId = farmId;

          // Reconcile and permanently store deliveries into archiveDeliveries
          reconcileDeliveriesWithNpcs(currentVault, parsed.deliveryList, parsed.npcsData);

          const existingManualBounties = (currentVault.bounties || []).filter(b => b.isManual);
          currentVault.bounties = [...parsed.activeBounties, ...existingManualBounties];

          const existingManualChores = (currentVault.chores || []).filter(c => c.isManual);
          currentVault.chores = [...parsed.choresList, ...existingManualChores];

          currentVault.milestones = parsed.liveMilestones;

          if (!currentVault.weeks) currentVault.weeks = {};
          if (!currentVault.weeks[currentWeekMonday]) {
            currentVault.weeks[currentWeekMonday] = {
              weekId: currentWeekMonday,
              bounties: currentVault.bounties,
              chores: currentVault.chores
            };
          } else {
            const savedWeekManualChores = (currentVault.weeks[currentWeekMonday].chores || []).filter(c => c.isManual);
            const savedWeekManualBounties = (currentVault.weeks[currentWeekMonday].bounties || []).filter(b => b.isManual);
            currentVault.weeks[currentWeekMonday].chores = [...parsed.choresList, ...savedWeekManualChores];
            currentVault.weeks[currentWeekMonday].bounties = [...parsed.activeBounties, ...savedWeekManualBounties];
          }

          await client.query('UPDATE user_vaults SET vault_data = $1 WHERE username = $2', [JSON.stringify(currentVault), username]);
        }
      } catch (vaultErr) {
        console.error('Vault update error:', vaultErr.message);
      } finally {
        if (client) client.release();
      }
    }

    return res.status(200).json({
      farmId,
      isVipActive: parsed.isVipActive,
      isDoubleDeliveryActive: parsed.isDoubleDeliveryActive,
      milestones: parsed.liveMilestones,
      pricesLoadedCount: Object.keys(priceMap).length,
      deliveries: currentVault ? currentVault.deliveries : parsed.deliveryList,
      archiveDeliveries: currentVault ? currentVault.archiveDeliveries : parsed.deliveryList,
      bounties: currentVault ? currentVault.bounties : parsed.activeBounties,
      chores: currentVault ? currentVault.chores : parsed.choresList,
      vaultData: currentVault
    });
  } catch (err) {
    return res.status(500).json({ error: `Server Error: ${err.message}` });
  }
}
