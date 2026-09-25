import { pool } from './db.js';
import { 
  extractPricesRecursive, 
  getMondayBasedWeekId, 
  parseFarmData,
  CHAPTER_NPC_TICKETS 
} from './sfl-parser.js';
import { reconcileDeliveriesWithNpcs } from './chapter.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const BATCH_DELAY_MS = 11000;
const SFL_BATCH_URL = 'https://api.sunflower-land.com/community/getFarms';
const SFL_SINGLE_URL = 'https://api.sunflower-land.com/community/farms';

export function normalizeFarmId(rawId) {
  if (rawId === null || rawId === undefined) return null;
  const parsed = Math.floor(Number(String(rawId).trim()));
  return Number.isInteger(parsed) && parsed > 0 ? String(parsed) : null;
}

function getBatchHeaders(apiKey = '') {
  const keyToUse = (apiKey && apiKey.trim()) || (process.env.SFL_API_KEY && process.env.SFL_API_KEY.trim()) || '';
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://sunflower-land.com/',
    'Origin': 'https://sunflower-land.com'
  };
  if (keyToUse) {
    headers['x-api-key'] = keyToUse;
    headers['Authorization'] = `Bearer ${keyToUse}`;
  }
  return headers;
}

async function postBatch(ids, attempt = 1, apiKey = '') {
  try {
    const res = await fetch(SFL_BATCH_URL, {
      method: 'POST',
      headers: getBatchHeaders(apiKey),
      body: JSON.stringify({ ids }),
      signal: AbortSignal.timeout(25000)
    });

    if (res.status === 401) {
      console.warn('⚠️ [401 Unauthorized] SFL API key missing or invalid. Single-farm fallback will be used.');
      return { farms: {}, skipped: ids, status: 401 };
    }

    if (res.status === 429 && attempt <= 2) {
      console.warn(`⚠️ [429 Throttle] SFL rate limit hit. Waiting 15s before retry (Attempt ${attempt}/2)...`);
      await sleep(15000);
      return postBatch(ids, attempt + 1, apiKey);
    }

    if (!res.ok) {
      console.error(`❌ Batch request failed (HTTP ${res.status}) for ${ids.length} IDs.`);
      return { farms: {}, skipped: ids, status: res.status };
    }

    const data = await res.json();
    return data || { farms: {}, skipped: [] };
  } catch (err) {
    console.error(`❌ Batch request error (${err.message}) for ${ids.length} IDs.`);
    return { farms: {}, skipped: ids, error: err.message };
  }
}

async function fetchFarmsWithSplitRetry(ids, apiKey = '') {
  if (!ids || ids.length === 0) return {};

  const data = await postBatch(ids, 1, apiKey);
  const farms = data.farms || {};
  const skipped = Array.isArray(data.skipped) ? data.skipped : [];

  if (skipped.length > 0 && ids.length > 1) {
    console.log(`ℹ️ [Split-Retry] ${skipped.length} farms skipped in batch of ${ids.length}. Binary splitting to recover payload drops...`);
    const half = Math.ceil(skipped.length / 2);
    const subBatches = [skipped.slice(0, half), skipped.slice(half)].filter(b => b.length > 0);

    for (const subBatch of subBatches) {
      await sleep(BATCH_DELAY_MS);
      const recoveredFarms = await fetchFarmsWithSplitRetry(subBatch, apiKey);
      for (const [key, val] of Object.entries(recoveredFarms)) {
        farms[key] = val;
      }
    }
  } else if (skipped.length > 0 && ids.length === 1) {
    console.warn(`⚠️ Farm #${ids[0]} permanently skipped by SFL.`);
  }

  return farms;
}

async function fetchSingleFarmFallback(farmId, apiKey = '') {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${SFL_SINGLE_URL}/${encodeURIComponent(farmId)}`, {
        headers: getBatchHeaders(apiKey),
        signal: AbortSignal.timeout(12000)
      });
      if (res.status === 429) {
        console.warn(`  ⚠️ Rate limit (429) for farm #${farmId}. Sleeping 11s before retry...`);
        await sleep(11000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP status ${res.status}`);
      const payload = await res.json();
      return payload.farm || payload;
    } catch (err) {
      console.warn(`  ⚠️ Single fetch attempt ${attempt}/3 for #${farmId} failed: ${err.message}`);
      if (attempt < 3) await sleep(4000);
    }
  }
  return null;
}

