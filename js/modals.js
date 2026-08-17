import { state, formatSFL, getMondayBasedWeekId, isAnimalBounty } from './state.js';
import { recalculateAll } from './render.js';
import { saveProgressToCloudKV } from './api.js';

// ==========================================
// 1. Column Edit Modals (Deliveries, Bounties, Chores)
// ==========================================
export function openColumnModal(type) {
  state.activeColumnType = type;
  const modal = document.getElementById('detailsModal');
  const titleEl = document.getElementById('modalTitle');
  const container = document.getElementById('modalItemsContainer');
  if (!modal || !container) return;

  container.innerHTML = '';
  const currentWeekMonday = getMondayBasedWeekId();

  if (type === 'deliveries') {
    if (titleEl) titleEl.textContent = '📦 Edit Daily Deliveries';
    const items = state.globalData?.deliveries || [];

    const addBtnRow = document.createElement('div');
    addBtnRow.style.cssText = 'margin-bottom: 12px; display: flex; justify-content: flex-end;';
    addBtnRow.innerHTML = `
      <button class="btn btn-sm" style="background:#4CAF50; color:#fff; border: 2px solid #2E7D32; font-weight: bold; border-radius: 4px; padding: 6px 12px; cursor: pointer;" onclick="window.addNewManualItem('deliveries')">
        ➕ ADD CUSTOM DELIVERY
      </button>
    `;
    container.appendChild(addBtnRow);

    items.forEach((item, idx) => {
      const isDone = item.checked !== undefined ? item.checked : item.completed;
      const row = document.createElement('div');
      row.className = 'modal-item-row';
      row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-bottom:1px solid #E0D5C1; gap:10px;';
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; flex:1;">
          <input type="checkbox" ${isDone ? 'checked' : ''} onchange="window.toggleModalItem('deliveries', ${idx}, this.checked)">
          <span style="font-weight:bold; color:#5C4033;">${item.from || item.name}</span>
          ${item.isStacked ? '<span style="font-size:10px; background:#FFE0B2; color:#E65100; padding:2px 6px; border-radius:4px;">STACKED</span>' : ''}
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:12px; color:#8C7853;">${formatSFL(item.itemsCost || item.cost || 0)} SFL</span>
          <span style="font-weight:bold; color:#E65100;">${item.baseTickets || item.tickets || 2} Tix</span>
          <button class="btn btn-sm" style="background:#FFEBEE; border:1px solid #E53935; color:#B71C1C; font-weight:bold; padding:2px 6px; border-radius:4px; cursor:pointer;" onclick="window.removeModalItem('deliveries', ${idx})">✕</button>
        </div>
      `;
      container.appendChild(row);
    });
  } else if (type === 'bounties' || type === 'animalBounties') {
    const isAnimalFilter = (type === 'animalBounties');
    if (titleEl) titleEl.textContent = isAnimalFilter ? '🐄 Edit Animal Bounties' : '📜 Edit Item Bounties';

    const addBtnRow = document.createElement('div');
    addBtnRow.style.cssText = 'margin-bottom: 12px; display: flex; justify-content: flex-end;';
    addBtnRow.innerHTML = `
      <button class="btn btn-sm" style="background:#4CAF50; color:#fff; border: 2px solid #2E7D32; font-weight: bold; border-radius: 4px; padding: 6px 12px; cursor: pointer;" onclick="window.addNewManualItem('bounties', ${isAnimalFilter})">
        ➕ ADD ${isAnimalFilter ? 'ANIMAL BOUNTY' : 'BOUNTY'}
      </button>
    `;
    container.appendChild(addBtnRow);

    const items = (state.globalData?.bounties || []).filter(b => isAnimalFilter ? isAnimalBounty(b) : !isAnimalBounty(b));

    items.forEach((item) => {
      const globalIdx = (state.globalData?.bounties || []).indexOf(item);
      const isDone = item.checked !== undefined ? item.checked : item.completed;
      const row = document.createElement('div');
      row.className = 'modal-item-row';
      row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-bottom:1px solid #E0D5C1; gap:10px;';
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; flex:1;">
          <input type="checkbox" ${isDone ? 'checked' : ''} onchange="window.toggleModalItem('bounties', ${globalIdx}, this.checked)">
          <span style="font-weight:bold; color:#5C4033;">${item.name} ${item.level ? `(Lvl ${item.level})` : ''}</span>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:12px; color:#8C7853;">${formatSFL(item.itemsCost || item.cost || 0)} SFL</span>
          <span style="font-weight:bold; color:#E65100;">${item.baseTickets || item.tickets || 1} Tix</span>
          <button class="btn btn-sm" style="background:#FFEBEE; border:1px solid #E53935; color:#B71C1C; font-weight:bold; padding:2px 6px; border-radius:4px; cursor:pointer;" onclick="window.removeModalItem('bounties', ${globalIdx})">✕</button>
        </div>
      `;
      container.appendChild(row);
    });
  } else if (type === 'chores') {
    if (titleEl) titleEl.textContent = '🧹 Edit Weekly Chores';

    const addBtnRow = document.createElement('div');
    addBtnRow.style.cssText = 'margin-bottom: 12px; display: flex; justify-content: flex-end;';
    addBtnRow.innerHTML = `
      <button class="btn btn-sm" style="background:#4CAF50; color:#fff; border: 2px solid #2E7D32; font-weight: bold; border-radius: 4px; padding: 6px 12px; cursor: pointer;" onclick="window.addNewManualItem('chores')">
        ➕ ADD CUSTOM CHORE
      </button>
    `;
    container.appendChild(addBtnRow);

    const items = state.globalData?.chores || [];

    items.forEach((item, idx) => {
      const isDone = item.checked !== undefined ? item.checked : item.completed;
      const row = document.createElement('div');
      row.className = 'modal-item-row';
      row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-bottom:1px solid #E0D5C1; gap:10px;';
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; flex:1;">
          <input type="checkbox" ${isDone ? 'checked' : ''} onchange="window.toggleModalItem('chores', ${idx}, this.checked)">
          <div>
            <div style="font-weight:bold; color:#5C4033;">${item.task || item.name}</div>
            <div style="font-size:11px; color:#8C7853;">NPC: ${item.npc || 'NPC'}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-weight:bold; color:#E65100;">${item.baseTickets || item.tickets || 1} Tix</span>
          <button class="btn btn-sm" style="background:#FFEBEE; border:1px solid #E53935; color:#B71C1C; font-weight:bold; padding:2px 6px; border-radius:4px; cursor:pointer;" onclick="window.removeModalItem('chores', ${idx})">✕</button>
        </div>
      `;
      container.appendChild(row);
    });
  }

  modal.style.display = 'flex';
}

export function closeModal() {
  const modal = document.getElementById('detailsModal');
  if (modal) modal.style.display = 'none';
  state.activeColumnType = null;
}

export function openModal(type) {
  openColumnModal(type);
}

// ==========================================
// 2. History, Logs & List Rendering Functions
// ==========================================
export function renderColumnHistoryModalList(type = 'deliveries') {
  const body = document.getElementById('columnHistoryBody') || document.getElementById('masterHistoryBody') || document.getElementById('historyModalBody');
  if (!body) return;

  const rawLogs = state.globalData?.cloudHistory?.logs || state.currentVaultData?.logs || [];
  if (rawLogs.length === 0) {
    body.innerHTML = '<p style="color:#8C7853; text-align:center; padding:15px;">No historical logs found.</p>';
    return;
  }

  let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
  rawLogs.forEach((log, logIdx) => {
    html += `
      <div style="background:#FAF8F5; border:1px solid #E0D5C1; padding:8px 12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <span style="font-weight:bold; color:#5C4033;">${log.date}</span>
          <span style="margin-left:10px; color:#E65100; font-weight:bold;">${log.ticketsSaved || 0} Tickets</span>
          <span style="margin-left:8px; color:#8C7853;">${formatSFL(log.costSaved || 0)} SFL</span>
        </div>
        <button class="btn btn-sm" style="background:#FFEBEE; border:1px solid #E53935; color:#B71C1C; font-weight:bold; padding:2px 6px; border-radius:4px; cursor:pointer;" onclick="window.deleteMasterLog(${logIdx})">✕</button>
      </div>
    `;
  });
  html += '</div>';
  body.innerHTML = html;
}

export function openColumnHistoryModal(type) {
  openMasterHistoryModal(type);
}

export function closeColumnHistoryModal() {
  closeMasterHistoryModal();
}

export function openHistoryModal(type) {
  openMasterHistoryModal(type);
}

export function closeHistoryModal() {
  closeMasterHistoryModal();
}

export function openLogsModal() {
  openMasterHistoryModal('deliveries');
}

export function closeLogsModal() {
  closeMasterHistoryModal();
}

export function openMasterHistoryModal(type = 'deliveries') {
  const modal = document.getElementById('masterHistoryModal') || document.getElementById('columnHistoryModal') || document.getElementById('historyModal');
  const title = document.getElementById('masterHistoryTitle') || document.getElementById('columnHistoryTitle') || document.getElementById('historyModalTitle');
  if (!modal) return;

  if (title) title.textContent = `📜 ${type ? type.toUpperCase() : 'DELIVERY'} HISTORY`;
  renderColumnHistoryModalList(type);
  modal.style.display = 'flex';
}

export function closeMasterHistoryModal() {
  const modal = document.getElementById('masterHistoryModal') || document.getElementById('columnHistoryModal') || document.getElementById('historyModal');
  if (modal) modal.style.display = 'none';
}

// ==========================================
// 3. Deletion Functions for Logs & Weekly Items
// ==========================================
export function deleteWeeklyItem(weekId, category, index) {
  const weeks = state.globalData?.cloudHistory?.weeks || state.currentVaultData?.weeks;
  if (!weeks || !weeks[weekId] || !weeks[weekId][category]) return;

  if (confirm(`Remove this ${category} item from ${weekId}?`)) {
    weeks[weekId][category].splice(index, 1);
    recalculateAll();
    saveProgressToCloudKV(true);
  }
}

export function deleteMasterLog(logIndex) {
  const logs = state.globalData?.cloudHistory?.logs || state.currentVaultData?.logs;
  if (!logs || logIndex < 0 || logIndex >= logs.length) return;

  if (confirm(`Delete delivery log entry for ${logs[logIndex].date}?`)) {
    logs.splice(logIndex, 1);
    recalculateAll();
    renderColumnHistoryModalList(state.activeColumnType || 'deliveries');
    saveProgressToCloudKV(true);
  }
}

export function deleteDeliveryLogItem(logIndex) {
  deleteMasterLog(logIndex);
}

export function deleteLogItem(logIndex) {
  deleteMasterLog(logIndex);
}

// ==========================================
// 4. Category Summary Modal
// ==========================================
export function openCategorySummaryModal(category) {
  const modal = document.getElementById('categorySummaryModal');
  const title = document.getElementById('categorySummaryTitle');
  const body = document.getElementById('categorySummaryBody');
  if (!modal || !body) return;

  if (title) title.textContent = `📋 ${category.toUpperCase()} SUMMARY`;
  body.innerHTML = `<p style="color:#5C4033; padding:10px;">Viewing detailed summary for ${category}.</p>`;
  modal.style.display = 'flex';
}

export function closeCategorySummaryModal() {
  const modal = document.getElementById('categorySummaryModal');
  if (modal) modal.style.display = 'none';
}

// ==========================================
// 5. Cloud Sync & Manual Item Additions
// ==========================================
export async function syncCurrentVaultToCloud() {
  await saveProgressToCloudKV(true);
}

export function addNewManualItem(type, isAnimal = false) {
  if (!state.globalData) state.globalData = {};
  if (!state.globalData[type]) state.globalData[type] = [];

  const currentWeekMonday = getMondayBasedWeekId();

  if (type === 'deliveries') {
    const name = prompt('Enter NPC / Order Name:', 'Custom Delivery');
    if (!name) return;
    const tickets = parseInt(prompt('Enter Base Tickets:', '2'), 10) || 2;
    const cost = parseFloat(prompt('Enter SFL Cost:', '0.00')) || 0;

    state.globalData.deliveries.push({
      id: `manual_deliv_${Date.now()}`,
      from: name,
      name: name,
      baseTickets: tickets,
      tickets: tickets,
      cost: cost,
      itemsCost: cost,
      completed: true,
      checked: true,
      completedAt: Date.now(),
      checkedToday: true,
      isManual: true,
      items: {},
      itemDetails: []
    });
  } else if (type === 'bounties') {
    const name = prompt(`Enter ${isAnimal ? 'Animal' : 'Item'} Name:`, isAnimal ? 'Chicken' : 'Red Cosmos');
    if (!name) return;
    const level = isAnimal ? (parseInt(prompt('Enter Level (or leave empty):', '5'), 10) || null) : null;
    const tickets = parseInt(prompt('Enter Tickets:', '2'), 10) || 2;
    const cost = parseFloat(prompt('Enter SFL Cost:', '0.00')) || 0;

    state.globalData.bounties.push({
      id: `manual_bounty_${Date.now()}`,
      name: name,
      level: level,
      weekId: currentWeekMonday,
      baseTickets: tickets,
      tickets: tickets,
      cost: cost,
      itemsCost: cost,
      completed: true,
      checked: true,
      completedAt: Date.now(),
      checkedToday: true,
      category: isAnimal ? 'animal' : 'crop'
    });
  } else if (type === 'chores') {
    const task = prompt('Enter Chore Task Description:', 'Harvest Crops 100 times');
    if (!task) return;
    const npc = prompt('Enter NPC Name:', 'Chore NPC') || 'Chore NPC';
    const tickets = parseInt(prompt('Enter Tickets:', '1'), 10) || 1;

    state.globalData.chores.push({
      name: task,
      task: task,
      npc: npc,
      weekId: currentWeekMonday,
      baseTickets: tickets,
      tickets: tickets,
      cost: 0,
      itemsCost: 0,
      completed: true,
      checked: true,
      completedAt: Date.now(),
      checkedToday: true
    });
  }

  recalculateAll();
  openColumnModal(state.activeColumnType);
  saveProgressToCloudKV(true);
}

// ==========================================
// 6. Global Window Handlers
// ==========================================
window.renderColumnHistoryModalList = renderColumnHistoryModalList;
window.deleteWeeklyItem = deleteWeeklyItem;
window.deleteMasterLog = deleteMasterLog;
window.deleteDeliveryLogItem = deleteDeliveryLogItem;
window.deleteLogItem = deleteLogItem;
window.addNewManualItem = addNewManualItem;

window.toggleModalItem = function(type, index, isChecked) {
  if (!state.globalData) return;
  const list = state.globalData[type];
  if (!list || !list[index]) return;

  list[index].checked = isChecked;
  list[index].completed = isChecked;
  list[index].completedAt = isChecked ? Date.now() : null;
  list[index].checkedToday = isChecked;

  recalculateAll();
  saveProgressToCloudKV(true);
};

window.removeModalItem = function(type, index) {
  if (!state.globalData) return;
  const list = state.globalData[type];
  if (!list || index < 0 || index >= list.length) return;

  list.splice(index, 1);
  recalculateAll();
  openColumnModal(state.activeColumnType);
  saveProgressToCloudKV(true);
};
