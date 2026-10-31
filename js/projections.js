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
const BASE_EPOCH = new Date('2026-08-10T00:00:00.000Z');
const AUCTION_WEEK = 8;

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
    regularCount: 4,
    regularAvgTix: 3,
    boardBonusEnabled: false, // +100 Tix Board Bonus
    animalEnabled: true,
    animalCount: 2,
    animalAvgTix: 8
  },
  chores: {
    enabled: true,
    choresPerWeek: 7,
    baseTixPerChore: 1
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
    return {
      ...DEFAULT_PLANNER_TEMPLATE,
      ...parsed,
      npcs: { ...DEFAULT_PLANNER_TEMPLATE.npcs, ...(parsed.npcs || {}) },
      bounties: { ...DEFAULT_PLANNER_TEMPLATE.bounties, ...(parsed.bounties || {}) },
      chores: { ...DEFAULT_PLANNER_TEMPLATE.chores, ...(parsed.chores || {}) },
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

  // Bounties calculations (Regular + Board Bonus + Animal)
  const bConf = config.bounties || DEFAULT_PLANNER_TEMPLATE.bounties;
  const regularBountiesTix = bConf.regularEnabled ? ((parseInt(bConf.regularCount, 10) || 4) * (parseInt(bConf.regularAvgTix, 10) || 3)) : 0;
  const boardBonusTix = bConf.boardBonusEnabled ? 100 : 0;
  const animalBountiesTix = bConf.animalEnabled ? ((parseInt(bConf.animalCount, 10) || 2) * (parseInt(bConf.animalAvgTix, 10) || 8)) : 0;
  const bountiesTix = regularBountiesTix + boardBonusTix + animalBountiesTix;

  // Chores calculations (Hank: VIP adds +2 tickets per chore)
  const cConf = config.chores || DEFAULT_PLANNER_TEMPLATE.chores;
  const choreYield = (parseInt(cConf.baseTixPerChore, 10) || 1) + (vipBonus > 0 ? 2 : 0);
  const choresTix = cConf.enabled ? ((parseInt(cConf.choresPerWeek, 10) || 7) * choreYield) : 0;

  // Logins calculations
  const lConf = config.logins || DEFAULT_PLANNER_TEMPLATE.logins;
  const loginsTix = lConf.enabled ? (parseInt(lConf.daysPerWeek, 10) || 7) : 0;

  const totalWeeklyTix = delivTix + bountiesTix + choresTix + loginsTix;

  return {
    weekNum,
    isOverride: isWeekOverride,
    delivTix,
    doubleBonusTix,
    bountiesBreakdown: {
      regularEnabled: Boolean(bConf.regularEnabled),
      regularCount: parseInt(bConf.regularCount, 10) || 4,
      regularAvgTix: parseInt(bConf.regularAvgTix, 10) || 3,
      regularTix: regularBountiesTix,
      boardBonusEnabled: Boolean(bConf.boardBonusEnabled),
      boardBonusTix,
      animalEnabled: Boolean(bConf.animalEnabled),
      animalCount: parseInt(bConf.animalCount, 10) || 2,
      animalAvgTix: parseInt(bConf.animalAvgTix, 10) || 8,
      animalTix: animalBountiesTix,
      totalBountiesTix: bountiesTix
    },
    choresBreakdown: {
      enabled: Boolean(cConf.enabled),
      choresPerWeek: parseInt(cConf.choresPerWeek, 10) || 7,
      baseTixPerChore: parseInt(cConf.baseTixPerChore, 10) || 1,
      choreYield,
      choresTix
    },
    loginsBreakdown: {
      enabled: Boolean(lConf.enabled),
      daysPerWeek: parseInt(lConf.daysPerWeek, 10) || 7,
      loginsTix
    },
    bountiesTix,
    choresTix,
    loginsTix,
    totalWeeklyTix,
    npcBreakdown,
    config
  };
}

// ---------------------------------------------------------------------------
// Projection Calculation Engine
// ---------------------------------------------------------------------------

export function calculateProjections(displayItems, currentMondayKey, targetGoal, targetWeeks) {
  _lastProjectionInput = { displayItems, currentMondayKey, targetGoal, targetWeeks };

  const currentIndex = displayItems.findIndex(d => d.isCurrent);
  const nowMs = Date.now();

  let elapsedWeeks = 0;
  let totalEarned = 0;
  let daysPassedInWeek = 0;

  if (currentIndex !== -1) {
    const currentMonMs = new Date(currentMondayKey + 'T00:00:00.000Z').getTime();
    daysPassedInWeek = Math.max(0.2, Math.min(7, (nowMs - currentMonMs) / (24 * 60 * 60 * 1000)));
    elapsedWeeks = currentIndex + (daysPassedInWeek / 7);
    totalEarned = displayItems.slice(0, currentIndex + 1).reduce((s, d) => s + (d.tickets || 0), 0);
  } else {
    const diffDays = Math.max(0, (nowMs - BASE_EPOCH.getTime()) / (24 * 60 * 60 * 1000));
    elapsedWeeks = Math.min(TOTAL_CHAPTER_WEEKS, diffDays / 7);
    totalEarned = displayItems.reduce((s, d) => s + (d.tickets || 0), 0);
  }

  const activeWeekNum = currentIndex !== -1 ? (currentIndex + 1) : Math.min(TOTAL_CHAPTER_WEEKS, Math.floor(elapsedWeeks) + 1);
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

  const pCurrent = elapsedWeeks > 0 && totalEarned > 0 ? totalEarned / elapsedWeeks : 0;
  const pTarget = targetGoal > 0 && targetWeeks > 0 ? targetGoal / targetWeeks : 0;
  const pCustom = _customPace > 0 ? _customPace : (pPlanned > 0 ? pPlanned : pCurrent);

  if (_customPace === 0 && pPlanned > 0) {
    _customPace = Math.round(pPlanned);
  }

  const goalAtWeek8 = targetGoal > 0 ? Math.round((targetGoal * AUCTION_WEEK) / TOTAL_CHAPTER_WEEKS) : 0;

  function buildMilestone(pace, milestoneWeek, milestoneDaysRemaining, milestoneGoal) {
    const projected = Math.round(totalEarned + pace * Math.max(0, milestoneWeek - elapsedWeeks));
    const gapVsGoal = projected - milestoneGoal;
    const dailyRequired = milestoneDaysRemaining > 0.1
      ? Math.max(0, Math.ceil((milestoneGoal - totalEarned) / milestoneDaysRemaining))
      : 0;
    return { projected, gapVsGoal, dailyRequired };
  }

  function buildPlannedMilestone(milestoneWeek, milestoneGoal) {
    let projected = totalEarned;

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
      ? Math.max(0, Math.ceil((milestoneGoal - totalEarned) / daysRemaining))
      : 0;

    return { projected, gapVsGoal, dailyRequired };
  }

  const scenarios = {
    planned: {
      pace: pPlanned,
      week8: buildPlannedMilestone(AUCTION_WEEK, goalAtWeek8),
      week12: buildPlannedMilestone(TOTAL_CHAPTER_WEEKS, targetGoal)
    },
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

  const activePace = scenarios[_activeScenario]?.pace ?? pPlanned;

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

  function buildRoadmap(pace, isPlannedMode) {
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
        const weekTix = isPlannedMode
          ? calculateWeekNpcPlan(weekNum, template, overrides, vipBonus, boostCount).totalWeeklyTix
          : Math.round(pace);
        cumulative += weekTix;
        return { weekNum, value: weekTix, cumulative, type: 'projected' };
      }
    });
  }

  const isPlannedMode = _activeScenario === 'planned';

  return {
    totalEarned,
    elapsedWeeks,
    activeWeekNum,
    goalAtWeek8,
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

export function setPlannerBountyCount(field, val, weekVal) {
  const parsed = Math.max(0, parseInt(val, 10) || 0);
  const isTemplate = weekVal === 'template' || !weekVal;
  if (isTemplate) {
    const t = getPlannerTemplate();
    if (!t.bounties) t.bounties = { ...DEFAULT_PLANNER_TEMPLATE.bounties };
    t.bounties[field] = parsed;
    savePlannerTemplate(t);
  } else {
    const w = parseInt(weekVal, 10);
    const ov = getPlannerOverrides();
    if (!ov[w]) ov[w] = JSON.parse(JSON.stringify(getPlannerTemplate()));
    if (!ov[w].bounties) ov[w].bounties = { ...DEFAULT_PLANNER_TEMPLATE.bounties };
    ov[w].bounties[field] = parsed;
    savePlannerOverrides(ov);
  }
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

export function setPlannerChoreCount(val, weekVal) {
  const parsed = Math.max(0, parseInt(val, 10) || 0);
  const isTemplate = weekVal === 'template' || !weekVal;
  if (isTemplate) {
    const t = getPlannerTemplate();
    if (!t.chores) t.chores = { ...DEFAULT_PLANNER_TEMPLATE.chores };
    t.chores.choresPerWeek = parsed;
    savePlannerTemplate(t);
  } else {
    const w = parseInt(weekVal, 10);
    const ov = getPlannerOverrides();
    if (!ov[w]) ov[w] = JSON.parse(JSON.stringify(getPlannerTemplate()));
    if (!ov[w].chores) ov[w].chores = { ...DEFAULT_PLANNER_TEMPLATE.chores };
    ov[w].chores.choresPerWeek = parsed;
    savePlannerOverrides(ov);
  }
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
    const { displayItems, currentMondayKey, targetGoal, targetWeeks } = _lastProjectionInput;
    renderProjectionsView(
      calculateProjections(displayItems, currentMondayKey, targetGoal, targetWeeks)
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
  const w8 = active.week8;
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
  } else if (proj.goalDate) {
    goalDateHtml = `<div class="proj-goal-date${isDark ? ' dark' : ''}">
      📅 Predicted Goal Hit: <strong>${proj.goalDate.label}</strong>
      <span class="proj-goal-week-badge">Week ${proj.goalDate.weekNum}</span>
    </div>`;
  } else if (proj.targetGoal > 0 && pace > 0) {
    goalDateHtml = `<div class="proj-goal-date proj-goal-miss${isDark ? ' dark' : ''}">
      ⚠️ At selected pace, goal may not be reached before Week 12.
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
    const label = w === AUCTION_WEEK ? `Week ${w} (🏁 Mega Auction Week)` : w === TOTAL_CHAPTER_WEEKS ? `Week ${w} (🏆 Finale Week)` : `Week ${w}`;
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
  const regCountOptions = [1, 2, 3, 4, 5, 6].map(c =>
    `<option value="${c}" ${bData.regularCount === c ? 'selected' : ''}>${c} Bounties</option>`
  ).join('');
  const animalCountOptions = [0, 1, 2, 3, 4].map(c =>
    `<option value="${c}" ${bData.animalCount === c ? 'selected' : ''}>${c} Animals</option>`
  ).join('');

  const bountiesSectionHtml = `
    <div class="planner-sub-cards">
      <!-- Regular Bounties Card -->
      <div class="planner-sub-card${isDark ? ' dark' : ''}">
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
          <span class="planner-sub-desc">Board bounties from Pete, Bert & Plaza NPCs:</span>
          <select
            class="planner-mini-select${isDark ? ' dark' : ''}"
            ${!bData.regularEnabled ? 'disabled' : ''}
            onchange="setPlannerBountyCount('regularCount', this.value, '${currentWeekVal}')"
          >
            ${regCountOptions}
          </select>
          <span class="planner-sub-rate">@ ~${bData.regularAvgTix} tix each</span>
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
      <div class="planner-sub-card${isDark ? ' dark' : ''}">
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
          <span class="planner-sub-desc">High-tier produce delivery tasks:</span>
          <select
            class="planner-mini-select${isDark ? ' dark' : ''}"
            ${!bData.animalEnabled ? 'disabled' : ''}
            onchange="setPlannerBountyCount('animalCount', this.value, '${currentWeekVal}')"
          >
            ${animalCountOptions}
          </select>
          <span class="planner-sub-rate">@ ~${bData.animalAvgTix} tix each</span>
        </div>
      </div>
    </div>
  `;

  // 3. Chores & Logins HTML
  const cData = activePlan.choresBreakdown;
  const lData = activePlan.loginsBreakdown;
  const choreFreqOptions = [
    { count: 7, label: 'Daily (7 Chores / week — 1/day)' },
    { count: 14, label: 'Active (14 Chores / week — 2/day)' },
    { count: 21, label: 'Full Clear (21 Chores / week — 3/day)' },
    { count: 3, label: 'Casual (3 Chores / week)' },
    { count: 1, label: 'Light (1 Chore / week)' }
  ].map(o =>
    `<option value="${o.count}" ${cData.choresPerWeek === o.count ? 'selected' : ''}>${o.label}</option>`
  ).join('');

  const choresSectionHtml = `
    <div class="planner-sub-cards">
      <!-- Hank's Chores Card -->
      <div class="planner-sub-card${isDark ? ' dark' : ''}">
        <div class="planner-sub-card-header">
          <div class="planner-chore-title-wrap">
            <img src="public/icons/npcs/hank.webp" class="planner-hank-avatar" alt="Hank" onerror="this.style.display='none'" />
            <label class="planner-sub-label">
              <input
                type="checkbox"
                ${cData.enabled ? 'checked' : ''}
                onchange="togglePlannerChore('${currentWeekVal}')"
              />
              <span class="planner-sub-title">🧹 Hank's Chores</span>
            </label>
          </div>
          <span class="planner-sub-tix">${ticketIconHtml} <strong>${cData.choresTix}</strong> Tix</span>
        </div>
        <div class="planner-sub-body">
          <select
            class="planner-mini-select${isDark ? ' dark' : ''}"
            ${!cData.enabled ? 'disabled' : ''}
            onchange="setPlannerChoreCount(this.value, '${currentWeekVal}')"
          >
            ${choreFreqOptions}
          </select>
          <span class="planner-sub-rate">
            Yield: ${cData.baseTixPerChore} base ${vipBonus > 0 ? `(+2 VIP 👑)` : ''} = <strong>${cData.choreYield}</strong> ${ticketIconHtml}/chore
          </span>
        </div>
      </div>

      <!-- Daily Login Reward Card -->
      <div class="planner-sub-card${isDark ? ' dark' : ''}">
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
          oninput="setProjectionScenario('custom', this.value)"
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
          <span class="planner-subtitle">Customize your weekly Deliveries, Bounties (+100 Board Bonus), and Hank Chores</span>
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
        >🧹 Chores & Logins (${activePlan.choresTix + activePlan.loginsTix} Tix)</button>
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
        <div class="planner-summary-item" title="Hank Chores & Daily Logins">
          🧹 Chores/Logins: <strong>${activePlan.choresTix + activePlan.loginsTix}</strong> ${ticketIconHtml}
        </div>
        <div class="planner-summary-sep">=</div>
        <div class="planner-summary-total">
          Planned Total: <strong>${activePlan.totalWeeklyTix}</strong> ${ticketIconHtml} / Week
        </div>
      </div>
    </div>

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
