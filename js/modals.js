import { state, formatSFL, setElemText, getActiveBoostCount, getActiveVipBonus } from './state.js';
import { recalculateAll } from './render.js';

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
      return `<div style="background:#FFF8DC; border:2px solid #8B5A2B; padding:8px 10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:11px;">
        <div>
          <strong style="color:#3E2723;">${isAnimal ? '🐄' : '📜'} ${b.name.toUpperCase()} ${b.level ? '(Lvl ' + b.level + ')' : ''}</strong><br/>
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
      if (c.completed) catTickets += finalTickets;
      return `<div style="background:#FFF8DC; border:2px solid #8B5A2B; padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:11px;">
        <div>
          <strong style="color:#3E2723;">🧹 ${c.npc.toUpperCase()}</strong><br/>
          <span style="color:#5C4033; font-weight:bold;">${c.task}</span><br/>
          ${c.requirement > 0 ? '<span style="color:#8C7853;">Progress: ' + c.progress + ' / ' + c.requirement + '</span><br/>' : ''}
          <span style="color:#2E7D32; font-weight:900;">Yield: ${finalTickets} Tickets</span>
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

export function openNpcHistoryModal(npcName) {
  document.getElementById('activeNpcHistoryName').value = npcName;
  setElemText('npcHistoryTitle', '📜 HISTORY: ' + npcName.toUpperCase());
  document.getElementById('addNpcHistDate').value = new Date().toISOString().split('T')[0];
  renderNpcHistoryModalList();
  document.getElementById('npcHistoryModal').classList.add('show');
}

export function closeNpcHistoryModal() {
  document.getElementById('npcHistoryModal').classList.remove('show');
}

export function renderNpcHistoryModalList() {
  const npcName = document.getElementById('activeNpcHistoryName').value;
  const bodyEl = document.getElementById('npcHistoryBody');

  const logs = (state.globalData && state.globalData.cloudHistory && state.globalData.cloudHistory.logs) || [];
  const records = [];
  const boostCount = getActiveBoostCount();
  const vipBonus = getActiveVipBonus();

  logs.forEach((log, logIdx) => {
    (log.deliveriesDone || []).forEach((past, itemIdx) => {
      const name = (typeof past === 'string' ? past : past.name || '').toLowerCase().trim();
      if (name === npcName.toLowerCase().trim()) {
        const baseTix = past.tickets || 2;
        const finalTix = baseTix + vipBonus + boostCount;
        const isChecked = past.checked !== undefined ? past.checked : !!past.completed;

        records.push({
          logIdx, itemIdx,
          date: log.date || 'Past Run',
          cost: past.cost || 0,
          tickets: finalTix,
          items: past.items || [],
          checked: isChecked,
          status: past.completed ? '✨ Done' : '⏳ Active'
        });
      }
    });
  });

  let totalTickedTickets = 0;
  let totalTickedCost = 0;

  if (records.length === 0) {
    bodyEl.innerHTML = `<p style="font-size: 12px; color: #8C7853; font-weight: bold;">No history found for ${npcName}.</p>`;
  } else {
    bodyEl.innerHTML = records.map(r => {
      if (r.checked) {
        totalTickedTickets += r.tickets;
        totalTickedCost += r.cost;
      }
      const itemsHtml = (r.items || []).map(it => `• ${it.qty}x ${it.name}`).join(', ');

      return `<div style="background:#FFF8DC; padding:8px 12px; border:2px solid #8B5A2B; border-radius:6px; display:flex; flex-direction:column; gap:4px; font-size:11px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" ${r.checked ? 'checked' : ''} onchange="toggleNpcHistCheck(${r.logIdx}, ${r.itemIdx})" style="accent-color:#D2691E; width:14px; height:14px;" />
            <span style="font-weight:bold; color:#8B4513;">📅 ${r.date} (${r.status})</span>
          </label>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="color:#2E7D32; font-weight:bold;">+${r.tickets} Tickets (${formatSFL(r.cost)} SFL)</span>
            <button onclick="deleteNpcHistItem(${r.logIdx}, ${r.itemIdx})" class="btn btn-sm btn-amber" style="background:#C0392B; border-color:#922B21; color:#fff; padding:2px 6px;">✕</button>
          </div>
        </div>
        ${itemsHtml ? `<div style="color:#5C4033; font-size:10px; padding-left:22px;"><strong>Requested:</strong> ${itemsHtml}</div>` : ''}
      </div>`;
    }).join('');
  }

  setElemText('npcHistoryStats', `${totalTickedTickets} Tickets | ${formatSFL(totalTickedCost)} SFL`);
}

