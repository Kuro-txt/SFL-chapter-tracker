import { state, formatSFL } from './state.js';

// Item Categorization Heuristic
export function detectItemCategory(name) {
  if (!name) return 'other';
  const clean = name.toLowerCase().trim();

  // 1. Cooked Foods / Bakery / Deli (Check before crops so 'Pumpkin Soup' is Food, not Crop)
  const FOODS = [
    'soup', 'stew', 'salad', 'pie', 'cake', 'tart', 'bread', 'sandwich',
    'chowder', 'pancake', 'roast', 'juice', 'smoothie', 'burger', 'jam',
    'fermented', 'sauerkraut', 'mashed', 'boiled', 'pizza', 'pasta',
    'cookie', 'biscuit', 'omelette', 'curry', 'waffle', 'shake', 'dip',
    'popcorn', 'spaghetti', 'taco', 'sushi'
  ];
  if (FOODS.some(f => clean.includes(f))) return 'food';

  // 2. Crops
  const CROPS = [
    'sunflower', 'potato', 'pumpkin', 'carrot', 'cabbage', 'beetroot',
    'cauliflower', 'parsnip', 'eggplant', 'corn', 'radish', 'wheat',
    'kale', 'barley', 'soybean', 'rice', 'olive', 'zucchini', 'yam',
    'onion', 'turnip', 'artichoke'
  ];
  if (CROPS.some(c => clean === c || clean.includes(c))) return 'crops';

  // Animals & Animal Products
  const ANIMALS = [
    'egg', 'milk', 'wool', 'honey', 'leather', 'feather', 'cheese',
    'butter', 'beef', 'chicken', 'cow', 'sheep', 'pig', 'animal'
  ];
  if (ANIMALS.some(a => clean.includes(a))) return 'animals';

  // Resources, Woods & Minerals
  const RESOURCES = [
    'wood', 'stone', 'iron', 'gold', 'crimsonstone', 'sunstone', 'oil',
    'rod', 'pickaxe', 'axe', 'shovel', 'drill', 'amber', 'obsidian', 'coin', 'coins'
  ];
  if (RESOURCES.some(r => clean.includes(r))) return 'resources';

  return 'other';
}

export function getCategoryEmoji(cat) {
  switch (cat) {
    case 'crops': return '🌾';
    case 'food': return '🍳';
    case 'animals': return '🐄';
    case 'resources': return '🪵';
    default: return '✨';
  }
}

export function getCategoryLabel(cat) {
  switch (cat) {
    case 'crops': return 'Crops';
    case 'food': return 'Cooked Food';
    case 'animals': return 'Animal Products';
    case 'resources': return 'Resources';
    default: return 'Other';
  }
}

/**
 * PURE READ-ONLY FUNCTION:
 * Aggregates all items consumed/burned across deliveries and bounties.
 * Guarantees zero mutation to state.globalData or storage.
 */
