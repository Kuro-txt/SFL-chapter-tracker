// Sunflower Land Custom Resource Prices Modal
// Allows overriding per-item unit prices (in SFL) used in delivery & bounty cost calculations.

import { 
  state, 
  formatSFL, 
  getCustomPrices, 
  saveCustomPricesConfig, 
  applyCustomPricesToItems,
  getCoinRatio,
  COIN_TOOL_RECIPES,
  computeToolPrice
} from './state.js';
import { BASELINE_RESOURCE_PRICES } from './item-maps.js';
import { renderItemIcon } from './item-icons.js';

// Standard baseline fallback prices re-exported for external consumers
export { BASELINE_RESOURCE_PRICES } from './item-maps.js';

export const CUSTOM_PRICE_ITEMS = [
  // Core Resources
  { key: 'wood', label: 'Wood', category: 'Resources' },
  { key: 'stone', label: 'Stone', category: 'Resources' },
  { key: 'iron', label: 'Iron', category: 'Resources' },
  { key: 'gold', label: 'Gold', category: 'Resources' },
  { key: 'crimstone', label: 'Crimstone', category: 'Resources' },
  { key: 'obsidian', label: 'Obsidian', category: 'Resources' },
  { key: 'oil', label: 'Oil', category: 'Resources' },
  { key: 'sand', label: 'Sand', category: 'Resources' },
  { key: 'salt', label: 'Salt', category: 'Resources' },
  { key: 'refined salt', label: 'Refined Salt', category: 'Resources' },

  // Crops
  { key: 'sunflower', label: 'Sunflower', category: 'Crops' },
  { key: 'potato', label: 'Potato', category: 'Crops' },
  { key: 'pumpkin', label: 'Pumpkin', category: 'Crops' },
  { key: 'carrot', label: 'Carrot', category: 'Crops' },
  { key: 'cabbage', label: 'Cabbage', category: 'Crops' },
  { key: 'beetroot', label: 'Beetroot', category: 'Crops' },
  { key: 'cauliflower', label: 'Cauliflower', category: 'Crops' },
  { key: 'parsnip', label: 'Parsnip', category: 'Crops' },
  { key: 'eggplant', label: 'Eggplant', category: 'Crops' },
  { key: 'corn', label: 'Corn', category: 'Crops' },
  { key: 'radish', label: 'Radish', category: 'Crops' },
  { key: 'wheat', label: 'Wheat', category: 'Crops' },
  { key: 'kale', label: 'Kale', category: 'Crops' },
  { key: 'barley', label: 'Barley', category: 'Crops' },
  { key: 'soybean', label: 'Soybean', category: 'Crops' },
  { key: 'rice', label: 'Rice', category: 'Crops' },
  { key: 'olive', label: 'Olive', category: 'Crops' },
  { key: 'zucchini', label: 'Zucchini', category: 'Crops' },
  { key: 'yam', label: 'Yam', category: 'Crops' },
  { key: 'onion', label: 'Onion', category: 'Crops' },
  { key: 'turnip', label: 'Turnip', category: 'Crops' },
  { key: 'artichoke', label: 'Artichoke', category: 'Crops' },
  { key: 'rhubarb', label: 'Rhubarb', category: 'Crops' },
  { key: 'broccoli', label: 'Broccoli', category: 'Crops' },

  // Fruits
  { key: 'apple', label: 'Apple', category: 'Fruits' },
  { key: 'banana', label: 'Banana', category: 'Fruits' },
  { key: 'orange', label: 'Orange', category: 'Fruits' },
  { key: 'blueberry', label: 'Blueberry', category: 'Fruits' },
  { key: 'tomato', label: 'Tomato', category: 'Fruits' },
  { key: 'lemon', label: 'Lemon', category: 'Fruits' },
  { key: 'grape', label: 'Grape', category: 'Fruits' },

  // Animals & Products
  { key: 'egg', label: 'Egg', category: 'Animals' },
  { key: 'milk', label: 'Milk', category: 'Animals' },
  { key: 'wool', label: 'Wool', category: 'Animals' },
  { key: 'feather', label: 'Feather', category: 'Animals' },
  { key: 'leather', label: 'Leather', category: 'Animals' },
  { key: 'merino wool', label: 'Merino Wool', category: 'Animals' },
  { key: 'honey', label: 'Honey', category: 'Animals' },

  // Fish & Seafood
  { key: 'red snapper', label: 'Red Snapper', category: 'Fish' },
  { key: 'tuna', label: 'Tuna', category: 'Fish' },
  { key: 'anchovy', label: 'Anchovy', category: 'Fish' },
  { key: 'olive flounder', label: 'Olive Flounder', category: 'Fish' },
  { key: 'sea bass', label: 'Sea Bass', category: 'Fish' },
  { key: 'halibut', label: 'Halibut', category: 'Fish' },
  { key: 'blowfish', label: 'Blowfish', category: 'Fish' },
  { key: 'squid', label: 'Squid', category: 'Fish' },
  { key: 'porgy', label: 'Porgy', category: 'Fish' },
  { key: 'clownfish', label: 'Clownfish', category: 'Fish' },
  { key: 'lobster', label: 'Lobster', category: 'Fish' },
  { key: 'blue crab', label: 'Blue Crab', category: 'Fish' },
  { key: 'hermit crab', label: 'Hermit Crab', category: 'Fish' },
  { key: 'shrimp', label: 'Shrimp', category: 'Fish' },
  { key: 'oyster', label: 'Oyster', category: 'Fish' },
  { key: 'mussel', label: 'Mussel', category: 'Fish' },

  // Tools (Coins & Resources)
  { key: 'rod', label: 'Rod', category: 'Tools' },
  { key: 'axe', label: 'Axe', category: 'Tools' },
  { key: 'pickaxe', label: 'Pickaxe', category: 'Tools' },

  // Other Resources
  { key: 'frost pebble', label: 'Frost Pebble', category: 'Other' },
  { key: 'wild grass', label: 'Wild Grass', category: 'Other' },
  { key: 'ribbon', label: 'Ribbon', category: 'Other' },
  { key: 'dewberry', label: 'Dewberry', category: 'Other' },
  { key: 'moonfur', label: 'Moonfur', category: 'Other' },
  { key: 'heart leaf', label: 'Heart Leaf', category: 'Other' },
  { key: 'chewed bone', label: 'Chewed Bone', category: 'Other' }
];

