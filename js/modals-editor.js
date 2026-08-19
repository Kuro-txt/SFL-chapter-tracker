import { 
  state, 
  formatSFL, 
  setElemText, 
  getMondayBasedWeekId, 
  isAnimalBounty, 
  resolveAnimalLevel, 
  syncCurrentVaultToCloud,
  getActiveBoostCount,
  getActiveVipBonus
} from './state.js';
import { recalculateAll } from './render.js';

function computeYield(base, isVipEligible = true, isManual = false) {
  const raw = Number(base) || 0;
  if (raw <= 0) return 0;
  if (isManual) return raw;
  const vip = isVipEligible ? getActiveVipBonus() : 0;
  const boost = getActiveBoostCount();
  return raw + vip + boost;
}

function formatRequestedItems(items) {
  if (!items) return '';
  if (Array.isArray(items)) {
    if (items.length === 0) return '';
    return items.map(it => typeof it === 'string' ? it : `${it.qty || 1}x ${it.name}`).join(', ');
  }
  if (typeof items === 'object') {
    const entries = Object.entries(items);
    if (entries.length === 0) return '';
    return entries.map(([name, qty]) => `${qty}x ${name}`).join(', ');
  }
  return String(items);
}

function resolveItemDate(item) {
  if (item.completedDate) return item.completedDate;
  if (item.weekId) return item.weekId;
  if (item.completedAt) {
    const ts = typeof item.completedAt === 'number' ? item.completedAt : Number(item.completedAt);
    if (!isNaN(ts) && ts > 0) {
      const ms = ts < 1e11 ? ts * 1000 : ts;
      return new Date(ms).toISOString().split('T')[0];
    }
  }
  return new Date().toISOString().split('T')[0];
}

function getWeekNumber(dateOrWeekStr) {
  if (!dateOrWeekStr) return 2;
  if (typeof dateOrWeekStr === 'string' && dateOrWeekStr.startsWith('w')) {
    return parseInt(dateOrWeekStr.replace('w', ''), 10) || 1;
  }
  const baseW1 = new Date('2026-08-10T00:00:00.000Z').getTime();
  const targetTime = new Date(`${dateOrWeekStr.includes('T') ? dateOrWeekStr : dateOrWeekStr + 'T00:00:00.000Z'}`).getTime();
  const diffWeeks = Math.floor((targetTime - baseW1) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, Math.min(12, diffWeeks));
}

export function openColumnHistoryModal(type) {
  state.activeColumnType = type;
  let title = '📜 BOUNTIES EDIT / HISTORY';
  if (type === 'delivery') title = '📦 NPC DELIVERIES EDIT / HISTORY';
  if (type === 'animalBounty') title = '🐄 ANIMAL BOUNTIES EDIT / HISTORY';
  if (type === 'chore') title = '🧹 CHORES EDIT / HISTORY';
  
  setElemText('columnHistoryTitle', title);

  const filterContainer = document.getElementById('editFilterContainer');
  const npcDropdown = document.getElementById('editNpcDropdown');
  const weekDropdown = document.getElementById('editWeekFilterDropdown');

  if (filterContainer) filterContainer.style.display = 'flex';
  if (weekDropdown) weekDropdown.value = '';

  if (type === 'delivery') {
    if (npcDropdown) {
      npcDropdown.style.display = 'block';
      const npcSet = new Set();
      (state.globalData?.archiveDeliveries || state.globalData?.deliveries || []).forEach(d => {
        const name = d.from || d.name;
        if (name) npcSet.add(name.trim());
      });

      const sortedNpcs = Array.from(npcSet).sort((a, b) => a.localeCompare(b));
      npcDropdown.innerHTML = '<option value="">👤 ALL NPCS</option>' + sortedNpcs.map(npc => 
        `<option value="${npc.toLowerCase()}">${npc.toUpperCase()}</option>`
      ).join('');
      npcDropdown.value = '';
    }
  } else {
    if (npcDropdown) npcDropdown.style.display = 'none';
  }

  renderColumnHistoryModalList();
  document.getElementById('columnHistoryModal').classList.add('show');
}

export function closeColumnHistoryModal() {
  document.getElementById('columnHistoryModal').classList.remove('show');
}

