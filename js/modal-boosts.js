// Sunflower Land Boost Costs Modal System
// Manages +1 boost costs, live currency conversions, preview badges, and persistence.

import { 
  getBoostCostsConfig, 
  saveBoostCostsConfig, 
  getCoinRatio, 
  formatSFL 
} from './state.js';

export function openBoostsCostModal() {
  const modal = document.getElementById('boostsCostModal');
  if (!modal) return;

  const config = getBoostCostsConfig();

  const b1Cost = document.getElementById('boost1CostInput');
  const b1Curr = document.getElementById('boost1CurrencySelect');
  const b2Cost = document.getElementById('boost2CostInput');
  const b2Curr = document.getElementById('boost2CurrencySelect');
  const b3Cost = document.getElementById('boost3CostInput');
  const b3Curr = document.getElementById('boost3CurrencySelect');

  if (b1Cost) b1Cost.value = config.boost1.amount;
  if (b1Curr) b1Curr.value = config.boost1.currency;
  if (b2Cost) b2Cost.value = config.boost2.amount;
  if (b2Curr) b2Curr.value = config.boost2.currency;
  if (b3Cost) b3Cost.value = config.boost3.amount;
  if (b3Curr) b3Curr.value = config.boost3.currency;

  updateBoostModalPreview();
  modal.classList.add('show');
}

export function closeBoostsCostModal() {
  const modal = document.getElementById('boostsCostModal');
  if (modal) modal.classList.remove('show');
}

export function updateBoostModalPreview() {
  const b1Cost = parseFloat(document.getElementById('boost1CostInput')?.value) || 0;
  const b1Curr = document.getElementById('boost1CurrencySelect')?.value || 'coins';
  const b2Cost = parseFloat(document.getElementById('boost2CostInput')?.value) || 0;
  const b2Curr = document.getElementById('boost2CurrencySelect')?.value || 'sfl';
  const b3Cost = parseFloat(document.getElementById('boost3CostInput')?.value) || 0;
  const b3Curr = document.getElementById('boost3CurrencySelect')?.value || 'sfl';

  const ratio = getCoinRatio();

  const b1Sfl = b1Curr === 'coins' ? (ratio > 0 ? b1Cost / ratio : 0) : b1Cost;
  const b2Sfl = b2Curr === 'coins' ? (ratio > 0 ? b2Cost / ratio : 0) : b2Cost;
  const b3Sfl = b3Curr === 'coins' ? (ratio > 0 ? b3Cost / ratio : 0) : b3Cost;

  const b1Prev = document.getElementById('boost1ConvertedPreview');
  if (b1Prev) {
    b1Prev.textContent = b1Curr === 'coins'
      ? `= ${formatSFL(b1Sfl)} SFL (at ${ratio} Coins / SFL)`
      : `= ${formatSFL(b1Sfl)} SFL`;
  }

  const b2Prev = document.getElementById('boost2ConvertedPreview');
  if (b2Prev) {
    b2Prev.textContent = b2Curr === 'coins'
      ? `= ${formatSFL(b2Sfl)} SFL (at ${ratio} Coins / SFL)`
      : `= ${formatSFL(b2Sfl)} SFL`;
  }

  const b3Prev = document.getElementById('boost3ConvertedPreview');
  if (b3Prev) {
    b3Prev.textContent = b3Curr === 'coins'
      ? `= ${formatSFL(b3Sfl)} SFL (at ${ratio} Coins / SFL)`
      : `= ${formatSFL(b3Sfl)} SFL`;
  }

  const isB1 = Boolean(document.getElementById('boost1')?.checked);
  const isB2 = Boolean(document.getElementById('boost2')?.checked);
  const isB3 = Boolean(document.getElementById('boost3')?.checked);

  const b1Badge = document.getElementById('boost1ActiveBadge');
  if (b1Badge) {
    b1Badge.textContent = isB1 ? `ACTIVE (+${formatSFL(b1Sfl)} SFL)` : 'INACTIVE';
    b1Badge.className = isB1 ? 'badge badge-done' : 'badge badge-inactive';
    b1Badge.style.background = '';
    b1Badge.style.color = '';
    b1Badge.style.border = '';
  }

  const b2Badge = document.getElementById('boost2ActiveBadge');
  if (b2Badge) {
    b2Badge.textContent = isB2 ? `ACTIVE (+${formatSFL(b2Sfl)} SFL)` : 'INACTIVE';
    b2Badge.className = isB2 ? 'badge badge-done' : 'badge badge-inactive';
    b2Badge.style.background = '';
    b2Badge.style.color = '';
    b2Badge.style.border = '';
  }

  const b3Badge = document.getElementById('boost3ActiveBadge');
  if (b3Badge) {
    b3Badge.textContent = isB3 ? `ACTIVE (+${formatSFL(b3Sfl)} SFL)` : 'INACTIVE';
    b3Badge.className = isB3 ? 'badge badge-done' : 'badge badge-inactive';
    b3Badge.style.background = '';
    b3Badge.style.color = '';
    b3Badge.style.border = '';
  }

  let totalActive = 0;
  if (isB1) totalActive += b1Sfl;
  if (isB2) totalActive += b2Sfl;
  if (isB3) totalActive += b3Sfl;

  const totalEl = document.getElementById('boostsModalTotalActiveCost');
  if (totalEl) {
    totalEl.textContent = `${formatSFL(totalActive)} SFL`;
  }
}

export async function saveBoostCostsFromModal() {
  const b1Cost = parseFloat(document.getElementById('boost1CostInput')?.value) || 0;
  const b1Curr = document.getElementById('boost1CurrencySelect')?.value || 'coins';
  const b2Cost = parseFloat(document.getElementById('boost2CostInput')?.value) || 0;
  const b2Curr = document.getElementById('boost2CurrencySelect')?.value || 'sfl';
  const b3Cost = parseFloat(document.getElementById('boost3CostInput')?.value) || 0;
  const b3Curr = document.getElementById('boost3CurrencySelect')?.value || 'sfl';

  const config = {
    boost1: { amount: Math.max(0, b1Cost), currency: b1Curr },
    boost2: { amount: Math.max(0, b2Cost), currency: b2Curr },
    boost3: { amount: Math.max(0, b3Cost), currency: b3Curr }
  };

  saveBoostCostsConfig(config);
  closeBoostsCostModal();

  try {
    const { recalculateAll } = await import('./render.js');
    recalculateAll();
  } catch (e) {}

  try {
    const { saveProgressToCloudKV, showToast } = await import('./api.js');
    saveProgressToCloudKV(true);
    if (typeof showToast === 'function') {
      showToast('⚡ Boost costs updated and saved!', 'success');
    }
  } catch (e) {}
}

export function resetBoostCostsToDefault() {
  const b1Cost = document.getElementById('boost1CostInput');
  const b1Curr = document.getElementById('boost1CurrencySelect');
  const b2Cost = document.getElementById('boost2CostInput');
  const b2Curr = document.getElementById('boost2CurrencySelect');
  const b3Cost = document.getElementById('boost3CostInput');
  const b3Curr = document.getElementById('boost3CurrencySelect');

  if (b1Cost) b1Cost.value = 5000;
  if (b1Curr) b1Curr.value = 'coins';
  if (b2Cost) b2Cost.value = 5;
  if (b2Curr) b2Curr.value = 'sfl';
  if (b3Cost) b3Cost.value = 25;
  if (b3Curr) b3Curr.value = 'sfl';

  updateBoostModalPreview();
}