export function toggleNpcHistCheck(logIdx, itemIdx) {
  const logs = state.globalData.cloudHistory.logs;
  if (logs[logIdx]?.deliveriesDone?.[itemIdx]) {
    const item = logs[logIdx].deliveriesDone[itemIdx];
    item.checked = (item.checked === undefined ? !item.completed : !item.checked);
    renderNpcHistoryModalList();
    recalculateAll();
  }
}

export function addNpcHistoryItem() {
  const npcName = document.getElementById('activeNpcHistoryName').value;
  const dateStr = document.getElementById('addNpcHistDate').value.trim() || new Date().toISOString().split('T')[0];
  const tickets = parseInt(document.getElementById('addNpcHistTickets').value) || 2;
  const cost = parseFloat(document.getElementById('addNpcHistCost').value) || 0;

  if (!state.globalData.cloudHistory.logs) state.globalData.cloudHistory.logs = [];
  
  let targetLog = state.globalData.cloudHistory.logs.find(l => l.date === dateStr);
  if (!targetLog) {
    targetLog = { date: dateStr, timestamp: new Date().toISOString(), ticketsSaved: 0, costSaved: 0, deliveriesDone: [] };
    state.globalData.cloudHistory.logs.unshift(targetLog);
  }

  if (!targetLog.deliveriesDone) targetLog.deliveriesDone = [];
  targetLog.deliveriesDone.push({ name: npcName, cost, tickets, completed: true, items: [], checked: true });

  renderNpcHistoryModalList();
  recalculateAll();
}

export function deleteNpcHistItem(logIdx, itemIdx) {
  const logs = state.globalData.cloudHistory.logs;
  if (logs[logIdx]?.deliveriesDone) {
    logs[logIdx].deliveriesDone.splice(itemIdx, 1);
    renderNpcHistoryModalList();
    recalculateAll();
  }
}

export function openColumnHistoryModal(type) {
  state.activeColumnType = type;
  setElemText('columnHistoryTitle', type === 'bounty' ? '📜 BOUNTIES EDIT / HISTORY' : '📜 CHORES EDIT / HISTORY');
  renderColumnHistoryModalList();
  document.getElementById('columnHistoryModal').classList.add('show');
}

export function closeColumnHistoryModal() {
  document.getElementById('columnHistoryModal').classList.remove('show');
}

export function renderColumnHistoryModalList() {
  const type = state.activeColumnType;
  const bodyEl = document.getElementById('columnHistoryBody');
  const weeks = (state.globalData && state.globalData.cloudHistory && state.globalData.cloudHistory.weeks) || {};
  const records = [];
  const boostCount = getActiveBoostCount();

  Object.entries(weeks).forEach(([weekId, wk]) => {
    const items = type === 'bounty' ? (wk.bounties || []) : (wk.chores || []);
    items.forEach((item, itemIdx) => {
      const baseTix = item.tickets || 1;
      const finalTix = baseTix > 0 ? (baseTix + boostCount) : 0;
      records.push({
        weekId, itemIdx,
        name: typeof item === 'string' ? item : (item.name || item.npc || 'Task'),
        cost: item.cost || 0,
        tickets: finalTix,
        baseTickets: baseTix,
        checked: item.checked !== undefined ? item.checked : !!item.completed,
        status: item.completed ? '✨ Done' : '⏳ Active'
      });
    });
  });

  let totalTickedTickets = 0;
  let totalTickedCost = 0;

  if (records.length === 0) {
    bodyEl.innerHTML = '<p style="font-size: 12px; color: #8C7853; font-weight: bold;">No weekly records found.</p>';
  } else {
    bodyEl.innerHTML = records.map(r => {
      if (r.checked) {
        totalTickedTickets += r.tickets;
        totalTickedCost += r.cost;
      }
      return `<div style="background:#FFF8DC; padding:8px 12px; border:2px solid #8B5A2B; border-radius:6px; display:flex; justify-content:space-between; align-items:center; font-size:11px;">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" ${r.checked ? 'checked' : ''} onchange="toggleWeeklyItemCheck('${r.weekId}', ${r.itemIdx})" style="accent-color:#D2691E; width:14px; height:14px;" />
          <div><span style="font-weight:bold; color:#8B4513;">📅 ${r.weekId} (${r.status})</span><br/><strong style="color:#3E2723;">${r.name}</strong></div>
        </label>
        <div style="display:flex; align-items:center; gap:6px;">
          ${type === 'bounty' ? 
            `<span>Tickets:</span><input type="number" value="${r.baseTickets}" onchange="updateWeeklyItemTickets('${r.weekId}', ${r.itemIdx}, this.value)" style="width:50px; padding:2px; font-size:10px;" />` : 
            `<span>SFL:</span><input type="number" step="0.01" value="${r.cost}" onchange="updateWeeklyItemCost('${r.weekId}', ${r.itemIdx}, this.value)" style="width:60px; padding:2px; font-size:10px;" />`
          }
          <button onclick="deleteWeeklyItem('${r.weekId}', ${r.itemIdx})" class="btn btn-sm btn-amber" style="background:#C0392B; border-color:#922B21; color:#fff; padding:2px 6px;">✕</button>
        </div>
      </div>`;
    }).join('');
  }

  setElemText('columnHistoryStats', `${totalTickedTickets} Tickets | ${formatSFL(totalTickedCost)} SFL`);
}

