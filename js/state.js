import { BASELINE_RESOURCE_PRICES } from './item-maps.js';

export const state = {
  globalData: null,
  currentUser: null, 
  activeColumnType: null,
  currentVaultData: null,
  priceMap: null
};

export const SFL_FLOWER_ITEMS = new Set([
  'red pansy', 'yellow pansy', 'purple pansy', 'white pansy', 'blue pansy',
  'sunpetal bloom', 'prism petal', 'celestial frostbloom',
  'red cosmos', 'yellow cosmos', 'purple cosmos', 'white cosmos', 'blue cosmos',
  'red balloon flower', 'yellow balloon flower', 'purple balloon flower', 'white balloon flower', 'blue balloon flower',
  'red carnation', 'yellow carnation', 'purple carnation', 'white carnation', 'blue carnation',
  'red lotus', 'yellow lotus', 'purple lotus', 'white lotus', 'blue lotus',
  'red daffodil', 'yellow daffodil', 'purple daffodil', 'white daffodil', 'blue daffodil',
  'primula', 'edelweiss', 'gladiolus', 'lavender', 'clover', 'marigold'
]);

export function formatSFL(num) {
  if (num === null || num === undefined || isNaN(num)) return "0.000";
  return Number(num).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export function setElemText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

export function setElemHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

export function getActiveBoostCount() {
  let count = 0;
  if (typeof document !== 'undefined') {
    if (document.getElementById('boost1')?.checked) count++;
    if (document.getElementById('boost2')?.checked) count++;
    if (document.getElementById('boost3')?.checked) count++;
  }
  return count;
}

export const DEFAULT_BOOST_COSTS = {
  boost1: { amount: 5000, currency: 'coins' },
  boost2: { amount: 5, currency: 'sfl' },
  boost3: { amount: 25, currency: 'sfl' }
};

export function getCoinRatio() {
  if (typeof document !== 'undefined') {
    const select = document.getElementById('coinRatioSelect');
    if (select && select.value === '0') return 0;
    const el = document.getElementById('coinsPerSflInput');
    if (el) {
      const s = String(el.value).trim().toLowerCase();
      if (s === '0' || s === 'free') return 0;
      const num = parseFloat(s);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  const stateVal = state.currentVaultData?.coinRatio !== undefined
    ? state.currentVaultData.coinRatio
    : state.globalData?.coinRatio;
  if (stateVal === 0 || stateVal === '0' || stateVal === 'free') return 0;
  if (stateVal && parseFloat(stateVal) > 0) return parseFloat(stateVal);
  if (typeof localStorage !== 'undefined') {
    const localVal = localStorage.getItem('sfl_coin_ratio');
    if (localVal === '0' || localVal === 'free') return 0;
    const num = parseFloat(localVal);
    if (!isNaN(num) && num > 0) return num;
  }
  return 1000;
}

export function sanitizeBoostCosts(cfg) {
  const result = {
    boost1: { amount: 5000, currency: 'coins' },
    boost2: { amount: 5, currency: 'sfl' },
    boost3: { amount: 25, currency: 'sfl' }
  };
  if (!cfg || typeof cfg !== 'object') return result;

  ['boost1', 'boost2', 'boost3'].forEach(k => {
    if (cfg[k] && typeof cfg[k] === 'object') {
      const amt = parseFloat(cfg[k].amount);
      const curr = String(cfg[k].currency || '').toLowerCase();
      result[k] = {
        amount: !isNaN(amt) && amt >= 0 ? amt : result[k].amount,
        currency: (curr === 'sfl' || curr === 'coins') ? curr : result[k].currency
      };
    }
  });
  return result;
}

export function getBoostCostsConfig() {
  try {
    const fromVault = state.currentVaultData?.boostCosts || state.globalData?.boostCosts;
    if (fromVault && typeof fromVault === 'object') {
      return sanitizeBoostCosts(fromVault);
    }
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('sfl_boost_costs') : null;
    if (raw) {
      return sanitizeBoostCosts(JSON.parse(raw));
    }
  } catch (e) {}
  return {
    boost1: { amount: 5000, currency: 'coins' },
    boost2: { amount: 5, currency: 'sfl' },
    boost3: { amount: 25, currency: 'sfl' }
  };
}

export function saveBoostCostsConfig(config) {
  const sanitized = sanitizeBoostCosts(config);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sfl_boost_costs', JSON.stringify(sanitized));
    }
  } catch (e) {}
  if (state.currentVaultData) state.currentVaultData.boostCosts = sanitized;
  if (state.globalData) state.globalData.boostCosts = sanitized;
  return sanitized;
}

// ==========================================
// CUSTOM RESOURCE PRICES
// ==========================================

export function sanitizeCustomPrices(cfg) {
  if (!cfg || typeof cfg !== 'object') return {};
  const result = {};
  for (const [k, v] of Object.entries(cfg)) {
    const cleanKey = String(k).toLowerCase().trim();
    if (!cleanKey) continue;
    if (v === '' || v === null || v === undefined) continue;
    const num = parseFloat(v);
    if (!isNaN(num) && num >= 0) {
      result[cleanKey] = num;
    }
  }
  return result;
}

export function getCustomPrices() {
  try {
    const fromVault = state.currentVaultData?.customPrices || state.globalData?.customPrices;
    if (fromVault && typeof fromVault === 'object') {
      return sanitizeCustomPrices(fromVault);
    }
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('sfl_custom_prices') : null;
    if (raw) {
      return sanitizeCustomPrices(JSON.parse(raw));
    }
  } catch (e) {}
  return {};
}

export function saveCustomPricesConfig(config) {
  const sanitized = sanitizeCustomPrices(config);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sfl_custom_prices', JSON.stringify(sanitized));
    }
  } catch (e) {}
  if (state.currentVaultData) state.currentVaultData.customPrices = sanitized;
  if (state.globalData) state.globalData.customPrices = sanitized;
  return sanitized;
}

