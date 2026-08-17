import { 
  state, 
  formatSFL, 
  setElemText, 
  getActiveBoostCount, 
  getActiveVipBonus, 
  getMondayBasedWeekId, 
  isAnimalBounty 
} from './state.js';

// ==========================================
// 1. Render Dashboard Column Cards
// ==========================================
export function renderDashboardCards() {
  if (!state.globalData) return;

  const vipBonus = getActiveVipBonus();
  const boostCount = getActiveBoostCount();
  const isDoubleDeliveryActive = Boolean(state.globalData.isDoubleDeliveryActive);

  // 1. Deliveries Column
  const delivContainer = document.getElementById('deliveriesList') || document.getElementById('deliveriesContainer');
  if (delivContainer) {
    const deliveries = state.globalData.deliveries || [];
    if (deliveries.length === 0) {
      delivContainer.innerHTML = '<div style="color:#8C7853; text-align:center; padding:20px; font-weight:bold;">No active deliveries found.</div>';
    } else {
      let html = '';
      let doubleApplied = false;

      deliveries.forEach((d, idx) => {
        const isDone = d.checked !== undefined ? d.checked : d.completed;
        const addon = d.isManual ? 0 : (vipBonus + boostCount);
        let tix = (d.baseTickets || 2) + addon;

        if (isDoubleDeliveryActive && !doubleApplied && isDone) {
          tix = tix * 2;
          doubleApplied = true;
        }

        const itemsSummary = (d.itemDetails && d.itemDetails.length > 0)
          ? d.itemDetails.map(it => `${it.qty}x ${it.name}`).join(', ')
          : (d.items && typeof d.items === 'object' ? Object.entries(d.items).map(([k, v]) => `${v}x ${k}`).join(', ') : '');

        html += `
          <div class="tracker-card ${isDone ? 'completed-card' : ''}" style="background: ${isDone ? '#E8F5E9' : '#FAF8F5'}; border: 2px solid ${isDone ? '#4CAF50' : '#E0D5C1'}; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display:flex; align-items:center; gap:10px; flex:1;">
              <input type="checkbox" ${isDone ? 'checked' : ''} style="transform: scale(1.3); cursor: pointer;" onchange="window.toggleMainDeliveryCheck(${idx}, this.checked)">
              <div>
                <div style="font-weight: 900; color: #5C4033; font-size: 14px;">${d.from || d.name}</div>
                ${itemsSummary ? `<div style="font-size: 11px; color: #8C7853;">${itemsSummary}</div>` : ''}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 900; color: #E65100; font-size: 14px;">${tix} Tix</div>
              <div style="font-size: 12px; color: #8C7853; font-weight: bold;">${formatSFL(d.itemsCost || d.cost || 0)} SFL</div>
            </div>
          </div>
        `;
      });
      delivContainer.innerHTML = html;
    }
  }

  // 2. Item Bounties Column
  const bountiesContainer = document.getElementById('bountiesList') || document.getElementById('bountiesContainer');
  if (bountiesContainer) {
    const regularBounties = (state.globalData.bounties || []).filter(b => !isAnimalBounty(b));
    if (regularBounties.length === 0) {
      bountiesContainer.innerHTML = '<div style="color:#8C7853; text-align:center; padding:20px; font-weight:bold;">No item bounties found.</div>';
    } else {
      let html = '';
      regularBounties.forEach((b) => {
        const globalIdx = (state.globalData.bounties || []).indexOf(b);
        const isDone = b.checked !== undefined ? b.checked : b.completed;
        const tix = (b.baseTickets || b.tickets || 1) + boostCount;

        html += `
          <div class="tracker-card ${isDone ? 'completed-card' : ''}" style="background: ${isDone ? '#E8F5E9' : '#FAF8F5'}; border: 2px solid ${isDone ? '#4CAF50' : '#E0D5C1'}; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display:flex; align-items:center; gap:10px; flex:1;">
              <input type="checkbox" ${isDone ? 'checked' : ''} style="transform: scale(1.3); cursor: pointer;" onchange="window.toggleMainBountyCheck(${globalIdx}, this.checked)">
              <div style="font-weight: 900; color: #5C4033; font-size: 14px;">${b.name}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 900; color: #E65100; font-size: 14px;">${tix} Tix</div>
              <div style="font-size: 12px; color: #8C7853; font-weight: bold;">${formatSFL(b.itemsCost || b.cost || 0)} SFL</div>
            </div>
          </div>
        `;
      });
      bountiesContainer.innerHTML = html;
    }
  }

  // 3. Animal Bounties Column
  const animalContainer = document.getElementById('animalBountiesList') || document.getElementById('animalBountiesContainer');
  if (animalContainer) {
    const animalBounties = (state.globalData.bounties || []).filter(b => isAnimalBounty(b));
    if (animalBounties.length === 0) {
      animalContainer.innerHTML = '<div style="color:#8C7853; text-align:center; padding:20px; font-weight:bold;">No animal bounties found.</div>';
    } else {
      let html = '';
      animalBounties.forEach((b) => {
        const globalIdx = (state.globalData.bounties || []).indexOf(b);
        const isDone = b.checked !== undefined ? b.checked : b.completed;
        const tix = (b.baseTickets || b.tickets || 2) + boostCount;

        html += `
          <div class="tracker-card ${isDone ? 'completed-card' : ''}" style="background: ${isDone ? '#E8F5E9' : '#FAF8F5'}; border: 2px solid ${isDone ? '#4CAF50' : '#E0D5C1'}; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display:flex; align-items:center; gap:10px; flex:1;">
              <input type="checkbox" ${isDone ? 'checked' : ''} style="transform: scale(1.3); cursor: pointer;" onchange="window.toggleMainBountyCheck(${globalIdx}, this.checked)">
              <div>
                <div style="font-weight: 900; color: #5C4033; font-size: 14px;">${b.name}</div>
                ${b.level ? `<div style="font-size: 11px; color: #8C7853; font-weight: bold;">Level ${b.level}</div>` : ''}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 900; color: #E65100; font-size: 14px;">${tix} Tix</div>
              <div style="font-size: 12px; color: #8C7853; font-weight: bold;">${formatSFL(b.itemsCost || b.cost || 0)} SFL</div>
            </div>
          </div>
        `;
      });
      animalContainer.innerHTML = html;
    }
  }

  // 4. Chores Column
  const choresContainer = document.getElementById('choresList') || document.getElementById('choresContainer');
  if (choresContainer) {
    const chores = state.globalData.chores || [];
    if (chores.length === 0) {
      choresContainer.innerHTML = '<div style="color:#8C7853; text-align:center; padding:20px; font-weight:bold;">No weekly chores found.</div>';
    } else {
      let html = '';
      chores.forEach((c, idx) => {
        const isDone = c.checked !== undefined ? c.checked : c.completed;
        const tix = (c.baseTickets || c.tickets || 1) + vipBonus + boostCount;

        html += `
          <div class="tracker-card ${isDone ? 'completed-card' : ''}" style="background: ${isDone ? '#E8F5E9' : '#FAF8F5'}; border: 2px solid ${isDone ? '#4CAF50' : '#E0D5C1'}; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display:flex; align-items:center; gap:10px; flex:1;">
              <input type="checkbox" ${isDone ? 'checked' : ''} style="transform: scale(1.3); cursor: pointer;" onchange="window.toggleMainChoreCheck(${idx}, this.checked)">
              <div>
                <div style="font-weight: 900; color: #5C4033; font-size: 13px;">${c.task || c.name}</div>
                <div style="font-size: 11px; color: #8C7853;">NPC: ${c.npc || 'NPC'}</div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 900; color: #E65100; font-size: 14px;">${tix} Tix</div>
              <div style="font-size: 12px; color: #8C7853; font-weight: bold;">FREE</div>
            </div>
          </div>
        `;
      });
      choresContainer.innerHTML = html;
    }
  }
}

