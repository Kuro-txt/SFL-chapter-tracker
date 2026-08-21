import { SFL_RECIPES } from '../recipes.js';

export const CHAPTER_NPC_TICKETS = {
  "pumpkin pete": 1,
  "pumpkin' pete": 1,
  "pete": 1,
  "bert": 2,
  "finley": 2,
  "findlay": 2,
  "miranda": 2,
  "cornwell": 3,
  "corny": 3,
  "raven": 4,
  "jester": 4,
  "finn": 5,
  "timmy": 5,
  "tyreless timmy": 5,
  "pharaoh": 6,
  "tywin": 10
};

export function extractRewardTickets(rewardObj) {
  if (!rewardObj || typeof rewardObj !== 'object') return 0;
  let count = 0;

  function scan(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, val] of Object.entries(obj)) {
      const cleanKey = key.toLowerCase().trim();
      if (
        cleanKey === 'shiny feather' ||
        cleanKey === 'shiny_feather' ||
        cleanKey === 'feather' ||
        cleanKey === 'chapter ticket' ||
        cleanKey === 'seasonal ticket' ||
        cleanKey.includes('feather')
      ) {
        if (typeof val === 'number' && val > 0) {
          count += val;
        } else if (typeof val === 'string' && !isNaN(parseInt(val, 10))) {
          count += parseInt(val, 10);
        }
      }
      if (val && typeof val === 'object' && !Array.isArray(val) && cleanKey !== 'coins' && cleanKey !== 'sfl') {
        scan(val);
      }
    }
  }

  scan(rewardObj);
  return count;
}

export function extractPricesRecursive(obj, map = {}) {
  if (!obj || typeof obj !== 'object') return map;
  if (Array.isArray(obj)) {
    obj.forEach(item => extractPricesRecursive(item, map));
    return map;
  }

  for (const [key, val] of Object.entries(obj)) {
    const cleanKey = key.toLowerCase().trim();
    const strippedKey = cleanKey.replace(/[^a-z0-9]/g, '');

    if (typeof val === 'number') {
      map[cleanKey] = val;
      map[strippedKey] = val;
    } else if (val && typeof val === 'object') {
      const priceVal = val.price ?? val.sfl ?? val.buy ?? val.cost ?? val.value ?? val.unitPrice;
      if (typeof priceVal === 'number') {
        map[cleanKey] = priceVal;
        map[strippedKey] = priceVal;
      }
      if (val.name && typeof val.name === 'string') {
        const itemClean = val.name.toLowerCase().trim();
        const itemStripped = itemClean.replace(/[^a-z0-9]/g, '');
        if (typeof priceVal === 'number') {
          map[itemClean] = priceVal;
          map[itemStripped] = priceVal;
        }
      }
      extractPricesRecursive(val, map);
    }
  }
  return map;
}