export function getMarketPriceForItem(key) {
  const cleanKey = String(key || '').toLowerCase().trim();
  if (COIN_TOOL_RECIPES && COIN_TOOL_RECIPES[cleanKey]) {
    const dynamicPrice = computeToolPrice(cleanKey);
    if (typeof dynamicPrice === 'number' && dynamicPrice >= 0) return dynamicPrice;
  }
  if (state.priceMap && state.priceMap[cleanKey] !== undefined && state.priceMap[cleanKey] > 0) {
    return state.priceMap[cleanKey];
  }
  const deliveries = state.globalData?.deliveries || [];
  for (const d of deliveries) {
    if (Array.isArray(d.itemDetails)) {
      const match = d.itemDetails.find(det => (det.name || '').toLowerCase().trim() === cleanKey);
      if (match && match.marketUnitPrice !== undefined && match.marketUnitPrice > 0) return match.marketUnitPrice;
      if (match && match.unitPrice !== undefined && match.unitPrice > 0) return match.unitPrice;
    }
  }
  return BASELINE_RESOURCE_PRICES[cleanKey] || 0;
}

let _customPricesSearchFilter = '';
let _customPricesCategoryFilter = 'all';
let _draftCustomPrices = {};

export function syncDomInputsToDraft() {
  const modal = document.getElementById('customPricesModal');
  const inputs = (modal || document).querySelectorAll('.custom-price-field');
  inputs.forEach(input => {
    const key = input.dataset.itemKey;
    if (!key) return;
    const val = input.value.trim();
    if (val === '') {
      delete _draftCustomPrices[key];
    } else {
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0) {
        _draftCustomPrices[key] = num;
      } else {
        delete _draftCustomPrices[key];
      }
    }
  });
}

