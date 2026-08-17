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
  if (num === null || num === undefined || isNaN(num)) return "0.00";
  return Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  if (!date || isNaN(date.getTime())) date = new Date();

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
  const lastClaimed = localStorage.getItem('sfl_daily_login_last_date');
  return lastClaimed === todayUtc;
}

export async function checkAndAutoClaimDailyLogin() {
  const todayUtc = new Date().toISOString().split('T')[0];
  const lastClaimed = localStorage.getItem('sfl_daily_login_last_date');
  let count = parseInt(localStorage.getItem('sfl_daily_login_count') || '0', 10);

  const loginInput = document.getElementById('dailyLoginCount');
  const loginCheck = document.getElementById('dailyLoginCheck');

  if (lastClaimed !== todayUtc) {
    count += 1;
    localStorage.setItem('sfl_daily_login_count', count);
    localStorage.setItem('sfl_daily_login_last_date', todayUtc);

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
    localStorage.setItem('sfl_daily_login_last_date', todayUtc);
  } else {
    count = Math.max(0, count - 1);
    localStorage.setItem('sfl_daily_login_count', count);
    localStorage.removeItem('sfl_daily_login_last_date');
    if (loginInput) loginInput.value = count;
  }

  try {
    await syncCurrentVaultToCloud();
  } catch (e) {}
}

export async function syncCurrentVaultToCloud() {
  if (!state.currentUser || !state.globalData) return;
  try {
    const trackTickets = parseInt(document.getElementById('trackTicketsInput')?.value, 10) || (state.globalData.cloudHistory?.trackTickets || 0);
    const trackCost = parseFloat(document.getElementById('trackCostInput')?.value) || (state.globalData.cloudHistory?.trackCost || 0);
    const dailyLoginTickets = parseInt(document.getElementById('dailyLoginCount')?.value, 10) || (state.globalData.cloudHistory?.dailyLoginTickets || 0);
    const lastDailyLoginDate = localStorage.getItem('sfl_daily_login_last_date') || new Date().toISOString().split('T')[0];
    const farmId = document.getElementById('farmId')?.value.trim() || state.globalData.cloudHistory?.farmId || '8472883706403914';

    if (!state.globalData.cloudHistory) state.globalData.cloudHistory = {};
    if (!state.globalData.cloudHistory.weeks) state.globalData.cloudHistory.weeks = {};

    const payload = {
      username: state.currentUser,
      farmId,
      trackTickets,
      trackCost,
      dailyLoginTickets,
      lastDailyLoginDate,
      milestones: state.globalData.milestones || {},
      logs: state.globalData.cloudHistory.logs || [],
      weeks: state.globalData.cloudHistory.weeks,
      bounties: state.globalData.bounties || [],
      chores: state.globalData.chores || [],
      deliveries: state.globalData.deliveries || []
    };

    const response = await fetch('/api/chapter?action=saveVault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const resData = await response.json();
    if (resData.vaultData) {
      state.currentVaultData = resData.vaultData;
      state.globalData.cloudHistory = resData.vaultData;
    }
  } catch (err) {
    console.error('Failed to auto-sync edit to Cloud KV:', err);
  }
}
