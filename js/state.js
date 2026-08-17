export const state = {
  currentUser: localStorage.getItem('sfl_logged_user') || null,
  currentVaultData: null,
  globalData: {
    deliveries: [],
    bounties: [],
    chores: [],
    cloudHistory: { logs: [], weeks: {} }
  },
  activeColumnType: null
};

export function formatSFL(val) {
  const num = parseFloat(val) || 0;
  return num.toFixed(2);
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
  return document.getElementById('vipToggle')?.checked ? 1 : 0;
}

export function isAnimalBounty(bounty) {
  if (!bounty) return false;
  if (bounty.category === 'animal' || bounty.isAnimal) return true;
  if (bounty.level !== undefined && bounty.level !== null && Number(bounty.level) > 0) return true;
  const name = (bounty.name || '').toLowerCase();
  const animalKeywords = ['chicken', 'cow', 'sheep', 'pig', 'egg', 'wool', 'milk', 'leather', 'feather', 'honey'];
  return animalKeywords.some(kw => name.includes(kw));
}

export function getMondayBasedWeekId(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
  return monday.toISOString().split('T')[0];
}

export function checkAndAutoClaimDailyLogin() {
  const today = new Date().toISOString().split('T')[0];
  const lastDate = localStorage.getItem('sfl_daily_login_last_date');
  const toggle = document.getElementById('dailyLoginToggle');
  if (toggle) {
    toggle.checked = (lastDate === today);
  }
}

export function handleDailyLoginToggle() {
  const today = new Date().toISOString().split('T')[0];
  const toggle = document.getElementById('dailyLoginToggle');
  const countInput = document.getElementById('dailyLoginCount');
  let currentCount = parseInt(countInput?.value, 10) || 0;

  if (toggle?.checked) {
    localStorage.setItem('sfl_daily_login_last_date', today);
    currentCount += 1;
  } else {
    localStorage.removeItem('sfl_daily_login_last_date');
    currentCount = Math.max(0, currentCount - 1);
  }

  if (countInput) countInput.value = currentCount;
  localStorage.setItem('sfl_daily_login_count', currentCount);
}
