import { state, formatSFL, setElemText, getActiveBoostCount, getActiveVipBonus, getMondayBasedWeekId, isLoginClaimedToday } from './state.js';

export function recalculateAll() {
  if (!state.globalData) return;

  const vipBonus = getActiveVipBonus();
  const boostCount = getActiveBoostCount();

  const now = new Date();
  const todayDateStr = now.toISOString().split('T')[0];
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

  // Strict check: Weekly items ONLY count for Today if an explicit timestamp proves it was finished today
  const isDoneToday = (item, category) => {
    if (!item || (!item.completed && !item.checked)) return false;
    if (item.completedAt) {
      const ts = typeof item.completedAt === 'number' ? item.completedAt : Number(item.completedAt);
      if (!isNaN(ts) && ts > 0) {
        const ms = ts < 1e11 ? ts * 1000 : ts;
        const itemDate = new Date(ms);
        const iso = itemDate.toISOString().split('T')[0];
        const loc = itemDate.toLocaleDateString('en-CA');
        return (iso === todayDateStr || loc === localTodayStr);
      }
    }
    return category === 'delivery';
  };

  // 1. DEDUPLICATE LOGS (Keep only the latest log per unique YYYY-MM-DD date)
  const seenDates = new Set();
  const uniqueLogs = [];
  rawLogs.forEach(log => {
    const cleanDate = (log.date || '').split('T')[0];
    if (!cleanDate) return;
    if (!seenDates.has(cleanDate)) {
      seenDates.add(cleanDate);
      uniqueLogs.push({ ...log, date: cleanDate });
    }
  });

  let todayHasDeliveriesInLog = false;

  // Process unique daily delivery logs
  uniqueLogs.forEach(log => {
    const isThisWeek = log.weekId === currentWeekId || (log.date && log.date.slice(0, 4) === now.getFullYear().toString());
    const isToday = (log.date === todayDateStr || log.date === localTodayStr);

    (log.deliveriesDone || []).forEach(item => {
      const isTicked = item.checked !== undefined ? item.checked : !!item.completed;
      if (isTicked) {
        const baseTix = item.baseTickets !== undefined ? item.baseTickets : (item.tickets || 2);
        const finalTix = baseTix > 0 ? (baseTix + vipBonus + boostCount) : 0;
        const itemCost = item.cost || 0;

        totalDelivTix += finalTix;
        totalSflCostAll += itemCost;

        if (isThisWeek) {
          weekDelivTix += finalTix;
          weekCostAll += itemCost;
        }
        if (isToday) {
          todayHasDeliveriesInLog = true;
          todayDelivTix += finalTix;
          todayCostAll += itemCost;
        }
      }
    });
  });

  // 2. If today's deliveries aren't in logs yet, calculate from live deliveries
  if (!todayHasDeliveriesInLog) {
    (state.globalData.deliveries || []).forEach(d => {
      if (d.completed) {
        const deliveryAddon = d.isManual ? 0 : (vipBonus + boostCount);
        const finalTix = d.baseTickets + deliveryAddon;
        const dCost = d.itemsCost || 0;

        totalDelivTix += finalTix;
        weekDelivTix += finalTix;
        todayDelivTix += finalTix;

        totalSflCostAll += dCost;
        weekCostAll += dCost;
        todayCostAll += dCost;
      }
    });
  }

  // 3. Process Past Weeks (Historical Bounties & Chores)
  Object.entries(weeks).forEach(([wkId, wk]) => {
    if (wkId === currentWeekId) return; // Skip current week here to prevent double addition

    (wk.bounties || []).forEach(b => {
      const isTicked = b.checked !== undefined ? b.checked : !!b.completed;
      if (isTicked) {
        const baseTix = b.baseTickets !== undefined ? b.baseTickets : (b.tickets || 0);
        if (baseTix <= 0) return;

        const finalTix = baseTix + boostCount;
        const bCost = b.cost !== undefined ? b.cost : (b.itemsCost || 0);

        totalBountyTix += finalTix;
        totalSflCostAll += bCost;
      }
    });

    (wk.chores || []).forEach(c => {
      const isTicked = c.checked !== undefined ? c.checked : !!c.completed;
      if (isTicked) {
        const baseTix = c.baseTickets !== undefined ? c.baseTickets : (c.tickets || 1);
        const finalTix = baseTix > 0 ? (baseTix + boostCount) : 0;
        const cCost = c.cost !== undefined ? c.cost : (c.itemsCost || 0);

        totalChoreTix += finalTix;
        totalSflCostAll += cCost;
      }
    });
  });

  // 4. Process Current Week Bounties & Chores (Merged & Deduplicated)
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
        checked: saved?.checked !== undefined ? saved.checked : liveB.completed,
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
        checked: saved?.checked !== undefined ? saved.checked : liveC.completed,
        cost: saved?.cost !== undefined ? saved.cost : (liveC.itemsCost || 0),
        baseTickets: saved?.baseTickets !== undefined ? saved.baseTickets : (saved?.tickets !== undefined ? saved.tickets : liveC.baseTickets),
        completedAt: liveC.completedAt || saved?.completedAt || null
      };
    });

  // Calculate current week bounties
  currentWeekBounties.forEach(b => {
    const isTicked = b.checked !== undefined ? b.checked : !!b.completed;
    if (isTicked) {
      const baseTix = b.baseTickets || 0;
      if (baseTix <= 0) return;

      const finalTix = baseTix + boostCount;
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

  // Calculate current week chores
  currentWeekChores.forEach(c => {
    const isTicked = c.checked !== undefined ? c.checked : !!c.completed;
    if (isTicked) {
      const baseTix = c.baseTickets || 1;
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

  // Calculate Cumulative Dashboard Totals
  const totalTicketsAll = totalDelivTix + totalBountyTix + totalChoreTix + trackTickets + totalLoginTickets;
  const weekTicketsAll = weekDelivTix + weekBountyTix + weekChoreTix + trackTickets + totalLoginTickets;
  const todayTicketsAll = todayDelivTix + todayBountyTix + todayChoreTix + todayLoginTickets;

  // 5. Update Overview Card Counts
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

  // Goal Tracker Target
  const targetGoal = parseInt(document.getElementById('targetGoalInput')?.value) || 1000;
  const targetWeeks = parseInt(document.getElementById('targetWeeksInput')?.value) || 12;
  const remainingNeeded = Math.max(0, targetGoal - totalTicketsAll);
  const targetPerWeek = targetWeeks > 0 ? Math.ceil(remainingNeeded / targetWeeks) : 0;

  setElemText('statGoalRemaining', `${remainingNeeded} Tickets`);
  setElemText('statGoalPerWeek', `${targetPerWeek} Tickets / Wk`);
}