export const COIN_TOOL_RECIPES = {
  'axe': { coins: 20 },
  'pickaxe': { wood: 3, coins: 16 },
  'stone pickaxe': { wood: 3, stone: 5, coins: 16 },
  'iron pickaxe': { wood: 3, iron: 5, coins: 64 },
  'gold pickaxe': { wood: 3, gold: 3, coins: 80 },
  'rod': { wood: 3, stone: 1, coins: 20 }
};

export function computeToolPrice(toolName, overrides = {}, coinRatio = null) {
  const norm = String(toolName || '').toLowerCase().trim();
  const recipe = COIN_TOOL_RECIPES[norm];
  if (!recipe) return 0;

  const ratio = coinRatio !== null ? coinRatio : getCoinRatio();
  const isFree = ratio === 0 || ratio === '0' || ratio === 'free';
  const coinPrice = isFree ? 0 : (ratio && Number(ratio) > 0 ? 1 / Number(ratio) : 1 / 1000);

  let cost = 0;
  for (const [ing, qty] of Object.entries(recipe)) {
    if (ing === 'coins' || ing === 'coin') {
      cost += qty * coinPrice;
    } else {
      let ingUnitPrice;
      if (overrides[ing] !== undefined) {
        ingUnitPrice = overrides[ing];
      } else if (state.priceMap && state.priceMap[ing] !== undefined && state.priceMap[ing] > 0) {
        ingUnitPrice = state.priceMap[ing];
      } else {
        const fallbacks = BASELINE_RESOURCE_PRICES || { wood: 0.0103, stone: 0.0204, iron: 0.0408, gold: 0.0815 };
        ingUnitPrice = fallbacks[ing] || 0;
      }
      cost += qty * ingUnitPrice;
    }
  }
  return cost;
}

