import { pool, hashPassword } from './db.js';
import { calculateTrackTickets } from './chapter-tracks.js';
import { 
  extractPricesRecursive, 
  getMondayBasedWeekId, 
  parseFarmData,
  CHAPTER_NPC_TICKETS 
} from './sfl-parser.js';

let isSchemaInitialized = false;
let cachedPriceMap = null;
let cachedPriceMapExpiresAt = 0;
const leaderboardCache = new Map();
const LEADERBOARD_CACHE_TTL_MS = 60000; // 60 second cache TTL

// Standard baseline fallback prices for core game resources to guarantee recipes never calculate to 0.000 SFL
export const BASELINE_PRICES = {
  // Core Resources
  "wood": 0.0103,
  "stone": 0.0204,
  "iron": 0.0408,
  "gold": 0.0815,
  "crimstone": 0.125,
  "sunstone": 0.250,
  "oil": 0.015,
  "sand": 0.005,
  "salt": 0.008,

  // Animals & Products
  "egg": 0.0233,
  "eggs": 0.0233,
  "milk": 0.0512,
  "wool": 0.0325,
  "feather": 0.018,
  "leather": 0.045,
  "merino wool": 0.065,

  // Crops
  "sunflower": 0.0004,
  "potato": 0.0014,
  "pumpkin": 0.0035,
  "carrot": 0.006,
  "cabbage": 0.012,
  "beetroot": 0.023,
  "cauliflower": 0.035,
  "parsnip": 0.055,
  "eggplant": 0.070,
  "corn": 0.080,
  "radish": 0.095,
  "wheat": 0.045,
  "kale": 0.065,
  "barley": 0.075,
  "soybean": 0.085,
  "rice": 0.060,
  "olive": 0.120,
  "zucchini": 0.050,
  "yam": 0.055,
  "onion": 0.070,
  "turnip": 0.065,
  "artichoke": 0.080,

  // Fruits
  "apple": 0.045,
  "banana": 0.055,
  "orange": 0.050,
  "blueberry": 0.040,
  "tomato": 0.035,
  "lemon": 0.048,
  "grape": 0.060
};

export async function getLivePriceMap() {
  const now = Date.now();
  if (cachedPriceMap && now < cachedPriceMapExpiresAt) {
    return { ...cachedPriceMap };
  }
  try {
    const pricesRes = await fetch('https://sfl.world/api/v1/prices', { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(10000)
    });
    if (pricesRes.ok) {
      const rawPricesData = await pricesRes.json();
      if (rawPricesData) {
        const live = extractPricesRecursive(rawPricesData);
        cachedPriceMap = { ...BASELINE_PRICES, ...live };
        cachedPriceMapExpiresAt = now + 10 * 60 * 1000; // 10 minute cache TTL
        return { ...cachedPriceMap };
      }
    }
  } catch (e) {
    console.warn('Live price fetch warning:', e.message);
  }
  // Return fallback baseline if sfl.world timed out or failed
  if (!cachedPriceMap) {
    cachedPriceMap = { ...BASELINE_PRICES };
  }
  return { ...cachedPriceMap };
}

async function ensureTableExists(client) {
  if (isSchemaInitialized) return;
  try {
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
        summary_data JSONB NOT NULL
      );
    `);

    try {
      await client.query(`ALTER TABLE user_chapter_logs ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;`);
    } catch (e) {}

    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_user_chapter_logs_user ON user_chapter_logs (username);`);
    } catch (e) {}

    try {
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_chapter_logs_user_chapter ON user_chapter_logs (username, chapter_id);`);
    } catch (e) {}

    isSchemaInitialized = true;
  } catch (err) {
    console.warn('ensureTableExists warning:', err.message);
  }
}

export function slugifyNpc(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function sanitizeDeliveriesList(deliveries) {
  if (!Array.isArray(deliveries)) return [];
  const map = new Map();

  const sorted = [...deliveries].sort((a, b) => {
    const aCustom = Boolean(a.isCustomCost || a.userCost !== undefined);
    const bCustom = Boolean(b.isCustomCost || b.userCost !== undefined);
    if (aCustom !== bCustom) return aCustom ? -1 : 1;

    const aDone = Boolean(a.checked !== undefined ? a.checked : a.completed);
    const bDone = Boolean(b.checked !== undefined ? b.checked : b.completed);
    if (aDone !== bDone) return aDone ? -1 : 1;
    return (b.itemsCost || b.cost || 0) - (a.itemsCost || a.cost || 0);
  });

  for (let idx = 0; idx < sorted.length; idx++) {
    const d = sorted[idx];
    if (!d) continue;
    const rawNpc = (d.from || d.name || '').trim();
    if (!rawNpc) continue;
    const npc = slugifyNpc(rawNpc);
    if (!npc) continue;

    const isMan = Boolean(d.isManual);
    const isDone = Boolean(d.checked !== undefined ? d.checked : d.completed) && !d.isSkipped;
    const isSkip = Boolean(d.isSkipped);

    let dateStr = d.completedDate || '';
    if (!dateStr && d.completedAt) {
      const ts = typeof d.completedAt === 'number' ? d.completedAt : Number(d.completedAt);
      if (!isNaN(ts) && ts > 0) {
        dateStr = new Date(ts < 1e11 ? ts * 1000 : ts).toISOString().split('T')[0];
      }
    }
    if (!dateStr) dateStr = d.weekId || new Date().toISOString().split('T')[0];
    d.completedDate = dateStr;

    let rawId = d.id ? String(d.id).replace(/['"`]/g, '').replace(/\s+/g, '_') : '';
    let canonicalId = rawId;

    if (isMan) {
      canonicalId = (rawId && rawId.startsWith('manual_')) ? rawId : `manual_${npc}_${d.completedAt || d.completedDate || Date.now()}`;
    } else if (isDone) {
      if (rawId && rawId.startsWith(`deliv_${npc}_d`)) {
        canonicalId = rawId;
      } else {
        const count = d.deliveryCountAtCreation;
        canonicalId = (count !== undefined && count !== null && count !== '') 
          ? `deliv_${npc}_d${count}` 
          : `deliv_${npc}_d${d.completedAt || d.completedDate || (idx + 1)}`;
      }
      d.completed = true;
      d.checked = true;
      d.isSkipped = false;
      d.status = 'completed';
    } else if (isSkip) {
      if (rawId && rawId.startsWith(`deliv_${npc}_skip_`)) {
        canonicalId = rawId;
      } else {
        const skipCount = d.skippedCountAtCreation;
        canonicalId = `deliv_${npc}_skip_${skipCount || d.completedDate || (idx + 1)}`;
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
      delete d.isCustomCost;
      delete d.userCost;
    }

    let finalId = canonicalId;
    if (map.has(finalId)) {
      const existing = map.get(finalId);
      const isSameDelivery = existing === d || 
        (existing.completedAt && d.completedAt && existing.completedAt === d.completedAt) ||
        (existing.status === 'active' && d.status === 'active');

      if (!isSameDelivery && (isDone || isSkip)) {
        let suffix = 2;
        while (map.has(`${canonicalId}_${suffix}`)) {
          suffix++;
        }
        finalId = `${canonicalId}_${suffix}`;
      }
    }

    d.id = finalId;

    if (!map.has(finalId)) {
      map.set(finalId, d);
    } else {
      const existing = map.get(finalId);
      if ((!existing.itemDetails || existing.itemDetails.length === 0) && d.itemDetails && d.itemDetails.length > 0) {
        existing.itemDetails = d.itemDetails;
        existing.items = d.items;
        if (!existing.isCustomCost && existing.userCost === undefined) {
          existing.itemsCost = d.itemsCost;
          existing.cost = d.cost;
        }
      }
      if ((!existing.completed && !existing.checked) || finalId.endsWith('_active')) {
        delete existing.isCustomCost;
        delete existing.userCost;
      } else if (d.isCustomCost || d.userCost !== undefined) {
        existing.cost = d.userCost !== undefined ? d.userCost : d.cost;
        existing.itemsCost = existing.cost;
        existing.userCost = existing.cost;
        existing.isCustomCost = true;
      }
      if (d.isCustomTickets || d.userTickets !== undefined) {
        existing.baseTickets = d.userTickets !== undefined ? d.userTickets : d.baseTickets;
        existing.tickets = existing.baseTickets;
        existing.userTickets = existing.baseTickets;
        existing.isCustomTickets = true;
      }
      if (!existing.activeSince && d.activeSince) {
        existing.activeSince = d.activeSince;
      }
    }
  }

  return Array.from(map.values());
}

