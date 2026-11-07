import { loadTrackerData, saveProgressToCloudKV, showToast } from './api.js';
import { 
  userRegister, 
  userLogin, 
  userLogout, 
  checkSavedAuth,
  showRegistrationGate,
  hideRegistrationGate,
  switchGateTab,
  handleGateRegister,
  handleGateLogin
} from './auth.js';
import { 
  toggleGuideModal, 
  openCategorySummaryModal, 
  closeCategorySummaryModal, 
  openWeekBreakdownModal, 
  openColumnHistoryModal, 
  closeColumnHistoryModal, 
  renderColumnHistoryModalList, 
  addNewItemFromModal, 
  toggleDeliveryLogCheck, 
  deleteDeliveryLogItem, 
  toggleWeeklyItemCheck, 
  updateHistoryItemTickets, 
  updateHistoryItemCost, 
  deleteWeeklyItem,
  openChapterLogsModal,
  closeChapterLogsModal,
  setChapterLogBoost,
  setChapterLogVip,
  snapshotCurrentChapter,
  deleteChapterLog,
  exportChapterLog,
  openItemsBurnedModal,
  closeItemsBurnedModal,
  renderItemsBurnedList,
  toggleBurnedViewMode,
  openBoostsCostModal,
  closeBoostsCostModal,
  updateBoostModalPreview,
  saveBoostCostsFromModal,
  resetBoostCostsToDefault
} from './modals.js';
import { 
  recalculateAll,
  showChartTooltip,
  moveChartTooltip,
  hideChartTooltip,
  switchChartTab
} from './render.js';
import { 
  setProjectionScenario,
  togglePlannerNpc,
  setPlannerNpcDays,
  togglePlannerDoubleDelivery,
  setPlannerOverrideWeek,
  resetPlannerOverride,
  togglePlannerNpcDouble,
  toggleAllNpcDouble,
  setPlannerSectionTab,
  togglePlannerBounty,
  setPlannerBountyCount,
  setPlannerRegularBountyTix,
  setPlannerAnimalBountyTix,
  setPlannerBountyCustomTix,
  togglePlannerBountyCustom,
  togglePlannerChore,
  setPlannerChoreCount,
  setPlannerChoreTix,
  setPlannerChoreCustomTix,
  togglePlannerChoreCustom,
  togglePlannerLogin,
  togglePlannerTrack,
  setPlannerTrackTix,
  togglePlannerStackedDeliveries
} from './projections.js';
import { state, checkAndAutoClaimDailyLogin, handleDailyLoginToggle, recomputeCoinCosts } from './state.js';
import { calculateTrackTickets } from './chapter-tracks.js';

// ==========================================
// THEME MANAGER (Dark / Light Mode)
// ==========================================
export function applyTheme(theme) {
  const isDark = theme === 'dark';
  const toggleBtn = document.getElementById('themeToggleBtn');
  const gateToggleBtn = document.getElementById('gateThemeToggleBtn');

  if (isDark) {
    document.body.classList.add('dark-mode');
    if (toggleBtn) toggleBtn.innerHTML = '☀️ LIGHT';
    if (gateToggleBtn) gateToggleBtn.innerHTML = '☀️ LIGHT';
  } else {
    document.body.classList.remove('dark-mode');
    if (toggleBtn) toggleBtn.innerHTML = '🌙 DARK';
    if (gateToggleBtn) gateToggleBtn.innerHTML = '🌙 DARK';
  }

  localStorage.setItem('sfl_theme', theme);
  try {
    recalculateAll();
  } catch (e) {}
}

export function toggleTheme() {
  const isCurrentlyDark = document.body.classList.contains('dark-mode');
  applyTheme(isCurrentlyDark ? 'light' : 'dark');
}

