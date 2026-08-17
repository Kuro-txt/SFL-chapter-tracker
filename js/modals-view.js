import { 
  state, 
  formatSFL, 
  resolveAnimalLevel, 
  syncCurrentVaultToCloud, 
  isAnimalBounty,
  getActiveBoostCount,
  getActiveVipBonus
} from './state.js';
import { recalculateAll } from './render.js';

function computeYield(base, isVipEligible = true) {
  const raw = Number(base) || 0;
  if (raw <= 0) return 0;
  const vip = isVipEligible ? getActiveVipBonus() : 0;
  const boost = getActiveBoostCount();
  return raw + vip + boost;
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
      const base = d.baseTickets !== undefined ? d.baseTickets : (d.tickets || 2);
      let finalTickets = computeYield(base, true);
      if (d.hasDoubleBonus) finalTickets *= 2;

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
    
    const currentBounties = (state.globalData.bounties || []).filter(b => isAnimalBounty(b) === isAnimal);
    const sortedBounties = [...currentBounties].sort((a, b) => {
      const aDone = a.checked !== undefined ? a.checked : Boolean(a.completed);
      const bDone = b.checked !== undefined ? b.checked : Boolean(b.completed);
      return aDone === bDone ? 0 : aDone ? 1 : -1;
    });

    bodyEl.innerHTML = sortedBounties.map(b => {
      const isTicked = b.checked !== undefined ? b.checked : Boolean(b.completed);
      const base = b.baseTickets !== undefined ? b.baseTickets : (b.tickets || 0);
      const finalTickets = computeYield(base, false); // Bounties: Boosts only

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
      const base = c.baseTickets !== undefined ? c.baseTickets : (c.tickets || 1);
      const finalTickets = computeYield(base, true); // Chores: VIP + Boosts

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
          `<div style="color:#5C4033; font-size:11px;"><strong>📦 Daily Deliveries:</strong> ${log.deliveriesDone.map(d => typeof d === 'string' ? d : `${d.name || d.from} (${formatSFL(d.cost || d.itemsCost)} SFL)`).join(', ')}</div>` : '';

        const logTickets = log.ticketsSaved || 0;
        const logCost = log.costSaved || 0;
        const logRatio = logTickets > 0 ? formatSFL(logCost / logTickets) : "0.00";

        return `<div style="background:#FFF8DC; padding:12px; border:2px solid #8B5A2B; border-radius:6px; display:flex; flex-direction:column; gap:6px; margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; color:#5C4033; font-size:11px; font-weight:900;">
            <span style="color:#8B4513;">Log #${logs.length - idx} (${log.date || 'Snapshot'} - ${log.weekId || 'Week'})</span>
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
