import { 
  state, 
  formatSFL, 
  setElemText, 
  getActiveBoostCount, 
  getActiveVipBonus, 
  getMondayBasedWeekId, 
  isLoginClaimedToday, 
  isAnimalBounty 
} from './state.js';

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
  const localTodayStr = now.toLocaleDateString('en-CA');
  const currentWeekId = getMondayBasedWeekId();

  const rawLogs = (state.globalData.cloudHistory && state.globalData.cloudHistory.logs) || [];
  const weeks = (state.globalData.cloudHistory && state.globalData.cloudHistory.weeks) || {};

  // Track & Login inputs
  const trackTickets = parseInt(document.getElementById('trackTicketsInput')?.value) || (state.globalData.cloudHistory?.trackTickets || 0);
  const trackCost = parseFloat(document.getElementById('trackCostInput')?.value) || (state.globalData.cloudHistory?.trackCost || 0);

  const totalLoginTickets = parseInt(document.getElementById('dailyLoginCount')?.value) || (state.globalData.cloudHistory?.dailyLoginTickets || 0);
  const isDoneLoginToday = isLoginClaimedToday() || !!document.getElementById('dailyLoginCheck')?.checked;
  const todayLoginTickets = isDoneLoginToday ? 1 : 0;

  // Weekly ticket accumulator map for the progression chart
  const weeklyTicketStats = {};

  // Category counters
  let totalDelivTix = 0;
  let totalBountyTix = 0;
  let totalAnimalBountyTix = 0;
  let totalChoreTix = 0;
  let totalSflCostAll = trackCost;

  let weekDelivTix = 0;
  let weekBountyTix = 0;
  let weekAnimalBountyTix = 0;
  let weekChoreTix = 0;
  let weekCostAll = trackCost;

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

  const isWeeklyItemDoneToday = (item) => {
    if (!isTicked(item)) return false;
    if (item.checkedToday === true) return true;
    
    if (item.completedAt) {
      const ts = typeof item.completedAt === 'number' ? item.completedAt : Number(item.completedAt);
      if (!isNaN(ts) && ts > 0) {
        const ms = ts < 1e11 ? ts * 1000 : ts;
        const itemDate = new Date(ms);
        const iso = itemDate.toISOString().split('T')[0];
        const loc = itemDate.toLocaleDateString('en-CA');
        return (iso === todayUtcStr || loc === localTodayStr);
      }
    }
    return false;
  };

  const addWeeklyStat = (wkId, tix, cost) => {
    if (!wkId) wkId = currentWeekId;
    if (!weeklyTicketStats[wkId]) {
      weeklyTicketStats[wkId] = { tickets: 0, cost: 0 };
    }
    weeklyTicketStats[wkId].tickets += tix;
    weeklyTicketStats[wkId].cost += cost;
  };

  // 1. Process Past Daily Deliveries from saved logs
  const seenDates = new Set();
  rawLogs.forEach(log => {
    const rawDate = (log.date || '').split('T')[0];
    if (!rawDate || seenDates.has(rawDate)) return;
    seenDates.add(rawDate);

    const isTodayLog = (rawDate === todayUtcStr || rawDate === localTodayStr);
    if (isTodayLog) return;

    const logWeekId = log.weekId || getMondayBasedWeekId(new Date(rawDate));
    const isThisWeek = logWeekId === currentWeekId || rawDate.slice(0, 4) === now.getFullYear().toString();

    (log.deliveriesDone || []).forEach(item => {
      if (isTicked(item)) {
        const baseTix = item.baseTickets !== undefined ? item.baseTickets : (item.tickets !== undefined ? item.tickets : 2);
        const finalTix = baseTix > 0 ? (baseTix + vipBonus + boostCount) : 0;
        const itemCost = item.cost || 0;

        totalDelivTix += finalTix;
        totalSflCostAll += itemCost;
        addWeeklyStat(logWeekId, finalTix, itemCost);

        if (isThisWeek) {
          weekDelivTix += finalTix;
          weekCostAll += itemCost;
        }
      }
    });
  });

  // 2. Process Today's Live Deliveries (Double Delivery applied to ONLY the 1st completed order of today)
  let doubleDeliveryAppliedToday = false;

  (state.globalData.deliveries || []).forEach(d => {
    if (isTicked(d)) {
      const deliveryAddon = d.isManual ? 0 : (vipBonus + boostCount);
      let calculatedYield = d.baseTickets + deliveryAddon;

      if (isDoubleDeliveryActive && !doubleDeliveryAppliedToday) {
        calculatedYield = calculatedYield * 2;
        doubleDeliveryAppliedToday = true;
        d.hasDoubleBonus = true;
      } else {
        d.hasDoubleBonus = false;
      }

      const dCost = d.itemsCost || 0;

      todayDelivTix += calculatedYield;
      todayCostAll += dCost;

      totalDelivTix += calculatedYield;
      weekDelivTix += calculatedYield;
      totalSflCostAll += dCost;
      weekCostAll += dCost;

      addWeeklyStat(currentWeekId, calculatedYield, dCost);
    }
  });

  // 3. Process CURRENT Week Bounties
  const countedBountyKeys = new Set();
  (state.globalData.bounties || []).forEach(b => {
    const key = b.id ? String(b.id) : `${(b.name || '').toLowerCase()}_${b.level || 0}`;
    countedBountyKeys.add(key);

    if (isTicked(b)) {
      const baseTix = b.baseTickets !== undefined ? b.baseTickets : (b.tickets || 0);
      if (baseTix <= 0) return;

      const finalTix = baseTix + boostCount;
      const bCost = b.cost !== undefined ? b.cost : (b.itemsCost || 0);
      const isAnimal = isAnimalBounty(b);

      if (isAnimal) {
        totalAnimalBountyTix += finalTix;
        weekAnimalBountyTix += finalTix;
      } else {
        totalBountyTix += finalTix;
        weekBountyTix += finalTix;
      }

      totalSflCostAll += bCost;
      weekCostAll += bCost;
      addWeeklyStat(currentWeekId, finalTix, bCost);

      if (isWeeklyItemDoneToday(b)) {
        if (isAnimal) {
          todayAnimalBountyTix += finalTix;
        } else {
          todayBountyTix += finalTix;
        }
        todayCostAll += bCost;
      }
    }
  });

  // 4. Process CURRENT Week Chores (VIP + Boosts)
  const countedChoreKeys = new Set();
  (state.globalData.chores || []).forEach(c => {
    const key = `${(c.npc || '').toLowerCase()}_${(c.task || c.name || '').toLowerCase()}`;
    countedChoreKeys.add(key);

    if (isTicked(c)) {
      const baseTix = c.baseTickets !== undefined ? c.baseTickets : (c.tickets || 1);
      const finalTix = baseTix > 0 ? (baseTix + vipBonus + boostCount) : 0;
      const cCost = c.cost !== undefined ? c.cost : (c.itemsCost || 0);

      totalChoreTix += finalTix;
      weekChoreTix += finalTix;
      totalSflCostAll += cCost;
      weekCostAll += cCost;
      addWeeklyStat(currentWeekId, finalTix, cCost);

      if (isWeeklyItemDoneToday(c)) {
        todayChoreTix += finalTix;
        todayCostAll += cCost;
      }
    }
  });

  // 5. Process PAST Weeks from KV
  Object.entries(weeks).forEach(([wkId, wk]) => {
    if (wkId === currentWeekId) return;

    (wk.bounties || []).forEach(b => {
      const key = b.id ? String(b.id) : `${(b.name || '').toLowerCase()}_${b.level || 0}`;
      if (countedBountyKeys.has(key)) return;

      if (isTicked(b)) {
        countedBountyKeys.add(key);
        const baseTix = b.baseTickets !== undefined ? b.baseTickets : (b.tickets !== undefined ? b.tickets : 0);
        if (baseTix <= 0) return;

        const finalTix = baseTix + boostCount;
        const bCost = b.cost !== undefined ? b.cost : (b.itemsCost || 0);
        const isAnimal = isAnimalBounty(b);

        if (isAnimal) {
          totalAnimalBountyTix += finalTix;
        } else {
          totalBountyTix += finalTix;
        }

        totalSflCostAll += bCost;
        addWeeklyStat(wkId, finalTix, bCost);
      }
    });

    (wk.chores || []).forEach(c => {
      const key = `${(c.npc || '').toLowerCase()}_${(c.task || c.name || '').toLowerCase()}`;
      if (countedChoreKeys.has(key)) return;

      if (isTicked(c)) {
        countedChoreKeys.add(key);
        const baseTix = c.baseTickets !== undefined ? c.baseTickets : (c.tickets !== undefined ? c.tickets : 1);
        const finalTix = baseTix > 0 ? (baseTix + vipBonus + boostCount) : 0;
        const cCost = c.cost !== undefined ? c.cost : (c.itemsCost || 0);

        totalChoreTix += finalTix;
        totalSflCostAll += cCost;
        addWeeklyStat(wkId, finalTix, cCost);
      }
    });
  });

  // Include Track & Login in current week progression
  addWeeklyStat(currentWeekId, trackTickets + totalLoginTickets, trackCost);

  // Totals
  const totalTicketsAll = totalDelivTix + totalBountyTix + totalAnimalBountyTix + totalChoreTix + trackTickets + totalLoginTickets;
  const weekTicketsAll = weekDelivTix + weekBountyTix + weekAnimalBountyTix + weekChoreTix + trackTickets + totalLoginTickets;
  const todayTicketsAll = todayDelivTix + todayBountyTix + todayAnimalBountyTix + todayChoreTix + todayLoginTickets;

  // 6. Overview Cards
  const regularBounties = (state.globalData.bounties || []).filter(b => !isAnimalBounty(b));
  const animalBounties = (state.globalData.bounties || []).filter(b => isAnimalBounty(b));

  setElemText('deliveriesCount', `${state.globalData.deliveries?.length || 0} Orders`);
  setElemText('bountiesCount', `${regularBounties.length} Items`);
  setElemText('animalBountiesCount', `${animalBounties.length} Animals`);
  setElemText('choresCount', `${state.globalData.chores?.length || 0} Tasks`);

  // 7. Stats
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
  setElemText('tipWeekTrack', `🛤️ Track: ${trackTickets} Tix (${formatSFL(trackCost)} SFL)`);
  setElemText('tipWeekLogin', `🎁 Daily Login: ${totalLoginTickets} Tix`);

  setElemText('tipTodayDeliv', `📦 Deliveries: ${todayDelivTix} Tix`);
  setElemText('tipTodayBounty', `📜 Bounties: ${todayBountyTix} Tix`);
  setElemText('tipTodayAnimalBounty', `🐄 Animal Bounties: ${todayAnimalBountyTix} Tix`);
  setElemText('tipTodayChore', `🧹 Chores: ${todayChoreTix} Tix`);
  setElemText('tipTodayLogin', `🎁 Daily Login: ${todayLoginTickets} Tix`);

  // Goal Calculator
  const targetGoal = parseInt(document.getElementById('targetGoalInput')?.value) || 1000;
  const targetWeeks = parseInt(document.getElementById('targetWeeksInput')?.value) || 12;
  const remainingNeeded = Math.max(0, targetGoal - totalTicketsAll);
  const targetPerWeek = targetWeeks > 0 ? Math.ceil(remainingNeeded / targetWeeks) : 0;

  setElemText('statGoalRemaining', `${remainingNeeded} Tickets`);
  setElemText('statGoalPerWeek', `${targetPerWeek} Tickets / Wk`);

  // 8. Render Weekly Progression Chart
  renderWeeklyChart(weeklyTicketStats, currentWeekId, targetPerWeek, targetWeeks);
}