export function applyCustomPricesToItems() {
  const overrides = getCustomPrices();
  const coinRatio = getCoinRatio();

  function updateItem(item) {
    if (!item) return;

    if (Array.isArray(item.itemDetails) && item.itemDetails.length > 0) {
      item.itemDetails.forEach(det => {
        if (!det) return;
        const cName = (det.name || '').toLowerCase().trim();

        if (cName === 'coins' || cName === 'coin') {
          if (overrides['coins'] !== undefined) {
            det.unitPrice = overrides['coins'];
            det.lineCost = (typeof det.qty === 'number' ? det.qty : parseFloat(det.qty) || 0) * overrides['coins'];
          } else if (overrides['coin'] !== undefined) {
            det.unitPrice = overrides['coin'];
            det.lineCost = (typeof det.qty === 'number' ? det.qty : parseFloat(det.qty) || 0) * overrides['coin'];
          }
          return;
        }

        if (det.marketUnitPrice === undefined) {
          det.marketUnitPrice = det.unitPrice !== undefined ? det.unitPrice : 0;
        }
        if (det.marketLineCost === undefined) {
          det.marketLineCost = det.lineCost !== undefined ? det.lineCost : 0;
        }

        const qty = typeof det.qty === 'number' ? det.qty : parseFloat(det.qty) || 0;
        if (overrides[cName] !== undefined) {
          det.unitPrice = overrides[cName];
          det.lineCost = qty * overrides[cName];
          det.isCustomPrice = true;
        } else if (COIN_TOOL_RECIPES[cName]) {
          const dynamicPrice = computeToolPrice(cName, overrides, coinRatio);
          det.unitPrice = dynamicPrice;
          det.lineCost = qty * dynamicPrice;
          delete det.isCustomPrice;
        } else {
          det.unitPrice = det.marketUnitPrice;
          det.lineCost = qty * det.marketUnitPrice;
          delete det.isCustomPrice;
        }
      });

      if (!item.isCustomCost && item.userCost === undefined) {
        const totalCost = item.itemDetails.reduce((sum, d) => sum + (d.lineCost || 0), 0);
        item.itemsCost = totalCost;
        item.cost = totalCost;
      }
    } else if (item.items && typeof item.items === 'object') {
      if (item.baseMarketCost === undefined) {
        item.baseMarketCost = item.cost !== undefined ? item.cost : 0;
      }
      let hasCustom = false;
      let calculatedCost = 0;
      Object.entries(item.items).forEach(([ingName, qty]) => {
        const cName = ingName.toLowerCase().trim();
        const numQty = typeof qty === 'number' ? qty : parseFloat(qty) || 0;
        if (overrides[cName] !== undefined) {
          hasCustom = true;
          calculatedCost += numQty * overrides[cName];
        } else if (COIN_TOOL_RECIPES[cName]) {
          hasCustom = true;
          calculatedCost += numQty * computeToolPrice(cName, overrides, coinRatio);
        } else {
          const mktPrice = (state.priceMap && state.priceMap[cName] !== undefined && state.priceMap[cName] > 0)
            ? state.priceMap[cName]
            : (BASELINE_RESOURCE_PRICES[cName] || 0);
          calculatedCost += numQty * mktPrice;
        }
      });
      if (!item.isCustomCost && item.userCost === undefined) {
        if (hasCustom) {
          item.itemsCost = calculatedCost;
          item.cost = calculatedCost;
          item.isCustomPrice = true;
        } else if (item.baseMarketCost !== undefined) {
          item.itemsCost = item.baseMarketCost;
          item.cost = item.baseMarketCost;
          delete item.isCustomPrice;
        }
      }
    } else if (item.name && typeof item.name === 'string') {
      const rawName = item.name.toLowerCase().trim();
      const strippedName = rawName.replace(/\b(bounty|task)\b/gi, '').trim();
      const matchedKey = overrides[rawName] !== undefined ? rawName : (overrides[strippedName] !== undefined ? strippedName : null);

      if (item.baseMarketCost === undefined) {
        item.baseMarketCost = item.cost !== undefined ? item.cost : 0;
      }

      if (!item.isCustomCost && item.userCost === undefined) {
        if (matchedKey !== null) {
          item.cost = overrides[matchedKey];
          item.itemsCost = overrides[matchedKey];
          item.isCustomPrice = true;
        } else if (COIN_TOOL_RECIPES[rawName] || COIN_TOOL_RECIPES[strippedName]) {
          const toolKey = COIN_TOOL_RECIPES[rawName] ? rawName : strippedName;
          const dynamicPrice = computeToolPrice(toolKey, overrides, coinRatio);
          item.cost = dynamicPrice;
          item.itemsCost = dynamicPrice;
          delete item.isCustomPrice;
        } else if (item.baseMarketCost !== undefined) {
          item.cost = item.baseMarketCost;
          item.itemsCost = item.baseMarketCost;
          delete item.isCustomPrice;
        }
      }
    }
  }

  (state.globalData?.deliveries || []).forEach(updateItem);
  (state.globalData?.archiveDeliveries || []).forEach(updateItem);
  (state.globalData?.bounties || []).forEach(updateItem);
  (state.globalData?.archiveBounties || []).forEach(updateItem);
  (state.globalData?.chores || []).forEach(updateItem);
  (state.globalData?.archiveChores || []).forEach(updateItem);

  const weeks = state.globalData?.cloudHistory?.weeks || state.currentVaultData?.weeks || {};
  Object.values(weeks).forEach(wk => {
    if (!wk || typeof wk !== 'object') return;
    (wk.bounties || []).forEach(updateItem);
    (wk.chores || []).forEach(updateItem);
  });
}