export function renderColumnHistoryModalList() {
  const type = state.activeColumnType;
  const bodyEl = document.getElementById('columnHistoryBody');
  let records = [];

  let weekOptionsHtml = '';
  for (let w = 1; w <= 12; w++) {
    const selectedAttr = (w === 2) ? 'selected' : '';
    weekOptionsHtml += `<option value="w${w}" ${selectedAttr}>Week ${w}</option>`;
  }

  let addFormHtml = `<div style="background:#EFEBE9; border:2px dashed #8B5A2B; padding:10px; border-radius:8px; margin-bottom:12px; display:flex; flex-direction:column; gap:6px;">
    <div style="font-weight:900; color:#5C4033; font-size:11px;">➕ ADD NEW ${type === 'delivery' ? 'DELIVERY' : type === 'chore' ? 'CHORE' : type === 'animalBounty' ? 'ANIMAL BOUNTY' : 'BOUNTY'}</div>
    <div style="display:flex; gap:6px; flex-wrap:wrap;">
      <input type="text" id="addModalName" placeholder="${type === 'delivery' ? 'NPC Name' : type === 'chore' ? 'NPC & Task' : 'Item Name'}" style="flex:2; padding:4px; font-size:11px;" />
      <select id="addModalWeekSelect" style="flex:1.5; padding:4px; font-size:11px; background:#fff; border:1px solid #8B5A2B; border-radius:4px;">
        ${weekOptionsHtml}
      </select>
      <input type="number" step="0.001" id="addModalCost" placeholder="Cost SFL" style="width:75px; padding:4px; font-size:11px;" />
      <input type="number" id="addModalTickets" placeholder="Tickets" style="width:65px; padding:4px; font-size:11px;" />
      <button onclick="addNewItemFromModal()" class="btn btn-sm btn-wood" style="background:#2E7D32; border-color:#1B5E20; color:#fff; padding:4px 10px; font-weight:bold;">Add</button>
    </div>
  </div>`;

  const selectedWeekFilter = document.getElementById('editWeekFilterDropdown')?.value || '';
  const selectedWeekNum = selectedWeekFilter ? parseInt(selectedWeekFilter.replace('w', ''), 10) : null;

  if (type === 'delivery') {
    const npcFilter = (document.getElementById('editNpcDropdown')?.value || '').toLowerCase().trim();
    const masterDeliveries = state.globalData?.archiveDeliveries || state.globalData?.deliveries || [];

    masterDeliveries.forEach((item, itemIdx) => {
      const itemName = typeof item === 'string' ? item : (item.name || item.from || 'NPC Delivery');
      if (npcFilter && !itemName.toLowerCase().includes(npcFilter)) return;

      const dateDisplay = resolveItemDate(item);
      const itemWeekNum = getWeekNumber(item.weekId || dateDisplay);
      if (selectedWeekNum && itemWeekNum !== selectedWeekNum) return;

      const baseTix = item.baseTickets !== undefined ? item.baseTickets : (item.tickets || 2);
      const isManual = Boolean(item.isManual);
      let finalTix = computeYield(baseTix, true, isManual);
      if (item.hasDoubleBonus && !isManual) finalTix *= 2;

      const isChecked = item.checked !== undefined ? item.checked : Boolean(item.completed);
      const isSkipped = Boolean(item.isSkipped);

      records.push({
        source: 'archive',
        itemIdx,
        date: dateDisplay,
        weekNum: itemWeekNum,
        name: itemName,
        requestedItems: formatRequestedItems(item.itemDetails || item.items),
        cost: item.cost || item.itemsCost || 0,
        displayTickets: isSkipped ? 0 : finalTix,
        checked: isChecked && !isSkipped,
        status: isSkipped ? '✕ Skipped' : (isChecked ? '✨ Done' : '⏳ Active'),
        isStacked: item.isStacked || false,
        isSkipped,
        isManual
      });
    });
  } else {
    const isChore = type === 'chore';
    const isAnimal = type === 'animalBounty';

    const allItemsMap = new Map();
    const currentWeekId = getMondayBasedWeekId();

    const liveArr = isChore ? (state.globalData?.chores || []) : (state.globalData?.bounties || []);
    liveArr.forEach((item, idx) => {
      if (!isChore && isAnimalBounty(item) !== isAnimal) return;
      const dedupeKey = isChore
        ? `${currentWeekId}_${(item.npc || '').toLowerCase()}_${(item.task || item.name || '').toLowerCase()}`
        : `${currentWeekId}_${item.id ? String(item.id) : (item.name || '').toLowerCase()}_${item.level || 0}`;
      
      allItemsMap.set(dedupeKey, { item, weekId: currentWeekId, idx, source: 'current' });
    });

    const weeks = state.globalData?.cloudHistory?.weeks || {};
    Object.entries(weeks).forEach(([wkId, wk]) => {
      const targetArr = isChore ? (wk.chores || []) : (wk.bounties || []);
      targetArr.forEach((item, idx) => {
        if (!isChore && isAnimalBounty(item) !== isAnimal) return;
        const dedupeKey = isChore
          ? `${wkId}_${(item.npc || '').toLowerCase()}_${(item.task || item.name || '').toLowerCase()}`
          : `${wkId}_${item.id ? String(item.id) : (item.name || '').toLowerCase()}_${item.level || 0}`;
        
        if (!allItemsMap.has(dedupeKey)) {
          allItemsMap.set(dedupeKey, { item, weekId: wkId, idx, source: 'week' });
        }
      });
    });

    Array.from(allItemsMap.values()).forEach(({ item, weekId, idx, source }) => {
      const dateDisplay = resolveItemDate(item);
      const itemWeekNum = getWeekNumber(item.weekId || weekId || dateDisplay);

      if (selectedWeekNum && itemWeekNum !== selectedWeekNum) return;

      const baseTix = item.baseTickets !== undefined ? item.baseTickets : (item.tickets || 1);
      const isManual = Boolean(item.isManual);
      const finalTix = computeYield(baseTix, isChore, isManual);
      const lvl = resolveAnimalLevel(item);
      const isChecked = item.checked !== undefined ? item.checked : Boolean(item.completed);

      records.push({
        weekId,
        itemIdx: idx,
        mapKey: `${source}_${weekId}_${idx}`,
        name: isChore ? (item.task || item.name || 'Chore') : (item.name || 'Bounty'),
        npc: item.npc || null,
        level: lvl,
        cost: item.cost !== undefined ? item.cost : (item.itemsCost || 0),
        displayTickets: finalTix,
        checked: isChecked,
        status: isChecked ? '✨ Done' : '⏳ Active',
        date: dateDisplay,
        weekNum: itemWeekNum,
        isManual
      });
    });
  }

  // Sort: Active orders on top, then completed/skipped
  records.sort((a, b) => (a.checked === b.checked ? 0 : a.checked ? 1 : -1));

  let totalTickedTickets = 0;
  let totalTickedCost = 0;

  if (records.length === 0) {
    bodyEl.innerHTML = addFormHtml + '<p style="font-size: 12px; color: #8C7853; font-weight: bold; margin-top:10px;">No records found for selected filter.</p>';
  } else {
    bodyEl.innerHTML = addFormHtml + records.map(r => {
      if (r.checked) {
        totalTickedTickets += r.displayTickets;
        totalTickedCost += r.cost;
      }
      const changeHandler = type === 'delivery'
        ? `toggleDeliveryLogCheck('${r.source}', ${r.itemIdx})`
        : `toggleWeeklyItemCheck('${r.weekId}', '${r.mapKey}')`;
      
      const deleteHandler = type === 'delivery'
        ? `deleteDeliveryLogItem('${r.source}', ${r.itemIdx})`
        : `deleteWeeklyItem('${r.weekId}', '${r.mapKey}')`;

      const animalLevelTag = (type === 'animalBounty' && r.level) 
        ? `<span style="background:#EBDEF0; color:#6C3483; font-size:10px; font-weight:900; padding:1px 5px; border-radius:4px; border:1px solid #D7BDE2; margin-left:4px;">Lvl ${r.level}</span>` 
        : '';

      const manualTag = r.isManual
        ? `<span style="background:#E0F2F1; color:#00796B; font-size:9px; font-weight:900; padding:1px 5px; border-radius:4px; border:1px solid #B2DFDB; margin-left:4px;">📌 MANUAL</span>`
        : '';

      const stackedTag = r.isStacked
        ? `<span style="background:#E1BEE7; color:#4A148C; font-size:9px; font-weight:900; padding:1px 5px; border-radius:4px; border:1px solid #CE93D8; margin-left:4px;">🥞 STACKED</span>`
        : '';

      const skippedTag = r.isSkipped
        ? `<span style="background:#FFEBEE; color:#C62828; font-size:9px; font-weight:900; padding:1px 5px; border-radius:4px; border:1px solid #FFCDD2; margin-left:4px;">✕ SKIPPED</span>`
        : '';

      const npcHeader = r.npc ? `<span style="color:#8B4513; font-weight:900;">[${r.npc.toUpperCase()}] </span>` : '';
      const itemsRow = (type === 'delivery' && r.requestedItems) 
        ? `<div style="font-size:10px; color:#6D4C41; font-weight:bold; margin-top:2px;">📦 Needs: ${r.requestedItems}</div>` 
        : '';

      return `<div style="background:#FFF8DC; padding:8px 12px; border:2px solid #8B5A2B; border-radius:6px; display:flex; justify-content:space-between; align-items:center; font-size:11px; margin-bottom:6px;">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; flex:1; padding-right:8px;">
          <input type="checkbox" ${r.checked ? 'checked' : ''} onchange="${changeHandler}" style="accent-color:#D2691E; width:15px; height:15px;" />
          <div>
            <span style="font-weight:bold; color:#8B4513;">📅 ${r.date} (Week ${r.weekNum}) — ${r.status}</span><br/>
            ${npcHeader}<strong style="color:#3E2723;">${r.name}</strong>${animalLevelTag}${manualTag}${stackedTag}${skippedTag}
            ${itemsRow}
          </div>
        </label>
        <div style="display:flex; align-items:center; gap:6px;">
          <span>SFL:</span>
          <input type="number" step="0.001" value="${r.cost}" onchange="updateHistoryItemCost('${r.source || r.weekId}', '${r.mapKey || r.itemIdx}', this.value)" style="width:65px; padding:2px; font-size:10px;" />
          <span>Tickets:</span>
          <input type="number" value="${r.displayTickets}" onchange="updateHistoryItemTickets('${r.source || r.weekId}', '${r.mapKey || r.itemIdx}', this.value)" style="width:45px; padding:2px; font-size:10px;" title="Ticket Yield" />
          <button onclick="${deleteHandler}" class="btn btn-sm btn-wood" style="background:#C0392B; border-color:#922B21; color:#fff; padding:2px 6px;">✕</button>
        </div>
      </div>`;
    }).join('');
  }

  setElemText('columnHistoryStats', `${totalTickedTickets} Tickets | ${formatSFL(totalTickedCost)} SFL`);
}

