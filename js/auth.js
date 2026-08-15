import { state, setElemText } from './state.js';
import { recalculateAll } from './render.js';

export function updateAuthUI() {
  const loggedOutEl = document.getElementById('authLoggedOut');
  const loggedInEl = document.getElementById('authLoggedIn');
  const displayUserEl = document.getElementById('displayUsername');

  if (state.currentUser) {
    if (loggedOutEl) loggedOutEl.style.display = 'none';
    if (loggedInEl) loggedInEl.style.display = 'flex';
    if (displayUserEl) displayUserEl.textContent = state.currentUser;
  } else {
    if (loggedOutEl) loggedOutEl.style.display = 'flex';
    if (loggedInEl) loggedInEl.style.display = 'none';
    if (displayUserEl) displayUserEl.textContent = '';
  }
}

export async function checkSavedAuth() {
  const savedUser = localStorage.getItem('sfl_vault_user');
  if (savedUser) {
    state.currentUser = savedUser;
    updateAuthUI();

    try {
      const res = await fetch(`/api/chapter?action=getVault&username=${encodeURIComponent(savedUser)}`);
      const data = await res.json();
      if (data.vaultData) {
        state.currentVaultData = data.vaultData;
        if (state.globalData) {
          state.globalData.cloudHistory = state.currentVaultData;
        }
        
        // Restore saved track inputs from cloud if present
        if (data.vaultData.trackTickets !== undefined && document.getElementById('trackTicketsInput')) {
          document.getElementById('trackTicketsInput').value = data.vaultData.trackTickets;
        }
        if (data.vaultData.trackCost !== undefined && document.getElementById('trackCostInput')) {
          document.getElementById('trackCostInput').value = data.vaultData.trackCost;
        }
        if (data.vaultData.dailyLoginTickets !== undefined && document.getElementById('dailyLoginCount')) {
          document.getElementById('dailyLoginCount').value = data.vaultData.dailyLoginTickets;
        }
        
        recalculateAll();
      }
    } catch (e) {
      console.warn('Auto-login vault fetch error:', e);
    }
  } else {
    updateAuthUI();
  }
}

export async function userRegister() {
  const username = (document.getElementById('authUsername')?.value || '').toLowerCase().trim();
  const password = document.getElementById('authPassword')?.value || '';

  if (!username || !password) {
    alert('Please enter both a username and password.');
    return;
  }

  try {
    const res = await fetch('/api/chapter?action=register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.error) {
      alert(`Registration failed: ${data.error}`);
      return;
    }

    alert(`🎉 Account created for ${data.username}! You are now logged in.`);
    state.currentUser = data.username;
    localStorage.setItem('sfl_vault_user', data.username);
    updateAuthUI();
    await checkSavedAuth();
  } catch (err) {
    alert(`Registration error: ${err.message}`);
  }
}

export async function userLogin() {
  const username = (document.getElementById('authUsername')?.value || '').toLowerCase().trim();
  const password = document.getElementById('authPassword')?.value || '';

  if (!username || !password) {
    alert('Please enter both a username and password.');
    return;
  }

  try {
    const res = await fetch('/api/chapter?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.error) {
      alert(`Login failed: ${data.error}`);
      return;
    }

    state.currentUser = data.username;
    state.currentVaultData = data.vaultData;
    if (state.globalData) {
      state.globalData.cloudHistory = state.currentVaultData;
    }
    
    localStorage.setItem('sfl_vault_user', data.username);
    updateAuthUI();

    if (data.vaultData) {
      if (data.vaultData.trackTickets !== undefined && document.getElementById('trackTicketsInput')) {
        document.getElementById('trackTicketsInput').value = data.vaultData.trackTickets;
      }
      if (data.vaultData.trackCost !== undefined && document.getElementById('trackCostInput')) {
        document.getElementById('trackCostInput').value = data.vaultData.trackCost;
      }
      if (data.vaultData.dailyLoginTickets !== undefined && document.getElementById('dailyLoginCount')) {
        document.getElementById('dailyLoginCount').value = data.vaultData.dailyLoginTickets;
      }
    }

    recalculateAll();
    alert(`✅ Welcome back, ${data.username}! Vault loaded.`);
  } catch (err) {
    alert(`Login error: ${err.message}`);
  }
}

export function userLogout() {
  state.currentUser = null;
  state.currentVaultData = null;
  localStorage.removeItem('sfl_vault_user');
  updateAuthUI();
  recalculateAll();
  alert('Logged out from Vault.');
}
