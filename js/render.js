import { state, formatSFL, setElemText, getActiveBoostCount, getActiveVipBonus, getMondayBasedWeekId, isLoginClaimedToday } from './state.js';

export function recalculateAll() {
  if (!state.globalData) return;

  const vipBonus = getActiveVipBonus();
  const boostCount = getActiveBoostCount();

  const now = new Date();
  const todayUtcStr = now.toISOString().split('T')[0];
  const localTodayStr = now.toLocaleDateString('en-CA');
  const currentWeekId = getMondayBasedWeekId();

  const rawLogs = (state.globalData.cloudHistory && state.globalData.cloudHistory.logs) || [];
  const weeks = (state.globalData.cloudHistory && state.globalData.cloudHistory.weeks) || {};

  // Track & Login Inputs
  const trackTickets = parseInt(document.getElementById('trackTicketsInput')?.value) || (state.globalData.cloudHistory?.trackTickets || 0);
  const trackCost = parseFloat(document.getElementById('trackCostInput')?.value) || (state.globalData.cloudHistory?.trackCost || 0);

  const totalLoginTickets = parseInt(document.getElementById('dailyLoginCount')?.value) || (state.globalData.cloudHistory?.dailyLoginTickets || 0);
  const isDoneLoginToday = isLoginClaimedToday() || !!document.getElementById('dailyLoginCheck')?.checked;
  const todayLoginTickets = isDoneLoginToday ? 1 : 0;

  // Category Counters
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

  // Strict helper: Is an item completed/claimed?
  const isItemCompleted = (item) => {
    if (!item) return false;
    if (item.checked !== undefined) return Boolean(item.checked);
    return Boolean(item.completed);
  };

  // 1. Process PAST Daily Deliveries from saved history logs
  const seenDates = new Set();
  rawLogs.forEach(log => {
    const rawDate = (log.date || '').split('T')[0];
    if (!rawDate || seenDates.has(rawDate)) return;
    seenDates.add(rawDate);

    const isTodayLog = (rawDate === todayUtcStr || rawDate === localTodayStr);
    if (isTodayLog) return; // Skip today's log; handled live below

    const isThisWeek = log.weekId === currentWeekId || rawDate.slice(0, 4) === now.getFullYear().toString();

    (log.deliveriesDone || []).forEach(item => {
      if (isItemCompleted(item)) {
        const baseTix = item.baseTickets !== undefined ? item.baseTickets : (item.tickets !== undefined ? item.tickets : 2);
        const finalTix = baseTix > 0 ? (baseTix + vipBonus + boostCount) : 0;
        const itemCost = item.cost || 0;

        totalDelivTix += finalTix;
        totalSflCostAll += itemCost;

        if (isThisWeek) {
          weekDelivTix += finalTix;
          weekCostAll += itemCost;
        }
      }
    });
  });

  // 2. Process TODAY'S Live Deliveries
  (state.globalData.deliveries || []).forEach(d => {
    if (isItemCompleted(d)) {
      const deliveryAddon = d.isManual ? 0 : (vipBonus + boostCount);
      const finalTix = d.baseTickets + deliveryAddon;
      const dCost = d.itemsCost || 0;

      todayDelivTix += finalTix;
      todayCostAll += dCost;

      totalDelivTix += finalTix;
      weekDelivTix += finalTix;
      totalSflCostAll += dCost;
      weekCostAll += dCost;
    }
  });

  // 3. Process PAST Weeks (Historical Bounties & Chores from prior weeks)
  Object.entries(weeks).forEach(([wkId, wk]) => {
    if (wkId === currentWeekId) return; // Skip current week to prevent duplicate addition

    (wk.bounties || []).forEach(b => {
      if (isItemCompleted(b)) {
        const baseTix = b.baseTickets !== undefined ? b.baseTickets : (b.tickets !== undefined ? b.tickets : 0);
        if (baseTix <= 0) return;

        const finalTix = baseTix + boostCount;
        const bCost = b.cost !== undefined ? b.cost : (b.itemsCost || 0);

        totalBountyTix += finalTix;
        totalSflCostAll += bCost;
      }
    });

    (wk.chores || []).forEach(c => {
      if (isItemCompleted(c)) {
        const baseTix = c.baseTickets !== undefined ? c.baseTickets : (c.tickets !== undefined ? c.tickets : 1);
        const finalTix = baseTix > 0 ? (baseTix + boostCount) : 0;
        const cCost = c.cost !== undefined ? c.cost : (c.itemsCost || 0);

        totalChoreTix += finalTix;
        totalSflCostAll += cCost;
      }
    });
  });

  // 4. Process CURRENT Week Bounties & Chores
  const seenWeekBountyKeys = new Set();
  const currentWeekBounties = (state.globalData.bounties || [])
    .filter(liveB => {
      const tix = liveB.baseTickets || 0;
      if (tix <= 0) return false;

      const key = liveB.id ? String(liveB.id) : `${(liveB.name || '').toLowerCase()}_${liveB.level || 0}`;
      if (seenWeekBountyKeys.has(key)) return false;
      seenWeekBountyKeys.add(key);
      return true;
    })
    .map(liveB => {
      const saved = (weeks[currentWeekId]?.bounties || []).find(sb => 
        (sb.id && liveB.id && String(sb.id) === String(liveB.id)) ||
        (sb.name || '').toLowerCase() === (liveB.name || '').toLowerCase()
      );
      return {
        ...liveB,
        completed: liveB.completed || false,
        checked: saved?.checked !== undefined ? saved.checked : (saved?.completed !== undefined ? saved.completed : liveB.completed),
        cost: saved?.cost !== undefined ? saved.cost : liveB.itemsCost,
        baseTickets: saved?.baseTickets !== undefined ? saved.baseTickets : (saved?.tickets !== undefined ? saved.tickets : liveB.baseTickets),
        completedAt: liveB.completedAt || saved?.completedAt || null
      };
    });

  const seenWeekChoreKeys = new Set();
  const currentWeekChores = (state.globalData.chores || [])
    .filter(liveC => {
      const key = (liveC.task || liveC.name || '').toLowerCase();
      if (seenWeekChoreKeys.has(key)) return false;
      seenWeekChoreKeys.add(key);
      return true;
    })
    .map(liveC => {
      const saved = (weeks[currentWeekId]?.chores || []).find(sc => (sc.task || sc.name || '').toLowerCase() === (liveC.task || liveC.name || '').toLowerCase());
      return {
        ...liveC,
        completed: liveC.completed || false,
        checked: saved?.checked !== undefined ? saved.checked : (saved?.completed !== undefined ? saved.completed : liveC.completed),
        cost: saved?.cost !== undefined ? saved.cost : (liveC.itemsCost || 0),
        baseTickets: saved?.baseTickets !== undefined ? saved.baseTickets : (saved?.tickets !== undefined ? saved.tickets : liveC.baseTickets),
        completedAt: liveC.completedAt || saved?.completedAt || null
      };
    });

  const isWeeklyItemDoneToday = (item) => {
    if (!isItemCompleted(item)) return false;
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

  // ONLY count completed/ticked bounties
  currentWeekBounties.forEach(b => {
    if (isItemCompleted(b)) {
      const baseTix = b.baseTickets || 0;
      if (baseTix <= 0) return;

      const finalTix = baseTix + boostCount;
      const bCost = b.cost !== undefined ? b.cost : (b.itemsCost || 0);

      totalBountyTix += finalTix;
      totalSflCostAll += bCost;
      weekBountyTix += finalTix;
      weekCostAll += bCost;

      if (isWeeklyItemDoneToday(b)) {
        todayBountyTix += finalTix;
        todayCostAll += bCost;
      }
    }
  });

  // ONLY count completed/ticked chores
  currentWeekChores.forEach(c => {
    if (isItemCompleted(c)) {
      const baseTix = c.baseTickets || 1;
      const finalTix = baseTix > 0 ? (baseTix + boostCount) : 0;
      const cCost = c.cost !== undefined ? c.cost : (c.itemsCost || 0);

      totalChoreTix += finalTix;
      weekChoreTix += finalTix;
      totalSflCostAll += cCost;
      weekCostAll += cCost;

      if (isWeeklyItemDoneToday(c)) {
        todayChoreTix += finalTix;
        todayCostAll += cCost;
      }
    }
  });

  // Calculate Cumulative Dashboard Totals
  const totalTicketsAll = totalDelivTix + totalBountyTix + totalChoreTix + trackTickets + totalLoginTickets;
  const weekTicketsAll = weekDelivTix + weekBountyTix + weekChoreTix + trackTickets + totalLoginTickets;
  const todayTicketsAll = todayDelivTix + todayBountyTix + todayChoreTix + todayLoginTickets;

  // 5. Update Overview Card Counts (Shows total available board count)
  const regularBounties = currentWeekBounties.filter(b => {
    const n = (b.name || '').toLowerCase();
    return !(n.includes('chicken') || n.includes('cow') || n.includes('sheep'));
  });
  const animalBounties = currentWeekBounties.filter(b => {
    const n = (b.name || '').toLowerCase();
    return n.includes('chicken') || n.includes('cow') || n.includes('sheep');
  });

  setElemText('deliveriesCount', `${state.globalData.deliveries?.length || 0} Orders`);
  setElemText('bountiesCount', `${regularBounties.length} Items`);
  setElemText('animalBountiesCount', `${animalBounties.length} Animals`);
  setElemText('choresCount', `${currentWeekChores.length} Tasks`);

  // 6. Update Stats Grid & Tooltips
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

  // Tooltips Breakdown
  setElemText('tipTotalDeliv', `📦 Deliveries: ${totalDelivTix} Tix`);
  setElemText('tipTotalBounty', `📜 Bounties: ${totalBountyTix} Tix`);
  setElemText('tipTotalChore', `🧹 Chores: ${totalChoreTix} Tix`);
  setElemText('tipTotalTrack', `🛤️ Track: ${trackTickets} Tix (${formatSFL(trackCost)} SFL)`);
  setElemText('tipTotalLogin', `🎁 Daily Login: ${totalLoginTickets} Tix`);

  setElemText('tipWeekDeliv', `📦 Deliveries: ${weekDelivTix} Tix`);
  setElemText('tipWeekBounty', `📜 Bounties: ${weekBountyTix} Tix`);
  setElemText('tipWeekChore', `🧹 Chores: ${weekChoreTix} Tix`);
  setElemText('tipWeekTrack', `🛤️ Track: ${trackTickets} Tix (${formatSFL(trackCost)} SFL)`);
  setElemText('tipWeekLogin', `🎁 Daily Login: ${totalLoginTickets} Tix`);

  setElemText('tipTodayDeliv', `📦 Deliveries: ${todayDelivTix} Tix`);
  setElemText('tipTodayBounty', `📜 Bounties: ${todayBountyTix} Tix`);
  setElemText('tipTodayChore', `🧹 Chores: ${todayChoreTix} Tix`);
  setElemText('tipTodayLogin', `🎁 Daily Login: ${todayLoginTickets} Tix`);

  // Goal Calculator
  const targetGoal = parseInt(document.getElementById('targetGoalInput')?.value) || 1000;
  const targetWeeks = parseInt(document.getElementById('targetWeeksInput')?.value) || 12;
  const remainingNeeded = Math.max(0, targetGoal - totalTicketsAll);
  const targetPerWeek = targetWeeks > 0 ? Math.ceil(remainingNeeded / targetWeeks) : 0;

  setElemText('statGoalRemaining', `${remainingNeeded} Tickets`);
  setElemText('statGoalPerWeek', `${targetPerWeek} Tickets / Wk`);
}