export async function copyDonateAddress() {
  const address = '0x55b97223202457d427a68389346da9a9314d0511';
  let copied = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(address);
      copied = true;
    }
  } catch (err) {
    console.warn('Clipboard writeText failed, trying fallback...', err);
  }

  if (!copied) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = address;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      copied = document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch (e) {
      console.error('Fallback execCommand copy failed', e);
    }
  }

  const btn = document.getElementById('donateBtn');
  const btnText = document.getElementById('donateBtnText');
  if (btn && btnText) {
    const origText = 'DONATE';
    btn.classList.add('copied');
    btnText.textContent = 'COPIED! ✨';
    btn.setAttribute('title', 'Address copied to clipboard!');

    if (window._donateTimeout) clearTimeout(window._donateTimeout);
    window._donateTimeout = setTimeout(() => {
      btn.classList.remove('copied');
      btnText.textContent = origText;
      btn.setAttribute('title', 'Copy donation address (0x55b9...0511)');
    }, 2500);
  }
}

// Expose handlers to window for inline HTML events
window.copyDonateAddress = copyDonateAddress;
window.toggleTheme = toggleTheme;
window.loadTrackerData = loadTrackerData;
window.saveProgressToCloudKV = saveProgressToCloudKV;
window.showToast = showToast;
window.userRegister = userRegister;
window.userLogin = userLogin;
window.userLogout = userLogout;
window.showRegistrationGate = showRegistrationGate;
window.hideRegistrationGate = hideRegistrationGate;
window.switchGateTab = switchGateTab;
window.handleGateRegister = handleGateRegister;
window.handleGateLogin = handleGateLogin;
window.toggleGuideModal = toggleGuideModal;
window.updateChapterCountdown = updateChapterCountdown;
window.openCategorySummaryModal = openCategorySummaryModal;
window.closeCategorySummaryModal = closeCategorySummaryModal;
window.openWeekBreakdownModal = openWeekBreakdownModal;
window.switchChartTab = switchChartTab;
window.setProjectionScenario = setProjectionScenario;
window.togglePlannerNpc = togglePlannerNpc;
window.setPlannerNpcDays = setPlannerNpcDays;
window.togglePlannerDoubleDelivery = togglePlannerDoubleDelivery;
window.setPlannerOverrideWeek = setPlannerOverrideWeek;
window.resetPlannerOverride = resetPlannerOverride;
window.togglePlannerNpcDouble = togglePlannerNpcDouble;
window.toggleAllNpcDouble = toggleAllNpcDouble;
window.setPlannerSectionTab = setPlannerSectionTab;
window.togglePlannerBounty = togglePlannerBounty;
window.setPlannerBountyCount = setPlannerBountyCount;
window.setPlannerRegularBountyTix = setPlannerRegularBountyTix;
window.setPlannerAnimalBountyTix = setPlannerAnimalBountyTix;
window.setPlannerBountyCustomTix = setPlannerBountyCustomTix;
window.togglePlannerBountyCustom = togglePlannerBountyCustom;
window.togglePlannerChore = togglePlannerChore;
window.setPlannerChoreCount = setPlannerChoreCount;
window.setPlannerChoreTix = setPlannerChoreTix;
window.setPlannerChoreCustomTix = setPlannerChoreCustomTix;
window.togglePlannerChoreCustom = togglePlannerChoreCustom;
window.togglePlannerLogin = togglePlannerLogin;
window.togglePlannerTrack = togglePlannerTrack;
window.setPlannerTrackTix = setPlannerTrackTix;
window.togglePlannerStackedDeliveries = togglePlannerStackedDeliveries;
window.showChartTooltip = showChartTooltip;
window.moveChartTooltip = moveChartTooltip;
window.hideChartTooltip = hideChartTooltip;
window.openColumnHistoryModal = openColumnHistoryModal;
window.closeColumnHistoryModal = closeColumnHistoryModal;
window.renderColumnHistoryModalList = renderColumnHistoryModalList;
window.addNewItemFromModal = addNewItemFromModal;
window.toggleDeliveryLogCheck = toggleDeliveryLogCheck;
window.deleteDeliveryLogItem = deleteDeliveryLogItem;
window.toggleWeeklyItemCheck = toggleWeeklyItemCheck;
window.updateHistoryItemTickets = updateHistoryItemTickets;
window.updateHistoryItemCost = updateHistoryItemCost;
window.deleteWeeklyItem = deleteWeeklyItem;
window.openChapterLogsModal = openChapterLogsModal;
window.closeChapterLogsModal = closeChapterLogsModal;
window.setChapterLogBoost = setChapterLogBoost;
window.setChapterLogVip = setChapterLogVip;
window.snapshotCurrentChapter = snapshotCurrentChapter;
window.deleteChapterLog = deleteChapterLog;
window.exportChapterLog = exportChapterLog;
window.openItemsBurnedModal = openItemsBurnedModal;
window.closeItemsBurnedModal = closeItemsBurnedModal;
window.renderItemsBurnedList = renderItemsBurnedList;
window.toggleBurnedViewMode = toggleBurnedViewMode;
window.openBoostsCostModal = openBoostsCostModal;
window.closeBoostsCostModal = closeBoostsCostModal;
window.updateBoostModalPreview = updateBoostModalPreview;
window.saveBoostCostsFromModal = saveBoostCostsFromModal;
window.resetBoostCostsToDefault = resetBoostCostsToDefault;

