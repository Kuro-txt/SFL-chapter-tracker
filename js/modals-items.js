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
    'popcorn', 'spaghetti', 'taco', 'sushi', 'fish and chips', 'deli'
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

  // 3. Animals & Animal Products
  const ANIMALS = [
    'egg', 'milk', 'wool', 'honey', 'leather', 'feather', 'cheese',
    'butter', 'beef', 'chicken', 'cow', 'sheep', 'pig', 'animal'
  ];
  if (ANIMALS.some(a => clean.includes(a))) return 'animals';

  // 4. Resources, Woods & Minerals
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
    default: return 'Other Items';
  }
}

// Active UI Filter State (In-Memory Only)
let currentCategoryFilter = 'all';
let currentViewMode = 'grid'; // 'grid' | 'compact'

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

  // Reset search on open
  const searchInput = document.getElementById('itemsSearchInput');
  if (searchInput) searchInput.value = '';

  const btnGrid = document.getElementById('btnViewGrid');
  const btnCompact = document.getElementById('btnViewCompact');
  if (btnGrid && btnCompact) {
    btnGrid.classList.toggle('active', currentViewMode === 'grid');
    btnCompact.classList.toggle('active', currentViewMode === 'compact');
  }

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
 * Set active Category Filter from Tab click
 */
export function setBurnedCategoryFilter(cat) {
  currentCategoryFilter = cat;
  renderItemsBurnedList();
}

/**
 * Toggle between 'grid' and 'compact' view
 */
