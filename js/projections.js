/**
 * projections.js — Ticket Projections & Deterministic NPC Planner Engine
 * Provides calculateProjections(), renderProjectionsView(), setProjectionScenario(),
 * and interactive planner for Deliveries (with 2x Double Delivery), Bounties (incl. +100 Board Bonus),
 * Hank Chores (with VIP +2 buff), and Daily Logins.
 */

import { renderChapterTicketIcon } from './item-icons.js';
import { getActiveVipBonus, getActiveBoostCount } from './state.js';

/** Chapter constants — must match render.js */
const TOTAL_CHAPTER_WEEKS = 12;
const BASE_EPOCH = new Date('2026-11-09T00:00:00.000Z');
const AUCTION_WEEK = 9;

export const CHAPTER_WEEKS = [
  { num: 1, label: 'Nov 09 – Nov 15', start: '2026-11-09', end: '2026-11-15' },
  { num: 2, label: 'Nov 16 – Nov 22', start: '2026-11-16', end: '2026-11-22' },
  { num: 3, label: 'Nov 23 – Nov 29', start: '2026-11-23', end: '2026-11-29' },
  { num: 4, label: 'Nov 30 – Dec 06', start: '2026-11-30', end: '2026-12-06' },
  { num: 5, label: 'Dec 07 – Dec 13', start: '2026-12-07', end: '2026-12-13' },
  { num: 6, label: 'Dec 14 – Dec 20', start: '2026-12-14', end: '2026-12-20' },
  { num: 7, label: 'Dec 21 – Dec 27', start: '2026-12-21', end: '2026-12-27' },
  { num: 8, label: 'Dec 28 – Jan 03', start: '2026-12-28', end: '2027-01-03' },
  { num: 9, label: 'Jan 04 – Jan 10', start: '2027-01-04', end: '2027-01-10' },
  { num: 10, label: 'Jan 11 – Jan 17', start: '2027-01-11', end: '2027-01-17' },
  { num: 11, label: 'Jan 18 – Jan 24', start: '2027-01-18', end: '2027-01-24' },
  { num: 12, label: 'Jan 25 – Feb 01', start: '2027-01-25', end: '2027-02-01' }
];

export function getWeekDateRange(weekNum) {
  const wk = CHAPTER_WEEKS.find(w => w.num === Number(weekNum));
  return wk ? wk.label : '';
}

/** Core 11 Chapter Delivery NPCs with base tickets & official avatars */
export const CORE_CHAPTER_NPCS = [
  { id: 'pumpkin_pete', name: 'Pumpkin Pete', baseTickets: 1, avatar: 'public/icons/npcs/pumpkin_pete.webp' },
  { id: 'bert',         name: 'Bert',         baseTickets: 2, avatar: 'public/icons/npcs/bert.webp' },
  { id: 'finley',       name: 'Finley',       baseTickets: 2, avatar: 'public/icons/npcs/finley.webp' },
  { id: 'miranda',      name: 'Miranda',      baseTickets: 2, avatar: 'public/icons/npcs/miranda.webp' },
  { id: 'cornwell',     name: 'Cornwell',     baseTickets: 3, avatar: 'public/icons/npcs/cornwell.webp' },
  { id: 'raven',        name: 'Raven',        baseTickets: 4, avatar: 'public/icons/npcs/raven.webp' },
  { id: 'jester',       name: 'Jester',       baseTickets: 4, avatar: 'public/icons/npcs/jester.webp' },
  { id: 'finn',         name: 'Finn',         baseTickets: 5, avatar: 'public/icons/npcs/finn.webp' },
  { id: 'timmy',        name: 'Timmy',        baseTickets: 5, avatar: 'public/icons/npcs/timmy.webp' },
  { id: 'pharaoh',      name: 'Pharaoh',      baseTickets: 6, avatar: 'public/icons/npcs/pharaoh.webp' },
  { id: 'tywin',        name: 'Tywin',        baseTickets: 10, avatar: 'public/icons/npcs/tywin.webp' }
];

/** Default Planner Routine Template */
export const DEFAULT_PLANNER_TEMPLATE = {
  doubleDeliveryDays: 1, // 1 day per week gives 2x tickets
  mondayStackedDeliveries: false, // Default off: no extra Sunday rollover deliveries
  npcs: {
    pumpkin_pete: { enabled: true,  daysPerWeek: 7, doubleDelivery: true },
    bert:         { enabled: true,  daysPerWeek: 7, doubleDelivery: true },
    finley:       { enabled: true,  daysPerWeek: 7, doubleDelivery: true },
    miranda:      { enabled: true,  daysPerWeek: 7, doubleDelivery: true },
    cornwell:     { enabled: true,  daysPerWeek: 7, doubleDelivery: true },
    raven:        { enabled: false, daysPerWeek: 3, doubleDelivery: false },
    jester:       { enabled: false, daysPerWeek: 3, doubleDelivery: false },
    finn:         { enabled: false, daysPerWeek: 1, doubleDelivery: false },
    timmy:        { enabled: false, daysPerWeek: 1, doubleDelivery: false },
    pharaoh:      { enabled: false, daysPerWeek: 1, doubleDelivery: false },
    tywin:        { enabled: false, daysPerWeek: 1, doubleDelivery: false }
  },
  bounties: {
    regularEnabled: true,
    regularTix: 12,
    boardBonusEnabled: false, // +100 Tix Board Bonus
    animalEnabled: true,
    animalTix: 16
  },
  chores: {
    enabled: true,
    choresTix: 7,
    trackEnabled: true,
    trackTix: 0
  },
  logins: {
    enabled: true,
    daysPerWeek: 7
  }
};

/** Module state */
let _activeScenario = 'planned'; // 'planned' | 'current' | 'target' | 'custom'
let _customPace = 0;
let _plannerSelectedWeek = 'template'; // 'template' | number (e.g. 8, 12)
let _plannerSectionTab = 'deliveries'; // 'deliveries' | 'bounties' | 'chores'
let _lastProjectionInput = null;

// ---------------------------------------------------------------------------
// LocalStorage Persistence Helpers
// ---------------------------------------------------------------------------

export function getPlannerTemplate() {
  if (typeof localStorage === 'undefined') return JSON.parse(JSON.stringify(DEFAULT_PLANNER_TEMPLATE));
  try {
    const raw = localStorage.getItem('sfl_npc_planner_template');
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_PLANNER_TEMPLATE));
    const parsed = JSON.parse(raw);
    const bounties = { ...DEFAULT_PLANNER_TEMPLATE.bounties, ...(parsed.bounties || {}) };
    if (bounties.regularTix === undefined) {
      bounties.regularTix = (bounties.regularCount && bounties.regularAvgTix)
        ? (bounties.regularCount * bounties.regularAvgTix)
        : DEFAULT_PLANNER_TEMPLATE.bounties.regularTix;
    }
    if (bounties.animalTix === undefined) {
      bounties.animalTix = (bounties.animalCount && bounties.animalAvgTix)
        ? (bounties.animalCount * bounties.animalAvgTix)
        : DEFAULT_PLANNER_TEMPLATE.bounties.animalTix;
    }
    const chores = { ...DEFAULT_PLANNER_TEMPLATE.chores, ...(parsed.chores || {}) };
    if (chores.choresTix === undefined) {
      chores.choresTix = chores.customTix !== undefined
        ? chores.customTix
        : DEFAULT_PLANNER_TEMPLATE.chores.choresTix;
    }
    if (chores.trackEnabled === undefined) {
      chores.trackEnabled = DEFAULT_PLANNER_TEMPLATE.chores.trackEnabled !== false;
    }
    if (chores.trackTix === undefined) {
      let initialTrack = 0;
      if (typeof document !== 'undefined') {
        const docTrack = parseInt(document.getElementById('trackTicketsInput')?.value, 10);
        if (!isNaN(docTrack) && docTrack > 0) initialTrack = docTrack;
      }
      chores.trackTix = initialTrack;
    }
    const mondayStackedDeliveries = parsed.mondayStackedDeliveries === true;
    return {
      ...DEFAULT_PLANNER_TEMPLATE,
      ...parsed,
      mondayStackedDeliveries,
      npcs: { ...DEFAULT_PLANNER_TEMPLATE.npcs, ...(parsed.npcs || {}) },
      bounties,
      chores,
      logins: { ...DEFAULT_PLANNER_TEMPLATE.logins, ...(parsed.logins || {}) }
    };
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_PLANNER_TEMPLATE));
  }
}

export function savePlannerTemplate(template) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem('sfl_npc_planner_template', JSON.stringify(template));
  } catch (e) {}
}

