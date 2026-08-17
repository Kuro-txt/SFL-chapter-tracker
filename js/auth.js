import { state } from './state.js';
import { recalculateAll, renderDashboardCards } from './render.js';
import { loadTrackerData } from './api.js';

export async function userRegister() {
  const username = prompt('Choose a Username:')?.trim().toLowerCase();
  if (!username) return;
  const password = prompt('Choose a Password:');
  if (!password) return;

  const farmId = document.getElementById('farmId')?.value.trim() || '8472883706403914';

  try {
    const res = await fetch('/api/chapter?action=register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, farmId })
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Registration failed.');

    state.currentUser = username;
    localStorage.setItem('sfl_logged_user', username);
    updateAuthUI();
    alert(`🎉 Account created! Welcome, ${username}.`);
    await loadTrackerData();
  } catch (err) {
    alert(`Register Error: ${err.message}`);
  }
}

export async function userLogin() {
  const username = prompt('Enter your Username:')?.trim().toLowerCase();
  if (!username) return;
  const password = prompt('Enter your Password:');
  if (!password) return;

  const farmId = document.getElementById('farmId')?.value.trim() || '8472883706403914';

  try {
    const res = await fetch('/api/chapter?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, farmId })
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Login failed.');

    state.currentUser = username;
    localStorage.setItem('sfl_logged_user', username);
    
    if (data.vaultData) {
      state.currentVaultData = data.vaultData;
      if (state.globalData) state.globalData.cloudHistory = data.vaultData;
    }

    updateAuthUI();
    alert(`🔓 Logged in as ${username}! Loading your vault data...`);
    await loadTrackerData();
  } catch (err) {
    alert(`Login Error: ${err.message}`);
  }
}

export function userLogout() {
  state.currentUser = null;
  state.currentVaultData = null;
  localStorage.removeItem('sfl_logged_user');
  updateAuthUI();
  recalculateAll();
  renderDashboardCards();
  alert('Logged out.');
}

export function checkSavedAuth() {
  const savedUser = localStorage.getItem('sfl_logged_user');
  if (savedUser) {
    state.currentUser = savedUser;
    updateAuthUI();
    loadTrackerData();
  } else {
    updateAuthUI();
  }
}

export function updateAuthUI() {
  const authContainer = document.getElementById('authStatusContainer');
  const userStatus = document.getElementById('userStatusBadge');
  
  if (userStatus) {
    if (state.currentUser) {
      userStatus.textContent = `👤 ${state.currentUser.toUpperCase()}`;
      userStatus.style.display = 'inline-block';
    } else {
      userStatus.style.display = 'none';
    }
  }

  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (loginBtn) loginBtn.style.display = state.currentUser ? 'none' : 'inline-block';
  if (registerBtn) registerBtn.style.display = state.currentUser ? 'none' : 'inline-block';
  if (logoutBtn) logoutBtn.style.display = state.currentUser ? 'inline-block' : 'none';
}