// ==========================================
// 2. Recalculate Stats, Counters & Weekly Chart
// ==========================================
export function recalculateAll() {
  if (!state.globalData) return;

  const vipBonus = getActiveVipBonus();
  const boostCount = getActiveBoostCount();
  const isDoubleDeliveryActive = Boolean(state.globalData.isDoubleDeliveryActive);

  if (document.getElementById('doubleDeliveryBanner')) {
    document.getElementById('doubleDeliveryBanner').style.display = isDoubleDeliveryActive ? 'flex' : 'none';
  }

  const week2StartMs = new Date('2026-08-17T00:00:00.000Z').getTime();
  const now = new Date();
  const todayUtcStr = now.toISOString().split('T')[0];
  const currentWeekMonday = getMondayBasedWeekId(todayUtcStr);

  const vault = state.globalData.cloudHistory || state.currentVaultData || {};
  const rawLogs = vault.logs || [];
  const rawWeeks = vault.weeks || {};

  const trackTickets = parseInt(document.getElementById('trackTicketsInput')?.value, 10) || (vault.trackTickets || 0);
  const trackCost = parseFloat(document.getElementById('trackCostInput')?.value) || (vault.trackCost || 0);
  const totalLoginTickets = parseInt(document.getElementById('dailyLoginCount')?.value, 10) || (vault.dailyLoginTickets || 0);

  const weeklyTicketStats = {};
  const addWeeklyStat = (mondayKey, tix, cost) => {
    if (!mondayKey) mondayKey = currentWeekMonday;
    const normMonday = getMondayBasedWeekId(mondayKey);
    if (!weeklyTicketStats[normMonday]) {
      weeklyTicketStats[normMonday] = { tickets: 0, cost: 0 };
    }
    weeklyTicketStats[normMonday].tickets += tix;
    weeklyTicketStats[normMonday].cost += cost;
  };

  let totalDelivTix = 0;
  let totalBountyTix = 0;
  let totalAnimalBountyTix = 0;
  let totalChoreTix = 0;
  let totalSflCostAll = trackCost;

  let weekDelivTix = 0;
  let weekBountyTix = 0;
  let weekAnimalBountyTix = 0;
  let weekChoreTix = 0;
  let weekCostAll = 0;

  let todayDelivTix = 0;
  let todayBountyTix = 0;
  let todayAnimalBountyTix = 0;
  let todayChoreTix = 0;
  let todayCostAll = 0;

  const isTicked = (item) => {
    if (!item) return false;
    if (item.checked !== undefined) return Boolean(item.checked);
    return Boolean(item.completed);
  };

  const getItemTimestamp = (item) => {
    if (!item?.completedAt) return null;
    const ts = typeof item.completedAt === 'number' ? item.completedAt : Number(item.completedAt);
    if (isNaN(ts) || ts <= 0) return null;
    return ts < 1e11 ? ts * 1000 : ts;
  };

  // 1. Process Deliveries
  const seenDeliveryKeys = new Set();
  let doubleDeliveryAppliedToday = false;

  (state.globalData.deliveries || []).forEach(d => {
    const key = d.id ? String(d.id) : `${(d.name || d.from || '').toLowerCase()}_${d.completedAt || 0}`;
    seenDeliveryKeys.add(key);

    if (isTicked(d)) {
      const deliveryAddon = d.isManual ? 0 : (vipBonus + boostCount);
      let calculatedYield = (d.baseTickets || 2) + deliveryAddon;

      const itemMs = getItemTimestamp(d);
      const deliveryMonday = (itemMs && itemMs < week2StartMs) ? '2026-08-10' : getMondayBasedWeekId(todayUtcStr);
      const isCurrentWeek = (deliveryMonday === currentWeekMonday);
      const isToday = itemMs ? (new Date(itemMs).toISOString().split('T')[0] === todayUtcStr) : (d.checkedToday === true);

      if (isDoubleDeliveryActive && !doubleDeliveryAppliedToday && isToday) {
        calculatedYield = calculatedYield * 2;
        doubleDeliveryAppliedToday = true;
        d.hasDoubleBonus = true;
      } else {
        d.hasDoubleBonus = false;
      }

      const dCost = d.itemsCost || d.cost || 0;

      totalDelivTix += calculatedYield;
      totalSflCostAll += dCost;

      if (isCurrentWeek) {
        weekDelivTix += calculatedYield;
        weekCostAll += dCost;
      }

      if (isToday) {
        todayDelivTix += calculatedYield;
        todayCostAll += dCost;
      }

      addWeeklyStat(deliveryMonday, calculatedYield, dCost);
    }
  });

  rawLogs.forEach(log => {
    const logDate = (log.date || '').split('T')[0];
    const logMs = new Date(`${logDate}T00:00:00.000Z`).getTime();
    const logMonday = (logMs < week2StartMs) ? '2026-08-10' : getMondayBasedWeekId(logDate);
    const isThisWeek = (logMonday === currentWeekMonday);
    const isToday = (logDate === todayUtcStr);

    (log.deliveriesDone || []).forEach(item => {
      const key = item.id ? String(item.id) : `${(item.name || item.from || '').toLowerCase()}_${item.completedAt || 0}`;
      if (seenDeliveryKeys.has(key)) return;
      seenDeliveryKeys.add(key);

      if (isTicked(item)) {
        const baseTix = item.baseTickets !== undefined ? item.baseTickets : (item.tickets !== undefined ? item.tickets : 2);
        const finalTix = baseTix > 0 ? (baseTix + vipBonus + boostCount) : 0;
        const itemCost = item.cost || item.itemsCost || 0;

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

        addWeeklyStat(logMonday, finalTix, itemCost);
      }
    });
  });

  // 2. Process Bounties
  const seenBountyKeys = new Set();
  (state.globalData.bounties || []).forEach(b => {
    const key = b.id ? String(b.id) : `${(b.name || '').toLowerCase()}_${b.level || 0}`;
    seenBountyKeys.add(key);

    if (isTicked(b)) {
      const baseTix = b.baseTickets !== undefined ? b.baseTickets : (b.tickets || 0);
      if (baseTix <= 0) return;

      const finalTix = baseTix + boostCount;
      const bCost = b.cost !== undefined ? b.cost : (b.itemsCost || 0);
      const isAnimal = isAnimalBounty(b);
      const itemMs = getItemTimestamp(b);

      const bountyMonday = (itemMs && itemMs < week2StartMs) ? '2026-08-10' : currentWeekMonday;
      const isCurrentWeek = (bountyMonday === currentWeekMonday);

      if (isAnimal) {
        totalAnimalBountyTix += finalTix;
        if (isCurrentWeek) weekAnimalBountyTix += finalTix;
      } else {
        totalBountyTix += finalTix;
        if (isCurrentWeek) weekBountyTix += finalTix;
      }

      totalSflCostAll += bCost;
      if (isCurrentWeek) weekCostAll += bCost;

      const isToday = itemMs ? (new Date(itemMs).toISOString().split('T')[0] === todayUtcStr) : (b.checkedToday === true);
      if (isToday) {
        if (isAnimal) todayAnimalBountyTix += finalTix;
        else todayBountyTix += finalTix;
        todayCostAll += bCost;
      }

      addWeeklyStat(bountyMonday, finalTix, bCost);
    }
  });

  Object.entries(rawWeeks).forEach(([wkKey, wkObj]) => {
    const isWk1 = (wkKey === '2026-W32' || wkKey === '2026-08-10');
    const wkMonday = isWk1 ? '2026-08-10' : getMondayBasedWeekId(wkKey);
    const isCurrentWeek = (wkMonday === currentWeekMonday);

    (wkObj.bounties || []).forEach(b => {
      const key = b.id ? String(b.id) : `${(b.name || '').toLowerCase()}_${b.level || 0}`;
      if (seenBountyKeys.has(key)) return;
      seenBountyKeys.add(key);

      if (isTicked(b)) {
        const baseTix = b.baseTickets !== undefined ? b.baseTickets : (b.tickets !== undefined ? b.tickets : 0);
        if (baseTix <= 0) return;

        const finalTix = baseTix + boostCount;
        const bCost = b.cost !== undefined ? b.cost : (b.itemsCost || 0);
        const isAnimal = isAnimalBounty(b);

        if (isAnimal) {
          totalAnimalBountyTix += finalTix;
          if (isCurrentWeek) weekAnimalBountyTix += finalTix;
        } else {
          totalBountyTix += finalTix;
          if (isCurrentWeek) weekBountyTix += finalTix;
        }

        totalSflCostAll += bCost;
        if (isCurrentWeek) weekCostAll += bCost;
        addWeeklyStat(wkMonday, finalTix, bCost);
      }
    });
  });

  // 3. Process Chores
  const seenChoreKeys = new Set();
  (state.globalData.chores || []).forEach(c => {
    const key = `${(c.npc || '').toLowerCase()}_${(c.task || c.name || '').toLowerCase()}`;
    seenChoreKeys.add(key);

    if (isTicked(c)) {
      const baseTix = c.baseTickets !== undefined ? c.baseTickets : (c.tickets || 1);
      const finalTix = baseTix > 0 ? (baseTix + vipBonus + boostCount) : 0;
      const cCost = c.cost !== undefined ? c.cost : (c.itemsCost || 0);
      const itemMs = getItemTimestamp(c);

      const choreMonday = (itemMs && itemMs < week2StartMs) ? '2026-08-10' : currentWeekMonday;
      const isCurrentWeek = (choreMonday === currentWeekMonday);

      totalChoreTix += finalTix;
      if (isCurrentWeek) weekChoreTix += finalTix;

      totalSflCostAll += cCost;
      if (isCurrentWeek) weekCostAll += cCost;

      const isToday = itemMs ? (new Date(itemMs).toISOString().split('T')[0] === todayUtcStr) : (c.checkedToday === true);
      if (isToday) {
        todayChoreTix += finalTix;
        todayCostAll += cCost;
      }

      addWeeklyStat(choreMonday, finalTix, cCost);
    }
  });

  Object.entries(rawWeeks).forEach(([wkKey, wkObj]) => {
    const isWk1 = (wkKey === '2026-W32' || wkKey === '2026-08-10');
    const wkMonday = isWk1 ? '2026-08-10' : getMondayBasedWeekId(wkKey);
    const isCurrentWeek = (wkMonday === currentWeekMonday);

    (wkObj.chores || []).forEach(c => {
      const key = `${(c.npc || '').toLowerCase()}_${(c.task || c.name || '').toLowerCase()}`;
      if (seenChoreKeys.has(key)) return;
      seenChoreKeys.add(key);

      if (isTicked(c)) {
        const baseTix = c.baseTickets !== undefined ? c.baseTickets : (c.tickets !== undefined ? c.tickets : 1);
        const finalTix = baseTix > 0 ? (baseTix + vipBonus + boostCount) : 0;
        const cCost = c.cost !== undefined ? c.cost : (c.itemsCost || 0);

        totalChoreTix += finalTix;
        if (isCurrentWeek) weekChoreTix += finalTix;

        totalSflCostAll += cCost;
        if (isCurrentWeek) weekCostAll += cCost;
        addWeeklyStat(wkMonday, finalTix, cCost);
      }
    });
  });

  const totalTicketsAll = totalDelivTix + totalBountyTix + totalAnimalBountyTix + totalChoreTix + trackTickets + totalLoginTickets;
  const weekTicketsAll = weekDelivTix + weekBountyTix + weekAnimalBountyTix + weekChoreTix;
  const todayTicketsAll = todayDelivTix + todayBountyTix + todayAnimalBountyTix + todayChoreTix;

  const regularBounties = (state.globalData.bounties || []).filter(b => !isAnimalBounty(b));
  const animalBounties = (state.globalData.bounties || []).filter(b => isAnimalBounty(b));

  setElemText('deliveriesCount', `${state.globalData.deliveries?.length || 0} Orders`);
  setElemText('bountiesCount', `${regularBounties.length} Items`);
  setElemText('animalBountiesCount', `${animalBounties.length} Animals`);
  setElemText('choresCount', `${state.globalData.chores?.length || 0} Tasks`);

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

  setElemText('tipTotalDeliv', `📦 Deliveries: ${totalDelivTix} Tix`);
  setElemText('tipTotalBounty', `📜 Bounties: ${totalBountyTix} Tix`);
  setElemText('tipTotalAnimalBounty', `🐄 Animal Bounties: ${totalAnimalBountyTix} Tix`);
  setElemText('tipTotalChore', `🧹 Chores: ${totalChoreTix} Tix`);
  setElemText('tipTotalTrack', `🛤️ Track: ${trackTickets} Tix (${formatSFL(trackCost)} SFL)`);
  setElemText('tipTotalLogin', `🎁 Daily Login: ${totalLoginTickets} Tix`);

  setElemText('tipWeekDeliv', `📦 Deliveries: ${weekDelivTix} Tix`);
  setElemText('tipWeekBounty', `📜 Bounties: ${weekBountyTix} Tix`);
  setElemText('tipWeekAnimalBounty', `🐄 Animal Bounties: ${weekAnimalBountyTix} Tix`);
  setElemText('tipWeekChore', `🧹 Chores: ${weekChoreTix} Tix`);

  setElemText('tipTodayDeliv', `📦 Deliveries: ${todayDelivTix} Tix`);
  setElemText('tipTodayBounty', `📜 Bounties: ${todayBountyTix} Tix`);
  setElemText('tipTodayAnimalBounty', `🐄 Animal Bounties: ${todayAnimalBountyTix} Tix`);
  setElemText('tipTodayChore', `🧹 Chores: ${todayChoreTix} Tix`);

  const targetGoal = parseInt(document.getElementById('targetGoalInput')?.value, 10) || 1000;
  const targetWeeks = parseInt(document.getElementById('targetWeeksInput')?.value, 10) || 12;
  const remainingNeeded = Math.max(0, targetGoal - totalTicketsAll);
  const targetPerWeek = targetWeeks > 0 ? Math.ceil(remainingNeeded / targetWeeks) : 0;

  setElemText('statGoalRemaining', `${remainingNeeded} Tickets`);
  setElemText('statGoalPerWeek', `${targetPerWeek} Tickets / Wk`);

  renderDashboardCards();
  renderWeeklyChart(weeklyTicketStats, currentWeekMonday, targetPerWeek, targetWeeks);
}

