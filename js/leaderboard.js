// Sunflower Land Seasonal Ticket Leaderboard Controller
// Fetches and displays global chapter ticket rankings with live player context.
// Converts usernames to Farm IDs via sfl.world API and queries the SFL Leaderboard API.

import { renderChapterTicketIcon } from './item-icons.js';
import { state } from './state.js';

let _leaderboardData = null;
let _leaderboardLimit = 100;
let _leaderboardFilter = '';
let _searchedFarmId = '';
let _searchedUsername = '';
let _searchStatus = { type: '', message: '' };
let _isLoading = false;
let _leaderboardError = null;
let _lastFetchedAt = 0;

export function getLeaderboardState() {
  return {
    data: _leaderboardData,
    limit: _leaderboardLimit,
    filter: _leaderboardFilter,
    searchedFarmId: _searchedFarmId,
    searchedUsername: _searchedUsername,
    searchStatus: _searchStatus,
    loading: _isLoading,
    error: _leaderboardError,
    lastFetchedAt: _lastFetchedAt
  };
}

export function setLeaderboardLimit(newLimit) {
  const limitNum = parseInt(newLimit, 10) || 100;
  if (_leaderboardLimit !== limitNum) {
    _leaderboardLimit = limitNum;
    loadLeaderboardData(true);
  }
}

export function setLeaderboardFilter(query) {
  _leaderboardFilter = (query || '').trim().toLowerCase();
  renderLeaderboard();
}

function resolveTargetFarmId() {
  if (state.globalData && state.globalData.farmId) {
    return String(state.globalData.farmId).trim();
  }
  if (typeof document !== 'undefined') {
    const inputEl = document.getElementById('farmId');
    if (inputEl && inputEl.value.trim()) {
      return inputEl.value.trim();
    }
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem('sfl_farmId');
      if (saved) return saved.trim();
    } catch (e) {}
  }
  return '8472883706403914'; // Default fallback farm ID
}

function resolveApiKey() {
  if (typeof document !== 'undefined') {
    const inputEl = document.getElementById('apiKey');
    if (inputEl && inputEl.value.trim()) {
      return inputEl.value.trim();
    }
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem('sfl_apiKey');
      if (saved) return saved.trim();
    } catch (e) {}
  }
  return '';
}