export function getPlannerOverrides() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem('sfl_npc_planner_overrides');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function savePlannerOverrides(overrides) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem('sfl_npc_planner_overrides', JSON.stringify(overrides));
  } catch (e) {}
}

// ---------------------------------------------------------------------------
// Deterministic NPC, Bounty & Chore Math
// ---------------------------------------------------------------------------

/**
 * Calculate planned tickets for a specific week or template.
 * Includes Deliveries (per-NPC 2x), Bounties (+100 Board Bonus), Chores (VIP +2), and Logins.
 */
export function calculateWeekNpcPlan(weekNum, template, overrides, vipBonus = 0, boostCount = 0) {
  const isWeekOverride = weekNum !== 'template' && overrides && Boolean(overrides[weekNum]);
  const overrideConfig = isWeekOverride ? overrides[weekNum] : null;

  const config = overrideConfig ? {
    ...template,
    ...overrideConfig,
    npcs: { ...template.npcs, ...(overrideConfig.npcs || {}) },
    bounties: { ...template.bounties, ...(overrideConfig.bounties || {}) },
    chores: { ...template.chores, ...(overrideConfig.chores || {}) },
    logins: { ...template.logins, ...(overrideConfig.logins || {}) }
  } : template;

  const perOrderBonus = vipBonus + boostCount;
  let delivTix = 0;
  let doubleBonusTix = 0;
  const npcBreakdown = {};

  CORE_CHAPTER_NPCS.forEach(npc => {
    const npcConf = config.npcs[npc.id] || { enabled: false, daysPerWeek: 7, doubleDelivery: false };
    const enabled = Boolean(npcConf.enabled);
    const days = Math.max(1, Math.min(7, parseInt(npcConf.daysPerWeek, 10) || 7));
    const yieldPerOrder = npc.baseTickets + perOrderBonus;

    const isDoubleTicked = (npcConf.doubleDelivery !== undefined)
      ? Boolean(npcConf.doubleDelivery)
      : (Boolean(config.doubleDeliveryDays > 0) && enabled);

    const doubleDays = (config.doubleDeliveryDays > 0 && isDoubleTicked)
      ? Math.min(days, config.doubleDeliveryDays)
      : 0;

    const totalNpcTix = enabled ? (days + doubleDays) * yieldPerOrder : 0;
    const npcDoubleBonus = enabled ? doubleDays * yieldPerOrder : 0;

    if (enabled) {
      delivTix += totalNpcTix;
      doubleBonusTix += npcDoubleBonus;
    }

    npcBreakdown[npc.id] = {
      name: npc.name,
      baseTickets: npc.baseTickets,
      avatar: npc.avatar,
      enabled,
      days,
      yieldPerOrder,
      isDoubleTicked,
      doubleDays,
      totalTix: totalNpcTix,
      doubleBonusTix: npcDoubleBonus
    };
  });

  // Week 1 Monday Stacked Deliveries from Sunday Rollover (only if explicitly enabled in config)
  const isWeek1 = (weekNum === 1 || weekNum === '1');
  const hasStackedRollover = config.mondayStackedDeliveries === true;
  let stackedTix = 0;

  if (hasStackedRollover) {
    CORE_CHAPTER_NPCS.forEach(npc => {
      const npcConf = config.npcs[npc.id] || { enabled: false };
      if (npcConf.enabled) {
        const yieldPerOrder = npc.baseTickets + perOrderBonus;
        stackedTix += yieldPerOrder; // 1x yield, excluded from 2x double delivery bonus
      }
    });
  }

  // Week 1 specifically receives the stacked delivery windfall added to delivTix
  if (isWeek1 && hasStackedRollover) {
    delivTix += stackedTix;
  }

  // Bounties calculations (User direct input: Regular Bounties + Board Bonus + Animal Bounties)
  const bConf = config.bounties || DEFAULT_PLANNER_TEMPLATE.bounties;
  const regularTixVal = (bConf.regularTix !== undefined && bConf.regularTix !== null && bConf.regularTix !== '')
    ? Math.max(0, parseInt(bConf.regularTix, 10) || 0)
    : (bConf.regularCount && bConf.regularAvgTix ? bConf.regularCount * bConf.regularAvgTix : 12);
  const regularBountiesTix = bConf.regularEnabled !== false ? regularTixVal : 0;

  const boardBonusTix = bConf.boardBonusEnabled ? 100 : 0;

  const animalTixVal = (bConf.animalTix !== undefined && bConf.animalTix !== null && bConf.animalTix !== '')
    ? Math.max(0, parseInt(bConf.animalTix, 10) || 0)
    : (bConf.animalCount && bConf.animalAvgTix ? bConf.animalCount * bConf.animalAvgTix : 16);
  const animalBountiesTix = bConf.animalEnabled !== false ? animalTixVal : 0;

  const bountiesTix = regularBountiesTix + boardBonusTix + animalBountiesTix;

  // Chores calculations (User direct input for weekly chores)
  const cConf = config.chores || DEFAULT_PLANNER_TEMPLATE.chores;
  const choreTixVal = (cConf.choresTix !== undefined && cConf.choresTix !== null && cConf.choresTix !== '')
    ? Math.max(0, parseInt(cConf.choresTix, 10) || 0)
    : (cConf.customTix !== undefined ? Math.max(0, parseInt(cConf.customTix, 10) || 0) : 7);
  const choresTix = cConf.enabled !== false ? choreTixVal : 0;

  // Chapter Track Tickets calculations (One-Time Milestone, does NOT repeat weekly)
  const trackEnabled = cConf.trackEnabled !== false;
  const trackTixVal = (cConf.trackTix !== undefined && cConf.trackTix !== null && cConf.trackTix !== '')
    ? Math.max(0, parseInt(cConf.trackTix, 10) || 0)
    : 0;
  const trackTix = trackEnabled ? trackTixVal : 0;

  // Logins calculations
  const lConf = config.logins || DEFAULT_PLANNER_TEMPLATE.logins;
  const loginsTix = lConf.enabled !== false ? (parseInt(lConf.daysPerWeek, 10) || 7) : 0;

  // Total weekly routine strictly excludes one-time track tickets because track tickets do NOT repeat weekly
  const totalWeeklyTix = delivTix + bountiesTix + choresTix + loginsTix;

  return {
    weekNum,
    isOverride: isWeekOverride,
    delivTix,
    doubleBonusTix,
    bountiesBreakdown: {
      regularEnabled: bConf.regularEnabled !== false,
      regularTix: regularBountiesTix,
      regularInputVal: regularTixVal,
      boardBonusEnabled: Boolean(bConf.boardBonusEnabled),
      boardBonusTix,
      animalEnabled: bConf.animalEnabled !== false,
      animalTix: animalBountiesTix,
      animalInputVal: animalTixVal,
      totalBountiesTix: bountiesTix
    },
    choresBreakdown: {
      enabled: cConf.enabled !== false,
      choresTix,
      choreInputVal: choreTixVal,
      trackEnabled,
      trackTix,
      trackInputVal: trackTixVal
    },
    trackTix,
    loginsBreakdown: {
      enabled: lConf.enabled !== false,
      daysPerWeek: parseInt(lConf.daysPerWeek, 10) || 7,
      loginsTix
    },
    bountiesTix,
    choresTix,
    loginsTix,
    stackedTix,
    mondayStackedDeliveries: hasStackedRollover,
    totalWeeklyTix,
    npcBreakdown,
    config
  };
}

// ---------------------------------------------------------------------------
// Projection Calculation Engine
// ---------------------------------------------------------------------------