export function aggregateBurnedItems() {
  const itemMap = new Map();

  // 1. Deliveries (Pure Read-Only: Deduplicate without mutating state or storage)
  const archive = state.globalData?.archiveDeliveries || [];
  const board = state.globalData?.deliveries || [];
  const seenDeliveryKeys = new Set();
  const masterDeliveries = [];

  [...board, ...archive].forEach(d => {
    if (!d) return;
    const dKey = d.id || `${d.from || d.name}_${d.completedAt || d.completedDate || 'item'}`;
    if (!seenDeliveryKeys.has(dKey)) {
      seenDeliveryKeys.add(dKey);
      masterDeliveries.push(d);
    }
  });
  masterDeliveries.forEach(d => {
    if (!d || d.isSkipped) return;
    const isDone = (d.checked !== undefined ? Boolean(d.checked) : Boolean(d.completed));

    // Prefer granular itemDetails with lineCost & unitPrice
    if (Array.isArray(d.itemDetails) && d.itemDetails.length > 0) {
      d.itemDetails.forEach(det => {
        const cleanName = (det.name || '').trim();
        if (!cleanName) return;
        const key = cleanName.toLowerCase();
        const qty = typeof det.qty === 'number' ? det.qty : parseFloat(det.qty) || 0;
        const cost = typeof det.lineCost === 'number' ? det.lineCost : 0;
        const unitPrice = det.unitPrice || (qty > 0 ? cost / qty : 0);

        if (!itemMap.has(key)) {
          itemMap.set(key, {
            name: cleanName,
            category: detectItemCategory(cleanName),
            totalQty: 0,
            completedQty: 0,
            activeQty: 0,
            totalCost: 0,
            completedCost: 0,
            activeCost: 0,
            unitPrice: unitPrice,
            deliveryCount: 0,
            bountyCount: 0
          });
        }

        const entry = itemMap.get(key);
        entry.totalQty += qty;
        entry.totalCost += cost;
        if (unitPrice > 0 && entry.unitPrice === 0) entry.unitPrice = unitPrice;

        if (isDone) {
          entry.completedQty += qty;
          entry.completedCost += cost;
        } else {
          entry.activeQty += qty;
          entry.activeCost += cost;
        }
        entry.deliveryCount++;
      });
    } else if (d.items && typeof d.items === 'object') {
      // Fallback: items map
      const entries = Object.entries(d.items);
      const totalOrderCost = d.cost || d.itemsCost || 0;
      const count = entries.length;

      entries.forEach(([rawName, rawQty]) => {
        const cleanName = (rawName || '').trim();
        if (!cleanName) return;
        const key = cleanName.toLowerCase();
        const qty = typeof rawQty === 'number' ? rawQty : parseFloat(rawQty) || 0;
        const approxCost = count > 0 ? (totalOrderCost / count) : 0;
        const unitPrice = qty > 0 ? approxCost / qty : 0;

        if (!itemMap.has(key)) {
          itemMap.set(key, {
            name: cleanName,
            category: detectItemCategory(cleanName),
            totalQty: 0,
            completedQty: 0,
            activeQty: 0,
            totalCost: 0,
            completedCost: 0,
            activeCost: 0,
            unitPrice: unitPrice,
            deliveryCount: 0,
            bountyCount: 0
          });
        }

        const entry = itemMap.get(key);
        entry.totalQty += qty;
        entry.totalCost += approxCost;
        if (unitPrice > 0 && entry.unitPrice === 0) entry.unitPrice = unitPrice;

        if (isDone) {
          entry.completedQty += qty;
          entry.completedCost += approxCost;
        } else {
          entry.activeQty += qty;
          entry.activeCost += approxCost;
        }
        entry.deliveryCount++;
      });
    }
  });

  // 2. Bounties (Read-Only & Deduplicated across current board and past weeks)
  const seenBounties = new Set();
  const allBounties = [];

  (state.globalData?.bounties || []).forEach(b => {
    const bId = b.id ? String(b.id) : `live_${(b.name || '').toLowerCase()}_${b.level || 0}`;
    if (!seenBounties.has(bId)) {
      seenBounties.add(bId);
      allBounties.push(b);
    }
  });

  const weeks = state.globalData?.cloudHistory?.weeks || state.currentVaultData?.weeks || {};
  Object.values(weeks).forEach(wk => {
    if (!wk || typeof wk !== 'object') return;
    (wk.bounties || []).forEach(b => {
      const bId = b.id ? String(b.id) : `${wk.weekId || 'past'}_${(b.name || '').toLowerCase()}_${b.level || 0}`;
      if (!seenBounties.has(bId)) {
        seenBounties.add(bId);
        allBounties.push(b);
      }
    });
  });

  allBounties.forEach(b => {
    if (!b || b.isSkipped) return;
    const isDone = (b.checked !== undefined ? Boolean(b.checked) : Boolean(b.completed));
    const itemName = (b.name || b.item || b.itemName || '').trim();
    if (!itemName) return;
    const key = itemName.toLowerCase();
    const qty = 1;
    const cost = typeof b.cost === 'number' ? b.cost : (typeof b.itemsCost === 'number' ? b.itemsCost : 0);
    const unitPrice = cost;

    if (!itemMap.has(key)) {
      itemMap.set(key, {
        name: itemName,
        category: detectItemCategory(itemName),
        totalQty: 0,
        completedQty: 0,
        activeQty: 0,
        totalCost: 0,
        completedCost: 0,
        activeCost: 0,
        unitPrice: unitPrice,
        deliveryCount: 0,
        bountyCount: 0
      });
    }

    const entry = itemMap.get(key);
    entry.totalQty += qty;
    entry.totalCost += cost;
    if (unitPrice > 0 && entry.unitPrice === 0) entry.unitPrice = unitPrice;

    if (isDone) {
      entry.completedQty += qty;
      entry.completedCost += cost;
    } else {
      entry.activeQty += qty;
      entry.activeCost += cost;
    }
    entry.bountyCount++;
  });

  return Array.from(itemMap.values());
}

/**
 * Open the '🔥 ITEMS BURNED' Modal and initialize list
 */
