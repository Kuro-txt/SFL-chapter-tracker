import { 
  state, 
  formatSFL, 
  resolveAnimalLevel, 
  isAnimalBounty,
  getActiveBoostCount,
  getActiveVipBonus,
  getDeliveryRecords
} from './state.js';
import { getMondayBasedWeekId } from '../functions/utils/dates.js';

function computeYield(base, isVipEligible = true, isManual = false) {
  const raw = Number(base) || 0;
  if (raw <= 0) return 0;
  if (isManual) return raw;
  const vip = isVipEligible ? getActiveVipBonus() : 0;
  const boost = getActiveBoostCount();
  return raw + vip + boost;
}

export function toggleGuideModal() {
  const modal = document.getElementById('guideModal');
  if (modal) modal.classList.toggle('show');
}

export function openWeekBreakdownModal(mondayKey, label) {
  const modal = document.getElementById('categorySummaryModal');
  const titleEl = document.getElementById('categorySummaryTitle');
  const totalsEl = document.getElementById('categorySummaryTotals');
  const bodyEl = document.getElementById('categorySummaryBody');

  if (!state.globalData) {
    alert('Please click "🌾 FETCH DATA" first!');
    return;
  }

  const normMonday = getMondayBasedWeekId(mondayKey);
  const now = new Date();
  const currentWeekMonday = getMondayBasedWeekId(now);
  const isCurrentWeek = (normMonday === currentWeekMonday);

  // Calculate Sunday of this week
  const monDate = new Date(normMonday + 'T00:00:00.000Z');
  const sunDate = new Date(monDate.getTime() + (6 * 86400000));
  const dateRangeStr = `${monDate.toISOString().split('T')[0]} to ${sunDate.toISOString().split('T')[0]}`;
  const displayLabel = label || `Week (${normMonday})`;

  if (titleEl) {
    titleEl.innerHTML = `📊 ${displayLabel.toUpperCase()} BREAKDOWN (${dateRangeStr})`;
  }

  const isTicked = (item) => {
    if (!item || item.isSkipped) return false;
    if (item.checked !== undefined) return Boolean(item.checked);
    return Boolean(item.completed);
  };

  // 1. Deliveries for this week
  const masterDeliveries = getDeliveryRecords();
  const weekDeliveries = [];
  let delivTickets = 0;
  let delivCost = 0;

  masterDeliveries.forEach(d => {
    const dDate = d.completedDate || (d.completedAt ? new Date(d.completedAt < 1e11 ? d.completedAt * 1000 : d.completedAt).toISOString().split('T')[0] : null);
    const dWeekId = getMondayBasedWeekId(d.weekId || dDate || (d.checkedToday ? currentWeekMonday : null));
    
    if (dWeekId === normMonday) {
      const isDone = isTicked(d);
      const base = d.baseTickets !== undefined ? d.baseTickets : (d.tickets || 2);
      const isManual = Boolean(d.isManual);
      let tix = computeYield(base, true, isManual);
      if (d.hasDoubleBonus && !isManual) tix *= 2;
      const cost = d.itemsCost || d.cost || 0;

      if (isDone) {
        delivTickets += tix;
        delivCost += cost;
      }

      weekDeliveries.push({
        name: d.from || d.name || 'NPC Delivery',
        tickets: tix,
        cost,
        isDone,
        type: 'delivery',
        details: (d.itemDetails || []).map(it => `${it.qty}x ${it.name}`).join(', ')
      });
    }
  });

  // 2. Bounties & Animal Bounties for this week
  const weekBounties = [];
  const weekAnimalBounties = [];
  let bountyTickets = 0;
  let bountyCost = 0;
  let animalBountyTickets = 0;
  let animalBountyCost = 0;

  const rawWeeks = (state.globalData.cloudHistory && state.globalData.cloudHistory.weeks) || 
    (state.currentVaultData && state.currentVaultData.weeks) || 
    {};
  const savedWk = rawWeeks[normMonday] || {};

  const bountiesSource = isCurrentWeek ? (state.globalData.bounties || []) : (savedWk.bounties || []);
  const allBounties = [...bountiesSource];
  if (isCurrentWeek && savedWk.bounties) {
    savedWk.bounties.forEach(sb => {
      if (sb.isManual && !allBounties.some(b => b.name === sb.name && b.isManual)) {
        allBounties.push(sb);
      }
    });
  }

  allBounties.forEach(b => {
    const isAnimal = isAnimalBounty(b);
    const isDone = isTicked(b);
    const base = b.baseTickets !== undefined ? b.baseTickets : (b.tickets || 0);
    const tix = computeYield(base, false, Boolean(b.isManual));
    const cost = b.itemsCost || b.cost || 0;

    if (isAnimal) {
      if (isDone) {
        animalBountyTickets += tix;
        animalBountyCost += cost;
      }
      weekAnimalBounties.push({
        name: b.name || 'Animal Bounty',
        tickets: tix,
        cost,
        isDone,
        type: 'animalBounty',
        level: resolveAnimalLevel(b)
      });
    } else {
      if (isDone) {
        bountyTickets += tix;
        bountyCost += cost;
      }
      weekBounties.push({
        name: b.name || 'Bounty',
        tickets: tix,
        cost,
        isDone,
        type: 'bounty'
      });
    }
  });

  // 3. Chores for this week
  const weekChores = [];
  let choreTickets = 0;
  let choreCost = 0;

  const choresSource = isCurrentWeek ? (state.globalData.chores || []) : (savedWk.chores || []);
  const allChores = [...choresSource];
  if (isCurrentWeek && savedWk.chores) {
    savedWk.chores.forEach(sc => {
      if (sc.isManual && !allChores.some(c => c.name === sc.name && c.isManual)) {
        allChores.push(sc);
      }
    });
  }

  allChores.forEach(c => {
    const isDone = isTicked(c);
    const base = c.baseTickets !== undefined ? c.baseTickets : (c.tickets || 1);
    const tix = computeYield(base, true, Boolean(c.isManual));
    const cost = c.itemsCost || c.cost || 0;

    if (isDone) {
      choreTickets += tix;
      choreCost += cost;
    }

    weekChores.push({
      name: `${c.npc ? c.npc + ': ' : ''}${c.task || c.name || 'Chore'}`,
      tickets: tix,
      cost,
      isDone,
      type: 'chore'
    });
  });

  const totalWeekTickets = delivTickets + bountyTickets + animalBountyTickets + choreTickets;
  const totalWeekCost = delivCost + bountyCost + animalBountyCost + choreCost;
  const overallRatio = totalWeekTickets > 0 ? formatSFL(totalWeekCost / totalWeekTickets) : "0.000";

  totalsEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; width:100%; align-items:center; flex-wrap:wrap; gap:6px;">
      <span class="sum-stat" style="color:#2E7D32; font-size:13px;">🎟️ ${totalWeekTickets} Tickets</span>
      <span class="sum-stat" style="color:#D2691E; font-size:13px;">💰 ${formatSFL(totalWeekCost)} SFL</span>
      <span class="avg-pill" style="font-size:12px;">📊 Avg: ${overallRatio} SFL / Tix</span>
    </div>
  `;

  const categoryCardsHtml = `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:8px; margin-bottom:12px;">
      <div style="background:#FFF8DC; border:2px solid #8B5A2B; border-radius:8px; padding:8px 10px; display:flex; flex-direction:column; gap:3px;">
        <span style="font-size:11px; font-weight:900; color:#8B4513;">📦 DELIVERIES</span>
        <span style="font-size:14px; font-weight:900; color:#2E7D32;">+${delivTickets} Tix</span>
        <span style="font-size:10px; font-weight:bold; color:#795548;">${formatSFL(delivCost)} SFL (${weekDeliveries.filter(d => d.isDone).length}/${weekDeliveries.length})</span>
      </div>
      <div style="background:#FFF8DC; border:2px solid #8B5A2B; border-radius:8px; padding:8px 10px; display:flex; flex-direction:column; gap:3px;">
        <span style="font-size:11px; font-weight:900; color:#8B4513;">📜 BOUNTIES</span>
        <span style="font-size:14px; font-weight:900; color:#2E7D32;">+${bountyTickets} Tix</span>
        <span style="font-size:10px; font-weight:bold; color:#795548;">${formatSFL(bountyCost)} SFL (${weekBounties.filter(b => b.isDone).length}/${weekBounties.length})</span>
      </div>
      <div style="background:#FFF8DC; border:2px solid #8B5A2B; border-radius:8px; padding:8px 10px; display:flex; flex-direction:column; gap:3px;">
        <span style="font-size:11px; font-weight:900; color:#8B4513;">🐄 ANIMAL BOUNTIES</span>
        <span style="font-size:14px; font-weight:900; color:#2E7D32;">+${animalBountyTickets} Tix</span>
        <span style="font-size:10px; font-weight:bold; color:#795548;">${formatSFL(animalBountyCost)} SFL (${weekAnimalBounties.filter(b => b.isDone).length}/${weekAnimalBounties.length})</span>
      </div>
      <div style="background:#FFF8DC; border:2px solid #8B5A2B; border-radius:8px; padding:8px 10px; display:flex; flex-direction:column; gap:3px;">
        <span style="font-size:11px; font-weight:900; color:#8B4513;">🧹 CHORES</span>
        <span style="font-size:14px; font-weight:900; color:#2E7D32;">+${choreTickets} Tix</span>
        <span style="font-size:10px; font-weight:bold; color:#795548;">${formatSFL(choreCost)} SFL (${weekChores.filter(c => c.isDone).length}/${weekChores.length})</span>
      </div>
    </div>
  `;

  const allWeekItems = [
    ...weekDeliveries.map(d => ({ ...d, catIcon: '📦', catName: 'Delivery' })),
    ...weekBounties.map(b => ({ ...b, catIcon: '📜', catName: 'Bounty' })),
    ...weekAnimalBounties.map(ab => ({ ...ab, catIcon: '🐄', catName: 'Animal Bounty' })),
    ...weekChores.map(c => ({ ...c, catIcon: '🧹', catName: 'Chore' }))
  ];

  let itemsListHtml = '';
  if (allWeekItems.length === 0) {
    itemsListHtml = `<p style="text-align:center; color:#8C7853; font-size:12px; font-weight:bold; padding:20px 0;">No completed items recorded for ${displayLabel}.</p>`;
  } else {
    itemsListHtml = allWeekItems.map(it => {
      const ratio = it.tickets > 0 ? formatSFL(it.cost / it.tickets) : "0.000";
      return `
        <div style="background:#FFF8DC; border:2px solid #8B5A2B; padding:8px 10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:11px; gap:6px;">
          <div style="flex:1;">
            <div style="font-weight:900; color:#3E2723; display:flex; align-items:center; gap:4px;">
              <span>${it.catIcon} ${it.name.toUpperCase()}</span>
              ${it.level ? `<span class="tag-pill tag-lvl">Lvl ${it.level}</span>` : ''}
            </div>
            ${it.details ? `<div style="font-size:9.5px; color:#5C4033; font-weight:bold; margin-top:2px;">${it.details}</div>` : ''}
            <div style="display:flex; gap:8px; align-items:center; margin-top:3px; flex-wrap:wrap;">
              <span style="color:#2E7D32; font-weight:900;">🎟️ +${it.tickets} Tix</span>
              <span style="color:#5C4033; font-weight:bold;">💰 ${formatSFL(it.cost)} SFL</span>
              <span class="ratio-pill" style="font-size:9.5px;">📊 ${ratio} SFL/Tix</span>
            </div>
          </div>
          <span class="badge ${it.isDone ? 'badge-done' : 'badge-active'}" style="font-size:10px;">${it.isDone ? '✨ DONE' : '⏳ ACTIVE'}</span>
        </div>
      `;
    }).join('');
  }

  bodyEl.innerHTML = categoryCardsHtml + `
    <div style="border-top:2px dashed #D2B48C; padding-top:8px; margin-top:4px;">
      <div style="font-size:11.5px; font-weight:900; color:#8B4513; margin-bottom:6px;">📋 ITEM-BY-ITEM BREAKDOWN (${allWeekItems.filter(i => i.isDone).length} COMPLETED):</div>
      <div style="display:flex; flex-direction:column; gap:6px;">
        ${itemsListHtml}
      </div>
    </div>
  `;

  modal.classList.add('show');
}

export function openCategorySummaryModal(cat) {
  const modal = document.getElementById('categorySummaryModal');
  const titleEl = document.getElementById('categorySummaryTitle');
  const totalsEl = document.getElementById('categorySummaryTotals');
  const bodyEl = document.getElementById('categorySummaryBody');

  if (!state.globalData) {
    alert('Please click "FETCH DATA" first!');
    return;
  }

  let catTickets = 0;
  let catCost = 0;

  const isDoubleDeliveryActive = Boolean(state.globalData.isDoubleDeliveryActive);

  if (cat === 'delivery') {
    titleEl.textContent = '📦 LIVE BOARD DELIVERIES OVERVIEW';
    const liveDeliveries = state.globalData.deliveries || [];
    const sortedDeliv = [...liveDeliveries].sort((a, b) => {
      const aDone = a.checked !== undefined ? a.checked : Boolean(a.completed);
      const bDone = b.checked !== undefined ? b.checked : Boolean(b.completed);
      return aDone === bDone ? 0 : aDone ? 1 : -1;
    });

    bodyEl.innerHTML = sortedDeliv.map(d => {
      const isTicked = (d.checked !== undefined ? d.checked : Boolean(d.completed)) && !d.isSkipped;
      const base = d.baseTickets !== undefined ? d.baseTickets : (d.tickets || 2);
      const isManual = Boolean(d.isManual);
      
      let finalTickets = computeYield(base, true, isManual);
      if (isDoubleDeliveryActive && !isManual) {
        finalTickets *= 2;
      }

      const itemCost = d.itemsCost || d.cost || 0;
      const itemRatio = finalTickets > 0 ? formatSFL(itemCost / finalTickets) : "0.000";

      if (isTicked) {
        catTickets += finalTickets;
        catCost += itemCost;
      }

      const doubleBadge = (isDoubleDeliveryActive && !isManual) 
        ? '<span class="tag-pill tag-double">⚡ 2X EVENT</span>' 
        : '';
      const isStackedBadge = d.isStacked ? '<span class="tag-pill tag-stacked">🥞 STACKED</span>' : '';
      const isSkippedBadge = d.isSkipped ? '<span class="tag-pill tag-skipped">✕ SKIPPED</span>' : '';
      const itemRows = (d.itemDetails || []).map(it => `• ${it.qty}x ${it.name} (${formatSFL(it.lineCost)} SFL)`).join('<br/>');

      let statusBadge = `<span class="badge ${isTicked ? 'badge-done' : 'badge-active'}">${isTicked ? '✨ DONE' : '⏳ ACTIVE'}</span>`;
      if (d.isSkipped) {
        statusBadge = `<span class="badge" style="background:#FFCDD2; color:#B71C1C;">✕ SKIPPED</span>`;
      }

      return `<div style="background:#FFF8DC; border:2px solid #8B5A2B; padding:10px; border-radius:8px; display:flex; flex-direction:column; gap:6px; font-size:11px;">
        <div style="display:flex; justify-content:space-between; align-items:center; font-weight:900;">
          <span style="color:#8B4513;">👤 ${(d.from || d.name || 'NPC').toUpperCase()} ${d.isChapterNpc ? '👑' : ''}${doubleBadge}${isStackedBadge}${isSkippedBadge}</span>
          ${statusBadge}
        </div>
        <div style="color:#5C4033; font-weight:bold; line-height:1.4;">${itemRows || 'No item recipe data'}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-weight:900; color:#2E7D32; border-top:1px dashed #D2B48C; padding-top:6px; flex-wrap:wrap; gap:4px;">
          <span>Yield: 🎟️ ${finalTickets} Tickets</span>
          <span>💰 ${formatSFL(itemCost)} SFL</span>
          <span class="ratio-pill">
            📊 ${itemRatio} SFL / Ticket
          </span>
        </div>
      </div>`;
    }).join('');
  } else if (cat === 'bounty' || cat === 'animalBounty') {
    const isAnimal = cat === 'animalBounty';
    titleEl.textContent = isAnimal ? '🐄 ANIMAL BOUNTIES OVERVIEW' : '📜 BOUNTIES OVERVIEW';
    
    const currentBounties = (state.globalData.bounties || []).filter(b => isAnimalBounty(b) === isAnimal);
    const sortedBounties = [...currentBounties].sort((a, b) => {
      const aDone = a.checked !== undefined ? a.checked : Boolean(a.completed);
      const bDone = b.checked !== undefined ? b.checked : Boolean(b.completed);
      return aDone === bDone ? 0 : aDone ? 1 : -1;
    });

    bodyEl.innerHTML = sortedBounties.map(b => {
      const isTicked = b.checked !== undefined ? b.checked : Boolean(b.completed);
      const base = b.baseTickets !== undefined ? b.baseTickets : (b.tickets || 0);
      const finalTickets = computeYield(base, false, Boolean(b.isManual));
      const itemCost = b.itemsCost || b.cost || 0;
      const itemRatio = finalTickets > 0 ? formatSFL(itemCost / finalTickets) : "0.000";

      if (isTicked) {
        catTickets += finalTickets;
        catCost += itemCost;
      }
      const lvl = resolveAnimalLevel(b);
      const lvlTag = lvl ? `<span class="tag-pill tag-lvl">Lvl ${lvl}</span>` : '';

      return `<div style="background:#FFF8DC; border:2px solid #8B5A2B; padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:11px; gap:8px;">
        <div style="flex:1;">
          <strong style="color:#3E2723;">${isAnimal ? '🐄' : '📜'} ${(b.name || '').toUpperCase()}</strong>${lvlTag}<br/>
          <div style="display:flex; gap:8px; align-items:center; margin-top:3px; flex-wrap:wrap;">
            <span style="color:#8B4513; font-weight:bold;">Yield: 🎟️ ${finalTickets} Tix</span>
            <span style="color:#5C4033; font-weight:bold;">💰 ${formatSFL(itemCost)} SFL</span>
            <span class="ratio-pill">
              📊 ${itemRatio} SFL / Tix
            </span>
          </div>
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
      const base = c.baseTickets !== undefined ? c.baseTickets : (c.tickets || 1);
      const finalTickets = computeYield(base, true, Boolean(c.isManual));
      const itemCost = c.itemsCost || c.cost || 0;
      const itemRatio = finalTickets > 0 ? formatSFL(itemCost / finalTickets) : "0.000";

      if (isTicked) {
        catTickets += finalTickets;
        catCost += itemCost;
      }

      return `<div style="background:#FFF8DC; border:2px solid #8B5A2B; padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:11px; gap:8px;">
        <div style="flex:1;">
          <strong style="color:#3E2723;">🧹 ${(c.npc || 'NPC').toUpperCase()}</strong><br/>
          <span style="color:#5C4033; font-weight:bold;">${c.task || c.name}</span><br/>
          <div style="display:flex; gap:8px; align-items:center; margin-top:3px; flex-wrap:wrap;">
            <span style="color:#2E7D32; font-weight:900;">Yield: 🎟️ ${finalTickets} Tix</span>
            <span style="color:#5C4033; font-weight:bold;">💰 ${formatSFL(itemCost)} SFL</span>
            <span class="ratio-pill">
              📊 ${itemRatio} SFL / Tix
            </span>
          </div>
        </div>
        <span class="badge ${isTicked ? 'badge-done' : 'badge-active'}">${isTicked ? '✨ DONE' : '⏳ ACTIVE'}</span>
      </div>`;
    }).join('');
  }

  const overallRatio = catTickets > 0 ? formatSFL(catCost / catTickets) : "0.000";
  totalsEl.innerHTML = `<span class="sum-stat">${catTickets} Tickets</span> | <span class="sum-stat">${formatSFL(catCost)} SFL</span> | <span class="avg-pill">📊 Avg: ${overallRatio} SFL / Tix</span>`;
  modal.classList.add('show');
}