export function calculateProjections(displayItems, currentMondayKey, targetGoal, targetWeeks, externalActuals = {}) {
  _lastProjectionInput = { displayItems, currentMondayKey, targetGoal, targetWeeks, externalActuals };

  let actualTrackTix = externalActuals ? externalActuals.trackTickets : undefined;
  let actualLoginTix = externalActuals ? externalActuals.loginTickets : undefined;

  if (actualTrackTix === undefined && typeof document !== 'undefined') {
    const el = document.getElementById('trackTicketsInput');
    actualTrackTix = parseInt(el?.value, 10) || 0;
  }
  if (actualLoginTix === undefined && typeof document !== 'undefined') {
    const el = document.getElementById('dailyLoginCount');
    actualLoginTix = parseInt(el?.value, 10) || 0;
  }
  actualTrackTix = Math.max(0, parseInt(actualTrackTix, 10) || 0);
  actualLoginTix = Math.max(0, parseInt(actualLoginTix, 10) || 0);

  const currentIndex = displayItems.findIndex(d => d.isCurrent);
  const nowMs = Date.now();
  const isPreSeason = (currentIndex === -1) && (nowMs < BASE_EPOCH.getTime());

  let elapsedWeeks = 0;
  let taskEarned = 0;
  let daysPassedInWeek = 0;

  if (isPreSeason) {
    elapsedWeeks = 0;
    daysPassedInWeek = 0;
    taskEarned = displayItems.reduce((s, d) => s + (d.tickets || 0), 0);
  } else if (currentIndex !== -1) {
    const currentMonMs = new Date(currentMondayKey + 'T00:00:00.000Z').getTime();
    daysPassedInWeek = Math.max(0.2, Math.min(7, (nowMs - currentMonMs) / (24 * 60 * 60 * 1000)));
    elapsedWeeks = currentIndex + (daysPassedInWeek / 7);
    taskEarned = displayItems.slice(0, currentIndex + 1).reduce((s, d) => s + (d.tickets || 0), 0);
  } else {
    const diffDays = Math.max(0, (nowMs - BASE_EPOCH.getTime()) / (24 * 60 * 60 * 1000));
    elapsedWeeks = Math.min(TOTAL_CHAPTER_WEEKS, diffDays / 7);
    taskEarned = displayItems.reduce((s, d) => s + (d.tickets || 0), 0);
  }

  // Total tickets earned so far strictly includes task tickets + actual login tickets + actual track tickets
  const totalEarned = taskEarned + actualLoginTix + actualTrackTix;

  const activeWeekNum = isPreSeason ? 0 : (currentIndex !== -1 ? (currentIndex + 1) : Math.min(TOTAL_CHAPTER_WEEKS, Math.floor(elapsedWeeks) + 1));
  const weeksRemaining12 = Math.max(0, TOTAL_CHAPTER_WEEKS - elapsedWeeks);
  const weeksRemainingAuction = Math.max(0, AUCTION_WEEK - elapsedWeeks);
  const daysRemaining12 = weeksRemaining12 * 7;
  const daysRemainingAuction = weeksRemainingAuction * 7;

  const vipBonus = (typeof document !== 'undefined' && typeof getActiveVipBonus === 'function') ? getActiveVipBonus() : 0;
  const boostCount = (typeof document !== 'undefined' && typeof getActiveBoostCount === 'function') ? getActiveBoostCount() : 0;
  const template = getPlannerTemplate();
  const overrides = getPlannerOverrides();

  const templatePlan = calculateWeekNpcPlan('template', template, overrides, vipBonus, boostCount);
  const pPlanned = templatePlan.totalWeeklyTix;

  // Track tickets planned in Chores section (one-time chapter milestone)
  const isTrackEnabled = templatePlan.choresBreakdown.trackEnabled !== false;
  const plannedTrackTix = isTrackEnabled ? templatePlan.trackTix : 0;
  const effectiveTotalTrack = isTrackEnabled ? Math.max(actualTrackTix, plannedTrackTix) : actualTrackTix;
  const pendingTrackTix = Math.max(0, effectiveTotalTrack - actualTrackTix);

  const pCurrent = elapsedWeeks > 0 && totalEarned > 0 ? totalEarned / elapsedWeeks : 0;
  const safeTargetWeeks = Math.max(1, Math.min(12, parseInt(targetWeeks, 10) || 12));
  const pTarget = targetGoal > 0 && safeTargetWeeks > 0 ? targetGoal / safeTargetWeeks : 0;
  const pCustom = _customPace > 0 ? _customPace : (pPlanned > 0 ? pPlanned : pCurrent);

  if (_customPace === 0 && pPlanned > 0) {
    _customPace = Math.round(pPlanned);
  }

  const goalAtAuctionWeek = targetGoal > 0 ? Math.round((targetGoal * AUCTION_WEEK) / TOTAL_CHAPTER_WEEKS) : 0;

  function buildMilestone(pace, milestoneWeek, milestoneDaysRemaining, milestoneGoal) {
    const projected = Math.round(totalEarned + pace * Math.max(0, milestoneWeek - elapsedWeeks) + pendingTrackTix);
    const gapVsGoal = projected - milestoneGoal;
    const dailyRequired = milestoneDaysRemaining > 0.1
      ? Math.max(0, Math.ceil((milestoneGoal - totalEarned - pendingTrackTix) / milestoneDaysRemaining))
      : 0;
    return { projected, gapVsGoal, dailyRequired };
  }

  function buildPlannedMilestone(milestoneWeek, milestoneGoal) {
    let projected = totalEarned + pendingTrackTix;

    if (activeWeekNum <= milestoneWeek) {
      const curPlan = calculateWeekNpcPlan(activeWeekNum, template, overrides, vipBonus, boostCount);
      const remainingDaysInWeek = Math.max(0, 7 - daysPassedInWeek);
      const remainingCurWeekTix = Math.round((curPlan.totalWeeklyTix / 7) * remainingDaysInWeek);
      projected += remainingCurWeekTix;
    }

    for (let w = activeWeekNum + 1; w <= milestoneWeek; w++) {
      const wkPlan = calculateWeekNpcPlan(w, template, overrides, vipBonus, boostCount);
      projected += wkPlan.totalWeeklyTix;
    }

    const daysRemaining = Math.max(0, (milestoneWeek - elapsedWeeks) * 7);
    const gapVsGoal = projected - milestoneGoal;
    const dailyRequired = daysRemaining > 0.1
      ? Math.max(0, Math.ceil((milestoneGoal - totalEarned - pendingTrackTix) / daysRemaining))
      : 0;

    return { projected, gapVsGoal, dailyRequired };
  }

  const plannedAuctionMilestone = buildPlannedMilestone(AUCTION_WEEK, goalAtAuctionWeek);
  const currentAuctionMilestone = buildMilestone(pCurrent, AUCTION_WEEK, daysRemainingAuction, goalAtAuctionWeek);
  const targetAuctionMilestone = buildMilestone(pTarget, AUCTION_WEEK, daysRemainingAuction, goalAtAuctionWeek);
  const customAuctionMilestone = buildMilestone(pCustom, AUCTION_WEEK, daysRemainingAuction, goalAtAuctionWeek);

  const scenarios = {
    planned: {
      pace: pPlanned,
      auctionWeek: plannedAuctionMilestone,
      week9: plannedAuctionMilestone,
      week8: plannedAuctionMilestone,
      week12: buildPlannedMilestone(TOTAL_CHAPTER_WEEKS, targetGoal)
    },
    current: {
      pace: pCurrent,
      auctionWeek: currentAuctionMilestone,
      week9: currentAuctionMilestone,
      week8: currentAuctionMilestone,
      week12: buildMilestone(pCurrent, TOTAL_CHAPTER_WEEKS, daysRemaining12, targetGoal)
    },
    target: {
      pace: pTarget,
      auctionWeek: targetAuctionMilestone,
      week9: targetAuctionMilestone,
      week8: targetAuctionMilestone,
      week12: buildMilestone(pTarget, TOTAL_CHAPTER_WEEKS, daysRemaining12, targetGoal)
    },
    custom: {
      pace: pCustom,
      auctionWeek: customAuctionMilestone,
      week9: customAuctionMilestone,
      week8: customAuctionMilestone,
      week12: buildMilestone(pCustom, TOTAL_CHAPTER_WEEKS, daysRemaining12, targetGoal)
    }
  };

  const activePace = scenarios[_activeScenario]?.pace ?? pPlanned;

  function estimateGoalDate(pace) {
    const effectiveEarned = totalEarned + pendingTrackTix;
    if (pace <= 0 || effectiveEarned >= targetGoal) return null;
    const weeksToGoal = elapsedWeeks + (targetGoal - effectiveEarned) / pace;
    const msToGoal = weeksToGoal * 7 * 24 * 60 * 60 * 1000;
    const goalDate = new Date(BASE_EPOCH.getTime() + msToGoal);
    const weekNum = Math.ceil(weeksToGoal);
    const isAfterWeek12 = weeksToGoal > TOTAL_CHAPTER_WEEKS;
    return {
      date: goalDate,
      weekNum,
      isAfterWeek12,
      label: goalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    };
  }

  function distributeActualLogins(totalLogins, curIdx, totalWeeks) {
    const result = Array(totalWeeks).fill(0);
    let remaining = totalLogins;
    const maxIdx = curIdx >= 0 ? curIdx : 0;
    for (let i = 0; i <= maxIdx; i++) {
      if (i < maxIdx) {
        const take = Math.min(7, remaining);
        result[i] = take;
        remaining -= take;
      } else {
        result[i] = Math.max(0, remaining);
        remaining = 0;
      }
    }
    return result;
  }

  function buildRoadmap(pace, isPlannedMode) {
    const loginDist = distributeActualLogins(actualLoginTix, currentIndex, TOTAL_CHAPTER_WEEKS);
    let cumulative = 0;

    return Array.from({ length: TOTAL_CHAPTER_WEEKS }, (_, i) => {
      const weekNum = i + 1;
      const item = displayItems[i];
      const isPast = item ? (!item.isCurrent && item.hasData) : false;
      const isCurrent = item ? item.isCurrent : false;
      const actualTasks = item ? (item.tickets || 0) : 0;

      if (isPast) {
        const weekLogins = loginDist[i] || 0;
        const weekVal = actualTasks + weekLogins;
        cumulative += weekVal;
        return {
          weekNum,
          value: weekVal,
          cumulative,
          type: 'actual',
          taskTix: actualTasks,
          loginTix: weekLogins,
          trackBonus: 0,
          stackedBonus: 0
        };
      } else if (isCurrent) {
        const weekLogins = loginDist[i] || 0;
        // The active week incorporates current task actuals, login actuals, AND track tickets
        const trackBonus = effectiveTotalTrack;
        const weekVal = actualTasks + weekLogins + trackBonus;
        cumulative += weekVal;
        return {
          weekNum,
          value: weekVal,
          cumulative,
          type: 'current',
          taskTix: actualTasks,
          loginTix: weekLogins,
          trackBonus,
          stackedBonus: 0
        };
      } else {
        const weekPlan = isPlannedMode
          ? calculateWeekNpcPlan(weekNum, template, overrides, vipBonus, boostCount)
          : null;
        const weekTix = isPlannedMode
          ? weekPlan.totalWeeklyTix
          : Math.round(pace);
        const loginTix = isPlannedMode
          ? weekPlan.loginsTix
          : Math.min(7, Math.round(templatePlan.loginsTix || 7));
        const trackBonus = (weekNum === 1 && (currentIndex === -1 || isPreSeason)) ? effectiveTotalTrack : 0;
        const stackedBonus = (weekNum === 1 && isPlannedMode) ? (weekPlan?.stackedTix || 0) : 0;
        const weekVal = weekTix + trackBonus;
        cumulative += weekVal;
        return {
          weekNum,
          value: weekVal,
          cumulative,
          type: 'projected',
          taskTix: weekTix - loginTix,
          loginTix,
          trackBonus,
          stackedBonus
        };
      }
    });
  }

  const isPlannedMode = _activeScenario === 'planned';

  return {
    totalEarned,
    taskEarned,
    actualLoginTix,
    actualTrackTix,
    effectiveTotalTrack,
    pendingTrackTix,
    elapsedWeeks,
    activeWeekNum,
    goalAtAuctionWeek,
    goalAtWeek9: goalAtAuctionWeek,
    goalAtWeek8: goalAtAuctionWeek,
    targetGoal,
    scenarios,
    activeScenario: _activeScenario,
    activePace,
    customPace: _customPace,
    goalDate: estimateGoalDate(activePace),
    roadmap: buildRoadmap(activePace, isPlannedMode),
    planner: {
      template,
      overrides,
      selectedWeek: _plannerSelectedWeek,
      sectionTab: _plannerSectionTab,
      activePlan: calculateWeekNpcPlan(_plannerSelectedWeek, template, overrides, vipBonus, boostCount),
      vipBonus,
      boostCount
    }
  };
}

