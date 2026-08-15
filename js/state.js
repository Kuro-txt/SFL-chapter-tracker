export const state = {
  globalData: null,
  currentVaultData: null,
  currentUser: null,
  activeColumnType: 'delivery',
  isFetchCooldown: false
};

export function formatSFL(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return "0.00";
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

export function getMondayBasedWeekId(dateObj = new Date()) {
  const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

export function isLoginClaimedToday() {
  const lastDate = localStorage.getItem('sfl_daily_login_last_date');
  return lastDate === getTodayDateString();
}

// Strictly increments once per calendar day (never on every save or refresh)
export function checkAndAutoClaimDailyLogin() {
  const todayStr = getTodayDateString();
  const lastClaimed = localStorage.getItem('sfl_daily_login_last_date');
  let currentCount = parseInt(localStorage.getItem('sfl_daily_login_count')) || 0;

  // New day check: only increments if today's date hasn't been claimed yet
  if (lastClaimed !== todayStr) {
    currentCount += 1;
    localStorage.setItem('sfl_daily_login_count', currentCount);
    localStorage.setItem('sfl_daily_login_last_date', todayStr);
  }

  const countInput = document.getElementById('dailyLoginCount');
  if (countInput) countInput.value = currentCount;

  const checkInput = document.getElementById('dailyLoginCheck');
  if (checkInput) checkInput.checked = true;
}

export function handleDailyLoginToggle() {
  const checkInput = document.getElementById('dailyLoginCheck');
  const countInput = document.getElementById('dailyLoginCount');
  if (!checkInput || !countInput) return;

  let currentCount = parseInt(countInput.value) || 0;
  const todayStr = getTodayDateString();

  if (checkInput.checked) {
    if (localStorage.getItem('sfl_daily_login_last_date') !== todayStr) {
      currentCount += 1;
      countInput.value = currentCount;
      localStorage.setItem('sfl_daily_login_count', currentCount);
      localStorage.setItem('sfl_daily_login_last_date', todayStr);
    }
  } else {
    if (localStorage.getItem('sfl_daily_login_last_date') === todayStr) {
      currentCount = Math.max(0, currentCount - 1);
      countInput.value = currentCount;
      localStorage.setItem('sfl_daily_login_count', currentCount);
      localStorage.removeItem('sfl_daily_login_last_date');
    }
  }
}
