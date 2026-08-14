import { state, formatSFL, getActiveVipBonus, getActiveBoostCount } from './state.js';
import { recalculateAll } from './render.js';

export async function retryOperation(fn, retries = 3, delay = 8000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`Attempt ${i + 1} failed. Retrying in ${delay / 1000} seconds...`, err);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export async function loadTrackerData() {
  if (state.isFetchCooldown) return;

  const farmId = document.getElementById('farmId').value.trim() || '8472883706403914';
  const apiKey = document.getElementById('apiKey').value.trim();
  
  localStorage.setItem('sfl_farmId', farmId);
  localStorage.setItem('sfl_apiKey', apiKey);

  const priceBadge = document.getElementById('priceBadge');
  if (priceBadge) {
    priceBadge.style.display = 'inline-block';
    priceBadge.textContent = 'FETCHING...';
  }

  state.isFetchCooldown = true;
  const fetchButtons = document.querySelectorAll('button[onclick="loadTrackerData()"]');
  fetchButtons.forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.style.cursor = 'not-allowed';
  });

  let timeLeft = 10;
  const cooldownTimer = setInterval(() => {
    if (timeLeft > 0) {
      fetchButtons.forEach(btn => { btn.textContent = 'WAIT ' + timeLeft + 's'; });
      timeLeft--;
    } else {
      clearInterval(cooldownTimer);
      state.isFetchCooldown = false;
      fetchButtons.forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.textContent = '🌾 FETCH DATA';
      });
    }
  }, 1000);

  try {
    let queryUrl = '/api/chapter?farmId=' + encodeURIComponent(farmId);
    if (apiKey) queryUrl += '&apiKey=' + encodeURIComponent(apiKey);

    const data = await retryOperation(async () => {
      const response = await fetch(queryUrl);
      const json = await response.json();
      if (json.error) throw new Error(json.error);
      return json;
    }, 3, 8000);

    state.globalData = data;
    state.globalData.cloudHistory = state.currentVaultData;

    if (priceBadge) {
      priceBadge.textContent = data.pricesLoadedCount > 0 ? `${data.pricesLoadedCount} PRICES LOADED` : 'PRICE API OFFLINE';
    }

    if (localStorage.getItem('sfl_vip') === null) {
      document.getElementById('vipToggle').checked = data.isVipActive;
      localStorage.setItem('sfl_vip', data.isVipActive);
    }

    recalculateAll();
  } catch (err) {
    alert('Error fetching data after 3 attempts: ' + err.message);
  }
}

export async function saveProgressToCloudKV() {
  if (!state.currentUser) {
    alert('⚠️ Please LOGIN to your secure vault before saving to Cloud!');
    return;
  }
  if (!state.globalData) {
    alert('Please click "FETCH DATA" first before saving!');
    return;
  }

  let dailyDelivTickets = 0;
  let dailyDelivCost = 0;
  const vipBonus = getActiveVipBonus();
  const boostCount = getActiveBoostCount();

  (state.globalData.deliveries || []).forEach(d => {
    if (d.completed) {
      const deliveryAddon = d.isManual ? 0 : (vipBonus + boostCount);
      dailyDelivTickets += (d.baseTickets + deliveryAddon);
      dailyDelivCost += (d.itemsCost || 0);
    }
  });

  const trackTickets = parseInt(document.getElementById('trackTicketsInput').value) || 0;
  const trackCost = parseFloat(document.getElementById('trackCostInput').value) || 0;

  try {
    const response = await fetch('/api/chapter?action=saveVault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: state.currentUser,
        dailyDeliveryTicketsSaved: dailyDelivTickets,
        dailyDeliveryCostSaved: dailyDelivCost,
        trackTickets: trackTickets,
        trackCost: trackCost,
        deliveries: state.globalData.deliveries,
        bounties: state.globalData.bounties,
        chores: state.globalData.chores
      })
    });

    const resData = await response.json();
    if (resData.error) throw new Error(resData.error);

    state.currentVaultData = resData.vaultData;
    state.globalData.cloudHistory = state.currentVaultData;

    alert(`☁️ SAVED IN CLOUD!\nDaily Deliveries: +${dailyDelivTickets} Tickets, ${formatSFL(dailyDelivCost)} SFL\nTrack Progress: ${trackTickets} Tickets (${formatSFL(trackCost)} SFL)\nWeekly Bounties & Chores Synced!`);
    recalculateAll();
  } catch (err) {
    alert('Cloud Save Failed: ' + err.message);
  }
}
