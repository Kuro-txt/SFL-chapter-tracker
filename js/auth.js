import { state } from './state.js';
import { recalculateAll } from './render.js';

export async function fetchUserVault(username) {
  try {
    const res = await fetch('/api/chapter?action=getVault&username=' + encodeURIComponent(username));
    const data = await res.json();
    if (data.vaultData) {
      state.currentVaultData = data.vaultData;
      if (state.globalData) {
        state.globalData.cloudHistory = state.currentVaultData;
        recalculateAll();
      }
    }
  } catch (err) {
    console.error('Failed to auto-load vault:', err);
  }
}

export async function userRegister() {
  const u = document.getElementById('authUsername').value.trim();
  const p = document.getElementById('authPassword').value;
  if (!u || !p) { alert('Please enter both username and password.'); return; }

  try {
    const res = await fetch('/api/chapter?action=register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    alert('🎉 Account registered successfully! You can now log in.');
  } catch (err) {
    alert('Registration Failed: ' + err.message);
  }
}

export async function userLogin() {
  const u = document.getElementById('authUsername').value.trim();
  const p = document.getElementById('authPassword').value;
  if (!u || !p) { alert('Please enter both username and password.'); return; }

  try {
    const res = await fetch('/api/chapter?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    state.currentUser = data.username;
    state.currentVaultData = data.vaultData || { logs: [], cumulativeTickets: 0, cumulativeCost: 0, weeks: {}, deliveries: [], bounties: [], chores: [] };
    
    localStorage.setItem('sfl_username', state.currentUser);
    document.getElementById('authLoggedOut').style.display = 'none';
    document.getElementById('authLoggedIn').style.display = 'flex';
    document.getElementById('displayUsername').textContent = state.currentUser;

    alert('🔓 Logged in successfully!');
    if (state.globalData) {
      state.globalData.cloudHistory = state.currentVaultData;
      recalculateAll();
    }
  } catch (err) {
    alert('Login Failed: ' + err.message);
  }
}

export function userLogout() {
  state.currentUser = null;
  state.currentVaultData = { logs: [], cumulativeTickets: 0, cumulativeCost: 0, weeks: {}, deliveries: [], bounties: [], chores: [] };
  localStorage.removeItem('sfl_username');
  document.getElementById('authLoggedOut').style.display = 'flex';
  document.getElementById('authLoggedIn').style.display = 'none';
  if (state.globalData) {
    state.globalData.cloudHistory = state.currentVaultData;
    recalculateAll();
  }
}
