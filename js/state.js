export const state = {
  globalData: null,
  currentUser: null,
  currentVaultData: { logs: [], cumulativeTickets: 0, cumulativeCost: 0, weeks: {}, deliveries: [], bounties: [], chores: [] },
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
