export const state = {
  globalData: null,
  currentUser: null,
  activeColumnType: null,
  currentVaultData: null
};

export const SFL_FLOWER_ITEMS = new Set([
  'red pansy', 'yellow pansy', 'purple pansy', 'white pansy', 'blue pansy',
  'sunpetal bloom', 'prism petal', 'celestial frostbloom',
  'red cosmos', 'yellow cosmoexport const state = {
  globalData: null,
  currentUser: null,
  activeColumnType: null,
  currentVaultData: null
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

export function getActiveBoostCount() {
  let count = 0;
  if (document.getElementById('boost1')?.checked) count++;
  if (document.getElementById('boost2')?.checked) count++;
  if (document.getElementById('boost3')?.checked) count++;
  return count;
}

export function getActiveVipBonus() {
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
  return date.toISOString().split('T')[0];
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
    } catch (e) {}
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

  if (loginCheck?.checked) {
    count += 1;
    localStorage.setItem('sfl_daily_login_count', count);
    localStorage.setItem('sfl_daily_login_last_date', todayUtc);
    if (loginInput) loginInput.value = count;
  } else {
    count = Math.max(0, count - 1);
    localStorage.setItem('sfl_daily_login_count', count);
    localStorage.removeItem('sfl_daily_login_last_date');
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

// 🎯 CANONICAL DEDUPLICATOR: Collapses all duplicates into 1 single record per delivery
export function sanitizeDeliveries(deliveries) {
  if (!Array.isArray(deliveries)) return [];

  const manualList = [];
  const initialMap = new Map();

  // Sort so completed items with item/recipe details are prioritized
  const sorted = [...deliveries].sort((a, b) => {
    const aDone = Boolean(a.checked !== undefined ? a.checked : a.completed);
    const bDone = Boolean(b.checked !== undefined ? b.checked : b.completed);
    if (aDone !== bDone) return aDone ? -1 : 1;
    const aCost = (a.itemsCost || a.cost || 0);
    const bCost = (b.itemsCost || b.cost || 0);
    return bCost - aCost;
  });

  for (const d of sorted) {
    if (!d) continue;
    const npc = (d.from || d.name || '').toLowerCase().trim();
    if (!npc) continue;

    if (d.isManual) {
      const manKey = `manual_${d.id || d.name}_${d.completedAt || d.completedDate || d.weekId || ''}`;
      if (!initialMap.has(manKey)) {
        initialMap.set(manKey, d);
      }
      continue;
    }

    const isDone = Boolean(d.checked !== undefined ? d.checked : d.completed) && !d.isSkipped;
    const isSkip = Boolean(d.isSkipped);

    let dateStr = d.completedDate || '';
    if (!dateStr && d.completedAt) {
      const ts = typeof d.completedAt === 'number' ? d.completedAt : Number(d.completedAt);
      if (!isNaN(ts) && ts > 0) {
        dateStr = new Date(ts < 1e11 ? ts * 1000 : ts).toISOString().split('T')[0];
      }
    }
    if (!dateStr) {
      dateStr = d.weekId || new Date().toISOString().split('T')[0];
    }
    d.completedDate = dateStr;

    let dedupeKey = '';
    if (isDone) {
      if (d.isStacked) {
        dedupeKey = `done_stacked_${npc}_${dateStr}_${d.id || d.deliveryCountAtCreation || '1'}`;
      } else {
        const countPart = d.deliveryCountAtCreation ? `_c${d.deliveryCountAtCreation}` : '';
        dedupeKey = countPart ? `done_${npc}${countPart}` : `done_${npc}_${dateStr}`;
      }
    } else if (isSkip) {
      const skipCountPart = d.skippedCountAtCreation ? `_sc${d.skippedCountAtCreation}` : '';
      dedupeKey = skipCountPart ? `skip_${npc}${skipCountPart}` : `skip_${npc}_${dateStr}`;
    } else {
      dedupeKey = `active_${npc}`;
    }

    if (!initialMap.has(dedupeKey)) {
      initialMap.set(dedupeKey, d);
    } else {
      const existing = initialMap.get(dedupeKey);
      if ((!existing.itemDetails || existing.itemDetails.length === 0) && d.itemDetails && d.itemDetails.length > 0) {
        existing.itemDetails = d.itemDetails;
        existing.items = d.items;
        existing.itemsCost = d.itemsCost;
        existing.cost = d.cost;
      }
      if (d.completed && !existing.completed) {
        existing.completed = true;
        existing.checked = true;
        existing.status = 'completed';
      }
    }
  }

  // 🎯 Second Pass: Collapse any non-stacked completed deliveries for the same NPC on the same day into exactly 1
  const finalMap = new Map();
  for (const [key, item] of initialMap.entries()) {
    const npc = (item.from || item.name || '').toLowerCase().trim();
    const isDone = Boolean(item.checked !== undefined ? item.checked : item.completed) && !item.isSkipped;

    if (isDone && !item.isManual && !item.isStacked) {
      const unifiedDayKey = `done_single_${npc}_${item.completedDate}`;
      if (!finalMap.has(unifiedDayKey)) {
        finalMap.set(unifiedDayKey, item);
      } else {
        const ex = finalMap.get(unifiedDayKey);
        if ((!ex.itemDetails || ex.itemDetails.length === 0) && item.itemDetails && item.itemDetails.length > 0) {
          ex.itemDetails = item.itemDetails;
          ex.items = item.items;
          ex.itemsCost = item.itemsCost;
          ex.cost = item.cost;
        }
      }
    } else {
      finalMap.set(key, item);
    }
  }

  return Array.from(finalMap.values());
}

// 🎯 SINGLE GROUND TRUTH GETTER: Always used by Render, Editor, Overview, and Cloud Sync
export function getDeliveryRecords() {
  const rawList = state.globalData?.archiveDeliveries || state.globalData?.deliveries || [];
  const cleanList = sanitizeDeliveries(rawList);
  if (state.globalData) {
    state.globalData.archiveDeliveries = cleanList;
  }
  return cleanList;
}
export function formatSFL(num) {
  if (num === null || num === undefined || isNaN(num)) return "0.000";
  return Number(num).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export function setElemText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

export function getActiveBoostCount() {
  let count = 0;
  if (document.getElementById('boost1')?.checked) count++;
  if (document.getElementById('boost2')?.checked) count++;
  if (document.getElementById('boost3')?.checked) count++;
  return count;
}

export function getActiveVipBonus() {
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
  return date.toISOString().split('T')[0];
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
    } catch (e) {}
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

  if (loginCheck?.checked) {
    count += 1;
    localStorage.setItem('sfl_daily_login_count', count);
    localStorage.setItem('sfl_daily_login_last_date', todayUtc);
    if (loginInput) loginInput.value = count;
  } else {
    count = Math.max(0, count - 1);
    localStorage.setItem('sfl_daily_login_count', count);
    localStorage.removeItem('sfl_daily_login_last_date');
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

// 🎯 Master Deduplicator: Collapses past duplicate entries by NPC & Canonical State
export function sanitizeDeliveries(deliveries) {
  if (!Array.isArray(deliveries)) return [];
  
  const manualList = [];
  const completedMap = new Map();
  const activeMap = new Map();
  const skippedMap = new Map();

  for (const d of deliveries) {
    if (!d) continue;
    const npc = (d.from || d.name || '').toLowerCase().trim();
    if (!npc) continue;

    if (d.isManual) {
      manualList.push(d);
      continue;
    }

    const isDone = Boolean(d.checked !== undefined ? d.checked : d.completed) && !d.isSkipped;
    const isSkip = Boolean(d.isSkipped);

    let dateStr = '';
    if (d.completedDate) {
      dateStr = d.completedDate;
    } else if (d.completedAt) {
      const ts = typeof d.completedAt === 'number' ? d.completedAt : Number(d.completedAt);
      if (!isNaN(ts) && ts > 0) {
        dateStr = new Date(ts < 1e11 ? ts * 1000 : ts).toISOString().split('T')[0];
      }
    }
    if (!dateStr) {
      dateStr = d.weekId || new Date().toISOString().split('T')[0];
    }

    if (isDone) {
      const count = d.deliveryCountAtCreation;
      const stackSuffix = d.isStacked ? `_stacked_${d.id || ''}` : '';
      const key = (count !== undefined && count !== null && count !== '')
        ? `${npc}_cnt_${count}`
        : `${npc}_date_${dateStr}${stackSuffix}`;

      if (!completedMap.has(key)) {
        d.completed = true;
        d.checked = true;
        d.isSkipped = false;
        d.status = 'completed';
        d.completedDate = dateStr;
        completedMap.set(key, d);
      } else {
        const existing = completedMap.get(key);
        if ((!existing.itemDetails || existing.itemDetails.length === 0) && d.itemDetails && d.itemDetails.length > 0) {
          existing.itemDetails = d.itemDetails;
          existing.items = d.items;
          existing.itemsCost = d.itemsCost;
          existing.cost = d.cost;
        }
      }
    } else if (isSkip) {
      const skipCount = d.skippedCountAtCreation;
      const key = (skipCount !== undefined && skipCount !== null && skipCount !== '')
        ? `${npc}_skip_${skipCount}`
        : `${npc}_skip_${dateStr}`;
      if (!skippedMap.has(key)) {
        d.completed = false;
        d.checked = false;
        d.isSkipped = true;
        d.status = 'skipped';
        d.completedDate = dateStr;
        skippedMap.set(key, d);
      }
    } else {
      if (!activeMap.has(npc)) {
        d.completed = false;
        d.checked = false;
        d.isSkipped = false;
        d.status = 'active';
        activeMap.set(npc, d);
      } else {
        const existing = activeMap.get(npc);
        if (d.itemDetails && d.itemDetails.length > 0) {
          existing.itemDetails = d.itemDetails;
          existing.items = d.items;
          existing.itemsCost = d.itemsCost;
          existing.cost = d.cost;
        }
      }
    }
  }

  return [
    ...activeMap.values(),
    ...completedMap.values(),
    ...skippedMap.values(),
    ...manualList
  ];
}

// 🎯 Single Ground Truth Getter for All Deliveries
export function getDeliveryRecords() {
  const rawList = state.globalData?.archiveDeliveries || state.globalData?.deliveries || [];
  const cleanList = sanitizeDeliveries(rawList);
  if (state.globalData) {
    state.globalData.archiveDeliveries = cleanList;
  }
  return cleanList;
}
