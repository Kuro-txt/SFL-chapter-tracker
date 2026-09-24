import { loadTrackerData, saveProgressToCloudKV } from './api.js';
import { 
  userRegister, 
  userLogin, 
  userLogout, 
  checkSavedAuth,
  showRegistrationGate,
  hideRegistrationGate,
  switchGateTab,
  handleGateRegister,
  handleGateLogin
} from './auth.js';
import { 
  toggleGuideModal, 
  openCategorySummaryModal, 
  closeCategorySummaryModal, 
  openWeekBreakdownModal, 
  openColumnHistoryModal, 
  closeColumnHistoryModal, 
  renderColumnHistoryModalList, 
  addNewItemFromModal, 
  toggleDeliveryLogCheck, 
  deleteDeliveryLogItem, 
  toggleWeeklyItemCheck, 
  updateHistoryItemTickets, 
  updateHistoryItemCost, 
  deleteWeeklyItem,
  openChapterLogsModal,
  closeChapterLogsModal,
  snapshotCurrentChapter,
  deleteChapterLog,
  exportChapterLog
} from './modals.js';
import { 
  recalculateAll,
  showChartTooltip,
  moveChartTooltip,
  hideChartTooltip
} from './render.js';
import { checkAndAutoClaimDailyLogin, handleDailyLoginToggle } from './state.js';

// ==========================================
// THEME MANAGER (Dark / Light Mode)
// ==========================================
export function applyTheme(theme) {
  const isDark = theme === 'dark';
  const toggleBtn = document.getElementById('themeToggleBtn');
  const gateToggleBtn = document.getElementById('gateThemeToggleBtn');

  if (isDark) {
    document.body.classList.add('dark-mode');
    if (toggleBtn) toggleBtn.innerHTML = '☀️ LIGHT';
    if (gateToggleBtn) gateToggleBtn.innerHTML = '☀️ LIGHT';
  } else {
    document.body.classList.remove('dark-mode');
    if (toggleBtn) toggleBtn.innerHTML = '🌙 DARK';
    if (gateToggleBtn) gateToggleBtn.innerHTML = '🌙 DARK';
  }

  localStorage.setItem('sfl_theme', theme);
  try {
    recalculateAll();
  } catch (e) {}
}

export function toggleTheme() {
  const isCurrentlyDark = document.body.classList.contains('dark-mode');
  applyTheme(isCurrentlyDark ? 'light' : 'dark');
}

// Expose handlers to window for inline HTML events
window.toggleTheme = toggleTheme;
window.loadTrackerData = loadTrackerData;
window.saveProgressToCloudKV = saveProgressToCloudKV;
window.userRegister = userRegister;
window.userLogin = userLogin;
window.userLogout = userLogout;
window.showRegistrationGate = showRegistrationGate;
window.hideRegistrationGate = hideRegistrationGate;
window.switchGateTab = switchGateTab;
window.handleGateRegister = handleGateRegister;
window.handleGateLogin = handleGateLogin;
window.toggleGuideModal = toggleGuideModal;
window.updateChapterCountdown = updateChapterCountdown;
window.openCategorySummaryModal = openCategorySummaryModal;
window.closeCategorySummaryModal = closeCategorySummaryModal;
window.openWeekBreakdownModal = openWeekBreakdownModal;
window.showChartTooltip = showChartTooltip;
window.moveChartTooltip = moveChartTooltip;
window.hideChartTooltip = hideChartTooltip;
window.openColumnHistoryModal = openColumnHistoryModal;
window.closeColumnHistoryModal = closeColumnHistoryModal;
window.renderColumnHistoryModalList = renderColumnHistoryModalList;
window.addNewItemFromModal = addNewItemFromModal;
window.toggleDeliveryLogCheck = toggleDeliveryLogCheck;
window.deleteDeliveryLogItem = deleteDeliveryLogItem;
window.toggleWeeklyItemCheck = toggleWeeklyItemCheck;
window.updateHistoryItemTickets = updateHistoryItemTickets;
window.updateHistoryItemCost = updateHistoryItemCost;
window.deleteWeeklyItem = deleteWeeklyItem;
window.openChapterLogsModal = openChapterLogsModal;
window.closeChapterLogsModal = closeChapterLogsModal;
window.snapshotCurrentChapter = snapshotCurrentChapter;
window.deleteChapterLog = deleteChapterLog;
window.exportChapterLog = exportChapterLog;

