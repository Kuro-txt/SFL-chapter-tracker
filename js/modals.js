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

  // --- Inline Add Form at Top ---
  const addCard = document.createElement('div');
  addCard.style.cssText = 'background: #FAF8F5; border: 2px dashed #D2691E; border-radius: 8px; padding: 12px; margin-bottom: 15px;';

  if (type === 'deliveries') {
    if (titleEl) titleEl.textContent = '📦 Edit Daily Deliveries';
    addCard.innerHTML = `
      <div style="font-weight: 900; color: #5C4033; margin-bottom: 8px; font-size: 13px;">➕ ADD NEW DELIVERY ORDER</div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
        <input type="text" id="manualNameInput" placeholder="NPC Name (e.g. Bert)" style="flex: 2; min-width: 140px; padding: 6px 10px; border: 1px solid #D2691E; border-radius: 4px; font-weight: bold;">
        <input type="number" id="manualTixInput" placeholder="Tickets" value="2" min="1" style="width: 75px; padding: 6px 10px; border: 1px solid #D2691E; border-radius: 4px; font-weight: bold;">
        <input type="number" step="0.01" id="manualCostInput" placeholder="Cost (SFL)" value="0.00" style="width: 95px; padding: 6px 10px; border: 1px solid #D2691E; border-radius: 4px; font-weight: bold;">
        <button class="btn btn-sm" style="background: #4CAF50; color: #fff; border: 2px solid #2E7D32; font-weight: bold; border-radius: 4px; padding: 6px 14px; cursor: pointer;" onclick="window.submitNewManualItem('deliveries')">➕ ADD</button>
      </div>
    `;
    container.appendChild(addCard);

    const items = state.globalData?.deliveries || [];
    items.forEach((item, idx) => {
      const isDone = item.checked !== undefined ? item.checked : item.completed;
      const row = document.createElement('div');
      row.className = 'modal-item-row';
      row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #E0D5C1; gap: 10px;';
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
          <input type="checkbox" ${isDone ? 'checked' : ''} onchange="window.toggleModalItem('deliveries', ${idx}, this.checked)">
          <span style="font-weight: bold; color: #5C4033;">${item.from || item.name}</span>
          ${item.isStacked ? '<span style="font-size: 10px; background: #FFE0B2; color: #E65100; padding: 2px 6px; border-radius: 4px;">STACKED</span>' : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 12px; color: #8C7853;">${formatSFL(item.itemsCost || item.cost || 0)} SFL</span>
          <span style="font-weight: bold; color: #E65100;">${item.baseTickets || item.tickets || 2} Tix</span>
          <button class="btn btn-sm" style="background: #FFEBEE; border: 1px solid #E53935; color: #B71C1C; font-weight: bold; padding: 2px 6px; border-radius: 4px; cursor: pointer;" onclick="window.removeModalItem('deliveries', ${idx})">✕</button>
        </div>
      `;
      container.appendChild(row);
    });
  } else if (type === 'bounties' || type === 'animalBounties') {
    const isAnimalFilter = (type === 'animalBounties');
    if (titleEl) titleEl.textContent = isAnimalFilter ? '🐄 Edit Animal Bounties' : '📜 Edit Item Bounties';

    addCard.innerHTML = `
      <div style="font-weight: 900; color: #5C4033; margin-bottom: 8px; font-size: 13px;">➕ ADD NEW ${isAnimalFilter ? 'ANIMAL BOUNTY' : 'BOUNTY'}</div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
        <input type="text" id="manualNameInput" placeholder="${isAnimalFilter ? 'Animal (e.g. Chicken)' : 'Item (e.g. Red Cosmos)'}" style="flex: 2; min-width: 140px; padding: 6px 10px; border: 1px solid #D2691E; border-radius: 4px; font-weight: bold;">
        ${isAnimalFilter ? '<input type="number" id="manualLvlInput" placeholder="Lvl" value="5" min="1" style="width: 60px; padding: 6px 10px; border: 1px solid #D2691E; border-radius: 4px; font-weight: bold;">' : ''}
        <input type="number" id="manualTixInput" placeholder="Tickets" value="2" min="1" style="width: 75px; padding: 6px 10px; border: 1px solid #D2691E; border-radius: 4px; font-weight: bold;">
        <input type="number" step="0.01" id="manualCostInput" placeholder="Cost (SFL)" value="0.00" style="width: 95px; padding: 6px 10px; border: 1px solid #D2691E; border-radius: 4px; font-weight: bold;">
        <button class="btn btn-sm" style="background: #4CAF50; color: #fff; border: 2px solid #2E7D32; font-weight: bold; border-radius: 4px; padding: 6px 14px; cursor: pointer;" onclick="window.submitNewManualItem('bounties', ${isAnimalFilter})">➕ ADD</button>
      </div>
    `;
    container.appendChild(addCard);

    const items = (state.globalData?.bounties || []).filter(b => isAnimalFilter ? isAnimalBounty(b) : !isAnimalBounty(b));
    items.forEach((item) => {
      const globalIdx = (state.globalData?.bounties || []).indexOf(item);
      const isDone = item.checked !== undefined ? item.checked : item.completed;
      const row = document.createElement('div');
      row.className = 'modal-item-row';
      row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #E0D5C1; gap: 10px;';
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
          <input type="checkbox" ${isDone ? 'checked' : ''} onchange="window.toggleModalItem('bounties', ${globalIdx}, this.checked)">
          <span style="font-weight: bold; color: #5C4033;">${item.name} ${item.level ? `(Lvl ${item.level})` : ''}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 12px; color: #8C7853;">${formatSFL(item.itemsCost || item.cost || 0)} SFL</span>
          <span style="font-weight: bold; color: #E65100;">${item.baseTickets || item.tickets || 1} Tix</span>
          <button class="btn btn-sm" style="background: #FFEBEE; border: 1px solid #E53935; color: #B71C1C; font-weight: bold; padding: 2px 6px; border-radius: 4px; cursor: pointer;" onclick="window.removeModalItem('bounties', ${globalIdx})">✕</button>
        </div>
      `;
      container.appendChild(row);
    });
  } else if (type === 'chores') {
    if (titleEl) titleEl.textContent = '🧹 Edit Weekly Chores';

    addCard.innerHTML = `
      <div style="font-weight: 900; color: #5C4033; margin-bottom: 8px; font-size: 13px;">➕ ADD NEW WEEKLY CHORE</div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
        <input type="text" id="manualNameInput" placeholder="Chore Task (e.g. Harvest Crops 100 times)" style="flex: 2; min-width: 160px; padding: 6px 10px; border: 1px solid #D2691E; border-radius: 4px; font-weight: bold;">
        <input type="text" id="manualNpcInput" placeholder="NPC" value="Chore NPC" style="width: 100px; padding: 6px 10px; border: 1px solid #D2691E; border-radius: 4px; font-weight: bold;">
        <input type="number" id="manualTixInput" placeholder="Tickets" value="1" min="1" style="width: 75px; padding: 6px 10px; border: 1px solid #D2691E; border-radius: 4px; font-weight: bold;">
        <button class="btn btn-sm" style="background: #4CAF50; color: #fff; border: 2px solid #2E7D32; font-weight: bold; border-radius: 4px; padding: 6px 14px; cursor: pointer;" onclick="window.submitNewManualItem('chores')">➕ ADD</button>
      </div>
    `;
    container.appendChild(addCard);

    const items = state.globalData?.chores || [];
    items.forEach((item, idx) => {
      const isDone = item.checked !== undefined ? item.checked : item.completed;
      const row = document.createElement('div');
      row.className = 'modal-item-row';
      row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #E0D5C1; gap: 10px;';
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
          <input type="checkbox" ${isDone ? 'checked' : ''} onchange="window.toggleModalItem('chores', ${idx}, this.checked)">
          <div>
            <div style="font-weight: bold; color: #5C4033;">${item.task || item.name}</div>
            <div style="font-size: 11px; color: #8C7853;">NPC: ${item.npc || 'NPC'}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-weight: bold; color: #E65100;">${item.baseTickets || item.tickets || 1} Tix</span>
          <button class="btn btn-sm" style="background: #FFEBEE; border: 1px solid #E53935; color: #B71C1C; font-weight: bold; padding: 2px 6px; border-radius: 4px; cursor: pointer;" onclick="window.removeModalItem('chores', ${idx})">✕</button>
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
// 2. Guide Modal
// ==========================================
export function toggleGuideModal(show) {
  const modal = document.getElementById('guideModal');
  if (!modal) return;
  if (show === undefined) {
    modal.style.display = (modal.style.display === 'flex' || modal.style.display === 'block') ? 'none' : 'flex';
  } else {
    modal.style.display = show ? 'flex' : 'none';
  }
}

// ==========================================
// 3. Category Summary Modal
// ==========================================
export function openCategorySummaryModal(category) {
  const modal = document.getElementById('categorySummaryModal');
  const title = document.getElementById('categorySummaryTitle');
  const body = document.getElementById('categorySummaryBody');
  if (!modal || !body) return;

  if (title) title.textContent = `📋 ${category ? category.toUpperCase() : ''} SUMMARY`;
  body.innerHTML = `<p style="color: #5C4033; padding: 10px;">Viewing detailed summary for ${category}.</p>`;
  modal.style.display = 'flex';
}

export function closeCategorySummaryModal() {
  const modal = document.getElementById('categorySummaryModal');
  if (modal) modal.style.display = 'none';
}

// ==========================================
// 4. Column History & Master History Modals
// ==========================================
export function renderColumnHistoryModalList(type = 'deliveries') {
  const body = document.getElementById('columnHistoryBody') || document.getElementById('masterHistoryBody') || document.getElementById('historyModalBody');
  if (!body) return;

  const rawLogs = state.globalData?.cloudHistory?.logs || state.currentVaultData?.logs || [];
  if (rawLogs.length === 0) {
    body.innerHTML = '<p style="color: #8C7853; text-align: center; padding: 15px;">No historical logs found.</p>';
    return;
  }

  let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
  rawLogs.forEach((log, logIdx) => {
    html += `
      <div style="background: #FAF8F5; border: 1px solid #E0D5C1; padding: 8px 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span style="font-weight: bold; color: #5C4033;">${log.date}</span>
          <span style="margin-left: 10px; color: #E65100; font-weight: bold;">${log.ticketsSaved || 0} Tickets</span>
          <span style="margin-left: 8px; color: #8C7853;">${formatSFL(log.costSaved || 0)} SFL</span>
        </div>
        <button class="btn btn-sm" style="background: #FFEBEE; border: 1px solid #E53935; color: #B71C1C; font-weight: bold; padding: 2px 6px; border-radius: 4px; cursor: pointer;" onclick="window.deleteMasterLog(${logIdx})">✕</button>
      </div>
    `;
  });
  html += '</div>';
  body.innerHTML = html;
}

export function openColumnHistoryModal(type) {
  const modal = document.getElementById('columnHistoryModal') || document.getElementById('masterHistoryModal') || document.getElementById('historyModal');
  const title = document.getElementById('columnHistoryTitle') || document.getElementById('masterHistoryTitle') || document.getElementById('historyModalTitle');
  if (!modal) return;

  if (title) title.textContent = `📜 ${type ? type.toUpperCase() : 'DELIVERY'} HISTORY`;
  renderColumnHistoryModalList(type);
  modal.style.display = 'flex';
}

export function closeColumnHistoryModal() {
  const modal = document.getElementById('columnHistoryModal') || document.getElementById('masterHistoryModal') || document.getElementById('historyModal');
  if (modal) modal.style.display = 'none';
}

export function toggleHistoryModal(show) {
  const modal = document.getElementById('historyModal') || document.getElementById('columnHistoryModal') || document.getElementById('masterHistoryModal');
  if (!modal) return;
  if (show === undefined) {
    modal.style.display = (modal.style.display === 'flex' || modal.style.display === 'block') ? 'none' : 'flex';
  } else {
    modal.style.display = show ? 'flex' : 'none';
  }
}

// ==========================================
// 5. Item Toggles & Inline Field Updates
// ==========================================
export function toggleDeliveryLogCheck(logIndex, itemIndex, isChecked) {
  const logs = state.globalData?.cloudHistory?.logs || state.currentVaultData?.logs;
  if (!logs || !logs[logIndex] || !logs[logIndex].deliveriesDone) return;

  const item = logs[logIndex].deliveriesDone[itemIndex];
  if (item) {
    item.checked = isChecked;
    item.completed = isChecked;
    recalculateAll();
    saveProgressToCloudKV(true);
  }
}

export function toggleWeeklyItemCheck(weekId, category, index, isChecked) {
  const weeks = state.globalData?.cloudHistory?.weeks || state.currentVaultData?.weeks;
  if (!weeks || !weeks[weekId] || !weeks[weekId][category]) return;

  const item = weeks[weekId][category][index];
  if (item) {
    item.checked = isChecked;
    item.completed = isChecked;
    item.completedAt = isChecked ? Date.now() : null;
    recalculateAll();
    saveProgressToCloudKV(true);
  }
}

export function updateHistoryItemTickets(logIndex, itemIndex, newTickets) {
  const logs = state.globalData?.cloudHistory?.logs || state.currentVaultData?.logs;
  if (!logs || !logs[logIndex] || !logs[logIndex].deliveriesDone) return;

  const item = logs[logIndex].deliveriesDone[itemIndex];
  if (item) {
    item.tickets = parseInt(newTickets, 10) || 0;
    item.baseTickets = item.tickets;
    recalculateAll();
    saveProgressToCloudKV(true);
  }
}

export function updateHistoryItemCost(logIndex, itemIndex, newCost) {
  const logs = state.globalData?.cloudHistory?.logs || state.currentVaultData?.logs;
  if (!logs || !logs[logIndex] || !logs[logIndex].deliveriesDone) return;

  const item = logs[logIndex].deliveriesDone[itemIndex];
  if (item) {
    item.cost = parseFloat(newCost) || 0;
    item.itemsCost = item.cost;
    recalculateAll();
    saveProgressToCloudKV(true);
  }
}

// ==========================================
// 6. Deletion Functions
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

// ==========================================
// 7. Cloud Sync & Manual Additions
// ==========================================
export async function syncCurrentVaultToCloud() {
  await saveProgressToCloudKV(true);
}

export function submitNewManualItem(type, isAnimal = false) {
  if (!state.globalData) state.globalData = {};
  if (!state.globalData[type]) state.globalData[type] = [];

  const nameInput = document.getElementById('manualNameInput');
  const tixInput = document.getElementById('manualTixInput');
  const costInput = document.getElementById('manualCostInput');
  const lvlInput = document.getElementById('manualLvlInput');
  const npcInput = document.getElementById('manualNpcInput');

  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) {
    alert('Please enter a valid name/task.');
    return;
  }

  const tickets = parseInt(tixInput?.value, 10) || 1;
  const cost = parseFloat(costInput?.value) || 0;
  const currentWeekMonday = getMondayBasedWeekId();

  if (type === 'deliveries') {
    state.globalData.deliveries.unshift({
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
    const level = isAnimal ? (parseInt(lvlInput?.value, 10) || null) : null;
    state.globalData.bounties.unshift({
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
    const npc = npcInput?.value.trim() || 'Chore NPC';
    state.globalData.chores.unshift({
      name: name,
      task: name,
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

// Window Event Listeners for Inline HTML
window.submitNewManualItem = submitNewManualItem;

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
