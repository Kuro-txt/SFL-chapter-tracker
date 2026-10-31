/**
 * projections.js — Ticket Projections & Forecasting Engine
 * Provides calculateProjections(), renderProjectionsView(), setProjectionScenario().
 * All projection scenarios operate on data already computed by recalculateAll().
 */

import { renderChapterTicketIcon } from './item-icons.js';

/** Chapter constants — must match render.js */
const TOTAL_CHAPTER_WEEKS = 12;
const BASE_EPOCH = new Date('2026-08-10T00:00:00.000Z');
const AUCTION_WEEK = 8;

/** Module-level state for active scenario */
let _activeScenario = 'current'; // 'current' | 'target' | 'custom'
let _customPace = 0;

/** Last computed projection data — cached so scenario switch doesn't need displayItems re-passed */
let _lastProjectionInput = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate all projection metrics for three scenarios.
 * @param {Array}  displayItems     — from renderWeeklyChart(); items 0..11 in week order
 * @param {string} currentMondayKey — ISO date of current week's Monday
 * @param {number} targetGoal       — user's chapter ticket goal (e.g. 1000)
 * @param {number} targetWeeks      — user's target week number (e.g. 12)
 * @returns {object} full projection payload
 */
export function calculateProjections(displayItems, currentMondayKey, targetGoal, targetWeeks) {
  // Cache input for re-render on scenario switch
  _lastProjectionInput = { displayItems, currentMondayKey, targetGoal, targetWeeks };

  const currentIndex = displayItems.findIndex(d => d.isCurrent);
  const nowMs = Date.now();

  // Fractional elapsed weeks (with partial-day precision)
  let elapsedWeeks = 0;
  let totalEarned = 0;

  if (currentIndex !== -1) {
    const currentMonMs = new Date(currentMondayKey + 'T00:00:00.000Z').getTime();
    const daysPassedInWeek = Math.max(0.2, Math.min(7, (nowMs - currentMonMs) / (24 * 60 * 60 * 1000)));
    elapsedWeeks = currentIndex + (daysPassedInWeek / 7);
    totalEarned = displayItems.slice(0, currentIndex + 1).reduce((s, d) => s + (d.tickets || 0), 0);
  } else {
    // Fallback: use days elapsed from epoch
    const diffDays = Math.max(0, (nowMs - BASE_EPOCH.getTime()) / (24 * 60 * 60 * 1000));
    elapsedWeeks = Math.min(TOTAL_CHAPTER_WEEKS, diffDays / 7);
    totalEarned = displayItems.reduce((s, d) => s + (d.tickets || 0), 0);
  }

  const weeksRemaining12 = Math.max(0, TOTAL_CHAPTER_WEEKS - elapsedWeeks);
  const weeksRemainingAuction = Math.max(0, AUCTION_WEEK - elapsedWeeks);
  const daysRemaining12 = weeksRemaining12 * 7;
  const daysRemainingAuction = weeksRemainingAuction * 7;

  // Pace calculations
  const pCurrent = elapsedWeeks > 0 && totalEarned > 0 ? totalEarned / elapsedWeeks : 0;
  const pTarget = targetGoal > 0 && targetWeeks > 0 ? targetGoal / targetWeeks : 0;
  const pCustom = _customPace > 0 ? _customPace : pCurrent;

  // Update default custom pace when first switching
  if (_customPace === 0 && pCurrent > 0) {
    _customPace = Math.round(pCurrent);
  }

  /**
   * Build milestone metrics for a given pace value.
   */
  function buildMilestone(pace, milestoneWeek, milestoneDaysRemaining, milestoneGoal) {
    const projected = Math.round(totalEarned + pace * Math.max(0, milestoneWeek - elapsedWeeks));
    const gapVsGoal = projected - milestoneGoal;
    const dailyRequired = milestoneDaysRemaining > 0.1
      ? Math.max(0, Math.ceil((milestoneGoal - totalEarned) / milestoneDaysRemaining))
      : 0;
    return { projected, gapVsGoal, dailyRequired };
  }

  // Week 8 target = proportional slice of full goal
  const goalAtWeek8 = targetGoal > 0 ? Math.round((targetGoal * AUCTION_WEEK) / TOTAL_CHAPTER_WEEKS) : 0;

  const scenarios = {
    current: {
      pace: pCurrent,
      week8: buildMilestone(pCurrent, AUCTION_WEEK, daysRemainingAuction, goalAtWeek8),
      week12: buildMilestone(pCurrent, TOTAL_CHAPTER_WEEKS, daysRemaining12, targetGoal)
    },
    target: {
      pace: pTarget,
      week8: buildMilestone(pTarget, AUCTION_WEEK, daysRemainingAuction, goalAtWeek8),
      week12: buildMilestone(pTarget, TOTAL_CHAPTER_WEEKS, daysRemaining12, targetGoal)
    },
    custom: {
      pace: pCustom,
      week8: buildMilestone(pCustom, AUCTION_WEEK, daysRemainingAuction, goalAtWeek8),
      week12: buildMilestone(pCustom, TOTAL_CHAPTER_WEEKS, daysRemaining12, targetGoal)
    }
  };

  // Goal completion date estimator for the active scenario
  function estimateGoalDate(pace) {
    if (pace <= 0 || totalEarned >= targetGoal) return null;
    const weeksToGoal = elapsedWeeks + (targetGoal - totalEarned) / pace;
    if (weeksToGoal > TOTAL_CHAPTER_WEEKS + 1) return null;
    const msToGoal = weeksToGoal * 7 * 24 * 60 * 60 * 1000;
    const goalDate = new Date(BASE_EPOCH.getTime() + msToGoal);
    const weekNum = Math.min(TOTAL_CHAPTER_WEEKS, Math.ceil(weeksToGoal));
    return {
      date: goalDate,
      weekNum,
      label: goalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    };
  }

  // 12-week roadmap cumulative data for each scenario
  function buildRoadmap(pace) {
    let cumulative = 0;
    return Array.from({ length: TOTAL_CHAPTER_WEEKS }, (_, i) => {
      const weekNum = i + 1;
      const item = displayItems[i];
      const isPast = item ? (!item.isCurrent && item.hasData) : false;
      const isCurrent = item ? item.isCurrent : false;
      const actual = item ? (item.tickets || 0) : 0;

      if (isPast || isCurrent) {
        cumulative += actual;
        return { weekNum, value: actual, cumulative, type: isCurrent ? 'current' : 'actual' };
      } else {
        cumulative += Math.round(pace);
        return { weekNum, value: Math.round(pace), cumulative, type: 'projected' };
      }
    });
  }

  const activePace = scenarios[_activeScenario]?.pace ?? pCurrent;

  return {
    totalEarned,
    elapsedWeeks,
    goalAtWeek8,
    targetGoal,
    scenarios,
    activeScenario: _activeScenario,
    activePace,
    customPace: _customPace,
    goalDate: estimateGoalDate(activePace),
    roadmap: buildRoadmap(activePace)
  };
}