// ---------------------------------------------------------------------------
// Interactive Controller Actions
// ---------------------------------------------------------------------------

export function setProjectionScenario(mode, customValue) {
  _activeScenario = mode;
  if (mode === 'custom' && customValue !== undefined && customValue !== null) {
    const parsed = parseFloat(customValue);
    if (!isNaN(parsed) && parsed >= 0) {
      _customPace = parsed;
    }
  }
  reRenderProjections();
}

export function setPlannerOverrideWeek(weekVal) {
  _plannerSelectedWeek = weekVal === 'template' ? 'template' : parseInt(weekVal, 10);
  reRenderProjections();
}

export function setPlannerSectionTab(tab) {
  _plannerSectionTab = tab;
  reRenderProjections();
}

export function togglePlannerNpc(npcId, weekVal) {
  const isTemplate = weekVal === 'template' || !weekVal;
  if (isTemplate) {
    const t = getPlannerTemplate();
    if (!t.npcs[npcId]) t.npcs[npcId] = { enabled: false, daysPerWeek: 7, doubleDelivery: true };
    t.npcs[npcId].enabled = !t.npcs[npcId].enabled;
    savePlannerTemplate(t);
  } else {
    const w = parseInt(weekVal, 10);
    const ov = getPlannerOverrides();
    if (!ov[w]) ov[w] = JSON.parse(JSON.stringify(getPlannerTemplate()));
    if (!ov[w].npcs[npcId]) ov[w].npcs[npcId] = { enabled: false, daysPerWeek: 7, doubleDelivery: true };
    ov[w].npcs[npcId].enabled = !ov[w].npcs[npcId].enabled;
    savePlannerOverrides(ov);
  }
  reRenderProjections();
}

export function togglePlannerNpcDouble(npcId, weekVal) {
  const isTemplate = weekVal === 'template' || !weekVal;
  if (isTemplate) {
    const t = getPlannerTemplate();
    if (!t.npcs[npcId]) t.npcs[npcId] = { enabled: true, daysPerWeek: 7, doubleDelivery: false };
    const cur = t.npcs[npcId].doubleDelivery !== undefined ? t.npcs[npcId].doubleDelivery : true;
    t.npcs[npcId].doubleDelivery = !cur;
    savePlannerTemplate(t);
  } else {
    const w = parseInt(weekVal, 10);
    const ov = getPlannerOverrides();
    if (!ov[w]) ov[w] = JSON.parse(JSON.stringify(getPlannerTemplate()));
    if (!ov[w].npcs[npcId]) ov[w].npcs[npcId] = { enabled: true, daysPerWeek: 7, doubleDelivery: false };
    const cur = ov[w].npcs[npcId].doubleDelivery !== undefined ? ov[w].npcs[npcId].doubleDelivery : true;
    ov[w].npcs[npcId].doubleDelivery = !cur;
    savePlannerOverrides(ov);
  }
  reRenderProjections();
}

export function toggleAllNpcDouble(enableAll, weekVal) {
  const isTemplate = weekVal === 'template' || !weekVal;
  if (isTemplate) {
    const t = getPlannerTemplate();
    CORE_CHAPTER_NPCS.forEach(npc => {
      if (!t.npcs[npc.id]) t.npcs[npc.id] = { enabled: false, daysPerWeek: 7, doubleDelivery: false };
      t.npcs[npc.id].doubleDelivery = Boolean(enableAll);
    });
    savePlannerTemplate(t);
  } else {
    const w = parseInt(weekVal, 10);
    const ov = getPlannerOverrides();
    if (!ov[w]) ov[w] = JSON.parse(JSON.stringify(getPlannerTemplate()));
    CORE_CHAPTER_NPCS.forEach(npc => {
      if (!ov[w].npcs[npc.id]) ov[w].npcs[npc.id] = { enabled: false, daysPerWeek: 7, doubleDelivery: false };
      ov[w].npcs[npc.id].doubleDelivery = Boolean(enableAll);
    });
    savePlannerOverrides(ov);
  }
  reRenderProjections();
}

export function setPlannerNpcDays(npcId, daysVal, weekVal) {
  const days = Math.max(1, Math.min(7, parseInt(daysVal, 10) || 7));
  const isTemplate = weekVal === 'template' || !weekVal;
  if (isTemplate) {
    const t = getPlannerTemplate();
    if (!t.npcs[npcId]) t.npcs[npcId] = { enabled: true, daysPerWeek: 7, doubleDelivery: true };
    t.npcs[npcId].daysPerWeek = days;
    savePlannerTemplate(t);
  } else {
    const w = parseInt(weekVal, 10);
    const ov = getPlannerOverrides();
    if (!ov[w]) ov[w] = JSON.parse(JSON.stringify(getPlannerTemplate()));
    if (!ov[w].npcs[npcId]) ov[w].npcs[npcId] = { enabled: true, daysPerWeek: 7, doubleDelivery: true };
    ov[w].npcs[npcId].daysPerWeek = days;
    savePlannerOverrides(ov);
  }
  reRenderProjections();
}

