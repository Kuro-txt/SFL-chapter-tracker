import { state, setElemText } from './state.js';
import { recalculateAll } from './render.js';
import { syncCurrentVaultToCloud } from './modals.js';

export async function loadTrackerData() {
  const farmId = document.getElementById('farmId')?.value.trim();
  const apiKey = document.getElementById('apiKey')?.value.trim();

  if (!farmId) return alert('Enter a Farm ID.');

  localStorage.setItem('sfl_farmId', farmId);
  if (apiKey) localStorage.setItem('sfl_apiKey', apiKey);

  const priceBadge = document.getElementById('priceBadge');
  if (priceBadge) {
    priceBadge.style.display = 'inline-block';
    priceBadge.textContent = 'FETCHING...';
  }

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

export async function saveProgressToCloudKV() {
  if (!state.currentUser) return alert('Please login first to save progress in your cloud vault.');
  try {
    await syncCurrentVaultToCloud();
    alert('Progress saved to your Cloud Vault!');
  } catch (err) {
    alert(`Cloud Save Failed: ${err.message}`);
  }
}