window.saveAndRecalculate = () => {
  const isVip = Boolean(document.getElementById('vipToggle')?.checked);
  localStorage.setItem('sfl_vip', isVip);
  localStorage.setItem('sfl_boost1', document.getElementById('boost1').checked);
  localStorage.setItem('sfl_boost2', document.getElementById('boost2').checked);
  localStorage.setItem('sfl_boost3', document.getElementById('boost3').checked);

  // Track points auto-counting disabled until SFL API deploys 'Cave Dweller Points Earned'

  recalculateAll();
};

window.saveTrackAndRecalculate = () => {
  const trackTixEl = document.getElementById('trackTicketsInput');
  if (trackTixEl) {
    const tix = parseInt(trackTixEl.value, 10) || 0;
    localStorage.setItem('sfl_track_manual_tix', tix);
    if (state.globalData?.cloudHistory) {
      state.globalData.cloudHistory.trackTickets = tix;
    }
  }
  const trackCostEl = document.getElementById('trackCostInput');
  if (trackCostEl) {
    localStorage.setItem('sfl_track_cost', trackCostEl.value);
  }
  recalculateAll();
};

window.saveGoalAndRecalculate = () => {
  const goalEl = document.getElementById('targetGoalInput');
  const weeksEl = document.getElementById('targetWeeksInput');
  if (weeksEl) {
    let weeksVal = parseInt(weeksEl.value, 10);
    if (isNaN(weeksVal) || weeksVal < 1) weeksVal = 1;
    if (weeksVal > 12) weeksVal = 12;
    weeksEl.value = weeksVal;
    localStorage.setItem('sfl_target_weeks', weeksVal);
  }
  if (goalEl) {
    localStorage.setItem('sfl_target_goal', goalEl.value);
  }
  const ratioEl = document.getElementById('targetRatioInput');
  if (ratioEl) {
    localStorage.setItem('sfl_target_ratio', ratioEl.value);
  }
  recalculateAll();
};

window.toggleDailyLogin = () => {
  handleDailyLoginToggle();
};

window.saveLoginCountAndRecalculate = () => {
  const count = parseInt(document.getElementById('dailyLoginCount').value, 10) || 0;
  localStorage.setItem('sfl_daily_login_count', count);
  recalculateAll();
};

