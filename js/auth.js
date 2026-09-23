import { state, checkAndAutoClaimDailyLogin } from './state.js';
import { recalculateAll } from './render.js';
import { loadTrackerData } from './api.js';

// ==========================================
// REGISTRATION & AUTH GATE CONTROLS
// ==========================================

export function showRegistrationGate(tab = 'register', message = '') {
  const gateModal = document.getElementById('registrationGateModal');
  const appWrapper = document.querySelector('.wrapper');

  if (gateModal) gateModal.style.display = 'flex';
  if (appWrapper) appWrapper.classList.add('app-gated');

  switchGateTab(tab);

  if (message) {
    setGateStatus(message, 'error');
  } else {
    clearGateStatus();
  }
}

export function hideRegistrationGate() {
  const gateModal = document.getElementById('registrationGateModal');
  const appWrapper = document.querySelector('.wrapper');

  if (gateModal) gateModal.style.display = 'none';
  if (appWrapper) appWrapper.classList.remove('app-gated');

  clearGateStatus();
}

export function switchGateTab(tab) {
  const regBtn = document.getElementById('gateTabRegisterBtn');
  const loginBtn = document.getElementById('gateTabLoginBtn');
  const regForm = document.getElementById('gateRegisterForm');
  const loginForm = document.getElementById('gateLoginForm');

  clearGateStatus();

  if (tab === 'login') {
    if (regBtn) regBtn.classList.remove('active');
    if (loginBtn) loginBtn.classList.add('active');
    if (regForm) regForm.style.display = 'none';
    if (loginForm) loginForm.style.display = 'block';

    const loginUser = document.getElementById('gateLoginUsername');
    if (loginUser) loginUser.focus();
  } else {
    if (regBtn) regBtn.classList.add('active');
    if (loginBtn) loginBtn.classList.remove('active');
    if (regForm) regForm.style.display = 'block';
    if (loginForm) loginForm.style.display = 'none';

    const regUser = document.getElementById('gateRegUsername');
    if (regUser) regUser.focus();
  }
}

export function setGateStatus(message, type = 'error') {
  const statusEl = document.getElementById('gateStatusMsg');
  if (!statusEl) return;

  statusEl.className = `gate-status-alert ${type}`;
  statusEl.innerHTML = message;
}

export function clearGateStatus() {
  const statusEl = document.getElementById('gateStatusMsg');
  if (!statusEl) return;

  statusEl.className = 'gate-status-alert';
  statusEl.innerHTML = '';
  statusEl.style.display = 'none';
}

export async function handleGateRegister(event) {
  if (event) event.preventDefault();
  await userRegister();
}

export async function handleGateLogin(event) {
  if (event) event.preventDefault();
  await userLogin();
}

// ==========================================
// USER REGISTER & LOGIN ACTIONS
// ==========================================