export function getActiveBoostsCostSfl() {
  const config = getBoostCostsConfig();
  const ratio = getCoinRatio();
  let totalCost = 0;

  const isB1 = typeof document !== 'undefined' ? Boolean(document.getElementById('boost1')?.checked) : false;
  const isB2 = typeof document !== 'undefined' ? Boolean(document.getElementById('boost2')?.checked) : false;
  const isB3 = typeof document !== 'undefined' ? Boolean(document.getElementById('boost3')?.checked) : false;

  if (isB1 && config.boost1) {
    const amt = parseFloat(config.boost1.amount) || 0;
    totalCost += config.boost1.currency === 'coins' ? (ratio > 0 ? amt / ratio : 0) : amt;
  }
  if (isB2 && config.boost2) {
    const amt = parseFloat(config.boost2.amount) || 0;
    totalCost += config.boost2.currency === 'coins' ? (ratio > 0 ? amt / ratio : 0) : amt;
  }
  if (isB3 && config.boost3) {
    const amt = parseFloat(config.boost3.amount) || 0;
    totalCost += config.boost3.currency === 'coins' ? (ratio > 0 ? amt / ratio : 0) : amt;
  }

  return totalCost;
}

export function getActiveVipBonus() {
  if (typeof document === 'undefined') return 0;
  return document.getElementById('vipToggle')?.checked ? 2 : 0;
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

  if (!date || isNaN(date.getTime())) {
    date = new Date();
  }

  const day = date.getUTCDay();
  const utcDate = date.getUTCDate();
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  date.setUTCDate(utcDate + diffToMonday);
  const weekId = date.toISOString().split('T')[0];

  // In Chapter 16 (Cave Dwellers), Week 1 launched on Sunday Nov 08 (8-day week: Nov 08 – Nov 15).
  // Standard ISO Monday grouping assigns Sunday Nov 08 (and any 2026-11-02 legacy key) to 2026-11-02.
  // Re-map to Week 1's anchor Monday (2026-11-09).
  if (weekId === '2026-11-02') {
    return '2026-11-09';
  }

  return weekId;
}