export function togglePlannerDoubleDelivery(weekVal) {
  const isTemplate = weekVal === 'template' || !weekVal;
  if (isTemplate) {
    const t = getPlannerTemplate();
    t.doubleDeliveryDays = t.doubleDeliveryDays > 0 ? 0 : 1;
    savePlannerTemplate(t);
  } else {
    const w = parseInt(weekVal, 10);
    const ov = getPlannerOverrides();
    if (!ov[w]) ov[w] = JSON.parse(JSON.stringify(getPlannerTemplate()));
    ov[w].doubleDeliveryDays = ov[w].doubleDeliveryDays > 0 ? 0 : 1;
    savePlannerOverrides(ov);
  }
  reRenderProjections();
}

export function togglePlannerStackedDeliveries(checked, weekVal) {
  const isTemplate = weekVal === 'template' || !weekVal;
  if (isTemplate) {
    const t = getPlannerTemplate();
    t.mondayStackedDeliveries = Boolean(checked);
    savePlannerTemplate(t);
  } else {
    const w = parseInt(weekVal, 10);
    const ov = getPlannerOverrides();
    if (!ov[w]) ov[w] = JSON.parse(JSON.stringify(getPlannerTemplate()));
    ov[w].mondayStackedDeliveries = Boolean(checked);
    savePlannerOverrides(ov);
  }
  reRenderProjections();
}

export function togglePlannerBounty(field, weekVal) {
  const isTemplate = weekVal === 'template' || !weekVal;
  if (isTemplate) {
    const t = getPlannerTemplate();
    if (!t.bounties) t.bounties = { ...DEFAULT_PLANNER_TEMPLATE.bounties };
    t.bounties[field] = !t.bounties[field];
    savePlannerTemplate(t);
  } else {
    const w = parseInt(weekVal, 10);
    const ov = getPlannerOverrides();
    if (!ov[w]) ov[w] = JSON.parse(JSON.stringify(getPlannerTemplate()));
    if (!ov[w].bounties) ov[w].bounties = { ...DEFAULT_PLANNER_TEMPLATE.bounties };
    ov[w].bounties[field] = !ov[w].bounties[field];
    savePlannerOverrides(ov);
  }
  reRenderProjections();
}

export function setPlannerRegularBountyTix(val, weekVal) {
  const parsed = Math.max(0, parseInt(val, 10) || 0);
  const isTemplate = weekVal === 'template' || !weekVal;
  if (isTemplate) {
    const t = getPlannerTemplate();
    if (!t.bounties) t.bounties = { ...DEFAULT_PLANNER_TEMPLATE.bounties };
    t.bounties.regularTix = parsed;
    savePlannerTemplate(t);
  } else {
    const w = parseInt(weekVal, 10);
    const ov = getPlannerOverrides();
    if (!ov[w]) ov[w] = JSON.parse(JSON.stringify(getPlannerTemplate()));
    if (!ov[w].bounties) ov[w].bounties = { ...DEFAULT_PLANNER_TEMPLATE.bounties };
    ov[w].bounties.regularTix = parsed;
    savePlannerOverrides(ov);
  }
  reRenderProjections();
}

export function setPlannerAnimalBountyTix(val, weekVal) {
  const parsed = Math.max(0, parseInt(val, 10) || 0);
  const isTemplate = weekVal === 'template' || !weekVal;
  if (isTemplate) {
    const t = getPlannerTemplate();
    if (!t.bounties) t.bounties = { ...DEFAULT_PLANNER_TEMPLATE.bounties };
    t.bounties.animalTix = parsed;
    savePlannerTemplate(t);
  } else {
    const w = parseInt(weekVal, 10);
    const ov = getPlannerOverrides();
    if (!ov[w]) ov[w] = JSON.parse(JSON.stringify(getPlannerTemplate()));
    if (!ov[w].bounties) ov[w].bounties = { ...DEFAULT_PLANNER_TEMPLATE.bounties };
    ov[w].bounties.animalTix = parsed;
    savePlannerOverrides(ov);
  }
  reRenderProjections();
}

export function setPlannerBountyCount(field, val, weekVal) {
  if (field === 'animalCount') return setPlannerAnimalBountyTix(val, weekVal);
  return setPlannerRegularBountyTix(val, weekVal);
}

export function setPlannerBountyCustomTix(val, weekVal) {
  return setPlannerRegularBountyTix(val, weekVal);
}

export function togglePlannerBountyCustom(weekVal) {
  reRenderProjections();
}

export function togglePlannerChore(weekVal) {
  const isTemplate = weekVal === 'template' || !weekVal;
  if (isTemplate) {
    const t = getPlannerTemplate();
    if (!t.chores) t.chores = { ...DEFAULT_PLANNER_TEMPLATE.chores };
    t.chores.enabled = !t.chores.enabled;
    savePlannerTemplate(t);
  } else {
    const w = parseInt(weekVal, 10);
    const ov = getPlannerOverrides();
    if (!ov[w]) ov[w] = JSON.parse(JSON.stringify(getPlannerTemplate()));
    if (!ov[w].chores) ov[w].chores = { ...DEFAULT_PLANNER_TEMPLATE.chores };
    ov[w].chores.enabled = !ov[w].chores.enabled;
    savePlannerOverrides(ov);
  }
  reRenderProjections();
}

export function setPlannerChoreTix(val, weekVal) {
  const parsed = Math.max(0, parseInt(val, 10) || 0);
  const isTemplate = weekVal === 'template' || !weekVal;
  if (isTemplate) {
    const t = getPlannerTemplate();
    if (!t.chores) t.chores = { ...DEFAULT_PLANNER_TEMPLATE.chores };
    t.chores.choresTix = parsed;
    savePlannerTemplate(t);
  } else {
    const w = parseInt(weekVal, 10);
    const ov = getPlannerOverrides();
    if (!ov[w]) ov[w] = JSON.parse(JSON.stringify(getPlannerTemplate()));
    if (!ov[w].chores) ov[w].chores = { ...DEFAULT_PLANNER_TEMPLATE.chores };
    ov[w].chores.choresTix = parsed;
    savePlannerOverrides(ov);
  }
  reRenderProjections();
}

export function togglePlannerTrack(weekVal) {
  const isTemplate = weekVal === 'template' || !weekVal;
  if (isTemplate) {
    const t = getPlannerTemplate();
    if (!t.chores) t.chores = { ...DEFAULT_PLANNER_TEMPLATE.chores };
    t.chores.trackEnabled = t.chores.trackEnabled !== false ? false : true;
    savePlannerTemplate(t);
  } else {
    const w = parseInt(weekVal, 10);
    const ov = getPlannerOverrides();
    if (!ov[w]) ov[w] = JSON.parse(JSON.stringify(getPlannerTemplate()));
    if (!ov[w].chores) ov[w].chores = { ...DEFAULT_PLANNER_TEMPLATE.chores };
    ov[w].chores.trackEnabled = ov[w].chores.trackEnabled !== false ? false : true;
    savePlannerOverrides(ov);
  }
  reRenderProjections();
}

export function setPlannerTrackTix(val, weekVal) {
  const parsed = Math.max(0, parseInt(val, 10) || 0);
  const isTemplate = weekVal === 'template' || !weekVal;
  if (isTemplate) {
    const t = getPlannerTemplate();
    if (!t.chores) t.chores = { ...DEFAULT_PLANNER_TEMPLATE.chores };
    t.chores.trackTix = parsed;
    savePlannerTemplate(t);
  } else {
    const w = parseInt(weekVal, 10);
    const ov = getPlannerOverrides();
    if (!ov[w]) ov[w] = JSON.parse(JSON.stringify(getPlannerTemplate()));
    if (!ov[w].chores) ov[w].chores = { ...DEFAULT_PLANNER_TEMPLATE.chores };
    ov[w].chores.trackTix = parsed;
    savePlannerOverrides(ov);
  }
  reRenderProjections();
}

export function setPlannerChoreCount(val, weekVal) {
  return setPlannerChoreTix(val, weekVal);
}

export function setPlannerChoreCustomTix(val, weekVal) {
  return setPlannerChoreTix(val, weekVal);
}

export function togglePlannerChoreCustom(weekVal) {
  reRenderProjections();
}

