import { state, formatSFL, setElemText, getActiveBoostCount, getActiveVipBonus, getMondayBasedWeekId } from './state.js';

export function recalculateAll() {
  if (!state.globalData) return;

  const vipBonus = getActiveVipBonus();
  const boostCount = getActiveBoostCount();

  const now = new Date();
  const todayDateStr = now.toISOString().split('T')[0];
  const localTodayStr = now.toLocaleDateString('en-CA');
  const currentWeekId = getMondayBasedWeekId();

  const logs = (state.globalData.cloudHistory && state.globalData.cloudHistory.logs) || [];
  const weeks = (state.globalData.cloudHistory && state.globalData.cloudHistory.weeks) || {};

  // Track Tickets & Costs
  const trackTickets = parseInt(document.getElementById('trackTicketsInput')?.value) || (state.globalData.cloudHistory?.trackTickets || 0);
  const trackCost = parseFloat(document.getElementById('trackCostInput')?.value) || (state.globalData.cloudHistory?.trackCost || 0);

  // Category trackers for metrics and hover tooltips
  let totalDelivTix = 0;
  let totalBountyTix = 0;
  let totalChoreTix = 0;
  let totalSflCostAll = trackCost;

  let weekDelivTix = 0;
  let weekBountyTix = 0;
  let weekChoreTix = 0;
  let weekCostAll = trackCost;

  let todayDelivTix = 0;
  let todayBountyTix = 0;
  let todayChoreTix = 0;
  let todayCostAll = 0;

  // Robust function to check if a task was completed today
  const isDoneToday = (item, category) => {
    if (!item || (!item.completed && !item.checked)) return false;

    // 1. If timestamp is provided by SFL API (handles both seconds and milliseconds)
    if (item.completedAt) {
      const ts = typeof item.completedAt === 'number' ? item.completedAt : Number(item.completedAt);
      if (!isNaN(ts) && ts > 0) {
        const ms = ts < 1e11 ? ts * 1000 : ts; // Convert seconds to ms if needed
        const itemDate = new Date(ms);
        const iso = itemDate.toISOString().split('T')[0];
        const loc = itemDate.toLocaleDateString('en-CA');
        return (iso === todayDateStr || loc === localTodayStr);
      }
    }

    // 2. Fallback if SFL API sent no timestamp: Check if this was already logged on a prior day
    const prevLogs = logs.filter(l => l.date && l.date !== todayDateStr && l.date !== localTodayStr && l.weekId === currentWeekId);
    const wasDoneInPrevLog = prevLogs.some(l => {
      const list = category === 'bounty' ? (l.bountiesDone || []) : (l.choresDone || l.deliveriesDone || []);
      return list.some(past => {
        const pastName = (typeof past === 'string' ? past : (past.name || past.npc || past.task || '')).toLowerCase().trim();
        const curName = (item.name || item.task || item.npc || item.from || '').toLowerCase().trim();
        return pastName === curName && (past.completed || past.checked);
      });
    });

    // If it was already completed in a previous day's log, it's not today's
    if (wasDoneInPrevLog) return false;

    // Otherwise, it was completed today during this week!
    return true;
  };

  // 1. Process Historical Daily Deliveries across logs
  logs.forEach(log => {
    const isThisWeek = log.weekId === currentWeekId || (log.date && log.date.slice(0, 4) === now.getFullYear().toString());
    const isToday = log.date === todayDateStr || log.date === localTodayStr;

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

  // 2. Process Past Weeks (Historical Bounties & Chores)
  Object.entries(weeks).forEach(([wkId, wk]) => {
    if (wkId === currentWeekId) return; // Current week is processed live below

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
        const cCost = c.cost !== undefined ? c.cost : (c.itemsCost || 0);

        totalChoreTix += finalTix;
        totalSflCostAll += cCost;
      }
    });
  });

  // 3. Process Current Week Bounties & Chores (Merge Live API Data with any custom saved overrides)
  const currentWeekBounties = (state.globalData.bounties || []).map(liveB => {
    const saved = (weeks[currentWeekId]?.bounties || []).find(sb => (sb.name || '').toLowerCase() === (liveB.name || '').toLowerCase());
    return {
      ...liveB,
      checked: saved?.checked !== undefined ? saved.checked : liveB.completed,
      cost: saved?.cost !== undefined ? saved.cost : liveB.itemsCost,
      tickets: saved?.tickets !== undefined ? saved.tickets : liveB.baseTickets
    };
  });

  const currentWeekChores = (state.globalData.chores || []).map(liveC => {
    const saved = (weeks[currentWeekId]?.chores || []).find(sc => (sc.task || sc.name || '').toLowerCase() === (liveC.task || liveC.name || '').toLowerCase());
    return {
      ...liveC,
      checked: saved?.checked !== undefined ? saved.checked : liveC.completed,
      cost: saved?.cost !== undefined ? saved.cost : (liveC.itemsCost || 0),
      tickets: saved?.tickets !== undefined ? saved.tickets : liveC.baseTickets
    };
  });

  // Calculate Current Week Bounties (Total, Week, Today)
  currentWeekBounties.forEach(b => {
    const isTicked = b.checked !== undefined ? b.checked : !!b.completed;
    if (isTicked) {
      const baseTix = b.tickets !== undefined ? b.tickets : (b.baseTickets || 1);
      const finalTix = baseTix > 0 ? (baseTix + boostCount) : 0;
      const bCost = b.cost !== undefined ? b.cost : (b.itemsCost || 0);

      totalBountyTix += finalTix;
      totalSflCostAll += bCost;

      weekBountyTix += finalTix;
      weekCostAll += bCost;

      if (isDoneToday(b, 'bounty')) {
        todayBountyTix += finalTix;
        todayCostAll += bCost;
      }
    }
  });

  // Calculate Current Week Chores (Total, Week, Today)
  currentWeekChores.forEach(c => {
    const isTicked = c.checked !== undefined ? c.checked : !!c.completed;
    if (isTicked) {
      const baseTix = c.tickets !== undefined ? c.tickets : (c.baseTickets || 1);
      const finalTix = baseTix > 0 ? (baseTix + boostCount) : 0;
      const cCost = c.cost !== undefined ? c.cost : (c.itemsCost || 0);

      totalChoreTix += finalTix;
      weekChoreTix += finalTix;
      totalSflCostAll += cCost;
      weekCostAll += cCost;

      if (isDoneToday(c, 'chore')) {
        todayChoreTix += finalTix;
        todayCostAll += cCost;
      }
    }
  });

  // 4. Process Live Active Deliveries for Today
  const sortedDeliveries = [...(state.globalData.deliveries || [])].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));

  sortedDeliveries.forEach(d => {
    if (d.completed && todayDelivTix === 0) {
      if (isDoneToday(d, 'delivery')) {
        const deliveryAddon = d.isManual ? 0 : (vipBonus + boostCount);
        todayDelivTix += (d.baseTickets + deliveryAddon);
        todayCostAll += (d.itemsCost || 0);
      }
    }
  });

  const totalTicketsAll = totalDelivTix + totalBountyTix + totalChoreTix + trackTickets;
  const weekTicketsAll = weekDelivTix + weekBountyTix + weekChoreTix + trackTickets;
  const todayTicketsAll = todayDelivTix + todayBountyTix + todayChoreTix;

  // 5. Render 4 Column Cards in DOM
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

  // 6. Update Metrics & Tooltip Values
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
  setElemText('tipTotalTrack', `🛤️ Track: ${trackTickets} Tix (${formatSFL(trackCost)} SFL)`);

  setElemText('tipWeekDeliv', `📦 Deliveries: ${weekDelivTix} Tix`);
  setElemText('tipWeekBounty', `📜 Bounties: ${weekBountyTix} Tix`);
  setElemText('tipWeekChore', `🧹 Chores: ${weekChoreTix} Tix`);
  setElemText('tipWeekTrack', `🛤️ Track: ${trackTickets} Tix (${formatSFL(trackCost)} SFL)`);

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
