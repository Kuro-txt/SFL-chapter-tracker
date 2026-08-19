import { 
  state, 
  formatSFL, 
  setElemText, 
  getActiveBoostCount, 
  getActiveVipBonus, 
  getMondayBasedWeekId, 
  isAnimalBounty,
  getDeduplicatedDeliveries 
} from './state.js';

export function recalculateAll() {
  if (!state.globalData) return;

  const vipBonus = getActiveVipBonus();
  const boostCount = getActiveBoostCount();
  const isDoubleDeliveryActive = Boolean(state.globalData.isDoubleDeliveryActive);

  const dblBanner = document.getElementById('doubleDeliveryBanner');
  if (dblBanner) {
    dblBanner.style.display = isDoubleDeliveryActive ? 'flex' : 'none';
  }

  const now = new Date();
  const todayUtcStr = now.toISOString().split('T')[0];
  const currentWeekMonday = getMondayBasedWeekId(now);

  const rawWeeks = (state.globalData.cloudHistory && state.globalData.cloudHistory.weeks) || {};

  const weeks = {};
  Object.entries(rawWeeks).forEach(([wkKey, wkVal]) => {
    const normalizedId = getMondayBasedWeekId(wkVal.weekId || wkKey);
    if (!weeks[normalizedId]) {
      weeks[normalizedId] = { weekId: normalizedId, bounties: [], chores: [] };
    }
    if (Array.isArray(wkVal.bounties)) {
      wkVal.bounties.forEach(b => {
        const bKey = b.id ? String(b.id) : `${(b.name || '').toLowerCase()}_${b.level || 0}`;
        const exists = weeks[normalizedId].bounties.some(existing => {
          const exKey = existing.id ? String(existing.id) : `${(existing.name || '').toLowerCase()}_${existing.level || 0}`;
          return exKey === bKey;
        });
        if (!exists) weeks[normalizedId].bounties.push(b);
      });
    }
    if (Array.isArray(wkVal.chores)) {
      wkVal.chores.forEach(c => {
        const cKey = `${(c.npc || '').toLowerCase()}_${(c.task || c.name || '').toLowerCase()}`;
        const exists = weeks[normalizedId].chores.some(existing => {
          const exKey = `${(existing.npc || '').toLowerCase()}_${(existing.task || existing.name || '').toLowerCase()}`;
          return exKey === cKey;
        });
        if (!exists) weeks[normalizedId].chores.push(c);
      });
    }
  });

  const trackTickets = parseInt(document.getElementById('trackTicketsInput')?.value, 10) || (state.globalData.cloudHistory?.trackTickets || 0);
  const trackCost = parseFloat(document.getElementById('trackCostInput')?.value) || (state.globalData.cloudHistory?.trackCost || 0);
  const totalLoginTickets = parseInt(document.getElementById('dailyLoginCount')?.value, 10) || (state.globalData.cloudHistory?.dailyLoginTickets || 0);

  const weeklyStats = {};
  const addWeeklyStat = (mondayKey, tix, cost) => {
    if (!mondayKey) mondayKey = currentWeekMonday;
    const normMonday = getMondayBasedWeekId(mondayKey);
    if (!weeklyStats[normMonday]) {
      weeklyStats[normMonday] = { tickets: 0, cost: 0 };
    }
    weeklyStats[normMonday].tickets += tix;
    weeklyStats[normMonday].cost += cost;
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
    if (!item || item.isSkipped) return false;
    if (item.checked !== undefined) return Boolean(item.checked);
    return Boolean(item.completed);
  };

  const isDoneToday = (item, itemWeekMonday) => {
    if (!isTicked(item)) return false;
    if (item.isManual) return false;
    if (itemWeekMonday && itemWeekMonday !== currentWeekMonday) return false;
    
    if (item.completedAt) {
      const ts = typeof item.completedAt === 'number' ? item.completedAt : Number(item.completedAt);
      if (!isNaN(ts) && ts > 0) {
        const ms = ts < 1e11 ? ts * 1000 : ts;
        return new Date(ms).toISOString().split('T')[0] === todayUtcStr;
      }
    }
    if (item.completedDate) {
      return item.completedDate === todayUtcStr;
    }
    return false;
  };

  const calculateItemYield = (baseTickets, isVipEligible = true, isDelivery = false, hasDouble = false, isManual = false) => {
    const rawBase = Number(baseTickets) || 0;
    if (rawBase <= 0) return 0;
    if (isManual) return rawBase;
    const withBonuses = rawBase + (isVipEligible ? vipBonus : 0) + boostCount;
    return (isDelivery && hasDouble) ? (withBonuses * 2) : withBonuses;
  };

  // 1. Process Deliveries strictly from the deduplicated Master History
  let doubleDeliveryAppliedToday = false;
  const rawList = state.globalData.archiveDeliveries || state.globalData.deliveries || [];
  const masterDeliveries = getDeduplicatedDeliveries(rawList);

  masterDeliveries.forEach(d => {
    if (isTicked(d)) {
      const baseTix = d.baseTickets !== undefined ? d.baseTickets : (d.tickets || 2);
      const isManual = Boolean(d.isManual);
      let applyDouble = false;
      if (isDoubleDeliveryActive && !doubleDeliveryAppliedToday && !isManual) {
        applyDouble = true;
        doubleDeliveryAppliedToday = true;
        d.hasDoubleBonus = true;
      } else {
        d.hasDoubleBonus = false;
      }

      const calculatedYield = isManual ? baseTix : calculateItemYield(baseTix, true, true, applyDouble, false);
      const dCost = d.itemsCost || d.cost || 0;
      const itemWeekMonday = getMondayBasedWeekId(d.weekId || d.completedDate || currentWeekMonday);

      const isThisWeek = (itemWeekMonday === currentWeekMonday);
      const isToday = isDoneToday(d, itemWeekMonday);

      if (isToday) {
        todayDelivTix += calculatedYield;
        todayCostAll += dCost;
      }

      totalDelivTix += calculatedYield;
      totalSflCostAll += dCost;
      addWeeklyStat(itemWeekMonday, calculatedYield, dCost);

      if (isThisWeek) {
        weekDelivTix += calculatedYield;
        weekCostAll += dCost;
      }
    }
  });

  // 2. Live Bounties
  (state.globalData.bounties || []).forEach(b => {
    if (isTicked(b)) {
      const baseTix = b.baseTickets !== undefined ? b.baseTickets : (b.tickets || 0);
      const isManual = Boolean(b.isManual);
      const finalTix = calculateItemYield(baseTix, false, false, false, isManual);
      if (finalTix <= 0) return;

      const bCost = b.cost !== undefined ? b.cost : (b.itemsCost || 0);
      const isAnimal = isAnimalBounty(b);
      const itemWeekMonday = getMondayBasedWeekId(b.weekId || currentWeekMonday);
      const isThisWeek = (itemWeekMonday === currentWeekMonday);

      if (isAnimal) {
        totalAnimalBountyTix += finalTix;
        if (isThisWeek) weekAnimalBountyTix += finalTix;
      } else {
        totalBountyTix += finalTix;
        if (isThisWeek) weekBountyTix += finalTix;
      }

      totalSflCostAll += bCost;
      if (isThisWeek) weekCostAll += bCost;
      addWeeklyStat(itemWeekMonday, finalTix, bCost);

      if (isDoneToday(b, itemWeekMonday)) {
        if (isAnimal) todayAnimalBountyTix += finalTix;
        else todayBountyTix += finalTix;
        todayCostAll += bCost;
      }
    }
  });

  // 3. Live Chores
  (state.globalData.chores || []).forEach(c => {
    if (isTicked(c)) {
      const baseTix = c.baseTickets !== undefined ? c.baseTickets : (c.tickets || 1);
      const isManual = Boolean(c.isManual);
      const finalTix = calculateItemYield(baseTix, true, false, false, isManual);
      if (finalTix <= 0) return;

      const cCost = c.cost !== undefined ? c.cost : (c.itemsCost || 0);
      const itemWeekMonday = getMondayBasedWeekId(c.weekId || currentWeekMonday);
      const isThisWeek = (itemWeekMonday === currentWeekMonday);

      totalChoreTix += finalTix;
      if (isThisWeek) weekChoreTix += finalTix;

      totalSflCostAll += cCost;
      if (isThisWeek) weekCostAll += cCost;
      addWeeklyStat(itemWeekMonday, finalTix, cCost);

      if (isDoneToday(c, itemWeekMonday)) {
        todayChoreTix += finalTix;
        todayCostAll += cCost;
      }
    }
  });

  // 4. Past Weeks Storage
  Object.entries(weeks).forEach(([wkKey, wk]) => {
    const pastMonday = getMondayBasedWeekId(wk.weekId || wkKey);
    if (pastMonday === currentWeekMonday) return;

    (wk.bounties || []).forEach((b) => {
      if (isTicked(b)) {
        const baseTix = b.baseTickets !== undefined ? b.baseTickets : (b.tickets !== undefined ? b.tickets : 0);
        const isManual = Boolean(b.isManual);
        const finalTix = calculateItemYield(baseTix, false, false, false, isManual);
        if (finalTix <= 0) return;

        const bCost = b.cost !== undefined ? b.cost : (b.itemsCost || 0);
        const isAnimal = isAnimalBounty(b);

        if (isAnimal) totalAnimalBountyTix += finalTix;
        else totalBountyTix += finalTix;

        totalSflCostAll += bCost;
        addWeeklyStat(pastMonday, finalTix, bCost);
      }
    });

    (wk.chores || []).forEach((c) => {
      if (isTicked(c)) {
        const baseTix = c.baseTickets !== undefined ? c.baseTickets : (c.tickets !== undefined ? c.tickets : 1);
        const isManual = Boolean(c.isManual);
        const finalTix = calculateItemYield(baseTix, true, false, false, isManual);
        if (finalTix <= 0) return;

        const cCost = c.cost !== undefined ? c.cost : (c.itemsCost || 0);
        totalChoreTix += finalTix;
        totalSflCostAll += cCost;
        addWeeklyStat(pastMonday, finalTix, cCost);
      }
    });
  });

  const totalTicketsAll = totalDelivTix + totalBountyTix + totalAnimalBountyTix + totalChoreTix + trackTickets + totalLoginTickets;
  const weekTicketsAll = weekDelivTix + weekBountyTix + weekAnimalBountyTix + weekChoreTix;
  const todayTicketsAll = todayDelivTix + todayBountyTix + todayAnimalBountyTix + todayChoreTix;

  const regularBounties = (state.globalData.bounties || []).filter(b => !isAnimalBounty(b));
  const animalBounties = (state.globalData.bounties || []).filter(b => isAnimalBounty(b));

  setElemText('deliveriesCount', `${(state.globalData.deliveries || []).length} Orders`);
  setElemText('bountiesCount', `${regularBounties.length} Items`);
  setElemText('animalBountiesCount', `${animalBounties.length} Animals`);
  setElemText('choresCount', `${(state.globalData.chores || []).length} Tasks`);

  setElemText('statTotalTickets', `${totalTicketsAll} Tickets`);
  setElemText('statTotalCost', `${formatSFL(totalSflCostAll)} SFL`);
  setElemText('statTotalRatio', `${totalTicketsAll > 0 ? formatSFL(totalSflCostAll / totalTicketsAll) : "0.000"} SFL / Ticket`);

  setElemText('statWeekTickets', `${weekTicketsAll} Tickets`);
  setElemText('statWeekCost', `${formatSFL(weekCostAll)} SFL`);
  setElemText('statWeekRatio', `${weekTicketsAll > 0 ? formatSFL(weekCostAll / weekTicketsAll) : "0.000"} SFL / Ticket`);

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
  const targetPerWeek = targetWeeks > 0 ? Math.ceil(targetGoal / targetWeeks) : 0;

  setElemText('statGoalRemaining', `${remainingNeeded} Tickets`);
  setElemText('statGoalPerWeek', `${targetPerWeek} Tickets / Wk`);

  const targetWeeksInput = parseInt(document.getElementById('targetWeeksInput')?.value, 10) || 12;
  renderWeeklyChart(weeklyStats, currentWeekMonday, targetPerWeek, targetWeeksInput);
}