export async function addNewItemFromModal() {
  const type = state.activeColumnType;
  const nameInput = document.getElementById('addModalName')?.value.trim() || 'Custom Item';
  const weekSelectVal = document.getElementById('addModalWeekSelect')?.value || 'w1';
  const costInput = parseFloat(document.getElementById('addModalCost')?.value) || 0;
  const ticketsInput = parseInt(document.getElementById('addModalTickets')?.value, 10) || 2;

  if (!state.globalData) return;

  const weekNum = parseInt(weekSelectVal.replace('w', ''), 10) || 1;
  const baseMonday = new Date('2026-08-10T00:00:00.000Z');
  baseMonday.setUTCDate(baseMonday.getUTCDate() + ((weekNum - 1) * 7));
  const targetWeekId = getMondayBasedWeekId(baseMonday);
  const targetWeekTimestamp = baseMonday.getTime();

  if (type === 'delivery') {
    const newDeliv = {
      id: `manual_${Date.now()}`,
      from: nameInput,
      name: nameInput,
      baseTickets: ticketsInput,
      tickets: ticketsInput,
      cost: costInput,
      itemsCost: costInput,
      checked: true,
      completed: true,
      isSkipped: false,
      completedAt: targetWeekTimestamp,
      completedDate: targetWeekId,
      isManual: true,
      weekId: targetWeekId
    };

    if (!state.globalData.archiveDeliveries) state.globalData.archiveDeliveries = [];
    state.globalData.archiveDeliveries.push(newDeliv);
  } else if (type === 'chore') {
    if (!state.globalData.cloudHistory) state.globalData.cloudHistory = {};
    if (!state.globalData.cloudHistory.weeks) state.globalData.cloudHistory.weeks = {};
    if (!state.globalData.cloudHistory.weeks[targetWeekId]) {
      state.globalData.cloudHistory.weeks[targetWeekId] = { weekId: targetWeekId, bounties: [], chores: [] };
    }

    const newChore = {
      npc: nameInput.includes(':') ? nameInput.split(':')[0].trim() : 'Custom',
      task: nameInput.includes(':') ? nameInput.split(':')[1].trim() : nameInput,
      name: nameInput,
      baseTickets: ticketsInput,
      tickets: ticketsInput,
      cost: costInput,
      itemsCost: costInput,
      checked: true,
      completed: true,
      completedAt: targetWeekTimestamp,
      completedDate: targetWeekId,
      isManual: true,
      weekId: targetWeekId
    };

    state.globalData.cloudHistory.weeks[targetWeekId].chores.push(newChore);
  } else {
    if (!state.globalData.cloudHistory) state.globalData.cloudHistory = {};
    if (!state.globalData.cloudHistory.weeks) state.globalData.cloudHistory.weeks = {};
    if (!state.globalData.cloudHistory.weeks[targetWeekId]) {
      state.globalData.cloudHistory.weeks[targetWeekId] = { weekId: targetWeekId, bounties: [], chores: [] };
    }

    const isAnimal = type === 'animalBounty';
    const newBounty = {
      name: nameInput,
      baseTickets: ticketsInput,
      tickets: ticketsInput,
      cost: costInput,
      itemsCost: costInput,
      level: isAnimal ? 1 : undefined,
      checked: true,
      completed: true,
      completedAt: targetWeekTimestamp,
      completedDate: targetWeekId,
      isManual: true,
      weekId: targetWeekId
    };

    state.globalData.cloudHistory.weeks[targetWeekId].bounties.push(newBounty);
  }

  renderColumnHistoryModalList();
  recalculateAll();
  await syncCurrentVaultToCloud();
}