export function toggleWeeklyItemCheck(weekId, itemIdx) {
  const weeks = state.globalData.cloudHistory.weeks;
  const targetArray = state.activeColumnType === 'bounty' ? 'bounties' : 'chores';
  if (weeks[weekId]?.[targetArray]?.[itemIdx]) {
    const item = weeks[weekId][targetArray][itemIdx];
    item.checked = (item.checked === undefined ? !item.completed : !item.checked);
    renderColumnHistoryModalList();
    recalculateAll();
  }
}

export function updateWeeklyItemTickets(weekId, itemIdx, val) {
  const weeks = state.globalData.cloudHistory.weeks;
  const targetArray = state.activeColumnType === 'bounty' ? 'bounties' : 'chores';
  if (weeks[weekId]?.[targetArray]?.[itemIdx]) {
    weeks[weekId][targetArray][itemIdx].tickets = parseInt(val) || 0;
    renderColumnHistoryModalList();
    recalculateAll();
  }
}

export function updateWeeklyItemCost(weekId, itemIdx, val) {
  const weeks = state.globalData.cloudHistory.weeks;
  const targetArray = state.activeColumnType === 'bounty' ? 'bounties' : 'chores';
  if (weeks[weekId]?.[targetArray]?.[itemIdx]) {
    weeks[weekId][targetArray][itemIdx].cost = parseFloat(val) || 0;
    renderColumnHistoryModalList();
    recalculateAll();
  }
}

export function deleteWeeklyItem(weekId, itemIdx) {
  const weeks = state.globalData.cloudHistory.weeks;
  const targetArray = state.activeColumnType === 'bounty' ? 'bounties' : 'chores';
  if (weeks[weekId]?.[targetArray]) {
    weeks[weekId][targetArray].splice(itemIdx, 1);
    renderColumnHistoryModalList();
    recalculateAll();
  }
}

export function addCustomHistoryItem() {
  const name = document.getElementById('addHistName').value.trim() || 'Custom Task';
  const tickets = parseInt(document.getElementById('addHistTickets').value) || 1;
  const cost = parseFloat(document.getElementById('addHistCost').value) || 0;

  const now = new Date();
  const startOfYear = new Date(Date.UTC(now.getFullYear(), 0, 1));
  const currentWeekNum = Math.ceil((((now - startOfYear) / 86400000) + startOfYear.getUTCDay() + 1) / 7);
  const currentWeekId = `${now.getFullYear()}-W${String(currentWeekNum).padStart(2, '0')}`;

  if (!state.globalData.cloudHistory.weeks) state.globalData.cloudHistory.weeks = {};
  if (!state.globalData.cloudHistory.weeks[currentWeekId]) {
    state.globalData.cloudHistory.weeks[currentWeekId] = { weekId: currentWeekId, bounties: [], chores: [] };
  }

  const targetArray = state.activeColumnType === 'bounty' ? 'bounties' : 'chores';
  state.globalData.cloudHistory.weeks[currentWeekId][targetArray].push({ name, cost, tickets, completed: true, checked: true });

  renderColumnHistoryModalList();
  recalculateAll();
}

export async function deleteMasterLog(logIdx) {
  if (!state.globalData?.cloudHistory?.logs) return;
  if (confirm('🗑️ Delete this snapshot log?')) {
    state.globalData.cloudHistory.logs.splice(logIdx, 1);
    
    if (state.currentUser) {
      try {
        await fetch('/api/chapter?action=saveVault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: state.currentUser,
            logs: state.globalData.cloudHistory.logs,
            deliveries: state.globalData.deliveries,
            bounties: state.globalData.bounties,
            chores: state.globalData.chores
          })
        });
      } catch (err) {
        console.error('Failed to sync log deletion to cloud:', err);
      }
    }

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
            <button onclick="deleteMasterLog(${idx})" class="btn btn-sm btn-amber" style="background:#C0392B; border-color:#922B21; color:#fff; padding:2px 8px;">🗑️ DELETE</button>
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