export async function startNewChapter(newChapterId = 'cave_dwellers_16', newChapterTitle = 'Cave Dwellers (Chapter 16)') {
  try {
    const logs = JSON.parse(localStorage.getItem('sfl_chapter_logs') || '[]');
    const hasAscension = logs.some(l => l.chapterId === 'ascension_age_15' || (l.chapterTitle || '').toLowerCase().includes('ascension'));
    if (!hasAscension) {
      const pastDelivs = JSON.parse(localStorage.getItem('sfl_farm_deliveries') || '[]');
      if (pastDelivs.length > 0) {
        logs.unshift({
          chapterId: 'ascension_age_15',
          chapterTitle: 'Ascension Age (Chapter 15)',
          date: '2026-11-08',
          chapterEndDate: '2026-11-08T00:00:00.000Z',
          isLocked: true,
          summary: {
            deliveriesCount: pastDelivs.filter(d => Boolean(d.checked !== undefined ? d.checked : d.completed)).length
          }
        });
        localStorage.setItem('sfl_chapter_logs', JSON.stringify(logs));
      }
    }
  } catch (err) {
    console.warn('Auto chapter archive skipped:', err);
  }

  localStorage.removeItem('sfl_farm_deliveries');
  localStorage.removeItem('sfl_farm_bounties');
  localStorage.removeItem('sfl_farm_chores');
  localStorage.removeItem('sfl_cloud_weeks');
  localStorage.removeItem('sfl_archive_deliveries');
  localStorage.setItem('sfl_daily_login_count', '0');
  localStorage.setItem('sfl_active_chapter', newChapterId);

  const trackTixEl = document.getElementById('trackTicketsInput');
  if (trackTixEl) trackTixEl.value = '0';
  const loginEl = document.getElementById('dailyLoginCount');
  if (loginEl) loginEl.value = '0';

  if (state.globalData) {
    state.globalData.deliveries = [];
    state.globalData.bounties = [];
    state.globalData.chores = [];
    state.globalData.archiveDeliveries = [];
    state.globalData.archiveBounties = [];
    state.globalData.archiveChores = [];
    if (state.globalData.cloudHistory) {
      state.globalData.cloudHistory.deliveries = [];
      state.globalData.cloudHistory.bounties = [];
      state.globalData.cloudHistory.chores = [];
      state.globalData.cloudHistory.weeks = {};
      state.globalData.cloudHistory.trackTickets = 0;
      state.globalData.cloudHistory.trackCost = 0;
    }
  }

  if (state.currentVaultData) {
    state.currentVaultData.activeChapter = newChapterId;
    state.currentVaultData.archiveDeliveries = [];
    state.currentVaultData.weeks = {};
    state.currentVaultData.bounties = [];
    state.currentVaultData.chores = [];
    state.currentVaultData.trackTickets = 0;
    state.currentVaultData.trackCost = 0;
  }

  recalculateAll();
  showToast(`🎉 Welcome to ${newChapterTitle}! Old tasks archived & cleared.`);
}
window.startNewChapter = startNewChapter;

export function syncCoinRatioUi(ratio) {
  const select = document.getElementById('coinRatioSelect');
  const input = document.getElementById('coinsPerSflInput');
  const unitText = document.getElementById('coinRatioUnitText');
  if (!select && !input) return;

  const isFree = ratio === 0 || ratio === '0' || ratio === 'free';
  if (isFree) {
    if (select) select.value = '0';
    if (input) {
      input.value = '0';
      input.style.display = 'none';
    }
    if (unitText) unitText.textContent = '(Coins Cost 0 SFL)';
  } else if (String(ratio) === '1000') {
    if (select) select.value = '1000';
    if (input) {
      input.value = '1000';
      input.style.display = 'none';
    }
    if (unitText) unitText.textContent = '= 1 SFL';
  } else if (String(ratio) === '1500') {
    if (select) select.value = '1500';
    if (input) {
      input.value = '1500';
      input.style.display = 'none';
    }
    if (unitText) unitText.textContent = '= 1 SFL';
  } else {
    if (select) select.value = 'custom';
    if (input) {
      input.value = ratio;
      input.style.display = 'inline-block';
    }
    if (unitText) unitText.textContent = '= 1 SFL';
  }
}
window.syncCoinRatioUi = syncCoinRatioUi;