export async function lookupUsernameToFarmId(username) {
  const clean = (username || '').trim();
  if (!clean) throw new Error('Username cannot be empty.');

  // Try proxy endpoint first to bypass browser CORS
  try {
    const res = await fetch(`/api/chapter?action=lookupFarm&username=${encodeURIComponent(clean)}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        return json.data;
      }
      if (json && json.error) {
        throw new Error(json.error);
      }
    } else if (res.status === 404) {
      throw new Error(`Username "${clean}" not found on Sunflower Land.`);
    }
  } catch (proxyErr) {
    if (proxyErr.message && proxyErr.message.includes('not found')) {
      throw proxyErr;
    }
  }

  // Fallback direct fetch to sfl.world API
  try {
    const directRes = await fetch(`https://sfl.world/api/v1/land/info/username/${encodeURIComponent(clean)}`);
    if (!directRes.ok) {
      if (directRes.status === 404) throw new Error(`Username "${clean}" not found on Sunflower Land.`);
      throw new Error(`Lookup failed with status ${directRes.status}`);
    }
    const data = await directRes.json();
    return data;
  } catch (directErr) {
    throw new Error(directErr.message || `Unable to resolve username "${clean}".`);
  }
}

export async function searchLeaderboardRank(customQuery = '') {
  if (typeof document === 'undefined') return;
  const inputEl = document.getElementById('leaderboardRankSearchInput');
  const query = (typeof customQuery === 'string' && customQuery.trim()) 
    ? customQuery.trim() 
    : (inputEl ? inputEl.value.trim() : '');

  if (!query) {
    _searchStatus = { type: 'error', message: 'Please enter a username (e.g. Kuro1) or numeric Farm ID.' };
    renderLeaderboard();
    return;
  }

  const isNumeric = /^\d+$/.test(query);

  if (isNumeric) {
    _searchedFarmId = query;
    _searchedUsername = '';
    _searchStatus = { type: 'loading', message: 'Searching...' };
    renderLeaderboard();
    await loadLeaderboardData(true, query);
  } else {
    _searchStatus = { type: 'loading', message: 'Searching...' };
    renderLeaderboard();
    try {
      const info = await lookupUsernameToFarmId(query);
      if (!info || !info.farm_id) {
        throw new Error(`Could not find Farm ID for username "${query}".`);
      }
      _searchedFarmId = String(info.farm_id);
      _searchedUsername = info.username || query;
      _searchStatus = { type: 'loading', message: 'Searching...' };
      renderLeaderboard();
      await loadLeaderboardData(true, _searchedFarmId);
    } catch (err) {
      _searchStatus = { type: 'error', message: `❌ ${err.message}` };
      renderLeaderboard();
      return;
    }
  }

  // Verify if rank was located
  const rankDetails = Array.isArray(_leaderboardData?.farmRankingDetails) ? _leaderboardData.farmRankingDetails : [];
  const topList = Array.isArray(_leaderboardData?.topTen) ? _leaderboardData.topTen : (Array.isArray(_leaderboardData?.ranking) ? _leaderboardData.ranking : []);
  let foundRecord = rankDetails.find(r => String(r.farmId) === String(_searchedFarmId));
  if (!foundRecord && topList.length > 0) {
    const topIdx = topList.findIndex(r => String(r.farmId) === String(_searchedFarmId));
    if (topIdx !== -1) {
      foundRecord = { ...topList[topIdx], rank: topList[topIdx].rank || (topIdx + 1) };
    }
  }

  if (foundRecord && foundRecord.rank) {
    const nameLabel = _searchedUsername || foundRecord.id || `Farm #${_searchedFarmId}`;
    _searchStatus = { 
      type: 'success', 
      message: `🏆 Found Rank #${foundRecord.rank} for ${nameLabel} with ${(foundRecord.count || 0).toLocaleString()} tickets!` 
    };
  } else {
    _searchStatus = { 
      type: 'warning', 
      message: `Player Farm #${_searchedFarmId}${_searchedUsername ? ` (${_searchedUsername})` : ''} is currently unranked or has 0 tickets.` 
    };
  }
  renderLeaderboard();
}

export function clearRankSearch() {
  _searchedFarmId = '';
  _searchedUsername = '';
  _searchStatus = { type: '', message: '' };
  if (typeof document !== 'undefined') {
    const inputEl = document.getElementById('leaderboardRankSearchInput');
    if (inputEl) inputEl.value = '';
  }
  loadLeaderboardData(true);
}

export function openLeaderboardModal() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('leaderboardModal');
  if (modal) {
    modal.classList.add('show');
    loadLeaderboardData();
  }
}

export function closeLeaderboardModal() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('leaderboardModal');
  if (modal) modal.classList.remove('show');
}

export function toggleLeaderboardModal() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('leaderboardModal');
  if (modal) {
    if (modal.classList.contains('show')) {
      closeLeaderboardModal();
    } else {
      openLeaderboardModal();
    }
  }
}

export async function loadLeaderboardData(forceRefresh = false, overrideFarmId = null) {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  // Cache for 60 seconds unless explicitly refreshed or searching specific farm
  if (!forceRefresh && !overrideFarmId && _leaderboardData && (now - _lastFetchedAt < 60000)) {
    renderLeaderboard();
    return;
  }

  _isLoading = true;
  _leaderboardError = null;
  renderLeaderboard();

  const userFarmId = resolveTargetFarmId();
  const farmId = overrideFarmId || _searchedFarmId || userFarmId;
  const apiKey = resolveApiKey();

  try {
    const queryParams = new URLSearchParams({
      action: 'getLeaderboard',
      limit: String(_leaderboardLimit)
    });
    if (farmId) queryParams.set('farmId', farmId);
    if (apiKey) queryParams.set('apiKey', apiKey);
    if (state.currentUser) queryParams.set('username', state.currentUser);

    const res = await fetch(`/api/chapter?${queryParams.toString()}`);
    const result = await res.json();

    if (!res.ok || !result.success) {
      throw new Error(result.error || `Failed to load leaderboard (HTTP ${res.status})`);
    }

    _leaderboardData = result.data || result.leaderboard || null;
    _lastFetchedAt = Date.now();

    // Auto-update user's rank in Total Tickets card when querying user's own farm
    try {
      if (String(farmId) === String(userFarmId)) {
        const rankDetails = Array.isArray(_leaderboardData?.farmRankingDetails) ? _leaderboardData.farmRankingDetails : [];
        const topList = Array.isArray(_leaderboardData?.topTen) ? _leaderboardData.topTen : (Array.isArray(_leaderboardData?.ranking) ? _leaderboardData.ranking : []);
        let myRecord = rankDetails.find(r => String(r.farmId) === String(userFarmId));
        if (!myRecord && topList.length > 0) {
          const topIdx = topList.findIndex(r => String(r.farmId) === String(userFarmId));
          if (topIdx !== -1) {
            myRecord = { ...topList[topIdx], rank: topList[topIdx].rank || (topIdx + 1) };
          }
        }
        if (myRecord && myRecord.rank) {
          updateUserRankDisplay(myRecord.rank, myRecord.id);
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('sfl_user_rank', JSON.stringify({ rank: myRecord.rank, name: myRecord.id || '', farmId: myRecord.farmId }));
          }
        }
      }
    } catch (rankErr) {
      console.warn('Rank card update notice:', rankErr);
    }
  } catch (err) {
    console.warn('Leaderboard fetch error:', err.message);
    _leaderboardError = err.message || 'Unable to load leaderboard data.';
  } finally {
    _isLoading = false;
    renderLeaderboard();
  }
}