export async function toggleDeliveryLogCheck(source, itemIdx) {
  const master = state.globalData?.archiveDeliveries || state.globalData?.deliveries || [];
  const target = master[itemIdx];

  if (target) {
    const newStatus = !(target.checked !== undefined ? target.checked : Boolean(target.completed));
    target.checked = newStatus;
    target.completed = newStatus;
    if (newStatus) {
      target.isSkipped = false;
      target.status = 'completed';
      if (!target.completedDate) target.completedDate = target.weekId || new Date().toISOString().split('T')[0];
    } else {
      target.status = 'active';
    }
    renderColumnHistoryModalList();
    recalculateAll();
    await syncCurrentVaultToCloud();
  }
}

export async function deleteDeliveryLogItem(source, itemIdx) {
  const master = state.globalData?.archiveDeliveries || state.globalData?.deliveries || [];
  if (master[itemIdx]) {
    master.splice(itemIdx, 1);
  }
  renderColumnHistoryModalList();
  recalculateAll();
  await syncCurrentVaultToCloud();
}

export async function toggleWeeklyItemCheck(weekId, mapKey) {
  const type = state.activeColumnType;
  const isChore = type === 'chore';
  const parts = mapKey.split('_');
  const source = parts[0];
  const wkId = parts[1];
  const idx = parseInt(parts[2], 10);

  let targetItem = null;
  if (source === 'week') {
    const wk = state.globalData?.cloudHistory?.weeks?.[wkId];
    if (wk) targetItem = isChore ? wk.chores?.[idx] : wk.bounties?.[idx];
  } else if (source === 'current') {
    targetItem = isChore ? state.globalData?.chores?.[idx] : state.globalData?.bounties?.[idx];
  }

  if (targetItem) {
    const newStatus = !(targetItem.checked !== undefined ? targetItem.checked : Boolean(targetItem.completed));
    targetItem.checked = newStatus;
    targetItem.completed = newStatus;
    targetItem.completedAt = newStatus ? (targetItem.completedAt || Date.now()) : null;

    renderColumnHistoryModalList();
    recalculateAll();
    await syncCurrentVaultToCloud();
  }
}