export async function handleCoinSelectChange(val) {
  const select = document.getElementById('coinRatioSelect');
  const input = document.getElementById('coinsPerSflInput');
  const unitText = document.getElementById('coinRatioUnitText');

  if (val === 'custom') {
    if (input) {
      input.style.display = 'inline-block';
      if (input.value === '1000' || input.value === '1500' || !input.value) {
        input.select();
      } else {
        input.focus();
      }
    }
    if (unitText) {
      const isFree = input && (input.value === '0' || input.value.toLowerCase() === 'free');
      unitText.textContent = isFree ? '(Coins Cost 0 SFL)' : '= 1 SFL';
    }
  } else if (val === '0') {
    if (input) {
      input.value = '0';
      input.style.display = 'none';
    }
    if (unitText) unitText.textContent = '(Coins Cost 0 SFL)';
    await applyCoinRatio(0);
  } else {
    const num = parseFloat(val) || 1000;
    if (input) {
      input.value = num;
      input.style.display = 'none';
    }
    if (unitText) unitText.textContent = '= 1 SFL';
    await applyCoinRatio(num);
  }
}
window.handleCoinSelectChange = handleCoinSelectChange;

async function applyCoinRatio(ratio) {
  const isFree = ratio === 0 || ratio === '0' || ratio === 'free';
  const effectiveRatio = isFree ? 0 : (parseFloat(ratio) || 1000);
  localStorage.setItem('sfl_coin_ratio', isFree ? 'free' : effectiveRatio);
  if (state.currentVaultData) {
    state.currentVaultData.coinRatio = isFree ? 0 : effectiveRatio;
  }
  if (state.globalData) {
    state.globalData.coinRatio = isFree ? 0 : effectiveRatio;
  }
  recomputeCoinCosts(isFree ? 0 : effectiveRatio);
  recalculateAll();
  saveProgressToCloudKV(true);
}

export async function handleCoinRatioChange() {
  const select = document.getElementById('coinRatioSelect');
  const input = document.getElementById('coinsPerSflInput');
  const unitText = document.getElementById('coinRatioUnitText');

  const raw = input ? String(input.value).trim().toLowerCase() : '1000';
  const isFree = raw === '0' || raw === 'free' || raw === '0.0' || (select && select.value === '0');

  let ratio = 1000;
  if (isFree) {
    ratio = 0;
  } else {
    const parsed = parseFloat(raw);
    ratio = (!isNaN(parsed) && parsed > 0) ? parsed : 1000;
  }

  if (unitText) {
    unitText.textContent = isFree ? '(Coins Cost 0 SFL)' : '= 1 SFL';
  }

  await applyCoinRatio(isFree ? 0 : ratio);
}
window.handleCoinRatioChange = handleCoinRatioChange;

// Focused Gameplay Tips Rotation
const FARMER_TIPS = [
  '📈 <strong>WEEKLY BREAKDOWNS:</strong> Hover or tap any bar in the Weekly Progression chart to see tickets earned from Deliveries, Bounties, Animal Bounties & Chores!',
  '☁️ <strong>CLOUD VAULT:</strong> Click <em>"SAVE IN CLOUD"</em> to lock in your tickets. Automatic background sync also snapshots daily at 23:00 UTC!',
  '⚡ <strong>2x DOUBLE DELIVERIES:</strong> On 2x event days, your first completed order for each NPC gives double tickets: <em>[(Base + VIP + Boosts) × 2]</em>!',
  '📜 <strong>MULTI-WEEK EDITING:</strong> Click <em>EDIT</em> on any card to view history, filter by week (Week 1–12), or add custom tasks. Active orders stay at the top!',
  '🎯 <strong>CHAPTER GOAL PACE:</strong> Set your ticket target (e.g. 1,000 Tix) and weeks to track your remaining tickets and needed pace per week!',
  '🎁 <strong>DAILY LOGIN:</strong> Free +1 ticket is automatically credited to your vault on your first visit each calendar day!',
  '⏱️ <strong>SEASON COUNTDOWN:</strong> The pixel stopwatch in the top-left corner counts down live to the season reset on Nov 2, 2026!',
  '👑 <strong>VIP & BOOSTERS:</strong> Toggle the VIP (+2) and booster (+1 each) checkboxes at the top to automatically boost your ticket yields!'
];