export function preserveCustomTaskEdits(freshList, existingList, isChore = false) {
  if (!Array.isArray(freshList) || !Array.isArray(existingList)) return freshList;
  freshList.forEach(freshItem => {
    if (!freshItem) return;
    const isDone = Boolean(freshItem.checked !== undefined ? freshItem.checked : freshItem.completed);
    const isMan = Boolean(freshItem.isManual) || (typeof freshItem.id === 'string' && freshItem.id.startsWith('manual_'));

    // Active tasks must NEVER have or inherit manual costs
    if (!isDone && !isMan) {
      delete freshItem.isCustomCost;
      delete freshItem.userCost;
    }

    let match = null;
    if (isChore) {
      const freshKey = `${(freshItem.npc || '').toLowerCase().trim()}_${(freshItem.task || freshItem.name || '').toLowerCase().trim()}`;
      match = existingList.find(e => {
        if (!e) return false;
        if (freshItem.id && e.id && String(freshItem.id) === String(e.id)) return true;
        const eKey = `${(e.npc || '').toLowerCase().trim()}_${(e.task || e.name || '').toLowerCase().trim()}`;
        return eKey === freshKey;
      });
    } else {
      match = existingList.find(e => {
        if (!e) return false;
        if (freshItem.id && e.id && String(freshItem.id) === String(e.id)) return true;
        const freshName = (freshItem.name || '').toLowerCase().trim();
        const eName = (e.name || '').toLowerCase().trim();
        if (freshName && eName && freshName === eName) {
          // Treat null/undefined level as equivalent — both sides may omit level for non-animal bounties.
          // Only enforce a numeric level comparison when BOTH sides have a non-null numeric level.
          const freshLvl = freshItem.level != null ? Number(freshItem.level) : null;
          const eLvl = e.level != null ? Number(e.level) : null;
          if (freshLvl !== null && eLvl !== null) {
            return freshLvl === eLvl;
          }
          return true;
        }
        return false;
      });
    }

    if (match) {
      // ONLY preserve custom cost on completed or manual items, NEVER onto active tasks
      if ((isDone || isMan) && (match.isCustomCost || match.userCost !== undefined)) {
        freshItem.cost = match.userCost !== undefined ? match.userCost : match.cost;
        freshItem.itemsCost = freshItem.cost;
        freshItem.userCost = freshItem.cost;
        freshItem.isCustomCost = true;
      }
      if (match.isCustomTickets || match.userTickets !== undefined) {
        freshItem.baseTickets = match.userTickets !== undefined ? match.userTickets : (match.baseTickets || match.tickets);
        freshItem.tickets = freshItem.baseTickets;
        freshItem.userTickets = freshItem.baseTickets;
        freshItem.isCustomTickets = true;
      }
    }
  });
  return freshList;
}

export const CANONICAL_CHAPTER_NPCS = {
  bert: 2,
  cornwell: 3,
  finley: 2,
  finn: 5,
  jester: 4,
  miranda: 2,
  pharaoh: 6,
  "pumpkin' pete": 1,
  raven: 4,
  timmy: 5,
  tywin: 10
};