function renderWeeklyChart(weeklyStats, currentWeekId, targetPacePerWeek, totalPlannedWeeks) {
  const chartContainer = document.getElementById('weeklyChartContainer');
  const badgeEl = document.getElementById('chartSummaryBadge');
  if (!chartContainer) return;

  const sortedWeekKeys = Object.keys(weeklyStats).sort();
  const maxWeeksToDisplay = Math.max(totalPlannedWeeks || 12, sortedWeekKeys.length, 12);

  // Normalize sequential week display (Week 1 .. Week N)
  const displayItems = [];
  for (let i = 1; i <= maxWeeksToDisplay; i++) {
    const matchedKey = sortedWeekKeys[i - 1];
    const data = matchedKey ? weeklyStats[matchedKey] : null;
    const isCurrent = matchedKey === currentWeekId || (!matchedKey && i === sortedWeekKeys.length + 1);

    displayItems.push({
      label: `Week ${i}`,
      weekId: matchedKey || `Upcoming`,
      tickets: data ? data.tickets : 0,
      cost: data ? data.cost : 0,
      isCurrent,
      hasData: Boolean(data)
    });
  }

  const recordedCount = sortedWeekKeys.length;
  if (badgeEl) {
    badgeEl.textContent = `${recordedCount} OF ${maxWeeksToDisplay} WEEKS RECORDED`;
  }

  // SVG Dimension Calculations
  const barWidth = 48;
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

  // Grid lines
  const gridCount = 4;
  let gridLinesSvg = '';
  for (let i = 0; i <= gridCount; i++) {
    const val = Math.round((yMax / gridCount) * i);
    const yPos = topPadding + plotHeight - (val / yMax) * plotHeight;
    gridLinesSvg += `
      <line x1="${leftPadding}" y1="${yPos}" x2="${chartWidth - rightPadding}" y2="${yPos}" stroke="#E0D5C1" stroke-dasharray="3,3" stroke-width="1.5" />
      <text x="${leftPadding - 8}" y="${yPos + 4}" font-size="11" font-weight="bold" fill="#8C7853" text-anchor="end">${val}</text>
    `;
  }

  // Target Pace Line
  let targetLineSvg = '';
  if (targetPacePerWeek > 0) {
    const targetY = topPadding + plotHeight - (targetPacePerWeek / yMax) * plotHeight;
    targetLineSvg = `
      <line x1="${leftPadding}" y1="${targetY}" x2="${chartWidth - rightPadding}" y2="${targetY}" stroke="#9E9E9E" stroke-dasharray="5,5" stroke-width="2" />
      <text x="${chartWidth - rightPadding + 6}" y="${targetY + 4}" font-size="10" font-weight="900" fill="#757575">Pace: ${targetPacePerWeek}</text>
    `;
  }

  // Bars rendering
  let barsSvg = '';
  displayItems.forEach((item, idx) => {
    const xPos = leftPadding + (idx * (barWidth + barGap)) + (barGap / 2);
    const barHeight = Math.max(3, (item.tickets / yMax) * plotHeight);
    const yPos = topPadding + plotHeight - barHeight;

    let barFill = item.hasData ? '#4CAF50' : '#EFEBE9';
    let strokeColor = item.hasData ? '#2E7D32' : '#BCAAA4';

    if (item.isCurrent) {
      barFill = '#D2691E';
      strokeColor = '#8B4513';
    }

    const tixLabel = item.tickets > 0 ? `${item.tickets}` : '0';
    const costText = item.cost > 0 ? `${formatSFL(item.cost)} SFL` : '';

    barsSvg += `
      <g class="chart-bar-group" style="cursor: pointer;">
        <rect x="${xPos}" y="${yPos}" width="${barWidth}" height="${barHeight}" rx="6" fill="${barFill}" stroke="${strokeColor}" stroke-width="2">
          <title>${item.label} (${item.weekId})\n🎟️ ${item.tickets} Tickets\n💰 ${item.cost > 0 ? formatSFL(item.cost) + ' SFL' : '0.00 SFL'}</title>
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