let currentTipIndex = 0;
let tipIntervalTimer = null;

function startTipRotation() {
  const tipTextEl = document.getElementById('rotatingTipText');
  const tipBannerEl = document.getElementById('tipBanner');
  if (!tipTextEl || !tipBannerEl) return;

  const cycleTip = () => {
    tipTextEl.classList.add('fade-out');
    setTimeout(() => {
      currentTipIndex = (currentTipIndex + 1) % FARMER_TIPS.length;
      tipTextEl.innerHTML = FARMER_TIPS[currentTipIndex];
      tipTextEl.classList.remove('fade-out');
    }, 300);
  };

  tipIntervalTimer = setInterval(cycleTip, 7000);

  tipBannerEl.addEventListener('mouseenter', () => {
    if (tipIntervalTimer) clearInterval(tipIntervalTimer);
  });
  tipBannerEl.addEventListener('mouseleave', () => {
    if (tipIntervalTimer) clearInterval(tipIntervalTimer);
    tipIntervalTimer = setInterval(cycleTip, 7000);
  });
}

// ==========================================
// CHAPTER COUNTDOWN TIMER (Jan 25, 2027, 00:00 UTC)
// ==========================================
// Cave Dwellers (Chapter 16) ends Jan 25, 2027, 00:00:00 UTC
const CHAPTER_END_TIMESTAMP = Date.UTC(2027, 1, 1, 0, 0, 0);

export function updateChapterCountdown() {
  const timerValEl = document.getElementById('chapterCountdownVal');
  const widgetEl = document.getElementById('chapterCountdownWidget');
  if (!timerValEl) return;

  const nowMs = Date.now();
  const diffMs = Math.max(0, CHAPTER_END_TIMESTAMP - nowMs);

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    timerValEl.textContent = `${days}d ${hours}h`;
  } else if (hours > 0) {
    timerValEl.textContent = `${hours}h ${mins}m`;
  } else {
    timerValEl.textContent = `${mins}m`;
  }

  if (widgetEl) {
    widgetEl.title = `Cave Dwellers (Chapter 16) ends: January 25, 2027 at 00:00 UTC (${days} days, ${hours} hours, ${mins} minutes remaining)`;
  }
}

