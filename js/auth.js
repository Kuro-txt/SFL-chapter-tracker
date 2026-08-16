import { state, setElemText, checkAndAutoClaimDailyLogin } from './state.js';
import { recalculateAll } from './render.js';
import { syncCurrentVaultToCloud } from './modals.js';

export async function userRegister() {
  const u = document.getElementById('authUsername')?.value.trim();
  const p = document.getElementById('authPassword')?.value;
  if (!u || !p) return alert('Enter username & password.');

  try {
    const res = await fetch('/api/chapter?action=register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    
    alert('Account created! Logging in...');
    await userLogin(u, p);
  } catch (err) {
    alert(err.message);
  }
}

export async function userLogin(customU, customP) {
  const u = customU || document.getElementById('authUsername')?.value.trim();
  const p = customP || document.getElementById('authPassword')?.value;
  if (!u || !p) return alert('Enter username & password.');

  try {
    const res = await fetch('/api/chapter?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    state.currentUser = data.username;
    localStorage.setItem('sfl_logged_user', data.username);
    localStorage.setItem('sfl_auth_p', p);

    updateAuthUI(true);

    if (data.vaultData) {
      applyVaultToClient(data.vaultData);
    }
  } catch (err) {
    alert(err.message);
  }
}

export function userLogout() {
  state.currentUser = null;
  state.currentVaultData = null;
  localStorage.removeItem('sfl_logged_user');
  localStorage.removeItem('sfl_auth_p');
  updateAuthUI(false);
  location.reload();
}

export function updateAuthUI(isLoggedIn) {
  const loggedOutBox = document.getElementById('authLoggedOut');
  const loggedInBox = document.getElementById('authLoggedIn');
  if (isLoggedIn) {
    if (loggedOutBox) loggedOutBox.style.display = 'none';
    if (loggedInBox) loggedInBox.style.display = 'flex';
    setElemText('displayUsername', state.currentUser);
  } else {
    if (loggedOutBox) loggedOutBox.style.display = 'flex';
    if (loggedInBox) loggedInBox.style.display = 'none';
  }
}

export function applyVaultToClient(vaultData) {
  state.currentVaultData = vaultData;
  if (!state.globalData) state.globalData = {};
  state.globalData.cloudHistory = vaultData;

  if (vaultData.trackTickets !== undefined) {
    const trackInput = document.getElementById('trackTicketsInput');
    if (trackInput) trackInput.value = vaultData.trackTickets;
    localStorage.setItem('sfl_track_tix', vaultData.trackTickets);
  }
  if (vaultData.trackCost !== undefined) {
    const costInput = document.getElementById('trackCostInput');
    if (costInput) costInput.value = vaultData.trackCost;
    localStorage.setItem('sfl_track_cost', vaultData.trackCost);
  }

  // Handle Daily Login Cloud Sync
  const todayUtc = new Date().toISOString().split('T')[0];
  let cloudLoginTickets = parseInt(vaultData.dailyLoginTickets || 0, 10);
  const cloudLastDate = vaultData.lastDailyLoginDate;

  if (cloudLastDate !== todayUtc) {
    cloudLoginTickets += 1;
    vaultData.dailyLoginTickets = cloudLoginTickets;
    vaultData.lastDailyLoginDate = todayUtc;
    localStorage.setItem('sfl_daily_login_count', cloudLoginTickets);
    localStorage.setItem('sfl_daily_login_last_date', todayUtc);

    const loginInput = document.getElementById('dailyLoginCount');
    const loginCheck = document.getElementById('dailyLoginCheck');
    if (loginInput) loginInput.value = cloudLoginTickets;
    if (loginCheck) loginCheck.checked = true;

    syncCurrentVaultToCloud();
  } else {
    localStorage.setItem('sfl_daily_login_count', cloudLoginTickets);
    localStorage.setItem('sfl_daily_login_last_date', todayUtc);
    const loginInput = document.getElementById('dailyLoginCount');
    const loginCheck = document.getElementById('dailyLoginCheck');
    if (loginInput) loginInput.value = cloudLoginTickets;
    if (loginCheck) loginCheck.checked = true;
  }

  recalculateAll();
}

export async function checkSavedAuth() {
  const u = localStorage.getItem('sfl_logged_user');
  const p = localStorage.getItem('sfl_auth_p');
  if (u && p) {
    await userLogin(u, p);
  } else {
    checkAndAutoClaimDailyLogin();
  }
}
