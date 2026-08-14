export const state = {
  globalData: null,
  currentUser: null,
  currentVaultData: { logs: [], cumulativeTickets: 0, cumulativeCost: 0, weeks: {}, trackTickets: 0, trackCost: 0, deliveries: [], bounties: [], chores: [] },
  isFetchCooldown: false,
  activeColumnType: null
};

export function formatSFL(val) {
  if (val === undefined || val === null || isNaN(val) || val === 0) return "0.00";
  if (val < 0.01) return Number(val).toFixed(4);
  return Number(val).toFixed(2);
}

export function setElemText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

export function getActiveBoostCount() {
  const b1 = document.getElementById('boost1')?.checked ? 1 : 0;
  const b2 = document.getElementById('boost2')?.checked ? 1 : 0;
  const b3 = document.getElementById('boost3')?.checked ? 1 : 0;
  return b1 + b2 + b3;
}

export function getActiveVipBonus() {
  return document.getElementById('vipToggle')?.checked ? 2 : 0;
}

export function getMondayBasedWeekId(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
