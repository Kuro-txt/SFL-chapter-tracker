import { loadTrackerData, saveProgressToCloudKV } from './api.js';
import { userRegister, userLogin, userLogout, checkSavedAuth } from './auth.js';
import { 
  toggleGuideModal, 
  openCategorySummaryModal, 
  closeCategorySummaryModal, 
  openColumnHistoryModal, 
  closeColumnHistoryModal, 
  renderColumnHistoryModalList,
  toggleDeliveryLogCheck, 
  deleteDeliveryLogItem, 
  toggleWeeklyItemCheck, 
  updateHistoryItemTickets, 
  updateHistoryItemCost, 
  deleteWeeklyItem, 
  deleteMasterLog, 
  toggleHistoryModal 
} from './modals.js';
import { recalculateAll } from './render.js';
import { checkAndAutoClaimDailyLogin, handleDailyLoginToggle } from './state.js';

// Explicitly expose handlers to window for inline HTML events
window.loadTrackerData = loadTrackerData;
window.saveProgressToCloudKV = saveProgressToCloudKV;
window.userRegister = userRegister;
window.userLogin = userLogin;
window.userLogout = userLogout;
window.toggleGuideModal = toggleGuideModal;
window.openCategorySummaryModal = openCategorySummaryModal;
window.closeCategorySummaryModal = closeCategorySummaryModal;
window.openColumnHistoryModal = openColumnHistoryModal;
window.closeColumnHistoryModal = closeColumnHistoryModal;
window.renderColumnHistoryModalList = renderColumnHistoryModalList;
window.toggleDeliveryLogCheck = toggleDeliveryLogCheck;
window.deleteDeliveryLogItem = deleteDeliveryLogItem;
window.toggleWeeklyItemCheck = toggleWeeklyItemCheck;
window.updateHistoryItemTickets = updateHistoryItemTickets;
window.updateHistoryItemCost = updateHistoryItemCost;
window.deleteWeeklyItem = deleteWeeklyItem;
window.deleteMasterLog = deleteMasterLog;
window.toggleHistoryModal = toggleHistoryModal;

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
  recalculateAll();
};

window.saveLoginCountAndRecalculate = () => {
  const count = parseInt(document.getElementById('dailyLoginCount').value) || 0;
  localStorage.setItem('sfl_daily_login_count', count);
  recalculateAll();
};

// 4 Focused Gameplay Tips Rotation
const FARMER_TIPS = [
  '📦 <strong>STACKED ORDERS:</strong> Completed 2 deliveries from the same NPC today? Open <em>📦 NPC Deliveries > EDIT</em> to manually tick the extra order!',
  '⚡ <strong>DOUBLE DELIVERIES:</strong> During 2x delivery events, open <em>📦 NPC Deliveries > EDIT</em> to manually increase the ticket amount!',
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

  // Pause on hover or touch
  tipBannerEl.addEventListener('mouseenter', () => {
    if (tipIntervalTimer) clearInterval(tipIntervalTimer);
  });
  tipBannerEl.addEventListener('mouseleave', () => {
    if (tipIntervalTimer) clearInterval(tipIntervalTimer);
    tipIntervalTimer = setInterval(cycleTip, 7000);
  });
}

document.addEventListener('DOMContentLoaded', () => {
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

  checkAndAutoClaimDailyLogin();
  checkSavedAuth();
  startTipRotation();
});
