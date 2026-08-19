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

function sanitizeDeliveriesList(deliveries) {
  if (!Array.isArray(deliveries)) return [];
  const seen = new Map();

  const sorted = [...deliveries].sort((a, b) => {
    const aDone = Boolean(a.checked || a.completed);
    const bDone = Boolean(b.checked || b.completed);
    if (aDone !== bDone) return aDone ? -1 : 1;
    return (b.completedAt || 0) - (a.completedAt || 0);
  });

  for (const d of sorted) {
    if (!d) continue;
    const npc = (d.from || d.name || '').toLowerCase().trim();
    if (!npc) continue;

    const isMan = Boolean(d.isManual);
    const isDone = Boolean(d.checked !== undefined ? d.checked : d.completed) && !d.isSkipped;
    const isSkip = Boolean(d.isSkipped);

    let canonicalId = d.id || '';

    if (isMan) {
      canonicalId = (d.id && d.id.startsWith('manual_')) ? d.id : `manual_${npc}_${d.completedAt || d.completedDate || Date.now()}`;
    } else if (isDone) {
      const count = d.deliveryCountAtCreation;
      const compTime = d.completedAt ? Math.floor(Number(d.completedAt) / 60000) : (d.completedDate || d.weekId || 'done');
      canonicalId = (count !== undefined && count !== null && count !== '') 
        ? `npc_deliv_${npc}_d${count}` 
        : `npc_deliv_${npc}_${compTime}`;
    } else if (isSkip) {
      const skipCount = d.skippedCountAtCreation;
      const compTime = d.completedDate || d.weekId || 'skip';
      canonicalId = (skipCount !== undefined && skipCount !== null && skipCount !== '') 
        ? `npc_deliv_${npc}_skip_${skipCount}` 
        : `npc_deliv_${npc}_skip_${compTime}`;
    } else {
      canonicalId = `npc_deliv_${npc}_active`;
    }

    d.id = canonicalId;

    if (!seen.has(canonicalId)) {
      seen.set(canonicalId, d);
    } else {
      const existing = seen.get(canonicalId);
      if ((!existing.itemDetails || existing.itemDetails.length === 0) && d.itemDetails && d.itemDetails.length > 0) {
        existing.itemDetails = d.itemDetails;
        existing.items = d.items;
        existing.itemsCost = d.itemsCost;
        existing.cost = d.cost;
      }
      if (d.completed && !existing.completed) {
        existing.completed = true;
        existing.checked = true;
        existing.status = 'completed';
        existing.completedAt = d.completedAt || existing.completedAt;
      }
    }
  }

  return Array.from(seen.values());
}