export async function userRegister(customUsername, customPassword, customFarmId) {
  const regUserEl = document.getElementById('gateRegUsername') || document.getElementById('authUsername');
  const regPassEl = document.getElementById('gateRegPassword') || document.getElementById('authPassword');
  const regFarmEl = document.getElementById('gateRegFarmId') || document.getElementById('farmId');

  const username = (customUsername || regUserEl?.value || '').trim().toLowerCase();
  const password = (customPassword || regPassEl?.value || '').trim();
  let farmId = (customFarmId || regFarmEl?.value || '').trim();

  if (!username || !password) {
    setGateStatus('⚠️ Please enter both a username and password to register.', 'error');
    if (!username && regUserEl) regUserEl.focus();
    else if (!password && regPassEl) regPassEl.focus();
    return;
  }

  if (!farmId) {
    farmId = prompt('Please enter your Sunflower Land Farm ID to link to your account:');
    if (farmId) farmId = farmId.trim();
  }

  if (!farmId) {
    setGateStatus('⚠️ A valid Sunflower Land Farm ID is required to register an account.', 'error');
    if (regFarmEl) regFarmEl.focus();
    return;
  }

  const submitBtn = document.getElementById('gateRegSubmitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ REGISTERING...';
  }
  setGateStatus('🌾 Registering farmer vault...', 'loading');

  try {
    const res = await fetch('/api/chapter?action=register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, farmId })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || 'Registration failed.');

    localStorage.setItem('sfl_farmId', farmId);
    setGateStatus(`🎉 Account "${username}" registered! Logging you in...`, 'success');

    // Auto-login into vault
    await userLogin(username, password, farmId);
  } catch (err) {
    setGateStatus(`❌ Registration Error: ${err.message}`, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '🌻 REGISTER & ENTER VAULT';
    }
  }
}

export async function userLogin(customUsername, customPassword, customFarmId) {
  const loginUserEl = document.getElementById('gateLoginUsername') || document.getElementById('authUsername');
  const loginPassEl = document.getElementById('gateLoginPassword') || document.getElementById('authPassword');
  const farmIdInput = document.getElementById('farmId');

  const username = (customUsername || loginUserEl?.value || '').trim().toLowerCase();
  const password = (customPassword || loginPassEl?.value || '').trim();
  const farmId = (customFarmId || farmIdInput?.value || '').trim();

  if (!username || !password) {
    setGateStatus('⚠️ Please enter your username and password.', 'error');
    if (!username && loginUserEl) loginUserEl.focus();
    else if (!password && loginPassEl) loginPassEl.focus();
    return;
  }

  const submitBtn = document.getElementById('gateLoginSubmitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ LOGGING IN...';
  }
  setGateStatus('🔓 Opening farmer vault...', 'loading');

  try {
    const res = await fetch('/api/chapter?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, farmId })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || 'Login failed.');

    state.currentUser = data.username;
    state.currentVaultData = data.vaultData;

    localStorage.setItem('sfl_auth_user', data.username);

    const activeFarmId = data.vaultData?.farmId || farmId;
    if (activeFarmId && farmIdInput) {
      farmIdInput.value = activeFarmId;
      localStorage.setItem('sfl_farmId', activeFarmId);
    }

    updateAuthUI(true, data.username, activeFarmId);

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
      if (data.vaultData?.archiveDeliveries) state.globalData.archiveDeliveries = data.vaultData.archiveDeliveries;
      if (data.vaultData?.archiveBounties) state.globalData.archiveBounties = data.vaultData.archiveBounties;
      if (data.vaultData?.archiveChores) state.globalData.archiveChores = data.vaultData.archiveChores;
    }

    hideRegistrationGate();

    await checkAndAutoClaimDailyLogin();
    recalculateAll();
    loadTrackerData();
  } catch (err) {
    setGateStatus(`❌ Login Error: ${err.message}`, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '🔓 LOGIN & OPEN VAULT';
    }
  }
}

export function userLogout() {
  state.currentUser = null;
  state.currentVaultData = null;
  localStorage.removeItem('sfl_auth_user');
  localStorage.removeItem('sfl_farmId');
  const farmIdInput = document.getElementById('farmId');
  if (farmIdInput) farmIdInput.value = '';

  updateAuthUI(false, '', '');
  if (state.globalData) {
    state.globalData.cloudHistory = null;
  }
  recalculateAll();

  showRegistrationGate('login', 'You have been logged out. Please log in or register to enter your vault.');
}

export async function checkSavedAuth() {
  const savedUser = localStorage.getItem('sfl_auth_user');
  if (!savedUser) {
    showRegistrationGate('register');
    return;
  }

  try {
    const res = await fetch(`/api/chapter?action=getVault&username=${encodeURIComponent(savedUser)}`);
    if (!res.ok) {
      showRegistrationGate('login', 'Session expired. Please log in again.');
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (data && data.vaultData) {
      state.currentUser = savedUser;
      state.currentVaultData = data.vaultData;

      const farmId = data.vaultData.farmId || '';
      if (farmId) {
        const farmIdInput = document.getElementById('farmId');
        if (farmIdInput) farmIdInput.value = farmId;
        localStorage.setItem('sfl_farmId', farmId);
      }

      updateAuthUI(true, savedUser, farmId);
      hideRegistrationGate();

      if (data.vaultData.dailyLoginTickets !== undefined) {
        const loginCountEl = document.getElementById('dailyLoginCount');
        if (loginCountEl) loginCountEl.value = data.vaultData.dailyLoginTickets;
        localStorage.setItem('sfl_daily_login_count', data.vaultData.dailyLoginTickets);
      }

      if (state.globalData) {
        state.globalData.cloudHistory = data.vaultData;
        if (data.vaultData.archiveDeliveries) state.globalData.archiveDeliveries = data.vaultData.archiveDeliveries;
        if (data.vaultData.archiveBounties) state.globalData.archiveBounties = data.vaultData.archiveBounties;
        if (data.vaultData.archiveChores) state.globalData.archiveChores = data.vaultData.archiveChores;
      }

      await checkAndAutoClaimDailyLogin();
      recalculateAll();
    } else {
      showRegistrationGate('login', 'User vault not found. Please log in or register.');
    }
  } catch (e) {
    console.warn('Silent auth check warning:', e.message);
    showRegistrationGate('login', 'Could not verify session. Please log in.');
  }
}

function updateAuthUI(isLoggedIn, username, farmId = '') {
  const loggedOutBox = document.getElementById('authLoggedOut');
  const loggedInBox = document.getElementById('authLoggedIn');
  const displayUser = document.getElementById('displayUsername');
  const displayFarmId = document.getElementById('displayFarmId');

  if (isLoggedIn) {
    if (loggedOutBox) loggedOutBox.style.display = 'none';
    if (loggedInBox) loggedInBox.style.display = 'flex';
    if (displayUser) displayUser.textContent = username;
    if (displayFarmId) displayFarmId.textContent = farmId || '---';
  } else {
    if (loggedOutBox) loggedOutBox.style.display = 'flex';
    if (loggedInBox) loggedInBox.style.display = 'none';
    if (displayUser) displayUser.textContent = '';
    if (displayFarmId) displayFarmId.textContent = '---';
  }
}
