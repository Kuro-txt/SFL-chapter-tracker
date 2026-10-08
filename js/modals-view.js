import { 
  state, 
  formatSFL, 
  resolveAnimalLevel, 
  isAnimalBounty,
  hasWeeklyBountiesBonus,
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
        <span style="font-size:10px; font-weight:bold; color:#795548;">${formatSFL(bountyCost)} SFL (${weekBounties.filter(b => b.isDone).length}/${weekBounties.length})${hasBountyBonus ? ' <span style="color:#2E7D32; font-weight:900;">(+100 Bonus)</span>' : ''}</span>
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
      const itemRatio = finalTickets > 0 ? formatSFL(itemCost / finalTickets) : "0.000";

      if (isTicked) {
        catTickets += finalTickets;
        catCost += itemCost;
      }

      const doubleBadge = applyDouble 
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
        <div style="color:#5C4033; font-weight:bold; line-height:1.4;">${itemRows || (d.isStacked ? '🥞 Stacked delivery — recipe not synced' : 'No item recipe data')}</div>
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

  if (activeTixEl && tixEl) activeTixEl.textContent = `${tixEl.textContent || '0'} Tix`;
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

export function getStoredChapterLogs() {
  let logs = [];
  if (state.currentVaultData && Array.isArray(state.currentVaultData.chapterLogs)) {
    logs = state.currentVaultData.chapterLogs;
  } else {
    try {
      const local = localStorage.getItem('sfl_chapter_logs');
      if (local) logs = JSON.parse(local);
    } catch (e) {}
  }
  return Array.isArray(logs) ? logs : [];
}

export async function saveStoredChapterLogs(logsArray) {
  if (!state.currentVaultData) state.currentVaultData = {};
  state.currentVaultData.chapterLogs = logsArray;

  try {
    localStorage.setItem('sfl_chapter_logs', JSON.stringify(logsArray));
  } catch (e) {}

  if (state.currentUser) {
    const { saveProgressToCloudKV } = await import('./api.js');
    await saveProgressToCloudKV();
  }
}

export function setChapterLogBoost(cardKey, count) {
  const boostNum = Math.max(0, Math.min(3, parseInt(count, 10) || 0));
  localStorage.setItem(`sfl_chapter_boost_${cardKey}`, boostNum);
  renderChapterLogsList();
}

export function setChapterLogVip(cardKey, isVip) {
  localStorage.setItem(`sfl_chapter_vip_${cardKey}`, isVip ? '1' : '0');
  renderChapterLogsList();
}

if (typeof window !== 'undefined') {
  window.setChapterLogBoost = setChapterLogBoost;
  window.setChapterLogVip = setChapterLogVip;
}

export function renderChapterLogsList() {
  const container = document.getElementById('chapterLogsList');
  const countEl = document.getElementById('chapterLogsCount');
  if (!container) return;

  const logs = getStoredChapterLogs();
  if (countEl) countEl.textContent = logs.length;

  if (logs.length === 0) {
    container.innerHTML = `
      <div class="chapter-empty-state">
        <span class="chapter-empty-icon">📜</span>
        <strong class="chapter-empty-title">No archived chapter logs yet.</strong>
        <p class="chapter-empty-desc">
          Click <strong style="color: #2E7D32;">"💾 SNAPSHOT TO LOGS"</strong> above to save a permanent lightweight (~1.2 KB) summary of your seasonal ticket count and resource costs!<br/>
          <span style="display: inline-block; margin-top: 6px; font-size: 10.5px; opacity: 0.85;">
            ⏰ Sun-Forge also automatically snapshots and updates this active chapter on the 01:30 & 23:30 UTC cron syncs.
          </span>
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = logs.map((item, idx) => {
    const cats = item.categories || {};
    const deliv = cats.deliveries || { count: 0, tickets: 0, cost: 0 };
    const bounty = cats.bounties || { count: 0, tickets: 0, cost: 0 };
    const animal = cats.animalBounties || { count: 0, tickets: 0, cost: 0 };
    const chore = cats.chores || { count: 0, tickets: 0, cost: 0 };
    const login = cats.logins || { count: 0, tickets: 0, cost: 0 };
    const tracked = cats.tracked || { tickets: 0, cost: 0 };

    const cardChapterKey = item.chapterId || `chapter_${idx}`;
    const savedBoost = localStorage.getItem(`sfl_chapter_boost_${cardChapterKey}`);
    const boostLevel = savedBoost !== null ? parseInt(savedBoost, 10) : getActiveBoostCount();

    const savedVip = localStorage.getItem(`sfl_chapter_vip_${cardChapterKey}`);
    const isVipActive = savedVip !== null ? (savedVip === '1') : (item.vipActive !== undefined ? Boolean(item.vipActive) : (getActiveVipBonus() > 0));

    // Only automated tasks receive boost & VIP bonuses! Manual tasks and manual track are strictly excluded.
    const autoDeliv = deliv.autoCount !== undefined ? deliv.autoCount : Math.max(0, (deliv.count || 0) - (deliv.manualCount || 0));
    const doubleDeliv = deliv.doubleCount || 0; // 2x event deliveries receive +2 per boost and +2 extra VIP
    const autoBounty = bounty.autoCount !== undefined ? bounty.autoCount : (bounty.count || 0);
    const autoAnimal = animal.autoCount !== undefined ? animal.autoCount : (animal.count || 0);
    const autoChore = chore.autoCount !== undefined ? chore.autoCount : Math.max(0, (chore.count || 0) - (chore.manualCount || 0));

    // VIP units: 1 per auto delivery (+1 more if double), 1 per auto chore. Bounties, animal bounties, login, manual tasks = 0 VIP!
    const delivVipUnits = deliv.vipUnits !== undefined ? deliv.vipUnits : (autoDeliv + doubleDeliv);
    const choreVipUnits = chore.vipUnits !== undefined ? chore.vipUnits : autoChore;
    const totalVipUnits = delivVipUnits + choreVipUnits;

    // Boost units: 1 per auto delivery (+1 if double), 1 per auto chore, 1 per auto bounty, 1 per animal bounty
    const delivBoostUnits = autoDeliv + doubleDeliv;
    const choreBoostUnits = autoChore;
    const bountyBoostUnits = autoBounty;
    const animalBoostUnits = autoAnimal;
    const totalBoostUnits = delivBoostUnits + choreBoostUnits + bountyBoostUnits + animalBoostUnits;

    // Detect if this snapshot originally had VIP baked in
    const snapshotHadVip = item.baseTotalTickets !== undefined 
      ? false 
      : (item.vipActive !== undefined ? item.vipActive : ((deliv.tickets || 0) >= (delivVipUnits * 4) || getActiveVipBonus() > 0));

    // Calculate base tickets (strictly raw: 0 VIP, 0 Boosts)
    const delivBaseTix = deliv.baseTickets !== undefined 
      ? deliv.baseTickets 
      : (snapshotHadVip ? Math.max(0, (deliv.tickets || 0) - (delivVipUnits * 2)) : (deliv.tickets || 0));
    const choreBaseTix = chore.baseTickets !== undefined 
      ? chore.baseTickets 
      : (snapshotHadVip ? Math.max(0, (chore.tickets || 0) - (choreVipUnits * 2)) : (chore.tickets || 0));
    const bountyBaseTix = bounty.baseTickets !== undefined ? bounty.baseTickets : (bounty.tickets || 0);
    const animalBaseTix = animal.baseTickets !== undefined ? animal.baseTickets : (animal.tickets || 0);
    const baseTotalTickets = item.baseTotalTickets !== undefined 
      ? item.baseTotalTickets 
      : (snapshotHadVip ? Math.max(0, (item.totalTickets || 0) - (totalVipUnits * 2)) : (item.totalTickets || 0));

    // Calculate dynamic bonus tickets
    const vipMultiplier = isVipActive ? 2 : 0;
    const extraDelivVip = vipMultiplier * delivVipUnits;
    const extraChoreVip = vipMultiplier * choreVipUnits;
    const extraTotalVip = extraDelivVip + extraChoreVip;

    const extraDelivBoost = boostLevel * delivBoostUnits;
    const extraChoreBoost = boostLevel * choreBoostUnits;
    const extraBountyBoost = boostLevel * bountyBoostUnits;
    const extraAnimalBoost = boostLevel * animalBoostUnits;
    const extraTotalBoost = extraDelivBoost + extraChoreBoost + extraBountyBoost + extraAnimalBoost;

    const displayDelivTix = delivBaseTix + extraDelivVip + extraDelivBoost;
    const displayChoreTix = choreBaseTix + extraChoreVip + extraChoreBoost;
    const displayBountyTix = bountyBaseTix + extraBountyBoost;
    const displayAnimalTix = animalBaseTix + extraAnimalBoost;

    const displayTotalTickets = baseTotalTickets + extraTotalVip + extraTotalBoost;
    const displayEfficiencyRatio = displayTotalTickets > 0 ? (item.totalCost / displayTotalTickets) : 0;

    // Helper to resolve week units for both new and existing snapshots
    const masterDeliveries = getDeliveryRecords().filter(d => Boolean(d.checked !== undefined ? d.checked : d.completed) && !d.isSkipped);
    const cloudWeeks = state.globalData?.cloudHistory?.weeks || (function() {
      try { return JSON.parse(localStorage.getItem('sfl_cloud_weeks') || '{}'); } catch(e) { return {}; }
    })();

    const isManuallyEditedOrAdded = (d) => {
      if (!d) return false;
      return Boolean(d.isManual) || 
             (typeof d.id === 'string' && d.id.startsWith('manual_')) || 
             Boolean(d.isCustomTickets) || 
             (d.userTickets !== undefined && d.userTickets !== null) ||
             Boolean(d.isCustom);
    };

    const liveWeekUnitsMap = new Map();
    masterDeliveries.forEach(d => {
      const isManualOrEdited = isManuallyEditedOrAdded(d);
      const wasDouble = Boolean(d.hasDoubleBonus) && !Boolean(d.isStacked);
      const dDate = d.completedAt || d.completedDate;
      const dWeek = getMondayBasedWeekId(d.weekId || dDate || (d.checkedToday ? getMondayBasedWeekId() : null));
      if (!liveWeekUnitsMap.has(dWeek)) {
        liveWeekUnitsMap.set(dWeek, { vipUnits: 0, boostUnits: 0, manualTickets: 0 });
      }
      const st = liveWeekUnitsMap.get(dWeek);
      if (isManualOrEdited) {
        st.manualTickets += (d.baseTickets !== undefined ? d.baseTickets : (d.tickets || 2));
      } else {
        st.vipUnits += wasDouble ? 2 : 1;
        st.boostUnits += wasDouble ? 2 : 1;
      }
    });

    Object.entries(cloudWeeks).forEach(([wkId, wkVal]) => {
      if (!wkVal || typeof wkVal !== 'object') return;
      const normWk = getMondayBasedWeekId(wkVal.weekId || wkId);
      if (!liveWeekUnitsMap.has(normWk)) {
        liveWeekUnitsMap.set(normWk, { vipUnits: 0, boostUnits: 0, manualTickets: 0 });
      }
      const st = liveWeekUnitsMap.get(normWk);
      (wkVal.bounties || []).forEach(b => {
        if (b.completed || b.checked) {
          const isMan = isManuallyEditedOrAdded(b);
          if (isMan) {
            st.manualTickets += (b.baseTickets || b.tickets || 0);
          } else {
            st.boostUnits += 1;
          }
        }
      });
      (wkVal.chores || []).forEach(c => {
        if (c.completed || c.checked) {
          const isMan = isManuallyEditedOrAdded(c);
          if (isMan) {
            st.manualTickets += (c.baseTickets || c.tickets || 1);
          } else {
            st.boostUnits += 1;
            st.vipUnits += 1;
          }
        }
      });
    });

    const weeks = Array.isArray(item.weeklySummary) ? item.weeklySummary : [];
    const weeksHtml = weeks.length > 0 ? `
      <div style="border-top: 1.5px dashed #D2B48C; padding-top: 8px; margin-top: 4px;">
        <span class="chapter-weekly-title">Weekly Progression (${weeks.length} Weeks Recorded):</span>
        <div class="chapter-weekly-grid">
          ${weeks.map(w => {
            const normWk = getMondayBasedWeekId(w.weekId);
            const liveUnits = liveWeekUnitsMap.get(normWk) || liveWeekUnitsMap.get(w.weekId);

            let weekBoostUnits = w.boostUnits;
            let weekVipUnits = w.vipUnits;
            let weekManualTix = w.manualTickets || 0;

            if (weekBoostUnits === undefined && liveUnits && (liveUnits.boostUnits > 0 || liveUnits.vipUnits > 0 || liveUnits.manualTickets > 0)) {
              weekBoostUnits = liveUnits.boostUnits;
              weekVipUnits = liveUnits.vipUnits;
              weekManualTix = liveUnits.manualTickets;
            }

            // Fallback for older snapshots where raw tasks aren't in live cache
            if (weekBoostUnits === undefined) {
              const autoTicketsInWeek = Math.max(0, (w.tickets || 0) - weekManualTix);
              const totalAutoTickets = Math.max(1, (item.totalTickets || 0));
              const proportion = autoTicketsInWeek / totalAutoTickets;
              weekBoostUnits = Math.round(totalBoostUnits * proportion);
              weekVipUnits = Math.round(totalVipUnits * proportion);
            }

            if (weekVipUnits === undefined) {
              weekVipUnits = 0;
            }

            const weekBaseTix = w.baseTickets !== undefined 
              ? w.baseTickets 
              : (snapshotHadVip ? Math.max(0, (w.tickets || 0) - (weekVipUnits * 2)) : (w.tickets || 0));

            // Strictly automated units receive VIP and Boost bonuses. Manual and manually edited tasks get 0!
            const extraWeekVip = vipMultiplier * (weekVipUnits || 0);
            const extraWeekBoost = boostLevel * (weekBoostUnits || 0);
            const displayWeekTix = weekBaseTix + extraWeekVip + extraWeekBoost;
            return `<span class="chapter-week-pill">W${w.week}: ${displayWeekTix} Tix (${formatSFL(w.cost)} SFL)</span>`;
          }).join('')}
        </div>
      </div>
    ` : '';

    const dateFormatted = item.archivedAt ? new Date(item.archivedAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) : 'Archived';

    const CHAPTER_END_FALLBACK = '2026-11-02T00:00:00.000Z';
    const endDateRaw = item.chapterEndDate || (item.chapterId === 'ascension_age_15' ? CHAPTER_END_FALLBACK : null);
    const endDateFormatted = endDateRaw ? new Date(endDateRaw).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) : null;

    const isLocked = Boolean(item.isLocked);
    const badgeHtml = isLocked 
      ? `<span class="chapter-badge-locked" title="Chapter ended. Permanently locked historical archive.">🔒 LOCKED (FINAL ARCHIVE)</span>`
      : `<span class="chapter-badge-live" title="Active season. Updates every cron sync.">⏳ IN PROGRESS (LIVE)</span>`;

    const deleteBtnHtml = isLocked
      ? `<button onclick="alert('🔒 This chapter log has ended and is permanently archived in the vault.')" class="btn btn-sm btn-wood" style="background: #64748b; border-color: #475569; color: #FFF; padding: 3px 8px; font-size: 10.5px; opacity: 0.6; cursor: not-allowed;" title="Permanently locked">🔒</button>`
      : `<button onclick="deleteChapterLog(${idx})" class="btn btn-sm btn-wood" style="background: #C0392B; border-color: #922B21; color: #FFF; padding: 3px 8px; font-size: 10.5px;" title="Delete this log">🗑️</button>`;

    return `
      <div class="chapter-log-card">
        <div class="chapter-log-header">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <strong class="chapter-card-title">🌾 ${item.chapterTitle || 'Archived Chapter'}</strong>
            ${badgeHtml}
            <span class="chapter-card-date" title="Snapshot Saved Date">📅 Archived: ${dateFormatted}</span>
            ${endDateFormatted ? `<span class="chapter-card-end-date" title="Season End Date">🏁 Ends: ${endDateFormatted}</span>` : ''}
          </div>
          <div style="display: flex; gap: 6px;">
            <button onclick="exportChapterLog(${idx})" class="btn btn-sm btn-wood" style="padding: 3px 8px; font-size: 10.5px;" title="Export JSON summary">
              📥 EXPORT
            </button>
            ${deleteBtnHtml}
          </div>
        </div>

        <div class="chapter-card-boosts" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span class="chapter-card-boosts-label">⚡ +1 BOOSTS:</span>
            <div class="chapter-boost-btn-group">
              <button type="button" class="chapter-boost-btn ${boostLevel === 0 ? 'active' : ''}" onclick="setChapterLogBoost('${cardChapterKey}', 0)">NONE</button>
              <button type="button" class="chapter-boost-btn ${boostLevel === 1 ? 'active' : ''}" onclick="setChapterLogBoost('${cardChapterKey}', 1)">🌟 #1</button>
              <button type="button" class="chapter-boost-btn ${boostLevel === 2 ? 'active' : ''}" onclick="setChapterLogBoost('${cardChapterKey}', 2)">🌟 #2</button>
              <button type="button" class="chapter-boost-btn ${boostLevel === 3 ? 'active' : ''}" onclick="setChapterLogBoost('${cardChapterKey}', 3)">🌟 #3</button>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span class="chapter-card-boosts-label">👑 VIP (+2):</span>
            <div class="chapter-boost-btn-group">
              <button type="button" class="chapter-boost-btn ${!isVipActive ? 'active' : ''}" onclick="setChapterLogVip('${cardChapterKey}', 0)">OFF</button>
              <button type="button" class="chapter-boost-btn ${isVipActive ? 'active' : ''}" onclick="setChapterLogVip('${cardChapterKey}', 1)">👑 ON</button>
            </div>
          </div>
          ${(extraTotalBoost + extraTotalVip) > 0 
            ? `<span class="chapter-boost-info">(+${extraTotalBoost + extraTotalVip} bonus tickets: ${extraTotalBoost > 0 ? `+${extraTotalBoost} boosts` : ''}${extraTotalBoost > 0 && extraTotalVip > 0 ? ', ' : ''}${extraTotalVip > 0 ? `+${extraTotalVip} VIP` : ''})</span>` 
            : '<span class="chapter-boost-info" style="opacity: 0.7;">(Raw base tickets)</span>'}
        </div>

        <div class="chapter-metrics-row">
          <div class="chapter-metric-box">
            <span class="chapter-metric-label">TOTAL TICKETS</span>
            <strong class="chapter-metric-val val-tix">${displayTotalTickets} Tix</strong>
            ${(extraTotalBoost + extraTotalVip) > 0 ? `<span class="chapter-metric-subtext">+${extraTotalBoost + extraTotalVip} bonus (${extraTotalBoost > 0 ? `${boostLevel} Boost${boostLevel > 1 ? 's' : ''}` : ''}${extraTotalBoost > 0 && extraTotalVip > 0 ? ' + ' : ''}${extraTotalVip > 0 ? 'VIP' : ''})</span>` : ''}
          </div>
          <div class="chapter-metric-box">
            <span class="chapter-metric-label">TOTAL COST</span>
            <strong class="chapter-metric-val val-cost">${formatSFL(item.totalCost)} SFL</strong>
          </div>
          <div class="chapter-metric-box">
            <span class="chapter-metric-label">AVG EFFICIENCY</span>
            <strong class="chapter-metric-val val-ratio">${formatSFL(displayEfficiencyRatio)} SFL/Tix</strong>
          </div>
        </div>

        <div class="chapter-breakdown-list">
          <div class="chapter-breakdown-item">📦 <strong>Deliveries:</strong> ${displayDelivTix} Tix ${(extraDelivVip + extraDelivBoost) > 0 ? `<span class="chapter-boost-pill">+${extraDelivVip + extraDelivBoost}</span>` : ''} | ${formatSFL(deliv.cost)} SFL (${deliv.count || 0} done)</div>
          <div class="chapter-breakdown-item">📜 <strong>Bounties:</strong> ${displayBountyTix} Tix ${extraBountyBoost > 0 ? `<span class="chapter-boost-pill">+${extraBountyBoost}</span>` : ''} | ${formatSFL(bounty.cost)} SFL (${bounty.count || 0} done)</div>
          <div class="chapter-breakdown-item">🐄 <strong>Animal Bounties:</strong> ${displayAnimalTix} Tix ${extraAnimalBoost > 0 ? `<span class="chapter-boost-pill">+${extraAnimalBoost}</span>` : ''} | ${formatSFL(animal.cost)} SFL (${animal.count || 0} done)</div>
          <div class="chapter-breakdown-item">🧹 <strong>Chores:</strong> ${displayChoreTix} Tix ${(extraChoreVip + extraChoreBoost) > 0 ? `<span class="chapter-boost-pill">+${extraChoreVip + extraChoreBoost}</span>` : ''} | ${formatSFL(chore.cost)} SFL (${chore.count || 0} done)</div>
          <div class="chapter-breakdown-item">🎁 <strong>Daily Login:</strong> ${login.tickets || 0} Tix (${login.count || 0} collected)</div>
          <div class="chapter-breakdown-item">🛤️ <strong>Manual Track:</strong> ${tracked.tickets || 0} Tix | ${formatSFL(tracked.cost)} SFL</div>
        </div>

        ${weeksHtml}
      </div>
    `;
  }).join('');
}

export async function snapshotCurrentChapter() {
  const currentTitleEl = document.getElementById('chapterActiveName');
  const defaultTitle = currentTitleEl ? currentTitleEl.textContent.replace('ACTIVE CHAPTER:', '').replace('LIVE SEASON', '').trim() : 'Ascension Age (Chapter 15)';
  
  const chapterTitle = prompt('Enter a label for this chapter snapshot:', defaultTitle);
  if (!chapterTitle || !chapterTitle.trim()) return;

  const ACTIVE_CHAPTER_ID = 'ascension_age_15';
  const CHAPTER_END_MS = Date.UTC(2026, 10, 2, 0, 0, 0); // Nov 2, 2026 00:00:00 UTC
  const isLocked = Date.now() >= CHAPTER_END_MS;

  const logs = getStoredChapterLogs();
  const existingIdx = logs.findIndex(l => l.chapterId === ACTIVE_CHAPTER_ID || (l.chapterTitle || '').toLowerCase() === chapterTitle.trim().toLowerCase());
  if (existingIdx >= 0 && logs[existingIdx].isLocked) {
    alert('🔒 This chapter has ended and is permanently locked as a final archive. It cannot be overwritten.');
    return;
  }

  const vipBonus = getActiveVipBonus(); // 2 if VIP, 0 otherwise
  const curWeekMonday = getMondayBasedWeekId();

  // Helper to accurately identify manual and manually edited tasks
  const isManTask = (item) => Boolean(item?.isManual) || 
                             (typeof item?.id === 'string' && item.id.startsWith('manual_')) || 
                             Boolean(item?.isCustomTickets) || 
                             (item?.userTickets !== undefined && item?.userTickets !== null) || 
                             Boolean(item?.isCustom);

  // 1. Raw Deliveries (Base without VIP or Boost, and * 2 on double event days)
  const masterDeliveries = getDeliveryRecords().filter(d => Boolean(d.checked !== undefined ? d.checked : d.completed) && !d.isSkipped);
  let delivBaseTix = 0, delivCost = 0, delivDoubleCount = 0, autoDelivCount = 0, manualDelivCount = 0;
  let delivVipUnits = 0, delivBoostUnits = 0;

  const weeklyMap = new Map();

  masterDeliveries.forEach(d => {
    const base = d.baseTickets !== undefined ? d.baseTickets : (d.tickets || 2);
    const isManual = isManTask(d);
    const wasDouble = Boolean(d.hasDoubleBonus) && !Boolean(d.isStacked);
    const cost = (d.itemsCost || d.cost || 0);
    delivCost += cost;

    const dDate = d.completedAt || d.completedDate;
    const dWeek = getMondayBasedWeekId(d.weekId || dDate || (d.checkedToday ? curWeekMonday : null));
    if (!weeklyMap.has(dWeek)) {
      weeklyMap.set(dWeek, { baseTickets: 0, cost: 0, boostUnits: 0, vipUnits: 0, manualTickets: 0 });
    }
    const stat = weeklyMap.get(dWeek);
    stat.cost += cost;

    if (isManual) {
      manualDelivCount++;
      delivBaseTix += base;
      stat.baseTickets += base;
      stat.manualTickets += base;
    } else {
      autoDelivCount++;
      if (wasDouble) delivDoubleCount++;
      const baseYield = wasDouble ? (base * 2) : base;
      delivBaseTix += baseYield;
      delivVipUnits += wasDouble ? 2 : 1;
      delivBoostUnits += wasDouble ? 2 : 1;

      stat.baseTickets += baseYield;
      stat.vipUnits += wasDouble ? 2 : 1;
      stat.boostUnits += wasDouble ? 2 : 1;
    }
  });

  // 2. Raw Bounties & Chores (Base + VIP where applicable; 0 +1 item boosts)
  let bountyBaseTix = 0, bountyCost = 0, bountyCount = 0, autoBountyCount = 0;
  let animalBountyBaseTix = 0, animalBountyCost = 0, animalBountyCount = 0, autoAnimalBountyCount = 0;
  let choreBaseTix = 0, choreCost = 0, choreCount = 0, autoChoreCount = 0, manualChoreCount = 0;

  const rawWeeks = { ...((state.globalData?.cloudHistory?.weeks) || (state.currentVaultData?.weeks) || {}) };
  if (!rawWeeks[curWeekMonday]) {
    rawWeeks[curWeekMonday] = { weekId: curWeekMonday, bounties: state.globalData?.bounties || [], chores: state.globalData?.chores || [] };
  } else {
    const currentSaved = rawWeeks[curWeekMonday];
    const savedManualChores = (currentSaved.chores || []).filter(isManTask);
    const savedManualBounties = (currentSaved.bounties || []).filter(isManTask);
    if (state.globalData?.bounties && state.globalData.bounties.length > 0) {
      const activeBounties = state.globalData.bounties.filter(b => !isManTask(b));
      rawWeeks[curWeekMonday].bounties = [...activeBounties, ...savedManualBounties];
    }
    if (state.globalData?.chores && state.globalData.chores.length > 0) {
      const activeChores = state.globalData.chores.filter(c => !isManTask(c));
      rawWeeks[curWeekMonday].chores = [...activeChores, ...savedManualChores];
    }
  }

  Object.entries(rawWeeks).forEach(([wkId, wkVal]) => {
    if (!wkVal || typeof wkVal !== 'object') return;
    const normWeek = getMondayBasedWeekId(wkVal.weekId || wkId);
    if (!weeklyMap.has(normWeek)) {
      weeklyMap.set(normWeek, { baseTickets: 0, cost: 0, boostUnits: 0, vipUnits: 0, manualTickets: 0 });
    }
    const stat = weeklyMap.get(normWeek);

    (wkVal.bounties || []).forEach(b => {
      if (b.completed || b.checked) {
        const isMan = isManTask(b);
        const t = b.baseTickets || b.tickets || 0;
        const c = b.itemsCost || b.cost || 0;
        stat.baseTickets += t;
        stat.cost += c;
        if (isMan) {
          stat.manualTickets += t;
        } else {
          stat.boostUnits += 1;
        }

        if (isAnimalBounty(b)) {
          animalBountyBaseTix += t;
          animalBountyCost += c;
          animalBountyCount++;
          if (!isMan) autoAnimalBountyCount++;
        } else {
          bountyBaseTix += t;
          bountyCost += c;
          bountyCount++;
          if (!isMan) autoBountyCount++;
        }
      }
    });

    if (hasWeeklyBountiesBonus(normWeek === curWeekMonday ? (state.globalData?.bounties || wkVal.bounties) : wkVal.bounties)) {
      bountyBaseTix += 100;
      stat.baseTickets += 100;
    }

    (wkVal.chores || []).forEach(c => {
      if (c.completed || c.checked) {
        const isMan = isManTask(c);
        const base = (c.baseTickets || c.tickets || 1);
        const cCost = (c.itemsCost || c.cost || 0);
        stat.baseTickets += base;
        stat.cost += cCost;
        choreBaseTix += base;
        choreCost += cCost;
        choreCount++;
        if (isMan) {
          manualChoreCount++;
          stat.manualTickets += base;
        } else {
          autoChoreCount++;
          stat.boostUnits += 1;
          stat.vipUnits += 1;
        }
      }
    });
  });

  const sortedWeeks = Array.from(weeklyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const weeklySummary = sortedWeeks.map(([wId, val], idx) => ({
    week: idx + 1,
    weekId: wId,
    baseTickets: val.baseTickets,
    tickets: val.baseTickets + (vipBonus > 0 ? (val.vipUnits * 2) : 0),
    cost: val.cost,
    boostUnits: val.boostUnits || 0,
    vipUnits: val.vipUnits || 0,
    manualTickets: val.manualTickets || 0
  }));

  const loginCount = parseInt(document.getElementById('dailyLoginCount')?.value, 10) || 0;
  const trackTix = parseInt(document.getElementById('trackTicketsInput')?.value, 10) || 0;
  const trackCost = parseFloat(document.getElementById('trackCostInput')?.value) || 0;

  const baseTotalTickets = delivBaseTix + bountyBaseTix + animalBountyBaseTix + choreBaseTix + loginCount + trackTix;
  const rawTotalCost = delivCost + bountyCost + animalBountyCost + choreCost + trackCost;
  const efficiencyRatio = baseTotalTickets > 0 ? (rawTotalCost / baseTotalTickets) : 0;
  const totalVipUnits = delivVipUnits + autoChoreCount;
  const totalTicketsWithVip = baseTotalTickets + (vipBonus > 0 ? (totalVipUnits * 2) : 0);

  const newEntry = {
    chapterId: ACTIVE_CHAPTER_ID,
    chapterTitle: chapterTitle.trim(),
    chapterEndDate: new Date(CHAPTER_END_MS).toISOString(),
    archivedAt: new Date().toISOString(),
    isLocked: isLocked,
    baseTotalTickets: baseTotalTickets,
    totalTickets: totalTicketsWithVip,
    totalCost: rawTotalCost,
    efficiencyRatio: efficiencyRatio,
    vipActive: vipBonus > 0,
    categories: {
      deliveries: { 
        count: masterDeliveries.length, 
        baseTickets: delivBaseTix,
        tickets: delivBaseTix + (vipBonus > 0 ? delivVipUnits * 2 : 0), 
        cost: delivCost,
        doubleCount: delivDoubleCount,
        autoCount: autoDelivCount,
        manualCount: manualDelivCount,
        vipUnits: delivVipUnits
      },
      bounties: { 
        count: bountyCount, 
        baseTickets: bountyBaseTix,
        tickets: bountyBaseTix, 
        cost: bountyCost,
        autoCount: autoBountyCount,
        boostUnits: autoBountyCount
      },
      animalBounties: { 
        count: animalBountyCount, 
        baseTickets: animalBountyBaseTix,
        tickets: animalBountyBaseTix, 
        cost: animalBountyCost,
        autoCount: autoAnimalBountyCount,
        boostUnits: autoAnimalBountyCount
      },
      chores: { 
        count: choreCount, 
        baseTickets: choreBaseTix,
        tickets: choreBaseTix + (vipBonus > 0 ? autoChoreCount * 2 : 0), 
        cost: choreCost,
        autoCount: autoChoreCount,
        manualCount: manualChoreCount,
        vipUnits: autoChoreCount,
        boostUnits: autoChoreCount
      },
      logins: { count: loginCount, tickets: loginCount, cost: 0 },
      tracked: { tickets: trackTix, cost: trackCost }
    },
    weeklySummary
  };

  if (existingIdx >= 0) {
    logs[existingIdx] = newEntry;
  } else {
    logs.unshift(newEntry);
  }

  // 1. Direct Cloud Database Save to user_chapter_logs table
  if (state.currentUser) {
    try {
      const res = await fetch('/api/chapter?action=saveChapterLog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: state.currentUser,
          chapterLog: newEntry
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.chapterLogs)) {
        if (!state.currentVaultData) state.currentVaultData = {};
        state.currentVaultData.chapterLogs = data.chapterLogs;
      }
    } catch (e) {
      console.warn('Cloud chapter logs save notice:', e.message);
    }
  }

  await saveStoredChapterLogs(logs);
  renderChapterLogsList();
  alert(`✔ Successfully archived "${newEntry.chapterTitle}" (~1.2 KB summary) to your cloud vault!`);
}

export async function deleteChapterLog(index) {
  const logs = getStoredChapterLogs();
  if (!logs[index]) return;

  const target = logs[index];
  if (target.isLocked) {
    alert('🔒 This chapter log is locked and archived. It cannot be deleted.');
    return;
  }

  const title = target.chapterTitle || 'this log';
  if (confirm(`🗑️ Delete archived snapshot for "${title}"?`)) {
    // 1. Delete from dedicated user_chapter_logs table
    if (state.currentUser && target.chapterId) {
      try {
        await fetch('/api/chapter?action=deleteChapterLog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: state.currentUser,
            chapterId: target.chapterId
          })
        });
      } catch (e) {
        console.warn('Cloud chapter log delete error:', e.message);
      }
    }

    logs.splice(index, 1);
    await saveStoredChapterLogs(logs);
    renderChapterLogsList();
  }
}

export function exportChapterLog(index) {
  const logs = getStoredChapterLogs();
  if (!logs[index]) return;

  const item = logs[index];
  const cardChapterKey = item.chapterId || `chapter_${index}`;
  const savedBoost = localStorage.getItem(`sfl_chapter_boost_${cardChapterKey}`);
  const boostLevel = savedBoost !== null ? parseInt(savedBoost, 10) : getActiveBoostCount();

  const cats = item.categories || {};
  const deliv = cats.deliveries || {};
  const bounty = cats.bounties || {};
  const animal = cats.animalBounties || {};
  const chore = cats.chores || {};

  const autoDeliv = deliv.autoCount !== undefined ? deliv.autoCount : Math.max(0, (deliv.count || 0) - (deliv.manualCount || 0));
  const doubleDeliv = deliv.doubleCount || 0;
  const autoBounty = bounty.autoCount !== undefined ? bounty.autoCount : (bounty.count || 0);
  const autoAnimal = animal.autoCount !== undefined ? animal.autoCount : (animal.count || 0);
  const autoChore = chore.autoCount !== undefined ? chore.autoCount : Math.max(0, (chore.count || 0) - (chore.manualCount || 0));

  const extraDelivTix = boostLevel * (autoDeliv + doubleDeliv);
  const extraBountyTix = boostLevel * autoBounty;
  const extraAnimalTix = boostLevel * autoAnimal;
  const extraChoreTix = boostLevel * autoChore;
  const extraTotalTix = extraDelivTix + extraBountyTix + extraAnimalTix + extraChoreTix;

  const exportObj = {
    ...item,
    activeBoosts: boostLevel,
    boostedTotalTickets: (item.totalTickets || 0) + extraTotalTix,
    rawTotalTickets: item.totalTickets || 0,
    categoriesWithBoosts: {
      deliveries: { ...deliv, boostedTickets: (deliv.tickets || 0) + extraDelivTix },
      bounties: { ...bounty, boostedTickets: (bounty.tickets || 0) + extraBountyTix },
      animalBounties: { ...animal, boostedTickets: (animal.tickets || 0) + extraAnimalTix },
      chores: { ...chore, boostedTickets: (chore.tickets || 0) + extraChoreTix },
      logins: cats.logins || {},
      tracked: cats.tracked || {}
    }
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `sunforge_${(item.chapterTitle || 'chapter').replace(/\s+/g, '_').toLowerCase()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