export function reconcileDeliveriesWithNpcs(vault, parsedDeliveryList, currentNpcsData) {
  if (!vault.archiveDeliveries) vault.archiveDeliveries = [];
  if (!vault.npcSnapshots) vault.npcSnapshots = {};

  const currentWeekMonday = getMondayBasedWeekId();
  const nowMs = Date.now();
  const todayDateStr = new Date(nowMs).toISOString().split('T')[0];

  // 1. Sanitize past database records
  vault.archiveDeliveries = sanitizeDeliveriesList(vault.archiveDeliveries);

  // Track NPCs that had a stale delivery completed in this cycle
  const staleCompletedNpcs = new Set();

  // 2. Reconcile Deltas using NPC Lifetime Counters (Canonical NPCs only to avoid duplicate alias loops)
  Object.entries(CANONICAL_CHAPTER_NPCS).forEach(([npcClean, defaultTix]) => {
    const currStat = currentNpcsData[npcClean] ||
      (npcClean === "pumpkin' pete" ? (currentNpcsData['pumpkin pete'] || currentNpcsData['pete']) : null) ||
      (npcClean === 'timmy' ? currentNpcsData['tyreless timmy'] : null) ||
      (npcClean === 'cornwell' ? currentNpcsData['corny'] : null) ||
      (npcClean === 'finley' ? currentNpcsData['findlay'] : null) ||
      { deliveryCount: 0, skippedCount: 0, deliveryCompletedAt: null };
    const prevStat = vault.npcSnapshots[npcClean];

    if (prevStat) {
      let delivDelta = currStat.deliveryCount - prevStat.deliveryCount;
      let skipDelta = currStat.skippedCount - prevStat.skippedCount;

      // Delta Sanity Guard: In Sunflower Land, a player cannot complete >5 orders for one NPC between syncs.
      // An abnormal delta (>5) indicates an uninitialized baseline, reset, or old chapter mismatch.
      // Fast-forward baseline snapshot count without synthesizing phantom deliveries.
      if (delivDelta > 5) {
        console.warn(`⚠️ [Reconciler Guard] Abnormal delivery delta (${delivDelta}) for ${npcClean}. Baseline fast-forwarded to ${currStat.deliveryCount} without synthesizing phantom deliveries.`);
        delivDelta = 0;
      }
      if (skipDelta > 10) {
        skipDelta = 0;
      }

      if (delivDelta > 0 || skipDelta > 0) {
        const completionTime = currStat.deliveryCompletedAt || nowMs;
        const compDate = new Date(completionTime).toISOString().split('T')[0];
        const compWeek = getMondayBasedWeekId(completionTime);

        // STALE ACTIVE CARD RESOLUTION
        // Look for an existing pending active card for this NPC that was created on a previous day
        const staleActiveIdx = vault.archiveDeliveries.findIndex(d => {
          const dNpc = (d.from || d.name || '').toLowerCase().trim();
          const isPending = !(d.checked !== undefined ? d.checked : Boolean(d.completed)) && !d.isSkipped && !d.isManual;
          const isStale = Boolean(d.activeSince && d.activeSince < todayDateStr);
          return dNpc === npcClean && d.id === `deliv_${npcClean}_active` && isPending && isStale;
        });

        if (staleActiveIdx !== -1) {
          if (skipDelta > 0) {
            // Yesterday's delivery was skipped: remove it from storage
            vault.archiveDeliveries.splice(staleActiveIdx, 1);
            skipDelta--;
          } else if (delivDelta > 0) {
            // Yesterday's delivery was completed: upgrade it to d<completedCountIndex>, keep original items!
            const completedCountIndex = prevStat.deliveryCount + 1;
            const targetOrderId = `deliv_${npcClean}_d${completedCountIndex}`;
            const orderToComplete = vault.archiveDeliveries[staleActiveIdx];
            const origWeek = getMondayBasedWeekId(orderToComplete.weekId || orderToComplete.activeSince || compWeek);
            orderToComplete.id = targetOrderId;
            orderToComplete.completed = true;
            orderToComplete.checked = true;
            orderToComplete.isSkipped = false;
            orderToComplete.status = 'completed';
            orderToComplete.completedAt = completionTime;
            orderToComplete.completedDate = compDate;
            orderToComplete.weekId = origWeek;
            orderToComplete.deliveryCountAtCreation = completedCountIndex;
            orderToComplete.isStacked = false; // Primary / oldest delivery: eligible for 2x double delivery bonus
            staleCompletedNpcs.add(npcClean);
            delivDelta--;
          }
        }

        // Remaining delivDelta loop (for today's stacked deliveries or fresh completions)
        if (delivDelta > 0) {
          const baseCount = currStat.deliveryCount - delivDelta;
          for (let k = 1; k <= delivDelta; k++) {
            const completedCountIndex = baseCount + k;
            const targetOrderId = `deliv_${npcClean}_d${completedCountIndex}`;
            const isStacked = k > 1 || staleCompletedNpcs.has(npcClean);

            const existingPendingIdx = vault.archiveDeliveries.findIndex(d => {
              const dNpc = (d.from || d.name || '').toLowerCase().trim();
              const isPending = !(d.checked !== undefined ? d.checked : Boolean(d.completed)) && !d.isSkipped && !d.isManual;
              return dNpc === npcClean && (isPending || d.id === `deliv_${npcClean}_active` || d.id === targetOrderId);
            });

            if (existingPendingIdx !== -1) {
              const orderToComplete = vault.archiveDeliveries[existingPendingIdx];
              const origWeek = getMondayBasedWeekId(orderToComplete.weekId || orderToComplete.activeSince || compWeek);
              orderToComplete.id = targetOrderId;
              orderToComplete.completed = true;
              orderToComplete.checked = true;
              orderToComplete.isSkipped = false;
              orderToComplete.status = 'completed';
              orderToComplete.completedAt = completionTime;
              orderToComplete.completedDate = compDate;
              orderToComplete.weekId = origWeek;
              orderToComplete.deliveryCountAtCreation = completedCountIndex;
              orderToComplete.isStacked = isStacked;
            } else {
              const alreadyExists = vault.archiveDeliveries.some(d => d.id === targetOrderId);
              if (!alreadyExists) {
                // Preceding delivery lookup so it has recipe/tickets instead of 0 cost if needed
                const prevDelivId = `deliv_${npcClean}_d${completedCountIndex - 1}`;
                const prevDeliv = vault.archiveDeliveries.find(d => d.id === prevDelivId);

                vault.archiveDeliveries.push({
                  id: targetOrderId,
                  from: npcClean,
                  name: npcClean,
                  baseTickets: defaultTix,
                  tickets: defaultTix,
                  cost: prevDeliv?.cost || prevDeliv?.itemsCost || 0,
                  itemsCost: prevDeliv?.itemsCost || 0,
                  itemDetails: prevDeliv?.itemDetails || [],
                  items: prevDeliv?.items || {},
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
            vault.archiveDeliveries.splice(pendingIdx, 1);
          }
        }
      }
    }

    vault.npcSnapshots[npcClean] = {
      deliveryCount: currStat.deliveryCount,
      skippedCount: currStat.skippedCount,
      deliveryCompletedAt: currStat.deliveryCompletedAt
    };
  });

  // Clean up ghost alias keys so snapshots remain canonical
  delete vault.npcSnapshots['pete'];
  delete vault.npcSnapshots['pumpkin pete'];
  delete vault.npcSnapshots['corny'];
  delete vault.npcSnapshots['findlay'];
  delete vault.npcSnapshots['tyreless timmy'];

  // 3. Register or update the currently active order from board
  parsedDeliveryList.forEach(order => {
    const npcClean = (order.from || order.name || '').toLowerCase().trim();
    const currStat = currentNpcsData[npcClean] || { deliveryCount: 0, skippedCount: 0, deliveryCompletedAt: null };

    if (order.completed) {
      const targetDoneId = `deliv_${npcClean}_d${currStat.deliveryCount}`;
      const compTime = order.completedAt || currStat.deliveryCompletedAt || nowMs;
      const compDate = new Date(compTime).toISOString().split('T')[0];
      const compWeek = getMondayBasedWeekId(compTime);
      const isStackedOrder = staleCompletedNpcs.has(npcClean);

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
        target.weekId = getMondayBasedWeekId(target.weekId || compWeek);
        target.deliveryCountAtCreation = currStat.deliveryCount;
        target.isStacked = isStackedOrder;
        target.items = order.items || target.items;
        target.itemsCost = order.itemsCost || target.itemsCost;
        target.cost = order.itemsCost || target.cost;
        delete target.isCustomCost;
        delete target.userCost;
        target.itemDetails = order.itemDetails || target.itemDetails;
        if (!target.isCustomTickets && target.userTickets === undefined) {
          target.baseTickets = order.baseTickets || target.baseTickets;
          target.tickets = order.baseTickets || target.tickets;
        }
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
          target.weekId = getMondayBasedWeekId(target.weekId || compWeek);
          target.isStacked = isStackedOrder;
          target.items = order.items || target.items;
          if (!target.isCustomCost && target.userCost === undefined) {
            target.itemsCost = order.itemsCost || target.itemsCost;
            target.cost = order.itemsCost || target.cost;
          }
          target.itemDetails = order.itemDetails || target.itemDetails;
          if (!target.isCustomTickets && target.userTickets === undefined) {
            target.baseTickets = order.baseTickets || target.baseTickets;
            target.tickets = order.baseTickets || target.tickets;
          }
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
            isStacked: isStackedOrder,
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
          const isStaleCard = Boolean(target.activeSince && target.activeSince < todayDateStr);
          if (!isStaleCard) {
            target.items = order.items || target.items;
            target.itemsCost = order.itemsCost || target.itemsCost;
            target.cost = order.itemsCost || target.cost;
            delete target.isCustomCost;
            delete target.userCost;
            target.itemDetails = order.itemDetails || target.itemDetails;
            if (!target.isCustomTickets && target.userTickets === undefined) {
              target.baseTickets = order.baseTickets || target.baseTickets;
              target.tickets = order.baseTickets || target.tickets;
            }
          }
          target.deliveryCountAtCreation = nextTargetCount;
          target.skippedCountAtCreation = currStat.skippedCount;
          target.completed = false;
          target.checked = false;
          target.isSkipped = false;
          target.status = 'active';
          if (!target.activeSince) {
            target.activeSince = todayDateStr;
          }
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
          isManual: false,
          activeSince: todayDateStr
        });
      }
    }
  });

  return vault.archiveDeliveries;
}

export function isAnimalBountyHelper(item) {
  if (!item) return false;
  if (item.category === 'animal' || item.type === 'animal') return true;
  if (item.level !== undefined && item.level !== null) return true;
  if (item.tier !== undefined && item.tier !== null) return true;
  const rawName = typeof item === 'string' ? item : (item.name || '');
  const animalKeywords = ['cow', 'sheep', 'chicken', 'bull', 'pig', 'duck', 'goat', 'animal'];
  const lowerName = rawName.toLowerCase();
  if (animalKeywords.some(kw => lowerName.includes(kw))) return true;
  if (/(?:lvl|level|#|\()\s*(\d+)/i.test(rawName)) return true;
  return false;
}

export function isManualBountyHelper(item) {
  if (!item) return false;
  return Boolean(item.isManual) || (typeof item.id === 'string' && item.id.startsWith('manual_'));
}

export function hasWeeklyBountiesBonusHelper(bountiesList) {
  if (!Array.isArray(bountiesList) || bountiesList.length === 0) return false;
  const regularBounties = bountiesList.filter(b => !isAnimalBountyHelper(b) && !isManualBountyHelper(b));
  if (regularBounties.length === 0) return false;
  return regularBounties.every(b => {
    if (!b || b.isSkipped) return false;
    return b.checked !== undefined ? Boolean(b.checked) : Boolean(b.completed);
  });
}

export function recomputeVaultCumulative(vault) {
  const isVip = Boolean(vault.isVipActive);
  const vipBonus = isVip ? 2 : 0;
  const currentWeekMonday = getMondayBasedWeekId();
  const KNOWN_DOUBLE_DELIVERY_DATES = ['2026-09-02'];
  const doubleDatesSet = new Set(KNOWN_DOUBLE_DELIVERY_DATES);

  let totalTickets = (vault.trackTickets || 0) + (vault.dailyLoginTickets || 0);
  let totalCost = (vault.trackCost || 0);

  const npcDoubleClaimed = new Set();
  const sortedDeliveries = [...(vault.archiveDeliveries || [])].sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));

  sortedDeliveries.forEach(d => {
    const isDone = (d.checked !== undefined ? d.checked : Boolean(d.completed)) && !d.isSkipped;
    if (isDone) {
      const baseTix = d.baseTickets !== undefined ? d.baseTickets : (d.tickets || 2);
      const isManual = Boolean(d.isManual);
      const isStacked = Boolean(d.isStacked);
      const compDate = d.completedDate || (d.completedAt ? new Date(d.completedAt).toISOString().split('T')[0] : '');
      const isDoubleDay = doubleDatesSet.has(compDate);
      const npcClean = (d.from || d.name || '').toLowerCase().trim();
      const doubleKey = `${npcClean}_${compDate}`;

      let yieldAmt = baseTix;
      if (!isManual) {
        if (!isStacked && (d.hasDoubleBonus || (isDoubleDay && !npcDoubleClaimed.has(doubleKey)))) {
          yieldAmt = (baseTix + vipBonus) * 2;
          npcDoubleClaimed.add(doubleKey);
          d.hasDoubleBonus = true;
        } else {
          yieldAmt = (baseTix + vipBonus);
          d.hasDoubleBonus = false;
        }
      }
      totalTickets += yieldAmt;
      totalCost += (d.itemsCost || d.cost || 0);
    }
  });

  (vault.bounties || []).forEach(b => {
    if (b.checked !== undefined ? b.checked : Boolean(b.completed)) {
      totalTickets += (b.userTickets !== undefined ? b.userTickets : (b.baseTickets || b.tickets || 0));
      totalCost += (b.itemsCost || b.cost || 0);
    }
  });
  if (hasWeeklyBountiesBonusHelper(vault.bounties)) {
    totalTickets += 100;
  }

  (vault.chores || []).forEach(c => {
    if (c.checked !== undefined ? c.checked : Boolean(c.completed)) {
      const base = (c.userTickets !== undefined ? c.userTickets : (c.baseTickets || c.tickets || 1));
      totalTickets += c.isManual ? base : (base + vipBonus);
      totalCost += (c.itemsCost || c.cost || 0);
    }
  });

  Object.entries(vault.weeks || {}).forEach(([wkKey, wk]) => {
    if (wkKey === currentWeekMonday) return;
    (wk.bounties || []).forEach(b => {
      if (b.completed || b.checked) {
        totalTickets += (b.userTickets !== undefined ? b.userTickets : (b.baseTickets || b.tickets || 0));
        totalCost += (b.itemsCost || b.cost || 0);
      }
    });
    (wk.chores || []).forEach(c => {
      if (c.completed || c.checked) {
        const base = (c.userTickets !== undefined ? c.userTickets : (c.baseTickets || c.tickets || 1));
        totalTickets += c.isManual ? base : (base + vipBonus);
        totalCost += (c.itemsCost || c.cost || 0);
      }
    });
    if (hasWeeklyBountiesBonusHelper(wk.bounties)) {
      totalTickets += 100;
    }
  });

  vault.cumulativeTickets = totalTickets;
  vault.cumulativeCost = totalCost;
  return { totalTickets, totalCost };
}

export function cleanVaultDeliveriesAndSnapshots(vault) {
  if (!vault || typeof vault !== 'object') return false;
  let modified = false;

  // 1. Clean deliveries
  if (Array.isArray(vault.archiveDeliveries) && vault.archiveDeliveries.length > 0) {
    const origLen = vault.archiveDeliveries.length;
    
    // Identify burst completion timestamps (>3 completed deliveries sharing the exact same millisecond timestamp)
    const tsCounts = {};
    vault.archiveDeliveries.forEach(x => {
      if (x && x.completedAt) {
        tsCounts[x.completedAt] = (tsCounts[x.completedAt] || 0) + 1;
      }
    });
    const burstTimestamps = new Set(Object.keys(tsCounts).filter(k => tsCounts[k] > 3));

    const cleanedDeliveries = vault.archiveDeliveries.filter(x => {
      if (!x) return false;
      const isDone = Boolean(x.checked !== undefined ? x.checked : x.completed);
      const isSkip = Boolean(x.isSkipped);
      if (!isDone && !isSkip) return true; // keep active deliveries

      // Filter out deliveries completed before Chapter 16 start (Nov 8, 2026)
      const dt = x.completedDate || (x.completedAt ? new Date(x.completedAt).toISOString().split('T')[0] : '');
      if (dt && dt < '2026-11-08') return false;

      // Filter out duplicate _2, _3 suffix cards
      if (x.id && /_d\d+_\d+$/.test(String(x.id))) return false;

      // Filter out burst synthetic deliveries
      if (x.completedAt && burstTimestamps.has(String(x.completedAt))) return false;

      // Filter out phantom 0-cost completed deliveries with no items
      if (isDone && !x.isManual && (x.cost === 0 || !x.cost) && (!x.itemDetails || x.itemDetails.length === 0) && (!x.items || Object.keys(x.items).length === 0)) {
        return false;
      }

      return true;
    });

    if (cleanedDeliveries.length !== origLen) {
      vault.archiveDeliveries = cleanedDeliveries;
      modified = true;
    }
  }

  // 2. Normalize npcSnapshots: keep only canonical keys, remove ghost alias keys
  if (vault.npcSnapshots && typeof vault.npcSnapshots === 'object') {
    const aliasMap = {
      'pete': "pumpkin' pete",
      'pumpkin pete': "pumpkin' pete",
      'corny': 'cornwell',
      'findlay': 'finley',
      'tyreless timmy': 'timmy'
    };
    Object.entries(aliasMap).forEach(([alias, canonical]) => {
      if (vault.npcSnapshots[alias]) {
        if (!vault.npcSnapshots[canonical] || (vault.npcSnapshots[alias].deliveryCount > (vault.npcSnapshots[canonical].deliveryCount || 0))) {
          vault.npcSnapshots[canonical] = vault.npcSnapshots[alias];
        }
        delete vault.npcSnapshots[alias];
        modified = true;
      }
    });
  }

  // 3. Clean today's log if it has burst / phantom entries
  if (Array.isArray(vault.logs) && vault.logs.length > 0) {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLog = vault.logs.find(l => l.date === todayStr);
    if (todayLog && Array.isArray(todayLog.deliveriesDone) && todayLog.deliveriesDone.length > 10) {
      const realDeliveriesToday = (vault.archiveDeliveries || []).filter(d => {
        const isDone = (d.checked !== undefined ? d.checked : Boolean(d.completed)) && !d.isSkipped && !d.isManual;
        const compDate = d.completedDate || (d.completedAt ? new Date(d.completedAt).toISOString().split('T')[0] : '');
        return isDone && compDate === todayStr;
      });

      const isVip = Boolean(vault.isVipActive);
      const vipBonus = isVip ? 2 : 0;
      let dayTix = 0;
      let dayCost = 0;
      todayLog.deliveriesDone = realDeliveriesToday.map(d => {
        const base = d.baseTickets !== undefined ? d.baseTickets : (d.tickets || 2);
        const wasDouble = Boolean(d.hasDoubleBonus) && !Boolean(d.isStacked);
        const yieldAmt = wasDouble ? (base + vipBonus) * 2 : (base + vipBonus);
        const c = d.itemsCost || d.cost || 0;
        dayTix += yieldAmt;
        dayCost += c;
        return {
          name: d.name || d.from,
          yield: yieldAmt,
          cost: c,
          weekId: d.weekId || getMondayBasedWeekId()
        };
      });
      todayLog.ticketsSaved = dayTix;
      todayLog.costSaved = dayCost;
      modified = true;
    }
  }

  // 4. Recalculate cumulative
  if (modified) {
    recomputeVaultCumulative(vault);
  }

  return modified;
}

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const action = searchParams.get('action') || (req.query && req.query.action);

  let client;
  try {
    client = await pool.connect();
    if (action === 'register' || action === 'init') {
      await ensureTableExists(client);
    }

    // ==========================================
    // ACTION: REGISTER
    // ==========================================
    if (action === 'register' && req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { username, password, farmId } = body || {};

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }

      if (!farmId || !String(farmId).trim()) {
        return res.status(400).json({ error: 'A valid Sunflower Land Farm ID is required to register.' });
      }

      const cleanUser = username.trim().toLowerCase();
      const cleanFarmId = String(farmId).trim();
      const existing = await client.query('SELECT username FROM user_vaults WHERE username = $1', [cleanUser]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Username already exists. Please login instead.' });
      }

      const passwordHash = hashPassword(password);
      const authData = { passwordHash, createdAt: new Date().toISOString() };
      const vaultData = {
        farmId: cleanFarmId,
        trackTickets: 0,
        trackCost: 0,
        targetRatio: 0,
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

      // Auto-heal vault if it contains dirty/phantom delivery bursts or pre-chapter-16 tasks
      const wasLoginHealed = cleanVaultDeliveriesAndSnapshots(vaultData);
      if (wasLoginHealed) {
        await client.query(
          'UPDATE user_vaults SET vault_data = $1 WHERE username = $2',
          [JSON.stringify(vaultData), cleanUser]
        );
      }

      const chapterLogsRes = await client.query(
        'SELECT chapter_id, chapter_title, archived_at, is_locked, summary_data FROM user_chapter_logs WHERE username = $1 ORDER BY archived_at DESC',
        [cleanUser]
      );
      vaultData.chapterLogs = chapterLogsRes.rows.map(r => {
        const parsed = typeof r.summary_data === 'string' ? JSON.parse(r.summary_data) : r.summary_data;
        return {
          ...parsed,
          chapterId: r.chapter_id,
          chapterTitle: r.chapter_title,
          chapterEndDate: parsed?.chapterEndDate || (r.chapter_id === 'ascension_age_15' ? '2026-11-02T00:00:00.000Z' : undefined),
          archivedAt: r.archived_at,
          isLocked: Boolean(r.is_locked)
        };
      });

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

      // Auto-migrate to Cave Dwellers on vault retrieval if not already migrated:
      if (vaultData.activeChapter !== 'cave_dwellers_16') {
        try {
          const checkAsc = await client.query(
            'SELECT id FROM user_chapter_logs WHERE username = $1 AND chapter_id = $2',
            [cleanUser, 'ascension_age_15']
          );
          if (checkAsc.rows.length === 0 && (vaultData.archiveDeliveries?.length > 0 || Object.keys(vaultData.weeks || {}).length > 0)) {
            await client.query(`
              INSERT INTO user_chapter_logs (username, chapter_id, chapter_title, archived_at, is_locked, summary_data)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (username, chapter_id) DO NOTHING
            `, [
              cleanUser,
              'ascension_age_15',
              'Ascension Age (Chapter 15)',
              new Date().toISOString(),
              true,
              JSON.stringify({
                chapterEndDate: '2026-11-02T00:00:00.000Z',
                deliveriesCount: (vaultData.archiveDeliveries || []).length,
                trackTickets: vaultData.trackTickets || 0
              })
            ]);
          }
        } catch (archErr) {
          console.warn('Auto chapter snapshot warning in getVault:', archErr);
        }

        // Reset old deliveries, tasks and historical weeks for Chapter 16
        vaultData.activeChapter = 'cave_dwellers_16';
        vaultData.archiveDeliveries = [];
        vaultData.npcSnapshots = {};
        vaultData.weeks = {};
        vaultData.bounties = [];
        vaultData.chores = [];
        vaultData.trackTickets = 0;
        vaultData.trackCost = 0;

        await client.query(
          'UPDATE user_vaults SET vault_data = $1 WHERE username = $2',
          [JSON.stringify(vaultData), cleanUser]
        );
      }

      const chapterLogsRes = await client.query(
        'SELECT chapter_id, chapter_title, archived_at, is_locked, summary_data FROM user_chapter_logs WHERE username = $1 ORDER BY archived_at DESC',
        [cleanUser]
      );
      vaultData.chapterLogs = chapterLogsRes.rows.map(r => {
        const parsed = typeof r.summary_data === 'string' ? JSON.parse(r.summary_data) : r.summary_data;
        return {
          ...parsed,
          chapterId: r.chapter_id,
          chapterTitle: r.chapter_title,
          chapterEndDate: parsed?.chapterEndDate || (r.chapter_id === 'ascension_age_15' ? '2026-11-02T00:00:00.000Z' : undefined),
          archivedAt: r.archived_at,
          isLocked: Boolean(r.is_locked)
        };
      });

      // Auto-heal vault if it contains dirty/phantom delivery bursts or pre-chapter-16 tasks
      const wasHealed = cleanVaultDeliveriesAndSnapshots(vaultData);
      if (wasHealed) {
        await client.query(
          'UPDATE user_vaults SET vault_data = $1 WHERE username = $2',
          [JSON.stringify(vaultData), cleanUser]
        );
      }

      return res.status(200).json({ success: true, vaultData });
    }

    // ==========================================
    // ACTION: REPAIR VAULT
    // ==========================================
    if (action === 'repairVault') {
      const username = searchParams.get('username') || (req.query && req.query.username) || (req.body && req.body.username);
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

      cleanVaultDeliveriesAndSnapshots(vaultData);

      await client.query(
        'UPDATE user_vaults SET vault_data = $1 WHERE username = $2',
        [JSON.stringify(vaultData), cleanUser]
      );

      return res.status(200).json({ success: true, message: `Vault for ${cleanUser} cleaned and repaired successfully.`, vaultData });
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

      // Defend npcSnapshots against stale client overwrite:
      // Never allow incoming client payload to downgrade delivery counts or re-introduce ghost aliases
      const safeNpcSnapshots = { ...(existingVault.npcSnapshots || {}) };
      if (body.npcSnapshots && typeof body.npcSnapshots === 'object') {
        Object.entries(body.npcSnapshots).forEach(([k, v]) => {
          if (!v || typeof v !== 'object') return;
          const cleanK = (k === 'pumpkin pete' || k === 'pete') ? "pumpkin' pete" : (k === 'corny' ? 'cornwell' : (k === 'findlay' ? 'finley' : (k === 'tyreless timmy' ? 'timmy' : k)));
          const prev = safeNpcSnapshots[cleanK] || { deliveryCount: 0, skippedCount: 0 };
          safeNpcSnapshots[cleanK] = {
            deliveryCount: Math.max(prev.deliveryCount || 0, v.deliveryCount || 0),
            skippedCount: Math.max(prev.skippedCount || 0, v.skippedCount || 0),
            deliveryCompletedAt: v.deliveryCompletedAt || prev.deliveryCompletedAt || null,
            choreCount: Math.max(prev.choreCount || 0, v.choreCount || 0)
          };
        });
      }
      delete safeNpcSnapshots['pete'];
      delete safeNpcSnapshots['pumpkin pete'];
      delete safeNpcSnapshots['corny'];
      delete safeNpcSnapshots['findlay'];
      delete safeNpcSnapshots['tyreless timmy'];

      const updatedVault = {
        ...existingVault,
        ...body,
        npcSnapshots: safeNpcSnapshots,
        chapterPoints: body.chapterPoints !== undefined ? Number(body.chapterPoints) : (existingVault.chapterPoints || 0),
        trackTickets: body.trackTickets !== undefined ? body.trackTickets : (existingVault.trackTickets || 0),
        coinRatio: body.coinRatio !== undefined ? (body.coinRatio === 0 || body.coinRatio === '0' || body.coinRatio === 'free' ? 0 : (parseFloat(body.coinRatio) || 1000)) : (existingVault.coinRatio !== undefined ? existingVault.coinRatio : 1000),
        targetRatio: body.targetRatio !== undefined ? (parseFloat(body.targetRatio) || 0) : (existingVault.targetRatio || 0),
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
    // ACTION: GET CHAPTER LOGS (Dedicated Table)
    // ==========================================
    if (action === 'getChapterLogs') {
      const username = searchParams.get('username') || (req.query && req.query.username) || (req.body && req.body.username);
      if (!username) {
        return res.status(400).json({ error: 'Username required.' });
      }

      const cleanUser = username.trim().toLowerCase();
      const logsRes = await client.query(
        'SELECT chapter_id, chapter_title, archived_at, is_locked, summary_data FROM user_chapter_logs WHERE username = $1 ORDER BY archived_at DESC',
        [cleanUser]
      );

      const chapterLogs = logsRes.rows.map(r => {
        const parsed = typeof r.summary_data === 'string' ? JSON.parse(r.summary_data) : r.summary_data;
        return {
          ...parsed,
          chapterId: r.chapter_id,
          chapterTitle: r.chapter_title,
          chapterEndDate: parsed?.chapterEndDate || (r.chapter_id === 'ascension_age_15' ? '2026-11-02T00:00:00.000Z' : undefined),
          archivedAt: r.archived_at,
          isLocked: Boolean(r.is_locked)
        };
      });

      return res.status(200).json({ success: true, chapterLogs });
    }

    // ==========================================
    // ACTION: SAVE CHAPTER LOG (Dedicated Table)
    // ==========================================
    if (action === 'saveChapterLog' && req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { username, chapterLog } = body || {};

      if (!username || !chapterLog) {
        return res.status(400).json({ error: 'Username and chapterLog required.' });
      }

      const cleanUser = username.trim().toLowerCase();
      const chapterId = chapterLog.chapterId || 'cave_dwellers_16';
      const chapterTitle = chapterLog.chapterTitle || 'Cave Dwellers (Chapter 16)';

      // Check if already locked in database
      const checkRes = await client.query(
        'SELECT is_locked FROM user_chapter_logs WHERE username = $1 AND chapter_id = $2',
        [cleanUser, chapterId]
      );
      if (checkRes.rows.length > 0 && checkRes.rows[0].is_locked) {
        return res.status(403).json({ error: '🔒 This chapter has ended and is permanently locked. It cannot be overwritten.' });
      }

      const CHAPTER_END_MS = Date.UTC(2027, 1, 1, 0, 0, 0); // Feb 1, 2027 00:00:00 UTC
      const isLocked = Boolean(chapterLog.isLocked || Date.now() >= CHAPTER_END_MS);
      const chapterEndDate = chapterLog.chapterEndDate || new Date(CHAPTER_END_MS).toISOString();

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
        cleanUser,
        chapterId,
        chapterTitle,
        chapterLog.archivedAt || new Date().toISOString(),
        isLocked,
        JSON.stringify({ ...chapterLog, chapterEndDate, isLocked })
      ]);

      const logsRes = await client.query(
        'SELECT chapter_id, chapter_title, archived_at, is_locked, summary_data FROM user_chapter_logs WHERE username = $1 ORDER BY archived_at DESC',
        [cleanUser]
      );

      const chapterLogs = logsRes.rows.map(r => {
        const parsed = typeof r.summary_data === 'string' ? JSON.parse(r.summary_data) : r.summary_data;
        return {
          ...parsed,
          chapterId: r.chapter_id,
          chapterTitle: r.chapter_title,
          chapterEndDate: parsed?.chapterEndDate || (r.chapter_id === 'ascension_age_15' ? '2026-11-02T00:00:00.000Z' : undefined),
          archivedAt: r.archived_at,
          isLocked: Boolean(r.is_locked)
        };
      });

      return res.status(200).json({ success: true, chapterLogs });
    }

    // ==========================================
    // ACTION: DELETE CHAPTER LOG (Dedicated Table)
    // ==========================================
    if (action === 'deleteChapterLog' && req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { username, chapterId } = body || {};

      if (!username || !chapterId) {
        return res.status(400).json({ error: 'Username and chapterId required.' });
      }

      const cleanUser = username.trim().toLowerCase();

      // Check lock status - locked archives cannot be deleted
      const checkRes = await client.query(
        'SELECT is_locked FROM user_chapter_logs WHERE username = $1 AND chapter_id = $2',
        [cleanUser, chapterId]
      );
      if (checkRes.rows.length > 0 && checkRes.rows[0].is_locked) {
        return res.status(403).json({ error: '🔒 Locked chapter archives cannot be deleted.' });
      }

      await client.query(
        'DELETE FROM user_chapter_logs WHERE username = $1 AND chapter_id = $2',
        [cleanUser, chapterId]
      );

      return res.status(200).json({ success: true, deletedChapterId: chapterId });
    }

    // ==========================================
    // ACTION: LOOKUP FARM BY USERNAME
    // ==========================================
    if (action === 'lookupFarm' || action === 'lookupUser') {
      const targetUsername = searchParams.get('username') || (req.query && req.query.username) || '';
      if (!targetUsername) {
        return res.status(400).json({ success: false, error: 'Username is required.' });
      }
      try {
        const cleanUser = targetUsername.trim();
        const sflWorldUrl = `https://sfl.world/api/v1/land/info/username/${encodeURIComponent(cleanUser)}`;
        const resp = await fetch(sflWorldUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          signal: AbortSignal.timeout(10000)
        });
        if (!resp.ok) {
          return res.status(resp.status).json({ 
            success: false, 
            error: resp.status === 404 ? `Username "${cleanUser}" was not found on Sunflower Land.` : 'Failed to lookup user on sfl.world.' 
          });
        }
        const data = await resp.json();
        return res.status(200).json({ success: true, data });
      } catch (err) {
        return res.status(500).json({ success: false, error: err.message || 'Lookup request failed.' });
      }
    }

    // ==========================================
    // ACTION: GET LEADERBOARD
    // ==========================================
    if (action === 'getLeaderboard') {
      let targetFarmId = searchParams.get('farmId') || (req.query && req.query.farmId) || '';
      const limit = searchParams.get('limit') || (req.query && req.query.limit) || '100';
      const userApiKey = searchParams.get('apiKey') || (req.query && req.query.apiKey) || process.env.SFL_API_KEY || '';
      const reqUser = searchParams.get('username') || (req.query && req.query.username) || '';

      if (!targetFarmId && reqUser) {
        const cleanUser = reqUser.trim();
        try {
          const uRes = await client.query('SELECT vault_data FROM user_vaults WHERE username = $1', [cleanUser.toLowerCase()]);
          if (uRes.rows.length > 0) {
            const v = typeof uRes.rows[0].vault_data === 'string' ? JSON.parse(uRes.rows[0].vault_data) : uRes.rows[0].vault_data;
            if (v && v.farmId) targetFarmId = String(v.farmId).trim();
          }
        } catch (dbErr) {
          // ignore db error, proceed to fallback lookup
        }

        // Fallback to sfl.world API to resolve username to farm_id
        if (!targetFarmId) {
          try {
            const sflWorldRes = await fetch(`https://sfl.world/api/v1/land/info/username/${encodeURIComponent(cleanUser)}`, {
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(6000)
            });
            if (sflWorldRes.ok) {
              const sflWorldData = await sflWorldRes.json();
              if (sflWorldData && sflWorldData.farm_id) {
                targetFarmId = String(sflWorldData.farm_id).trim();
              }
            }
          } catch (lookupErr) {
            // ignore lookup error and fallback
          }
        }
      }

      const sflHeaders = {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://sunflower-land.com/',
        'Origin': 'https://sunflower-land.com'
      };
      if (userApiKey) sflHeaders['x-api-key'] = userApiKey;

      const url = `https://api.sunflower-land.com/community/data?type=ticketLeaderboard${targetFarmId ? `&farmId=${encodeURIComponent(targetFarmId)}` : ''}&limit=${encodeURIComponent(limit)}`;

      const cacheKey = `${targetFarmId || 'all'}_${limit}`;
      const cached = leaderboardCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < LEADERBOARD_CACHE_TTL_MS)) {
        return res.status(200).json({ success: true, data: cached.data, cached: true });
      }

      try {
        let sflRes = await fetch(url, { headers: sflHeaders, signal: AbortSignal.timeout(12000) });

        if (!sflRes.ok && process.env.SFL_API_KEY && userApiKey !== process.env.SFL_API_KEY) {
          sflHeaders['x-api-key'] = process.env.SFL_API_KEY;
          sflRes = await fetch(url, { headers: sflHeaders, signal: AbortSignal.timeout(12000) });
        }

        if (sflRes.status === 429) {
          if (cached && cached.data) {
            return res.status(200).json({ success: true, data: cached.data, cached: true, rateLimited: true });
          }
          await new Promise(r => setTimeout(r, 1200));
          sflRes = await fetch(url, { headers: sflHeaders, signal: AbortSignal.timeout(12000) });
        }

        const text = await sflRes.text();
        let data = null;
        try {
          data = JSON.parse(text);
        } catch (jsonErr) {
          if (cached && cached.data) {
            return res.status(200).json({ success: true, data: cached.data, cached: true });
          }
          if (sflRes.status === 429) {
            return res.status(429).json({ success: false, error: 'Sunflower Land leaderboard is temporarily rate-limited. Please try again shortly.' });
          }
          return res.status(sflRes.status >= 400 ? sflRes.status : 502).json({
            success: false,
            error: `Upstream error (${sflRes.status}) parsing leaderboard.`
          });
        }

        if (data && data.error) {
          if (cached && cached.data) {
            return res.status(200).json({ success: true, data: cached.data, cached: true });
          }
          return res.status(sflRes.status >= 400 ? sflRes.status : 400).json({ success: false, error: data.error });
        }

        const lbPayload = (data && data.data) ? data.data : data;
        leaderboardCache.set(cacheKey, { timestamp: Date.now(), data: lbPayload });
        return res.status(200).json({ success: true, data: lbPayload });
      } catch (err) {
        if (cached && cached.data) {
          return res.status(200).json({ success: true, data: cached.data, cached: true });
        }
        return res.status(503).json({ success: false, error: err.message || 'Failed to fetch leaderboard.' });
      }
    }

    let farmId = searchParams.get('farmId') || (req.query && req.query.farmId) || '';
    const apiKey = searchParams.get('apiKey') || (req.query && req.query.apiKey) || process.env.SFL_API_KEY || '';
    const username = searchParams.get('username') || (req.query && req.query.username) || '';

    if (!farmId && username) {
      const cleanUser = username.trim().toLowerCase();
      const uRes = await client.query('SELECT vault_data FROM user_vaults WHERE username = $1', [cleanUser]);
      if (uRes.rows.length > 0) {
        const v = typeof uRes.rows[0].vault_data === 'string' ? JSON.parse(uRes.rows[0].vault_data) : uRes.rows[0].vault_data;
        if (v && v.farmId) farmId = String(v.farmId).trim();
      }
    }

    if (!farmId) {
      return res.status(400).json({ error: 'Farm ID is required.' });
    }

    // Parallelize live prices, farm data, and leaderboard rank fetching for maximum performance
    const [priceMap, sflFetchResult, userRank] = await Promise.all([
      getLivePriceMap(),
      (async () => {
        const sflHeaders = {
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://sunflower-land.com/',
          'Origin': 'https://sunflower-land.com'
        };
        if (apiKey) sflHeaders['x-api-key'] = apiKey;

        let sflRes = await fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { 
          headers: sflHeaders,
          signal: AbortSignal.timeout(10000)
        });

        let usedBackupKey = false;
        let apiKeyInvalid = false;

        // Backup route: if user's API key returned an error (e.g. 401 Unauthorized or 403 Forbidden), use our system API key
        if (!sflRes.ok && apiKey) {
          apiKeyInvalid = (sflRes.status === 401 || sflRes.status === 403);
          console.warn(`User-provided API key returned status ${sflRes.status}. Attempting backup route with system API key...`);

          const backupHeaders = {
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://sunflower-land.com/',
            'Origin': 'https://sunflower-land.com'
          };
          if (process.env.SFL_API_KEY) {
            backupHeaders['x-api-key'] = process.env.SFL_API_KEY;
          }

          try {
            const backupRes = await fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, {
              headers: backupHeaders,
              signal: AbortSignal.timeout(10000)
            });
            if (backupRes.ok) {
              sflRes = backupRes;
              usedBackupKey = true;
              console.log(`Backup route succeeded for farm #${farmId}!`);
            }
          } catch (backupErr) {
            console.warn('Backup fetch warning:', backupErr.message);
          }
        }

        if (sflRes.status === 429) {
          console.warn(`Upstream 429 rate limit hit for farm #${farmId}. Waiting 1500ms before retry...`);
          await new Promise(r => setTimeout(r, 1500));
          try {
            const retryHeaders = {
              'Accept': 'application/json, text/plain, */*',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://sunflower-land.com/',
              'Origin': 'https://sunflower-land.com'
            };
            if (process.env.SFL_API_KEY) retryHeaders['x-api-key'] = process.env.SFL_API_KEY;
            else if (apiKey) retryHeaders['x-api-key'] = apiKey;

            const retryRes = await fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, {
              headers: retryHeaders,
              signal: AbortSignal.timeout(10000)
            });
            if (retryRes.ok) {
              sflRes = retryRes;
              console.log(`429 retry succeeded for farm #${farmId}!`);
            }
          } catch (retryErr) {
            console.warn('429 retry warning:', retryErr.message);
          }
        }

        return { sflRes, usedBackupKey, apiKeyInvalid };
      })(),
      (async () => {
        try {
          const lbHeaders = {
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://sunflower-land.com/',
            'Origin': 'https://sunflower-land.com'
          };
          if (apiKey) lbHeaders['x-api-key'] = apiKey;
          else if (process.env.SFL_API_KEY) lbHeaders['x-api-key'] = process.env.SFL_API_KEY;

          let lbRes = await fetch(`https://api.sunflower-land.com/community/data?type=ticketLeaderboard&farmId=${encodeURIComponent(farmId)}&limit=1`, {
            headers: lbHeaders,
            signal: AbortSignal.timeout(8000)
          });
          if (!lbRes.ok && process.env.SFL_API_KEY && lbHeaders['x-api-key'] !== process.env.SFL_API_KEY) {
            lbHeaders['x-api-key'] = process.env.SFL_API_KEY;
            lbRes = await fetch(`https://api.sunflower-land.com/community/data?type=ticketLeaderboard&farmId=${encodeURIComponent(farmId)}&limit=1`, {
              headers: lbHeaders,
              signal: AbortSignal.timeout(8000)
            });
          }
          if (lbRes.ok) {
            const lbJson = await lbRes.json();
            const lbData = lbJson.data || lbJson;
            const details = Array.isArray(lbData.farmRankingDetails) ? lbData.farmRankingDetails : [];
            const topList = Array.isArray(lbData.topTen) ? lbData.topTen : (Array.isArray(lbData.ranking) ? lbData.ranking : []);
            let found = details.find(r => String(r.farmId) === String(farmId));
            if (!found && topList.length > 0) {
              const idx = topList.findIndex(r => String(r.farmId) === String(farmId));
              if (idx !== -1) found = { ...topList[idx], rank: topList[idx].rank || (idx + 1) };
            }
            if (found && found.rank) {
              return {
                rank: found.rank,
                count: found.count,
                id: found.id || '',
                experience: found.experience || 0,
                ascensionLevel: found.ascensionLevel || 0,
                farmId: found.farmId
              };
            }
          }
        } catch (lbErr) {
          console.warn('Leaderboard rank fetch warning:', lbErr.message);
        }
        return null;
      })()
    ]);

    const { sflRes, usedBackupKey, apiKeyInvalid } = sflFetchResult;

    if (!sflRes.ok) {
      if (sflRes.status === 401 || apiKeyInvalid) {
        return res.status(401).json({
          error: 'The API key you entered is incorrect'
        });
      }
      if (sflRes.status === 429) {
        if (username) {
          const cleanUser = username.trim().toLowerCase();
          try {
            const uRes = await client.query('SELECT vault_data FROM user_vaults WHERE username = $1', [cleanUser]);
            if (uRes.rows.length > 0) {
              const vData = typeof uRes.rows[0].vault_data === 'string' ? JSON.parse(uRes.rows[0].vault_data) : uRes.rows[0].vault_data;
              if (vData) {
                console.log(`[Rate Limit Fallback] Upstream SFL 429 for #${farmId}. Serving cached vault data for "${cleanUser}".`);
                cleanVaultDeliveriesAndSnapshots(vData);
                return res.status(200).json({
                  rateLimited: true,
                  isCachedFallback: true,
                  message: '⏳ Sunflower Land is temporarily rate-limiting live requests. Displaying your last saved cloud data.',
                  vaultData: vData,
                  deliveries: vData.deliveries || vData.archiveDeliveries || [],
                  bounties: vData.bounties || [],
                  chores: vData.chores || [],
                  milestones: vData.milestones || {},
                  isDoubleDeliveryActive: false,
                  doubleDeliveryDates: [],
                  isVipActive: Boolean(vData.isVipActive),
                  chapterPoints: vData.chapterPoints || 0,
                  userRank: userRank || null
                });
              }
            }
          } catch (dbErr) {
            console.warn('Vault fallback query error:', dbErr.message);
          }
        }
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

    let payload = null;
    try {
      payload = await sflRes.json();
    } catch (parseErr) {
      return res.status(502).json({
        error: 'Sunflower Land API returned an invalid response. Please try again in a moment.'
      });
    }

    if (!payload || typeof payload !== 'object' || payload.error) {
      return res.status(400).json({ error: payload?.error || 'Failed to parse farm payload from Sunflower Land.' });
    }
    const farm = payload.farm || payload;

    const coinRatioQuery = searchParams.get('coinRatio');
    let userCoinRatio = null;
    if (coinRatioQuery === '0' || coinRatioQuery === 'free') {
      userCoinRatio = 0;
    } else if (coinRatioQuery && parseFloat(coinRatioQuery) > 0) {
      userCoinRatio = parseFloat(coinRatioQuery);
    }

    let userVault = null;
    let cleanUser = null;
    if (username) {
      cleanUser = username.trim().toLowerCase();
      const uRes = await client.query('SELECT vault_data FROM user_vaults WHERE username = $1', [cleanUser]);
      if (uRes.rows.length > 0) {
        userVault = typeof uRes.rows[0].vault_data === 'string' ? JSON.parse(uRes.rows[0].vault_data) : uRes.rows[0].vault_data;
        if (userCoinRatio === null && userVault.coinRatio !== undefined) {
          const cv = userVault.coinRatio;
          userCoinRatio = (cv === 0 || cv === '0' || cv === 'free') ? 0 : parseFloat(cv);
        }
      }
    }

    const isFree = userCoinRatio === 0 || userCoinRatio === '0' || userCoinRatio === 'free';
    const finalCoinRatio = isFree ? 0 : ((userCoinRatio && userCoinRatio > 0) ? userCoinRatio : 1000);
    priceMap['sfl_coin_rate'] = finalCoinRatio;
    priceMap['coins'] = isFree ? 0 : (1 / finalCoinRatio);
    priceMap['coin'] = isFree ? 0 : (1 / finalCoinRatio);

    const parsed = parseFarmData(farm, priceMap, payload);

    if (userVault && cleanUser) {
      userVault.coinRatio = finalCoinRatio;

      // Auto-migrate to Cave Dwellers (Chapter 16):
      // If user vault active chapter is not cave_dwellers_16, archive old chapter data and reset deliveries/tasks!
      if (userVault.activeChapter !== 'cave_dwellers_16') {
        try {
          const checkAsc = await client.query(
            'SELECT id FROM user_chapter_logs WHERE username = $1 AND chapter_id = $2',
            [cleanUser, 'ascension_age_15']
          );
          if (checkAsc.rows.length === 0 && (userVault.archiveDeliveries?.length > 0 || Object.keys(userVault.weeks || {}).length > 0)) {
            await client.query(`
              INSERT INTO user_chapter_logs (username, chapter_id, chapter_title, archived_at, is_locked, summary_data)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (username, chapter_id) DO NOTHING
            `, [
              cleanUser,
              'ascension_age_15',
              'Ascension Age (Chapter 15)',
              new Date().toISOString(),
              true,
              JSON.stringify({
                chapterEndDate: '2026-11-02T00:00:00.000Z',
                deliveriesCount: (userVault.archiveDeliveries || []).length,
                trackTickets: userVault.trackTickets || 0
              })
            ]);
          }
        } catch (archErr) {
          console.warn('Auto chapter snapshot warning:', archErr);
        }

        // Reset old deliveries and tasks for Chapter 16
        userVault.activeChapter = 'cave_dwellers_16';
        userVault.archiveDeliveries = [];
        userVault.npcSnapshots = {};
        userVault.weeks = {};
        userVault.bounties = [];
        userVault.chores = [];
        userVault.trackTickets = 0;
        userVault.trackCost = 0;
      }

      reconcileDeliveriesWithNpcs(userVault, parsed.deliveryList, parsed.npcsData);

      const activeChapterPoints = parsed.chapterPoints || 0;
      userVault.chapterPoints = activeChapterPoints;
      userVault.isVipActive = parsed.isVipActive;
      if (activeChapterPoints > 0) {
        userVault.trackTickets = calculateTrackTickets(activeChapterPoints, parsed.isVipActive, 'Cave Dwellers');
      }

        const currentWeekMonday = getMondayBasedWeekId(new Date());
        if (!userVault.weeks) userVault.weeks = {};
        if (!userVault.weeks[currentWeekMonday]) {
          preserveCustomTaskEdits(parsed.activeBounties, userVault.bounties, false);
          preserveCustomTaskEdits(parsed.choresList, userVault.chores, true);
          userVault.weeks[currentWeekMonday] = {
            weekId: currentWeekMonday,
            bounties: parsed.activeBounties || [],
            chores: parsed.choresList || []
          };
        } else {
          const currentWk = userVault.weeks[currentWeekMonday];
          const isMan = (x) => Boolean(x?.isManual) || (typeof x?.id === 'string' && x.id.startsWith('manual_'));
          const savedManualChores = (currentWk.chores || []).filter(isMan);
          const savedManualBounties = (currentWk.bounties || []).filter(isMan);

          // Preserve user edited tickets and costs on active tasks
          preserveCustomTaskEdits(parsed.activeBounties, currentWk.bounties || userVault.bounties, false);
          preserveCustomTaskEdits(parsed.choresList, currentWk.chores || userVault.chores, true);

          currentWk.chores = [...(parsed.choresList || []), ...savedManualChores];
          currentWk.bounties = [...(parsed.activeBounties || []), ...savedManualBounties];
        }

        userVault.bounties = userVault.weeks[currentWeekMonday].bounties;
        userVault.chores = userVault.weeks[currentWeekMonday].chores;

        // Populate completed past-week bounties from SFL into their historical week bucket (Chapter 16 only)
        (parsed.activeBounties || []).forEach(b => {
          if (b.completed && b.completedDate) {
            const bWeekId = getMondayBasedWeekId(b.completedDate);
            if (bWeekId && bWeekId >= '2026-11-02' && bWeekId !== currentWeekMonday) {
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

        const chapterLogsRes = await client.query(
          'SELECT chapter_id, chapter_title, archived_at, is_locked, summary_data FROM user_chapter_logs WHERE username = $1 ORDER BY archived_at DESC',
          [cleanUser]
        );
        userVault.chapterLogs = chapterLogsRes.rows.map(r => {
          const parsed = typeof r.summary_data === 'string' ? JSON.parse(r.summary_data) : r.summary_data;
          return {
            ...parsed,
            chapterId: r.chapter_id,
            chapterTitle: r.chapter_title,
            chapterEndDate: parsed?.chapterEndDate || (r.chapter_id === 'ascension_age_15' ? '2026-11-02T00:00:00.000Z' : undefined),
            archivedAt: r.archived_at,
            isLocked: Boolean(r.is_locked)
          };
        });
      }

    const curWkId = getMondayBasedWeekId(new Date());
    return res.status(200).json({
      success: true,
      farmId,
      pricesLoadedCount: Object.keys(priceMap).length,
      isVipActive: parsed.isVipActive,
      isDoubleDeliveryActive: parsed.isDoubleDeliveryActive,
      doubleDeliveryDates: parsed.doubleDeliveryDates,
      chapterPoints: parsed.chapterPoints || 0,
      trackTickets: userVault ? (userVault.trackTickets || 0) : (parsed.chapterPoints > 0 ? calculateTrackTickets(parsed.chapterPoints, parsed.isVipActive, 'Cave Dwellers') : 0),
      coinRatio: finalCoinRatio,
      usedBackupKey,
      apiKeyInvalid,
      milestones: parsed.liveMilestones,
      deliveries: parsed.deliveryList,
      archiveDeliveries: userVault ? (userVault.archiveDeliveries || []) : [],
      bounties: userVault?.weeks?.[curWkId]?.bounties || parsed.activeBounties,
      chores: userVault?.weeks?.[curWkId]?.chores || parsed.choresList,
      userRank: userRank || null,
      vaultData: userVault
    });
  } catch (err) {
    if (err.message.includes('401') || err.message.toLowerCase().includes('api key')) {
      return res.status(401).json({ error: 'The API key you entered is incorrect' });
    }
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
}
