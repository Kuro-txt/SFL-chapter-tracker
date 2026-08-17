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

// 100% Robust UTC Monday Calculator (supports ISO strings like "2026-W32", dates, timestamps)
export function getMondayBasedWeekId(d) {
  let date;
  try {
    if (!d || d === 0 || d === '0') {
      date = new Date();
    } else if (typeof d === 'string') {
      const trimmed = d.trim();
      const isoWeekMatch = trimmed.match(/^(\d{4})-W(\d{1,2})$/i);
      if (isoWeekMatch) {
        const year = parseInt(isoWeekMatch[1], 10);
        const week = parseInt(isoWeekMatch[2], 10);
        const jan4 = new Date(Date.UTC(year, 0, 4));
        const dayOfWeek = jan4.getUTCDay() || 7;
        const monWeek1 = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000);
        date = new Date(monWeek1.getTime() + (week - 1) * 7 * 86400000);
      } else if (/^\d+$/.test(trimmed)) {
        const num = parseInt(trimmed, 10);
        date = new Date(num < 1e11 ? num * 1000 : num);
      } else {
        date = new Date(trimmed.includes('T') ? trimmed : `${trimmed}T00:00:00.000Z`);
      }
    } else if (typeof d === 'number') {
      date = new Date(d < 1e11 ? d * 1000 : d);
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

  const day = date.getUTCDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
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
      const { syncCurrentVaultToCloud } = await import('./modals.js');
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
    const { syncCurrentVaultToCloud } = await import('./modals.js');
    await syncCurrentVaultToCloud();
  } catch (e) {}
}
