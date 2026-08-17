import { state } from './state.js';
import { recalculateAll, renderDashboardCards } from './render.js';
import { loadTrackerData } from './api.js';

let isPromptActive = false;

export async function userRegister(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  if (isPromptActive) return;
  isPromptActive = true;

  try {
    const username = window.prompt('Choose a Username:')?.trim().toLowerCase();
    if (!username) return;
    const password = window.prompt('Choose a Password:');
    if (!password) return;

    const farmId = document.getElementById('farmId')?.value.trim() || localStorage.getItem('sfl_farmId') || '8472883706403914';

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
    
    // Pass true so loadTrackerData does not prompt again
    await loadTrackerData(true);
  } catch (err) {
    alert(`Register Error: ${err.message}`);
  } finally {
    isPromptActive = false;
  }
}

export async function userLogin(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  if (isPromptActive) return;
  isPromptActive = true;

  try {
    const username = window.prompt('Enter your Username:')?.trim().toLowerCase();
    if (!username) return;
    const password = window.prompt('Enter your Password:');
    if (!password) return;

    const farmId = document.getElementById('farmId')?.value.trim() || localStorage.getItem('sfl_farmId') || '8472883706403914';

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
      if (!state.globalData) state.globalData = {};
      state.globalData.cloudHistory = data.vaultData;
    }

    updateAuthUI();
    alert(`🔓 Logged in as ${username}! Loading your vault data...`);
    
    // Pass true so loadTrackerData does not prompt again
    await loadTrackerData(true);
  } catch (err) {
    alert(`Login Error: ${err.message}`);
  } finally {
    isPromptActive = false;
  }
}

export function userLogout(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
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
  } else {
    updateAuthUI();
  }
}

export function updateAuthUI() {
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
