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

  // Category trackers
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

    // Deliveries reset daily, so checked active deliveries are for today
    if (category === 'delivery') {
      return true;
    }

    // Weekly bounties and chores do NOT default to today without a proven today's timestamp
    return false;
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
    if (wkId === currentWeekId) return;

    (wk.bounties || []).forEach(b => {
      const isTicked = b.checked !== undefined ? b.checked : !!b.completed;
      if (isTicked) {
        const baseTix = b.tickets !== undefined ? b.tickets : (b.baseTickets || 0);
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
        const baseTix = c.tickets !== undefined ? c.tickets : (c.baseTickets || 1);
        const finalTix = baseTix > 0 ? (baseTix + boostCount) : 0;
        const cCost = c.cost !== undefined ? c.cost : (c.itemsCost || 0);

        totalChoreTix += finalTix;
        totalSflCostAll += cCost;
      }
    });
  });

  // 3. Process Current Week Bounties & Chores
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
        tickets: saved?.tickets !== undefined ? saved.tickets : liveB.baseTickets,
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
        tickets: saved?.tickets !== undefined ? saved.tickets : liveC.baseTickets,
        completedAt: liveC.completedAt || saved?.completedAt || null
      };
    });

  // Calculate Current Week Bounties
  currentWeekBounties.forEach(b => {
    const isTicked = b.checked !== undefined ? b.checked : !!b.completed;
    if (isTicked) {
      const baseTix = b.tickets !== undefined ? b.tickets : (b.baseTickets || 0);
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

  // Calculate Current Week Chores
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

  // 4. Process Live Active Deliveries for Today (if not already counted in logs)
  const sortedDeliveries = [...(state.globalData.deliveries || [])].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));

  if (todayDelivTix === 0) {
    sortedDeliveries.forEach(d => {
      if (d.completed) {
        const deliveryAddon = d.isManual ? 0 : (vipBonus + boostCount);
        todayDelivTix += (d.baseTickets + deliveryAddon);
        todayCostAll += (d.itemsCost || 0);
      }
    });
  }

  const totalTicketsAll = totalDelivTix + totalBountyTix + totalChoreTix + trackTickets;
  const weekTicketsAll = weekDelivTix + weekBountyTix + weekChoreTix + trackTickets;
  const todayTicketsAll = todayDelivTix + todayBountyTix + todayChoreTix;

  // 5. Update Counts on Overview Cards
  const allBounties = currentWeekBounties;
  const regularBounties = allBounties.filter(b => {
    const n = (b.name || '').toLowerCase();
    return !(n.includes('chicken') || n.includes('cow') || n.includes('sheep'));
  });
  const animalBounties = allBounties.filter(b => {
    const n = (b.name || '').toLowerCase();
    return n.includes('chicken') || n.includes('cow') || n.includes('sheep');
  });

  setElemText('deliveriesCount', `${state.globalData.deliveries?.length || 0} Orders`);
  setElemText('bountiesCount', `${regularBounties.length} Items`);
  setElemText('animalBountiesCount', `${animalBounties.length} Animals`);
  setElemText('choresCount', `${currentWeekChores.length} Tasks`);

  // 6. Update Performance Metrics & Tooltip Values
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
  setElemText('tipTotalChore', `🧹 Chores: ${totalChoreTix} Tix`);
  setElemText('tipTotalTrack', `🛤️ Track: ${trackTickets} Tix (${formatSFL(trackCost)} SFL)`);

  setElemText('tipWeekDeliv', `📦 Deliveries: ${weekDelivTix} Tix`);
  setElemText('tipWeekBounty', `📜 Bounties: ${weekBountyTix} Tix`);
  setElemText('tipWeekChore', `🧹 Chores: ${weekChoreTix} Tix`);
  setElemText('tipWeekTrack', `🛤️ Track: ${trackTickets} Tix (${formatSFL(trackCost)} SFL)`);

  setElemText('tipTodayDeliv', `📦 Deliveries: ${todayDelivTix} Tix`);
  setElemText('tipTodayBounty', `📜 Bounties: ${todayBountyTix} Tix`);
  setElemText('tipTodayChore', `🧹 Chores: ${todayChoreTix} Tix`);

  // Goal Calculator
  const targetGoal = parseInt(document.getElementById('targetGoalInput').value) || 1000;
  const targetWeeks = parseInt(document.getElementById('targetWeeksInput').value) || 12;
  const remainingNeeded = Math.max(0, targetGoal - totalTicketsAll);
  const targetPerWeek = targetWeeks > 0 ? Math.ceil(remainingNeeded / targetWeeks) : 0;

  setElemText('statGoalRemaining', `${remainingNeeded} Tickets`);
  setElemText('statGoalPerWeek', `${targetPerWeek} Tickets / Wk`);
}