/**
 * Switch the active projection scenario and re-render.
 * @param {'current'|'target'|'custom'} mode
 * @param {number} [customValue]
 */
export function setProjectionScenario(mode, customValue) {
  _activeScenario = mode;
  if (mode === 'custom' && customValue !== undefined && customValue !== null) {
    const parsed = parseFloat(customValue);
    if (!isNaN(parsed) && parsed >= 0) {
      _customPace = parsed;
    }
  }
  if (_lastProjectionInput) {
    const { displayItems, currentMondayKey, targetGoal, targetWeeks } = _lastProjectionInput;
    renderProjectionsView(
      calculateProjections(displayItems, currentMondayKey, targetGoal, targetWeeks)
    );
  }
}

/**
 * Render the projections dashboard into #weeklyProjectionsContainer.
 * @param {object} proj — result from calculateProjections()
 */
export function renderProjectionsView(proj) {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('weeklyProjectionsContainer');
  if (!container) return;

  const isDark = document.body ? document.body.classList.contains('dark-mode') : false;
  const ticketIconHtml = renderChapterTicketIcon(14);

  function gapBadge(gap, isDark) {
    if (gap > 0) {
      return `<span class="proj-gap-badge proj-gap-ahead${isDark ? ' dark' : ''}">+${gap.toLocaleString()} Ahead 🎯</span>`;
    } else if (gap < 0) {
      return `<span class="proj-gap-badge proj-gap-behind${isDark ? ' dark' : ''}">${gap.toLocaleString()} Behind ⚠️</span>`;
    }
    return `<span class="proj-gap-badge proj-gap-even${isDark ? ' dark' : ''}">On Target ✓</span>`;
  }

  const active = proj.scenarios[proj.activeScenario];
  const w8 = active.week8;
  const w12 = active.week12;
  const pace = active.pace;
  const dailyPace = pace > 0 ? Math.round(pace / 7) : 0;

  // Scenario button states
  function scenarioBtn(mode, label, paceVal) {
    const isActive = proj.activeScenario === mode;
    const paceStr = paceVal > 0 ? ` (${Math.round(paceVal)}/wk)` : '';
    return `<button
      class="scenario-pill${isActive ? ' active' : ''}${isDark ? ' dark' : ''}"
      onclick="window.setProjectionScenario('${mode}')"
    >${label}${paceStr}</button>`;
  }

  // Goal date banner
  let goalDateHtml = '';
  if (proj.totalEarned >= proj.targetGoal && proj.targetGoal > 0) {
    goalDateHtml = `<div class="proj-goal-date${isDark ? ' dark' : ''}">
      🎉 Chapter Goal Already Reached! (${proj.totalEarned.toLocaleString()} / ${proj.targetGoal.toLocaleString()} ${ticketIconHtml})
    </div>`;
  } else if (proj.goalDate) {
    goalDateHtml = `<div class="proj-goal-date${isDark ? ' dark' : ''}">
      📅 Predicted Goal Hit: <strong>${proj.goalDate.label}</strong>
      <span class="proj-goal-week-badge">Week ${proj.goalDate.weekNum}</span>
    </div>`;
  } else if (proj.targetGoal > 0 && pace > 0) {
    goalDateHtml = `<div class="proj-goal-date proj-goal-miss${isDark ? ' dark' : ''}">
      ⚠️ At current pace, goal may not be reached before Week 12.
    </div>`;
  }

  // Roadmap table rows
  const roadmapRows = proj.roadmap.map(row => {
    const isAuction = row.weekNum === AUCTION_WEEK;
    const isFinale = row.weekNum === TOTAL_CHAPTER_WEEKS;
    const typeLabel = row.type === 'actual' ? 'Actual' : row.type === 'current' ? 'Live' : 'Proj.';
    const typeClass = row.type === 'actual' ? 'roadmap-actual' : row.type === 'current' ? 'roadmap-current' : 'roadmap-proj';
    const milestoneHtml = isAuction
      ? `<span class="roadmap-milestone">🏁 Auction</span>`
      : isFinale
      ? `<span class="roadmap-milestone">🏆 Finale</span>`
      : '';
    return `<tr class="${isAuction || isFinale ? 'roadmap-highlight-row' : ''}${isDark ? ' dark' : ''}">
      <td class="roadmap-cell roadmap-week-cell">W${row.weekNum}${milestoneHtml}</td>
      <td class="roadmap-cell"><span class="roadmap-type-badge ${typeClass}">${typeLabel}</span></td>
      <td class="roadmap-cell roadmap-tix-cell">${ticketIconHtml} ${row.value.toLocaleString()}</td>
      <td class="roadmap-cell roadmap-cumul-cell">${row.cumulative.toLocaleString()} total</td>
    </tr>`;
  }).join('');

  const noDataNote = proj.elapsedWeeks < 0.2
    ? `<p class="proj-no-data-note">Track your first week of tickets to see live projections!</p>` : '';

  container.innerHTML = `
    ${noDataNote}

    <div class="projection-cards-grid">
      <div class="projection-metric-card${isDark ? ' dark' : ''}">
        <div class="proj-card-header">
          <span class="proj-milestone-icon">🏁</span>
          <span class="proj-milestone-title">WEEK 8 — AUCTION WEEK</span>
        </div>
        <div class="proj-card-tix">${ticketIconHtml} <strong>${w8.projected.toLocaleString()}</strong> Tickets</div>
        <div class="proj-card-gap">${gapBadge(w8.gapVsGoal, isDark)}</div>
        <div class="proj-card-meta">
          Pace: ${Math.round(pace).toLocaleString()} Tix/Wk (~${dailyPace}/day)
        </div>
        ${w8.dailyRequired > 0 ? `<div class="proj-card-daily">Need <strong>${w8.dailyRequired}</strong> ${ticketIconHtml}/day to hit goal</div>` : ''}
      </div>

      <div class="projection-metric-card${isDark ? ' dark' : ''}">
        <div class="proj-card-header">
          <span class="proj-milestone-icon">🏆</span>
          <span class="proj-milestone-title">WEEK 12 — SEASON FINALE</span>
        </div>
        <div class="proj-card-tix">${ticketIconHtml} <strong>${w12.projected.toLocaleString()}</strong> Tickets</div>
        <div class="proj-card-gap">${gapBadge(w12.gapVsGoal, isDark)}</div>
        <div class="proj-card-meta">
          Goal: ${proj.targetGoal.toLocaleString()} ${ticketIconHtml} | Earned: ${proj.totalEarned.toLocaleString()} ${ticketIconHtml}
        </div>
        ${w12.dailyRequired > 0 ? `<div class="proj-card-daily">Need <strong>${w12.dailyRequired}</strong> ${ticketIconHtml}/day to finish goal</div>` : ''}
      </div>
    </div>

    <div class="scenario-selector${isDark ? ' dark' : ''}">
      <span class="scenario-label">Forecast Scenario:</span>
      ${scenarioBtn('current', '🚀 Current Pace', proj.scenarios.current.pace)}
      ${scenarioBtn('target', '🎯 Target Pace', proj.scenarios.target.pace)}
      <span class="scenario-custom-wrap">
        <button
          class="scenario-pill${proj.activeScenario === 'custom' ? ' active' : ''}${isDark ? ' dark' : ''}"
          onclick="window.setProjectionScenario('custom', document.getElementById('customPaceInput').value)"
        >⚡ Custom</button>
        <input
          id="customPaceInput"
          type="number"
          min="0"
          max="9999"
          step="1"
          value="${Math.round(proj.customPace) || Math.round(proj.scenarios.current.pace) || 100}"
          class="scenario-custom-input${isDark ? ' dark' : ''}"
          oninput="window.setProjectionScenario('custom', this.value)"
          placeholder="Tix/Wk"
        />
        <span class="scenario-custom-unit">Tix/Wk</span>
      </span>
    </div>

    ${goalDateHtml}

    <details class="roadmap-details${isDark ? ' dark' : ''}">
      <summary class="roadmap-summary">📊 Week-by-Week Forecast Roadmap (Weeks 1–12)</summary>
      <div class="roadmap-table-wrap">
        <table class="roadmap-table${isDark ? ' dark' : ''}">
          <thead>
            <tr>
              <th class="roadmap-th">Week</th>
              <th class="roadmap-th">Type</th>
              <th class="roadmap-th">Tickets</th>
              <th class="roadmap-th">Cumulative</th>
            </tr>
          </thead>
          <tbody>${roadmapRows}</tbody>
        </table>
      </div>
    </details>
  `;
}