export function isAnimalBounty(item) {
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

export function isManualBounty(item) {
  if (!item) return false;
  return Boolean(item.isManual) || (typeof item.id === 'string' && item.id.startsWith('manual_'));
}

export function hasWeeklyBountiesBonus(bountiesList) {
  if (!Array.isArray(bountiesList) || bountiesList.length === 0) return false;
  const regularBounties = bountiesList.filter(b => !isAnimalBounty(b) && !isManualBounty(b));
  if (regularBounties.length === 0) return false;
  return regularBounties.every(b => {
    if (!b || b.isSkipped) return false;
    return b.checked !== undefined ? Boolean(b.checked) : Boolean(b.completed);
  });
}

export function resolveAnimalLevel(item) {
  if (item.level) return item.level;
  if (item.tier) return item.tier;
  const rawName = typeof item === 'string' ? item : (item.name || '');
  const lvlMatch = rawName.match(/(?:lvl|level|#|\()\s*(\d+)/i);
  if (lvlMatch) return lvlMatch[1];

  if (state.globalData?.bounties) {
    const liveMatch = state.globalData.bounties.find(b => 
      (b.id && item.id && String(b.id) === String(item.id)) ||
      (b.name && rawName && b.name.toLowerCase() === rawName.toLowerCase())
    );
    if (liveMatch?.level) return liveMatch.level;
  }
  return null;
}

export function isLoginClaimedToday() {
  const todayUtc = new Date().toISOString().split('T')[0];
  const lastClaimed = state.currentVaultData?.lastDailyLoginDate || localStorage.getItem('sfl_daily_login_last_date');
  return lastClaimed === todayUtc;
}

export async function checkAndAutoClaimDailyLogin() {
  const todayUtc = new Date().toISOString().split('T')[0];
  const lastClaimed = state.currentVaultData?.lastDailyLoginDate || localStorage.getItem('sfl_daily_login_last_date');
  
  let count = state.currentVaultData?.dailyLoginTickets !== undefined
    ? parseInt(state.currentVaultData.dailyLoginTickets, 10)
    : parseInt(localStorage.getItem('sfl_daily_login_count') || '0', 10);

  if (isNaN(count)) count = 0;

  const loginInput = document.getElementById('dailyLoginCount');
  const loginCheck = document.getElementById('dailyLoginCheck');

  if (lastClaimed !== todayUtc) {
    count += 1;
    localStorage.setItem('sfl_daily_login_count', count);
    localStorage.setItem('sfl_daily_login_last_date', todayUtc);
    
    if (state.currentVaultData) {
      state.currentVaultData.dailyLoginTickets = count;
      state.currentVaultData.lastDailyLoginDate = todayUtc;
    }

    if (loginInput) loginInput.value = count;
    if (loginCheck) loginCheck.checked = true;

    try {
      const { recalculateAll } = await import('./render.js');
      recalculateAll();
      await syncCurrentVaultToCloud();
    } catch (e) {
      console.warn('Daily login sync warning:', e);
    }
  } else {
    if (loginInput) loginInput.value = count;
    if (loginCheck) loginCheck.checked = true;
  }
}

export async function handleDailyLoginToggle() {
  const loginCheck = document.getElementById('dailyLoginCheck');
  const loginInput = document.getElementById('dailyLoginCount');
  const todayUtc = new Date().toISOString().split('T')[0];
  let count = parseInt(loginInput?.value || '0', 10);
  if (isNaN(count)) count = 0;

  if (loginCheck?.checked) {
    count += 1;
    localStorage.setItem('sfl_daily_login_count', count);
    localStorage.setItem('sfl_daily_login_last_date', todayUtc);
    if (state.currentVaultData) {
      state.currentVaultData.dailyLoginTickets = count;
      state.currentVaultData.lastDailyLoginDate = todayUtc;
    }
    if (loginInput) loginInput.value = count;
  } else {
    count = Math.max(0, count - 1);
    localStorage.setItem('sfl_daily_login_count', count);
    localStorage.removeItem('sfl_daily_login_last_date');
    if (state.currentVaultData) {
      state.currentVaultData.dailyLoginTickets = count;
      state.currentVaultData.lastDailyLoginDate = null;
    }
    if (loginInput) loginInput.value = count;
  }

  try {
    const { recalculateAll } = await import('./render.js');
    recalculateAll();
    await syncCurrentVaultToCloud();
  } catch (e) {}
}

export async function syncCurrentVaultToCloud() {
  if (!state.currentUser || !state.globalData) return;
  try {
    const { saveProgressToCloudKV } = await import('./api.js');
    await saveProgressToCloudKV(true);
  } catch (err) {
    console.error('Auto-sync to Cloud failed:', err);
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

export function sanitizeDeliveries(deliveries) {
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

    // Normalize any legacy ID to be clean and alphanumeric
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

    // Disambiguate if two distinct completed deliveries share the same ID
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

export function getDeliveryRecords() {
  const archive = state.globalData?.archiveDeliveries || [];
  const board = state.globalData?.deliveries || [];
  const rawList = (archive.length === 0 && board.length === 0) ? [] : [...archive, ...board];
  const cleanList = sanitizeDeliveries(rawList);
  if (state.globalData) {
    state.globalData.archiveDeliveries = cleanList;
  }
  try {
    localStorage.setItem('sfl_archive_deliveries', JSON.stringify(cleanList));
  } catch (e) {}
  return cleanList;
}

export function recomputeCoinCosts(ratio) {
  const isFree = ratio === 0 || ratio === '0' || ratio === 'free';
  const newCoinPrice = isFree ? 0 : (ratio && Number(ratio) > 0 ? 1 / Number(ratio) : 1 / 1000);
  const currentOverrides = getCustomPrices();

  if (state.priceMap) {
    state.priceMap['coins'] = newCoinPrice;
    state.priceMap['coin'] = newCoinPrice;
    for (const toolName of Object.keys(COIN_TOOL_RECIPES)) {
      state.priceMap[toolName] = computeToolPrice(toolName, currentOverrides, isFree ? 0 : Number(ratio));
    }
  }

  function updateItem(item) {
    if (!item) return;
    let hasCoinItem = false;
    if (Array.isArray(item.itemDetails) && item.itemDetails.length > 0) {
      item.itemDetails.forEach(det => {
        const cName = (det.name || '').toLowerCase().trim();
        const qty = typeof det.qty === 'number' ? det.qty : parseFloat(det.qty) || 0;

        if (cName === 'coins' || cName === 'coin') {
          hasCoinItem = true;
          det.unitPrice = newCoinPrice;
          det.lineCost = qty * newCoinPrice;
        } else if (COIN_TOOL_RECIPES[cName] && !det.isCustomPrice && currentOverrides[cName] === undefined) {
          hasCoinItem = true;
          const dynamicPrice = computeToolPrice(cName, currentOverrides, isFree ? 0 : Number(ratio));
          det.unitPrice = dynamicPrice;
          det.lineCost = qty * dynamicPrice;
        }
      });
      if (hasCoinItem && !item.isCustomCost && item.userCost === undefined) {
        const totalCost = item.itemDetails.reduce((sum, d) => sum + (d.lineCost || 0), 0);
        item.itemsCost = totalCost;
        item.cost = totalCost;
      }
    } else if (item.items && typeof item.items === 'object') {
      Object.entries(item.items).forEach(([ingName, qty]) => {
        const cName = ingName.toLowerCase().trim();
        const numQty = typeof qty === 'number' ? qty : parseFloat(qty) || 0;
        if (cName === 'coins' || cName === 'coin') {
          hasCoinItem = true;
          if (!item.isCustomCost && item.userCost === undefined) {
            const coinCost = numQty * newCoinPrice;
            item.itemsCost = coinCost;
            item.cost = coinCost;
          }
        } else if (COIN_TOOL_RECIPES[cName] && currentOverrides[cName] === undefined) {
          hasCoinItem = true;
          if (!item.isCustomCost && item.userCost === undefined) {
            const toolCost = numQty * computeToolPrice(cName, currentOverrides, isFree ? 0 : Number(ratio));
            item.itemsCost = toolCost;
            item.cost = toolCost;
          }
        }
      });
    } else if (item.name && typeof item.name === 'string') {
      const rawName = item.name.toLowerCase().trim();
      const strippedName = rawName.replace(/\b(bounty|task)\b/gi, '').trim();
      const toolKey = COIN_TOOL_RECIPES[rawName] ? rawName : (COIN_TOOL_RECIPES[strippedName] ? strippedName : null);
      if (toolKey && currentOverrides[toolKey] === undefined && !item.isCustomPrice && !item.isCustomCost && item.userCost === undefined) {
        const dynamicPrice = computeToolPrice(toolKey, currentOverrides, isFree ? 0 : Number(ratio));
        item.cost = dynamicPrice;
        item.itemsCost = dynamicPrice;
      }
    }
  }

  // Update live deliveries & archive
  (state.globalData?.deliveries || []).forEach(updateItem);
  (state.globalData?.archiveDeliveries || []).forEach(updateItem);
  (state.globalData?.bounties || []).forEach(updateItem);
  (state.globalData?.archiveBounties || []).forEach(updateItem);
  (state.globalData?.chores || []).forEach(updateItem);
  (state.globalData?.archiveChores || []).forEach(updateItem);

  // Update historical weeks
  const weeks = state.globalData?.cloudHistory?.weeks || state.currentVaultData?.weeks || {};
  Object.values(weeks).forEach(wk => {
    if (!wk || typeof wk !== 'object') return;
    (wk.bounties || []).forEach(updateItem);
    (wk.chores || []).forEach(updateItem);
  });
}

export function preserveCustomDeliveryEdits(targetDeliveries, sourceDeliveries) {
  if (!Array.isArray(targetDeliveries) || !Array.isArray(sourceDeliveries)) return targetDeliveries;
  targetDeliveries.forEach(td => {
    if (!td || !td.id) return;
    const isDone = Boolean(td.checked !== undefined ? td.checked : td.completed);
    // Active deliveries must NEVER have or inherit custom costs
    if (!isDone || td.id.endsWith('_active')) {
      delete td.isCustomCost;
      delete td.userCost;
      return;
    }
    const match = sourceDeliveries.find(sd => sd && sd.id && sd.id === td.id);
    if (match && (match.isCustomCost || match.userCost !== undefined)) {
      td.cost = match.userCost !== undefined ? match.userCost : match.cost;
      td.itemsCost = td.cost;
      td.userCost = td.cost;
      td.isCustomCost = true;
    }
    if (match && (match.isCustomTickets || match.userTickets !== undefined)) {
      td.baseTickets = match.userTickets !== undefined ? match.userTickets : td.baseTickets;
      td.tickets = td.baseTickets;
      td.userTickets = td.baseTickets;
      td.isCustomTickets = true;
    }
  });
  return targetDeliveries;
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
          if (freshItem.level !== undefined && e.level !== undefined) {
            return Number(freshItem.level) === Number(e.level);
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

