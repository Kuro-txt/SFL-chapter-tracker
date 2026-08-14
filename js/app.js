import * as State from './state.js';
import * as Auth from './auth.js';
import * as Api from './api.js';
import * as Modals from './modals.js';
import * as Render from './render.js';

// Bind all module functions to window
Object.assign(window, State, Auth, Api, Modals, Render);

// Explicitly register UI events for inline handlers
window.userLogin = Auth.userLogin;
window.userRegister = Auth.userRegister;
window.userLogout = Auth.userLogout;
window.loadTrackerData = Api.loadTrackerData;
window.saveProgressToCloudKV = Api.saveProgressToCloudKV;
window.toggleHistoryModal = Modals.toggleHistoryModal;
window.deleteMasterLog = Modals.deleteMasterLog;
window.openCategorySummaryModal = Modals.openCategorySummaryModal;
window.closeCategorySummaryModal = Modals.closeCategorySummaryModal;
window.openColumnHistoryModal = Modals.openColumnHistoryModal;
window.closeColumnHistoryModal = Modals.closeColumnHistoryModal;
window.addCustomHistoryItem = Modals.addCustomHistoryItem;
window.deleteWeeklyItem = Modals.deleteWeeklyItem;
window.toggleWeeklyItemCheck = Modals.toggleWeeklyItemCheck;
window.toggleDeliveryLogCheck = Modals.toggleDeliveryLogCheck;
window.deleteDeliveryLogItem = Modals.deleteDeliveryLogItem;
window.updateHistoryItemTickets = Modals.updateHistoryItemTickets;
window.updateHistoryItemCost = Modals.updateHistoryItemCost;

window.toggleColumnCard = function(cardId, btn) {
  const card = document.getElementById(cardId);
  if (card) {
    card.classList.toggle('collapsed');
    if (btn) btn.textContent = card.classList.contains('collapsed') ? '▲' : '▼';
  }
};

window.saveGoalAndRecalculate = function() {
  localStorage.setItem('sfl_targetGoal', document.getElementById('targetGoalInput').value);
  localStorage.setItem('sfl_targetWeeks', document.getElementById('targetWeeksInput').value);
  Render.recalculateAll();
};

window.saveAndRecalculate = function() {
  localStorage.setItem('sfl_boost1', document.getElementById('boost1').checked);
  localStorage.setItem('sfl_boost2', document.getElementById('boost2').checked);
  localStorage.setItem('sfl_boost3', document.getElementById('boost3').checked);
  localStorage.setItem('sfl_vip', document.getElementById('vipToggle').checked);
  localStorage.setItem('sfl_farmId', document.getElementById('farmId').value.trim());
  localStorage.setItem('sfl_apiKey', document.getElementById('apiKey').value.trim());
  Render.recalculateAll();
};

window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('boost1').checked = localStorage.getItem('sfl_boost1') === 'true';
  document.getElementById('boost2').checked = localStorage.getItem('sfl_boost2') === 'true';
  document.getElementById('boost3').checked = localStorage.getItem('sfl_boost3') === 'true';

  const savedGoal = localStorage.getItem('sfl_targetGoal');
  if (savedGoal !== null) document.getElementById('targetGoalInput').value = savedGoal;
  const savedWeeks = localStorage.getItem('sfl_targetWeeks');
  if (savedWeeks !== null) document.getElementById('targetWeeksInput').value = savedWeeks;

  const savedVip = localStorage.getItem('sfl_vip');
  if (savedVip !== null) document.getElementById('vipToggle').checked = savedVip === 'true';

  const savedFarmId = localStorage.getItem('sfl_farmId');
  if (savedFarmId) document.getElementById('farmId').value = savedFarmId;

  const savedApiKey = localStorage.getItem('sfl_apiKey');
  if (savedApiKey) document.getElementById('apiKey').value = savedApiKey;

  const savedUser = localStorage.getItem('sfl_username');
  if (savedUser) {
    State.state.currentUser = savedUser;
    document.getElementById('authLoggedOut').style.display = 'none';
    document.getElementById('authLoggedIn').style.display = 'flex';
    document.getElementById('displayUsername').textContent = State.state.currentUser;
    await Auth.fetchUserVault(State.state.currentUser);
  }
});
