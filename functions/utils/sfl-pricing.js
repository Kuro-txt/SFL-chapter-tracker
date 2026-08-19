import { SFL_RECIPES } from '../../recipes.js';

export const CHAPTER_NPC_TICKETS = {
  "pumpkin' pete": 1,
  "bert": 2,
  "finley": 2,
  "raven": 4,
  "miranda": 2,
  "finn": 5,
  "pharaoh": 6,
  "cornwell": 3,
  "timmy": 5,
  "tywin": 10,
  "jester": 4
};

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

export function extractRewardTickets(rewardObj) {
  if (!rewardObj) return 0;
  let count = 0;
  const items = rewardObj.items || rewardObj;
  if (typeof items === 'object') {
    for (const [key, qty] of Object.entries(items)) {
      const lower = key.toLowerCase();
      if (
        lower.includes('ticket') || 
        lower.includes('feather') || 
        lower.includes('scale') || 
        lower.includes('scroll') ||
        lower.includes('token')
      ) {
        count += (typeof qty === 'number' ? qty : parseInt(qty) || 0);
      }
    }
  }
  return count;
}