export function toggleBurnedViewMode(mode) {
  currentViewMode = mode;
  const btnGrid = document.getElementById('btnViewGrid');
  const btnCompact = document.getElementById('btnViewCompact');
  if (btnGrid && btnCompact) {
    btnGrid.classList.toggle('active', mode === 'grid');
    btnCompact.classList.toggle('active', mode === 'compact');
  }
  renderItemsBurnedList();
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

  const isCompletedFilter = statusFilter === 'completed';
  const isActiveFilter = statusFilter === 'active';

  // 1. Calculate Category Totals (for tabs & distribution bar)
  const categoriesList = ['crops', 'food', 'animals', 'resources', 'other'];
  const catStats = {
    all: { count: 0, cost: 0, units: 0 },
    crops: { count: 0, cost: 0, units: 0 },
    food: { count: 0, cost: 0, units: 0 },
    animals: { count: 0, cost: 0, units: 0 },
    resources: { count: 0, cost: 0, units: 0 },
    other: { count: 0, cost: 0, units: 0 }
  };

  allItems.forEach(item => {
    const cost = isCompletedFilter ? item.completedCost : (isActiveFilter ? item.activeCost : item.totalCost);
    const qty = isCompletedFilter ? item.completedQty : (isActiveFilter ? item.activeQty : item.totalQty);

    if (qty > 0) {
      catStats.all.count++;
      catStats.all.cost += cost;
      catStats.all.units += qty;

      if (catStats[item.category]) {
        catStats[item.category].count++;
        catStats[item.category].cost += cost;
        catStats[item.category].units += qty;
      } else {
        catStats.other.count++;
        catStats.other.cost += cost;
        catStats.other.units += qty;
      }
    }
  });

  // 2. Filter items according to search, category, and status
  let filtered = allItems.filter(item => {
    // Search keyword
    if (searchKeyword && !item.name.toLowerCase().includes(searchKeyword)) {
      return false;
    }

    // Category tab
    if (currentCategoryFilter !== 'all' && item.category !== currentCategoryFilter) {
      return false;
    }

    // Status filter
    if (isCompletedFilter) {
      return item.completedQty > 0;
    } else if (isActiveFilter) {
      return item.activeQty > 0;
    }
    return item.totalQty > 0;
  });

  // 3. Find top item by cost in current view
  let topItem = null;
  filtered.forEach(it => {
    const cost = isCompletedFilter ? it.completedCost : (isActiveFilter ? it.activeCost : it.totalCost);
    const topCost = topItem ? (isCompletedFilter ? topItem.completedCost : (isActiveFilter ? topItem.activeCost : topItem.totalCost)) : 0;
    if (!topItem || cost > topCost) {
      topItem = it;
    }
  });

  // 4. Sort helper
  const sortItems = (arr) => {
    return arr.sort((a, b) => {
      const aCost = isCompletedFilter ? a.completedCost : (isActiveFilter ? a.activeCost : a.totalCost);
      const bCost = isCompletedFilter ? b.completedCost : (isActiveFilter ? b.activeCost : b.totalCost);
      const aQty = isCompletedFilter ? a.completedQty : (isActiveFilter ? a.activeQty : a.totalQty);
      const bQty = isCompletedFilter ? b.completedQty : (isActiveFilter ? b.activeQty : b.totalQty);

      switch (sortSelect) {
        case 'cost_desc': return bCost - aCost;
        case 'qty_desc': return bQty - aQty;
        case 'unit_desc': return (b.unitPrice || 0) - (a.unitPrice || 0);
        case 'name_asc': return a.name.localeCompare(b.name);
        default: return bCost - aCost;
      }
    });
  };

  // 5. Render Top Metrics Summary Box & Visual Spend Distribution
  if (summaryBox) {
    const topCost = topItem ? (isCompletedFilter ? topItem.completedCost : (isActiveFilter ? topItem.activeCost : topItem.totalCost)) : 0;
    const statusLabel = isCompletedFilter ? 'Burned' : (isActiveFilter ? 'Pending' : 'Total');

    // Build visual spend distribution bar
    const totalCostAll = catStats.all.cost;
    const distributionSegments = categoriesList.map(cat => {
      const cost = catStats[cat].cost;
      if (cost <= 0 || totalCostAll <= 0) return '';
      const pct = ((cost / totalCostAll) * 100).toFixed(1);
      const label = getCategoryLabel(cat);
      const emoji = getCategoryEmoji(cat);
      return `<div class="spend-bar-segment seg-${cat}" style="width: ${pct}%;" title="${emoji} ${label}: ${formatSFL(cost)} SFL (${pct}%)"></div>`;
    }).filter(Boolean).join('');

    // Build interactive Category Filter Tabs
    const tabsHtml = [
      { id: 'all', emoji: '🌟', label: 'All' },
      { id: 'crops', emoji: '🌾', label: 'Crops' },
      { id: 'food', emoji: '🍳', label: 'Food' },
      { id: 'animals', emoji: '🐄', label: 'Animals' },
      { id: 'resources', emoji: '🪵', label: 'Resources' },
      { id: 'other', emoji: '✨', label: 'Other' }
    ].map(t => {
      const activeClass = currentCategoryFilter === t.id ? 'active' : '';
      const count = catStats[t.id]?.count || 0;
      const cost = catStats[t.id]?.cost || 0;
      return `
        <button type="button" class="cat-tab-btn ${activeClass}" onclick="setBurnedCategoryFilter('${t.id}')">
          <span>${t.emoji} ${t.label}</span>
          <span class="cat-tab-badge">${count} • ${formatSFL(cost)}</span>
        </button>
      `;
    }).join('');

    summaryBox.innerHTML = `
      <!-- 1. COMPACT METRICS CHIP STRIP -->
      <div class="chapter-items-summary-strip">
        <div class="summary-metric-chip">
          <span class="chip-icon">🔥</span>
          <div class="chip-content">
            <span class="chip-label">${statusLabel} Cost</span>
            <span class="chip-val text-red">${formatSFL(catStats.all.cost)} SFL</span>
          </div>
        </div>

        <div class="summary-metric-chip">
          <span class="chip-icon">📦</span>
          <div class="chip-content">
            <span class="chip-label">${statusLabel} Units</span>
            <span class="chip-val text-emerald">${Math.round(catStats.all.units).toLocaleString()}</span>
          </div>
        </div>

        <div class="summary-metric-chip">
          <span class="chip-icon">🧺</span>
          <div class="chip-content">
            <span class="chip-label">Unique Items</span>
            <span class="chip-val text-amber">${catStats.all.count}</span>
          </div>
        </div>

        <div class="summary-metric-chip chip-top-item" title="${topItem ? `${topItem.name} (${formatSFL(topCost)} SFL)` : 'None'}">
          <span class="chip-icon">👑</span>
          <div class="chip-content">
            <span class="chip-label">Top Expense</span>
            <span class="chip-val text-purple">${topItem ? `${topItem.name}` : '---'}</span>
          </div>
        </div>
      </div>

      <!-- 2. COMPACT SPEND DISTRIBUTION BAR -->
      ${totalCostAll > 0 ? `
        <div class="spend-distribution-compact">
          <div class="spend-bar-container">
            <div class="spend-distribution-bar">
              ${distributionSegments}
            </div>
          </div>
          <div class="spend-distribution-legend">
            <span class="leg-item leg-crops">🌾 Crops (${catStats.crops.cost > 0 ? ((catStats.crops.cost/totalCostAll)*100).toFixed(0) : 0}%)</span>
            <span class="leg-item leg-food">🍳 Food (${catStats.food.cost > 0 ? ((catStats.food.cost/totalCostAll)*100).toFixed(0) : 0}%)</span>
            <span class="leg-item leg-animals">🐄 Animals (${catStats.animals.cost > 0 ? ((catStats.animals.cost/totalCostAll)*100).toFixed(0) : 0}%)</span>
            <span class="leg-item leg-resources">🪵 Resources (${catStats.resources.cost > 0 ? ((catStats.resources.cost/totalCostAll)*100).toFixed(0) : 0}%)</span>
          </div>
        </div>
      ` : ''}

      <!-- 3. COMPACT CATEGORY FILTER TABS -->
      <div class="items-category-tabs">
        ${tabsHtml}
      </div>
    `;
  }

  // 6. Handle Empty State
  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div class="items-empty-state">
        <span style="font-size:28px;">🔍</span>
        <div class="empty-state-title">No items found matching your filters.</div>
        <p class="empty-state-sub">Try changing your search keywords, status filter, or selecting "All Categories".</p>
      </div>
    `;
    return;
  }

  // 7. Helper: Render an individual item card
  const renderItemCard = (item) => {
    const displayQty = isCompletedFilter ? item.completedQty : (isActiveFilter ? item.activeQty : item.totalQty);
    const displayCost = isCompletedFilter ? item.completedCost : (isActiveFilter ? item.activeCost : item.totalCost);

    const costSharePercent = catStats.all.cost > 0 ? ((displayCost / catStats.all.cost) * 100).toFixed(1) : "0.0";
    const percentDone = item.totalQty > 0 ? Math.min(100, Math.round((item.completedQty / item.totalQty) * 100)) : 0;

    const emoji = getCategoryEmoji(item.category);
    const catLabel = getCategoryLabel(item.category);

    const sourcesHtml = [
      item.deliveryCount > 0 ? `<span class="source-tag">📦 ${item.deliveryCount}</span>` : '',
      item.bountyCount > 0 ? `<span class="source-tag">📜 ${item.bountyCount}</span>` : ''
    ].filter(Boolean).join(' ');

    if (currentViewMode === 'compact') {
      return `
        <div class="item-burn-compact-row">
          <div class="compact-left">
            <span class="compact-emoji">${emoji}</span>
            <strong class="compact-name" title="${item.name}">${item.name}</strong>
            <span class="cat-pill cat-${item.category}">${catLabel}</span>
          </div>
          <div class="compact-center">
            <span class="compact-qty">${displayQty.toLocaleString()}x</span>
            <span class="compact-unit">@ ~${formatSFL(item.unitPrice)}</span>
            <span class="compact-sources">${sourcesHtml}</span>
          </div>
          <div class="compact-right">
            <strong class="compact-cost">${formatSFL(displayCost)} SFL</strong>
            <span class="compact-share">${costSharePercent}%</span>
          </div>
        </div>
      `;
    }

    // Grid Card Mode (High Density Inventory Tile)
    return `
      <div class="item-burn-grid-card">
        <div class="card-row-top">
          <div class="card-left">
            <div class="card-emoji-box">${emoji}</div>
            <div class="card-name-wrap">
              <strong class="card-name" title="${item.name}">${item.name}</strong>
              <span class="cat-pill cat-${item.category}">${catLabel}</span>
            </div>
          </div>
          <div class="card-right">
            <span class="card-cost">${formatSFL(displayCost)} SFL</span>
            <span class="card-share">${costSharePercent}%</span>
          </div>
        </div>

        <div class="card-row-bottom">
          <div class="card-stats">
            <span class="card-qty">${displayQty.toLocaleString()}x</span>
            <span class="card-unit">@ ~${formatSFL(item.unitPrice)}</span>
          </div>
          <div class="card-sources">
            ${sourcesHtml || '<span class="source-tag">Order</span>'}
          </div>
        </div>

        ${statusFilter === 'all' && item.totalQty > 0 ? `
          <div class="card-progress-compact">
            <div class="card-progress-bar">
              <div class="card-progress-fill" style="width: ${percentDone}%;"></div>
            </div>
            <span class="card-progress-text">${percentDone}% (${item.completedQty}/${item.totalQty})</span>
          </div>
        ` : ''}
      </div>
    `;
  };

  // 8. Render: Grouped by Category when 'All' is active AND no search is typed
  if (currentCategoryFilter === 'all' && !searchKeyword) {
    let sectionsHtml = '';

    categoriesList.forEach(cat => {
      const itemsInCat = sortItems(filtered.filter(it => it.category === cat));
      if (itemsInCat.length === 0) return;

      const catCost = itemsInCat.reduce((sum, it) => sum + (isCompletedFilter ? it.completedCost : (isActiveFilter ? it.activeCost : it.totalCost)), 0);
      const catUnits = itemsInCat.reduce((sum, it) => sum + (isCompletedFilter ? it.completedQty : (isActiveFilter ? it.activeQty : it.totalQty)), 0);
      const catPct = catStats.all.cost > 0 ? ((catCost / catStats.all.cost) * 100).toFixed(1) : "0.0";
      const emoji = getCategoryEmoji(cat);
      const label = getCategoryLabel(cat);

      sectionsHtml += `
        <div class="category-group-section">
          <div class="category-group-header">
            <div class="group-header-left">
              <span class="group-header-icon">${emoji}</span>
              <strong class="group-header-title">${label.toUpperCase()}</strong>
              <span class="group-header-count">(${itemsInCat.length} items)</span>
            </div>
            <div class="group-header-right">
              <span>${Math.round(catUnits).toLocaleString()} units</span> • 
              <strong class="group-header-cost">${formatSFL(catCost)} SFL</strong>
              <span class="group-header-share">(${catPct}%)</span>
            </div>
          </div>
          <div class="${currentViewMode === 'compact' ? 'items-compact-list' : 'items-cards-grid'}">
            ${itemsInCat.map(renderItemCard).join('')}
          </div>
        </div>
      `;
    });

    listContainer.innerHTML = sectionsHtml;
  } else {
    // Render single sorted list or grid
    const sortedFiltered = sortItems([...filtered]);
    const catLabel = currentCategoryFilter !== 'all' ? getCategoryLabel(currentCategoryFilter) : 'Filtered Items';
    const catEmoji = currentCategoryFilter !== 'all' ? getCategoryEmoji(currentCategoryFilter) : '🔍';
    const subCost = sortedFiltered.reduce((sum, it) => sum + (isCompletedFilter ? it.completedCost : (isActiveFilter ? it.activeCost : it.totalCost)), 0);

    listContainer.innerHTML = `
      <div class="category-group-section">
        <div class="category-group-header">
          <div class="group-header-left">
            <span class="group-header-icon">${catEmoji}</span>
            <strong class="group-header-title">${catLabel.toUpperCase()}</strong>
            <span class="group-header-count">(${sortedFiltered.length} items)</span>
          </div>
          <div class="group-header-right">
            <span>Subtotal:</span>
            <strong class="group-header-cost">${formatSFL(subCost)} SFL</strong>
          </div>
        </div>
        <div class="${currentViewMode === 'compact' ? 'items-compact-list' : 'items-cards-grid'}">
          ${sortedFiltered.map(renderItemCard).join('')}
        </div>
      </div>
    `;
  }
}

// Window bindings for inline button triggers
if (typeof window !== 'undefined') {
  window.setBurnedCategoryFilter = setBurnedCategoryFilter;
  window.toggleBurnedViewMode = toggleBurnedViewMode;
}
