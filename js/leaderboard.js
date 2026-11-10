// Sunflower Land Seasonal Ticket Leaderboard Controller
// Fetches and displays global chapter ticket rankings with live player context.

import { renderChapterTicketIcon } from './item-icons.js';
import { state } from './state.js';

let _leaderboardData = null;
let _leaderboardLimit = 100;
let _leaderboardFilter = '';
let _isLoading = false;
let _leaderboardError = null;
let _lastFetchedAt = 0;

export function getLeaderboardState() {
  return {
    data: _leaderboardData,
    limit: _leaderboardLimit,
    filter: _leaderboardFilter,
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

export async function loadLeaderboardData(forceRefresh = false) {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  // Cache for 60 seconds unless explicitly refreshed
  if (!forceRefresh && _leaderboardData && (now - _lastFetchedAt < 60000)) {
    renderLeaderboard();
    return;
  }

  _isLoading = true;
  _leaderboardError = null;
  renderLeaderboard();

  const farmId = resolveTargetFarmId();
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
            placeholder="🔍 Search name or Farm ID..." 
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

  // Find user's record in farmRankingDetails or rawList
  let userDetails = userRankings.find(r => String(r.farmId) === String(userFarmId));
  if (!userDetails && rawList.length > 0) {
    const idx = rawList.findIndex(r => String(r.farmId) === String(userFarmId));
    if (idx !== -1) {
      userDetails = { ...rawList[idx], rank: rawList[idx].rank || (idx + 1) };
    }
  }

  // Banner for User's Ranking
  let userBannerHtml = '';
  if (userDetails) {
    const userRankNum = userDetails.rank ? `#${userDetails.rank}` : 'Ranked';
    const userTicketsCount = (userDetails.count || 0).toLocaleString();
    const userXp = formatExperience(userDetails.experience);
    const userAsc = userDetails.ascensionLevel > 0 ? `⭐ Lvl ${userDetails.ascensionLevel}` : '';

    userBannerHtml = `
      <div class="leaderboard-user-card">
        <div class="leaderboard-user-info">
          <span class="leaderboard-user-badge">🌾 YOUR STANDING</span>
          <strong class="leaderboard-user-name">${userDetails.id || 'Farmer'}</strong>
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
        <td colspan="5" class="leaderboard-empty-row">
          ${_leaderboardFilter ? `No players found matching "${_leaderboardFilter}".` : 'No leaderboard records available.'}
        </td>
      </tr>
    `;
  } else {
    tableRowsHtml = filteredList.map(player => {
      const isCurrentUser = String(player.farmId) === String(userFarmId);
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
        <tr class="leaderboard-row ${isCurrentUser ? 'leaderboard-row-user' : ''}">
          <td class="col-rank">
            <span class="rank-badge ${rankClass}">${rankBadge}</span>
          </td>
          <td class="col-player">
            <div class="player-cell">
              <strong class="player-name">${player.id || 'Farmer'}</strong>
              ${isCurrentUser ? '<span class="you-badge">YOU</span>' : ''}
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

  // Surrounding ranks table if user is outside the current filtered view
  let surroundingHtml = '';
  if (userRankings.length > 0 && !_leaderboardFilter) {
    const isUserInFiltered = filteredList.some(p => String(p.farmId) === String(userFarmId));
    if (!isUserInFiltered) {
      surroundingHtml = `
        <div class="leaderboard-surrounding-section">
          <div class="surrounding-header">
            <span>📍 Your Surrounding Standings</span>
            <span class="surrounding-sub">Farms near your rank</span>
          </div>
          <table class="leaderboard-table surrounding-table">
            <tbody>
              ${userRankings.map(player => {
                const isUser = String(player.farmId) === String(userFarmId);
                const tixStr = (player.count || 0).toLocaleString();
                return `
                  <tr class="leaderboard-row ${isUser ? 'leaderboard-row-user' : ''}">
                    <td class="col-rank"><span class="rank-badge rank-normal">#${player.rank || '-'}</span></td>
                    <td class="col-player">
                      <div class="player-cell">
                        <strong class="player-name">${player.id || 'Farmer'}</strong>
                        ${isUser ? '<span class="you-badge">YOU</span>' : ''}
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

if (typeof window !== 'undefined') {
  window.setLeaderboardLimit = setLeaderboardLimit;
  window.setLeaderboardFilter = setLeaderboardFilter;
  window.loadLeaderboardData = loadLeaderboardData;
  window.renderLeaderboard = renderLeaderboard;
}