export function togglePlannerLogin(weekVal) {
  const isTemplate = weekVal === 'template' || !weekVal;
  if (isTemplate) {
    const t = getPlannerTemplate();
    if (!t.logins) t.logins = { ...DEFAULT_PLANNER_TEMPLATE.logins };
    t.logins.enabled = !t.logins.enabled;
    savePlannerTemplate(t);
  } else {
    const w = parseInt(weekVal, 10);
    const ov = getPlannerOverrides();
    if (!ov[w]) ov[w] = JSON.parse(JSON.stringify(getPlannerTemplate()));
    if (!ov[w].logins) ov[w].logins = { ...DEFAULT_PLANNER_TEMPLATE.logins };
    ov[w].logins.enabled = !ov[w].logins.enabled;
    savePlannerOverrides(ov);
  }
  reRenderProjections();
}

export function resetPlannerOverride(weekVal) {
  const w = parseInt(weekVal, 10);
  const ov = getPlannerOverrides();
  if (ov[w]) {
    delete ov[w];
    savePlannerOverrides(ov);
  }
  reRenderProjections();
}

function reRenderProjections() {
  if (_lastProjectionInput) {
    const { displayItems, currentMondayKey, targetGoal, targetWeeks, externalActuals } = _lastProjectionInput;
    renderProjectionsView(
      calculateProjections(displayItems, currentMondayKey, targetGoal, targetWeeks, externalActuals)
    );
  }
}

// ---------------------------------------------------------------------------
// HTML Renderer
// ---------------------------------------------------------------------------