window.saveAndRecalculate = () => {
  localStorage.setItem('sfl_vip', document.getElementById('vipToggle').checked);
  localStorage.setItem('sfl_boost1', document.getElementById('boost1').checked);
  localStorage.setItem('sfl_boost2', document.getElementById('boost2').checked);
  localStorage.setItem('sfl_boost3', document.getElementById('boost3').checked);
  recalculateAll();
};

window.saveTrackAndRecalculate = () => {
  localStorage.setItem('sfl_track_tix', document.getElementById('trackTicketsInput').value);
  localStorage.setItem('sfl_track_cost', document.getElementById('trackCostInput').value);
  recalculateAll();
};

window.saveGoalAndRecalculate = () => {
  localStorage.setItem('sfl_target_goal', document.getElementById('targetGoalInput').value);
  localStorage.setItem('sfl_target_weeks', document.getElementById('targetWeeksInput').value);
  recalculateAll();
};

window.toggleDailyLogin = () => {
  handleDailyLoginToggle();
};

window.saveLoginCountAndRecalculate = () => {
  const count = parseInt(document.getElementById('dailyLoginCount').value, 10) || 0;
  localStorage.setItem('sfl_daily_login_count', count);
  recalculateAll();
};

// Focused Gameplay Tips Rotation
const FARMER_TIPS = [
  '📈 <strong>WEEKLY BREAKDOWNS:</strong> Hover or tap any bar in the Weekly Progression chart to see tickets earned from Deliveries, Bounties, Animal Bounties & Chores!',
  '☁️ <strong>CLOUD VAULT:</strong> Click <em>"SAVE IN CLOUD"</em> to lock in your tickets. Automatic background sync also snapshots daily at 23:00 UTC!',
  '⚡ <strong>2x DOUBLE DELIVERIES:</strong> On 2x event days, your first completed order for each NPC gives double tickets: <em>[(Base + VIP + Boosts) × 2]</em>!',
  '📜 <strong>MULTI-WEEK EDITING:</strong> Click <em>EDIT</em> on any card to view history, filter by week (Week 1–12), or add custom tasks. Active orders stay at the top!',
  '🎯 <strong>CHAPTER GOAL PACE:</strong> Set your ticket target (e.g. 1,000 Tix) and weeks to track your remaining tickets and needed pace per week!',
  '🎁 <strong>DAILY LOGIN:</strong> Free +1 ticket is automatically credited to your vault on your first visit each calendar day!',
  '⏱️ <strong>SEASON COUNTDOWN:</strong> The pixel stopwatch in the top-left corner counts down live to the season reset on Nov 2, 2026!',
  '👑 <strong>VIP & BOOSTERS:</strong> Toggle the VIP (+2) and booster (+1 each) checkboxes at the top to automatically boost your ticket yields!'
];

let currentTipIndex = 0;
let tipIntervalTimer = null;

function startTipRotation() {
  const tipTextEl = document.getElementById('rotatingTipText');
  const tipBannerEl = document.getElementById('tipBanner');
  if (!tipTextEl || !tipBannerEl) return;

  const cycleTip = () => {
    tipTextEl.classList.add('fade-out');
    setTimeout(() => {
      currentTipIndex = (currentTipIndex + 1) % FARMER_TIPS.length;
      tipTextEl.innerHTML = FARMER_TIPS[currentTipIndex];
      tipTextEl.classList.remove('fade-out');
    }, 300);
  };

  tipIntervalTimer = setInterval(cycleTip, 7000);

  tipBannerEl.addEventListener('mouseenter', () => {
    if (tipIntervalTimer) clearInterval(tipIntervalTimer);
  });
  tipBannerEl.addEventListener('mouseleave', () => {
    if (tipIntervalTimer) clearInterval(tipIntervalTimer);
    tipIntervalTimer = setInterval(cycleTip, 7000);
  });
}