export async function fetchAllFarmsBatched(rawFarmIds, apiKey = '') {
  const farmLookup = new Map();
  if (!Array.isArray(rawFarmIds) || rawFarmIds.length === 0) {
    return farmLookup;
  }

  const uniqueNumericIds = Array.from(
    new Set(
      rawFarmIds
        .map(id => normalizeFarmId(id))
        .filter(Boolean)
        .map(Number)
    )
  );

  if (uniqueNumericIds.length === 0) {
    console.warn('⚠️ [Batch Fetcher] No valid numeric farm IDs to fetch.');
    return farmLookup;
  }

  const CHUNK_SIZE = 20;
  const totalBatches = Math.ceil(uniqueNumericIds.length / CHUNK_SIZE);
  console.log(`🚜 [Batch Fetcher] Starting sync for ${uniqueNumericIds.length} unique farms in ${totalBatches} batch(es) of max ${CHUNK_SIZE}...`);

  const startTime = Date.now();
  let useFallback = false;

  for (let i = 0; i < uniqueNumericIds.length; i += CHUNK_SIZE) {
    const chunk = uniqueNumericIds.slice(i, i + CHUNK_SIZE);
    const batchNum = Math.floor(i / CHUNK_SIZE) + 1;

    console.log(`🚜 [Batch ${batchNum}/${totalBatches}] Requesting ${chunk.length} farms: [${chunk.slice(0, 5).join(', ')}${chunk.length > 5 ? '...' : ''}]`);

    let batchFarms = {};
    if (!useFallback) {
      const data = await postBatch(chunk, 1, apiKey);
      if (data.status === 401) {
        console.warn('⚠️ Switching to single-farm fallback mode due to 401 Unauthorized on batch endpoint.');
        useFallback = true;
      } else {
        batchFarms = data.farms || {};
        const skipped = Array.isArray(data.skipped) ? data.skipped : [];
        if (skipped.length > 0 && chunk.length > 1) {
          console.log(`ℹ️ [Split-Retry] ${skipped.length} farms skipped. Binary splitting to recover payload drops...`);
          const half = Math.ceil(skipped.length / 2);
          const subBatches = [skipped.slice(0, half), skipped.slice(half)].filter(b => b.length > 0);
          for (const subBatch of subBatches) {
            await sleep(BATCH_DELAY_MS);
            const recovered = await fetchFarmsWithSplitRetry(subBatch, apiKey);
            for (const [k, v] of Object.entries(recovered)) {
              batchFarms[k] = v;
            }
          }
        }
      }
    }

    if (useFallback) {
      for (const singleId of chunk) {
        const farmObj = await fetchSingleFarmFallback(singleId, apiKey);
        if (farmObj) {
          batchFarms[String(singleId)] = farmObj;
        }
        await sleep(2000);
      }
    }

    // Index strictly by normalized string ID
    for (const [farmId, farmObj] of Object.entries(batchFarms)) {
      const cleanKey = normalizeFarmId(farmId);
      if (cleanKey && farmObj && typeof farmObj === 'object') {
        farmLookup.set(cleanKey, farmObj.farm || farmObj);
      }
    }

    console.log(`✅ [Batch ${batchNum}/${totalBatches}] Retrieved ${Object.keys(batchFarms).length} farms in this chunk.`);

    if (i + CHUNK_SIZE < uniqueNumericIds.length && !useFallback) {
      console.log(`⏳ [Batch Throttle] Waiting ${BATCH_DELAY_MS / 1000}s before next batch...`);
      await sleep(BATCH_DELAY_MS);
    }
  }

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`📦 [Batch Fetcher Complete] Successfully indexed ${farmLookup.size}/${uniqueNumericIds.length} farms in ${elapsedSec}s.`);

  return farmLookup;
}

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized cron request.' });
  }

  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();

  // Safety constraint: Scheduled at 23:00 UTC.
  // If delayed into 00:00 UTC collision window (or >= 23:55 UTC), abort immediately.
  if (utcHour === 0 || (utcHour === 23 && utcMin >= 55)) {
    console.warn(`🛑 [Safety Guard] Current UTC time is ${now.toISOString()} (${utcHour}:${utcMin.toString().padStart(2, '0')} UTC). Delayed into 00:00 UTC collision window. Aborting sync safely.`);
    return res.status(200).json({ skipped: true, reason: 'Delayed into 00:00 UTC collision window' });
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

      CREATE TABLE IF NOT EXISTS user_chapter_logs (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        chapter_id VARCHAR(100) NOT NULL,
        chapter_title VARCHAR(255) NOT NULL,
        archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        is_locked BOOLEAN DEFAULT FALSE,
        summary_data JSONB NOT NULL,
        CONSTRAINT unique_user_chapter UNIQUE (username, chapter_id)
      );

      ALTER TABLE user_chapter_logs ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

      CREATE INDEX IF NOT EXISTS idx_user_chapter_logs_user ON user_chapter_logs (username);
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

    // 1. Gather all farm IDs across user accounts
    const allRawFarmIds = vaultsRes.rows.map(r => {
      try {
        const v = typeof r.vault_data === 'string' ? JSON.parse(r.vault_data) : (r.vault_data || {});
        return v.farmId;
      } catch {
        return null;
      }
    }).filter(Boolean);

    console.log(`🔍 Found ${allRawFarmIds.length} farm IDs across ${vaultsRes.rows.length} vaults.`);

    // 2. Fetch all farms via high-speed batch endpoint (max 20/call with split retry and 11s pacing)
    const farmLookup = await fetchAllFarmsBatched(allRawFarmIds, process.env.SFL_API_KEY);

    const nowMs = Date.now();
    const todayDateStr = new Date(nowMs).toISOString().split('T')[0];
    const currentWeekMonday = getMondayBasedWeekId(nowMs);

    for (let i = 0; i < vaultsRes.rows.length; i++) {
      const row = vaultsRes.rows[i];
      const username = row.username;
      let vault = typeof row.vault_data === 'string' ? JSON.parse(row.vault_data) : (row.vault_data || {});
      const rawFarmId = vault.farmId;
      const farmId = normalizeFarmId(rawFarmId);

      if (!farmId) {
        console.warn(`Skipping user "${username}": No valid farmId linked.`);
        continue;
      }

      // Strict Zero-Cross-Contamination Lookup:
      // Always look up exclusively by this user's validated farm ID key in the Map
      let farm = farmLookup.get(farmId) || null;

      // Fallback: If not in batch results, attempt single farm fetch
      if (!farm) {
        console.warn(`  ⚠️ Farm #${farmId} not found in batch results. Attempting single fallback fetch...`);
        const fallbackFarm = await fetchSingleFarmFallback(farmId, process.env.SFL_API_KEY);
        if (fallbackFarm) {
          farm = fallbackFarm;
          farmLookup.set(farmId, farm);
        }
      }

      if (!farm) {
        errors.push({ username, farmId, error: 'Failed to retrieve farm data from SFL API' });
        console.error(`  ❌ Failed to sync user "${username}" (Farm #${farmId}). Skipping.`);
        continue;
      }

      // Unwrap if nested
      farm = farm.farm || farm;

      // Payload Identity Lock: Verify payload matches expected farm ID
      const payloadFarmId = normalizeFarmId(farm.id || farm.farmId);
      if (payloadFarmId && payloadFarmId !== farmId) {
        console.error(`🚨 [CROSS-CONTAMINATION GUARD BLOCKED] ID Mismatch for "${username}"! Expected #${farmId}, but received payload #${payloadFarmId}. Aborting save for this user.`);
        errors.push({ username, farmId, error: `Cross-contamination blocked: ID mismatch (${payloadFarmId} !== ${farmId})` });
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

          // Populate completed past-week bounties from SFL into their historical week bucket
          (parsed.activeBounties || []).forEach(b => {
            if (b.completed && b.completedDate) {
              const bWeekId = getMondayBasedWeekId(b.completedDate);
              if (bWeekId && bWeekId !== currentWeekMonday) {
                if (!vault.weeks[bWeekId]) {
                  vault.weeks[bWeekId] = { weekId: bWeekId, bounties: [], chores: [] };
                }
                const exists = (vault.weeks[bWeekId].bounties || []).some(eb => eb.id === b.id);
                if (!exists) {
                  vault.weeks[bWeekId].bounties.push(b);
                }
              }
            }
          });

          const existingManualChores = (vault.chores || []).filter(c => c.isManual);
          const existingManualBounties = (vault.bounties || []).filter(b => b.isManual);
          vault.bounties = [...parsed.activeBounties, ...existingManualBounties];
          vault.chores = [...parsed.choresList, ...existingManualChores];
          vault.milestones = parsed.liveMilestones;
          vault.npcSnapshots = parsed.npcsData;

          const isVip = Boolean(parsed.isVipActive);
          const vipBonus = isVip ? 2 : 0;
          const KNOWN_DOUBLE_DELIVERY_DATES = ['2026-09-02'];
          const doubleDatesSet = new Set([...(parsed.doubleDeliveryDates || []), ...KNOWN_DOUBLE_DELIVERY_DATES]);
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

          // Post-Midnight Delay Protection (if runner is delayed past 00:00 UTC reset)
          const currentUtcHour = new Date(nowMs).getUTCHours();
          const yesterdayDateStr = new Date(nowMs - 86400000).toISOString().split('T')[0];
          const hasYesterdayLog = Array.isArray(vault.logs) && vault.logs.some(l => l.date === yesterdayDateStr);
          
          let snapshotDate = todayDateStr;
          if ((currentUtcHour === 0 || currentUtcHour === 1) && !hasYesterdayLog) {
            snapshotDate = yesterdayDateStr;
          }

          const npcDoubleClaimed = new Set();
          const sortedDeliveries = [...(vault.archiveDeliveries || [])].sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));

          sortedDeliveries.forEach(d => {
            const isDone = (d.checked !== undefined ? d.checked : Boolean(d.completed)) && !d.isSkipped;
            if (isDone) {
              const baseTix = d.baseTickets !== undefined ? d.baseTickets : (d.tickets || 2);
              const isManual = Boolean(d.isManual);
              const compDate = d.completedDate || (d.completedAt ? new Date(d.completedAt).toISOString().split('T')[0] : todayDateStr);
              const isToday = !isManual && (compDate === snapshotDate || compDate === todayDateStr);

              const isDoubleDay = doubleDatesSet.has(compDate) || (isDoubleToday && compDate === todayDateStr);
              const npcClean = (d.from || d.name || '').toLowerCase().trim();
              const doubleKey = `${npcClean}_${compDate}`;

              const wasDouble = Boolean(d.hasDoubleBonus);
              let yieldAmt = baseTix;
              if (!isManual) {
                if (wasDouble || (isDoubleDay && !npcDoubleClaimed.has(doubleKey))) {
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
            date: snapshotDate,
            weekId: currentWeekMonday,
            timestamp: new Date().toISOString(),
            ticketsSaved: todayTicketsEarned,
            costSaved: todayCostIncurred,
            deliveriesDone: todayCompletedItems,
            milestones: vault.milestones || {}
          };
          
          // Bug Fix: Preserve log history instead of replacing with a 1-item array
          const existingLogs = Array.isArray(vault.logs) ? vault.logs.filter(l => l.date !== snapshotDate) : [];
          vault.logs = [logEntry, ...existingLogs].slice(0, 60);
          vault.lastCronSyncAt = new Date().toISOString();

          await client.query(
            'UPDATE user_vaults SET vault_data = $1 WHERE username = $2',
            [JSON.stringify(vault), username]
          );

          // ==========================================
          // AUTO CHAPTER SNAPSHOT (Dedicated Table & Zero Duplication)
          // ==========================================
          try {
            const ACTIVE_CHAPTER_ID = 'ascension_age_15';
            const ACTIVE_CHAPTER_TITLE = 'Ascension Age (Chapter 15)';
            const CHAPTER_END_MS = Date.UTC(2026, 10, 2, 0, 0, 0); // Nov 2, 2026 00:00:00 UTC
            const isChapterEnded = Date.now() >= CHAPTER_END_MS;

            let delivCount = 0, delivTix = 0, delivCost = 0;
            (vault.archiveDeliveries || []).forEach(d => {
              const isDone = (d.checked !== undefined ? d.checked : Boolean(d.completed)) && !d.isSkipped;
              if (isDone) {
                delivCount++;
                const baseTix = d.baseTickets !== undefined ? d.baseTickets : (d.tickets || 2);
                const isManual = Boolean(d.isManual);
                const yieldAmt = isManual ? baseTix : (d.hasDoubleBonus ? (baseTix + vipBonus) * 2 : (baseTix + vipBonus));
                delivTix += yieldAmt;
                delivCost += (d.itemsCost || d.cost || 0);
              }
            });

            let bountyCount = 0, bountyTix = 0, bountyCost = 0;
            let animalBountyCount = 0, animalBountyTix = 0, animalBountyCost = 0;
            (vault.bounties || []).forEach(b => {
              const isDone = b.checked !== undefined ? b.checked : Boolean(b.completed);
              if (isDone) {
                const bTix = b.baseTickets !== undefined ? b.baseTickets : (b.tickets || 0);
                const bCost = (b.itemsCost || b.cost || 0);
                const isAnimal = Boolean(b.isAnimal || (b.name && /egg|milk|wool|feather|leather|honey|animal/i.test(b.name)));
                if (isAnimal) {
                  animalBountyCount++;
                  animalBountyTix += bTix;
                  animalBountyCost += bCost;
                } else {
                  bountyCount++;
                  bountyTix += bTix;
                  bountyCost += bCost;
                }
              }
            });

            let choreCount = 0, choreTix = 0, choreCost = 0;
            (vault.chores || []).forEach(c => {
              const isDone = c.checked !== undefined ? c.checked : Boolean(c.completed);
              if (isDone) {
                choreCount++;
                const baseTix = c.baseTickets !== undefined ? c.baseTickets : (c.tickets || 1);
                const yieldAmt = c.isManual ? baseTix : (baseTix + vipBonus);
                choreTix += yieldAmt;
                choreCost += (c.itemsCost || c.cost || 0);
              }
            });

            Object.entries(vault.weeks || {}).forEach(([wkKey, wk]) => {
              if (wkKey === currentWeekMonday) return;
              (wk.bounties || []).forEach(b => {
                if (b.completed || b.checked) {
                  const bTix = (b.baseTickets || b.tickets || 0);
                  const bCost = (b.itemsCost || b.cost || 0);
                  const isAnimal = Boolean(b.isAnimal || (b.name && /egg|milk|wool|feather|leather|honey|animal/i.test(b.name)));
                  if (isAnimal) {
                    animalBountyCount++;
                    animalBountyTix += bTix;
                    animalBountyCost += bCost;
                  } else {
                    bountyCount++;
                    bountyTix += bTix;
                    bountyCost += bCost;
                  }
                }
              });
              (wk.chores || []).forEach(c => {
                if (c.completed || c.checked) {
                  choreCount++;
                  const baseTix = (c.baseTickets || c.tickets || 1);
                  const yieldAmt = c.isManual ? baseTix : (baseTix + vipBonus);
                  choreTix += yieldAmt;
                  choreCost += (c.itemsCost || c.cost || 0);
                }
              });
            });

            const loginCount = vault.dailyLoginCount || 0;
            const trackTix = vault.trackTickets || 0;
            const trackCost = vault.trackCost || 0;

            const weeklyProgMap = new Map();
            (vault.archiveDeliveries || []).forEach(d => {
              const isDone = (d.checked !== undefined ? d.checked : Boolean(d.completed)) && !d.isSkipped;
              if (isDone) {
                const dDate = d.completedAt || d.completedDate;
                const wId = d.weekId || (dDate ? getMondayBasedWeekId(dDate) : currentWeekMonday);
                if (!weeklyProgMap.has(wId)) weeklyProgMap.set(wId, { tickets: 0, cost: 0 });
                const stat = weeklyProgMap.get(wId);
                const baseTix = d.baseTickets !== undefined ? d.baseTickets : (d.tickets || 2);
                const isManual = Boolean(d.isManual);
                const yieldAmt = isManual ? baseTix : (d.hasDoubleBonus ? (baseTix + vipBonus) * 2 : (baseTix + vipBonus));
                stat.tickets += yieldAmt;
                stat.cost += (d.itemsCost || d.cost || 0);
              }
            });

            Object.entries(vault.weeks || {}).forEach(([wkKey, wk]) => {
              const normWeek = getMondayBasedWeekId(wk.weekId || wkKey);
              if (!weeklyProgMap.has(normWeek)) weeklyProgMap.set(normWeek, { tickets: 0, cost: 0 });
              const stat = weeklyProgMap.get(normWeek);
              (wk.bounties || []).forEach(b => {
                if (b.completed || b.checked) {
                  stat.tickets += (b.baseTickets || b.tickets || 0);
                  stat.cost += (b.itemsCost || b.cost || 0);
                }
              });
              (wk.chores || []).forEach(c => {
                if (c.completed || c.checked) {
                  stat.tickets += (c.isManual ? (c.baseTickets || c.tickets || 1) : ((c.baseTickets || c.tickets || 1) + vipBonus));
                  stat.cost += (c.itemsCost || c.cost || 0);
                }
              });
            });

            const sortedWeeklyArray = Array.from(weeklyProgMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
            const weeklyProgressionSummary = sortedWeeklyArray.map(([wId, val], idx) => ({
              week: idx + 1,
              weekId: wId,
              tickets: val.tickets,
              cost: val.cost
            }));

            const efficiencyRatio = totalCalculatedTickets > 0 ? (totalCalculatedCost / totalCalculatedTickets) : 0;

            const chapterSnapshot = {
              chapterId: ACTIVE_CHAPTER_ID,
              chapterTitle: ACTIVE_CHAPTER_TITLE,
              archivedAt: new Date().toISOString(),
              isLocked: isChapterEnded,
              totalTickets: totalCalculatedTickets,
              totalCost: totalCalculatedCost,
              efficiencyRatio: efficiencyRatio,
              categories: {
                deliveries: { count: delivCount, tickets: delivTix, cost: delivCost },
                bounties: { count: bountyCount, tickets: bountyTix, cost: bountyCost },
                animalBounties: { count: animalBountyCount, tickets: animalBountyTix, cost: animalBountyCost },
                chores: { count: choreCount, tickets: choreTix, cost: choreCost },
                logins: { count: loginCount, tickets: loginCount, cost: 0 },
                tracked: { tickets: trackTix, cost: trackCost }
              },
              weeklySummary: weeklyProgressionSummary
            };

            await client.query(`
              INSERT INTO user_chapter_logs (username, chapter_id, chapter_title, archived_at, is_locked, summary_data)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (username, chapter_id)
              DO UPDATE SET
                chapter_title = EXCLUDED.chapter_title,
                archived_at = EXCLUDED.archived_at,
                is_locked = EXCLUDED.is_locked,
                summary_data = EXCLUDED.summary_data
              WHERE user_chapter_logs.is_locked IS NOT TRUE
            `, [
              username,
              ACTIVE_CHAPTER_ID,
              ACTIVE_CHAPTER_TITLE,
              chapterSnapshot.archivedAt,
              isChapterEnded,
              JSON.stringify(chapterSnapshot)
            ]);
          } catch (chapterErr) {
            console.warn(`  ⚠️ Auto chapter snapshot notice for "${username}": ${chapterErr.message}`);
          }

        results.push({ username, farmId, totalTickets: totalCalculatedTickets, status: 'Synced & Saved' });
        processedCount++;
      } catch (err) {
        errors.push({ username, farmId, error: err.message });
        console.error(`  ❌ Parsing error for "${username}": ${err.message}`);
      }

      if (i < vaultsRes.rows.length - 1) {
        await sleep(50);
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