export function renderProjectionsView(proj) {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('weeklyProjectionsContainer');
  if (!container) return;

  const isDark = document.body ? document.body.classList.contains('dark-mode') : false;
  const ticketIconHtml = renderChapterTicketIcon(14);

  function gapBadge(gap, dark) {
    if (gap > 0) {
      return `<span class="proj-gap-badge proj-gap-ahead${dark ? ' dark' : ''}">+${gap.toLocaleString()} Ahead 🎯</span>`;
    } else if (gap < 0) {
      return `<span class="proj-gap-badge proj-gap-behind${dark ? ' dark' : ''}">${gap.toLocaleString()} Behind ⚠️</span>`;
    }
    return `<span class="proj-gap-badge proj-gap-even${dark ? ' dark' : ''}">On Target ✓</span>`;
  }

  const active = proj.scenarios[proj.activeScenario];
  const wAuction = active.auctionWeek || active.week9 || active.week8;
  const w12 = active.week12;
  const pace = active.pace;
  const dailyPace = pace > 0 ? Math.round(pace / 7) : 0;

  function scenarioBtn(mode, label, paceVal) {
    const isActive = proj.activeScenario === mode;
    const paceStr = paceVal > 0 ? ` (${Math.round(paceVal)}/wk)` : '';
    return `<button
      class="scenario-pill${isActive ? ' active' : ''}${isDark ? ' dark' : ''}"
      onclick="setProjectionScenario('${mode}')"
    >${label}${paceStr}</button>`;
  }

  // Goal date banner
  let goalDateHtml = '';
  if (proj.totalEarned >= proj.targetGoal && proj.targetGoal > 0) {
    goalDateHtml = `<div class="proj-goal-date${isDark ? ' dark' : ''}">
      🎉 Chapter Goal Already Reached! (${proj.totalEarned.toLocaleString()} / ${proj.targetGoal.toLocaleString()} ${ticketIconHtml})
    </div>`;
  } else if (proj.goalDate && proj.goalDate.isAfterWeek12) {
    goalDateHtml = `<div class="proj-goal-date proj-goal-miss${isDark ? ' dark' : ''}">
      ⚠️ Can't reach goal (Predicted at Week ${proj.goalDate.weekNum} — after Week 12)
    </div>`;
  } else if (proj.goalDate) {
    goalDateHtml = `<div class="proj-goal-date${isDark ? ' dark' : ''}">
      📅 Predicted Goal Hit: <strong>${proj.goalDate.label}</strong>
      <span class="proj-goal-week-badge">Week ${proj.goalDate.weekNum}</span>
    </div>`;
  } else if (proj.targetGoal > 0) {
    goalDateHtml = `<div class="proj-goal-date proj-goal-miss${isDark ? ' dark' : ''}">
      ⚠️ Can't reach goal
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
    const loginBadgeHtml = row.loginTix > 0
      ? `<span class="roadmap-login-badge" title="${row.loginTix} Daily Login Tickets">+${row.loginTix}🎁</span>`
      : '';
    const trackBadgeHtml = row.trackBonus > 0
      ? `<span class="roadmap-track-badge" title="Includes +${row.trackBonus} One-Time Chapter Track Tickets">+${row.trackBonus}🎟️</span>`
      : '';
    const stackedBadgeHtml = row.stackedBonus > 0
      ? `<span class="roadmap-stacked-badge" title="Includes +${row.stackedBonus} tickets from Monday Stacked Deliveries (Sunday Rollover)">+${row.stackedBonus}📦</span>`
      : '';
    const rowTitle = `Week ${row.weekNum}: Tasks: ${row.taskTix} | Logins: ${row.loginTix}${row.trackBonus > 0 ? ` | Track: ${row.trackBonus}` : ''}${row.stackedBonus > 0 ? ` | Stacked: ${row.stackedBonus}` : ''}`;
    const dateRangeStr = getWeekDateRange(row.weekNum);
    const dateRangeHtml = dateRangeStr ? `<span class="roadmap-date-sub" style="font-size:10px; font-weight:700; opacity:0.75; margin-left:auto;">${dateRangeStr}</span>` : '';
    return `<tr class="${isAuction || isFinale ? 'roadmap-highlight-row' : ''}${isDark ? ' dark' : ''}">
      <td class="roadmap-cell roadmap-week-cell">W${row.weekNum}${milestoneHtml}${dateRangeHtml}</td>
      <td class="roadmap-cell"><span class="roadmap-type-badge ${typeClass}">${typeLabel}</span></td>
      <td class="roadmap-cell roadmap-tix-cell" title="${rowTitle}">
        ${ticketIconHtml} ${row.value.toLocaleString()}
        ${loginBadgeHtml}
        ${trackBadgeHtml}
        ${stackedBadgeHtml}
      </td>
      <td class="roadmap-cell roadmap-cumul-cell">${row.cumulative.toLocaleString()} total</td>
    </tr>`;
  }).join('');

  // Planner Config Section
  const planner = proj.planner;
  const activePlan = planner.activePlan;
  const isOverride = activePlan.isOverride;
  const currentWeekVal = planner.selectedWeek;
  const activeSection = planner.sectionTab || 'deliveries';
  const doubleActive = Boolean(activePlan.config.doubleDeliveryDays > 0);
  const vipBonus = planner.vipBonus || 0;

  // Week Options for selector
  const weekOptions = [
    `<option value="template" ${currentWeekVal === 'template' ? 'selected' : ''}>Routine Template (All Remaining Weeks)</option>`
  ];
  for (let w = Math.max(1, proj.activeWeekNum); w <= TOTAL_CHAPTER_WEEKS; w++) {
    const hasOv = planner.overrides && planner.overrides[w];
    const dateRangeStr = getWeekDateRange(w);
    const dateSuffix = dateRangeStr ? ` (${dateRangeStr})` : '';
    const label = w === AUCTION_WEEK ? `Week ${w}${dateSuffix} — 🏁 Mega Auction Week` : w === TOTAL_CHAPTER_WEEKS ? `Week ${w}${dateSuffix} — 🏆 Finale Week` : `Week ${w}${dateSuffix}`;
    const badge = hasOv ? ' ⚙️ [Customized]' : '';
    weekOptions.push(`<option value="${w}" ${currentWeekVal === w ? 'selected' : ''}>${label}${badge}</option>`);
  }

  // 1. Deliveries HTML
  const npcRowsHtml = CORE_CHAPTER_NPCS.map(npc => {
    const item = activePlan.npcBreakdown[npc.id];
    const isChecked = item.enabled;
    const days = item.days;
    const yieldPerOrder = item.yieldPerOrder;
    const isDoubleTicked = item.isDoubleTicked;
    const totalTix = item.totalTix;
    const doubleBonus = item.doubleBonusTix;

    const daysOptions = [7, 6, 5, 4, 3, 2, 1].map(d =>
      `<option value="${d}" ${days === d ? 'selected' : ''}>${d === 7 ? 'Daily (7x/wk)' : `${d}x / week`}</option>`
    ).join('');

    return `
      <div class="npc-planner-row ${isChecked ? 'active' : 'inactive'}${isDark ? ' dark' : ''}">
        <div class="npc-col-check">
          <input
            type="checkbox"
            id="planner_chk_${npc.id}"
            class="npc-planner-checkbox"
            ${isChecked ? 'checked' : ''}
            onchange="togglePlannerNpc('${npc.id}', '${currentWeekVal}')"
            title="Include ${npc.name} in weekly deliveries"
          />
        </div>
        <div class="npc-col-info">
          <img src="${npc.avatar}" class="npc-planner-avatar" alt="${npc.name}" onerror="this.style.display='none'" />
          <div class="npc-planner-name-wrap">
            <span class="npc-planner-name">${npc.name}</span>
            <span class="npc-planner-rate">${npc.baseTickets} base ${yieldPerOrder > npc.baseTickets ? `(+${yieldPerOrder - npc.baseTickets} buff)` : ''} = <strong>${yieldPerOrder}</strong> ${ticketIconHtml}/deliv</span>
          </div>
        </div>
        <div class="npc-col-freq">
          <select
            class="npc-freq-select${isDark ? ' dark' : ''}"
            ${!isChecked ? 'disabled' : ''}
            onchange="setPlannerNpcDays('${npc.id}', this.value, '${currentWeekVal}')"
            title="Weekly delivery frequency"
          >
            ${daysOptions}
          </select>
        </div>
        <div class="npc-col-double">
          <label class="npc-double-toggle-label ${!isChecked ? 'disabled' : ''}" title="Enable 2x Double Delivery bonus for ${npc.name}">
            <input
              type="checkbox"
              class="npc-double-chk"
              ${isDoubleTicked ? 'checked' : ''}
              ${!isChecked || !doubleActive ? 'disabled' : ''}
              onchange="togglePlannerNpcDouble('${npc.id}', '${currentWeekVal}')"
            />
            <span class="npc-double-pill ${isDoubleTicked && isChecked && doubleActive ? 'active' : ''}">⚡ 2x</span>
          </label>
        </div>
        <div class="npc-col-subtotal">
          <span class="npc-subtotal-val">${ticketIconHtml} <strong>${totalTix}</strong></span>
          ${doubleBonus > 0 && doubleActive ? `<span class="npc-double-sub-tag" title="Includes +${doubleBonus} Double Delivery bonus">+${doubleBonus}⚡</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const deliveriesSectionHtml = `
    <div class="planner-double-bar${isDark ? ' dark' : ''}">
      <div class="planner-double-left">
        <label class="planner-double-label">
          <input
            type="checkbox"
            ${doubleActive ? 'checked' : ''}
            onchange="togglePlannerDoubleDelivery('${currentWeekVal}')"
          />
          <span class="planner-double-text">⚡ Weekly 2x Double Delivery Day (+${activePlan.doubleBonusTix} Tix Bonus/Week)</span>
        </label>
        <span class="planner-double-hint">Tick ⚡ 2x on each NPC below that you complete on the weekly 2x event day.</span>
      </div>
      <div class="planner-double-actions">
        <button class="btn-wood-sm" onclick="toggleAllNpcDouble(true, '${currentWeekVal}')" title="Enable 2x on all active NPCs">All 2x</button>
        <button class="btn-wood-sm" onclick="toggleAllNpcDouble(false, '${currentWeekVal}')" title="Disable 2x on all NPCs">Clear 2x</button>
      </div>
    </div>

    <div class="npc-planner-grid">
      ${npcRowsHtml}
    </div>
  `;

  // 2. Bounties HTML
  const bData = activePlan.bountiesBreakdown;

  const bountiesSectionHtml = `
    <div class="planner-sub-cards">
      <!-- Regular Bounties Card -->
      <div class="planner-sub-card ${bData.regularEnabled ? 'active' : ''}${isDark ? ' dark' : ''}">
        <div class="planner-sub-card-header">
          <label class="planner-sub-label">
            <input
              type="checkbox"
              ${bData.regularEnabled ? 'checked' : ''}
              onchange="togglePlannerBounty('regularEnabled', '${currentWeekVal}')"
            />
            <span class="planner-sub-title">🎯 Regular Plaza Bounties</span>
          </label>
          <span class="planner-sub-tix">${ticketIconHtml} <strong>${bData.regularTix}</strong> Tix</span>
        </div>
        <div class="planner-sub-body">
          <span class="planner-sub-desc">Estimated weekly tickets from Plaza board bounties:</span>
          <div class="planner-direct-input-wrap${isDark ? ' dark' : ''}">
            <input
              id="regularBountyTixInput"
              type="number"
              min="0"
              max="999"
              step="1"
              value="${bData.regularInputVal}"
              class="planner-direct-num-input${isDark ? ' dark' : ''}"
              ${!bData.regularEnabled ? 'disabled' : ''}
              onfocus="this.select()"
              onkeydown="if(event.key === 'Enter') this.blur()"
              onchange="setPlannerRegularBountyTix(this.value, '${currentWeekVal}')"
              placeholder="0"
            />
            <span class="planner-direct-unit">Tix / Week</span>
          </div>
        </div>
      </div>

      <!-- Weekly Board Completion Bonus Card (+100) -->
      <div class="planner-sub-card board-bonus-card ${bData.boardBonusEnabled ? 'active' : ''}${isDark ? ' dark' : ''}">
        <div class="planner-sub-card-header">
          <label class="planner-sub-label">
            <input
              type="checkbox"
              ${bData.boardBonusEnabled ? 'checked' : ''}
              onchange="togglePlannerBounty('boardBonusEnabled', '${currentWeekVal}')"
            />
            <span class="planner-sub-title">🏆 Full Board Completion Bonus (+100 Tix)</span>
          </label>
          <span class="planner-sub-tix bonus-glow">${ticketIconHtml} <strong>+${bData.boardBonusTix}</strong> Tix</span>
        </div>
        <div class="planner-sub-body">
          <span class="planner-sub-desc">Awarded when all regular bounties on the weekly board are completed!</span>
        </div>
      </div>

      <!-- Animal Bounties Card -->
      <div class="planner-sub-card ${bData.animalEnabled ? 'active' : ''}${isDark ? ' dark' : ''}">
        <div class="planner-sub-card-header">
          <label class="planner-sub-label">
            <input
              type="checkbox"
              ${bData.animalEnabled ? 'checked' : ''}
              onchange="togglePlannerBounty('animalEnabled', '${currentWeekVal}')"
            />
            <span class="planner-sub-title">🐔 Animal Bounties (Chicken, Cow, Sheep)</span>
          </label>
          <span class="planner-sub-tix">${ticketIconHtml} <strong>${bData.animalTix}</strong> Tix</span>
        </div>
        <div class="planner-sub-body">
          <span class="planner-sub-desc">Estimated weekly tickets from animal produce bounties:</span>
          <div class="planner-direct-input-wrap${isDark ? ' dark' : ''}">
            <input
              id="animalBountyTixInput"
              type="number"
              min="0"
              max="999"
              step="1"
              value="${bData.animalInputVal}"
              class="planner-direct-num-input${isDark ? ' dark' : ''}"
              ${!bData.animalEnabled ? 'disabled' : ''}
              onfocus="this.select()"
              onkeydown="if(event.key === 'Enter') this.blur()"
              onchange="setPlannerAnimalBountyTix(this.value, '${currentWeekVal}')"
              placeholder="0"
            />
            <span class="planner-direct-unit">Tix / Week</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // 3. Chores & Logins HTML
  const cData = activePlan.choresBreakdown;
  const lData = activePlan.loginsBreakdown;

  const choresSectionHtml = `
    <div class="planner-sub-cards">
      <!-- Weekly Chores Card -->
      <div class="planner-sub-card ${cData.enabled ? 'active' : ''}${isDark ? ' dark' : ''}">
        <div class="planner-sub-card-header">
          <label class="planner-sub-label">
            <input
              type="checkbox"
              ${cData.enabled ? 'checked' : ''}
              onchange="togglePlannerChore('${currentWeekVal}')"
            />
            <span class="planner-sub-title">🧹 Weekly Chores</span>
          </label>
          <span class="planner-sub-tix">${ticketIconHtml} <strong>${cData.choresTix}</strong> Tix</span>
        </div>
        <div class="planner-sub-body">
          <span class="planner-sub-desc">Estimated weekly tickets from completing chores:</span>
          <div class="planner-direct-input-wrap${isDark ? ' dark' : ''}">
            <input
              id="choreTixInput"
              type="number"
              min="0"
              max="999"
              step="1"
              value="${cData.choreInputVal}"
              class="planner-direct-num-input${isDark ? ' dark' : ''}"
              ${!cData.enabled ? 'disabled' : ''}
              onfocus="this.select()"
              onkeydown="if(event.key === 'Enter') this.blur()"
              onchange="setPlannerChoreTix(this.value, '${currentWeekVal}')"
              placeholder="0"
            />
            <span class="planner-direct-unit">Tix / Week</span>
          </div>
        </div>
      </div>

      <!-- Daily Login Reward Card -->
      <div class="planner-sub-card ${lData.enabled ? 'active' : ''}${isDark ? ' dark' : ''}">
        <div class="planner-sub-card-header">
          <label class="planner-sub-label">
            <input
              type="checkbox"
              ${lData.enabled ? 'checked' : ''}
              onchange="togglePlannerLogin('${currentWeekVal}')"
            />
            <span class="planner-sub-title">🎁 Daily Free Login Reward</span>
          </label>
          <span class="planner-sub-tix">${ticketIconHtml} <strong>${lData.loginsTix}</strong> Tix</span>
        </div>
        <div class="planner-sub-body">
          <span class="planner-sub-desc">Free +1 ticket credited on your first visit each calendar day (+7 tix/week).</span>
        </div>
      </div>

      <!-- Chapter Track Tickets Card (One-Time Milestone) -->
      <div class="planner-sub-card track-tix-card ${cData.trackEnabled ? 'active' : ''}${isDark ? ' dark' : ''}">
        <div class="planner-sub-card-header">
          <label class="planner-sub-label">
            <input
              type="checkbox"
              ${cData.trackEnabled ? 'checked' : ''}
              onchange="togglePlannerTrack('${currentWeekVal}')"
            />
            <span class="planner-sub-title">🎟️ Chapter Track Tickets</span>
          </label>
          <span class="planner-sub-tix bonus-glow">${ticketIconHtml} <strong>+${cData.trackTix}</strong> Tix</span>
        </div>
        <div class="planner-sub-body">
          <span class="planner-sub-desc">Total tickets earned from Cave Dwellers milestone track. <strong>Awarded once across the season (does not repeat weekly):</strong></span>
          <div class="planner-direct-input-wrap${isDark ? ' dark' : ''}">
            <input
              id="trackTixInput"
              type="number"
              min="0"
              max="9999"
              step="1"
              value="${cData.trackInputVal}"
              class="planner-direct-num-input${isDark ? ' dark' : ''}"
              ${!cData.trackEnabled ? 'disabled' : ''}
              onfocus="this.select()"
              onkeydown="if(event.key === 'Enter') this.blur()"
              onchange="setPlannerTrackTix(this.value, '${currentWeekVal}')"
              placeholder="0"
            />
            <span class="planner-direct-unit">One-Time Tix</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Active section display
  const sectionContentHtml = activeSection === 'bounties'
    ? bountiesSectionHtml
    : activeSection === 'chores'
    ? choresSectionHtml
    : deliveriesSectionHtml;

  container.innerHTML = `
    <div class="projection-cards-grid">
      <div class="projection-metric-card${isDark ? ' dark' : ''}">
        <div class="proj-card-header">
          <span class="proj-milestone-icon">🏁</span>
          <span class="proj-milestone-title">WEEK 9 (JAN 04 – JAN 10) — AUCTION WEEK</span>
        </div>
        <div class="proj-card-tix">${ticketIconHtml} <strong>${wAuction.projected.toLocaleString()}</strong> Tickets</div>
        <div class="proj-card-gap">${gapBadge(wAuction.gapVsGoal, isDark)}</div>
        <div class="proj-card-meta">
          Pace: ${Math.round(pace).toLocaleString()} Tix/Wk (~${dailyPace}/day)
        </div>
        ${wAuction.dailyRequired > 0 ? `<div class="proj-card-daily">Need <strong>${wAuction.dailyRequired}</strong> ${ticketIconHtml}/day to hit goal</div>` : ''}
      </div>

      <div class="projection-metric-card${isDark ? ' dark' : ''}">
        <div class="proj-card-header">
          <span class="proj-milestone-icon">🏆</span>
          <span class="proj-milestone-title">WEEK 12 (JAN 25 – FEB 01) — SEASON FINALE</span>
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
      ${scenarioBtn('planned', '📋 Planned Routine', proj.scenarios.planned.pace)}
      ${scenarioBtn('current', '🚀 Run-Rate', proj.scenarios.current.pace)}
      ${scenarioBtn('target', '🎯 Target Pace', proj.scenarios.target.pace)}
      <span class="scenario-custom-wrap">
        <button
          class="scenario-pill${proj.activeScenario === 'custom' ? ' active' : ''}${isDark ? ' dark' : ''}"
          onclick="setProjectionScenario('custom', document.getElementById('customPaceInput').value)"
        >⚡ Custom</button>
        <input
          id="customPaceInput"
          type="number"
          min="0"
          max="9999"
          step="1"
          value="${Math.round(proj.customPace) || 100}"
          class="scenario-custom-input${isDark ? ' dark' : ''}"
          onfocus="this.select()"
          onkeydown="if(event.key === 'Enter') this.blur()"
          onchange="setProjectionScenario('custom', this.value)"
          placeholder="Tix/Wk"
        />
        <span class="scenario-custom-unit">Tix/Wk</span>
      </span>
    </div>

    ${goalDateHtml}

    <!-- Deterministic Weekly Routine Planner -->
    <div class="planner-card${isDark ? ' dark' : ''}">
      <div class="planner-header">
        <div class="planner-title-wrap">
          <span class="planner-title">📋 WEEKLY ROUTINE PLANNER</span>
          <span class="planner-subtitle">Customize your weekly Deliveries, Bounties (+100 Board Bonus), and Chores</span>
        </div>
        <div class="planner-week-switcher">
          <select class="planner-week-select${isDark ? ' dark' : ''}" onchange="setPlannerOverrideWeek(this.value)">
            ${weekOptions.join('')}
          </select>
          ${isOverride ? `<button class="btn-wood btn-reset-override" onclick="resetPlannerOverride('${currentWeekVal}')">↺ Reset Week</button>` : ''}
        </div>
      </div>

      <!-- Planner Section Navigation Tabs -->
      <div class="planner-nav-tabs">
        <button
          class="planner-nav-btn ${activeSection === 'deliveries' ? 'active' : ''}${isDark ? ' dark' : ''}"
          onclick="setPlannerSectionTab('deliveries')"
        >🚚 Deliveries (${activePlan.delivTix} Tix)</button>
        <button
          class="planner-nav-btn ${activeSection === 'bounties' ? 'active' : ''}${isDark ? ' dark' : ''}"
          onclick="setPlannerSectionTab('bounties')"
        >🎯 Bounties (${activePlan.bountiesTix} Tix)</button>
        <button
          class="planner-nav-btn ${activeSection === 'chores' ? 'active' : ''}${isDark ? ' dark' : ''}"
          onclick="setPlannerSectionTab('chores')"
        >🧹 Chores, Logins & Track (${activePlan.choresTix + activePlan.loginsTix} Tix/Wk${activePlan.trackTix > 0 ? ` +${activePlan.trackTix} 🎟️` : ''})</button>
      </div>

      <div class="planner-tab-content">
        ${sectionContentHtml}
      </div>

      <div class="planner-summary-bar${isDark ? ' dark' : ''}">
        <div class="planner-summary-item" title="NPC Deliveries">
          🚚 Deliveries: <strong>${activePlan.delivTix}</strong> ${ticketIconHtml}
        </div>
        <div class="planner-summary-sep">+</div>
        <div class="planner-summary-item" title="Bounties">
          🎯 Bounties: <strong>${activePlan.bountiesTix}</strong> ${ticketIconHtml}
        </div>
        <div class="planner-summary-sep">+</div>
        <div class="planner-summary-item" title="Weekly Chores & Daily Logins">
          🧹 Chores/Logins: <strong>${activePlan.choresTix + activePlan.loginsTix}</strong> ${ticketIconHtml}
        </div>
        <div class="planner-summary-sep">=</div>
        <div class="planner-summary-total">
          Planned Routine: <strong>${activePlan.totalWeeklyTix}</strong> ${ticketIconHtml} / Week
        </div>
        ${activePlan.trackTix > 0 ? `
          <div class="planner-summary-track-bonus" title="One-time Chapter Track milestone reward added once to season totals">
            (+<strong>${activePlan.trackTix}</strong> 🎟️ One-Time Track)
          </div>
        ` : ''}
      </div>
    </div>

    <details class="roadmap-details${isDark ? ' dark' : ''}">
      <summary class="roadmap-summary">📊 Week-by-Week Forecast Roadmap (Nov 09, 2026 – Feb 01, 2027)</summary>
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