export function cleanItemName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/\b(spring|summer|autumn|winter)\b/g, '')
    .replace(/\s+[ab]$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getDirectMarketPrice(name, priceMap) {
  if (!name || !priceMap) return 0;
  const clean = name.toLowerCase().trim();
  const stripped = clean.replace(/[^a-z0-9]/g, '');
  if (clean === 'coins' || clean === 'coin') return 0.001;

  const baseClean = cleanItemName(clean);

  const searchNames = [
    clean, 
    stripped, 
    baseClean,
    baseClean.replace(/[^a-z0-9]/g, ''),
    clean.replace(/\s+/g, '-'), 
    clean.replace(/\s+/g, '_'),
    clean + 's', 
    clean + 'es',
    clean.endsWith('s') ? clean.slice(0, -1) : clean,
    clean.endsWith('es') ? clean.slice(0, -2) : clean,
    clean.endsWith('ies') ? clean.slice(0, -3) + 'y' : clean
  ];

  let lowestPrice = 0;
  for (const v of searchNames) {
    if (priceMap[v] !== undefined && priceMap[v] > 0) {
      if (lowestPrice === 0 || priceMap[v] < lowestPrice) {
        lowestPrice = priceMap[v];
      }
    }
  }
  return lowestPrice;
}

export function getItemUnitPrice(itemName, priceMap, depth = 0) {
  if (depth > 6 || !itemName) return 0;
  const clean = itemName.toLowerCase().trim();
  const stripped = clean.replace(/[^a-z0-9]/g, '');
  const baseName = cleanItemName(clean);
  const baseStripped = baseName.replace(/[^a-z0-9]/g, '');

  const directPrice = getDirectMarketPrice(clean, priceMap);
  if (directPrice > 0) return directPrice;

  const recipe = SFL_RECIPES[clean] || SFL_RECIPES[stripped] || SFL_RECIPES[baseName] || SFL_RECIPES[baseStripped];
  if (recipe) {
    let recipeTotal = 0;
    Object.entries(recipe).forEach(([ingName, ingQty]) => {
      recipeTotal += getItemUnitPrice(ingName, priceMap, depth + 1) * ingQty;
    });
    return recipeTotal;
  }
  return 0;
}

export function getMondayBasedWeekId(d) {
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

export function extractDoubleDeliveryDates(farm) {
  const dates = new Set();
  if (!farm || typeof farm !== 'object') return dates;

  const sources = [
    farm.calendar?.events,
    farm.calendar,
    farm.specialEvents,
    farm.events
  ];

  function scan(node, keyContext = '') {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      node.forEach(it => scan(it, keyContext));
      return;
    }

    const nameStr = String(node.name || node.title || node.type || node.event || keyContext || '').toLowerCase();
    const clean = nameStr.replace(/[^a-z0-9]/g, '');

    if (clean.includes('doubledelivery') || clean.includes('2xdelivery')) {
      if (node.date && typeof node.date === 'string') {
        dates.add(node.date.split('T')[0]);
      }
      if (typeof node.startDate === 'number' && typeof node.endDate === 'number') {
        let cur = new Date(node.startDate < 1e11 ? node.startDate * 1000 : node.startDate);
        const end = new Date(node.endDate < 1e11 ? node.endDate * 1000 : node.endDate);
        while (cur <= end) {
          dates.add(cur.toISOString().split('T')[0]);
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
      } else if (typeof node.startDate === 'number') {
        const dStr = new Date(node.startDate < 1e11 ? node.startDate * 1000 : node.startDate).toISOString().split('T')[0];
        dates.add(dStr);
      }
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(keyContext)) {
      const jsonStr = JSON.stringify(node).toLowerCase();
      if (jsonStr.includes('doubledelivery') || jsonStr.includes('2xdelivery')) {
        dates.add(keyContext);
      }
    }

    for (const [k, v] of Object.entries(node)) {
      if (v && typeof v === 'object') {
        scan(v, k);
      }
    }
  }

  sources.forEach(src => {
    if (src) scan(src);
  });

  return dates;
}

export function parseFarmData(farm, priceMap) {
  const isVipActive = !!(farm.vip?.expiresAt && farm.vip.expiresAt > Date.now());

  // 1. NPC Lifetime Stats
  const rawNpcs = farm.npcs || {};
  const npcsData = {};
  Object.entries(rawNpcs).forEach(([npcKey, npcVal]) => {
    if (!npcVal || typeof npcVal !== 'object') return;
    const cleanKey = npcKey.toLowerCase().trim();
    npcsData[cleanKey] = {
      deliveryCount: typeof npcVal.deliveryCount === 'number' ? npcVal.deliveryCount : 0,
      skippedCount: typeof npcVal.skippedCount === 'number' ? npcVal.skippedCount : 0,
      deliveryCompletedAt: typeof npcVal.deliveryCompletedAt === 'number' ? npcVal.deliveryCompletedAt : null,
      choreCount: typeof npcVal.choreCount === 'number' ? npcVal.choreCount : 0
    };
  });

  // 2. Deliveries from Live Board
  const deliveryList = [];
  (farm.delivery?.orders || []).forEach(order => {
    const npcClean = (order.from || '').toLowerCase().trim();

    if (CHAPTER_NPC_TICKETS[npcClean] !== undefined) {
      let totalTickets = extractRewardTickets(order.reward) || extractRewardTickets(order.rewardItems);
      if (totalTickets === 0) {
        totalTickets = CHAPTER_NPC_TICKETS[npcClean];
      }

      let itemsCost = 0;
      const itemDetails = [];
      Object.entries(order.items || {}).forEach(([itemName, qty]) => {
        const unitPrice = getItemUnitPrice(itemName, priceMap);
        const lineCost = unitPrice * qty;
        itemsCost += lineCost;
        itemDetails.push({ name: itemName, qty, unitPrice, lineCost });
      });

      const isCompleted = typeof order.completedAt === 'number' || order.status === 'completed' || order.completed === true;
      const npcStat = npcsData[npcClean] || { deliveryCount: 0, skippedCount: 0, deliveryCompletedAt: null };
      
      const canonicalId = isCompleted 
        ? `deliv_${npcClean}_d${npcStat.deliveryCount}` 
        : `deliv_${npcClean}_active`;

      deliveryList.push({
        id: canonicalId,
        from: order.from,
        name: order.from,
        items: order.items || {},
        itemsCost,
        cost: itemsCost,
        itemDetails,
        baseTickets: totalTickets,
        tickets: totalTickets,
        isChapterNpc: true,
        completed: isCompleted,
        checked: isCompleted,
        completedAt: typeof order.completedAt === 'number' ? order.completedAt : (isCompleted ? Date.now() : null),
        isStacked: false,
        deliveryCountAtCreation: isCompleted ? npcStat.deliveryCount : (npcStat.deliveryCount + 1),
        skippedCountAtCreation: npcStat.skippedCount,
        npcKey: npcClean
      });
    }
  });

  // Milestones
  const rawMilestones = farm.delivery?.milestones || farm.milestones || {};
  const liveMilestones = {};
  Object.entries(rawMilestones).forEach(([npc, count]) => {
    const cleanName = npc.toLowerCase().trim();
    if (CHAPTER_NPC_TICKETS[cleanName] !== undefined) {
      liveMilestones[cleanName] = count;
    }
  });

  // 3. Double Delivery Detection
  const doubleDeliveryDatesSet = extractDoubleDeliveryDates(farm);
  const nowMs = Date.now();
  const todayUtcStr = new Date(nowMs).toISOString().split('T')[0];
  const isDoubleDeliveryActive = doubleDeliveryDatesSet.has(todayUtcStr);

  // 4. Bounties (Only Shiny Feathers / Tickets)
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

  const rawBountySources = [
    farm.bounties?.requests,
    farm.bounties?.board,
    farm.bounties?.active,
    farm.bounties,
    farm.seasonBounties,
    farm.flowerBounties,
    farm.animalBounties
  ];

  rawBountySources.forEach(source => {
    if (!source) return;
    const items = Array.isArray(source) ? source : (typeof source === 'object' ? Object.values(source) : []);

    items.forEach(b => {
      if (!b || typeof b !== 'object') return;
      const bName = b.name || b.item || b.itemName || (b.items && Object.keys(b.items)[0]) || '';
      if (!bName && !b.id && b.level === undefined) return;

      const featherCount = extractRewardTickets(b.reward) || extractRewardTickets(b.items) || extractRewardTickets(b);
      if (featherCount <= 0) return;

      const uniqueKey = b.id ? String(b.id) : `${(bName || 'bounty').toLowerCase()}_${b.level || 0}`;
      if (seenBountyKeys.has(uniqueKey)) return;
      seenBountyKeys.add(uniqueKey);

      const unitPrice = bName ? getItemUnitPrice(bName, priceMap) : 0;
      const isCompleted = typeof b.completedAt === 'number' || b.completed === true || b.status === 'completed' || completedMap[String(b.id)] !== undefined;

      let completionTime = null;
      if (typeof b.completedAt === 'number') completionTime = b.completedAt;
      else if (typeof b.claimedAt === 'number') completionTime = b.claimedAt;
      else if (completedMap[String(b.id)] !== undefined && completedMap[String(b.id)] !== null) completionTime = completedMap[String(b.id)];

      activeBounties.push({
        id: b.id || uniqueKey,
        name: bName || `Animal Bounty (Lvl ${b.level || 1})`,
        level: b.level !== undefined ? b.level : (b.category === 'animal' ? 1 : null),
        baseTickets: featherCount,
        tickets: featherCount,
        cost: unitPrice,
        itemsCost: unitPrice,
        completed: isCompleted,
        checked: isCompleted,
        completedAt: completionTime,
        checkedToday: false
      });
    });
  });

  // 5. Chores
  const choreObj = farm.choreBoard?.chores || farm.chores || {};
  const choresList = [];

  Object.entries(choreObj).forEach(([key, details]) => {
    let featherCount = extractRewardTickets(details.reward);
    if (featherCount === 0 && typeof details.tickets === 'number') featherCount = details.tickets;
    if (featherCount === 0 && details.baseTickets) featherCount = details.baseTickets;

    if (featherCount > 0) {
      const currentProgress = details.initialProgress ?? details.progress ?? 0;
      const requirement = details.requirement ?? details.target ?? details.total ?? 0;
      const isCompleted = typeof details.completedAt === 'number' || details.completed === true || details.isCompleted === true || (requirement > 0 && currentProgress >= requirement);
      const completionTime = typeof details.completedAt === 'number' ? details.completedAt : null;
      const taskLabel = details.name || details.description || key;

      choresList.push({
        npc: details.npc || details.from || 'Chore NPC',
        name: taskLabel,
        task: taskLabel,
        baseTickets: featherCount,
        tickets: featherCount,
        cost: 0,
        itemsCost: 0,
        progress: currentProgress,
        requirement,
        completed: isCompleted,
        checked: isCompleted,
        completedAt: completionTime,
        checkedToday: false
      });
    }
  });

  return {
    isVipActive,
    isDoubleDeliveryActive,
    doubleDeliveryDates: Array.from(doubleDeliveryDatesSet),
    liveMilestones,
    deliveryList,
    activeBounties,
    choresList,
    npcsData
  };
}
