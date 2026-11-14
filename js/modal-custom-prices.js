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
import { renderItemIcon } from './item-icons.js';

// Standard baseline fallback prices
export const BASELINE_RESOURCE_PRICES = {
  // Core Resources & Minerals
  "wood": 0.0103,
  "stone": 0.0204,
  "iron": 0.0408,
  "gold": 0.0815,
  "crimstone": 0.125,
  "sunstone": 0.250,
  "obsidian": 0.150,
  "oil": 0.015,
  "sand": 0.005,
  "salt": 0.008,
  "refined salt": 0.040,

  // Animals & Products
  "egg": 0.0233,
  "milk": 0.0512,
  "wool": 0.0325,
  "feather": 0.018,
  "leather": 0.045,
  "merino wool": 0.065,
  "honey": 0.080,

  // Crops
  "sunflower": 0.0004,
  "potato": 0.0014,
  "pumpkin": 0.0035,
  "carrot": 0.006,
  "cabbage": 0.012,
  "beetroot": 0.023,
  "cauliflower": 0.035,
  "parsnip": 0.055,
  "eggplant": 0.070,
  "corn": 0.080,
  "radish": 0.095,
  "wheat": 0.045,
  "kale": 0.065,
  "barley": 0.075,
  "soybean": 0.085,
  "rice": 0.060,
  "olive": 0.120,
  "zucchini": 0.050,
  "yam": 0.055,
  "onion": 0.070,
  "turnip": 0.065,
  "artichoke": 0.080,
  "rhubarb": 0.040,
  "broccoli": 0.050,

  // Fruits
  "apple": 0.045,
  "banana": 0.055,
  "orange": 0.050,
  "blueberry": 0.040,
  "tomato": 0.035,
  "lemon": 0.048,
  "grape": 0.060,

  // Tools (Calculated via coins method)
  "rod": 0.0713,
  "axe": 0.020,
  "pickaxe": 0.0469
};

export const CUSTOM_PRICE_ITEMS = [
  // Core Resources
  { key: 'wood', label: 'Wood', category: 'Resources' },
  { key: 'stone', label: 'Stone', category: 'Resources' },
  { key: 'iron', label: 'Iron', category: 'Resources' },
  { key: 'gold', label: 'Gold', category: 'Resources' },
  { key: 'crimstone', label: 'Crimstone', category: 'Resources' },
  { key: 'sunstone', label: 'Sunstone', category: 'Resources' },
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

  // Tools (Coins & Resources)
  { key: 'rod', label: 'Rod', category: 'Tools' },
  { key: 'axe', label: 'Axe', category: 'Tools' },
  { key: 'pickaxe', label: 'Pickaxe', category: 'Tools' }
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

export function handleCustomPricesSearch(query) {
  _customPricesSearchFilter = String(query || '').toLowerCase().trim();
  renderCustomPricesList();
}

export function setCustomPricesCategory(cat) {
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

  const currentPrices = getCustomPrices();
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
          <span style="font-size: 11px; font-weight: bold; color: ${hasCustom ? '#E65100' : '#888'};">
            ${hasCustom ? '⚡' : ''}
          </span>
          <input type="number" id="${inputId}" step="any" min="0" 
                 placeholder="${formatSFL(mktPrice)}"
                 value="${customVal !== '' ? customVal : ''}"
                 data-item-key="${item.key}"
                 class="custom-price-field"
                 style="width: 86px; padding: 4px 6px; font-size: 12px; font-weight: bold; text-align: right; border-radius: 4px;" />
          <span class="custom-price-currency" style="font-size: 11px; font-weight: bold;">SFL</span>
          <button type="button" onclick="clearCustomPriceRow('${item.key}')" 
                  class="btn-wood" style="padding: 2px 6px; font-size: 11px; cursor: pointer; border-radius: 4px; visibility: ${hasCustom ? 'visible' : 'hidden'};" 
                  title="Clear custom price for ${escapeHtml(item.label)}">✕</button>
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

export async function clearCustomPriceRow(key) {
  const inputId = `customPriceInput_${key.replace(/\s+/g, '_')}`;
  const input = document.getElementById(inputId);
  if (input) {
    input.value = '';
  }
  const prices = getCustomPrices();
  delete prices[key];
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
      showToast(`✔ Custom price for ${key} cleared`, 'success');
    }
  } catch (e) {}
}

export function openCustomPricesModal() {
  const modal = document.getElementById('customPricesModal');
  if (!modal) return;
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
  const modal = document.getElementById('customPricesModal');
  const inputs = (modal || document).querySelectorAll('.custom-price-field');
  const newPrices = {};

  inputs.forEach(input => {
    const key = input.dataset.itemKey;
    if (!key) return;
    const val = input.value.trim();
    if (val === '') return;
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      newPrices[key] = num;
    }
  });

  saveCustomPricesConfig(newPrices);
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
      const count = Object.keys(newPrices).length;
      showToast(count > 0 ? `✔ ${count} custom resource prices applied!` : '✔ Custom prices reset to market rates', 'success');
    }
  } catch (e) {}
}

export async function resetCustomPricesToDefault() {
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
