import { 
  state, 
  formatSFL, 
  setElemText, 
  getActiveBoostCount, 
  getActiveVipBonus, 
  getMondayBasedWeekId, 
  isAnimalBounty, 
  getDeliveryRecords 
} from './state.js';

export function recalculateAll() {
  if (!state.globalData) return;

  const vipBonus = getActiveVipBonus();
  const boostCount = getActiveBoostCount();
  const isDoubleDeliveryActive = Boolean(state.globalData.isDoubleDeliveryActive);
  const doubleDeliveryDates = new Set(state.globalData.doubleDeliveryDates || []);

  const dblBanner = document.getElementById('doubleDeliveryBanner');
  if (dblBanner) {
    dblBanner.style.display = isDoubleDeliveryActive ? 'flex' : 'none';
  }

  const now = new Date();
  const todayUtcStr = now.toISOString().split('T')[0];
  const localDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const startOfTodayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const currentWeekMonday = getMondayBasedWeekId(now);

  let rawWeeks = (state.globalData?.cloudHistory && state.globalData?.cloudHistory?.weeks) || 
    (state.currentVaultData && state.currentVaultData?.weeks) || 
    {};
  try {
    const localWeeksStr = localStorage.getItem('sfl_cloud_weeks');
    if (localWeeksStr) {
      const localWeeks = JSON.parse(localWeeksStr);
      rawWeeks = { ...localWeeks, ...rawWeeks };
    }
  } catch (e) {}

  const weeks = {};
  Object.entries(rawWeeks).forEach(([wkKey, wkVal]) => {
    if (!wkVal || typeof wkVal !== 'object') return;
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
  const addWeeklyStat = (mondayKey, tix, cost, category = 'deliv') => {
    if (!mondayKey) mondayKey = currentWeekMonday;
    const normMonday = getMondayBasedWeekId(mondayKey);
    if (!weeklyStats[normMonday]) {
      weeklyStats[normMonday] = { 
        tickets: 0, 
        cost: 0,
        delivTix: 0,
        bountyTix: 0,
        animalBountyTix: 0,
        choreTix: 0
      };
    }
    weeklyStats[normMonday].tickets += tix;
    weeklyStats[normMonday].cost += cost;

    if (category === 'deliv') {
      weeklyStats[normMonday].delivTix += tix;
    } else if (category === 'bounty') {
      weeklyStats[normMonday].bountyTix += tix;
    } else if (category === 'animalBounty') {
      weeklyStats[normMonday].animalBountyTix += tix;
    } else if (category === 'chore') {
      weeklyStats[normMonday].choreTix += tix;
    }
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

  // Live board deliveries completed today
  let todayDelivTix = 0;
  let todayDelivCost = 0;

  const isTicked = (item) => {
    if (!item || item.isSkipped) return false;
    if (item.checked !== undefined) return Boolean(item.checked);
    return Boolean(item.completed);
  };

  const resolveDateStr = (item) => {
    if (item.completedDate) return item.completedDate;
    if (item.completedAt) {
      const ts = typeof item.completedAt === 'number' ? item.completedAt : Number(item.completedAt);
      if (!isNaN(ts) && ts > 0) {
        const ms = ts < 1e11 ? ts * 1000 : ts;
        return new Date(ms).toISOString().split('T')[0];
      }
    }
    return null;
  };

  const isDeliveryDoneToday = (item) => {
    if (!item || item.isManual) return false;
    if (item.checkedToday) return true;
    
    if (item.completedAt) {
      const ts = typeof item.completedAt === 'number' ? item.completedAt : Number(item.completedAt);
      if (!isNaN(ts) && ts > 0) {
        const ms = ts < 1e11 ? ts * 1000 : ts;
        return ms >= startOfTodayUtcMs;
      }
    }

    const compDate = resolveDateStr(item);
    if (compDate) {
      return compDate === todayUtcStr || compDate === localDateStr;
    }

    return false;
  };

  // 1. Deliveries Calculation
  const masterDeliveries = getDeliveryRecords();
  const npcDoubleDeliveryClaimed = new Set();

  const sortedDeliveries = [...masterDeliveries].sort((a, b) => {
    const aTime = a.completedAt || 0;
    const bTime = b.completedAt || 0;
    return aTime - bTime;
  });

  sortedDeliveries.forEach(d => {
    if (isTicked(d)) {
      const baseTix = d.baseTickets !== undefined ? d.baseTickets : (d.tickets || 2);
      const isManual = Boolean(d.isManual);
      const compDate = resolveDateStr(d) || todayUtcStr;
      const itemWeekMonday = getMondayBasedWeekId(d.weekId || compDate);
      const isToday = !isManual && isDeliveryDoneToday(d);

      const isDoubleDay = doubleDeliveryDates.has(compDate) || (isDoubleDeliveryActive && compDate === todayUtcStr);
      const npcClean = (d.from || d.name || '').toLowerCase().trim();
      const doubleClaimKey = `${npcClean}_${compDate}`;

      let applyDouble = false;
      if (isDoubleDay && !isManual && !npcDoubleDeliveryClaimed.has(doubleClaimKey)) {
        applyDouble = true;
        npcDoubleDeliveryClaimed.add(doubleClaimKey);
        d.hasDoubleBonus = true;
      } else {
        d.hasDoubleBonus = false;
      }

      const calculatedYield = isManual 
        ? baseTix 
        : (applyDouble ? (baseTix + vipBonus + boostCount) * 2 : (baseTix + vipBonus + boostCount));

      const dCost = d.itemsCost || d.cost || 0;
      const isThisWeek = (itemWeekMonday === currentWeekMonday);

      if (isToday) {
        todayDelivTix += calculatedYield;
        todayDelivCost += dCost;
      }

      totalDelivTix += calculatedYield;
      totalSflCostAll += dCost;
      addWeeklyStat(itemWeekMonday, calculatedYield, dCost, 'deliv');

      if (isThisWeek) {
        weekDelivTix += calculatedYield;
        weekCostAll += dCost;
      }
    }
  });

  // 2. Bounties Calculation
  (state.globalData.bounties || []).forEach(b => {
    if (isTicked(b)) {
      const baseTix = b.baseTickets !== undefined ? b.baseTickets : (b.tickets || 0);
      const isManual = Boolean(b.isManual);
      const finalTix = isManual ? baseTix : (baseTix + boostCount);
      if (finalTix <= 0) return;

      const bCost = b.cost !== undefined ? b.cost : (b.itemsCost || 0);
      const isAnimal = isAnimalBounty(b);
      const compDate = resolveDateStr(b);
      const itemWeekMonday = getMondayBasedWeekId(b.weekId || compDate || currentWeekMonday);
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
      addWeeklyStat(itemWeekMonday, finalTix, bCost, isAnimal ? 'animalBounty' : 'bounty');
    }
  });

  // 3. Chores Calculation
  (state.globalData.chores || []).forEach(c => {
    if (isTicked(c)) {
      const baseTix = c.baseTickets !== undefined ? c.baseTickets : (c.tickets || 1);
      const isManual = Boolean(c.isManual);
      const finalTix = isManual ? baseTix : (baseTix + vipBonus + boostCount);
      if (finalTix <= 0) return;

      const cCost = c.cost !== undefined ? c.cost : (c.itemsCost || 0);
      const compDate = resolveDateStr(c);
      const itemWeekMonday = getMondayBasedWeekId(c.weekId || compDate || currentWeekMonday);
      const isThisWeek = (itemWeekMonday === currentWeekMonday);

      totalChoreTix += finalTix;
      if (isThisWeek) weekChoreTix += finalTix;

      totalSflCostAll += cCost;
      if (isThisWeek) weekCostAll += cCost;
      addWeeklyStat(itemWeekMonday, finalTix, cCost, 'chore');
    }
  });

  // 4. Past Weeks Storage History
  Object.entries(weeks).forEach(([wkKey, wk]) => {
    const pastMonday = getMondayBasedWeekId(wk.weekId || wkKey);
    if (pastMonday === currentWeekMonday) return;

    (wk.bounties || []).forEach(b => {
      if (isTicked(b)) {
        const baseTix = b.baseTickets !== undefined ? b.baseTickets : (b.tickets || 0);
        const isManual = Boolean(b.isManual);
        const finalTix = isManual ? baseTix : (baseTix + boostCount);
        if (finalTix <= 0) return;

        const bCost = b.cost !== undefined ? b.cost : (b.itemsCost || 0);
        const isAnimal = isAnimalBounty(b);

        if (isAnimal) {
          totalAnimalBountyTix += finalTix;
        } else {
          totalBountyTix += finalTix;
        }

        totalSflCostAll += bCost;
        addWeeklyStat(pastMonday, finalTix, bCost, isAnimal ? 'animalBounty' : 'bounty');
      }
    });

    (wk.chores || []).forEach(c => {
      if (isTicked(c)) {
        const baseTix = c.baseTickets !== undefined ? c.baseTickets : (c.tickets || 1);
        const finalTix = c.isManual ? baseTix : (baseTix + vipBonus + boostCount);
        if (finalTix <= 0) return;

        const cCost = c.cost !== undefined ? c.cost : (c.itemsCost || 0);
        totalChoreTix += finalTix;
        totalSflCostAll += cCost;
        addWeeklyStat(pastMonday, finalTix, cCost, 'chore');
      }
    });
  });

  // Totals calculations
  const totalTicketsAll = totalDelivTix + totalBountyTix + totalAnimalBountyTix + totalChoreTix + trackTickets + totalLoginTickets;
  const weekTicketsAll = weekDelivTix + weekBountyTix + weekAnimalBountyTix + weekChoreTix;
  
  const todayTicketsAll = todayDelivTix;
  const todayCostAll = todayDelivCost;

  const regularBounties = (state.globalData.bounties || []).filter(b => !isAnimalBounty(b));
  const animalBounties = (state.globalData.bounties || []).filter(b => isAnimalBounty(b));

  const activeDeliveriesCount = masterDeliveries.filter(d => !isTicked(d)).length;
  const activeBountiesCount = regularBounties.filter(b => !isTicked(b)).length;
  const activeAnimalBountiesCount = animalBounties.filter(b => !isTicked(b)).length;
  const activeChoresCount = (state.globalData.chores || []).filter(c => !isTicked(c)).length;

  setElemText('deliveriesCount', `${activeDeliveriesCount} Orders`);
  setElemText('bountiesCount', `${activeBountiesCount} Items`);
  setElemText('animalBountiesCount', `${activeAnimalBountiesCount} Animals`);
  setElemText('choresCount', `${activeChoresCount} Tasks`);

  // Main Metric Counters
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

  // Tooltips Breakdown
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

  const isDark = document.body.classList.contains('dark-mode');

  const colors = {
    gridLine: isDark ? '#4E342E' : '#D7CCC8',
    gridText: isDark ? '#FFF8DC' : '#3E2723',
    targetLine: isDark ? '#CE93D8' : '#7B1FA2',
    targetText: isDark ? '#F3E5F5' : '#4A148C',
    axisLabel: isDark ? '#FFF8DC' : '#2E1B17',
    costLabel: isDark ? '#FFE082' : '#4E342E',
    barDoneFill: isDark ? '#2E7D32' : '#4CAF50',
    barDoneStroke: isDark ? '#81C784' : '#1B5E20',
    barDoneText: isDark ? '#C8E6C9' : '#0F3812',
    barCurFill: isDark ? '#E65100' : '#E65100',
    barCurStroke: isDark ? '#FFB74D' : '#BF360C',
    barCurText: isDark ? '#FFF9C4' : '#BF360C',
    barEmptyFill: isDark ? '#211812' : '#ECEFF1',
    barEmptyStroke: isDark ? '#5D4037' : '#78909C',
    barEmptyText: isDark ? '#D7CCC8' : '#455A64',
    barCurEmptyFill: isDark ? '#3E271E' : '#FFE0B2',
    barCurEmptyStroke: isDark ? '#FF9800' : '#E65100'
  };

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
    const data = weeklyStats[mondayKey] || {
      tickets: 0,
      cost: 0,
      delivTix: 0,
      bountyTix: 0,
      animalBountyTix: 0,
      choreTix: 0
    };

    displayItems.push({
      label: `Week ${idx + 1}`,
      mondayKey,
      tickets: data.tickets || 0,
      cost: data.cost || 0,
      delivTix: data.delivTix || 0,
      bountyTix: data.bountyTix || 0,
      animalBountyTix: data.animalBountyTix || 0,
      choreTix: data.choreTix || 0,
      isCurrent,
      hasData: Boolean(data.tickets > 0)
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
  const bottomPadding = 52;

  const chartHeight = 265;
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
      <line x1="${leftPadding}" y1="${yPos}" x2="${chartWidth - rightPadding}" y2="${yPos}" stroke="${colors.gridLine}" stroke-dasharray="3,3" stroke-width="1.5" />
      <text x="${leftPadding - 8}" y="${yPos + 4}" font-size="12" font-weight="900" fill="${colors.gridText}" text-anchor="end">${val}</text>
    `;
  }

  let targetLineSvg = '';
  if (targetPacePerWeek > 0) {
    const targetY = topPadding + plotHeight - (targetPacePerWeek / yMax) * plotHeight;
    targetLineSvg += `
      <line x1="${leftPadding}" y1="${targetY}" x2="${chartWidth - rightPadding}" y2="${targetY}" stroke="${colors.targetLine}" stroke-dasharray="5,5" stroke-width="2" />
      <text x="${chartWidth - rightPadding + 6}" y="${targetY + 4}" font-size="11" font-weight="900" fill="${colors.targetText}">Pace: ${targetPacePerWeek}</text>
    `;
  }

  let barsSvg = '';
  displayItems.forEach((item, idx) => {
    const xPos = leftPadding + (idx * (barWidth + barGap)) + (barGap / 2);
    const barHeight = Math.max(4, (item.tickets / yMax) * plotHeight);
    const yPos = topPadding + plotHeight - barHeight;

    let barFill = item.hasData ? colors.barDoneFill : colors.barEmptyFill;
    let strokeColor = item.hasData ? colors.barDoneStroke : colors.barEmptyStroke;
    let tixTextColor = item.hasData ? colors.barDoneText : colors.barEmptyText;

    if (item.isCurrent) {
      barFill = item.hasData ? colors.barCurFill : colors.barCurEmptyFill;
      strokeColor = item.hasData ? colors.barCurStroke : colors.barCurEmptyStroke;
      tixTextColor = item.hasData ? colors.barCurText : colors.barEmptyText;
    }

    const tixLabel = item.tickets > 0 ? `${item.tickets}` : '0';
    const costText = item.cost > 0 ? `${formatSFL(item.cost)} SFL` : '';

    barsSvg += `
      <g class="chart-bar-group" 
         onmouseenter="showChartTooltip(event, '${item.label}', '${item.mondayKey}', ${item.delivTix}, ${item.bountyTix}, ${item.animalBountyTix}, ${item.choreTix}, ${item.tickets}, ${item.cost})"
         onmousemove="moveChartTooltip(event)"
         onmouseleave="hideChartTooltip()"
         onclick="showChartTooltip(event, '${item.label}', '${item.mondayKey}', ${item.delivTix}, ${item.bountyTix}, ${item.animalBountyTix}, ${item.choreTix}, ${item.tickets}, ${item.cost})"
         style="cursor: pointer;">
        <rect x="${xPos}" y="${yPos}" width="${barWidth}" height="${barHeight}" rx="6" fill="${barFill}" stroke="${strokeColor}" stroke-width="2">
          <title>📅 ${item.label} (${item.mondayKey})\n📦 Deliveries: ${item.delivTix} Tix\n📜 Bounties: ${item.bountyTix} Tix\n🐄 Animal Bounties: ${item.animalBountyTix} Tix\n🧹 Chores: ${item.choreTix} Tix\n🎟️ Total: ${item.tickets} Tix\n💰 Cost: ${formatSFL(item.cost)} SFL</title>
        </rect>
        <text x="${xPos + (barWidth / 2)}" y="${yPos - 8}" font-size="13" font-weight="900" fill="${tixTextColor}" text-anchor="middle">${tixLabel}</text>
        <text x="${xPos + (barWidth / 2)}" y="${topPadding + plotHeight + 20}" font-size="12" font-weight="900" fill="${colors.axisLabel}" text-anchor="middle">${item.label}</text>
        ${costText ? `<text x="${xPos + (barWidth / 2)}" y="${topPadding + plotHeight + 35}" font-size="10" font-weight="900" fill="${colors.costLabel}" text-anchor="middle">${costText}</text>` : ''}
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

export function showChartTooltip(e, label, mondayKey, delivTix, bountyTix, animalBountyTix, choreTix, totalTix, totalCost) {
  let tooltip = document.getElementById('chartFloatingTooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'chartFloatingTooltip';
    tooltip.className = 'chart-floating-tooltip';
    document.body.appendChild(tooltip);
  }

  const sflCostStr = formatSFL(totalCost || 0);
  tooltip.innerHTML = `
    <div style="color:#FFD54F; font-size:12.5px; font-weight:900; border-bottom:1px dashed #d2b48c; padding-bottom:4px; margin-bottom:6px;">
      📅 <strong>${(label || 'WEEK').toUpperCase()} BREAKDOWN:</strong>
    </div>
    <div style="display:flex; flex-direction:column; gap:4px; font-size:12px; font-weight:bold;">
      <div style="display:flex; justify-content:space-between; gap:14px; color:#FFF8DC;"><span>📦 Deliveries:</span><strong style="color:#FFFFFF; font-size:12.5px;">${delivTix || 0} Tix</strong></div>
      <div style="display:flex; justify-content:space-between; gap:14px; color:#FFF8DC;"><span>📜 Bounties:</span><strong style="color:#FFFFFF; font-size:12.5px;">${bountyTix || 0} Tix</strong></div>
      <div style="display:flex; justify-content:space-between; gap:14px; color:#FFF8DC;"><span>🐄 Animal Bounties:</span><strong style="color:#FFFFFF; font-size:12.5px;">${animalBountyTix || 0} Tix</strong></div>
      <div style="display:flex; justify-content:space-between; gap:14px; color:#FFF8DC;"><span>🧹 Chores:</span><strong style="color:#FFFFFF; font-size:12.5px;">${choreTix || 0} Tix</strong></div>
    </div>
    <div style="border-top:1px dashed #d2b48c; padding-top:5px; margin-top:6px; display:flex; justify-content:space-between; align-items:center; font-size:12px; font-weight:900;">
      <span style="color:#81C784;">🎟️ Total: +${totalTix || 0} Tix</span>
      <span style="color:#FFD54F;">💰 ${sflCostStr} SFL</span>
    </div>
  `;

  tooltip.style.display = 'block';
  positionChartTooltip(e, tooltip);
}

export function moveChartTooltip(e) {
  const tooltip = document.getElementById('chartFloatingTooltip');
  if (tooltip && tooltip.style.display === 'block') {
    positionChartTooltip(e, tooltip);
  }
}

export function hideChartTooltip() {
  const tooltip = document.getElementById('chartFloatingTooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}

function positionChartTooltip(e, tooltip) {
  const x = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
  const y = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
  
  const tooltipWidth = 230;
  const tooltipHeight = 150;
  
  let left = x + 15;
  let top = y - tooltipHeight - 10;
  
  if (typeof window !== 'undefined') {
    if (left + tooltipWidth > window.innerWidth - 10) {
      left = x - tooltipWidth - 15;
    }
    if (top < 10) {
      top = y + 20;
    }
  }
  
  tooltip.style.left = `${Math.max(10, left)}px`;
  tooltip.style.top = `${Math.max(10, top)}px`;
}
