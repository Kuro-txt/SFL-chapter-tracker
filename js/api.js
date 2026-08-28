import { 
  state, 
  getActiveBoostCount, 
  getActiveVipBonus, 
  getMondayBasedWeekId,
  getDeliveryRecords
} from './state.js';
import { recalculateAll } from './render.js';

let fetchCooldownTimer = null;

export async function loadTrackerData() {
  const farmIdInput = document.getElementById('farmId');
  const apiKeyInput = document.getElementById('apiKey');
  const fetchBtn = document.querySelector('button[onclick="loadTrackerData()"]');
  const priceBadge = document.getElementById('priceBadge');

  const farmId = farmIdInput?.value.trim() || '8472883706403914';
  const apiKey = apiKeyInput?.value.trim() || '';
  const currentUsername = state.currentUser || '';

  localStorage.setItem('sfl_farmId', farmId);

  if (fetchCooldownTimer) {
    alert('⏳ Please wait for the cooldown before fetching again.');
    return;
  }

  if (fetchBtn) {
    fetchBtn.disabled = true;
    let secondsLeft = 10;
    fetchBtn.textContent = `⏳ WAIT ${secondsLeft}s`;
    fetchCooldownTimer = setInterval(() => {
      secondsLeft--;
      if (secondsLeft > 0) {
        fetchBtn.textContent = `⏳ WAIT ${secondsLeft}s`;
      } else {
        clearInterval(fetchCooldownTimer);
        fetchCooldownTimer = null;
        fetchBtn.disabled = false;
        fetchBtn.textContent = '🌾 FETCH DATA';
      }
    }, 1000);
  }

  if (priceBadge) {
    priceBadge.style.display = 'inline-block';
    priceBadge.textContent = 'FETCHING SFL DATA...';
    priceBadge.style.background = '#FFF9C4';
    priceBadge.style.borderColor = '#FBC02D';
    priceBadge.style.color = '#F57F17';
  }

  try {
    const queryParams = new URLSearchParams({
      farmId,
      username: currentUsername
    });
    if (apiKey) queryParams.set('apiKey', apiKey);

    const res = await fetch(`/api/chapter?${queryParams.toString()}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server error (${res.status})`);
    }

    const data = await res.json();
    state.globalData = data;

    state.globalData.archiveDeliveries = getDeliveryRecords();

    if (data.vaultData) {
      state.currentVaultData = data.vaultData;
      state.globalData.archiveBounties = data.vaultData.archiveBounties || [];
      state.globalData.archiveChores = data.vaultData.archiveChores || [];
      state.globalData.npcSnapshots = data.vaultData.npcSnapshots || {};
      
      state.globalData.cloudHistory = {
        logs: data.vaultData.logs || [],
        weeks: data.vaultData.weeks || {},
        trackTickets: data.vaultData.trackTickets || 0,
        trackCost: data.vaultData.trackCost || 0,
        dailyLoginTickets: data.vaultData.dailyLoginTickets || 0
      };
    } else {
      state.globalData.cloudHistory = { logs: [], weeks: {} };
    }

    if (data.isVipActive !== undefined) {
      const vipToggle = document.getElementById('vipToggle');
      if (vipToggle) {
        vipToggle.checked = Boolean(data.isVipActive);
        localStorage.setItem('sfl_vip', vipToggle.checked);
      }
    }

    if (priceBadge) {
      priceBadge.textContent = `✔ ${data.pricesLoadedCount || 0} PRICES SYNCED & SAVED`;
      priceBadge.style.background = '#E8F5E9';
      priceBadge.style.borderColor = '#4CAF50';
      priceBadge.style.color = '#2E7D32';
    }

    recalculateAll();
  } catch (err) {
    if (priceBadge) {
      priceBadge.textContent = `❌ ${err.message}`;
      priceBadge.style.background = '#FFEBEE';
      priceBadge.style.borderColor = '#E53935';
      priceBadge.style.color = '#B71C1C';
    }
    alert(`Failed to fetch farm data: ${err.message}`);
  }
}

