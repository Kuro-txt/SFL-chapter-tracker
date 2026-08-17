import { SFL_RECIPES } from '../recipes.js';

// Exact Chapter NPCs that reward Shiny Feathers / Chapter Tickets
export const CHAPTER_NPC_TICKETS = {
  "pumpkin pete": 1,
  "pumpkin' pete": 1,
  "pete": 1,
  "bert": 2,
  "finley": 2,
  "findlay": 2,
  "miranda": 2,
  "raven": 4,
  "jester": 4,
  "finn": 5,
  "timmy": 5,
  "tyreless timmy": 5,
  "pharaoh": 6,
  "cornwell": 3,
  "corny": 3,
  "tywin": 10,
  "blacksmith": 2,
  "betty": 2,
  "grimtooth": 2,
  "tango": 2,
  "greg": 2,
  "buttercup": 2,
  "misty": 2,
  "phobos": 2,
  "craig": 2,
  "peggy": 2,
  "flint": 2
};

export function extractRewardTickets(rewardObj) {
  if (!rewardObj) return 0;
  if (typeof rewardObj === 'number') return rewardObj;
  
  let count = 0;
  const items = rewardObj.items || rewardObj;
  
  if (typeof items === 'object') {
    for (const [key, qty] of Object.entries(items)) {
      const lower = key.toLowerCase();
      // Explicitly check for Shiny Feather and Seasonal/Chapter Tickets
      if (
        lower.includes('shiny feather') ||
        lower.includes('feather') ||
        lower.includes('ticket') || 
        lower.includes('scale') || 
        lower.includes('scroll') ||
        lower.includes('token') ||
        lower.includes('chapter') ||
        lower.includes('seasonal')
      ) {
        count += (typeof qty === 'number' ? qty : parseInt(qty, 10) || 0);
      }
    }
  }

  if (count === 0) {
    if (typeof rewardObj.tickets === 'number') count = rewardObj.tickets;
    else if (typeof rewardObj.rewardTickets === 'number') count = rewardObj.rewardTickets;
    else if (typeof rewardObj.baseTickets === 'number') count = rewardObj.baseTickets;
  }

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

  // Milestones: Filter ONLY for Chapter NPCs
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

  // 1. Deliveries: Filter strictly for ticket-rewarding NPCs
  const deliveryList = [];
  const npcOrderCounts = {};
  (farm.delivery?.orders || []).forEach(order => {
    const npcClean = (order.from || '').toLowerCase().trim();
    const isChapterNpc = CHAPTER_NPC_TICKETS[npcClean] !== undefined;

    let totalTickets = extractRewardTickets(order.reward) || extractRewardTickets(order.items);
    if (totalTickets === 0 && isChapterNpc) {
      totalTickets = CHAPTER_NPC_TICKETS[npcClean];
    }

    // STRICT FILTER: Only include if it explicitly awards Shiny Feathers/Tickets or is a confirmed Chapter NPC
    if (totalTickets > 0 && isChapterNpc) {
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
        isChapterNpc: true,
        completed: isCompleted,
        checked: isCompleted,
        completedAt: typeof order.completedAt === 'number' ? order.completedAt : (isCompleted ? Date.now() : null),
        isStacked: false
      });
    }
  });

  // 2. Bounties (Only include if rewarding Shiny Feathers / Chapter Tickets)
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

      let baseTicketCount = extractRewardTickets(b.reward) || extractRewardTickets(b.items) || (typeof b.tickets === 'number' ? b.tickets : 0);

      if (baseTicketCount === 0 && b.level !== undefined) {
        baseTicketCount = b.level >= 3 ? 6 : (b.level === 2 ? 4 : 2);
      }

      if (baseTicketCount <= 0) return;

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

  // 3. Chores (Only include if rewarding Shiny Feathers / Chapter Tickets)
  const choreObj = farm.choreBoard?.chores || farm.chores || {};
  const choresList = [];
  
  Object.entries(choreObj).forEach(([key, details]) => {
    let baseTicketCount = extractRewardTickets(details.reward) || (typeof details.tickets === 'number' ? details.tickets : 0) || details.baseTickets || 0;
    
    if (baseTicketCount > 0) {
      const currentProgress = details.initialProgress ?? details.progress ?? 0;
      const requirement = details.requirement ?? details.target ?? details.total ?? 0;
      const isCompleted = typeof details.completedAt === 'number' || details.completed === true || details.isCompleted === true || (requirement > 0 && currentProgress >= requirement);
      const completionTime = typeof details.completedAt === 'number' ? details.completedAt : null;
      const taskLabel = details.name || details.description || key;

      choresList.push({
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
      });
    }
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
