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

export function sanitizeDeliveriesList(deliveries) {
  if (!Array.isArray(deliveries)) return [];
  const map = new Map();

  const sorted = [...deliveries].sort((a, b) => {
    const aDone = Boolean(a.checked !== undefined ? a.checked : a.completed);
    const bDone = Boolean(b.checked !== undefined ? b.checked : b.completed);
    if (aDone !== bDone) return aDone ? -1 : 1;
    return (b.itemsCost || b.cost || 0) - (a.itemsCost || a.cost || 0);
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
      if (d.id && d.id.startsWith(`deliv_${npc}_d`)) {
        canonicalId = d.id;
      } else {
        const count = d.deliveryCountAtCreation;
        canonicalId = (count !== undefined && count !== null && count !== '') 
          ? `deliv_${npc}_d${count}` 
          : `deliv_${npc}_d${d.completedAt || d.completedDate || '1'}`;
      }
      d.completed = true;
      d.checked = true;
      d.isSkipped = false;
      d.status = 'completed';
    } else if (isSkip) {
      if (d.id && d.id.startsWith(`deliv_${npc}_skip_`)) {
        canonicalId = d.id;
      } else {
        const skipCount = d.skippedCountAtCreation;
        canonicalId = `deliv_${npc}_skip_${skipCount || d.completedDate || '1'}`;
      }
      d.completed = false;
      d.checked = false;
      d.isSkipped = true;
      d.status = 'skipped';
    } else {
      canonicalId = `deliv_${npc}_active`;
      d.completed = false;
      d.checked = false;
      d.isSkipped = false;
      d.status = 'active';
    }

    d.id = canonicalId;

    if (!map.has(canonicalId)) {
      map.set(canonicalId, d);
    } else {
      const existing = map.get(canonicalId);
      if ((!existing.itemDetails || existing.itemDetails.length === 0) && d.itemDetails && d.itemDetails.length > 0) {
        existing.itemDetails = d.itemDetails;
        existing.items = d.items;
        existing.itemsCost = d.itemsCost;
        existing.cost = d.cost;
      }
    }
  }

  return Array.from(map.values());
}