export function openItemsBurnedModal() {
  const modal = document.getElementById('itemsBurnedModal');
  if (!modal) return;

  if (!state.globalData) {
    alert('Please click "🌾 FETCH DATA" or log into your vault first!');
    return;
  }

  // Reset search / default filters on open
  const searchInput = document.getElementById('itemsSearchInput');
  if (searchInput) searchInput.value = '';

  renderItemsBurnedList();
  modal.classList.add('show');
}

/**
 * Close the '🔥 ITEMS BURNED' Modal
 */
export function closeItemsBurnedModal() {
  const modal = document.getElementById('itemsBurnedModal');
  if (modal) modal.classList.remove('show');
}

/**
 * Filter, sort, and render items list & summary cards
 */
export function renderItemsBurnedList() {
  const summaryBox = document.getElementById('itemsBurnedSummaryBox');
  const listContainer = document.getElementById('itemsBurnedListContainer');
  if (!listContainer) return;

  const allItems = aggregateBurnedItems();

  const searchKeyword = (document.getElementById('itemsSearchInput')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('itemsStatusFilter')?.value || 'completed';
  const sortSelect = document.getElementById('itemsSortSelect')?.value || 'cost_desc';
  const categoryFilter = document.getElementById('itemsCategoryFilter')?.value || 'all';

  // Filter items
  let filtered = allItems.filter(item => {
    // 1. Search keyword
    if (searchKeyword && !item.name.toLowerCase().includes(searchKeyword)) {
      return false;
    }

    // 2. Category
    if (categoryFilter !== 'all' && item.category !== categoryFilter) {
      return false;
    }

    // 3. Status
    if (statusFilter === 'completed') {
      return item.completedQty > 0;
    } else if (statusFilter === 'active') {
      return item.activeQty > 0;
    }
    return item.totalQty > 0;
  });

  // Calculate Overall Summary Metrics based on statusFilter
  const grandTotalCost = allItems.reduce((sum, it) => {
    if (statusFilter === 'completed') return sum + it.completedCost;
    if (statusFilter === 'active') return sum + it.activeCost;
    return sum + it.totalCost;
  }, 0);

  const grandTotalUnits = allItems.reduce((sum, it) => {
    if (statusFilter === 'completed') return sum + it.completedQty;
    if (statusFilter === 'active') return sum + it.activeQty;
    return sum + it.totalQty;
  }, 0);

  const filteredTotalCost = filtered.reduce((sum, it) => {
    if (statusFilter === 'completed') return sum + it.completedCost;
    if (statusFilter === 'active') return sum + it.activeCost;
    return sum + it.totalCost;
  }, 0);

  // Top item by cost
  let topItem = null;
  filtered.forEach(it => {
    const cost = statusFilter === 'completed' ? it.completedCost : (statusFilter === 'active' ? it.activeCost : it.totalCost);
    if (!topItem || cost > (statusFilter === 'completed' ? topItem.completedCost : (statusFilter === 'active' ? topItem.activeCost : topItem.totalCost))) {
      topItem = it;
    }
  });

  // Sort
  filtered.sort((a, b) => {
    const aCost = statusFilter === 'completed' ? a.completedCost : (statusFilter === 'active' ? a.activeCost : a.totalCost);
    const bCost = statusFilter === 'completed' ? b.completedCost : (statusFilter === 'active' ? b.activeCost : b.totalCost);
    const aQty = statusFilter === 'completed' ? a.completedQty : (statusFilter === 'active' ? a.activeQty : a.totalQty);
    const bQty = statusFilter === 'completed' ? b.completedQty : (statusFilter === 'active' ? b.activeQty : b.totalQty);

    switch (sortSelect) {
      case 'cost_desc': return bCost - aCost;
      case 'qty_desc': return bQty - aQty;
      case 'unit_desc': return (b.unitPrice || 0) - (a.unitPrice || 0);
      case 'name_asc': return a.name.localeCompare(b.name);
      default: return bCost - aCost;
    }
  });

  // Render Top Summary Box
  if (summaryBox) {
    const topCost = topItem ? (statusFilter === 'completed' ? topItem.completedCost : (statusFilter === 'active' ? topItem.activeCost : topItem.totalCost)) : 0;
    const statusLabel = statusFilter === 'completed' ? 'Burned (Completed)' : (statusFilter === 'active' ? 'Pending (Active Board)' : 'Total (Burned + Pending)');

    summaryBox.innerHTML = `
      <div class="items-summary-card">
        <span class="items-summary-icon">🔥</span>
        <div class="items-summary-data">
          <span class="items-summary-label">${statusLabel} SFL Cost</span>
          <span class="items-summary-value text-red">${formatSFL(filteredTotalCost)} SFL</span>
        </div>
      </div>

      <div class="items-summary-card">
        <span class="items-summary-icon">📦</span>
        <div class="items-summary-data">
          <span class="items-summary-label">${statusLabel} Units</span>
          <span class="items-summary-value text-emerald">${Math.round(grandTotalUnits).toLocaleString()} Units</span>
        </div>
      </div>

      <div class="items-summary-card">
        <span class="items-summary-icon">🧺</span>
        <div class="items-summary-data">
          <span class="items-summary-label">Unique Items</span>
          <span class="items-summary-value text-amber">${filtered.length} Items</span>
        </div>
      </div>

      <div class="items-summary-card">
        <span class="items-summary-icon">👑</span>
        <div class="items-summary-data">
          <span class="items-summary-label">Top Expense Item</span>
          <span class="items-summary-value text-purple" style="font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${topItem ? topItem.name : 'None'}">
            ${topItem ? `${topItem.name} (${formatSFL(topCost)} SFL)` : '---'}
          </span>
        </div>
      </div>
    `;
  }

  // Render Empty State
  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div style="background:#FFF8DC; border:2px dashed #8B5A2B; border-radius:8px; padding:30px; text-align:center; color:#8C7853; margin-top:10px;">
        <span style="font-size:28px;">🔍</span>
        <div style="font-weight:900; font-size:14px; margin-top:8px; color:#5C4033;">No items match your filter.</div>
        <p style="font-size:11.5px; margin-top:4px;">Try clearing your search term or switching the status/category filter.</p>
      </div>
    `;
    return;
  }

  // Render Items Cards
  listContainer.innerHTML = filtered.map(item => {
    const isCompletedFilter = statusFilter === 'completed';
    const isActiveFilter = statusFilter === 'active';

    const displayQty = isCompletedFilter ? item.completedQty : (isActiveFilter ? item.activeQty : item.totalQty);
    const displayCost = isCompletedFilter ? item.completedCost : (isActiveFilter ? item.activeCost : item.totalCost);

    const costSharePercent = grandTotalCost > 0 ? ((displayCost / grandTotalCost) * 100).toFixed(1) : "0.0";
    const percentDone = item.totalQty > 0 ? Math.min(100, Math.round((item.completedQty / item.totalQty) * 100)) : 0;

    const emoji = getCategoryEmoji(item.category);
    const catLabel = getCategoryLabel(item.category);

    const sourcesHtml = [
      item.deliveryCount > 0 ? `<span class="source-tag">📦 ${item.deliveryCount} Deliv</span>` : '',
      item.bountyCount > 0 ? `<span class="source-tag">📜 ${item.bountyCount} Bounty</span>` : ''
    ].filter(Boolean).join(' ');

    return `
      <div class="item-burn-card">
        <div class="item-burn-left">
          <div class="item-burn-icon-box">${emoji}</div>
          <div class="item-burn-meta">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <strong class="item-burn-name">${item.name}</strong>
              <span class="cat-pill cat-${item.category}">${catLabel}</span>
            </div>
            <div class="item-burn-subtext">
              <span>💎 Unit: ~${formatSFL(item.unitPrice)} SFL</span>
              ${sourcesHtml ? `• ${sourcesHtml}` : ''}
            </div>
          </div>
        </div>

        <div class="item-burn-center">
          <div class="item-burn-qty-main">
            <span class="item-burn-qty-val">${displayQty.toLocaleString()}x</span>
            <span class="item-burn-qty-label">${statusFilter === 'all' ? 'Total' : (isCompletedFilter ? 'Burned' : 'Pending')}</span>
          </div>
          ${statusFilter === 'all' ? `
            <div class="item-burn-progress-wrap" title="${percentDone}% burned (${item.completedQty}/${item.totalQty})">
              <div class="item-burn-progress-bar">
                <div class="item-burn-progress-fill" style="width: ${percentDone}%;"></div>
              </div>
              <span class="item-burn-progress-text">${percentDone}% done</span>
            </div>
          ` : ''}
        </div>

        <div class="item-burn-right">
          <span class="item-burn-cost-val">${formatSFL(displayCost)} SFL</span>
          <span class="item-burn-cost-share" title="${costSharePercent}% of chapter SFL burn">${costSharePercent}% share</span>
        </div>
      </div>
    `;
  }).join('');
}