function renderWeeklyChart(weeklyStats, currentMondayKey, targetPacePerWeek, totalPlannedWeeks) {
  const chartContainer = document.getElementById('weeklyChartContainer');
  const badgeEl = document.getElementById('chartSummaryBadge');
  if (!chartContainer) return;

  const recordedMondays = Array.from(new Set(Object.keys(weeklyStats).map(k => getMondayBasedWeekId(k)))).sort();
  if (!recordedMondays.includes(currentMondayKey)) {
    recordedMondays.push(currentMondayKey);
    recordedMondays.sort();
  }

  const maxWeeksToDisplay = Math.max(totalPlannedWeeks || 12, recordedMondays.length, 12);
  const displayItems = [];
  for (let i = 1; i <= maxWeeksToDisplay; i++) {
    const mondayKey = recordedMondays[i - 1];
    const isCurrent = (mondayKey === currentMondayKey);
    const data = mondayKey ? weeklyStats[mondayKey] : null;

    displayItems.push({
      label: `Week ${i}`,
      mondayKey: mondayKey || `Upcoming`,
      tickets: data ? data.tickets : 0,
      cost: data ? data.cost : 0,
      isCurrent,
      hasData: Boolean(data && data.tickets > 0)
    });
  }

  if (badgeEl) {
    const currentWeekIndex = recordedMondays.indexOf(currentMondayKey) + 1;
    badgeEl.textContent = `WEEK ${currentWeekIndex || 2} OF ${maxWeeksToDisplay} WEEKS (UTC)`;
  }

  const barWidth = 52;
  const barGap = 24;
  const leftPadding = 50;
  const rightPadding = 40;
  const topPadding = 40;
  const bottomPadding = 50;

  const chartHeight = 260;
  const plotHeight = chartHeight - topPadding - bottomPadding;
  const chartWidth = leftPadding + (displayItems.length * (barWidth + barGap)) + rightPadding;

  const maxRecordedTickets = Math.max(...displayItems.map(d => d.tickets), targetPacePerWeek, 50);
  const yMax = Math.ceil((maxRecordedTickets * 1.25) / 20) * 20;

  let gridLinesSvg = '';
  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const val = Math.round((yMax / gridCount) * i);
    const yPos = topPadding + plotHeight - (val / yMax) * plotHeight;
    gridLinesSvg += `
      <line x1="${leftPadding}" y1="${yPos}" x2="${chartWidth - rightPadding}" y2="${yPos}" stroke="#E0D5C1" stroke-dasharray="3,3" stroke-width="1.5" />
      <text x="${leftPadding - 8}" y="${yPos + 4}" font-size="11" font-weight="bold" fill="#8C7853" text-anchor="end">${val}</text>
    `;
  }

  let targetLineSvg = '';
  if (targetPacePerWeek > 0) {
    const targetY = topPadding + plotHeight - (targetPacePerWeek / yMax) * plotHeight;
    targetLineSvg += `
      <line x1="${leftPadding}" y1="${targetY}" x2="${chartWidth - rightPadding}" y2="${targetY}" stroke="#9E9E9E" stroke-dasharray="5,5" stroke-width="2" />
      <text x="${chartWidth - rightPadding + 6}" y="${targetY + 4}" font-size="10" font-weight="900" fill="#757575">Pace: ${targetPacePerWeek}</text>
    `;
  }

  let barsSvg = '';
  displayItems.forEach((item, idx) => {
    const xPos = leftPadding + (idx * (barWidth + barGap)) + (barGap / 2);
    const barHeight = Math.max(4, (item.tickets / yMax) * plotHeight);
    const yPos = topPadding + plotHeight - barHeight;

    let barFill = item.hasData ? '#4CAF50' : '#EFEBE9';
    let strokeColor = item.hasData ? '#2E7D32' : '#BCAAA4';

    if (item.isCurrent) {
      barFill = item.hasData ? '#D2691E' : '#FFE0B2';
      strokeColor = '#8B4513';
    }

    const tixLabel = item.tickets > 0 ? `${item.tickets}` : '0';
    const costText = item.cost > 0 ? `${formatSFL(item.cost)} SFL` : '';

    barsSvg += `
      <g class="chart-bar-group" style="cursor: pointer;">
        <rect x="${xPos}" y="${yPos}" width="${barWidth}" height="${barHeight}" rx="6" fill="${barFill}" stroke="${strokeColor}" stroke-width="2">
          <title>${item.label} (${item.mondayKey} UTC)\n🎟️ ${item.tickets} Tickets\n💰 ${item.cost > 0 ? formatSFL(item.cost) + ' SFL' : '0.00 SFL'}</title>
        </rect>
        <text x="${xPos + (barWidth / 2)}" y="${yPos - 8}" font-size="12" font-weight="900" fill="${strokeColor}" text-anchor="middle">${tixLabel}</text>
        <text x="${xPos + (barWidth / 2)}" y="${topPadding + plotHeight + 20}" font-size="11" font-weight="900" fill="#5C4033" text-anchor="middle">${item.label}</text>
        ${costText ? `<text x="${xPos + (barWidth / 2)}" y="${topPadding + plotHeight + 34}" font-size="9" font-weight="bold" fill="#8C7853" text-anchor="middle">${costText}</text>` : ''}
      </g>
    `;
  });

  chartContainer.innerHTML = `
    <svg viewBox="0 0 ${chartWidth} ${chartHeight}" style="min-width: 100%; width: ${chartWidth}px; height: ${chartHeight}px; display: block; font-family: inherit;">
      ${gridLinesSvg}
      ${targetLineSvg}
      ${barsSvg}
    </svg>
  `;
}

