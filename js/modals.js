import { state, formatSFL, setElemText, getActiveBoostCount, getActiveVipBonus, getMondayBasedWeekId } from './state.js';
import { recalculateAll } from './render.js';

// Auto-sync any modifications in the Edit Modal directly to Cloud KV
export async function syncCurrentVaultToCloud() {
  if (!state.currentUser || !state.globalData?.cloudHistory) return;
  try {
    const trackTickets = parseInt(document.getElementById('trackTicketsInput')?.value) || 0;
    const trackCost = parseFloat(document.getElementById('trackCostInput')?.value) || 0;

    const response = await fetch('/api/chapter?action=saveVault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: state.currentUser,
        trackTickets,
        trackCost,
        logs: state.globalData.cloudHistory.logs || [],
        bounties: state.globalData.bounties || [],
        chores: state.globalData.chores || [],
        deliveries: state.globalData.deliveries || []
      })
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

// Helper to format requested items string
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

// Helper to extract or lookup animal level
function resolveAnimalLevel(item) {
  if (item.level) return item.level;
  if (item.tier) return item.tier;

  const rawName = typeof item === 'string' ? item : (item.name || '');
  
  // Extract number from name if present (e.g. "Cow Lvl 3", "Level 2 Chicken", "Sheep (3)")
  const lvlMatch = rawName.match(/(?:lvl|level|#|\()\s*(\d+)/i);
  if (lvlMatch) return lvlMatch[1];

  // Lookup in live globalData bounties
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

  const vipBonus = getActiveVipBonus();
  const boostCount = getActiveBoostCount();

  if (!state.globalData) {
    alert('Please click "FETCH DATA" first!');
    return;
  }

  let catTickets = 0;
  let catCost = 0;

  if (cat === 'delivery') {
    titleEl.textContent = '📦 NPC DELIVERIES OVERVIEW';
    const sortedDeliv = [...state.globalData.deliveries].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
    bodyEl.innerHTML = sortedDeliv.map(d => {
      const deliveryAddon = d.isManual ? 0 : (vipBonus + boostCount);
      const finalTickets = d.baseTickets + deliveryAddon;
      if (d.completed) {
        catTickets += finalTickets;
        catCost += (d.itemsCost || 0);
      }
      const itemRows = (d.itemDetails || []).map(it => `• ${it.qty}x ${it.name} (${formatSFL(it.lineCost)} SFL)`).join('<br/>');
      return `<div style="background:#FFF8DC; border:2px solid #8B5A2B; padding:10px; border-radius:8px; display:flex; flex-direction:column; gap:4px; font-size:11px;">
        <div style="display:flex; justify-content:space-between; font-weight:900;">
          <span style="color:#8B4513;">👤 ${d.from.toUpperCase()} ${d.isChapterNpc ? '👑' : ''}</span>
          <span class="badge ${d.completed ? 'badge-done' : 'badge-active'}">${d.completed ? '✨ DONE' : '⏳ ACTIVE'}</span>
        </div>
        <div style="color:#5C4033; font-weight:bold;">${itemRows}</div>
        <div style="display:flex; justify-content:space-between; font-weight:900; color:#2E7D32; border-top:1px dashed #D2B48C; padding-top:4px;">
          <span>Yield: ${finalTickets} Tickets</span>
          <span>${formatSFL(d.itemsCost)} SFL (${formatSFL(finalTickets > 0 ? d.itemsCost / finalTickets : 0)} SFL/Ticket)</span>
        </div>
      </div>`;
    }).join('');
  } else if (cat === 'bounty' || cat === 'animalBounty') {
    const isAnimal = cat === 'animalBounty';
    titleEl.textContent = isAnimal ? '🐄 ANIMAL BOUNTIES OVERVIEW' : '📜 BOUNTIES OVERVIEW';
    
    const filteredBounties = (state.globalData.bounties || []).filter(b => {
      const n = (b.name || '').toLowerCase();
      const checkAnimal = n.includes('chicken') || n.includes('cow') || n.includes('sheep');
      return isAnimal ? checkAnimal : !checkAnimal;
    });

    const sortedBounties = [...filteredBounties].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));

    bodyEl.innerHTML = sortedBounties.map(b => {
      const finalTickets = b.baseTickets + boostCount;
      if (b.completed) {
        catTickets += finalTickets;
        catCost += (b.itemsCost || 0);
      }
      const lvl = resolveAnimalLevel(b);
      return `<div style="background:#FFF8DC; border:2px solid #8B5A2B; padding:8px 10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:11px;">
        <div>
          <strong style="color:#3E2723;">${isAnimal ? '🐄' : '📜'} ${b.name.toUpperCase()} ${lvl ? '(Lvl ' + lvl + ')' : ''}</strong><br/>
          <span style="color:#8B4513; font-weight:bold;">Yield: ${finalTickets} Tickets | ${formatSFL(b.itemsCost)} SFL</span>
        </div>
        <span class="badge ${b.completed ? 'badge-done' : 'badge-active'}">${b.completed ? '✨ DONE' : '⏳ ACTIVE'}</span>
      </div>`;
    }).join('');

  } else if (cat === 'chore') {
    titleEl.textContent = '🧹 CHORES OVERVIEW';
    const sortedChores = [...state.globalData.chores].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
    bodyEl.innerHTML = sortedChores.map(c => {
      const finalTickets = c.baseTickets > 0 ? (c.baseTickets + boostCount) : 0;
      if (c.completed) {
        catTickets += finalTickets;
        catCost += (c.itemsCost || c.cost || 0);
      }
      return `<div style="background:#FFF8DC; border:2px solid #8B5A2B; padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:11px;">
        <div>
          <strong style="color:#3E2723;">🧹 ${c.npc.toUpperCase()}</strong><br/>
          <span style="color:#5C4033; font-weight:bold;">${c.task}</span><br/>
          ${c.requirement > 0 ? '<span style="color:#8C7853;">Progress: ' + c.progress + ' / ' + c.requirement + '</span><br/>' : ''}
          <span style="color:#2E7D32; font-weight:900;">Yield: ${finalTickets} Tickets | ${formatSFL(c.itemsCost || c.cost || 0)} SFL</span>
        </div>
        <span class="badge ${c.completed ? 'badge-done' : 'badge-active'}">${c.completed ? '✨ DONE' : '⏳ ACTIVE'}</span>
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
  renderColumnHistoryModalList();
  document.getElementById('columnHistoryModal').classList.add('show');
}

export function closeColumnHistoryModal() {
  document.getElementById('columnHistoryModal').classList.remove('show');
}

export function renderColumnHistoryModalList() {
  const type = state.activeColumnType;
  const bodyEl = document.getElementById('columnHistoryBody');
  const boostCount = getActiveBoostCount();
  const vipBonus = getActiveVipBonus();

  const records = [];

  if (type === 'delivery') {
    const logs = (state.globalData && state.globalData.cloudHistory && state.globalData.cloudHistory.logs) || [];
    logs.forEach((log, logIdx) => {
      (log.deliveriesDone || []).forEach((item, itemIdx) => {
        const baseTix = item.tickets !== undefined ? item.tickets : 2;
        const finalTix = baseTix > 0 ? (baseTix + vipBonus + boostCount) : 0;
        const requestedStr = formatRequestedItems(item.itemDetails || item.items);

        records.push({
          logIdx,
          itemIdx,
          date: log.date || 'Past Run',
          name: typeof item === 'string' ? item : (item.name || 'NPC Delivery'),
          requestedItems: requestedStr,
          cost: item.cost || 0,
          displayTickets: finalTix,
          baseTickets: baseTix,
          checked: item.checked !== undefined ? item.checked : !!item.completed,
          status: item.completed ? '✨ Done' : '⏳ Active'
        });
      });
    });
  } else {
    const currentWeekId = getMondayBasedWeekId();
    const weeks = (state.globalData && state.globalData.cloudHistory && state.globalData.cloudHistory.weeks) || {};
    
    // Ensure current week is populated from live globalData if empty
    if (!weeks[currentWeekId] && state.globalData) {
      weeks[currentWeekId] = {
        weekId: currentWeekId,
        bounties: state.globalData.bounties || [],
        chores: state.globalData.chores || []
      };
    }

    Object.entries(weeks).forEach(([weekId, wk]) => {
      let rawItems = [];
      if (type === 'chore') {
        rawItems = wk.chores || [];
      } else {
        const allBounties = wk.bounties || [];
        rawItems = allBounties.filter(b => {
          const n = (typeof b === 'string' ? b : (b.name || '')).toLowerCase();
          const isAnimal = n.includes('chicken') || n.includes('cow') || n.includes('sheep');
          return type === 'animalBounty' ? isAnimal : !isAnimal;
        });
      }

      rawItems.forEach((item, itemIdx) => {
        const baseTix = item.tickets !== undefined ? item.tickets : (item.baseTickets || 1);
        const finalTix = baseTix > 0 ? (baseTix + boostCount) : 0;
        const lvl = resolveAnimalLevel(item);

        records.push({
          weekId,
          itemIdx,
          name: typeof item === 'string' ? item : (item.name || item.npc || 'Task'),
          level: lvl,
          cost: item.cost !== undefined ? item.cost : (item.itemsCost || 0),
          displayTickets: finalTix,
          baseTickets: baseTix,
          checked: item.checked !== undefined ? item.checked : !!item.completed,
          status: item.completed ? '✨ Done' : '⏳ Active'
        });
      });
    });
  }

  let totalTickedTickets = 0;
  let totalTickedCost = 0;

  if (records.length === 0) {
    bodyEl.innerHTML = '<p style="font-size: 12px; color: #8C7853; font-weight: bold;">No past records found.</p>';
  } else {
    bodyEl.innerHTML = records.map(r => {
      if (r.checked) {
        totalTickedTickets += r.displayTickets;
        totalTickedCost += r.cost;
      }
      const labelId = type === 'delivery' ? `${r.date}` : `${r.weekId}`;
      const changeHandler = type === 'delivery'
        ? `toggleDeliveryLogCheck(${r.logIdx}, ${r.itemIdx})`
        : `toggleWeeklyItemCheck('${r.weekId}', ${r.itemIdx})`;
      
      const deleteHandler = type === 'delivery'
        ? `deleteDeliveryLogItem(${r.logIdx}, ${r.itemIdx})`
        : `deleteWeeklyItem('${r.weekId}', ${r.itemIdx})`;

      // Animal Level Tag badge
      const animalLevelTag = (type === 'animalBounty' && r.level) 
        ? `<span style="background:#EBDEF0; color:#6C3483; font-size:10px; font-weight:900; padding:1px 5px; border-radius:4px; border:1px solid #D7BDE2; margin-left:4px;">Lvl ${r.level}</span>` 
        : '';

      // Requested Items Display for Deliveries
      const itemsRow = (type === 'delivery' && r.requestedItems) 
        ? `<div style="font-size:10px; color:#6D4C41; font-weight:bold; margin-top:2px;">📦 Needs: ${r.requestedItems}</div>` 
        : '';

      return `<div style="background:#FFF8DC; padding:8px 12px; border:2px solid #8B5A2B; border-radius:6px; display:flex; justify-content:space-between; align-items:center; font-size:11px;">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; flex:1; padding-right:8px;">
          <input type="checkbox" ${r.checked ? 'checked' : ''} onchange="${changeHandler}" style="accent-color:#D2691E; width:15px; height:15px;" />
          <div>
            <span style="font-weight:bold; color:#8B4513;">📅 ${labelId} (${r.status})</span><br/>
            <strong style="color:#3E2723;">${r.name}</strong>${animalLevelTag}
            ${itemsRow}
          </div>
        </label>
        <div style="display:flex; align-items:center; gap:6px;">
          <span>SFL:</span>
          <input type="number" step="0.01" value="${r.cost}" onchange="updateHistoryItemCost('${r.weekId || r.logIdx}', ${r.itemIdx}, this.value)" style="width:60px; padding:2px; font-size:10px;" />
          <span>Tix:</span>
          <input type="number" value="${r.displayTickets}" onchange="updateHistoryItemTickets('${r.weekId || r.logIdx}', ${r.itemIdx}, this.value)" style="width:45px; padding:2px; font-size:10px;" title="Boosted Ticket Total" />
          <button onclick="${deleteHandler}" class="btn btn-sm btn-wood" style="background:#C0392B; border-color:#922B21; color:#fff; padding:2px 6px;">✕</button>
        </div>
      </div>`;
    }).join('');
  }

  setElemText('columnHistoryStats', `${totalTickedTickets} Tickets | ${formatSFL(totalTickedCost)} SFL`);
}

export async function toggleDeliveryLogCheck(logIdx, itemIdx) {
  const logs = state.globalData.cloudHistory.logs;
  if (logs[logIdx]?.deliveriesDone?.[itemIdx]) {
    const item = logs[logIdx].deliveriesDone[itemIdx];
    item.checked = (item.checked === undefined ? !item.completed : !item.checked);
    renderColumnHistoryModalList();
    recalculateAll();
    await syncCurrentVaultToCloud();
  }
}

export async function deleteDeliveryLogItem(logIdx, itemIdx) {
  const logs = state.globalData.cloudHistory.logs;
  if (logs[logIdx]?.deliveriesDone) {
    logs[logIdx].deliveriesDone.splice(itemIdx, 1);
    renderColumnHistoryModalList();
    recalculateAll();
    await syncCurrentVaultToCloud();
  }
}

export async function toggleWeeklyItemCheck(weekId, itemIdx) {
  const weeks = state.globalData.cloudHistory.weeks;
  const targetArray = state.activeColumnType === 'chore' ? 'chores' : 'bounties';
  if (weeks[weekId]?.[targetArray]?.[itemIdx]) {
    const item = weeks[weekId][targetArray][itemIdx];
    item.checked = (item.checked === undefined ? !item.completed : !item.checked);
    renderColumnHistoryModalList();
    recalculateAll();
    await syncCurrentVaultToCloud();
  }
}

export async function updateHistoryItemTickets(idKey, itemIdx, val) {
  const type = state.activeColumnType;
  const boostCount = getActiveBoostCount();
  const vipBonus = getActiveVipBonus();
  const inputVal = parseInt(val) || 0;

  if (type === 'delivery') {
    const logs = state.globalData.cloudHistory.logs;
    const logIdx = parseInt(idKey);
    if (logs[logIdx]?.deliveriesDone?.[itemIdx]) {
      const base = Math.max(0, inputVal - (vipBonus + boostCount));
      logs[logIdx].deliveriesDone[itemIdx].tickets = base;
    }
  } else {
    const weeks = state.globalData.cloudHistory.weeks;
    const targetArray = type === 'chore' ? 'chores' : 'bounties';
    if (weeks[idKey]?.[targetArray]?.[itemIdx]) {
      const base = Math.max(0, inputVal - boostCount);
      weeks[idKey][targetArray][itemIdx].tickets = base;
    }
  }
  renderColumnHistoryModalList();
  recalculateAll();
  await syncCurrentVaultToCloud();
}

export async function updateHistoryItemCost(idKey, itemIdx, val) {
  const type = state.activeColumnType;
  if (type === 'delivery') {
    const logs = state.globalData.cloudHistory.logs;
    const logIdx = parseInt(idKey);
    if (logs[logIdx]?.deliveriesDone?.[itemIdx]) {
      logs[logIdx].deliveriesDone[itemIdx].cost = parseFloat(val) || 0;
    }
  } else {
    const weeks = state.globalData.cloudHistory.weeks;
    const targetArray = type === 'chore' ? 'chores' : 'bounties';
    if (weeks[idKey]?.[targetArray]?.[itemIdx]) {
      weeks[idKey][targetArray][itemIdx].cost = parseFloat(val) || 0;
    }
  }
  renderColumnHistoryModalList();
  recalculateAll();
  await syncCurrentVaultToCloud();
}

export async function deleteWeeklyItem(weekId, itemIdx) {
  const weeks = state.globalData.cloudHistory.weeks;
  const targetArray = state.activeColumnType === 'chore' ? 'chores' : 'bounties';
  if (weeks[weekId]?.[targetArray]) {
    weeks[weekId][targetArray].splice(itemIdx, 1);
    renderColumnHistoryModalList();
    recalculateAll();
    await syncCurrentVaultToCloud();
  }
}

export async function addCustomHistoryItem() {
  const name = document.getElementById('addHistName').value.trim() || 'Custom Task';
  const inputTickets = parseInt(document.getElementById('addHistTickets').value) || 1;
  const cost = parseFloat(document.getElementById('addHistCost').value) || 0;
  const type = state.activeColumnType;
  const todayDate = new Date().toISOString().split('T')[0];
  const currentWeekId = getMondayBasedWeekId();

  const boostCount = getActiveBoostCount();
  const vipBonus = getActiveVipBonus();

  if (type === 'delivery') {
    if (!state.globalData.cloudHistory.logs) state.globalData.cloudHistory.logs = [];
    let targetLog = state.globalData.cloudHistory.logs.find(l => l.date === todayDate);
    if (!targetLog) {
      targetLog = { date: todayDate, weekId: currentWeekId, timestamp: new Date().toISOString(), ticketsSaved: 0, costSaved: 0, deliveriesDone: [] };
      state.globalData.cloudHistory.logs.unshift(targetLog);
    }
    if (!targetLog.deliveriesDone) targetLog.deliveriesDone = [];
    const baseTickets = Math.max(0, inputTickets - (vipBonus + boostCount));
    targetLog.deliveriesDone.push({ name, cost, tickets: baseTickets, completed: true, checked: true });
  } else {
    if (!state.globalData.cloudHistory.weeks) state.globalData.cloudHistory.weeks = {};
    if (!state.globalData.cloudHistory.weeks[currentWeekId]) {
      state.globalData.cloudHistory.weeks[currentWeekId] = { weekId: currentWeekId, bounties: [], chores: [] };
    }
    const targetArray = type === 'chore' ? 'chores' : 'bounties';
    const baseTickets = Math.max(0, inputTickets - boostCount);
    
    // Extract level if user typed e.g. "Chicken Lvl 3"
    const lvlMatch = name.match(/(?:lvl|level|#|\()\s*(\d+)/i);
    const customLevel = lvlMatch ? lvlMatch[1] : null;

    state.globalData.cloudHistory.weeks[currentWeekId][targetArray].push({ 
      name, 
      level: customLevel, 
      cost, 
      tickets: baseTickets, 
      completed: true, 
      checked: true 
    });
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