// ==========================================
// CHAPTER COUNTDOWN TIMER (Nov 2, 2026, 00:00 UTC)
// ==========================================
// 57 days 6 hours from Sept 5, 2026 18:00 UTC = Nov 2, 2026, 00:00:00 UTC
const CHAPTER_END_TIMESTAMP = Date.UTC(2026, 10, 2, 0, 0, 0);

export function updateChapterCountdown() {
  const timerValEl = document.getElementById('chapterCountdownVal');
  const widgetEl = document.getElementById('chapterCountdownWidget');
  if (!timerValEl) return;

  const nowMs = Date.now();
  const diffMs = Math.max(0, CHAPTER_END_TIMESTAMP - nowMs);

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    timerValEl.textContent = `${days}d ${hours}h`;
  } else if (hours > 0) {
    timerValEl.textContent = `${hours}h ${mins}m`;
  } else {
    timerValEl.textContent = `${mins}m`;
  }

  if (widgetEl) {
    widgetEl.title = `Chapter ends: November 2, 2026 at 00:00 UTC (${days} days, ${hours} hours, ${mins} minutes remaining)`;
  }
}

export function updateCurrentWeekBadge() {
  const baseEpoch = new Date('2026-08-10T00:00:00.000Z').getTime();
  const now = Date.now();
  const diffDays = Math.max(0, (now - baseEpoch) / (1000 * 60 * 60 * 24));
  const weekNum = Math.min(12, Math.floor(diffDays / 7) + 1);
  const text = `WEEK ${weekNum} OF 12 WEEKS (UTC)`;

  const headerBadgeEl = document.getElementById('chapterWeekText');
  if (headerBadgeEl) headerBadgeEl.textContent = text;
  const chartBadgeEl = document.getElementById('chartSummaryBadge');
  if (chartBadgeEl && (chartBadgeEl.textContent.includes('0 WEEKS') || !chartBadgeEl.textContent)) {
    chartBadgeEl.textContent = text;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize Dark / Light Theme (defaults to classic Sunflower Land light theme)
  const savedTheme = localStorage.getItem('sfl_theme') || 'light';
  applyTheme(savedTheme);

  // 2. Load Local State Preferences
  const farmIdEl = document.getElementById('farmId');
  if (farmIdEl) farmIdEl.value = '';

  const savedApiKey = localStorage.getItem('sfl_apiKey');
  if (savedApiKey) document.getElementById('apiKey').value = savedApiKey;

  if (localStorage.getItem('sfl_vip') !== null) {
    document.getElementById('vipToggle').checked = localStorage.getItem('sfl_vip') === 'true';
  }
  document.getElementById('boost1').checked = localStorage.getItem('sfl_boost1') === 'true';
  document.getElementById('boost2').checked = localStorage.getItem('sfl_boost2') === 'true';
  document.getElementById('boost3').checked = localStorage.getItem('sfl_boost3') === 'true';

  const savedTrackTix = localStorage.getItem('sfl_track_tix');
  if (savedTrackTix !== null) document.getElementById('trackTicketsInput').value = savedTrackTix;

  const savedTrackCost = localStorage.getItem('sfl_track_cost');
  if (savedTrackCost !== null) document.getElementById('trackCostInput').value = savedTrackCost;

  const savedGoal = localStorage.getItem('sfl_target_goal');
  if (savedGoal) document.getElementById('targetGoalInput').value = savedGoal;

  const savedWeeks = localStorage.getItem('sfl_target_weeks');
  if (savedWeeks) document.getElementById('targetWeeksInput').value = savedWeeks;

  await checkSavedAuth();
  await checkAndAutoClaimDailyLogin();
  startTipRotation();
  updateChapterCountdown();
  updateCurrentWeekBadge();
  setInterval(updateChapterCountdown, 60000);
  recalculateAll();
});