export function closeCategorySummaryModal() {
  document.getElementById('categorySummaryModal').classList.remove('show');
}

export function renderHistoryModalList() {
  const container = document.getElementById('modalLogList');
  if (!container) return;

  const logs = 
    (state.globalData?.cloudHistory?.logs) || 
    (state.globalData?.vaultData?.logs) || 
    (state.currentVaultData?.logs) || 
    [];

  if (!Array.isArray(logs) || logs.length === 0) {
    container.innerHTML = '<p style="color:#8C7853; font-size:12px; font-weight:bold;">No saved vault logs found for this account yet. Click "SAVE IN CLOUD" to create a snapshot log.</p>';
    return;
  }

  container.innerHTML = logs.map((log, idx) => {
    const completedItems = (log.deliveriesDone || []).filter(d => (d.yield && d.yield > 0) || d.checked || d.completed);
    const delivHtml = completedItems.length > 0 ? 
      `<div style="color:#5C4033; font-size:11px;"><strong>📦 Completed:</strong> ${completedItems.map(d => `${d.name || d.from} (+${d.yield || d.tickets || d.baseTickets || 0} Tix, ${formatSFL(d.cost || d.itemsCost)} SFL)`).join(', ')}</div>` : '';

    const logTickets = log.ticketsSaved || 0;
    const logCost = log.costSaved || 0;
    const logRatio = logTickets > 0 ? formatSFL(logCost / logTickets) : "0.000";

    return `<div style="background:#FFF8DC; padding:12px; border:2px solid #8B5A2B; border-radius:6px; display:flex; flex-direction:column; gap:6px; margin-bottom:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; color:#5C4033; font-size:11px; font-weight:900;">
        <span style="color:#8B4513;">Log #${logs.length - idx} (${log.date || 'Snapshot'} - ${log.weekId || 'Week'})</span>
        <button onclick="deleteMasterLog(${idx})" class="btn btn-sm btn-wood" style="background:#C0392B; border-color:#922B21; color:#fff; padding:3px 10px; cursor:pointer;">🗑️ DELETE</button>
      </div>
      <div style="display:flex; justify-content:space-between; color:#2E7D32; font-weight:900; font-size:12px; border-bottom:1px dashed #D2B48C; padding-bottom:4px;">
        <span>Daily Yield: +${logTickets} Tickets | Cost: ${formatSFL(logCost)} SFL</span>
        <span class="ratio-pill">${logRatio} SFL / Ticket</span>
      </div>
      <div style="display:flex; flex-direction:column; gap:3px;">${delivHtml}</div>
    </div>`;
  }).join('');
}