export function reconcileDeliveriesWithNpcs(vault, parsedDeliveryList, currentNpcsData) {
  if (!vault.archiveDeliveries) vault.archiveDeliveries = [];
  if (!vault.npcSnapshots) vault.npcSnapshots = {};

  const currentWeekMonday = getMondayBasedWeekId();
  const nowMs = Date.now();
  const todayDateStr = new Date(nowMs).toISOString().split('T')[0];

  // 1. Sanitize past database records to eliminate any legacy duplicates
  vault.archiveDeliveries = sanitizeDeliveriesList(vault.archiveDeliveries);

  // 2. Reconcile Deltas using NPC Lifetime Counters
  Object.entries(CHAPTER_NPC_TICKETS).forEach(([npcName, defaultTix]) => {
    const npcClean = npcName.toLowerCase().trim();
    const currStat = currentNpcsData[npcClean] || { deliveryCount: 0, skippedCount: 0, deliveryCompletedAt: null };
    const prevStat = vault.npcSnapshots[npcClean];

    if (prevStat) {
      const delivDelta = currStat.deliveryCount - prevStat.deliveryCount;
      const skipDelta = currStat.skippedCount - prevStat.skippedCount;

      if (delivDelta > 0) {
        const completionTime = currStat.deliveryCompletedAt || nowMs;
        const compDate = new Date(completionTime).toISOString().split('T')[0];
        const compWeek = getMondayBasedWeekId(completionTime);

        for (let k = 1; k <= delivDelta; k++) {
          const completedCountIndex = prevStat.deliveryCount + k;
          const targetOrderId = `npc_deliv_${npcClean}_d${completedCountIndex}`;
          const isStacked = k > 1;

          // Find active pending order to mark complete
          const existingPendingIdx = vault.archiveDeliveries.findIndex(d => {
            const dNpc = (d.from || d.name || '').toLowerCase().trim();
            const isPending = !(d.checked !== undefined ? d.checked : Boolean(d.completed)) && !d.isSkipped;
            return dNpc === npcClean && (isPending || d.id === targetOrderId || d.id === `npc_deliv_${npcClean}_active`);
          });

          if (existingPendingIdx !== -1) {
            const orderToComplete = vault.archiveDeliveries[existingPendingIdx];
            orderToComplete.id = targetOrderId;
            orderToComplete.completed = true;
            orderToComplete.checked = true;
            orderToComplete.isSkipped = false;
            orderToComplete.status = 'completed';
            orderToComplete.completedAt = completionTime;
            orderToComplete.completedDate = compDate;
            orderToComplete.weekId = compWeek;
            orderToComplete.deliveryCountAtCreation = completedCountIndex;
          } else {
            vault.archiveDeliveries.push({
              id: targetOrderId,
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
              isStacked,
              status: 'completed',
              completedAt: completionTime,
              completedDate: compDate,
              weekId: compWeek,
              deliveryCountAtCreation: completedCountIndex,
              isManual: false
            });
          }
        }
      }

      if (skipDelta > 0) {
        const pendingIdx = vault.archiveDeliveries.findIndex(d => {
          const dNpc = (d.from || d.name || '').toLowerCase().trim();
          const isPending = !(d.checked !== undefined ? d.checked : Boolean(d.completed)) && !d.isSkipped;
          return dNpc === npcClean && (isPending || d.id === `npc_deliv_${npcClean}_active`);
        });

        if (pendingIdx !== -1) {
          const orderToSkip = vault.archiveDeliveries[pendingIdx];
          orderToSkip.id = `npc_deliv_${npcClean}_skip_${prevStat.skippedCount + 1}`;
          orderToSkip.isSkipped = true;
          orderToSkip.completed = false;
          orderToSkip.checked = false;
          orderToSkip.status = 'skipped';
          orderToSkip.completedAt = nowMs;
          orderToSkip.completedDate = todayDateStr;
          orderToSkip.weekId = currentWeekMonday;
          orderToSkip.skippedCountAtCreation = prevStat.skippedCount + 1;
        }
      }
    }

    // Save baseline snapshot
    vault.npcSnapshots[npcClean] = {
      deliveryCount: currStat.deliveryCount,
      skippedCount: currStat.skippedCount,
      deliveryCompletedAt: currStat.deliveryCompletedAt
    };
  });

  // 3. Register or update the currently active order from board (1 active order per NPC)
  parsedDeliveryList.forEach(order => {
    const npcClean = (order.from || order.name || '').toLowerCase().trim();
    const currStat = currentNpcsData[npcClean] || { deliveryCount: 0, skippedCount: 0, deliveryCompletedAt: null };
    const nextTargetCount = currStat.deliveryCount + 1;
    const activeOrderId = `npc_deliv_${npcClean}_active`;

    const existingIdx = vault.archiveDeliveries.findIndex(d => d.id === activeOrderId);

    if (existingIdx !== -1) {
      const target = vault.archiveDeliveries[existingIdx];
      if (!target.isManual && !target.completed) {
        target.items = order.items || target.items;
        target.itemsCost = order.itemsCost || target.itemsCost;
        target.cost = order.itemsCost || target.cost;
        target.itemDetails = order.itemDetails || target.itemDetails;
        target.baseTickets = order.baseTickets || target.baseTickets;
        target.tickets = order.baseTickets || target.tickets;
        target.deliveryCountAtCreation = nextTargetCount;
        target.skippedCountAtCreation = currStat.skippedCount;
      }
    } else {
      vault.archiveDeliveries.push({
        id: activeOrderId,
        from: order.from,
        name: order.from,
        items: order.items || {},
        itemsCost: order.itemsCost || 0,
        cost: order.itemsCost || 0,
        itemDetails: order.itemDetails || [],
        baseTickets: order.baseTickets || 2,
        tickets: order.baseTickets || 2,
        isChapterNpc: true,
        completed: false,
        checked: false,
        isSkipped: false,
        isStacked: false,
        status: 'active',
        completedAt: null,
        completedDate: todayDateStr,
        weekId: currentWeekMonday,
        deliveryCountAtCreation: nextTargetCount,
        skippedCountAtCreation: currStat.skippedCount,
        isManual: false
      });
    }
  });

  vault.archiveDeliveries = sanitizeDeliveriesList(vault.archiveDeliveries);
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
          if (vaultData.archiveDeliveries) {
            vaultData.archiveDeliveries = sanitizeDeliveriesList(vaultData.archiveDeliveries);
          }
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
        if (vaultData.archiveDeliveries) {
          vaultData.archiveDeliveries = sanitizeDeliveriesList(vaultData.archiveDeliveries);
        }
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
        if (body.archiveDeliveries) existingData.archiveDeliveries = sanitizeDeliveriesList(body.archiveDeliveries);
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

    const cleanArchive = sanitizeDeliveriesList(currentVault ? currentVault.archiveDeliveries : parsed.deliveryList);

    return res.status(200).json({
      farmId,
      isVipActive: parsed.isVipActive,
      isDoubleDeliveryActive: parsed.isDoubleDeliveryActive,
      milestones: parsed.liveMilestones,
      pricesLoadedCount: Object.keys(priceMap).length,
      deliveries: parsed.deliveryList,
      archiveDeliveries: cleanArchive,
      bounties: currentVault ? currentVault.bounties : parsed.activeBounties,
      chores: currentVault ? currentVault.chores : parsed.choresList,
      vaultData: currentVault
    });
  } catch (err) {
    return res.status(500).json({ error: `Server Error: ${err.message}` });
  }
}