// Window Checkbox Toggles for Dashboard Cards
window.toggleMainDeliveryCheck = function(index, isChecked) {
  if (!state.globalData?.deliveries?.[index]) return;
  state.globalData.deliveries[index].checked = isChecked;
  state.globalData.deliveries[index].completed = isChecked;
  state.globalData.deliveries[index].completedAt = isChecked ? Date.now() : null;
  state.globalData.deliveries[index].checkedToday = isChecked;
  recalculateAll();
  import('./api.js').then(m => m.saveProgressToCloudKV(true));
};

window.toggleMainBountyCheck = function(index, isChecked) {
  if (!state.globalData?.bounties?.[index]) return;
  state.globalData.bounties[index].checked = isChecked;
  state.globalData.bounties[index].completed = isChecked;
  state.globalData.bounties[index].completedAt = isChecked ? Date.now() : null;
  state.globalData.bounties[index].checkedToday = isChecked;
  recalculateAll();
  import('./api.js').then(m => m.saveProgressToCloudKV(true));
};

window.toggleMainChoreCheck = function(index, isChecked) {
  if (!state.globalData?.chores?.[index]) return;
  state.globalData.chores[index].checked = isChecked;
  state.globalData.chores[index].completed = isChecked;
  state.globalData.chores[index].completedAt = isChecked ? Date.now() : null;
  state.globalData.chores[index].checkedToday = isChecked;
  recalculateAll();
  import('./api.js').then(m => m.saveProgressToCloudKV(true));
};