export function updateCurrentWeekBadge() {
  const baseEpoch = new Date('2026-11-08T00:00:00.000Z').getTime();
  const now = Date.now();
  let text = '';
  if (now < baseEpoch) {
    text = 'WEEK 0 (PRE-SEASON)';
  } else {
    const diffDays = Math.max(0, (now - baseEpoch) / (1000 * 60 * 60 * 24));
    const weekNum = Math.min(12, Math.floor(diffDays / 7) + 1);
    text = `WEEK ${weekNum} OF 12 WEEKS (UTC)`;
  }

  const headerBadgeEl = document.getElementById('chapterWeekText');
  if (headerBadgeEl) headerBadgeEl.textContent = text;
  const chartBadgeEl = document.getElementById('chartSummaryBadge');
  if (chartBadgeEl && (chartBadgeEl.textContent.includes('0 WEEKS') || !chartBadgeEl.textContent || chartBadgeEl.textContent.includes('PRE-SEASON') || chartBadgeEl.textContent.includes('WEEK 1'))) {
    chartBadgeEl.textContent = text;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize Dark / Light Theme (defaults to classic Sunflower Land light theme)
  const savedTheme = localStorage.getItem('sfl_theme') || 'light';
  applyTheme(savedTheme);

  // 2. Load Local State Preferences
  const farmIdEl = document.getElementById('farmId');
  if (farmIdEl) farmIdEl.value = '';

  const savedApiKey = localStorage.getItem('sfl_apiKey');
  const apiKeyEl = document.getElementById('apiKey');
  if (apiKeyEl) {
    if (savedApiKey) apiKeyEl.value = savedApiKey;
    apiKeyEl.addEventListener('input', () => {
      localStorage.setItem('sfl_apiKey', apiKeyEl.value.trim());
      apiKeyEl.style.borderColor = '';
      apiKeyEl.title = '';
    });
  }

  if (localStorage.getItem('sfl_vip') !== null) {
    document.getElementById('vipToggle').checked = localStorage.getItem('sfl_vip') === 'true';
  }
  document.getElementById('boost1').checked = localStorage.getItem('sfl_boost1') === 'true';
  document.getElementById('boost2').checked = localStorage.getItem('sfl_boost2') === 'true';
  document.getElementById('boost3').checked = localStorage.getItem('sfl_boost3') === 'true';

  // Automatic rollover to Cave Dwellers (Chapter 16):
  if (localStorage.getItem('sfl_active_chapter') !== 'cave_dwellers_16') {
    await startNewChapter('cave_dwellers_16', 'Cave Dwellers (Chapter 16)');
  } else {
    // Purge any residual pre-Chapter 16 local cache
    localStorage.removeItem('sfl_farm_bounties');
    localStorage.removeItem('sfl_farm_chores');
    try {
      const rawWks = localStorage.getItem('sfl_cloud_weeks');
      if (rawWks) {
        const parsed = JSON.parse(rawWks);
        const filtered = {};
        Object.entries(parsed).forEach(([k, v]) => {
          if (k >= '2026-11-02') filtered[k] = v;
        });
        localStorage.setItem('sfl_cloud_weeks', JSON.stringify(filtered));
      }
    } catch (e) {}
  }

  // Cleanup legacy local ticket cache
  localStorage.removeItem('sfl_track_tix');
  localStorage.removeItem('sfl_chapter_points');
  localStorage.removeItem('sfl_track_auto');

  const trackTixEl = document.getElementById('trackTicketsInput');
  const savedTrackManual = localStorage.getItem('sfl_track_manual_tix');
  if (trackTixEl) {
    trackTixEl.value = (savedTrackManual !== null && !isNaN(parseInt(savedTrackManual, 10))) ? savedTrackManual : '0';
  }

  const savedTrackCost = localStorage.getItem('sfl_track_cost');
  if (savedTrackCost !== null) document.getElementById('trackCostInput').value = savedTrackCost;

  const savedGoal = localStorage.getItem('sfl_target_goal');
  if (savedGoal) document.getElementById('targetGoalInput').value = savedGoal;

  const savedWeeks = localStorage.getItem('sfl_target_weeks');
  if (savedWeeks) {
    const clampedWeeks = Math.max(1, Math.min(12, parseInt(savedWeeks, 10) || 12));
    document.getElementById('targetWeeksInput').value = clampedWeeks;
  }

  const savedTargetRatio = localStorage.getItem('sfl_target_ratio');
  const targetRatioEl = document.getElementById('targetRatioInput');
  if (targetRatioEl && savedTargetRatio !== null) {
    targetRatioEl.value = savedTargetRatio;
  }

  const savedCoinRatio = localStorage.getItem('sfl_coin_ratio');
  if (savedCoinRatio !== null && savedCoinRatio !== undefined) {
    syncCoinRatioUi(savedCoinRatio);
  }

  await checkSavedAuth();
  await checkAndAutoClaimDailyLogin();
  startTipRotation();
  updateChapterCountdown();
  updateCurrentWeekBadge();
  setInterval(updateChapterCountdown, 60000);
  recalculateAll();
});
