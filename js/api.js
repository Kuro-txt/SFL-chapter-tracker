import { state, formatSFL } from './state.js';
import { recalculateAll } from './render.js';
import { syncCurrentVaultToCloud } from './modals.js';

let isFetchCooldownActive = false;

export async function loadTrackerData() {
  if (isFetchCooldownActive) {
    return;
  }

  const farmId = document.getElementById('farmId')?.value.trim();
  const apiKey = document.getElementById('apiKey')?.value.trim();
  const fetchBtn = document.querySelector('button[onclick="loadTrackerData()"]');

  if (!farmId) return alert('Enter a Farm ID.');

  localStorage.setItem('sfl_farmId', farmId);
  if (apiKey) localStorage.setItem('sfl_apiKey', apiKey);

  const priceBadge = document.getElementById('priceBadge');
  if (priceBadge) {
    priceBadge.style.display = 'inline-block';
    priceBadge.textContent = 'FETCHING...';
  }

  // Start 10s Countdown Timer on Button
  startFetchCooldown(fetchBtn);

  try {
    const userParam = state.currentUser ? `&username=${encodeURIComponent(state.currentUser)}` : '';
    const res = await fetch(`/api/chapter?farmId=${encodeURIComponent(farmId)}&apiKey=${encodeURIComponent(apiKey)}${userParam}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to fetch tracker data.');

    const currentHistory = state.globalData?.cloudHistory || state.currentVaultData || { logs: [], weeks: {} };
    
    state.globalData = {
      ...data,
      cloudHistory: currentHistory
    };

    if (data.isVipActive) {
      const vipToggle = document.getElementById('vipToggle');
      if (vipToggle) {
        vipToggle.checked = true;
        localStorage.setItem('sfl_vip', 'true');
      }
    }

    if (priceBadge) {
      priceBadge.textContent = `PRICES LOADED (${data.pricesLoadedCount || 0})`;
    }

    recalculateAll();
    await syncCurrentVaultToCloud();
  } catch (err) {
    alert(`Tracker Fetch Error: ${err.message}`);
    if (priceBadge) priceBadge.textContent = 'FETCH FAILED';
  }
}

function startFetchCooldown(btn) {
  if (!btn) return;
  isFetchCooldownActive = true;
  btn.disabled = true;
  btn.style.opacity = '0.6';
  btn.style.cursor = 'not-allowed';

  let remaining = 10;
  btn.textContent = `⏳ WAIT ${remaining}s`;

  const interval = setInterval(() => {
    remaining -= 1;
    if (remaining > 0) {
      btn.textContent = `⏳ WAIT ${remaining}s`;
    } else {
      clearInterval(interval);
      isFetchCooldownActive = false;
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.textContent = '🌾 FETCH DATA';
    }
  }, 1000);
}

export async function saveProgressToCloudKV() {
  if (!state.currentUser) return alert('Please login first to save progress in your cloud vault.');
  try {
    await syncCurrentVaultToCloud();

    // Read current calculated totals from DOM/State to show exact saved numbers
    const totalTixText = document.getElementById('statTotalTickets')?.textContent || '0 Tickets';
    const totalCostText = document.getElementById('statTotalCost')?.textContent || '0.00 SFL';
    const todayTixText = document.getElementById('statEarnedTickets')?.textContent || '0 Tickets';

    alert(`☁️ CLOUD VAULT SYNCED!\n\n🏆 Total Saved: ${totalTixText} (${totalCostText})\n✨ Done Today: ${todayTixText}\n\nYour snapshot is permanently locked in Cloudflare KV.`);
  } catch (err) {
    alert(`Cloud Save Failed: ${err.message}`);
  }
}