function formatExperience(xp) {
  const num = Number(xp);
  if (isNaN(num) || num <= 0) return '0 XP';
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B XP`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M XP`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K XP`;
  return `${Math.round(num).toLocaleString()} XP`;
}

export function renderLeaderboard() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('leaderboardContainer');
  if (!container) return;

  const userFarmId = resolveTargetFarmId();
  const effectiveFarmId = _searchedFarmId || userFarmId;
  const isSearchActive = Boolean(_searchedFarmId && _searchedFarmId !== userFarmId);

  // Search & Lookup Bar HTML
  const searchBarHtml = `
    <div class="leaderboard-search-card">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
        <label for="leaderboardRankSearchInput" style="font-weight:900; font-size:12px; color:#8B4513; display:flex; align-items:center; gap:5px;">
          <span>🔍</span> <span>SEARCH PLAYER RANK (USERNAME OR FARM ID):</span>
        </label>
        ${isSearchActive ? `
          <button type="button" class="btn btn-sm btn-subtle" onclick="clearRankSearch()" style="padding:2px 8px; font-size:11px; cursor:pointer;">
            ↩ Reset to My Farm (#${userFarmId})
          </button>
        ` : ''}
      </div>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:6px;">
        <input 
          type="text" 
          id="leaderboardRankSearchInput" 
          placeholder="Enter Username (e.g. Kuro1) or Farm ID (e.g. 8472883706403914)..." 
          value="${_searchedUsername || _searchedFarmId || ''}"
          onkeydown="if(event.key==='Enter') searchLeaderboardRank()"
          class="leaderboard-rank-input"
        />
        <button type="button" class="btn btn-wood" onclick="searchLeaderboardRank()" style="padding:6px 14px; font-size:12px; font-weight:900;">
          🎯 SEARCH RANK
        </button>
      </div>
      ${_searchStatus.message ? `
        <div class="leaderboard-search-status ${_searchStatus.type}">
          ${_searchStatus.message}
        </div>
      ` : ''}
    </div>
  `;

  // Header and controls HTML
  const headerHtml = `
    <div class="leaderboard-header">
      <div class="leaderboard-title-group">
        <h3 class="leaderboard-title">🏆 TICKET LEADERBOARD</h3>
        <span class="leaderboard-subtitle">Cave Dwellers Season Ranking</span>
      </div>

      <div class="leaderboard-controls">
        <div class="leaderboard-limit-group">
          <span class="leaderboard-label">Top:</span>
          <button type="button" class="btn btn-sm ${_leaderboardLimit === 10 ? 'btn-wood active' : 'btn-subtle'}" onclick="setLeaderboardLimit(10)">10</button>
          <button type="button" class="btn btn-sm ${_leaderboardLimit === 100 ? 'btn-wood active' : 'btn-subtle'}" onclick="setLeaderboardLimit(100)">100</button>
          <button type="button" class="btn btn-sm ${_leaderboardLimit === 500 ? 'btn-wood active' : 'btn-subtle'}" onclick="setLeaderboardLimit(500)">500</button>
        </div>

        <div class="leaderboard-search-box">
          <input 
            type="text" 
            id="leaderboardSearchInput" 
            placeholder="🔍 Filter loaded table..." 
            value="${_leaderboardFilter}" 
            oninput="setLeaderboardFilter(this.value)"
            class="leaderboard-search-input"
          />
          ${_leaderboardFilter ? `<button class="leaderboard-clear-btn" onclick="setLeaderboardFilter('')">✕</button>` : ''}
        </div>

        <button type="button" class="btn btn-wood btn-sm leaderboard-refresh-btn" onclick="loadLeaderboardData(true)" ${_isLoading ? 'disabled' : ''}>
          ${_isLoading ? '⏳ LOADING...' : '🔄 REFRESH'}
        </button>
      </div>
    </div>
  `;

  // Loading state
  if (_isLoading && !_leaderboardData) {
    container.innerHTML = `
      ${searchBarHtml}
      ${headerHtml}
      <div class="leaderboard-loading-state">
        <div class="leaderboard-spinner"></div>
        <p>Fetching live ticket leaderboard from Sunflower Land...</p>
      </div>
    `;
    return;
  }

  // Error state
  if (_leaderboardError && !_leaderboardData) {
    container.innerHTML = `
      ${searchBarHtml}
      ${headerHtml}
      <div class="leaderboard-error-state">
        <span class="leaderboard-error-icon">⚠️</span>
        <strong>Unable to retrieve leaderboard</strong>
        <p class="leaderboard-error-desc">${_leaderboardError}</p>
        ${_leaderboardError.includes('API key is required') ? `
          <div class="leaderboard-key-hint">
            <p>💡 The Sunflower Land Community API requires a valid API key for live leaderboard data.</p>
            <button class="btn btn-wood" onclick="document.getElementById('apiKey')?.focus()">🔑 Enter API Key in Header</button>
          </div>
        ` : `
          <button class="btn btn-wood" onclick="loadLeaderboardData(true)">🔄 Try Again</button>
        `}
      </div>
    `;
    return;
  }

  const data = _leaderboardData || {};
  const rawList = Array.isArray(data.topTen) ? data.topTen : (Array.isArray(data.ranking) ? data.ranking : (Array.isArray(data.leaderboard) ? data.leaderboard : []));
  const userRankings = Array.isArray(data.farmRankingDetails) ? data.farmRankingDetails : [];
  const lastUpdatedMs = data.lastUpdated ? Number(data.lastUpdated) : null;
  const lastUpdatedStr = lastUpdatedMs ? new Date(lastUpdatedMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Live';
  const totalTickets = typeof data.total === 'number' ? data.total.toLocaleString() : null;

  // Find effective record in farmRankingDetails or rawList
  let userDetails = userRankings.find(r => String(r.farmId) === String(effectiveFarmId));
  if (!userDetails && rawList.length > 0) {
    const idx = rawList.findIndex(r => String(r.farmId) === String(effectiveFarmId));
    if (idx !== -1) {
      userDetails = { ...rawList[idx], rank: rawList[idx].rank || (idx + 1) };
    }
  }

  // Banner for User's / Searched Player's Ranking
  let userBannerHtml = '';
  if (userDetails) {
    const userRankNum = userDetails.rank ? `#${userDetails.rank}` : 'Ranked';
    const userTicketsCount = (userDetails.count || 0).toLocaleString();
    const userXp = formatExperience(userDetails.experience);
    const userAsc = userDetails.ascensionLevel > 0 ? `⭐ Lvl ${userDetails.ascensionLevel}` : '';
    const bannerTitle = isSearchActive ? '🎯 SEARCHED STANDING' : '🌾 YOUR STANDING';
    const displayName = _searchedUsername || userDetails.id || 'Farmer';

    userBannerHtml = `
      <div class="leaderboard-user-card ${isSearchActive ? 'searched-card' : ''}">
        <div class="leaderboard-user-info">
          <span class="leaderboard-user-badge">${bannerTitle}</span>
          <strong class="leaderboard-user-name">${displayName}</strong>
          <span class="leaderboard-user-farm">Farm #${userDetails.farmId}</span>
          ${userAsc ? `<span class="leaderboard-user-asc">${userAsc}</span>` : ''}
        </div>
        <div class="leaderboard-user-stats">
          <div class="leaderboard-stat-box">
            <span class="leaderboard-stat-label">RANK</span>
            <strong class="leaderboard-stat-val rank-highlight">${userRankNum}</strong>
          </div>
          <div class="leaderboard-stat-box">
            <span class="leaderboard-stat-label">TICKETS</span>
            <strong class="leaderboard-stat-val tix-highlight" style="display:inline-flex; align-items:center; gap:4px;">
              ${renderChapterTicketIcon(16)} <span>${userTicketsCount}</span>
            </strong>
          </div>
          <div class="leaderboard-stat-box">
            <span class="leaderboard-stat-label">EXPERIENCE</span>
            <span class="leaderboard-stat-sub">${userXp}</span>
          </div>
        </div>
      </div>
    `;
  }

  // Normalize list with ranks
  const normalizedList = rawList.map((item, idx) => ({
    ...item,
    rank: item.rank !== undefined ? Number(item.rank) : (idx + 1)
  }));

  // Filter list
  const filteredList = _leaderboardFilter 
    ? normalizedList.filter(item => {
        const nameMatch = (item.id || '').toLowerCase().includes(_leaderboardFilter);
        const farmMatch = String(item.farmId || '').includes(_leaderboardFilter);
        return nameMatch || farmMatch;
      })
    : normalizedList;

  // Build table rows
  let tableRowsHtml = '';
  if (filteredList.length === 0) {
    tableRowsHtml = `
      <tr>
        <td colspan="4" class="leaderboard-empty-row">
          ${_leaderboardFilter ? `No players found matching "${_leaderboardFilter}".` : 'No leaderboard records available.'}
        </td>
      </tr>
    `;
  } else {
    tableRowsHtml = filteredList.map(player => {
      const isTargetUser = String(player.farmId) === String(effectiveFarmId);
      const isActualUser = String(player.farmId) === String(userFarmId);
      const rank = player.rank;
      let rankBadge = `#${rank}`;
      let rankClass = 'rank-normal';
      if (rank === 1) {
        rankBadge = '🥇 1';
        rankClass = 'rank-gold';
      } else if (rank === 2) {
        rankBadge = '🥈 2';
        rankClass = 'rank-silver';
      } else if (rank === 3) {
        rankBadge = '🥉 3';
        rankClass = 'rank-bronze';
      }

      const ticketsFormatted = (player.count || 0).toLocaleString();
      const xpFormatted = formatExperience(player.experience);
      const ascBadge = player.ascensionLevel > 0 
        ? `<span class="leaderboard-asc-pill" title="Ascension Level ${player.ascensionLevel}">⭐ ${player.ascensionLevel}</span>` 
        : '';

      const bumpkin = player.bumpkin || {};
      const cosmeticsCount = Object.keys(bumpkin).length;
      const gearSummary = cosmeticsCount > 0 
        ? Object.entries(bumpkin).map(([slot, item]) => `${slot}: ${item}`).join('\n')
        : '';

      return `
        <tr class="leaderboard-row ${isTargetUser ? 'leaderboard-row-user' : ''}">
          <td class="col-rank">
            <span class="rank-badge ${rankClass}">${rankBadge}</span>
          </td>
          <td class="col-player">
            <div class="player-cell">
              <strong class="player-name">${player.id || 'Farmer'}</strong>
              ${isActualUser ? '<span class="you-badge">YOU</span>' : (isTargetUser ? '<span class="you-badge searched-badge">SEARCHED</span>' : '')}
              ${ascBadge}
              <span class="farm-id-pill">#${player.farmId}</span>
              ${cosmeticsCount > 0 ? `<span class="gear-pill" title="${gearSummary.replace(/"/g, '&quot;')}">👕 ${cosmeticsCount}</span>` : ''}
            </div>
          </td>
          <td class="col-tickets">
            <span class="tickets-val" style="display:inline-flex; align-items:center; gap:4px;">
              ${renderChapterTicketIcon(14)} <strong>${ticketsFormatted}</strong>
            </span>
          </td>
          <td class="col-xp">
            <span class="xp-val">${xpFormatted}</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Surrounding ranks table if target player is outside the current filtered view
  let surroundingHtml = '';
  if (userRankings.length > 0 && !_leaderboardFilter) {
    const isTargetInFiltered = filteredList.some(p => String(p.farmId) === String(effectiveFarmId));
    if (!isTargetInFiltered) {
      surroundingHtml = `
        <div class="leaderboard-surrounding-section">
          <div class="surrounding-header">
            <span>📍 Surrounding Standings</span>
            <span class="surrounding-sub">Farms near Rank #${userDetails?.rank || '-'}</span>
          </div>
          <table class="leaderboard-table surrounding-table">
            <tbody>
              ${userRankings.map(player => {
                const isTarget = String(player.farmId) === String(effectiveFarmId);
                const isActual = String(player.farmId) === String(userFarmId);
                const tixStr = (player.count || 0).toLocaleString();
                return `
                  <tr class="leaderboard-row ${isTarget ? 'leaderboard-row-user' : ''}">
                    <td class="col-rank"><span class="rank-badge rank-normal">#${player.rank || '-'}</span></td>
                    <td class="col-player">
                      <div class="player-cell">
                        <strong class="player-name">${player.id || 'Farmer'}</strong>
                        ${isActual ? '<span class="you-badge">YOU</span>' : (isTarget ? '<span class="you-badge searched-badge">SEARCHED</span>' : '')}
                        <span class="farm-id-pill">#${player.farmId}</span>
                      </div>
                    </td>
                    <td class="col-tickets">
                      <span class="tickets-val" style="display:inline-flex; align-items:center; gap:4px;">
                        ${renderChapterTicketIcon(14)} <strong>${tixStr}</strong>
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  // Meta footer
  const footerHtml = `
    <div class="leaderboard-footer">
      <span>⏱️ Updated: <strong>${lastUpdatedStr}</strong></span>
      ${totalTickets ? `<span>🎟️ Season Total: <strong>${totalTickets} Tickets</strong></span>` : ''}
      <span>👥 Showing <strong>${filteredList.length}</strong> of <strong>${normalizedList.length}</strong> loaded</span>
    </div>
  `;

  container.innerHTML = `
    ${searchBarHtml}
    ${headerHtml}
    ${userBannerHtml}
    <div class="leaderboard-table-wrapper">
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th class="col-rank">RANK</th>
            <th class="col-player">FARMER</th>
            <th class="col-tickets">TICKETS</th>
            <th class="col-xp">EXPERIENCE</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </div>
    ${surroundingHtml}
    ${footerHtml}
  `;
}

export function updateUserRankDisplay(rank, playerName = '') {
  if (typeof document === 'undefined') return;
  const badgeEl = document.getElementById('statTotalRankBadge');
  const footerEl = document.getElementById('statTotalRank');
  const tipEl = document.getElementById('tipTotalRank');

  if (!rank) {
    if (badgeEl) badgeEl.style.display = 'none';
    if (footerEl) footerEl.textContent = '#--';
    if (tipEl) tipEl.textContent = '🏆 Global Rank: Unranked';
    return;
  }

  const rankStr = `#${rank}`;
  if (badgeEl) {
    badgeEl.textContent = rankStr;
    badgeEl.style.display = 'inline-block';
    badgeEl.title = `Your Global Rank: ${rankStr}${playerName ? ` (${playerName})` : ''} - Click to view Leaderboard`;
  }
  if (footerEl) {
    footerEl.innerHTML = `<span style="display:inline-flex; align-items:center; gap:3px;">🏆 ${rankStr}</span>`;
    footerEl.title = `Your Global Rank: ${rankStr}${playerName ? ` (${playerName})` : ''} - Click to view Leaderboard`;
  }
  if (tipEl) {
    tipEl.innerHTML = `🏆 Global Rank: <strong>${rankStr}</strong>${playerName ? ` (${playerName})` : ''}`;
  }
}

export function initLeaderboardRank() {
  if (typeof localStorage === 'undefined') return;
  try {
    const saved = localStorage.getItem('sfl_user_rank');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.rank) {
        updateUserRankDisplay(parsed.rank, parsed.name);
      }
    }
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  window.setLeaderboardLimit = setLeaderboardLimit;
  window.setLeaderboardFilter = setLeaderboardFilter;
  window.loadLeaderboardData = loadLeaderboardData;
  window.renderLeaderboard = renderLeaderboard;
  window.updateUserRankDisplay = updateUserRankDisplay;
  window.initLeaderboardRank = initLeaderboardRank;
  window.openLeaderboardModal = openLeaderboardModal;
  window.closeLeaderboardModal = closeLeaderboardModal;
  window.toggleLeaderboardModal = toggleLeaderboardModal;
  window.searchLeaderboardRank = searchLeaderboardRank;
  window.clearRankSearch = clearRankSearch;
  window.lookupUsernameToFarmId = lookupUsernameToFarmId;
}