export function reconcileDeliveriesWithNpcs(vault, parsedDeliveryList, currentNpcsData) {
  if (!vault.archiveDeliveries) vault.archiveDeliveries = [];
  if (!vault.npcSnapshots) vault.npcSnapshots = {};

  const currentWeekMonday = getMondayBasedWeekId();
  const nowMs = Date.now();
  const todayDateStr = new Date(nowMs).toISOString().split('T')[0];

  // 1. Sanitize past database records
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
          const targetOrderId = `deliv_${npcClean}_d${completedCountIndex}`;
          const isStacked = k > 1;

          const existingPendingIdx = vault.archiveDeliveries.findIndex(d => {
            const dNpc = (d.from || d.name || '').toLowerCase().trim();
            const isPending = !(d.checked !== undefined ? d.checked : Boolean(d.completed)) && !d.isSkipped && !d.isManual;
            return dNpc === npcClean && (isPending || d.id === `deliv_${npcClean}_active` || d.id === targetOrderId);
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
            const alreadyExists = vault.archiveDeliveries.some(d => d.id === targetOrderId);
            if (!alreadyExists) {
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
      }

      if (skipDelta > 0) {
        const pendingIdx = vault.archiveDeliveries.findIndex(d => {
          const dNpc = (d.from || d.name || '').toLowerCase().trim();
          const isPending = !(d.checked !== undefined ? d.checked : Boolean(d.completed)) && !d.isSkipped && !d.isManual;
          return dNpc === npcClean && (isPending || d.id === `deliv_${npcClean}_active`);
        });

        if (pendingIdx !== -1) {
          const orderToSkip = vault.archiveDeliveries[pendingIdx];
          orderToSkip.id = `deliv_${npcClean}_skip_${prevStat.skippedCount + 1}`;
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

    vault.npcSnapshots[npcClean] = {
      deliveryCount: currStat.deliveryCount,
      skippedCount: currStat.skippedCount,
      deliveryCompletedAt: currStat.deliveryCompletedAt
    };
  });

  // 3. Register or update the currently active order from board
  parsedDeliveryList.forEach(order => {
    const npcClean = (order.from || order.name || '').toLowerCase().trim();
    const currStat = currentNpcsData[npcClean] || { deliveryCount: 0, skippedCount: 0, deliveryCompletedAt: null };

    if (order.completed) {
      const targetDoneId = `deliv_${npcClean}_d${currStat.deliveryCount}`;
      const compTime = order.completedAt || currStat.deliveryCompletedAt || nowMs;
      const compDate = new Date(compTime).toISOString().split('T')[0];
      const compWeek = getMondayBasedWeekId(compTime);

      const activeIdx = vault.archiveDeliveries.findIndex(d => {
        const dNpc = (d.from || d.name || '').toLowerCase().trim();
        const isPending = !(d.checked !== undefined ? d.checked : Boolean(d.completed)) && !d.isSkipped && !d.isManual;
        return dNpc === npcClean && (isPending || d.id === `deliv_${npcClean}_active`);
      });

      if (activeIdx !== -1) {
        const target = vault.archiveDeliveries[activeIdx];
        target.id = targetDoneId;
        target.completed = true;
        target.checked = true;
        target.isSkipped = false;
        target.status = 'completed';
        target.completedAt = compTime;
        target.completedDate = compDate;
        target.weekId = compWeek;
        target.deliveryCountAtCreation = currStat.deliveryCount;
        target.items = order.items || target.items;
        target.itemsCost = order.itemsCost || target.itemsCost;
        target.cost = order.itemsCost || target.cost;
        target.itemDetails = order.itemDetails || target.itemDetails;
        target.baseTickets = order.baseTickets || target.baseTickets;
        target.tickets = order.baseTickets || target.tickets;
      } else {
        const doneIdx = vault.archiveDeliveries.findIndex(d => d.id === targetDoneId);
        if (doneIdx !== -1) {
          const target = vault.archiveDeliveries[doneIdx];
          target.completed = true;
          target.checked = true;
          target.isSkipped = false;
          target.status = 'completed';
          target.completedAt = compTime;
          target.completedDate = compDate;
          target.weekId = compWeek;
          target.items = order.items || target.items;
          target.itemsCost = order.itemsCost || target.itemsCost;
          target.cost = order.itemsCost || target.cost;
          target.itemDetails = order.itemDetails || target.itemDetails;
          target.baseTickets = order.baseTickets || target.baseTickets;
          target.tickets = order.baseTickets || target.tickets;
        } else {
          vault.archiveDeliveries.push({
            id: targetDoneId,
            from: order.from,
            name: order.from,
            items: order.items || {},
            itemsCost: order.itemsCost || 0,
            cost: order.itemsCost || 0,
            itemDetails: order.itemDetails || [],
            baseTickets: order.baseTickets || 2,
            tickets: order.baseTickets || 2,
            isChapterNpc: true,
            completed: true,
            checked: true,
            isSkipped: false,
            isStacked: false,
            status: 'completed',
            completedAt: compTime,
            completedDate: compDate,
            weekId: compWeek,
            deliveryCountAtCreation: currStat.deliveryCount,
            skippedCountAtCreation: currStat.skippedCount,
            isManual: false
          });
        }
      }
    } else {
      const activeOrderId = `deliv_${npcClean}_active`;
      const nextTargetCount = currStat.deliveryCount + 1;

      const existingIdx = vault.archiveDeliveries.findIndex(d => d.id === activeOrderId && !d.isManual);

      if (existingIdx !== -1) {
        const target = vault.archiveDeliveries[existingIdx];
        if (!target.completed) {
          target.items = order.items || target.items;
          target.itemsCost = order.itemsCost || target.itemsCost;
          target.cost = order.itemsCost || target.cost;
          target.itemDetails = order.itemDetails || target.itemDetails;
          target.baseTickets = order.baseTickets || target.baseTickets;
          target.tickets = order.baseTickets || target.tickets;
          target.deliveryCountAtCreation = nextTargetCount;
          target.skippedCountAtCreation = currStat.skippedCount;
          target.completed = false;
          target.checked = false;
          target.isSkipped = false;
          target.status = 'active';
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
    }
  });

  return vault.archiveDeliveries;
}

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const action = searchParams.get('action') || (req.query && req.query.action);

  let client;
  try {
    client = await pool.connect();
    await ensureTableExists(client);

    // ==========================================
    // ACTION: REGISTER
    // ==========================================
    if (action === 'register' && req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { username, password, farmId } = body || {};

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }

      const cleanUser = username.trim().toLowerCase();
      const existing = await client.query('SELECT username FROM user_vaults WHERE username = $1', [cleanUser]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Username already exists. Please login instead.' });
      }

      const passwordHash = hashPassword(password);
      const authData = { passwordHash, createdAt: new Date().toISOString() };
      const vaultData = {
        farmId: farmId || '8472883706403914',
        trackTickets: 0,
        trackCost: 0,
        dailyLoginTickets: 0,
        lastDailyLoginDate: null,
        weeks: {},
        logs: [],
        archiveDeliveries: [],
        archiveBounties: [],
        archiveChores: [],
        npcSnapshots: {}
      };

      await client.query(
        'INSERT INTO user_vaults (username, auth_data, vault_data) VALUES ($1, $2, $3)',
        [cleanUser, JSON.stringify(authData), JSON.stringify(vaultData)]
      );

      return res.status(200).json({ success: true, username: cleanUser, message: 'Registered successfully.' });
    }

    // ==========================================
    // ACTION: LOGIN
    // ==========================================
    if (action === 'login' && req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { username, password } = body || {};

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }

      const cleanUser = username.trim().toLowerCase();
      const userRes = await client.query('SELECT auth_data, vault_data FROM user_vaults WHERE username = $1', [cleanUser]);
      if (userRes.rows.length === 0) {
        return res.status(404).json({ error: 'Account not found. Please register first.' });
      }

      const authData = typeof userRes.rows[0].auth_data === 'string' 
        ? JSON.parse(userRes.rows[0].auth_data) 
        : userRes.rows[0].auth_data;

      const passwordHash = hashPassword(password);
      if (authData.passwordHash !== passwordHash) {
        return res.status(401).json({ error: 'Invalid password.' });
      }

      const vaultData = typeof userRes.rows[0].vault_data === 'string'
        ? JSON.parse(userRes.rows[0].vault_data)
        : userRes.rows[0].vault_data;

      return res.status(200).json({ success: true, username: cleanUser, vaultData });
    }

    // ==========================================
    // ACTION: GET VAULT
    // ==========================================
    if (action === 'getVault') {
      const username = searchParams.get('username') || (req.query && req.query.username);
      if (!username) {
        return res.status(400).json({ error: 'Username required.' });
      }

      const cleanUser = username.trim().toLowerCase();
      const userRes = await client.query('SELECT vault_data FROM user_vaults WHERE username = $1', [cleanUser]);
      if (userRes.rows.length === 0) {
        return res.status(404).json({ error: 'User vault not found.' });
      }

      const vaultData = typeof userRes.rows[0].vault_data === 'string'
        ? JSON.parse(userRes.rows[0].vault_data)
        : userRes.rows[0].vault_data;

      return res.status(200).json({ success: true, vaultData });
    }

    // ==========================================
    // ACTION: SAVE VAULT (Preserves log history)
    // ==========================================
    if (action === 'saveVault' && req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { username } = body || {};

      if (!username) {
        return res.status(400).json({ error: 'Username required to save vault.' });
      }

      const cleanUser = username.trim().toLowerCase();
      const userRes = await client.query('SELECT vault_data FROM user_vaults WHERE username = $1', [cleanUser]);
      if (userRes.rows.length === 0) {
        return res.status(404).json({ error: 'User vault not found.' });
      }

      const existingVault = typeof userRes.rows[0].vault_data === 'string'
        ? JSON.parse(userRes.rows[0].vault_data)
        : userRes.rows[0].vault_data;

      // Preserve log history (merge today's log without wiping past logs)
      const incomingLogs = Array.isArray(body.logs) ? body.logs : [];
      const pastLogs = Array.isArray(existingVault.logs) ? existingVault.logs : [];
      
      let mergedLogs = [...incomingLogs];
      pastLogs.forEach(pl => {
        if (!mergedLogs.some(ml => ml.date === pl.date)) {
          mergedLogs.push(pl);
        }
      });
      mergedLogs = mergedLogs.slice(0, 60);

      const updatedVault = {
        ...existingVault,
        ...body,
        logs: mergedLogs,
        lastSavedAt: new Date().toISOString()
      };

      await client.query(
        'UPDATE user_vaults SET vault_data = $1 WHERE username = $2',
        [JSON.stringify(updatedVault), cleanUser]
      );

      return res.status(200).json({ success: true, vaultData: updatedVault });
    }

    // ==========================================
    // ACTION: DELETE LOG
    // ==========================================
    if (action === 'deleteLog' && req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { username, logIdx } = body || {};

      if (!username || logIdx === undefined) {
        return res.status(400).json({ error: 'Username and logIdx required.' });
      }

      const cleanUser = username.trim().toLowerCase();
      const userRes = await client.query('SELECT vault_data FROM user_vaults WHERE username = $1', [cleanUser]);
      if (userRes.rows.length === 0) {
        return res.status(404).json({ error: 'User vault not found.' });
      }

      const vaultData = typeof userRes.rows[0].vault_data === 'string'
        ? JSON.parse(userRes.rows[0].vault_data)
        : userRes.rows[0].vault_data;

      if (Array.isArray(vaultData.logs) && vaultData.logs[logIdx]) {
        vaultData.logs.splice(logIdx, 1);
      }

      await client.query(
        'UPDATE user_vaults SET vault_data = $1 WHERE username = $2',
        [JSON.stringify(vaultData), cleanUser]
      );

      return res.status(200).json({ success: true, vaultData });
    }

    // ==========================================
    // DEFAULT: FETCH SFL FARM & MERGE WITH VAULT
    // ==========================================
    const farmId = searchParams.get('farmId') || (req.query && req.query.farmId) || '8472883706403914';
    const apiKey = searchParams.get('apiKey') || (req.query && req.query.apiKey) || process.env.SFL_API_KEY || '';
    const username = searchParams.get('username') || (req.query && req.query.username) || '';

    let priceMap = {};
    try {
      const pricesRes = await fetch('https://sfl.world/api/v1/prices', { 
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(8000)
      });
      if (pricesRes.ok) {
        const rawPricesData = await pricesRes.json();
        if (rawPricesData) priceMap = extractPricesRecursive(rawPricesData);
      }
    } catch (e) {
      console.warn('Live price fetch warning:', e.message);
    }

    const sflHeaders = {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://sunflower-land.com/',
      'Origin': 'https://sunflower-land.com'
    };
    if (apiKey) sflHeaders['x-api-key'] = apiKey;

    const sflRes = await fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { 
      headers: sflHeaders,
      signal: AbortSignal.timeout(10000)
    });

    if (!sflRes.ok) {
      if (sflRes.status === 429) {
        return res.status(429).json({
          error: '⏳ Rate limit reached. Sunflower Land is blocking too many requests. Please wait 1–2 minutes before fetching again, or enter an SFL API Key for a higher quota.'
        });
      }
      if (sflRes.status === 503 || sflRes.status === 502) {
        return res.status(503).json({
          error: '🔧 Sunflower Land servers are temporarily unavailable (maintenance). Please try again in a few minutes.'
        });
      }
      throw new Error(`Sunflower Land API responded with status ${sflRes.status}`);
    }

    const payload = await sflRes.json();
    const farm = payload.farm || payload;
    const parsed = parseFarmData(farm, priceMap);

    let userVault = null;
    if (username) {
      const cleanUser = username.trim().toLowerCase();
      const uRes = await client.query('SELECT vault_data FROM user_vaults WHERE username = $1', [cleanUser]);
      if (uRes.rows.length > 0) {
        userVault = typeof uRes.rows[0].vault_data === 'string' ? JSON.parse(uRes.rows[0].vault_data) : uRes.rows[0].vault_data;
        reconcileDeliveriesWithNpcs(userVault, parsed.deliveryList, parsed.npcsData);

        const currentWeekMonday = getMondayBasedWeekId(new Date());
        if (!userVault.weeks) userVault.weeks = {};
        if (!userVault.weeks[currentWeekMonday]) {
          userVault.weeks[currentWeekMonday] = {
            weekId: currentWeekMonday,
            bounties: parsed.activeBounties || [],
            chores: parsed.choresList || []
          };
        } else {
          const currentWk = userVault.weeks[currentWeekMonday];
          const savedManualChores = (currentWk.chores || []).filter(c => c.isManual);
          const savedManualBounties = (currentWk.bounties || []).filter(b => b.isManual);

          currentWk.chores = [...(parsed.choresList || []), ...savedManualChores];
          currentWk.bounties = [...(parsed.activeBounties || []), ...savedManualBounties];
        }

        // Populate completed past-week bounties from SFL into their historical week bucket
        (parsed.activeBounties || []).forEach(b => {
          if (b.completed && b.completedDate) {
            const bWeekId = getMondayBasedWeekId(b.completedDate);
            if (bWeekId && bWeekId !== currentWeekMonday) {
              if (!userVault.weeks[bWeekId]) {
                userVault.weeks[bWeekId] = { weekId: bWeekId, bounties: [], chores: [] };
              }
              const exists = (userVault.weeks[bWeekId].bounties || []).some(eb => eb.id === b.id);
              if (!exists) {
                userVault.weeks[bWeekId].bounties.push(b);
              }
            }
          }
        });

        await client.query(
          'UPDATE user_vaults SET vault_data = $1 WHERE username = $2',
          [JSON.stringify(userVault), cleanUser]
        );
      }
    }

    return res.status(200).json({
      success: true,
      farmId,
      pricesLoadedCount: Object.keys(priceMap).length,
      isVipActive: parsed.isVipActive,
      isDoubleDeliveryActive: parsed.isDoubleDeliveryActive,
      doubleDeliveryDates: parsed.doubleDeliveryDates,
      milestones: parsed.liveMilestones,
      deliveries: parsed.deliveryList,
      archiveDeliveries: userVault ? (userVault.archiveDeliveries || []) : [],
      bounties: parsed.activeBounties,
      chores: parsed.choresList,
      vaultData: userVault
    });
  } catch (err) {
    return res.status(500).json({ error: `Chapter API Error: ${err.message}` });
  } finally {
    if (client) client.release();
  }
}