export function handleCustomPriceInput(key, val) {
  const cleanKey = String(key || '').toLowerCase().trim();
  const trimmed = String(val || '').trim();
  if (trimmed === '') {
    delete _draftCustomPrices[cleanKey];
  } else {
    const num = parseFloat(trimmed);
    if (!isNaN(num) && num >= 0) {
      _draftCustomPrices[cleanKey] = num;
    } else {
      delete _draftCustomPrices[cleanKey];
    }
  }

  const inputId = `customPriceInput_${cleanKey.replace(/\s+/g, '_')}`;
  const input = document.getElementById(inputId);
  if (input) {
    const row = input.closest('.custom-price-row');
    const hasCustom = _draftCustomPrices[cleanKey] !== undefined;
    if (row) {
      row.classList.toggle('has-custom', hasCustom);
      const bolt = row.querySelector('.custom-price-bolt');
      if (bolt) bolt.textContent = hasCustom ? '⚡' : '';
      const clearBtn = row.querySelector('.custom-price-clear-btn');
      if (clearBtn) clearBtn.style.visibility = hasCustom ? 'visible' : 'hidden';
    }
  }

  const badge = document.getElementById('customPricesActiveBadge');
  if (badge) {
    const count = Object.keys(_draftCustomPrices).length;
    badge.textContent = `${count} ACTIVE`;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

export function handleCustomPricesSearch(query) {
  syncDomInputsToDraft();
  _customPricesSearchFilter = String(query || '').toLowerCase().trim();
  renderCustomPricesList();
}

export function setCustomPricesCategory(cat) {
  syncDomInputsToDraft();
  _customPricesCategoryFilter = cat || 'all';
  const tabs = document.querySelectorAll('#customPricesCategoryTabs .cat-tab-btn');
  tabs.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === _customPricesCategoryFilter);
  });
  renderCustomPricesList();
}

