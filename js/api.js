import { state } from './state.js';
import { recalculateAll, renderDashboardCards } from './render.js';

let fetchCooldownTimer = null;

export async function loadTrackerData() {
  const farmIdInput = document.getElementById('farmId');
  const apiKeyInput = document.getElementById('apiKey');
  const fetchBtn = document.querySelector('button[onclick*="loadTrackerData"]');
  const priceBadge = document.getElementById('priceBadge');

  const farmId = farmIdInput?.value.trim() || localStorage.getItem('sfl_farmId') || '8472883706403914';
  const apiKey = apiKeyInput?.value.trim() || localStorage.getItem('sfl_apiKey') || '';
  const currentUsername = state.currentUser || localStorage.getItem('sfl_logged_user') || '';

  if (farmIdInput) farmIdInput.value = farmId;
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
    const queryParams = new URLSearchParams({ farmId, username: currentUsername });
    if (apiKey) queryParams.set('apiKey', apiKey);

    const res = await fetch(`/api/chapter?${queryParams.toString()}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server error (${res.status})`);
    }

    const data = await res.json();
    state.globalData = data;

    // Unpack and attach Vault Data
    const vault = data.vaultData || data.cloudHistory || state.currentVaultData;
    if (vault) {
      state.currentVaultData = vault;
      state.globalData.cloudHistory = vault;

      // Populate deliveries, bounties, chores from vault if API is empty
      if (!Array.isArray(state.globalData.deliveries) || state.globalData.deliveries.length === 0) {
        state.globalData.deliveries = vault.deliveries || (vault.logs && vault.logs[0]?.deliveriesDone) || [];
      }
      if (!Array.isArray(state.globalData.bounties) || state.globalData.bounties.length === 0) {
        state.globalData.bounties = vault.bounties || [];
      }
      if (!Array.isArray(state.globalData.chores) || state.globalData.chores.length === 0) {
        state.globalData.chores = vault.chores || [];
      }

      if (vault.trackTickets !== undefined && document.getElementById('trackTicketsInput')) {
        document.getElementById('trackTicketsInput').value = vault.trackTickets;
      }
      if (vault.trackCost !== undefined && document.getElementById('trackCostInput')) {
        document.getElementById('trackCostInput').value = vault.trackCost;
      }
      if (vault.dailyLoginTickets !== undefined && document.getElementById('dailyLoginCount')) {
        document.getElementById('dailyLoginCount').value = vault.dailyLoginTickets;
      }
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
    renderDashboardCards();
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
  const username = state.currentUser || localStorage.getItem('sfl_logged_user');
  if (!username) {
    if (!silent) alert('Please login to save your progress in your Cloud Vault.');
    return;
  }

  const farmId = document.getElementById('farmId')?.value.trim() || '8472883706403914';
  const trackTickets = parseInt(document.getElementById('trackTicketsInput')?.value, 10) || 0;
  const trackCost = parseFloat(document.getElementById('trackCostInput')?.value) || 0;
  const dailyLoginTickets = parseInt(document.getElementById('dailyLoginCount')?.value, 10) || 0;

  const payload = {
    username,
    farmId,
    trackTickets,
    trackCost,
    dailyLoginTickets,
    lastDailyLoginDate: localStorage.getItem('sfl_daily_login_last_date') || new Date().toISOString().split('T')[0],
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
    renderDashboardCards();

    if (!silent) {
      const totalTix = data.vaultData?.cumulativeTickets || 0;
      alert(`☁️ SAVED IN CLOUD!\n• User: ${username}\n• Farm ID: ${farmId}\n• Total Tickets: ${totalTix}`);
    }
  } catch (err) {
    if (!silent) alert(`Cloud Save Error: ${err.message}`);
  }
}
