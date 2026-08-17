import { SFL_RECIPES } from '../recipes.js';

export const CHAPTER_NPC_TICKETS = {
  'pumpkin pete': 2,
  "pumpkin' pete": 2,
  'blacksmith': 2,
  'betty': 2,
  'grimtooth': 2,
  'corny': 2,
  'tango': 2,
  'miranda': 2,
  'raven': 2,
  'finn': 2,
  'findlay': 2,
  'finley': 2,
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

export function extractRewardTickets(rewardObj) {
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

export function getDirectMarketPrice(name, priceMap) {
  if (!name || !priceMap) return 0;
  const clean = name.toLowerCase().trim();
  const stripped = clean.replace(/[^a-z0-9]/g, '');
  if (clean === 'coins' || clean === 'coin') return 0.001;

  const searchNames = [
    clean, stripped, clean.replace(/\s+/g, '-'), clean.replace(/\s+/g, '_'),
    clean + 's', clean + 'es',
    clean.endsWith('s') ? clean.slice(0, -1) : clean,
    clean.endsWith('es') ? clean.slice(0, -2) : clean,
    clean.endsWith('ies') ? clean.slice(0, -3) + 'y' : clean
  ];

  if (clean.endsWith(' a') || clean.endsWith(' b')) {
    const baseName = clean.slice(0, -2).trim();
    searchNames.push(baseName, baseName + ' a', baseName + ' b');
  }

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
  if (depth > 5 || !itemName) return 0;
  const clean = itemName.toLowerCase().trim();
  const stripped = clean.replace(/[^a-z0-9]/g, '');
  const directPrice = getDirectMarketPrice(clean, priceMap);
  if (directPrice > 0) return directPrice;

  const recipe = SFL_RECIPES[clean] || SFL_RECIPES[stripped];
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

export function parseFarmData(farm, priceMap) {
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

  // Calendar events
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

      let baseTicketCount = 0;
      if (b.reward) baseTicketCount = extractRewardTickets(b.reward);
      if (baseTicketCount === 0 && b.items) baseTicketCount = extractRewardTickets(b.items);
      if (baseTicketCount === 0 && typeof b.tickets === 'number') baseTicketCount = b.tickets;
      if (baseTicketCount === 0 && typeof b.coins === 'number' && b.coins > 0) baseTicketCount = 2;
      if (baseTicketCount === 0 && b.level !== undefined) baseTicketCount = 5;
      if (baseTicketCount === 0) baseTicketCount = 2;

      const uniqueKey = b.id ? String(b.id) : `${(bName || 'bounty').toLowerCase()}_${b.level || 0}`;
      if (seenBountyKeys.has(uniqueKey)) return;
      seenBountyKeys.add(uniqueKey);

      const unitPrice = bName ? getItemUnitPrice(bName, priceMap) : 0;
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
        name: bName || `Animal Bounty (Lvl ${b.level || 1})`,
        level: b.level || (b.category === 'animal' ? 1 : null),
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

  return {
    isVipActive,
    isDoubleDeliveryActive,
    liveMilestones,
    deliveryList,
    activeBounties,
    choresList
  };
}
