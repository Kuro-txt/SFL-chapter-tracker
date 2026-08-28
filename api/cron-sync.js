import { pool } from './db.js';
import { 
  extractPricesRecursive, 
  getMondayBasedWeekId, 
  parseFarmData,
  CHAPTER_NPC_TICKETS 
} from './sfl-parser.js';
import { reconcileDeliveriesWithNpcs } from './chapter.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized cron request.' });
  }

  let client;
  let processedCount = 0;
  let errors = [];
  const results = [];

  try {
    client = await pool.connect();
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_vaults (
        username VARCHAR(255) PRIMARY KEY,
        auth_data JSONB NOT NULL,
        vault_data JSONB NOT NULL
      );
    `);

    const vaultsRes = await client.query('SELECT username, vault_data FROM user_vaults');

    if (!vaultsRes.rows || vaultsRes.rows.length === 0) {
      return res.status(200).json({ success: true, message: 'No registered user vaults found in database.' });
    }

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
      console.warn('Cron price fetch failed, proceeding with recipe values:', e.message);
    }

    const sflHeaders = {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://sunflower-land.com/',
      'Origin': 'https://sunflower-land.com'
    };
    if (process.env.SFL_API_KEY) sflHeaders['x-api-key'] = process.env.SFL_API_KEY;

    const nowMs = Date.now();
    const todayDateStr = new Date(nowMs).toISOString().split('T')[0];
    const currentWeekMonday = getMondayBasedWeekId(nowMs);

    for (const row of vaultsRes.rows) {
      const username = row.username;
      let vault = typeof row.vault_data === 'string' ? JSON.parse(row.vault_data) : (row.vault_data || {});
      const farmId = vault.farmId || '8472883706403914';

      let success = false;
      let lastError = null;
      const retryGaps = [3000, 5000];

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const sflRes = await fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { 
            headers: sflHeaders,
            signal: AbortSignal.timeout(9000)
          });
          
          if (!sflRes.ok) throw new Error(`SFL API error status: ${sflRes.status}`);

          const payload = await sflRes.json();
          const farm = payload.farm || payload;
          const parsed = parseFarmData(farm, priceMap);

          reconcileDeliveriesWithNpcs(vault, parsed.deliveryList, parsed.npcsData);

          if (!vault.weeks) vault.weeks = {};
          if (!vault.weeks[currentWeekMonday]) {
            vault.weeks[currentWeekMonday] = {
              weekId: currentWeekMonday,
              bounties: parsed.activeBounties || [],
              chores: parsed.choresList || []
            };
          } else {
            const currentWk = vault.weeks[currentWeekMonday];
            const savedManualChores = (currentWk.chores || []).filter(c => c.isManual);
            const savedManualBounties = (currentWk.bounties || []).filter(b => b.isManual);

            currentWk.chores = [...parsed.choresList, ...savedManualChores];
            currentWk.bounties = [...parsed.activeBounties, ...savedManualBounties];
          }

          const existingManualChores = (vault.chores || []).filter(c => c.isManual);
          const existingManualBounties = (vault.bounties || []).filter(b => b.isManual);
          vault.bounties = [...parsed.activeBounties, ...existingManualBounties];
          vault.chores = [...parsed.choresList, ...existingManualChores];
          vault.milestones = parsed.liveMilestones;
          vault.npcSnapshots = parsed.npcsData;

          const isVip = Boolean(parsed.isVipActive);
          const vipBonus = isVip ? 2 : 0;
          const doubleDatesSet = new Set(parsed.doubleDeliveryDates || []);
          const isDoubleToday = doubleDatesSet.has(todayDateStr) || Boolean(parsed.isDoubleDeliveryActive);

          // Daily login auto-increment on new calendar day
          if (vault.lastDailyLoginDate !== todayDateStr) {
            vault.dailyLoginTickets = (vault.dailyLoginTickets || 0) + 1;
            vault.lastDailyLoginDate = todayDateStr;
          }

          let totalCalculatedTickets = (vault.trackTickets || 0) + (vault.dailyLoginTickets || 0);
          let totalCalculatedCost = (vault.trackCost || 0);

          let todayTicketsEarned = 0;
          let todayCostIncurred = 0;
          const todayCompletedItems = [];

          const npcDoubleClaimed = new Set();
          const sortedDeliveries = [...(vault.archiveDeliveries || [])].sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));

          sortedDeliveries.forEach(d => {
            const isDone = (d.checked !== undefined ? d.checked : Boolean(d.completed)) && !d.isSkipped;
            if (isDone) {
              const baseTix = d.baseTickets !== undefined ? d.baseTickets : (d.tickets || 2);
              const isManual = Boolean(d.isManual);
              const compDate = d.completedDate || (d.completedAt ? new Date(d.completedAt).toISOString().split('T')[0] : todayDateStr);
              const isToday = !isManual && (compDate === todayDateStr);

              const isDoubleDay = doubleDatesSet.has(compDate) || (isDoubleToday && compDate === todayDateStr);
              const npcClean = (d.from || d.name || '').toLowerCase().trim();
              const doubleKey = `${npcClean}_${compDate}`;

              let yieldAmt = baseTix;
              if (!isManual) {
                if (isDoubleDay && !npcDoubleClaimed.has(doubleKey)) {
                  yieldAmt = (baseTix + vipBonus) * 2;
                  npcDoubleClaimed.add(doubleKey);
                  d.hasDoubleBonus = true;
                } else {
                  yieldAmt = (baseTix + vipBonus);
                  d.hasDoubleBonus = false;
                }
              }

              const dCost = (d.itemsCost || d.cost || 0);
              totalCalculatedTickets += yieldAmt;
              totalCalculatedCost += dCost;

              if (isToday) {
                todayTicketsEarned += yieldAmt;
                todayCostIncurred += dCost;
                todayCompletedItems.push({
                  name: d.name || d.from,
                  yield: yieldAmt,
                  cost: dCost,
                  weekId: d.weekId || currentWeekMonday
                });
              }
            }
          });

          (vault.bounties || []).forEach(b => {
            const isDone = b.checked !== undefined ? b.checked : Boolean(b.completed);
            if (isDone) {
              const baseTix = b.baseTickets !== undefined ? b.baseTickets : (b.tickets || 0);
              const bCost = (b.itemsCost || b.cost || 0);
              totalCalculatedTickets += baseTix;
              totalCalculatedCost += bCost;
            }
          });

          (vault.chores || []).forEach(c => {
            const isDone = c.checked !== undefined ? c.checked : Boolean(c.completed);
            if (isDone) {
              const baseTix = c.baseTickets !== undefined ? c.baseTickets : (c.tickets || 1);
              const yieldAmt = c.isManual ? baseTix : (baseTix + vipBonus);
              const cCost = (c.itemsCost || c.cost || 0);
              totalCalculatedTickets += yieldAmt;
              totalCalculatedCost += cCost;
            }
          });

          Object.entries(vault.weeks || {}).forEach(([wkKey, wk]) => {
            if (wkKey === currentWeekMonday) return;
            (wk.bounties || []).forEach(b => {
              if (b.completed || b.checked) {
                totalCalculatedTickets += (b.baseTickets || b.tickets || 0);
                totalCalculatedCost += (b.itemsCost || b.cost || 0);
              }
            });
            (wk.chores || []).forEach(c => {
              if (c.completed || c.checked) {
                totalCalculatedTickets += (c.isManual ? (c.baseTickets || c.tickets || 1) : ((c.baseTickets || c.tickets || 1) + vipBonus));
                totalCalculatedCost += (c.itemsCost || c.cost || 0);
              }
            });
          });

          vault.cumulativeTickets = totalCalculatedTickets;
          vault.cumulativeCost = totalCalculatedCost;

          const logEntry = {
            date: todayDateStr,
            weekId: currentWeekMonday,
            timestamp: new Date().toISOString(),
            ticketsSaved: todayTicketsEarned,
            costSaved: todayCostIncurred,
            deliveriesDone: todayCompletedItems,
            milestones: vault.milestones || {}
          };
          vault.logs = [logEntry];
          vault.lastCronSyncAt = new Date().toISOString();

          await client.query(
            'UPDATE user_vaults SET vault_data = $1 WHERE username = $2',
            [JSON.stringify(vault), username]
          );

          results.push({ username, farmId, totalTickets: totalCalculatedTickets, status: 'Synced & Saved' });
          success = true;
          processedCount++;
          break;
        } catch (attemptErr) {
          lastError = attemptErr.message;
          if (attempt < 1) await sleep(retryGaps[attempt]);
        }
      }

      if (!success) {
        errors.push({ username, farmId, error: lastError });
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: `Cron executed at 23:00 UTC.`, 
      syncedAt: new Date().toISOString(),
      processedUsers: processedCount,
      results,
      errors: errors.length > 0 ? errors : undefined 
    });
  } catch (err) {
    return res.status(500).json({ error: `Cron Server Error: ${err.message}` });
  } finally {
    if (client) client.release();
  }
}
