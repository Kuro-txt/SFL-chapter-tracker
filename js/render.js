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

  // Track & Login inputs
  const trackTickets = parseInt(document.getElementById('trackTicketsInput')?.value) || (state.globalData.cloudHistory?.trackTickets || 0);
  const trackCost = parseFloat(document.getElementById('trackCostInput')?.value) || (state.globalData.cloudHistory?.trackCost || 0);

  const totalLoginTickets = parseInt(document.getElementById('dailyLoginCount')?.value) || (state.globalData.cloudHistory?.dailyLoginTickets || 0);
  const isDoneLoginToday = isLoginClaimedToday() || !!document.getElementById('dailyLoginCheck')?.checked;
  const todayLoginTickets = isDoneLoginToday ? 1 : 0;

  // Category counters
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

  const isTicked = (item) => {
    if (!item) return false;
    if (item.checked !== undefined) return Boolean(item.checked);
    return Boolean(item.completed);
  };

  // 1. Process Past Daily Deliveries from saved logs (Exclude today's date)
  const seenDates = new Set();
  rawLogs.forEach(log => {
    const rawDate = (log.date || '').split('T')[0];
    if (!rawDate || seenDates.has(rawDate)) return;
    seenDates.add(rawDate);

    const isTodayLog = (rawDate === todayUtcStr || rawDate === localTodayStr);
    if (isTodayLog) return; // Skip today's log to avoid duplicating live state

    const isThisWeek = log.weekId === currentWeekId || rawDate.slice(0, 4) === now.getFullYear().toString();

    (log.deliveriesDone || []).forEach(item => {
      if (isTicked(item)) {
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

  // 2. Process Today's Live Deliveries
  (state.globalData.deliveries || []).forEach(d => {
    if (isTicked(d)) {
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

  // 3. Process PRIOR Weeks ONLY (e.g. 2026-W32, not current 2026-W33)
  Object.entries(weeks).forEach(([wkId, wk]) => {
    if (wkId === currentWeekId) return; // STRICT GUARD: Skip current week completely

    (wk.bounties || []).forEach(b => {
      if (isTicked(b)) {
        const baseTix = b.baseTickets !== undefined ? b.baseTickets : (b.tickets !== undefined ? b.tickets : 0);
        if (baseTix <= 0) return;

        const finalTix = baseTix + boostCount;
        const bCost = b.cost !== undefined ? b.cost : (b.itemsCost || 0);

        totalBountyTix += finalTix;
        totalSflCostAll += bCost;
      }
    });

    (wk.chores || []).forEach(c => {
      if (isTicked(c)) {
        const baseTix = c.baseTickets !== undefined ? c.baseTickets : (c.tickets !== undefined ? c.tickets : 1);
        const finalTix = baseTix > 0 ? (baseTix + boostCount) : 0;
        const cCost = c.cost !== undefined ? c.cost : (c.itemsCost || 0);

        totalChoreTix += finalTix;
        totalSflCostAll += cCost;
      }
    });
  });

  // Helper: Only items finished today with verified timestamp count for "Done Today"
  const isWeeklyItemDoneToday = (item) => {
    if (!isTicked(item)) return false;
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

  // 4. Process CURRENT Week Bounties (Single source of truth)
  (state.globalData.bounties || []).forEach(b => {
    if (isTicked(b)) {
      const baseTix = b.baseTickets !== undefined ? b.baseTickets : (b.tickets || 0);
      if (baseTix <= 0) return;

      const finalTix = baseTix + boostCount;
      const bCost = b.cost !== undefined ? b.cost : (b.itemsCost || 0);

      totalBountyTix += finalTix;
      weekBountyTix += finalTix;
      totalSflCostAll += bCost;
      weekCostAll += bCost;

      if (isWeeklyItemDoneToday(b)) {
        todayBountyTix += finalTix;
        todayCostAll += bCost;
      }
    }
  });

  // 5. Process CURRENT Week Chores (Single source of truth)
  (state.globalData.chores || []).forEach(c => {
    if (isTicked(c)) {
      const baseTix = c.baseTickets !== undefined ? c.baseTickets : (c.tickets || 1);
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

  // 6. Update Overview Card Counts
  const regularBounties = (state.globalData.bounties || []).filter(b => {
    const n = (b.name || '').toLowerCase();
    return !(n.includes('chicken') || n.includes('cow') || n.includes('sheep'));
  });
  const animalBounties = (state.globalData.bounties || []).filter(b => {
    const n = (b.name || '').toLowerCase();
    return n.includes('chicken') || n.includes('cow') || n.includes('sheep');
  });

  setElemText('deliveriesCount', `${state.globalData.deliveries?.length || 0} Orders`);
  setElemText('bountiesCount', `${regularBounties.length} Items`);
  setElemText('animalBountiesCount', `${animalBounties.length} Animals`);
  setElemText('choresCount', `${state.globalData.chores?.length || 0} Tasks`);

  // 7. Update Stats Grid & Tooltips
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