export async function deleteMasterLog(logIdx) {
  if (!state.currentUser) {
    alert('Please log in to manage your vault history.');
    return;
  }

  const logs = 
    state.globalData?.cloudHistory?.logs || 
    state.globalData?.vaultData?.logs || 
    state.currentVaultData?.logs || 
    [];

  if (!logs[logIdx]) return;

  const targetLog = logs[logIdx];
  const label = targetLog.date || `Log #${logs.length - logIdx}`;
  
  if (confirm(`🗑️ Permanently delete snapshot for ${label}?`)) {
    try {
      const res = await fetch('/api/chapter?action=deleteLog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: state.currentUser,
          logIdx: logIdx
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to delete log.');

      state.currentVaultData = data.vaultData;
      if (state.globalData) {
        state.globalData.cloudHistory = data.vaultData;
        state.globalData.vaultData = data.vaultData;
      }

      renderHistoryModalList();
      const { recalculateAll } = await import('./render.js');
      recalculateAll();
    } catch (err) {
      alert(`Delete Error: ${err.message}`);
    }
  }
}

export function toggleHistoryModal() {
  const modal = document.getElementById('historyModal');
  if (!modal) return;

  modal.classList.toggle('show');
  if (modal.classList.contains('show')) {
    renderHistoryModalList();
  }
}
