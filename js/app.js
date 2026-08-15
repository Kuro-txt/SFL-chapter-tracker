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
  addCustomHistoryItem, 
  deleteMasterLog, 
  toggleHistoryModal 
} from './modals.js';
import { recalculateAll } from './render.js';
import { initDailyLoginUI, handleDailyLoginToggle } from './state.js';

// Expose handlers to window for inline HTML events
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
window.addCustomHistoryItem = addCustomHistoryItem;
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

// Daily Login Window Actions
window.toggleDailyLogin = () => {
  handleDailyLoginToggle();
  recalculateAll();
};

window.saveLoginCountAndRecalculate = () => {
  const count = parseInt(document.getElementById('dailyLoginCount').value) || 0;
  localStorage.setItem('sfl_daily_login_count', count);
  recalculateAll();
};

// Initialize Application State on Load
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

  initDailyLoginUI();
  checkSavedAuth();
});