export async function updateHistoryItemTickets(sourceOrWkId, mapKeyOrIdx, val) {
  const type = state.activeColumnType;
  const inputVal = parseInt(val, 10) || 0;

  if (type === 'delivery') {
    const itemIdx = parseInt(mapKeyOrIdx, 10);
    const master = state.globalData?.archiveDeliveries || state.globalData?.deliveries || [];
    const target = master[itemIdx];

    if (target) {
      const isManual = Boolean(target.isManual);
      const vip = isManual ? 0 : getActiveVipBonus();
      const boost = isManual ? 0 : getActiveBoostCount();
      const baseVal = Math.max(1, inputVal - vip - boost);
      target.baseTickets = baseVal;
      target.tickets = baseVal;
    }
  } else {
    const parts = mapKeyOrIdx.split('_');
    const source = parts[0];
    const wkId = parts[1];
    const idx = parseInt(parts[2], 10);

    let target = null;
    if (source === 'week') {
      const wk = state.globalData?.cloudHistory?.weeks?.[wkId];
      target = type === 'chore' ? wk?.chores?.[idx] : wk?.bounties?.[idx];
    } else if (source === 'current') {
      target = type === 'chore' ? state.globalData?.chores?.[idx] : state.globalData?.bounties?.[idx];
    }

    if (target) {
      const isManual = Boolean(target.isManual);
      const vip = (type === 'chore' && !isManual) ? getActiveVipBonus() : 0;
      const boost = isManual ? 0 : getActiveBoostCount();
      const baseVal = Math.max(1, inputVal - vip - boost);

      target.baseTickets = baseVal;
      target.tickets = baseVal;
    }
  }

  renderColumnHistoryModalList();
  recalculateAll();
  await syncCurrentVaultToCloud();
}