function renderWeeklyChart(weeklyStats, currentMondayKey, targetPacePerWeek, totalPlannedWeeks) {
  const chartContainer = document.getElementById('weeklyChartContainer');
  const badgeEl = document.getElementById('chartSummaryBadge');
  if (!chartContainer) return;

  const weekMondays = [];
  const baseEpoch = new Date('2026-08-10T00:00:00.000Z');
  for (let w = 0; w < (totalPlannedWeeks || 12); w++) {
    const d = new Date(baseEpoch.getTime());
    d.setUTCDate(baseEpoch.getUTCDate() + (w * 7));
    weekMondays.push(d.toISOString().split('T')[0]);
  }

  Object.keys(weeklyStats).forEach(mk => {
    if (!weekMondays.includes(mk)) {
      weekMondays.push(mk);
      weekMondays.sort();
    }
  });

  const displayItems = [];
  weekMondays.forEach((mondayKey, idx) => {
    const isCurrent = (mondayKey === currentMondayKey);
    const data = weeklyStats[mondayKey];

    displayItems.push({
      label: `Week ${idx + 1}`,
      mondayKey,
      tickets: data ? data.tickets : 0,
      cost: data ? data.cost : 0,
      isCurrent,
      hasData: Boolean(data && data.tickets > 0)
    });
  });

  if (badgeEl) {
    const currentIndex = displayItems.findIndex(d => d.isCurrent);
    const activeWeekNum = currentIndex !== -1 ? currentIndex + 1 : 2;
    badgeEl.textContent = `WEEK ${activeWeekNum} OF ${displayItems.length} WEEKS (UTC)`;
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
          <title>${item.label} (Monday: ${item.mondayKey} UTC)\n🎟️ ${item.tickets} Tickets\n💰 ${item.cost > 0 ? formatSFL(item.cost) + ' SFL' : '0.000 SFL'}</title>
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
