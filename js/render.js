import { 
  state, 
  formatSFL, 
  setElemText, 
  getActiveBoostCount, 
  getActiveVipBonus, 
  getMondayBasedWeekId, 
  isAnimalBounty 
} from './state.js';

// Resolve exact Monday-based Week ID from an item's completion timestamp, weekId, or date
function getItemWeekMonday(item, fallbackMonday) {
  if (item?.completedAt) {
    const ts = typeof item.completedAt === 'number' ? item.completedAt : Number(item.completedAt);
    if (!isNaN(ts) && ts > 0) {
      const ms = ts < 1e11 ? ts * 1000 : ts;
      return getMondayBasedWeekId(new Date(ms));
    }
  }
  if (item?.weekId) {
    return getMondayBasedWeekId(item.weekId);
  }
  if (item?.date) {
    return getMondayBasedWeekId(item.date);
  }
  return getMondayBasedWeekId(fallbackMonday || new Date());
}

export function recalculateAll() {
  if (!state.globalData) return;

  const vipBonus = getActiveVipBonus();
  const boostCount = getActiveBoostCount();
  const isDoubleDeliveryActive = Boolean(state.globalData.isDoubleDeliveryActive);

  // Toggle Double Delivery Banner UI
  const dblBanner = document.getElementById('doubleDeliveryBanner');
  if (dblBanner) {
    dblBanner.style.display = isDoubleDeliveryActive ? 'flex' : 'none';
  }

  const now = new Date();
  const todayUtcStr = now.toISOString().split('T')[0];
  const currentWeekMonday = getMondayBasedWeekId(todayUtcStr);

  const rawLogs = (state.globalData.cloudHistory && state.globalData.cloudHistory.logs) || [];
  const rawWeeks = (state.globalData.cloudHistory && state.globalData.cloudHistory.weeks) || {};

  // Normalize historical weeks (merges "2026-W32" -> "2026-08-10")
  const mergedWeeks = {};
  Object.entries(rawWeeks).forEach(([wkId, wkObj]) => {
    const normKey = getMondayBasedWeekId(wkId);
    if (!mergedWeeks[normKey]) {
      mergedWeeks[normKey] = { bounties: [], chores: [] };
    }
    if (Array.isArray(wkObj.bounties)) mergedWeeks[normKey].bounties.push(...wkObj.bounties);
    if (Array.isArray(wkObj.chores)) mergedWeeks[normKey].chores.push(...wkObj.chores);
  });

  // Track & Login inputs strictly for TOTAL counter
  const trackTickets = parseInt(document.getElementById('trackTicketsInput')?.value) || (state.globalData.cloudHistory?.trackTickets || 0);
  const trackCost = parseFloat(document.getElementById('trackCostInput')?.value) || (state.globalData.cloudHistory?.trackCost || 0);
  const totalLoginTickets = parseInt(document.getElementById('dailyLoginCount')?.value) || (state.globalData.cloudHistory?.dailyLoginTickets || 0);

  // Weekly ticket accumulator map (strictly grouped by Monday UTC dates - NO track/login tickets)
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

  // Category counters
  let totalDelivTix = 0;
  let totalBountyTix = 0;
  let totalAnimalBountyTix = 0;
  let totalChoreTix = 0;
  let totalSflCostAll = trackCost; // Track cost only in total

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

  const isItemDoneToday = (item) => {
    if (!isTicked(item)) return false;
    if (item.checkedToday === true) return true;
    const ms = getItemTimestamp(item);
    if (ms) {
      return new Date(ms).toISOString().split('T')[0] === todayUtcStr;
    }
    return false;
  };

  // 1. Process Deliveries (Deduplicate across logs & live data)
  const seenDeliveryKeys = new Set();
  let doubleDeliveryAppliedToday = false;

  // Process live delivery board first
  (state.globalData.deliveries || []).forEach(d => {
    const key = d.id ? String(d.id) : `${(d.name || d.from || '').toLowerCase()}_${d.completedAt || 0}`;
    seenDeliveryKeys.add(key);

    if (isTicked(d)) {
      const deliveryAddon = d.isManual ? 0 : (vipBonus + boostCount);
      let calculatedYield = d.baseTickets + deliveryAddon;

      // Determine exact week this delivery belongs to
      const deliveryMonday = getItemWeekMonday(d, todayUtcStr);
      const isCurrentWeek = (deliveryMonday === currentWeekMonday);

      if (isDoubleDeliveryActive && !doubleDeliveryAppliedToday && isItemDoneToday(d)) {
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

      if (isItemDoneToday(d)) {
        todayDelivTix += calculatedYield;
        todayCostAll += dCost;
      }

      addWeeklyStat(deliveryMonday, calculatedYield, dCost);
    }
  });

  // Process historical logs deliveries
  rawLogs.forEach(log => {
    const logDate = (log.date || '').split('T')[0];
    (log.deliveriesDone || []).forEach(item => {
      const key = item.id ? String(item.id) : `${(item.name || item.from || '').toLowerCase()}_${item.completedAt || 0}`;
      if (seenDeliveryKeys.has(key)) return;
      seenDeliveryKeys.add(key);

      if (isTicked(item)) {
        const baseTix = item.baseTickets !== undefined ? item.baseTickets : (item.tickets !== undefined ? item.tickets : 2);
        const finalTix = baseTix > 0 ? (baseTix + vipBonus + boostCount) : 0;
        const itemCost = item.cost || item.itemsCost || 0;

        const deliveryMonday = getItemWeekMonday(item, logDate);
        const isCurrentWeek = (deliveryMonday === currentWeekMonday);

        totalDelivTix += finalTix;
        totalSflCostAll += itemCost;

        if (isCurrentWeek) {
          weekDelivTix += finalTix;
          weekCostAll += itemCost;
        }

        if (isItemDoneToday(item) || logDate === todayUtcStr) {
          todayDelivTix += finalTix;
          todayCostAll += itemCost;
        }

        addWeeklyStat(deliveryMonday, finalTix, itemCost);
      }
    });
  });

  // 2. Process Bounties (Deduplicate across live board, mergedWeeks, and logs)
  const seenBountyKeys = new Set();

  // Process live board bounties
  (state.globalData.bounties || []).forEach(b => {
    const key = b.id ? String(b.id) : `${(b.name || '').toLowerCase()}_${b.level || 0}`;
    seenBountyKeys.add(key);

    if (isTicked(b)) {
      const baseTix = b.baseTickets !== undefined ? b.baseTickets : (b.tickets || 0);
      if (baseTix <= 0) return;

      const finalTix = baseTix + boostCount;
      const bCost = b.cost !== undefined ? b.cost : (b.itemsCost || 0);
      const isAnimal = isAnimalBounty(b);

      const bountyMonday = getItemWeekMonday(b, b.weekId || currentWeekMonday);
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

      if (isItemDoneToday(b)) {
        if (isAnimal) {
          todayAnimalBountyTix += finalTix;
        } else {
          todayBountyTix += finalTix;
        }
        todayCostAll += bCost;
      }

      addWeeklyStat(bountyMonday, finalTix, bCost);
    }
  });

  // Process historical merged weeks bounties
  Object.entries(mergedWeeks).forEach(([wkMonday, wk]) => {
    (wk.bounties || []).forEach(b => {
      const key = b.id ? String(b.id) : `${(b.name || '').toLowerCase()}_${b.level || 0}`;
      if (seenBountyKeys.has(key)) return;
      seenBountyKeys.add(key);

      if (isTicked(b)) {
        const baseTix = b.baseTickets !== undefined ? b.baseTickets : (b.tickets !== undefined ? b.tickets : 0);
        if (baseTix <= 0) return;

        const finalTix = baseTix + boostCount;
        const bCost = b.cost !== undefined ? b.cost : (b.itemsCost || 0);
        const isAnimal = isAnimalBounty(b);

        const bountyMonday = getItemWeekMonday(b, wkMonday);
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

        addWeeklyStat(bountyMonday, finalTix, bCost);
      }
    });
  });

  // Process legacy bounties from logs
  rawLogs.forEach(log => {
    if (!Array.isArray(log.bountiesDone)) return;
    const logMonday = getMondayBasedWeekId(log.date || log.weekId);

    log.bountiesDone.forEach(b => {
      const key = b.id ? String(b.id) : `${(b.name || '').toLowerCase()}_${b.level || 0}`;
      if (seenBountyKeys.has(key)) return;
      seenBountyKeys.add(key);

      if (isTicked(b)) {
        const baseTix = b.baseTickets !== undefined ? b.baseTickets : (b.tickets || 0);
        if (baseTix <= 0) return;

        const finalTix = baseTix + boostCount;
        const bCost = b.cost || b.itemsCost || 0;
        const isAnimal = isAnimalBounty(b);

        const bountyMonday = getItemWeekMonday(b, logMonday);
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

        addWeeklyStat(bountyMonday, finalTix, bCost);
      }
    });
  });

  // 3. Process Chores (Deduplicate across live board, mergedWeeks, and logs)
  const seenChoreKeys = new Set();

  // Process live board chores
  (state.globalData.chores || []).forEach(c => {
    const key = `${(c.npc || '').toLowerCase()}_${(c.task || c.name || '').toLowerCase()}`;
    seenChoreKeys.add(key);

    if (isTicked(c)) {
      const baseTix = c.baseTickets !== undefined ? c.baseTickets : (c.tickets || 1);
      const finalTix = baseTix > 0 ? (baseTix + vipBonus + boostCount) : 0;
      const cCost = c.cost !== undefined ? c.cost : (c.itemsCost || 0);

      const choreMonday = getItemWeekMonday(c, c.weekId || currentWeekMonday);
      const isCurrentWeek = (choreMonday === currentWeekMonday);

      totalChoreTix += finalTix;
      if (isCurrentWeek) weekChoreTix += finalTix;

      totalSflCostAll += cCost;
      if (isCurrentWeek) weekCostAll += cCost;

      if (isItemDoneToday(c)) {
        todayChoreTix += finalTix;
        todayCostAll += cCost;
      }

      addWeeklyStat(choreMonday, finalTix, cCost);
    }
  });

  // Process historical merged weeks chores
  Object.entries(mergedWeeks).forEach(([wkMonday, wk]) => {
    (wk.chores || []).forEach(c => {
      const key = `${(c.npc || '').toLowerCase()}_${(c.task || c.name || '').toLowerCase()}`;
      if (seenChoreKeys.has(key)) return;
      seenChoreKeys.add(key);

      if (isTicked(c)) {
        const baseTix = c.baseTickets !== undefined ? c.baseTickets : (c.tickets !== undefined ? c.tickets : 1);
        const finalTix = baseTix > 0 ? (baseTix + vipBonus + boostCount) : 0;
        const cCost = c.cost !== undefined ? c.cost : (c.itemsCost || 0);

        const choreMonday = getItemWeekMonday(c, wkMonday);
        const isCurrentWeek = (choreMonday === currentWeekMonday);

        totalChoreTix += finalTix;
        if (isCurrentWeek) weekChoreTix += finalTix;

        totalSflCostAll += cCost;
        if (isCurrentWeek) weekCostAll += cCost;

        addWeeklyStat(choreMonday, finalTix, cCost);
      }
    });
  });

  // Process legacy chores from logs
  rawLogs.forEach(log => {
    if (!Array.isArray(log.choresDone)) return;
    const logMonday = getMondayBasedWeekId(log.date || log.weekId);

    log.choresDone.forEach(c => {
      const key = `${(c.npc || '').toLowerCase()}_${(c.task || c.name || '').toLowerCase()}`;
      if (seenChoreKeys.has(key)) return;
      seenChoreKeys.add(key);

      if (isTicked(c)) {
        const baseTix = c.baseTickets !== undefined ? c.baseTickets : (c.tickets || 1);
        const finalTix = baseTix > 0 ? (baseTix + vipBonus + boostCount) : 0;
        const cCost = c.cost || c.itemsCost || 0;

        const choreMonday = getItemWeekMonday(c, logMonday);
        const isCurrentWeek = (choreMonday === currentWeekMonday);

        totalChoreTix += finalTix;
        if (isCurrentWeek) weekChoreTix += finalTix;

        totalSflCostAll += cCost;
        if (isCurrentWeek) weekCostAll += cCost;

        addWeeklyStat(choreMonday, finalTix, cCost);
      }
    });
  });

  // Totals: Track & Daily Login tickets are ONLY in Total Counter
  const totalTicketsAll = totalDelivTix + totalBountyTix + totalAnimalBountyTix + totalChoreTix + trackTickets + totalLoginTickets;
  const weekTicketsAll = weekDelivTix + weekBountyTix + weekAnimalBountyTix + weekChoreTix;
  const todayTicketsAll = todayDelivTix + todayBountyTix + todayAnimalBountyTix + todayChoreTix;

  // Overview Cards
  const regularBounties = (state.globalData.bounties || []).filter(b => !isAnimalBounty(b));
  const animalBounties = (state.globalData.bounties || []).filter(b => isAnimalBounty(b));

  setElemText('deliveriesCount', `${state.globalData.deliveries?.length || 0} Orders`);
  setElemText('bountiesCount', `${regularBounties.length} Items`);
  setElemText('animalBountiesCount', `${animalBounties.length} Animals`);
  setElemText('choresCount', `${state.globalData.chores?.length || 0} Tasks`);

  // Stats Counters
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

  // Tooltips
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

  // Goal Calculator
  const targetGoal = parseInt(document.getElementById('targetGoalInput')?.value) || 1000;
  const targetWeeks = parseInt(document.getElementById('targetWeeksInput')?.value) || 12;
  const remainingNeeded = Math.max(0, targetGoal - totalTicketsAll);
  const targetPerWeek = targetWeeks > 0 ? Math.ceil(remainingNeeded / targetWeeks) : 0;

  setElemText('statGoalRemaining', `${remainingNeeded} Tickets`);
  setElemText('statGoalPerWeek', `${targetPerWeek} Tickets / Wk`);

  // Render Weekly Progression Chart (Clean Gameplay Only)
  renderWeeklyChart(weeklyTicketStats, currentWeekMonday, targetPerWeek, targetWeeks);
}

function renderWeeklyChart(weeklyStats, currentMondayKey, targetPacePerWeek, totalPlannedWeeks) {
  const chartContainer = document.getElementById('weeklyChartContainer');
  const badgeEl = document.getElementById('chartSummaryBadge');
  if (!chartContainer) return;

  // Normalize and strictly sort all Mondays
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