export async function updateHistoryItemCost(sourceOrWkId, mapKeyOrIdx, val) {
  const type = state.activeColumnType;
  const costVal = parseFloat(val) || 0;

  if (type === 'delivery') {
    const itemIdx = parseInt(mapKeyOrIdx, 10);
    const master = state.globalData?.archiveDeliveries || state.globalData?.deliveries || [];
    const target = master[itemIdx];

    if (target) {
      target.cost = costVal;
      target.itemsCost = costVal;
    }
  } else {
    const parts = mapKeyOrIdx.split('_');
    const source = parts[0];
    const wkId = parts[1];
    const idx = parseInt(parts[2], 10);

    let target = null;
    if (source === 'week') {
      const wk = state.globalData?.cloudHistory?.weeks?.[wkId];
      target = type === 'chore' ? wk?.chores?.[idx] : wk?.bounties?.[idx];
    } else if (source === 'current') {
      target = type === 'chore' ? state.globalData?.chores?.[idx] : state.globalData?.bounties?.[idx];
    }

    if (target) {
      target.cost = costVal;
      target.itemsCost = costVal;
    }
  }

  renderColumnHistoryModalList();
  recalculateAll();
  await syncCurrentVaultToCloud();
}

export async function deleteWeeklyItem(weekId, mapKey) {
  const type = state.activeColumnType;
  const isChore = type === 'chore';
  const parts = mapKey.split('_');
  const source = parts[0];
  const wkId = parts[1];
  const idx = parseInt(parts[2], 10);

  if (source === 'week') {
    const wk = state.globalData?.cloudHistory?.weeks?.[wkId];
    if (wk) {
      if (isChore) wk.chores?.splice(idx, 1);
      else wk.bounties?.splice(idx, 1);
    }
  } else if (source === 'current') {
    if (isChore) state.globalData?.chores?.splice(idx, 1);
    else state.globalData?.bounties?.splice(idx, 1);
  }

  renderColumnHistoryModalList();
  recalculateAll();
  await syncCurrentVaultToCloud();
}
