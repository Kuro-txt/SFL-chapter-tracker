import { state, formatSFL, setElemText, getActiveBoostCount, getActiveVipBonus, getMondayBasedWeekId } from './state.js';

export function recalculateAll() {
  if (!state.globalData) return;

  const vipBonus = getActiveVipBonus();
  const boostCount = getActiveBoostCount();

  const todayDateStr = new Date().toISOString().split('T')[0];
  const currentWeekId = getMondayBasedWeekId();
  const logs = (state.globalData.cloudHistory && state.globalData.cloudHistory.logs) || [];
  const weeks = (state.globalData.cloudHistory && state.globalData.cloudHistory.weeks) || {};

  // Category trackers for hover tooltips
  let totalDelivTix = 0;
  let totalBountyTix = 0;
  let totalChoreTix = 0;
  let totalSflCostAll = 0;

  let weekDelivTix = 0;
  let weekBountyTix = 0;
  let weekChoreTix = 0;
  let weekCostAll = 0;

  let todayDelivTix = 0;
  let todayBountyTix = 0;
  let todayChoreTix = 0;
  let todayCostAll = 0;

  // 1. Process Historical Daily Deliveries across logs
  logs.forEach(log => {
    const isThisWeek = log.weekId === currentWeekId || (log.date && log.date.slice(0, 4) === new Date().getFullYear().toString());
    const isToday = log.date === todayDateStr;

    (log.deliveriesDone || []).forEach(item => {
      const isTicked = item.checked !== undefined ? item.checked : !!item.completed;
      if (isTicked) {
        const baseTix = item.tickets || 2;
        const finalTix = baseTix > 0 ? (baseTix + vipBonus + boostCount) : 0;
        const itemCost = item.cost || 0;

        totalDelivTix += finalTix;
        totalSflCostAll += itemCost;

        if (isThisWeek) {
          weekDelivTix += finalTix;
          weekCostAll += itemCost;
        }
        if (isToday) {
          todayDelivTix += finalTix;
          todayCostAll += itemCost;
        }
      }
    });
  });

  // 2. Process Weekly Bounties and Chores
  const activeWeeklyBounties = (weeks[currentWeekId]?.bounties?.length) 
    ? weeks[currentWeekId].bounties 
    : (state.globalData.bounties || []);

  const activeWeeklyChores = (weeks[currentWeekId]?.chores?.length) 
    ? weeks[currentWeekId].chores 
    : (state.globalData.chores || []);

  // Past weeks accumulation
  Object.entries(weeks).forEach(([wkId, wk]) => {
    if (wkId === currentWeekId) return;

    (wk.bounties || []).forEach(b => {
      const isTicked = b.checked !== undefined ? b.checked : !!b.completed;
      if (isTicked) {
        const baseTix = b.tickets !== undefined ? b.tickets : (b.baseTickets || 1);
        const finalTix = baseTix > 0 ? (baseTix + boostCount) : 0;
        const bCost = b.cost !== undefined ? b.cost : (b.itemsCost || 0);

        totalBountyTix += finalTix;
        totalSflCostAll += bCost;
      }
    });

    (wk.chores || []).forEach(c => {
      const isTicked = c.checked !== undefined ? c.checked : !!c.completed;
      if (isTicked) {
        const baseTix = c.tickets !== undefined ? c.tickets : (c.baseTickets || 1);
        const finalTix = baseTix > 0 ? (baseTix + boostCount) : 0;

        totalChoreTix += finalTix;
      }
    });
  });

  // Current Week Bounties
  activeWeeklyBounties.forEach(b => {
    const isTicked = b.checked !== undefined ? b.checked : !!b.completed;
    if (isTicked) {
      const baseTix = b.tickets !== undefined ? b.tickets : (b.baseTickets || 1);
      const finalTix = baseTix > 0 ? (baseTix + boostCount) : 0;
      const bCost = b.cost !== undefined ? b.cost : (b.itemsCost || 0);

      totalBountyTix += finalTix;
      totalSflCostAll += bCost;

      weekBountyTix += finalTix;
      weekCostAll += bCost;

      // Check if completed today via timestamp
      const isDoneToday = b.completedAt 
        ? (new Date(b.completedAt).toISOString().split('T')[0] === todayDateStr)
        : false;

      if (isDoneToday) {
        todayBountyTix += finalTix;
        todayCostAll += bCost;
      }
    }
  });

  // Current Week Chores
  activeWeeklyChores.forEach(c => {
    const isTicked = c.checked !== undefined ? c.checked : !!c.completed;
    if (isTicked) {
      const baseTix = c.tickets !== undefined ? c.tickets : (c.baseTickets || 1);
      const finalTix = baseTix > 0 ? (baseTix + boostCount) : 0;

      totalChoreTix += finalTix;
      weekChoreTix += finalTix;

      // Check if completed today via timestamp
      const isDoneToday = c.completedAt 
        ? (new Date(c.completedAt).toISOString().split('T')[0] === todayDateStr)
        : false;

      if (isDoneToday) {
        todayChoreTix += finalTix;
      }
    }
  });

  // 3. Live Active Deliveries (check for live today progress)
  const sortedDeliveries = [...(state.globalData.deliveries || [])].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));

  sortedDeliveries.forEach(d => {
    if (d.completed) {
      const isDoneToday = d.completedAt 
        ? (new Date(d.completedAt).toISOString().split('T')[0] === todayDateStr) 
        : true;

      if (isDoneToday && todayDelivTix === 0) {
        const deliveryAddon = d.isManual ? 0 : (vipBonus + boostCount);
        todayDelivTix += (d.baseTickets + deliveryAddon);
        todayCostAll += (d.itemsCost || 0);
      }
    }
  });

  const totalTicketsAll = totalDelivTix + totalBountyTix + totalChoreTix;
  const weekTicketsAll = weekDelivTix + weekBountyTix + weekChoreTix;
  const todayTicketsAll = todayDelivTix + todayBountyTix + todayChoreTix;

  // 4. Render 4 Columns in DOM
  const allBounties = state.globalData.bounties || [];
  const regularBountiesRaw = [];
  const animalBountiesRaw = [];

  allBounties.forEach(b => {
    const n = (b.name || '').toLowerCase();
    if (n.includes('chicken') || n.includes('cow') || n.includes('sheep')) {
      animalBountiesRaw.push(b);
    } else {
      regularBountiesRaw.push(b);
    }
  });

  const sortedBounties = [...regularBountiesRaw].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
  const sortedAnimalBounties = [...animalBountiesRaw].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
  const sortedChores = [...(state.globalData.chores || [])].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));

  // Render Deliveries
  const deliveriesContainer = document.getElementById('deliveriesList');
  if (deliveriesContainer && state.globalData.deliveries) {
    setElemText('deliveriesCount', state.globalData.deliveries.length);
    deliveriesContainer.innerHTML = sortedDeliveries.map(d => {
      const deliveryAddon = d.isManual ? 0 : (vipBonus + boostCount);
      const finalTickets = d.baseTickets + deliveryAddon;
      const totalSflCost = d.itemsCost || 0;
      const costPerTicket = finalTickets > 0 ? (totalSflCost / finalTickets) : 0;
      const badgeClass = d.isManual ? 'badge badge-manual' : (d.completed ? 'badge badge-done' : 'badge badge-active');

      const itemRows = (d.itemDetails || []).map(detail => `
        <div style="display:flex; justify-content:space-between; font-size:11px;">
          <span>• ${detail.qty}x <strong style="color:#3E2723;">${detail.name}</strong> ${detail.isRecipe ? '<span class="badge badge-recipe">RECIPE</span>' : ''}</span>
          <span style="color:#8C7853; font-weight:bold;">${detail.lineCost > 0 ? formatSFL(detail.lineCost) + ' SFL' : '0.00'}</span>
        </div>`).join('');

      return `<div class="card-item ${d.isManual ? 'manual' : (d.completed ? 'done' : 'active')}">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:900; color:#8B4513; font-size:12px;">👤 ${d.from.toUpperCase()} ${d.isChapterNpc ? '👑' : ''}</span>
          <span class="${badgeClass}">${d.completed ? '✨ DONE' : '⏳ ACTIVE'}</span>
        </div>
        <div style="background:#FFFACD; padding:8px; border-radius:6px; border:1px solid #D2B48C; display:flex; flex-direction:column; gap:4px;">${itemRows}</div>
        <div style="background:#FFFACD; padding:8px; border-radius:6px; border:1px solid #D2B48C; display:flex; flex-direction:column; gap:4px; font-size:11px;">
          <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #D2B48C; padding-bottom:4px;">
            <span style="color:#B26A00; font-weight:900;">Yield: ${finalTickets} Tickets</span>
            <span style="color:#3E2723; font-weight:900;">${formatSFL(totalSflCost)} SFL</span>
          </div>
          <div style="display:flex; justify-content:space-between; color:#2E7D32; font-weight:900;">
            <span>Cost / Ticket:</span>
            <span>${formatSFL(costPerTicket)} SFL</span>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // Render Regular Bounties
  const bountiesContainer = document.getElementById('bountiesList');
  if (bountiesContainer) {
    setElemText('bountiesCount', sortedBounties.length);
    bountiesContainer.innerHTML = sortedBounties.length === 0 
      ? '<p style="color:#8C7853; font-size:12px; font-weight:bold;">No active item bounties right now.</p>'
      : sortedBounties.map(b => {
        const finalTickets = b.baseTickets + boostCount;
        const totalSflCost = b.itemsCost || 0;
        const costPerTicket = finalTickets > 0 ? (totalSflCost / finalTickets) : 0;
        const badgeClass = b.completed ? 'badge badge-done' : 'badge badge-active';

        return `<div class="card-item ${b.completed ? 'done' : 'active'}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:900; color:#3E2723; text-transform:capitalize;">📜 ${b.name.toUpperCase()} ${b.level ? '(Lvl ' + b.level + ')' : ''}</span>
            <span class="${badgeClass}">${b.completed ? '✨ DONE' : '⏳ ACTIVE'}</span>
          </div>
          <div style="background:#FFFACD; padding:8px; border-radius:6px; border:1px solid #D2B48C; display:flex; flex-direction:column; gap:4px; font-size:11px;">
            <div style="display:flex; justify-content:space-between; color:#5C4033; font-weight:bold;">
              <span>Yield: ${finalTickets} Tickets</span>
              <span>Cost: ${formatSFL(totalSflCost)} SFL</span>
            </div>
            <div style="display:flex; justify-content:space-between; color:#2E7D32; font-weight:900;">
              <span>Cost / Ticket:</span>
              <span>${formatSFL(costPerTicket)} SFL</span>
            </div>
          </div>
        </div>`;
      }).join('');
  }

  // Render Animal Bounties
  const animalBountiesContainer = document.getElementById('animalBountiesList');
  if (animalBountiesContainer) {
    setElemText('animalBountiesCount', sortedAnimalBounties.length);
    animalBountiesContainer.innerHTML = sortedAnimalBounties.length === 0
      ? '<p style="color:#8C7853; font-size:12px; font-weight:bold;">No active animal bounties right now.</p>'
      : sortedAnimalBounties.map(b => {
        const finalTickets = b.baseTickets + boostCount;
        const totalSflCost = b.itemsCost || 0;
        const costPerTicket = finalTickets > 0 ? (totalSflCost / finalTickets) : 0;
        const badgeClass = b.completed ? 'badge badge-done' : 'badge badge-active';

        return `<div class="card-item ${b.completed ? 'done' : 'active'}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:900; color:#3E2723; text-transform:capitalize;">🐄 ${b.name.toUpperCase()} ${b.level ? '(Lvl ' + b.level + ')' : ''}</span>
            <span class="${badgeClass}">${b.completed ? '✨ DONE' : '⏳ ACTIVE'}</span>
          </div>
          <div style="background:#FFFACD; padding:8px; border-radius:6px; border:1px solid #D2B48C; display:flex; flex-direction:column; gap:4px; font-size:11px;">
            <div style="display:flex; justify-content:space-between; color:#5C4033; font-weight:bold;">
              <span>Yield: ${finalTickets} Tickets</span>
              <span>Cost: ${formatSFL(totalSflCost)} SFL</span>
            </div>
            <div style="display:flex; justify-content:space-between; color:#2E7D32; font-weight:900;">
              <span>Cost / Ticket:</span>
              <span>${formatSFL(costPerTicket)} SFL</span>
            </div>
          </div>
        </div>`;
      }).join('');
  }

  // Render Chores
  const choresContainer = document.getElementById('choresList');
  if (choresContainer && state.globalData.chores) {
    setElemText('choresCount', state.globalData.chores.length);
    choresContainer.innerHTML = sortedChores.map(c => {
      const finalTickets = c.baseTickets > 0 ? (c.baseTickets + boostCount) : 0;
      const hasProgress = c.requirement > 0;
      const badgeClass = c.completed ? 'badge badge-done' : 'badge badge-active';

      return `<div class="card-item ${c.completed ? 'done' : 'active'}">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:900; color:#3E2723; text-transform:capitalize;">🧹 ${c.npc.toUpperCase()}</span>
          <span class="${badgeClass}">${c.completed ? '✨ DONE' : '⏳ ACTIVE'}</span>
        </div>
        <div style="color:#5C4033; font-weight:bold;">${c.task}</div>
        ${hasProgress ? `<div style="font-size:11px; color:#8C7853; font-weight:bold;">Progress: ${c.progress} / ${c.requirement}</div>` : ''}
        ${c.baseTickets > 0 ? `<div style="background:#FFFACD; padding:6px 8px; border-radius:6px; border:1px solid #D2B48C; display:flex; justify-content:space-between; align-items:center; font-size:11px;"><span style="color:#8C7853; font-weight:bold;">Yield:</span><span style="color:#2E7D32; font-weight:900;">${finalTickets} Tickets</span></div>` : ''}
      </div>`;
    }).join('');
  }

  // 5. Update Key Performance Metrics & Breakdowns
  setElemText('statTotalTickets', `${totalTicketsAll} Tickets`);
  setElemText('statTotalCost', `${formatSFL(totalSflCostAll)} SFL`);
  setElemText('statTotalRatio', `${totalTicketsAll > 0 ? formatSFL(totalSflCostAll / totalTicketsAll) : "0.00"} SFL / Ticket`);

  setElemText('statWeekTickets', `${weekTicketsAll} Tickets`);
  setElemText('statWeekCost', `${formatSFL(weekCostAll)} SFL`);
  setElemText('statWeekRatio', `${weekTicketsAll > 0 ? formatSFL(weekCostAll / weekTicketsAll) : "0.00"} SFL / Ticket`);

  setElemText('statEarnedTickets', `${todayTicketsAll} Tickets`);
  setElemText('statEarnedCost', `${formatSFL(todayCostAll)} SFL`);
  const todayRatioVal = todayTicketsAll > 0 ? (todayCostAll / todayTicketsAll) : 0;
  setElemText('statEarnedRatio', `${formatSFL(todayRatioVal)} SFL / Ticket`);

  // Update Hover Tooltips Breakdowns
  setElemText('tipTotalDeliv', `📦 Deliveries: ${totalDelivTix} Tix`);
  setElemText('tipTotalBounty', `📜 Bounties: ${totalBountyTix} Tix`);
  setElemText('tipTotalChore', `🧹 Chores: ${totalChoreTix} Tix`);

  setElemText('tipWeekDeliv', `📦 Deliveries: ${weekDelivTix} Tix`);
  setElemText('tipWeekBounty', `📜 Bounties: ${weekBountyTix} Tix`);
  setElemText('tipWeekChore', `🧹 Chores: ${weekChoreTix} Tix`);

  setElemText('tipTodayDeliv', `📦 Deliveries: ${todayDelivTix} Tix`);
  setElemText('tipTodayBounty', `📜 Bounties: ${todayBountyTix} Tix`);
  setElemText('tipTodayChore', `🧹 Chores: ${todayChoreTix} Tix`);

  // Target Goal Calculator
  const targetGoal = parseInt(document.getElementById('targetGoalInput').value) || 1000;
  const targetWeeks = parseInt(document.getElementById('targetWeeksInput').value) || 12;
  const remainingNeeded = Math.max(0, targetGoal - totalTicketsAll);
  const targetPerWeek = targetWeeks > 0 ? Math.ceil(remainingNeeded / targetWeeks) : 0;

  setElemText('statGoalRemaining', `${remainingNeeded} Tickets`);
  setElemText('statGoalPerWeek', `${targetPerWeek} Tickets / Wk`);
}
