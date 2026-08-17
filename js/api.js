import { 
  state, 
  getActiveBoostCount, 
  getActiveVipBonus, 
  getMondayBasedWeekId,
  isLoginClaimedToday
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

    const todayDate = new Date().toISOString().split('T')[0];
    const currentWeekMonday = getMondayBasedWeekId();

    if (data.vaultData) {
      state.currentVaultData = data.vaultData;
      
      // Ensure logs array exists and has at least a default entry if empty
      let vaultLogs = data.vaultData.logs || [];
      if (vaultLogs.length === 0) {
        vaultLogs = [{
          date: todayDate,
          weekId: currentWeekMonday,
          timestamp: new Date().toISOString(),
          ticketsSaved: 0,
          costSaved: 0,
          deliveriesDone: [],
          milestones: data.vaultData.milestones || {}
        }];
        data.vaultData.logs = vaultLogs;
      }

      state.globalData.cloudHistory = {
        logs: vaultLogs,
        weeks: data.vaultData.weeks || {},
        trackTickets: data.vaultData.trackTickets || 0,
        trackCost: data.vaultData.trackCost || 0,
        dailyLoginTickets: data.vaultData.dailyLoginTickets || 0
      };
    } else {
      state.globalData.cloudHistory = {
        logs: [{
          date: todayDate,
          weekId: currentWeekMonday,
          timestamp: new Date().toISOString(),
          ticketsSaved: 0,
          costSaved: 0,
          deliveriesDone: [],
          milestones: {}
        }],
        weeks: {}
      };
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

  const todayDate = new Date().toISOString().split('T')[0];
  const currentWeekMonday = getMondayBasedWeekId();

  let todayEarnedTix = isLoginClaimedToday() ? 1 : 0;
  let todayEarnedCost = 0;
  const todayDoneItems = [];

  let calculatedTotalTickets = trackTickets + dailyLoginTickets;
  let calculatedTotalCost = trackCost;
  let doubleDeliveryApplied = false;

  (state.globalData?.deliveries || []).forEach(d => {
    const isTicked = d.checked !== undefined ? d.checked : Boolean(d.completed);
    if (isTicked) {
      const base = d.baseTickets !== undefined ? d.baseTickets : (d.tickets || 2);
      let yieldAmt = base;
      if (!d.isManual) {
        yieldAmt += (vipBonus + boostCount);
        if (isDoubleDeliveryActive && !doubleDeliveryApplied) {
          yieldAmt *= 2;
          doubleDeliveryApplied = true;
        }
      }
      calculatedTotalTickets += yieldAmt;
      const lineCost = (d.itemsCost || d.cost || 0);
      calculatedTotalCost += lineCost;

      const isToday = d.completedAt && new Date(d.completedAt).toISOString().split('T')[0] === todayDate;
      if (isToday || (!d.completedAt && (!d.weekId || d.weekId === currentWeekMonday))) {
        todayEarnedTix += yieldAmt;
        todayEarnedCost += lineCost;
        todayDoneItems.push({
          name: d.name || d.from,
          yield: yieldAmt,
          cost: lineCost
        });
      }
    }
  });

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

  if (!state.globalData.cloudHistory) state.globalData.cloudHistory = { logs: [], weeks: {} };
  const logs = [...(state.globalData.cloudHistory.logs || [])];
  
  const existingLogIdx = logs.findIndex(l => (l.date || '').split('T')[0] === todayDate);
  const logEntry = {
    date: todayDate,
    weekId: currentWeekMonday,
    timestamp: new Date().toISOString(),
    ticketsSaved: todayEarnedTix,
    costSaved: todayEarnedCost,
    deliveriesDone: todayDoneItems,
    milestones: state.globalData?.milestones || {}
  };

  if (existingLogIdx !== -1) {
    logs[existingLogIdx] = logEntry;
  } else {
    logs.unshift(logEntry);
  }

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
    weeks: state.globalData.cloudHistory.weeks || {},
    logs,
    deliveries: state.globalData?.deliveries || [],
    bounties: state.globalData?.bounties || [],
    chores: state.globalData?.chores || [],
    milestones: state.globalData?.milestones || {}
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
    }

    recalculateAll();

    if (!silent) {
      const totalTix = data.vaultData?.cumulativeTickets || calculatedTotalTickets;
      alert(`☁️ SAVED IN CLOUD!\n• User: ${state.currentUser}\n• Farm ID: ${farmId}\n• Today's Yield: +${todayEarnedTix} Tickets\n• Total Tickets: ${totalTix}`);
    }
  } catch (err) {
    if (!silent) alert(`Cloud Save Error: ${err.message}`);
  }
}