export async function saveProgressToCloudKV(silent = false) {
  if (!state.currentUser) {
    if (!silent) alert('Please login to save your progress in your Cloud Vault.');
    return;
  }

  const farmId = document.getElementById('farmId')?.value.trim() || '8472883706403914';
  const trackTickets = parseInt(document.getElementById('trackTicketsInput')?.value, 10) || 0;
  const trackCost = parseFloat(document.getElementById('trackCostInput')?.value) || 0;
  const dailyLoginTickets = parseInt(document.getElementById('dailyLoginCount')?.value, 10) || 0;

  const vipBonus = getActiveVipBonus();
  const boostCount = getActiveBoostCount();
  const isDoubleDeliveryActive = Boolean(state.globalData?.isDoubleDeliveryActive);
  const doubleDeliveryDates = new Set(state.globalData?.doubleDeliveryDates || []);

  const todayDate = new Date().toISOString().split('T')[0];
  const currentWeekMonday = getMondayBasedWeekId();

  // STRICTLY DELIVERIES FOR TODAY'S SNAPSHOT
  let totalEarnedTix = 0;
  let totalEarnedCost = 0;
  const todayCompletedDeliveries = [];

  let calculatedTotalTickets = trackTickets + dailyLoginTickets;
  let calculatedTotalCost = trackCost;

  // 1. Deliveries Calculation (Totals & Today Snapshot)
  const masterDeliveries = getDeliveryRecords();
  const npcDoubleClaimedInSave = new Set();

  const sortedDeliveries = [...masterDeliveries].sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));

  sortedDeliveries.forEach(d => {
    const isTicked = (d.checked !== undefined ? d.checked : Boolean(d.completed)) && !d.isSkipped;
    if (isTicked) {
      const base = d.baseTickets !== undefined ? d.baseTickets : (d.tickets || 2);
      const isManual = Boolean(d.isManual);
      const compDate = d.completedDate || (d.completedAt ? new Date(d.completedAt).toISOString().split('T')[0] : todayDate);
      const isToday = isTicked && !isManual && (compDate === todayDate);

      const isDoubleDay = doubleDeliveryDates.has(compDate) || (isDoubleDeliveryActive && compDate === todayDate);
      const npcClean = (d.from || d.name || '').toLowerCase().trim();
      const doubleKey = `${npcClean}_${compDate}`;

      let yieldAmt = base;
      if (!isManual) {
        const withBonuses = base + vipBonus + boostCount;
        if (isDoubleDay && !npcDoubleClaimedInSave.has(doubleKey)) {
          yieldAmt = withBonuses * 2;
          npcDoubleClaimedInSave.add(doubleKey);
        } else {
          yieldAmt = withBonuses;
        }
      }

      calculatedTotalTickets += yieldAmt;
      const lineCost = (d.itemsCost || d.cost || 0);
      calculatedTotalCost += lineCost;

      if (isToday) {
        totalEarnedTix += yieldAmt;
        totalEarnedCost += lineCost;
        todayCompletedDeliveries.push({
          name: d.name || d.from,
          yield: yieldAmt,
          cost: lineCost,
          weekId: d.weekId || currentWeekMonday
        });
      }
    }
  });

  // 2. Current Bounties (Total Only)
  (state.globalData?.bounties || []).forEach(b => {
    const isTicked = b.checked !== undefined ? b.checked : Boolean(b.completed);
    if (isTicked) {
      const base = b.baseTickets !== undefined ? b.baseTickets : (b.tickets || 0);
      const yieldAmt = b.isManual ? base : (base + boostCount);
      const lineCost = (b.itemsCost || b.cost || 0);
      calculatedTotalTickets += yieldAmt;
      calculatedTotalCost += lineCost;
    }
  });

  // 3. Current Chores (Total Only)
  (state.globalData?.chores || []).forEach(c => {
    const isTicked = c.checked !== undefined ? c.checked : Boolean(c.completed);
    if (isTicked) {
      const base = c.baseTickets !== undefined ? c.baseTickets : (c.tickets || 1);
      const yieldAmt = c.isManual ? base : (base + vipBonus + boostCount);
      const lineCost = (c.itemsCost || c.cost || 0);
      calculatedTotalTickets += yieldAmt;
      calculatedTotalCost += lineCost;
    }
  });

  // 4. Past Weeks Preservation & Cumulative Totals
  const existingWeeks = state.globalData?.cloudHistory?.weeks || state.currentVaultData?.weeks || {};
  const mergedWeeks = { ...existingWeeks };

  // Set current week activities
  mergedWeeks[currentWeekMonday] = {
    weekId: currentWeekMonday,
    bounties: state.globalData?.bounties || [],
    chores: state.globalData?.chores || []
  };

  // Sum up all past archived weeks into calculatedTotalTickets
  Object.entries(mergedWeeks).forEach(([wkKey, wk]) => {
    if (wkKey === currentWeekMonday) return;
    (wk.bounties || []).forEach(b => {
      if (b.completed || b.checked) {
        calculatedTotalTickets += (b.baseTickets || b.tickets || 0);
        calculatedTotalCost += (b.itemsCost || b.cost || 0);
      }
    });
    (wk.chores || []).forEach(c => {
      if (c.completed || c.checked) {
        calculatedTotalTickets += (c.isManual ? (c.baseTickets || c.tickets || 1) : ((c.baseTickets || c.tickets || 1) + vipBonus + boostCount));
        calculatedTotalCost += (c.itemsCost || c.cost || 0);
      }
    });
  });

  if (!state.globalData.cloudHistory) state.globalData.cloudHistory = { logs: [], weeks: {} };
  
  const logEntry = {
    date: todayDate,
    weekId: currentWeekMonday,
    timestamp: new Date().toISOString(),
    ticketsSaved: totalEarnedTix,
    costSaved: totalEarnedCost,
    deliveriesDone: todayCompletedDeliveries,
    milestones: state.globalData?.milestones || {}
  };

  const logs = [logEntry];
  state.globalData.cloudHistory.logs = logs;

  const payload = {
    username: state.currentUser,
    farmId,
    trackTickets,
    trackCost,
    dailyLoginTickets,
    cumulativeTickets: calculatedTotalTickets,
    cumulativeCost: calculatedTotalCost,
    lastDailyLoginDate: localStorage.getItem('sfl_daily_login_last_date') || todayDate,
    weeks: mergedWeeks,
    logs,
    deliveries: state.globalData?.deliveries || [],
    archiveDeliveries: masterDeliveries,
    bounties: state.globalData?.bounties || [],
    archiveBounties: state.globalData?.archiveBounties || [],
    chores: state.globalData?.chores || [],
    archiveChores: state.globalData?.archiveChores || [],
    milestones: state.globalData?.milestones || {},
    npcSnapshots: state.globalData?.npcSnapshots || state.currentVaultData?.npcSnapshots || {}
  };

  try {
    const res = await fetch('/api/chapter?action=saveVault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Failed to save.');

    state.currentVaultData = data.vaultData;
    if (state.globalData) {
      state.globalData.cloudHistory = {
        logs: data.vaultData.logs || [],
        weeks: data.vaultData.weeks || {}
      };
      state.globalData.archiveDeliveries = getDeliveryRecords();
      state.globalData.archiveBounties = data.vaultData.archiveBounties || [];
      state.globalData.archiveChores = data.vaultData.archiveChores || [];
      state.globalData.npcSnapshots = data.vaultData.npcSnapshots || {};
    }

    recalculateAll();

    if (!silent) {
      const totalTix = data.vaultData?.cumulativeTickets || calculatedTotalTickets;
      alert(`☁️ SAVED IN CLOUD!\n• User: ${state.currentUser}\n• Farm ID: ${farmId}\n• Total Tickets: ${totalTix}`);
    }
  } catch (err) {
    if (!silent) alert(`Cloud Save Error: ${err.message}`);
  }
}
