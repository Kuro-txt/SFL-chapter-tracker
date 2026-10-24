import { renderChapterLogsList } from './modal-chapter-logs.js';
import { getNpcIconHtml } from './npc-icons.js';
import { renderItemIcon, renderAnimalIcon, renderRequestedItemsHtml, renderChapterTicketIcon } from './item-icons.js';
import { 
  state, 
  formatSFL, 
  resolveAnimalLevel, 
  isAnimalBounty,
  hasWeeklyBountiesBonus,
  getActiveBoostCount,
  getActiveVipBonus,
  getDeliveryRecords,
  getMondayBasedWeekId,
  getActiveBoostsCostSfl,
  getBoostCostsConfig,
  saveBoostCostsConfig,
  getCoinRatio
} from './state.js';


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
      if (d.hasDoubleBonus && !isManual && !d.isStacked) tix *= 2;
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

  const hasBountyBonus = hasWeeklyBountiesBonus(allBounties);
  if (hasBountyBonus) {
    bountyTickets += 100;
  }

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
      <span class="sum-stat" style="color:#2E7D32; font-size:13px; display:inline-flex; align-items:center; gap:4px;">${renderChapterTicketIcon(16)} <span>${totalWeekTickets} Tickets</span></span>
      <span class="sum-stat" style="color:#D2691E; font-size:13px;">💰 ${formatSFL(totalWeekCost)} SFL</span>
      <span class="avg-pill" style="font-size:12px;">📊 Avg: ${overallRatio} SFL / Tix</span>
    </div>
  `;

  const categoryCardsHtml = `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:8px; margin-bottom:12px;">
      <div style="background:#FFF8DC; border:2px solid #8B5A2B; border-radius:8px; padding:8px 10px; display:flex; flex-direction:column; gap:3px;">
        <span style="font-size:11px; font-weight:900; color:#8B4513;">📦 DELIVERIES</span>
        <span style="font-size:14px; font-weight:900; color:#2E7D32; display:inline-flex; align-items:center; gap:3px;">${renderChapterTicketIcon(14)} +${delivTickets} Tix</span>
        <span style="font-size:10px; font-weight:bold; color:#795548;">${formatSFL(delivCost)} SFL (${weekDeliveries.filter(d => d.isDone).length}/${weekDeliveries.length})</span>
      </div>
      <div style="background:#FFF8DC; border:2px solid #8B5A2B; border-radius:8px; padding:8px 10px; display:flex; flex-direction:column; gap:3px;">
        <span style="font-size:11px; font-weight:900; color:#8B4513;">📜 BOUNTIES</span>
        <span style="font-size:14px; font-weight:900; color:#2E7D32; display:inline-flex; align-items:center; gap:3px;">${renderChapterTicketIcon(14)} +${bountyTickets} Tix</span>
        <span style="font-size:10px; font-weight:bold; color:#795548;">${formatSFL(bountyCost)} SFL (${weekBounties.filter(b => b.isDone).length}/${weekBounties.length})${hasBountyBonus ? ' <span style="color:#2E7D32; font-weight:900;">(+100 Bonus)</span>' : ''}</span>
      </div>
      <div style="background:#FFF8DC; border:2px solid #8B5A2B; border-radius:8px; padding:8px 10px; display:flex; flex-direction:column; gap:3px;">
        <span style="font-size:11px; font-weight:900; color:#8B4513;">🐄 ANIMAL BOUNTIES</span>
        <span style="font-size:14px; font-weight:900; color:#2E7D32; display:inline-flex; align-items:center; gap:3px;">${renderChapterTicketIcon(14)} +${animalBountyTickets} Tix</span>
        <span style="font-size:10px; font-weight:bold; color:#795548;">${formatSFL(animalBountyCost)} SFL (${weekAnimalBounties.filter(b => b.isDone).length}/${weekAnimalBounties.length})</span>
      </div>
      <div style="background:#FFF8DC; border:2px solid #8B5A2B; border-radius:8px; padding:8px 10px; display:flex; flex-direction:column; gap:3px;">
        <span style="font-size:11px; font-weight:900; color:#8B4513;">🧹 CHORES</span>
        <span style="font-size:14px; font-weight:900; color:#2E7D32; display:inline-flex; align-items:center; gap:3px;">${renderChapterTicketIcon(14)} +${choreTickets} Tix</span>
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
            <div style="font-weight:900; color:#3E2723; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span style="display:inline-flex; align-items:center; gap:4px;">${it.type === 'delivery' ? getNpcIconHtml(it.name, { size: 22 }) : it.type === 'chore' ? getNpcIconHtml(it.npc || 'Hank', { size: 22 }) : it.type === 'bounty' ? renderItemIcon(it.name, '📜', 22) : renderAnimalIcon(it.name, 22)} <span>${it.name.toUpperCase()}</span></span>
              ${it.level ? `<span class="tag-pill tag-lvl">Lvl ${it.level}</span>` : ''}
            </div>
            ${it.details ? `<div style="font-size:9.5px; color:#5C4033; font-weight:bold; margin-top:2px;">${it.details}</div>` : ''}
            <div style="display:flex; gap:8px; align-items:center; margin-top:3px; flex-wrap:wrap;">
              <span style="color:#2E7D32; font-weight:900; display:inline-flex; align-items:center; gap:3px;">${renderChapterTicketIcon(14)} +${it.tickets} Tix</span>
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
  let targetMatchingCount = 0;
  const targetRatio = parseFloat(document.getElementById('targetRatioInput')?.value || localStorage.getItem('sfl_target_ratio')) || 0;

  const isDoubleDeliveryActive = Boolean(state.globalData.isDoubleDeliveryActive);

  if (cat === 'delivery') {
    titleEl.textContent = '📦 LIVE BOARD DELIVERIES OVERVIEW';
    const liveDeliveries = state.globalData.deliveries || [];

    const KNOWN_DOUBLE_DELIVERY_DATES = ['2026-09-02'];
    const doubleDeliveryDates = new Set([...(state.globalData.doubleDeliveryDates || []), ...KNOWN_DOUBLE_DELIVERY_DATES]);
    const now = new Date();
    const todayUtcStr = now.toISOString().split('T')[0];
    const localDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const startOfTodayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    const isDoubleToday = isDoubleDeliveryActive || doubleDeliveryDates.has(todayUtcStr);

    // 1. Identify NPCs that have already completed a double delivery today
    const npcDoubleClaimedToday = new Set();
    const masterDeliveries = getDeliveryRecords();

    if (isDoubleToday) {
      masterDeliveries.forEach(d => {
        if (!d || d.isSkipped || d.isStacked || d.isManual) return;
        const isDone = d.checked !== undefined ? Boolean(d.checked) : Boolean(d.completed);
        if (!isDone) return;

        let isToday = false;
        if (d.completedAt) {
          const ts = typeof d.completedAt === 'number' ? d.completedAt : Number(d.completedAt);
          if (!isNaN(ts) && ts > 0) {
            const ms = ts < 1e11 ? ts * 1000 : ts;
            isToday = (ms >= startOfTodayUtcMs);
          }
        } else {
          const compDate = d.completedDate || (d.weekId && d.weekId.includes('-') ? d.weekId : '');
          if (compDate === todayUtcStr || compDate === localDateStr) isToday = true;
        }

        if (isToday) {
          const npcClean = (d.from || d.name || '').toLowerCase().trim();
          if (d.hasDoubleBonus || !npcDoubleClaimedToday.has(npcClean)) {
            npcDoubleClaimedToday.add(npcClean);
          }
        }
      });
    }

    // 2. Pre-calculate double delivery eligibility in liveDeliveries (first non-skipped delivery for each NPC)
    const doubleEligibleMap = new Map();

    if (isDoubleToday) {
      // First pass: if any live delivery was already marked with hasDoubleBonus
      liveDeliveries.forEach(d => {
        if (d.isStacked || d.isManual) return;
        const isDone = (d.checked !== undefined ? Boolean(d.checked) : Boolean(d.completed)) && !d.isSkipped;
        const npcClean = (d.from || d.name || '').toLowerCase().trim();
        if (isDone && d.hasDoubleBonus) {
          doubleEligibleMap.set(d, true);
          npcDoubleClaimedToday.add(npcClean);
        }
      });

      // Second pass: assign double bonus to the first un-skipped delivery for each NPC
      liveDeliveries.forEach(d => {
        if (doubleEligibleMap.has(d)) return;
        if (d.isStacked || d.isManual) {
          doubleEligibleMap.set(d, false);
          return;
        }
        const npcClean = (d.from || d.name || '').toLowerCase().trim();
        const isSkipped = Boolean(d.isSkipped);

        if (isSkipped) {
          doubleEligibleMap.set(d, false);
          return; // Skipped order does NOT consume the double bonus, leaves it for the next order
        }

        if (!npcDoubleClaimedToday.has(npcClean)) {
          doubleEligibleMap.set(d, true);
          npcDoubleClaimedToday.add(npcClean);
        } else {
          doubleEligibleMap.set(d, false);
        }
      });
    }

    const sortedDeliv = [...liveDeliveries].sort((a, b) => {
      const aDone = a.checked !== undefined ? a.checked : Boolean(a.completed);
      const bDone = b.checked !== undefined ? b.checked : Boolean(b.completed);
      return aDone === bDone ? 0 : aDone ? 1 : -1;
    });

    bodyEl.innerHTML = sortedDeliv.map(d => {
      const isTicked = (d.checked !== undefined ? d.checked : Boolean(d.completed)) && !d.isSkipped;
      const base = d.baseTickets !== undefined ? d.baseTickets : (d.tickets || 2);
      const isManual = Boolean(d.isManual);
      const applyDouble = !isManual && !d.isStacked && Boolean(doubleEligibleMap.get(d));
      
      let finalTickets = computeYield(base, true, isManual);
      if (applyDouble) {
        finalTickets *= 2;
      }

      const itemCost = d.itemsCost || d.cost || 0;
      const numRatio = finalTickets > 0 ? (itemCost / finalTickets) : 0;
      const itemRatio = finalTickets > 0 ? formatSFL(numRatio) : "0.000";

      const isTargetMatch = (targetRatio > 0) && (finalTickets > 0) && (numRatio <= targetRatio);
      if (isTargetMatch) targetMatchingCount++;

      const targetBadge = isTargetMatch
        ? `<span class="tag-pill tag-target-match" title="Ratio (${itemRatio}) meets or beats target ratio (≤ ${targetRatio.toFixed(3)})">🎯 ≤ ${targetRatio.toFixed(2)}</span>`
        : '';
      const cardBorderClass = isTargetMatch ? 'card-target-match' : '';
      const ratioClass = isTargetMatch ? 'ratio-pill ratio-target-match' : 'ratio-pill';

      if (isTicked) {
        catTickets += finalTickets;
        catCost += itemCost;
      }

      const doubleBadge = applyDouble 
        ? '<span class="tag-pill tag-double">⚡ 2X EVENT</span>' 
        : '';
      const isStackedBadge = d.isStacked ? '<span class="tag-pill tag-stacked">🥞 STACKED</span>' : '';
      const isSkippedBadge = d.isSkipped ? '<span class="tag-pill tag-skipped">✕ SKIPPED</span>' : '';
      const itemRows = (d.itemDetails && d.itemDetails.length > 0)
        ? d.itemDetails.map(it => `<span style="display:inline-flex; align-items:center; gap:4px; margin-bottom:2px;">${renderItemIcon(it.name, '•', 16)} <strong>${it.qty}x ${it.name}</strong> (${formatSFL(it.lineCost)} SFL)</span>`).join('<br/>')
        : (d.items ? renderRequestedItemsHtml(d.items, 16) : (d.isStacked ? '🥞 Stacked delivery — recipe not synced' : 'No item recipe data'));

      let statusBadge = `<span class="badge ${isTicked ? 'badge-done' : 'badge-active'}">${isTicked ? '✨ DONE' : '⏳ ACTIVE'}</span>`;
      if (d.isSkipped) {
        statusBadge = `<span class="badge" style="background:#FFCDD2; color:#B71C1C;">✕ SKIPPED</span>`;
      }

      return `<div class="${cardBorderClass}" style="background:#FFF8DC; border:2px solid #8B5A2B; padding:10px; border-radius:8px; display:flex; flex-direction:column; gap:6px; font-size:11px;">
        <div style="display:flex; justify-content:space-between; align-items:center; font-weight:900;">
          <span style="color:#8B4513; display:inline-flex; align-items:center; gap:6px;">${getNpcIconHtml(d.from || d.name, { size: 26, className: 'npc-avatar-md' })} <span>${(d.from || d.name || 'NPC').toUpperCase()} ${d.isChapterNpc ? '👑' : ''}</span>${doubleBadge}${isStackedBadge}${isSkippedBadge}${targetBadge}</span>
          ${statusBadge}
        </div>
        <div style="color:#5C4033; font-weight:bold; line-height:1.4;">${itemRows}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-weight:900; color:#2E7D32; border-top:1px dashed #D2B48C; padding-top:6px; flex-wrap:wrap; gap:4px;">
          <span style="display:inline-flex; align-items:center; gap:3px;">Yield: ${renderChapterTicketIcon(16)} <strong>${finalTickets} Tickets</strong></span>
          <span>💰 ${formatSFL(itemCost)} SFL</span>
          <span class="${ratioClass}">
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
      const numRatio = finalTickets > 0 ? (itemCost / finalTickets) : 0;
      const itemRatio = finalTickets > 0 ? formatSFL(numRatio) : "0.000";

      const isTargetMatch = (targetRatio > 0) && (finalTickets > 0) && (numRatio <= targetRatio);
      if (isTargetMatch) targetMatchingCount++;

      const targetBadge = isTargetMatch
        ? `<span class="tag-pill tag-target-match" title="Ratio (${itemRatio}) meets or beats target ratio (≤ ${targetRatio.toFixed(3)})">🎯 ≤ ${targetRatio.toFixed(2)}</span>`
        : '';
      const cardBorderClass = isTargetMatch ? 'card-target-match' : '';
      const ratioClass = isTargetMatch ? 'ratio-pill ratio-target-match' : 'ratio-pill';

      if (isTicked) {
        catTickets += finalTickets;
        catCost += itemCost;
      }
      const lvl = resolveAnimalLevel(b);
      const lvlTag = lvl ? `<span class="tag-pill tag-lvl">Lvl ${lvl}</span>` : '';

      const bountyHeaderHtml = isAnimal
        ? `<span style="display:inline-flex; align-items:center; gap:5px;">${renderAnimalIcon(b.name, 24)} <strong>${(b.name || '').toUpperCase()}</strong></span>`
        : `<span style="display:inline-flex; align-items:center; gap:5px;">${renderItemIcon(b.name, '📜', 24)} <strong>${(b.name || '').toUpperCase()}</strong></span>`;

      return `<div class="${cardBorderClass}" style="background:#FFF8DC; border:2px solid #8B5A2B; padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:11px; gap:8px;">
        <div style="flex:1;">
          <div style="color:#3E2723; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">${bountyHeaderHtml}${lvlTag}${targetBadge}</div>
          <div style="display:flex; gap:8px; align-items:center; margin-top:3px; flex-wrap:wrap;">
            <span style="color:#8B4513; font-weight:bold; display:inline-flex; align-items:center; gap:3px;">Yield: ${renderChapterTicketIcon(14)} <strong>${finalTickets} Tix</strong></span>
            <span style="color:#5C4033; font-weight:bold;">💰 ${formatSFL(itemCost)} SFL</span>
            <span class="${ratioClass}">
              📊 ${itemRatio} SFL / Tix
            </span>
          </div>
        </div>
        <span class="badge ${isTicked ? 'badge-done' : 'badge-active'}">${isTicked ? '✨ DONE' : '⏳ ACTIVE'}</span>
      </div>`;
    }).join('');

    if (!isAnimal && hasWeeklyBountiesBonus(state.globalData?.bounties)) {
      catTickets += 100;
      bodyEl.innerHTML = `
        <div style="background:#E8F5E9; border:2px solid #2E7D32; border-radius:8px; padding:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong style="color:#1B5E20; font-size:12px;">🎉 100% REGULAR BOUNTY BOARD COMPLETED!</strong>
            <div style="font-size:11px; color:#2E7D32; margin-top:2px;">All regular bounties done — +100 Flat Bonus Tickets Awarded!</div>
          </div>
          <span style="font-size:15px; font-weight:900; color:#1B5E20; background:#C8E6C9; padding:4px 8px; border-radius:6px;">+100 Tix</span>
        </div>
      ` + bodyEl.innerHTML;
    }
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
      const numRatio = finalTickets > 0 ? (itemCost / finalTickets) : 0;
      const itemRatio = finalTickets > 0 ? formatSFL(numRatio) : "0.000";

      const isTargetMatch = (targetRatio > 0) && (finalTickets > 0) && (numRatio <= targetRatio);
      if (isTargetMatch) targetMatchingCount++;

      const targetBadge = isTargetMatch
        ? `<span class="tag-pill tag-target-match" title="Ratio (${itemRatio}) meets or beats target ratio (≤ ${targetRatio.toFixed(3)})">🎯 ≤ ${targetRatio.toFixed(2)}</span>`
        : '';
      const cardBorderClass = isTargetMatch ? 'card-target-match' : '';
      const ratioClass = isTargetMatch ? 'ratio-pill ratio-target-match' : 'ratio-pill';

      if (isTicked) {
        catTickets += finalTickets;
        catCost += itemCost;
      }

      return `<div class="${cardBorderClass}" style="background:#FFF8DC; border:2px solid #8B5A2B; padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:11px; gap:8px;">
        <div style="flex:1;">
          <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
            <strong style="color:#3E2723; display:inline-flex; align-items:center; gap:5px;">${getNpcIconHtml(c.npc || 'Hank', { size: 24, className: 'npc-avatar-sm' })} <span>${(c.npc || 'NPC').toUpperCase()}</span></strong>${targetBadge}
          </div>
          <span style="color:#5C4033; font-weight:bold; margin-top:2px; display:inline-block;">${c.task || c.name}</span><br/>
          <div style="display:flex; gap:8px; align-items:center; margin-top:3px; flex-wrap:wrap;">
            <span style="color:#2E7D32; font-weight:900; display:inline-flex; align-items:center; gap:3px;">Yield: ${renderChapterTicketIcon(14)} <strong>${finalTickets} Tix</strong></span>
            <span style="color:#5C4033; font-weight:bold;">💰 ${formatSFL(itemCost)} SFL</span>
            <span class="${ratioClass}">
              📊 ${itemRatio} SFL / Tix
            </span>
          </div>
        </div>
        <span class="badge ${isTicked ? 'badge-done' : 'badge-active'}">${isTicked ? '✨ DONE' : '⏳ ACTIVE'}</span>
      </div>`;
    }).join('');
  }

  const overallRatio = catTickets > 0 ? formatSFL(catCost / catTickets) : "0.000";
  const targetBadgeSummary = targetRatio > 0 
    ? ` | <span class="tag-pill tag-target-match" style="font-size:11px; padding:3px 8px; margin-left:0;">🎯 ${targetMatchingCount} Tasks ≤ ${targetRatio.toFixed(2)}</span>` 
    : '';
  totalsEl.innerHTML = `<span class="sum-stat" style="display:inline-flex; align-items:center; gap:4px;">${renderChapterTicketIcon(16)} <span>${catTickets} Tickets</span></span> | <span class="sum-stat">${formatSFL(catCost)} SFL</span> | <span class="avg-pill">📊 Avg: ${overallRatio} SFL / Tix</span>${targetBadgeSummary}`;
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

// ==========================================
// CHAPTER LOGS & SEASONAL ARCHIVES
// ==========================================

export function openChapterLogsModal() {
  const modal = document.getElementById('chapterLogsModal');
  if (!modal) return;

  // Refresh active chapter preview
  const tixEl = document.getElementById('statTotalTickets');
  const costEl = document.getElementById('statTotalCost');
  const ratioEl = document.getElementById('statTotalRatio');

  const activeTixEl = document.getElementById('chapterActiveTix');
  const activeCostEl = document.getElementById('chapterActiveCost');
  const activeRatioEl = document.getElementById('chapterActiveRatio');

  if (activeTixEl && tixEl) {
    const rawNum = (tixEl.textContent || '0').replace(/[^0-9]/g, '');
    activeTixEl.innerHTML = `<span style="display:inline-flex; align-items:center; gap:3px;">${renderChapterTicketIcon(14)} <span>${(parseInt(rawNum, 10) || 0).toLocaleString()} Tix</span></span>`;
  }
  if (activeCostEl && costEl) activeCostEl.textContent = costEl.textContent || '0.000 SFL';
  if (activeRatioEl && ratioEl) activeRatioEl.textContent = ratioEl.textContent || '0.000 SFL/Tix';

  renderChapterLogsList();
  modal.classList.add('show');

  if (state.currentUser) {
    fetch(`/api/chapter?action=getChapterLogs&username=${encodeURIComponent(state.currentUser)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.chapterLogs)) {
          if (!state.currentVaultData) state.currentVaultData = {};
          state.currentVaultData.chapterLogs = data.chapterLogs;
          try {
            localStorage.setItem('sfl_chapter_logs', JSON.stringify(data.chapterLogs));
          } catch (e) {}
          renderChapterLogsList();
        }
      })
      .catch(() => {});
  }
}

export function closeChapterLogsModal() {
  const modal = document.getElementById('chapterLogsModal');
  if (modal) modal.classList.remove('show');
}

// Re-export Chapter Logs System
export {
  getStoredChapterLogs,
  saveStoredChapterLogs,
  setChapterLogBoost,
  setChapterLogVip,
  renderChapterLogsList,
  snapshotCurrentChapter,
  deleteChapterLog,
  exportChapterLog
} from './modal-chapter-logs.js';

// Re-export Boost Costs System
export {
  openBoostsCostModal,
  closeBoostsCostModal,
  updateBoostModalPreview,
  saveBoostCostsFromModal,
  resetBoostCostsToDefault
} from './modal-boosts.js';
