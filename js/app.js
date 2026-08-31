import { loadTrackerData, saveProgressToCloudKV } from './api.js';
import { userRegister, userLogin, userLogout, checkSavedAuth } from './auth.js';
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
  deleteWeeklyItem 
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

  if (isDark) {
    document.body.classList.add('dark-mode');
    if (toggleBtn) toggleBtn.innerHTML = '☀️ LIGHT';
  } else {
    document.body.classList.remove('dark-mode');
    if (toggleBtn) toggleBtn.innerHTML = '🌙 DARK';
  }

  localStorage.setItem('sfl_theme', theme);
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
window.toggleGuideModal = toggleGuideModal;
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
  '📦 <strong>STACKED ORDERS:</strong> Completed 2 deliveries from the same NPC today? Use the EDIT modal to view or add extra orders!',
  '⚡ <strong>DOUBLE DELIVERIES:</strong> 2x event automatically doubles total tickets on your 1st completed order of the day!',
  '🛤️ <strong>MANUAL ADJUSTMENT:</strong> Have missed tickets, special events, or price mismatches? Add them to the <em>🛤️ TRACK</em> input anytime!',
  '☁️ <strong>SAVE PROGRESS:</strong> Always click <em>"SAVE IN CLOUD"</em> before closing your tab to write your daily snapshot into your vault.'
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

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize Dark / Light Theme
  const savedTheme = localStorage.getItem('sfl_theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(savedTheme);

  // 2. Load Local State Preferences
  const savedFarmId = localStorage.getItem('sfl_farmId');
  if (savedFarmId) document.getElementById('farmId').value = savedFarmId;

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
  recalculateAll();
});
