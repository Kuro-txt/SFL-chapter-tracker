import { state } from './state.js';
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

    if (data.vaultData) {
      state.currentVaultData = data.vaultData;
      state.globalData.cloudHistory = data.vaultData;
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

  // Calculate total grand tickets and cost directly from frontend state
  let calculatedTotalTickets = trackTickets + dailyLoginTickets;
  let calculatedTotalCost = trackCost;

  (state.globalData?.deliveries || []).forEach(d => {
    if (d.checked || d.completed) {
      calculatedTotalTickets += (d.baseTickets !== undefined ? d.baseTickets : (d.tickets || 0));
      calculatedTotalCost += (d.itemsCost || d.cost || 0);
    }
  });

  (state.globalData?.bounties || []).forEach(b => {
    if (b.checked || b.completed) {
      calculatedTotalTickets += (b.baseTickets !== undefined ? b.baseTickets : (b.tickets || 0));
      calculatedTotalCost += (b.itemsCost || b.cost || 0);
    }
  });

  (state.globalData?.chores || []).forEach(c => {
    if (c.checked || c.completed) {
      calculatedTotalTickets += (c.baseTickets !== undefined ? c.baseTickets : (c.tickets || 0));
      calculatedTotalCost += (c.itemsCost || c.cost || 0);
    }
  });

  const payload = {
    username: state.currentUser,
    farmId,
    trackTickets,
    trackCost,
    dailyLoginTickets,
    cumulativeTickets: calculatedTotalTickets,
    cumulativeCost: calculatedTotalCost,
    lastDailyLoginDate: localStorage.getItem('sfl_daily_login_last_date') || new Date().toISOString().split('T')[0],
    weeks: state.globalData?.cloudHistory?.weeks || {},
    logs: state.globalData?.cloudHistory?.logs || [],
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
      state.globalData.cloudHistory = data.vaultData;
    }

    recalculateAll();

    if (!silent) {
      const totalTix = data.vaultData?.cumulativeTickets || calculatedTotalTickets;
      alert(`☁️ SAVED IN CLOUD!\n• User: ${state.currentUser}\n• Farm ID: ${farmId}\n• Total Tickets: ${totalTix}\n• Auto-backup schedule active.`);
    }
  } catch (err) {
    if (!silent) alert(`Cloud Save Error: ${err.message}`);
  }
}
