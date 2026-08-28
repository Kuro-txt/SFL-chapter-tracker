export const state = {
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

export function sanitizeDeliveries(deliveries) {
  if (!Array.isArray(deliveries)) return [];

  const map = new Map();

  const sorted = [...deliveries].sort((a, b) => {
    const aDone = Boolean(a.checked !== undefined ? a.checked : a.completed);
    const bDone = Boolean(b.checked !== undefined ? b.checked : b.completed);
    if (aDone !== bDone) return aDone ? -1 : 1;
    return (b.itemsCost || b.cost || 0) - (a.itemsCost || a.cost || 0);
  });

  for (const d of sorted) {
    if (!d) continue;
    const npc = (d.from || d.name || '').toLowerCase().trim();
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

    let canonicalId = d.id || '';
    if (isMan) {
      canonicalId = (d.id && d.id.startsWith('manual_')) ? d.id : `manual_${npc}_${d.completedAt || d.completedDate || Date.now()}`;
    } else if (isDone) {
      const count = d.deliveryCountAtCreation;
      canonicalId = (count !== undefined && count !== null && count !== '') 
        ? `deliv_${npc}_d${count}` 
        : `deliv_${npc}_d${d.completedAt || d.completedDate || '1'}`;
      d.completed = true;
      d.checked = true;
      d.isSkipped = false;
      d.status = 'completed';
    } else if (isSkip) {
      const skipCount = d.skippedCountAtCreation;
      canonicalId = `deliv_${npc}_skip_${skipCount || d.completedDate || '1'}`;
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
    }

    d.id = canonicalId;

    if (!map.has(canonicalId)) {
      map.set(canonicalId, d);
    } else {
      const existing = map.get(canonicalId);
      if ((!existing.itemDetails || existing.itemDetails.length === 0) && d.itemDetails && d.itemDetails.length > 0) {
        existing.itemDetails = d.itemDetails;
        existing.items = d.items;
        existing.itemsCost = d.itemsCost;
        existing.cost = d.cost;
      }
    }
  }

  return Array.from(map.values());
}

export function getDeliveryRecords() {
  const rawList = state.globalData?.archiveDeliveries || state.globalData?.deliveries || [];
  const cleanList = sanitizeDeliveries(rawList);
  if (state.globalData) {
    state.globalData.archiveDeliveries = cleanList;
  }
  return cleanList;
}
