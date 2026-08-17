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

export function openColumnHistoryModal(type) {
  state.activeColumnType = type;
  let title = '📜 BOUNTIES EDIT / HISTORY';
  if (type === 'delivery') title = '📦 NPC DELIVERIES EDIT / HISTORY';
  if (type === 'animalBounty') title = '🐄 ANIMAL BOUNTIES EDIT / HISTORY';
  if (type === 'chore') title = '🧹 CHORES EDIT / HISTORY';
  
  setElemText('columnHistoryTitle', title);

  const filterContainer = document.getElementById('editFilterContainer');
  const searchInput = document.getElementById('editSearchFilter');
  const npcDropdown = document.getElementById('editNpcDropdown');

  if (searchInput) searchInput.value = '';

  if (type === 'delivery') {
    if (filterContainer) filterContainer.style.display = 'flex';
    if (npcDropdown) {
      const npcSet = new Set();
      (state.globalData?.deliveries || []).forEach(d => {
        const name = d.from || d.name;
        if (name) npcSet.add(name.trim());
      });
      (state.globalData?.archiveDeliveries || []).forEach(d => {
        const name = d.from || d.name;
        if (name) npcSet.add(name.trim());
      });

      const weeksObj = state.globalData?.cloudHistory?.weeks || {};
      Object.values(weeksObj).forEach(wk => {
        if (Array.isArray(wk.deliveries)) {
          wk.deliveries.forEach(d => {
            const name = d.from || d.name;
            if (name) npcSet.add(name.trim());
          });
        }
      });

      const sortedNpcs = Array.from(npcSet).sort((a, b) => a.localeCompare(b));
      npcDropdown.innerHTML = '<option value="">👤 ALL NPCS</option>' + sortedNpcs.map(npc => 
        `<option value="${npc.toLowerCase()}">${npc.toUpperCase()}</option>`
      ).join('');
      npcDropdown.value = '';
    }
  } else {
    if (filterContainer) filterContainer.style.display = 'none';
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
      <input type="number" step="0.01" id="addModalCost" placeholder="Cost SFL" style="width:70px; padding:4px; font-size:11px;" />
      <input type="number" id="addModalTickets" placeholder="Tickets" style="width:65px; padding:4px; font-size:11px;" />
      <button onclick="addNewItemFromModal()" class="btn btn-sm btn-wood" style="background:#2E7D32; border-color:#1B5E20; color:#fff; padding:4px 10px; font-weight:bold;">Add</button>
    </div>
  </div>`;

  if (type === 'delivery') {
    const npcFilter = (document.getElementById('editNpcDropdown')?.value || '').toLowerCase().trim();

    // 1. Process active live deliveries
    (state.globalData?.deliveries || []).forEach((item, itemIdx) => {
      if (item.isManual) return;
      const itemName = typeof item === 'string' ? item : (item.name || item.from || 'NPC Delivery');
      if (npcFilter && !itemName.toLowerCase().includes(npcFilter)) return;

      const baseTix = item.baseTickets !== undefined ? item.baseTickets : (item.tickets || 2);
      let finalTix = computeYield(baseTix, true, false);
      if (item.hasDoubleBonus) finalTix *= 2;

      const isChecked = item.checked !== undefined ? item.checked : Boolean(item.completed);

      records.push({
        source: 'live',
        itemIdx,
        date: 'Live Order',
        name: itemName,
        requestedItems: formatRequestedItems(item.itemDetails || item.items),
        cost: item.cost || item.itemsCost || 0,
        displayTickets: finalTix,
        checked: isChecked,
        status: isChecked ? '✨ Done' : '⏳ Active',
        isStacked: item.isStacked || false,
        isManual: false
      });
    });

    // 2. Process archive deliveries
    (state.globalData?.archiveDeliveries || []).forEach((item, itemIdx) => {
      const itemName = typeof item === 'string' ? item : (item.name || item.from || 'NPC Delivery');
      if (npcFilter && !itemName.toLowerCase().includes(npcFilter)) return;

      const baseTix = item.baseTickets !== undefined ? item.baseTickets : (item.tickets || 2);
      const isManual = Boolean(item.isManual);
      const finalTix = computeYield(baseTix, true, isManual);

      let weekDisplay = item.completedDate || 'Archived';
      if (item.weekId) {
        const baseW1 = new Date('2026-08-10T00:00:00.000Z').getTime();
        const itemTime = new Date(`${item.weekId}T00:00:00.000Z`).getTime();
        const diffWeeks = Math.round((itemTime - baseW1) / (7 * 24 * 60 * 60 * 1000)) + 1;
        if (diffWeeks >= 1 && diffWeeks <= 12) weekDisplay = `Week ${diffWeeks}`;
      }

      const isChecked = item.checked !== undefined ? item.checked : Boolean(item.completed);

      records.push({
        source: 'archive',
        itemIdx,
        date: weekDisplay,
        name: itemName,
        requestedItems: formatRequestedItems(item.itemDetails || item.items),
        cost: item.cost || item.itemsCost || 0,
        displayTickets: finalTix,
        checked: isChecked,
        status: isChecked ? '✨ Done' : '⏳ Active',
        isStacked: item.isStacked || false,
        isManual
      });
    });

    // 3. Process week-stored deliveries (including manual ones added to specific weeks)
    const weeks = state.globalData?.cloudHistory?.weeks || {};
    Object.entries(weeks).forEach(([wkId, wk]) => {
      if (Array.isArray(wk.deliveries)) {
        wk.deliveries.forEach((item, itemIdx) => {
          const itemName = typeof item === 'string' ? item : (item.name || item.from || 'NPC Delivery');
          if (npcFilter && !itemName.toLowerCase().includes(npcFilter)) return;

          const baseTix = item.baseTickets !== undefined ? item.baseTickets : (item.tickets || 2);
          const isManual = Boolean(item.isManual);
          const finalTix = computeYield(baseTix, true, isManual);

          let weekDisplay = 'Week';
          const baseW1 = new Date('2026-08-10T00:00:00.000Z').getTime();
          const itemTime = new Date(`${wkId}T00:00:00.000Z`).getTime();
          const diffWeeks = Math.round((itemTime - baseW1) / (7 * 24 * 60 * 60 * 1000)) + 1;
          if (diffWeeks >= 1 && diffWeeks <= 12) weekDisplay = `Week ${diffWeeks}`;

          const isChecked = item.checked !== undefined ? item.checked : Boolean(item.completed);

          records.push({
            weekId: wkId,
            source: 'week_delivery',
            itemIdx,
            mapKey: `week_deliv_${wkId}_${itemIdx}`,
            date: weekDisplay,
            name: itemName,
            requestedItems: formatRequestedItems(item.itemDetails || item.items),
            cost: item.cost || item.itemsCost || 0,
            displayTickets: finalTix,
            checked: isChecked,
            status: isChecked ? '✨ Done' : '⏳ Active',
            isManual
          });
        });
      }
    });

  } else {
    const isChore = type === 'chore';
    const isAnimal = type === 'animalBounty';

    const allItemsMap = new Map();
    const weeks = state.globalData?.cloudHistory?.weeks || {};
    
    Object.entries(weeks).forEach(([wkId, wk]) => {
      const targetArr = isChore ? (wk.chores || []) : (wk.bounties || []);
      targetArr.forEach((item, idx) => {
        if (!isChore && isAnimalBounty(item) !== isAnimal) return;
        const dedupeKey = `${wkId}_${idx}_${item.id || (item.name || item.task || '').toLowerCase()}`;
        allItemsMap.set(dedupeKey, { item, weekId: wkId, idx, source: 'week' });
      });
    });

    const liveArr = isChore ? (state.globalData?.chores || []) : (state.globalData?.bounties || []);
    const currentWeekId = getMondayBasedWeekId();
    liveArr.forEach((item, idx) => {
      if (!isChore && isAnimalBounty(item) !== isAnimal) return;
      const dedupeKey = `${currentWeekId}_live_${idx}_${item.id || (item.name || item.task || '').toLowerCase()}`;
      if (!allItemsMap.has(dedupeKey)) {
        allItemsMap.set(dedupeKey, { item, weekId: currentWeekId, idx, source: 'current' });
      }
    });

    Array.from(allItemsMap.entries()).forEach(([mapKey, { item, weekId, idx, source }]) => {
      const baseTix = item.baseTickets !== undefined ? item.baseTickets : (item.tickets || 1);
      const isManual = Boolean(item.isManual);
      const finalTix = computeYield(baseTix, isChore, isManual);
      const lvl = resolveAnimalLevel(item);
      const isChecked = item.checked !== undefined ? item.checked : Boolean(item.completed);

      let weekDisplay = 'Week 2';
      if (weekId) {
        const baseW1 = new Date('2026-08-10T00:00:00.000Z').getTime();
        const itemTime = new Date(`${weekId}T00:00:00.000Z`).getTime();
        const diffWeeks = Math.round((itemTime - baseW1) / (7 * 24 * 60 * 60 * 1000)) + 1;
        if (diffWeeks >= 1 && diffWeeks <= 12) weekDisplay = `Week ${diffWeeks}`;
      }

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
        weekDisplay,
        isManual
      });
    });
  }

  records.sort((a, b) => (a.checked === b.checked ? 0 : a.checked ? 1 : -1));

  let totalTickedTickets = 0;
  let totalTickedCost = 0;

  if (records.length === 0) {
    bodyEl.innerHTML = addFormHtml + '<p style="font-size: 12px; color: #8C7853; font-weight: bold; margin-top:10px;">No records found.</p>';
  } else {
    bodyEl.innerHTML = addFormHtml + records.map(r => {
      if (r.checked) {
        totalTickedTickets += r.displayTickets;
        totalTickedCost += r.cost;
      }
      const labelId = r.date || r.weekDisplay || 'Week';
      const changeHandler = type === 'delivery'
        ? (r.source === 'week_delivery' ? `toggleWeeklyItemCheck('${r.weekId}', '${r.mapKey}')` : `toggleDeliveryLogCheck('${r.source}', ${r.itemIdx})`)
        : `toggleWeeklyItemCheck('${r.weekId}', '${r.mapKey}')`;
      
      const deleteHandler = type === 'delivery'
        ? (r.source === 'week_delivery' ? `deleteWeeklyItem('${r.weekId}', '${r.mapKey}')` : `deleteDeliveryLogItem('${r.source}', ${r.itemIdx})`)
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

      const npcHeader = r.npc ? `<span style="color:#8B4513; font-weight:900;">[${r.npc.toUpperCase()}] </span>` : '';
      const itemsRow = (type === 'delivery' && r.requestedItems) 
        ? `<div style="font-size:10px; color:#6D4C41; font-weight:bold; margin-top:2px;">📦 Needs: ${r.requestedItems}</div>` 
        : '';

      return `<div style="background:#FFF8DC; padding:8px 12px; border:2px solid #8B5A2B; border-radius:6px; display:flex; justify-content:space-between; align-items:center; font-size:11px; margin-bottom:6px;">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; flex:1; padding-right:8px;">
          <input type="checkbox" ${r.checked ? 'checked' : ''} onchange="${changeHandler}" style="accent-color:#D2691E; width:15px; height:15px;" />
          <div>
            <span style="font-weight:bold; color:#8B4513;">📅 ${labelId} (${r.status})</span><br/>
            ${npcHeader}<strong style="color:#3E2723;">${r.name}</strong>${animalLevelTag}${manualTag}${stackedTag}
            ${itemsRow}
          </div>
        </label>
        <div style="display:flex; align-items:center; gap:6px;">
          <span>SFL:</span>
          <input type="number" step="0.01" value="${r.cost}" onchange="updateHistoryItemCost('${r.source || r.weekId}', '${r.mapKey || r.itemIdx}', this.value)" style="width:60px; padding:2px; font-size:10px;" />
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
  const todayDateStr = new Date().toISOString().split('T')[0];

  if (!state.globalData.cloudHistory) state.globalData.cloudHistory = {};
  if (!state.globalData.cloudHistory.weeks) state.globalData.cloudHistory.weeks = {};
  if (!state.globalData.cloudHistory.weeks[targetWeekId]) {
    state.globalData.cloudHistory.weeks[targetWeekId] = { weekId: targetWeekId, deliveries: [], bounties: [], chores: [] };
  }

  const newItem = {
    from: nameInput,
    name: nameInput,
    task: nameInput,
    baseTickets: ticketsInput,
    tickets: ticketsInput,
    cost: costInput,
    itemsCost: costInput,
    checked: true,
    completed: true,
    completedAt: Date.now(),
    completedDate: todayDateStr,
    isManual: true,
    weekId: targetWeekId
  };

  if (type === 'delivery') {
    if (!state.globalData.cloudHistory.weeks[targetWeekId].deliveries) {
      state.globalData.cloudHistory.weeks[targetWeekId].deliveries = [];
    }
    state.globalData.cloudHistory.weeks[targetWeekId].deliveries.push(newItem);
  } else if (type === 'chore') {
    newItem.npc = nameInput.includes(':') ? nameInput.split(':')[0].trim() : 'Custom';
    newItem.task = nameInput.includes(':') ? nameInput.split(':')[1].trim() : nameInput;
    state.globalData.cloudHistory.weeks[targetWeekId].chores.push(newItem);
  } else {
    const isAnimal = type === 'animalBounty';
    newItem.level = isAnimal ? 1 : undefined;
    state.globalData.cloudHistory.weeks[targetWeekId].bounties.push(newItem);
  }

  renderColumnHistoryModalList();
  recalculateAll();
  await syncCurrentVaultToCloud();
}
