import { state, formatSFL, setElemText, getActiveBoostCount, getActiveVipBonus, getMondayBasedWeekId, isAnimalBounty } from './state.js';
import { recalculateAll } from './render.js';

export async function syncCurrentVaultToCloud() {
  if (!state.currentUser || !state.globalData) return;
  try {
    const trackTickets = parseInt(document.getElementById('trackTicketsInput')?.value) || (state.globalData.cloudHistory?.trackTickets || 0);
    const trackCost = parseFloat(document.getElementById('trackCostInput')?.value) || (state.globalData.cloudHistory?.trackCost || 0);
    const dailyLoginTickets = parseInt(document.getElementById('dailyLoginCount')?.value) || (state.globalData.cloudHistory?.dailyLoginTickets || 0);
    const lastDailyLoginDate = localStorage.getItem('sfl_daily_login_last_date') || new Date().toISOString().split('T')[0];

    if (!state.globalData.cloudHistory) state.globalData.cloudHistory = {};

    const payload = {
      username: state.currentUser,
      trackTickets,
      trackCost,
      dailyLoginTickets,
      lastDailyLoginDate,
      milestones: state.globalData.milestones || {},
      logs: state.globalData.cloudHistory.logs || [],
      weeks: state.globalData.cloudHistory.weeks || {},
      bounties: state.globalData.bounties || [],
      chores: state.globalData.chores || [],
      deliveries: state.globalData.deliveries || []
    };

    const response = await fetch('/api/chapter?action=saveVault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const resData = await response.json();
    if (resData.vaultData) {
      state.currentVaultData = resData.vaultData;
      state.globalData.cloudHistory = resData.vaultData;
    }
  } catch (err) {
    console.error('Failed to auto-sync edit to Cloud KV:', err);
  }
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

function resolveAnimalLevel(item) {
  if (item.level) return item.level;
  if (item.tier) return item.tier;

  const rawName = typeof item === 'string' ? item : (item.name || '');
  const lvlMatch = rawName.match(/(?:lvl|level|#|\()\s*(\d+)/i);
  if (lvlMatch) return lvlMatch[1];

  if (state.globalData?.bounties) {
    const liveMatch = state.globalData.bounties.find(b => 
      (b.id && item.id && String(b.id) === String(item.id)) ||
      (b.name && rawName && b.name.toLowerCase() === rawName.toLowerCase())
    );
    if (liveMatch?.level) return liveMatch.level;
  }

  return null;
}

export function toggleGuideModal() {
  const modal = document.getElementById('guideModal');
  if (modal) modal.classList.toggle('show');
}

export function openCategorySummaryModal(cat) {
  const modal = document.getElementById('categorySummaryModal');
  const titleEl = document.getElementById('categorySummaryTitle');
  const totalsEl = document.getElementById('categorySummaryTotals');
  const bodyEl = document.getElementById('categorySummaryBody');

  const boostCount = getActiveBoostCount();

  if (!state.globalData) {
    alert('Please click "FETCH DATA" first!');
    return;
  }

  let catTickets = 0;
  let catCost = 0;

  if (cat === 'delivery') {
    titleEl.textContent = '📦 NPC DELIVERIES OVERVIEW';
    const sortedDeliv = [...state.globalData.deliveries].sort((a, b) => {
      const aDone = a.checked !== undefined ? a.checked : Boolean(a.completed);
      const bDone = b.checked !== undefined ? b.checked : Boolean(b.completed);
      return aDone === bDone ? 0 : aDone ? 1 : -1;
    });

    bodyEl.innerHTML = sortedDeliv.map(d => {
      const isTicked = d.checked !== undefined ? d.checked : Boolean(d.completed);
      const finalTickets = d.baseTickets !== undefined ? d.baseTickets : (d.tickets || 0);
      if (isTicked) {
        catTickets += finalTickets;
        catCost += (d.itemsCost || d.cost || 0);
      }
      const isStackedBadge = d.isStacked ? '<span style="background:#E1BEE7; color:#4A148C; font-size:9px; font-weight:900; padding:1px 5px; border-radius:4px; border:1px solid #CE93D8; margin-left:4px;">🥞 STACKED</span>' : '';
      const itemRows = (d.itemDetails || []).map(it => `• ${it.qty}x ${it.name} (${formatSFL(it.lineCost)} SFL)`).join('<br/>');
      return `<div style="background:#FFF8DC; border:2px solid #8B5A2B; padding:10px; border-radius:8px; display:flex; flex-direction:column; gap:4px; font-size:11px;">
        <div style="display:flex; justify-content:space-between; font-weight:900;">
          <span style="color:#8B4513;">👤 ${(d.from || d.name || 'NPC').toUpperCase()} ${d.isChapterNpc ? '👑' : ''}${isStackedBadge}</span>
          <span class="badge ${isTicked ? 'badge-done' : 'badge-active'}">${isTicked ? '✨ DONE' : '⏳ ACTIVE'}</span>
        </div>
        <div style="color:#5C4033; font-weight:bold;">${itemRows}</div>
        <div style="display:flex; justify-content:space-between; font-weight:900; color:#2E7D32; border-top:1px dashed #D2B48C; padding-top:4px;">
          <span>Yield: ${finalTickets} Tickets</span>
          <span>${formatSFL(d.itemsCost || d.cost)} SFL</span>
        </div>
      </div>`;
    }).join('');
  } else if (cat === 'bounty' || cat === 'animalBounty') {
    const isAnimal = cat === 'animalBounty';
    titleEl.textContent = isAnimal ? '🐄 ANIMAL BOUNTIES OVERVIEW' : '📜 BOUNTIES OVERVIEW';
    
    const currentBounties = (state.globalData.bounties || []).filter(b => {
      return isAnimalBounty(b) === isAnimal;
    });

    const sortedBounties = [...currentBounties].sort((a, b) => {
      const aDone = a.checked !== undefined ? a.checked : Boolean(a.completed);
      const bDone = b.checked !== undefined ? b.checked : Boolean(b.completed);
      return aDone === bDone ? 0 : aDone ? 1 : -1;
    });

    bodyEl.innerHTML = sortedBounties.map(b => {
      const isTicked = b.checked !== undefined ? b.checked : Boolean(b.completed);
      const finalTickets = b.baseTickets !== undefined ? b.baseTickets : (b.tickets || 0);
      if (isTicked) {
        catTickets += finalTickets;
        catCost += (b.itemsCost || b.cost || 0);
      }
      const lvl = resolveAnimalLevel(b);
      return `<div style="background:#FFF8DC; border:2px solid #8B5A2B; padding:8px 10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:11px;">
        <div>
          <strong style="color:#3E2723;">${isAnimal ? '🐄' : '📜'} ${(b.name || '').toUpperCase()} ${lvl ? '(Lvl ' + lvl + ')' : ''}</strong><br/>
          <span style="color:#8B4513; font-weight:bold;">Yield: ${finalTickets} Tickets | ${formatSFL(b.itemsCost || b.cost || 0)} SFL</span>
        </div>
        <span class="badge ${isTicked ? 'badge-done' : 'badge-active'}">${isTicked ? '✨ DONE' : '⏳ ACTIVE'}</span>
      </div>`;
    }).join('');

  } else if (cat === 'chore') {
    titleEl.textContent = '🧹 CHORES OVERVIEW';

    const currentChores = state.globalData.chores || [];

    const sortedChores = [...currentChores].sort((a, b) => {
      const aDone = a.checked !== undefined ? a.checked : Boolean(a.completed);
      const bDone = b.checked !== undefined ? b.checked : Boolean(b.completed);
      return aDone === bDone ? 0 : aDone ? 1 : -1;
    });

    bodyEl.innerHTML = sortedChores.map(c => {
      const isTicked = c.checked !== undefined ? c.checked : Boolean(c.completed);
      const finalTickets = c.baseTickets !== undefined ? c.baseTickets : (c.tickets || 0);
      if (isTicked) {
        catTickets += finalTickets;
        catCost += (c.itemsCost || c.cost || 0);
      }
      return `<div style="background:#FFF8DC; border:2px solid #8B5A2B; padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:11px;">
        <div>
          <strong style="color:#3E2723;">🧹 ${(c.npc || 'NPC').toUpperCase()}</strong><br/>
          <span style="color:#5C4033; font-weight:bold;">${c.task || c.name}</span><br/>
          <span style="color:#2E7D32; font-weight:900;">Yield: ${finalTickets} Tickets | ${formatSFL(c.itemsCost || c.cost || 0)} SFL</span>
        </div>
        <span class="badge ${isTicked ? 'badge-done' : 'badge-active'}">${isTicked ? '✨ DONE' : '⏳ ACTIVE'}</span>
      </div>`;
    }).join('');
  }

  totalsEl.textContent = `${catTickets} Tickets | ${formatSFL(catCost)} SFL`;
  modal.classList.add('show');
}

export function closeCategorySummaryModal() {
  document.getElementById('categorySummaryModal').classList.remove('show');
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
      const rawLogs = (state.globalData && state.globalData.cloudHistory && state.globalData.cloudHistory.logs) || [];
      rawLogs.forEach(log => {
        (log.deliveriesDone || []).forEach(d => {
          const name = typeof d === 'string' ? d : (d.name || d.from);
          if (name) npcSet.add(name.trim());
        });
      });
      (state.globalData?.deliveries || []).forEach(d => {
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
    weekOptionsHtml += `<option value="w${w}">Week ${w}</option>`;
  }

  let addFormHtml = `<div style="background:#EFEBE9; border:2px dashed #8B5A2B; padding:10px; border-radius:8px; margin-bottom:12px; display:flex; flex-direction:column; gap:6px;">
    <div style="font-weight:900; color:#5C4033; font-size:11px;">➕ ADD NEW ${type === 'delivery' ? 'DELIVERY' : type === 'chore' ? 'CHORE' : type === 'animalBounty' ? 'ANIMAL BOUNTY' : 'BOUNTY'}</div>
    <div style="display:flex; gap:6px; flex-wrap:wrap;">
      <input type="text" id="addModalName" placeholder="${type === 'delivery' ? 'NPC Name' : type === 'chore' ? 'NPC & Task (e.g. Goblin: Water)' : 'Item Name'}" style="flex:2; padding:4px; font-size:11px;" />
      <select id="addModalWeekSelect" style="flex:1.5; padding:4px; font-size:11px; background:#fff; border:1px solid #8B5A2B; border-radius:4px;">
        ${weekOptionsHtml}
      </select>
      <input type="number" step="0.01" id="addModalCost" placeholder="Cost SFL" style="width:70px; padding:4px; font-size:11px;" />
      <input type="number" id="addModalTickets" placeholder="Tickets" style="width:60px; padding:4px; font-size:11px;" />
      <button onclick="addNewItemFromModal()" class="btn btn-sm btn-wood" style="background:#2E7D32; border-color:#1B5E20; color:#fff; padding:4px 10px; font-weight:bold;">Add</button>
    </div>
  </div>`;

  if (type === 'delivery') {
    const rawLogs = (state.globalData && state.globalData.cloudHistory && state.globalData.cloudHistory.logs) || [];
    const seenDates = new Set();
    
    rawLogs.forEach((log, logIdx) => {
      const cleanDate = (log.date || 'Past Run').split('T')[0];
      if (seenDates.has(cleanDate)) return;
      seenDates.add(cleanDate);

      (log.deliveriesDone || []).forEach((item, itemIdx) => {
        const finalTix = item.baseTickets !== undefined ? item.baseTickets : (item.tickets || 2);
        const requestedStr = formatRequestedItems(item.itemDetails || item.items);
        const itemName = typeof item === 'string' ? item : (item.name || item.from || 'NPC Delivery');
        const isChecked = item.checked !== undefined ? item.checked : Boolean(item.completed);

        records.push({
          logIdx,
          itemIdx,
          date: cleanDate,
          name: itemName,
          requestedItems: requestedStr,
          cost: item.cost || 0,
          displayTickets: finalTix,
          checked: isChecked,
          status: isChecked ? '✨ Done' : '⏳ Active',
          isStacked: item.isStacked || false
        });
      });
    });
  } else {
    const currentWeekId = getMondayBasedWeekId();
    const isChore = type === 'chore';
    const isAnimal = type === 'animalBounty';

    const allItemsMap = new Map();
    
    if (isChore) {
      (state.globalData?.chores || []).forEach((c, idx) => {
        allItemsMap.set(`current_${idx}`, { item: c, weekId: currentWeekId });
      });
      const weeks = state.globalData?.cloudHistory?.weeks || {};
      Object.entries(weeks).forEach(([wkId, wk]) => {
        (wk.chores || []).forEach((c, idx) => {
          allItemsMap.set(`week_${wkId}_${idx}`, { item: c, weekId: wkId });
        });
      });
    } else {
      (state.globalData?.bounties || []).forEach((b, idx) => {
        if (isAnimalBounty(b) === isAnimal) {
          allItemsMap.set(`current_${idx}`, { item: b, weekId: currentWeekId });
        }
      });
      const weeks = state.globalData?.cloudHistory?.weeks || {};
      Object.entries(weeks).forEach(([wkId, wk]) => {
        (wk.bounties || []).forEach((b, idx) => {
          if (isAnimalBounty(b) === isAnimal) {
            allItemsMap.set(`week_${wkId}_${idx}`, { item: b, weekId: wkId });
          }
        });
      });
    }

    Array.from(allItemsMap.entries()).forEach(([mapKey, { item, weekId }], itemIdx) => {
      const finalTix = item.baseTickets !== undefined ? item.baseTickets : (item.tickets || 1);
      const lvl = resolveAnimalLevel(item);
      const isChecked = item.checked !== undefined ? item.checked : Boolean(item.completed);

      records.push({
        weekId: weekId,
        itemIdx: itemIdx,
        mapKey: mapKey,
        name: isChore ? (item.task || item.name || 'Chore') : (item.name || 'Bounty'),
        npc: item.npc || null,
        level: lvl,
        cost: item.cost !== undefined ? item.cost : (item.itemsCost || 0),
        displayTickets: finalTix,
        checked: isChecked,
        status: isChecked ? '✨ Done' : '⏳ Active'
      });
    });
  }

  records.sort((a, b) => {
    if (a.checked === b.checked) return 0;
    return a.checked ? 1 : -1;
  });

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
      const labelId = type === 'delivery' ? `${r.date}` : `${r.weekId}`;
      const changeHandler = type === 'delivery'
        ? `toggleDeliveryLogCheck(${r.logIdx}, ${r.itemIdx})`
        : `toggleWeeklyItemCheck('${r.weekId}', '${r.mapKey || r.itemIdx}')`;
      
      const deleteHandler = type === 'delivery'
        ? `deleteDeliveryLogItem(${r.logIdx}, ${r.itemIdx})`
        : `deleteWeeklyItem('${r.weekId}', '${r.mapKey || r.itemIdx}')`;

      const animalLevelTag = (type === 'animalBounty' && r.level) 
        ? `<span style="background:#EBDEF0; color:#6C3483; font-size:10px; font-weight:900; padding:1px 5px; border-radius:4px; border:1px solid #D7BDE2; margin-left:4px;">Lvl ${r.level}</span>` 
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
            ${npcHeader}<strong style="color:#3E2723;">${r.name}</strong>${animalLevelTag}${stackedTag}
            ${itemsRow}
          </div>
        </label>
        <div style="display:flex; align-items:center; gap:6px;">
          <span>SFL:</span>
          <input type="number" step="0.01" value="${r.cost}" onchange="updateHistoryItemCost('${r.weekId || r.logIdx}', '${r.mapKey || r.itemIdx}', this.value)" style="width:60px; padding:2px; font-size:10px;" />
          <span>Tix:</span>
          <input type="number" value="${r.displayTickets}" onchange="updateHistoryItemTickets('${r.weekId || r.logIdx}', '${r.mapKey || r.itemIdx}', this.value)" style="width:45px; padding:2px; font-size:10px;" title="Ticket Total" />
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
  const ticketsInput = parseInt(document.getElementById('addModalTickets')?.value) || 2;

  if (!state.globalData) return;

  let targetWeekId = getMondayBasedWeekId();
  const weekNum = parseInt(weekSelectVal.substring(1), 10);
  if (!isNaN(weekNum) && weekNum > 0) {
    const baseMonday = new Date('2026-08-17');
    baseMonday.setDate(baseMonday.getDate() + ((weekNum - 1) * 7));
    targetWeekId = getMondayBasedWeekId(baseMonday);
  }

  if (type === 'delivery') {
    if (!state.globalData.cloudHistory) state.globalData.cloudHistory = {};
    if (!state.globalData.cloudHistory.logs) state.globalData.cloudHistory.logs = [];

    const deliveryDate = targetWeekId;
    let logEntry = state.globalData.cloudHistory.logs.find(l => (l.date || '').split('T')[0] === deliveryDate);
    if (!logEntry) {
      logEntry = { date: deliveryDate, deliveriesDone: [] };
      state.globalData.cloudHistory.logs.push(logEntry);
    }

    logEntry.deliveriesDone.push({
      from: nameInput,
      name: nameInput,
      baseTickets: ticketsInput,
      tickets: ticketsInput,
      cost: costInput,
      itemsCost: costInput,
      checked: true,
      completed: true,
      completedAt: Date.now()
    });
  } else {
    const isChore = type === 'chore';
    const isAnimal = type === 'animalBounty';

    const newItem = isChore ? {
      npc: nameInput.includes(':') ? nameInput.split(':')[0].trim() : 'Custom',
      task: nameInput.includes(':') ? nameInput.split(':')[1].trim() : nameInput,
      baseTickets: ticketsInput,
      tickets: ticketsInput,
      cost: costInput,
      itemsCost: costInput,
      checked: true,
      completed: true,
      completedAt: Date.now()
    } : {
      name: nameInput,
      baseTickets: ticketsInput,
      tickets: ticketsInput,
      cost: costInput,
      itemsCost: costInput,
      level: isAnimal ? 1 : undefined,
      checked: true,
      completed: true,
      completedAt: Date.now()
    };

    if (targetWeekId === getMondayBasedWeekId()) {
      if (isChore) {
        if (!state.globalData.chores) state.globalData.chores = [];
        state.globalData.chores.push(newItem);
      } else {
        if (!state.globalData.bounties) state.globalData.bounties = [];
        state.globalData.bounties.push(newItem);
      }
    } else {
      if (!state.globalData.cloudHistory) state.globalData.cloudHistory = {};
      if (!state.globalData.cloudHistory.weeks) state.globalData.cloudHistory.weeks = {};
      if (!state.globalData.cloudHistory.weeks[targetWeekId]) {
        state.globalData.cloudHistory.weeks[targetWeekId] = { weekId: targetWeekId, bounties: [], chores: [] };
      }
      if (isChore) {
        state.globalData.cloudHistory.weeks[targetWeekId].chores.push(newItem);
      } else {
        state.globalData.cloudHistory.weeks[targetWeekId].bounties.push(newItem);
      }
    }
  }

  renderColumnHistoryModalList();
  recalculateAll();
  await syncCurrentVaultToCloud();
}

export async function toggleDeliveryLogCheck(logIdx, itemIdx) {
  const logs = state.globalData?.cloudHistory?.logs;
  if (logs?.[logIdx]?.deliveriesDone?.[itemIdx]) {
    const item = logs[logIdx].deliveriesDone[itemIdx];
    const newStatus = !(item.checked !== undefined ? item.checked : Boolean(item.completed));
    item.checked = newStatus;
    item.completed = newStatus;
    renderColumnHistoryModalList();
    recalculateAll();
    await syncCurrentVaultToCloud();
  }
}

export async function deleteDeliveryLogItem(logIdx, itemIdx) {
  const logs = state.globalData?.cloudHistory?.logs;
  if (logs?.[logIdx]?.deliveriesDone) {
    logs[logIdx].deliveriesDone.splice(itemIdx, 1);
    renderColumnHistoryModalList();
    recalculateAll();
    await syncCurrentVaultToCloud();
  }
}

export async function toggleWeeklyItemCheck(weekId, mapKeyOrIdx) {
  const type = state.activeColumnType;
  let targetItem = null;

  if (typeof mapKeyOrIdx === 'string' && mapKeyOrIdx.includes('_')) {
    const [source, wkOrIdx, idx] = mapKeyOrIdx.split('_');
    if (source === 'current') {
      const numericIdx = parseInt(idx, 10);
      if (type === 'chore') {
        targetItem = state.globalData?.chores?.[numericIdx];
      } else {
        const isAnimal = type === 'animalBounty';
        const bounties = (state.globalData?.bounties || []).filter(b => isAnimalBounty(b) === isAnimal);
        targetItem = bounties?.[numericIdx];
      }
    } else if (source === 'week') {
      const wkKey = wkOrIdx;
      const numericIdx = parseInt(idx, 10);
      const wkObj = state.globalData?.cloudHistory?.weeks?.[wkKey];
      if (wkObj) {
        if (type === 'chore') {
          targetItem = wkObj.chores?.[numericIdx];
        } else {
          const isAnimal = type === 'animalBounty';
          const bounties = (wkObj.bounties || []).filter(b => isAnimalBounty(b) === isAnimal);
          targetItem = bounties?.[numericIdx];
        }
      }
    }
  } else {
    const itemIdx = parseInt(mapKeyOrIdx, 10);
    if (type === 'chore') {
      targetItem = state.globalData?.chores?.[itemIdx];
    } else {
      const isAnimal = type === 'animalBounty';
      const bounties = (state.globalData?.bounties || []).filter(b => isAnimalBounty(b) === isAnimal);
      targetItem = bounties?.[itemIdx];
    }
  }

  if (targetItem) {
    const newStatus = !(targetItem.checked !== undefined ? targetItem.checked : Boolean(targetItem.completed));
    targetItem.checked = newStatus;
    targetItem.completed = newStatus;
    
    if (newStatus) {
      targetItem.completedAt = targetItem.completedAt || Date.now();
      targetItem.checkedToday = true;
    } else {
      targetItem.completedAt = null;
      targetItem.checkedToday = false;
    }

    if (!state.globalData.cloudHistory) state.globalData.cloudHistory = {};
    if (!state.globalData.cloudHistory.weeks) state.globalData.cloudHistory.weeks = {};
    if (!state.globalData.cloudHistory.weeks[weekId]) {
      state.globalData.cloudHistory.weeks[weekId] = { weekId, bounties: state.globalData.bounties || [], chores: state.globalData.chores || [] };
    }

    renderColumnHistoryModalList();
    recalculateAll();
    await syncCurrentVaultToCloud();
  }
}

export async function updateHistoryItemTickets(idKey, mapKeyOrIdx, val) {
  const type = state.activeColumnType;
  const inputVal = parseInt(val, 10) || 0;

  if (type === 'delivery') {
    const logs = state.globalData?.cloudHistory?.logs;
    const logIdx = parseInt(idKey, 10);
    const itemIdx = parseInt(mapKeyOrIdx, 10);
    if (logs?.[logIdx]?.deliveriesDone?.[itemIdx]) {
      logs[logIdx].deliveriesDone[itemIdx].baseTickets = inputVal;
      logs[logIdx].deliveriesDone[itemIdx].tickets = inputVal;
    }
  } else {
    if (typeof mapKeyOrIdx === 'string' && mapKeyOrIdx.includes('_')) {
      const [source, wkOrIdx, idx] = mapKeyOrIdx.split('_');
      const numericIdx = parseInt(idx, 10);
      if (source === 'current') {
        if (type === 'chore' && state.globalData?.chores?.[numericIdx]) {
          state.globalData.chores[numericIdx].baseTickets = inputVal;
          state.globalData.chores[numericIdx].tickets = inputVal;
        } else {
          const isAnimal = type === 'animalBounty';
          const bounties = (state.globalData?.bounties || []).filter(b => isAnimalBounty(b) === isAnimal);
          if (bounties[numericIdx]) {
            bounties[numericIdx].baseTickets = inputVal;
            bounties[numericIdx].tickets = inputVal;
          }
        }
      } else if (source === 'week') {
        const wkObj = state.globalData?.cloudHistory?.weeks?.[wkOrIdx];
        if (wkObj) {
          if (type === 'chore' && wkObj.chores?.[numericIdx]) {
            wkObj.chores[numericIdx].baseTickets = inputVal;
            wkObj.chores[numericIdx].tickets = inputVal;
          } else {
            const isAnimal = type === 'animalBounty';
            const bounties = (wkObj.bounties || []).filter(b => isAnimalBounty(b) === isAnimal);
            if (bounties[numericIdx]) {
              bounties[numericIdx].baseTickets = inputVal;
              bounties[numericIdx].tickets = inputVal;
            }
          }
        }
      }
    } else {
      const itemIdx = parseInt(mapKeyOrIdx, 10);
      if (type === 'chore' && state.globalData?.chores?.[itemIdx]) {
        state.globalData.chores[itemIdx].baseTickets = inputVal;
        state.globalData.chores[itemIdx].tickets = inputVal;
      } else {
        const isAnimal = type === 'animalBounty';
        const bounties = (state.globalData?.bounties || []).filter(b => isAnimalBounty(b) === isAnimal);
        if (bounties[itemIdx]) {
          bounties[itemIdx].baseTickets = inputVal;
          bounties[itemIdx].tickets = inputVal;
        }
      }
    }
  }

  renderColumnHistoryModalList();
  recalculateAll();
  await syncCurrentVaultToCloud();
}

export async function updateHistoryItemCost(idKey, mapKeyOrIdx, val) {
  const type = state.activeColumnType;
  const costVal = parseFloat(val) || 0;

  if (type === 'delivery') {
    const logs = state.globalData?.cloudHistory?.logs;
    const logIdx = parseInt(idKey, 10);
    const itemIdx = parseInt(mapKeyOrIdx, 10);
    if (logs?.[logIdx]?.deliveriesDone?.[itemIdx]) {
      logs[logIdx].deliveriesDone[itemIdx].cost = costVal;
      logs[logIdx].deliveriesDone[itemIdx].itemsCost = costVal;
    }
  } else {
    const isChore = type === 'chore';
    const isAnimal = type === 'animalBounty';

    if (typeof mapKeyOrIdx === 'string' && mapKeyOrIdx.includes('_')) {
      const [source, wkOrIdx, idx] = mapKeyOrIdx.split('_');
      const numericIdx = parseInt(idx, 10);
      if (source === 'current') {
        if (isChore && state.globalData?.chores?.[numericIdx]) {
          state.globalData.chores[numericIdx].cost = costVal;
          state.globalData.chores[numericIdx].itemsCost = costVal;
        } else if (!isChore) {
          const bounties = (state.globalData?.bounties || []).filter(b => isAnimalBounty(b) === isAnimal);
          if (bounties[numericIdx]) {
            bounties[numericIdx].cost = costVal;
            bounties[numericIdx].itemsCost = costVal;
          }
        }
      } else if (source === 'week') {
        const wkObj = state.globalData?.cloudHistory?.weeks?.[wkOrIdx];
        if (wkObj) {
          if (isChore && wkObj.chores?.[numericIdx]) {
            wkObj.chores[numericIdx].cost = costVal;
            wkObj.chores[numericIdx].itemsCost = costVal;
          } else if (!isChore) {
            const bounties = (wkObj.bounties || []).filter(b => isAnimalBounty(b) === isAnimal);
            if (bounties[numericIdx]) {
              bounties[numericIdx].cost = costVal;
              bounties[numericIdx].itemsCost = costVal;
            }
          }
        }
      }
    } else {
      const itemIdx = parseInt(mapKeyOrIdx, 10);
      if (isChore && state.globalData?.chores?.[itemIdx]) {
        state.globalData.chores[itemIdx].cost = costVal;
        state.globalData.chores[itemIdx].itemsCost = costVal;
      } else if (!isChore) {
        const bounties = (state.globalData?.bounties || []).filter(b => isAnimalBounty(b) === isAnimal);
        if (bounties[itemIdx]) {
          bounties[itemIdx].cost = costVal;
          bounties[itemIdx].itemsCost = costVal;
        }
      }
    }
  }

  renderColumnHistoryModalList();
  recalculateAll();
  await syncCurrentVaultToCloud();
}

export async function deleteWeeklyItem(weekId, mapKeyOrIdx) {
  const type = state.activeColumnType;
  const isChore = type === 'chore';
  const isAnimal = type === 'animalBounty';

  if (typeof mapKeyOrIdx === 'string' && mapKeyOrIdx.includes('_')) {
    const [source, wkOrIdx, idx] = mapKeyOrIdx.split('_');
    const numericIdx = parseInt(idx, 10);
    if (source === 'current') {
      if (isChore) {
        state.globalData?.chores?.splice(numericIdx, 1);
      } else {
        const all = state.globalData?.bounties || [];
        let count = 0;
        for (let i = 0; i < all.length; i++) {
          if (isAnimalBounty(all[i]) === isAnimal) {
            if (count === numericIdx) {
              all.splice(i, 1);
              break;
            }
            count++;
          }
        }
      }
    } else if (source === 'week') {
      const wkObj = state.globalData?.cloudHistory?.weeks?.[wkOrIdx];
      if (wkObj) {
        if (isChore) {
          wkObj.chores?.splice(numericIdx, 1);
        } else {
          const all = wkObj.bounties || [];
          let count = 0;
          for (let i = 0; i < all.length; i++) {
            if (isAnimalBounty(all[i]) === isAnimal) {
              if (count === numericIdx) {
                all.splice(i, 1);
                break;
              }
              count++;
            }
          }
        }
      }
    }
  }

  renderColumnHistoryModalList();
  recalculateAll();
  await syncCurrentVaultToCloud();
}

export async function deleteMasterLog(logIdx) {
  if (!state.globalData?.cloudHistory?.logs) return;
  if (confirm('🗑️ Delete this snapshot log?')) {
    state.globalData.cloudHistory.logs.splice(logIdx, 1);
    await syncCurrentVaultToCloud();
    toggleHistoryModal();
    toggleHistoryModal();
    recalculateAll();
  }
}

export function toggleHistoryModal() {
  const modal = document.getElementById('historyModal');
  modal.classList.toggle('show');

  if (modal.classList.contains('show') && state.globalData?.cloudHistory) {
    const logs = state.globalData.cloudHistory.logs || [];
    const container = document.getElementById('modalLogList');

    if (logs.length === 0) {
      container.innerHTML = '<p style="color:#8C7853; font-size:12px; font-weight:bold;">No saved vault logs found for this account yet.</p>';
    } else {
      container.innerHTML = logs.map((log, idx) => {
        const delivHtml = (log.deliveriesDone && log.deliveriesDone.length > 0) ? 
          `<div style="color:#5C4033; font-size:11px;"><strong>📦 Daily Deliveries:</strong> ${log.deliveriesDone.map(d => typeof d === 'string' ? d : `${d.name} (${formatSFL(d.cost)} SFL)`).join(', ')}</div>` : '';

        const logTickets = log.ticketsSaved || 0;
        const logCost = log.costSaved || 0;
        const logRatio = logTickets > 0 ? formatSFL(logCost / logTickets) : "0.00";

        return `<div style="background:#FFF8DC; padding:12px; border:2px solid #8B5A2B; border-radius:6px; display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center; color:#5C4033; font-size:11px; font-weight:900;">
            <span style="color:#8B4513;">Log #${logs.length - idx} (${log.date || 'Snapshot'})</span>
            <button onclick="deleteMasterLog(${idx})" class="btn btn-sm btn-wood" style="background:#C0392B; border-color:#922B21; color:#fff; padding:2px 8px;">🗑️ DELETE</button>
          </div>
          <div style="display:flex; justify-content:space-between; color:#2E7D32; font-weight:900; font-size:12px; border-bottom:1px dashed #D2B48C; padding-bottom:4px;">
            <span>Daily Yield: +${logTickets} | Cost: ${formatSFL(logCost)} SFL</span>
            <span style="background:#E8F5E9; padding:1px 6px; border-radius:4px; border:1px solid #A5D6A7;">${logRatio} SFL / Ticket</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:3px;">${delivHtml}</div>
        </div>`;
      }).join('');
    }
  }
}