export function renderCustomPricesList() {
  const container = document.getElementById('customPricesListContainer');
  if (!container) return;

  const currentPrices = _draftCustomPrices;
  const search = _customPricesSearchFilter;
  const catFilter = _customPricesCategoryFilter;

  const filteredItems = CUSTOM_PRICE_ITEMS.filter(item => {
    if (catFilter !== 'all' && item.category !== catFilter) {
      return false;
    }
    if (!search) return true;
    return item.label.toLowerCase().includes(search) || 
           item.key.toLowerCase().includes(search) || 
           item.category.toLowerCase().includes(search);
  });

  const activeCount = Object.keys(currentPrices).length;
  const badge = document.getElementById('customPricesActiveBadge');
  if (badge) {
    badge.textContent = `${activeCount} ACTIVE`;
    badge.style.display = activeCount > 0 ? 'inline-block' : 'none';
  }

  if (filteredItems.length === 0) {
    container.innerHTML = `
      <div class="custom-prices-empty" style="text-align: center; padding: 28px; color: #888; font-size: 13px;">
        No items found matching "${escapeHtml(search || catFilter)}".
      </div>
    `;
    return;
  }

  let html = '<div style="display: flex; flex-direction: column; gap: 6px;">';

  let currentCategory = null;
  filteredItems.forEach(item => {
    if (!search && catFilter === 'all' && item.category !== currentCategory) {
      currentCategory = item.category;
      html += `
        <div class="custom-prices-cat-header">
          ${escapeHtml(currentCategory)}
        </div>
      `;
    }

    const mktPrice = getMarketPriceForItem(item.key);
    const hasCustom = currentPrices[item.key] !== undefined;
    const customVal = hasCustom ? currentPrices[item.key] : '';
    const inputId = `customPriceInput_${item.key.replace(/\s+/g, '_')}`;

    html += `
      <div class="custom-price-row ${hasCustom ? 'has-custom' : ''}" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-radius: 6px; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
          <span style="display: inline-flex; width: 22px; height: 22px; align-items: center; justify-content: center; flex-shrink: 0;">
            ${renderItemIcon(item.label, 20)}
          </span>
          <span class="custom-price-item-name" style="font-weight: 800; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(item.label)}
          </span>
          <span class="custom-price-market-text" style="font-size: 11px; margin-left: 2px;">
            (Mkt: <span class="custom-price-market-val" style="font-weight: 600;">${formatSFL(mktPrice)}</span> SFL)
          </span>
        </div>

        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
          <span class="custom-price-bolt" style="font-size: 11px; font-weight: bold; color: ${hasCustom ? '#E65100' : '#888'};">
            ${hasCustom ? '⚡' : ''}
          </span>
          <input type="number" id="${inputId}" step="any" min="0" 
                 placeholder="${formatSFL(mktPrice)}"
                 value="${customVal !== '' ? customVal : ''}"
                 data-item-key="${item.key}"
                 class="custom-price-field"
                 oninput="handleCustomPriceInput('${item.key}', this.value)"
                 style="width: 86px; padding: 4px 6px; font-size: 12px; font-weight: bold; text-align: right; border-radius: 4px;" />
          <span class="custom-price-currency" style="font-size: 11px; font-weight: bold;">SFL</span>
          <button type="button" onclick="clearCustomPriceRow('${item.key}')" 
                  class="btn btn-wood custom-price-clear-btn" style="padding: 2px 6px; font-size: 11px; cursor: pointer; border-radius: 4px; visibility: ${hasCustom ? 'visible' : 'hidden'};" 
                  title="Clear custom price for ${escapeHtml(item.label)}">✕</button>
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

export async function clearCustomPriceRow(key) {
  const cleanKey = String(key || '').toLowerCase().trim();
  delete _draftCustomPrices[cleanKey];
  const inputId = `customPriceInput_${cleanKey.replace(/\s+/g, '_')}`;
  const input = document.getElementById(inputId);
  if (input) {
    input.value = '';
  }
  const prices = getCustomPrices();
  delete prices[cleanKey];
  saveCustomPricesConfig(prices);
  applyCustomPricesToItems();
  renderCustomPricesList();

  try {
    const { recalculateAll } = await import('./render.js');
    recalculateAll();
  } catch (e) {}

  try {
    const { saveProgressToCloudKV, showToast } = await import('./api.js');
    saveProgressToCloudKV(true);
    if (typeof showToast === 'function') {
      showToast(`✔ Custom price for ${cleanKey} cleared`, 'success');
    }
  } catch (e) {}
}

export function openCustomPricesModal() {
  const modal = document.getElementById('customPricesModal');
  if (!modal) return;
  _draftCustomPrices = { ...getCustomPrices() };
  const searchInput = document.getElementById('customPricesSearchInput');
  if (searchInput) searchInput.value = '';
  _customPricesSearchFilter = '';
  _customPricesCategoryFilter = 'all';
  const tabs = document.querySelectorAll('#customPricesCategoryTabs .cat-tab-btn');
  tabs.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === 'all');
  });
  renderCustomPricesList();
  modal.classList.add('show');
}

export function closeCustomPricesModal() {
  const modal = document.getElementById('customPricesModal');
  if (modal) modal.classList.remove('show');
}

export async function saveCustomPricesFromModal() {
  syncDomInputsToDraft();
  saveCustomPricesConfig(_draftCustomPrices);
  applyCustomPricesToItems();
  closeCustomPricesModal();

  try {
    const { recalculateAll } = await import('./render.js');
    recalculateAll();
  } catch (e) {}

  try {
    const { saveProgressToCloudKV, showToast } = await import('./api.js');
    saveProgressToCloudKV(true);
    if (typeof showToast === 'function') {
      const count = Object.keys(_draftCustomPrices).length;
      showToast(count > 0 ? `✔ ${count} custom resource prices applied!` : '✔ Custom prices reset to market rates', 'success');
    }
  } catch (e) {}
}

export async function resetCustomPricesToDefault() {
  _draftCustomPrices = {};
  saveCustomPricesConfig({});
  applyCustomPricesToItems();
  renderCustomPricesList();

  try {
    const { recalculateAll } = await import('./render.js');
    recalculateAll();
  } catch (e) {}

  try {
    const { saveProgressToCloudKV, showToast } = await import('./api.js');
    saveProgressToCloudKV(true);
    if (typeof showToast === 'function') {
      showToast('✔ All prices reset to live market rates', 'success');
    }
  } catch (e) {}
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
