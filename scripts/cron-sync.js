import { pool } from '../api/db.js';
import { 
  extractPricesRecursive, 
  getMondayBasedWeekId, 
  parseFarmData 
} from '../api/sfl-parser.js';
import { reconcileDeliveriesWithNpcs } from '../api/chapter.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runSync() {
  console.log('🚀 Starting GitHub Actions SFL Farm Sync...');
  let client;
  let processedCount = 0;
  const errors = [];
  const results = [];
  const farmCache = new Map();

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
      console.log('ℹ️ No registered user vaults found in database.');
      return;
    }

    console.log(`📋 Found ${vaultsRes.rows.length} total user accounts to process.`);

    let priceMap = {};
    try {
      const pricesRes = await fetch('https://sfl.world/api/v1/prices', { 
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(10000)
      });
      if (pricesRes.ok) {
        const rawPricesData = await pricesRes.json();
        if (rawPricesData) priceMap = extractPricesRecursive(rawPricesData);
        console.log(`✔ Synced ${Object.keys(priceMap).length} market prices from SFL.world.`);
      }
    } catch (e) {
      console.warn('⚠️ Price fetch failed, proceeding with recipe values:', e.message);
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

    for (let i = 0; i < vaultsRes.rows.length; i++) {
      const row = vaultsRes.rows[i];
      const username = row.username;
      let vault = typeof row.vault_data === 'string' ? JSON.parse(row.vault_data) : (row.vault_data || {});
      const farmId = vault.farmId || '8472883706403914';

      console.log(`[${i + 1}/${vaultsRes.rows.length}] Processing user: "${username}" (Farm #${farmId})...`);

      let farm = farmCache.get(farmId) || null;

      if (!farm) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const sflRes = await fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { 
              headers: sflHeaders,
              signal: AbortSignal.timeout(12000)
            });
            
            if (sflRes.status === 429) {
              console.warn(`  ⚠️ Rate limit (429) on attempt ${attempt}/3. Sleeping 8s before retry...`);
              await sleep(8000);
              continue;
            }

            if (!sflRes.ok) throw new Error(`HTTP status ${sflRes.status}`);

            const payload = await sflRes.json();
            farm = payload.farm || payload;
            farmCache.set(farmId, farm);
            break;
          } catch (attemptErr) {
            console.warn(`  ⚠️ Attempt ${attempt}/3 failed: ${attemptErr.message}`);
            if (attempt < 3) await sleep(4000);
          }
        }
      } else {
        console.log(`  ⚡ Reusing cached data for shared farm #${farmId}`);
      }

      if (!farm) {
        errors.push({ username, farmId, error: 'Failed to fetch farm after 3 attempts' });
        console.error(`  ❌ Failed to sync user "${username}". Skipping.`);
        continue;
      }

      try {
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

        results.push({ username, farmId, totalTickets: totalCalculatedTickets });
        processedCount++;
        console.log(`  ✔ Successfully saved "${username}" (${totalCalculatedTickets} total tickets)`);
      } catch (err) {
        errors.push({ username, farmId, error: err.message });
        console.error(`  ❌ Parsing error for "${username}": ${err.message}`);
      }

      if (i < vaultsRes.rows.length - 1) {
        await sleep(2000);
      }
    }

    console.log('\n📊 SYNC SUMMARY:');
    console.log(`• Successfully processed: ${processedCount}/${vaultsRes.rows.length} users`);
    if (errors.length > 0) {
      console.log(`• Failed users (${errors.length}):`, errors);
    }
  } catch (err) {
    console.error('💥 Fatal Cron Error:', err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

runSync();
