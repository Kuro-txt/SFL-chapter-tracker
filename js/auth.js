import { state } from './state.js';
import { recalculateAll } from './render.js';
import { loadTrackerData } from './api.js';

export async function userRegister() {
  const usernameInput = document.getElementById('authUsername');
  const passwordInput = document.getElementById('authPassword');
  const farmIdInput = document.getElementById('farmId');

  const username = usernameInput?.value.trim().toLowerCase();
  const password = passwordInput?.value.trim();
  const farmId = farmIdInput?.value.trim() || '8472883706403914';

  if (!username || !password) {
    alert('Please enter both a username and password to register.');
    return;
  }

  try {
    const res = await fetch('/api/chapter?action=register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, farmId })
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Registration failed.');

    localStorage.setItem('sfl_farmId', farmId);
    alert(`Account "${username}" registered and linked to Farm #${farmId}! Logging you in...`);
    await userLogin();
  } catch (err) {
    alert(`Registration Error: ${err.message}`);
  }
}

export async function userLogin() {
  const usernameInput = document.getElementById('authUsername');
  const passwordInput = document.getElementById('authPassword');
  const farmIdInput = document.getElementById('farmId');

  const username = usernameInput?.value.trim().toLowerCase();
  const password = passwordInput?.value.trim();
  const farmId = farmIdInput?.value.trim() || localStorage.getItem('sfl_farmId') || '8472883706403914';

  if (!username || !password) {
    alert('Please enter your username and password.');
    return;
  }

  try {
    const res = await fetch('/api/chapter?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, farmId })
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Login failed.');

    state.currentUser = data.username;
    state.currentVaultData = data.vaultData;

    localStorage.setItem('sfl_auth_user', data.username);

    const activeFarmId = data.vaultData?.farmId || farmId;
    if (farmIdInput) farmIdInput.value = activeFarmId;
    localStorage.setItem('sfl_farmId', activeFarmId);

    updateAuthUI(true, data.username);

    if (data.vaultData?.dailyLoginTickets !== undefined) {
      const loginCountEl = document.getElementById('dailyLoginCount');
      if (loginCountEl) loginCountEl.value = data.vaultData.dailyLoginTickets;
      localStorage.setItem('sfl_daily_login_count', data.vaultData.dailyLoginTickets);
    }

    if (data.vaultData?.trackTickets !== undefined) {
      const trackTixEl = document.getElementById('trackTicketsInput');
      if (trackTixEl) trackTixEl.value = data.vaultData.trackTickets;
    }
    if (data.vaultData?.trackCost !== undefined) {
      const trackCostEl = document.getElementById('trackCostInput');
      if (trackCostEl) trackCostEl.value = data.vaultData.trackCost;
    }

    if (state.globalData) {
      state.globalData.cloudHistory = data.vaultData;
    }

    recalculateAll();
    loadTrackerData();
  } catch (err) {
    alert(`Login Error: ${err.message}`);
  }
}

export function userLogout() {
  state.currentUser = null;
  state.currentVaultData = null;
  localStorage.removeItem('sfl_auth_user');

  updateAuthUI(false, '');
  if (state.globalData) {
    state.globalData.cloudHistory = null;
  }
  recalculateAll();
}

export async function checkSavedAuth() {
  const savedUser = localStorage.getItem('sfl_auth_user');
  if (!savedUser) return;

  try {
    const res = await fetch(`/api/chapter?action=getVault&username=${encodeURIComponent(savedUser)}`);
    const data = await res.json();
    if (data.vaultData) {
      state.currentUser = savedUser;
      state.currentVaultData = data.vaultData;

      if (data.vaultData.farmId) {
        const farmIdInput = document.getElementById('farmId');
        if (farmIdInput) farmIdInput.value = data.vaultData.farmId;
        localStorage.setItem('sfl_farmId', data.vaultData.farmId);
      }

      updateAuthUI(true, savedUser);

      if (data.vaultData.dailyLoginTickets !== undefined) {
        const loginCountEl = document.getElementById('dailyLoginCount');
        if (loginCountEl) loginCountEl.value = data.vaultData.dailyLoginTickets;
        localStorage.setItem('sfl_daily_login_count', data.vaultData.dailyLoginTickets);
      }

      if (state.globalData) {
        state.globalData.cloudHistory = data.vaultData;
      }
      recalculateAll();
    }
  } catch (e) {}
}

function updateAuthUI(isLoggedIn, username) {
  const loggedOutBox = document.getElementById('authLoggedOut');
  const loggedInBox = document.getElementById('authLoggedIn');
  const displayUser = document.getElementById('displayUsername');

  if (isLoggedIn) {
    if (loggedOutBox) loggedOutBox.style.display = 'none';
    if (loggedInBox) loggedInBox.style.display = 'flex';
    if (displayUser) displayUser.textContent = username;
  } else {
    if (loggedOutBox) loggedOutBox.style.display = 'flex';
    if (loggedInBox) loggedInBox.style.display = 'none';
    if (displayUser) displayUser.textContent = '';
  }
}
