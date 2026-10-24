import fs from 'fs';
import path from 'path';

console.log('🧪 Starting Verification Tests for Ticket Icons in Counters...\n');

const indexPath = path.resolve('index.html');
const renderPath = path.resolve('js/render.js');
const statePath = path.resolve('js/state.js');
const modalsViewPath = path.resolve('js/modals-view.js');

const indexHtml = fs.readFileSync(indexPath, 'utf-8');
const renderJs = fs.readFileSync(renderPath, 'utf-8');
const stateJs = fs.readFileSync(statePath, 'utf-8');
const modalsViewJs = fs.readFileSync(modalsViewPath, 'utf-8');

// Test 1: Verify setElemHtml is exported from state.js
console.log('Test 1: Verifying setElemHtml export in state.js...');
if (!stateJs.includes('export function setElemHtml')) {
  throw new Error('state.js missing export function setElemHtml');
}
console.log('✅ TEST 1 PASSED: setElemHtml exported correctly.\n');

// Test 2: Verify renderChapterTicketIcon is imported and utilized in main metric counters in render.js
console.log('Test 2: Verifying renderChapterTicketIcon usage in render.js counters...');
if (!renderJs.includes("import { renderChapterTicketIcon } from './item-icons.js'")) {
  throw new Error('render.js must import renderChapterTicketIcon');
}

const requiredCounterChecks = [
  "setElemHtml('statTotalTickets'",
  "setElemHtml('statWeekTickets'",
  "setElemHtml('statEarnedTickets'",
  "setElemHtml('statGoalRemaining'",
  "setElemHtml('statGoalPerWeek'",
  "setElemHtml('tipTotalDeliv'",
  "setElemHtml('tipTotalBounty'",
  "setElemHtml('tipTotalAnimalBounty'",
  "setElemHtml('tipTotalChore'",
  "setElemHtml('tipTotalTrack'",
  "setElemHtml('tipTotalLogin'",
  "setElemHtml('tipWeekDeliv'",
  "setElemHtml('tipTodayDeliv'"
];

for (const check of requiredCounterChecks) {
  if (!renderJs.includes(check)) {
    throw new Error(`render.js missing counter update with setElemHtml: ${check}`);
  }
}
console.log('✅ TEST 2 PASSED: All main metric counters and tooltip breakdowns in render.js render ticket icons.\n');

// Test 3: Verify index.html static initial counter markup includes ticket icon image
console.log('Test 3: Verifying static initial counter markup in index.html...');
const statTotalMatch = indexHtml.match(/id="statTotalTickets"[^>]*>([\s\S]*?)<\/div>/);
if (!statTotalMatch || !statTotalMatch[1].includes('shiny_feather.webp')) {
  throw new Error('index.html #statTotalTickets missing initial ticket icon');
}

const statWeekMatch = indexHtml.match(/id="statWeekTickets"[^>]*>([\s\S]*?)<\/div>/);
if (!statWeekMatch || !statWeekMatch[1].includes('shiny_feather.webp')) {
  throw new Error('index.html #statWeekTickets missing initial ticket icon');
}

const statEarnedMatch = indexHtml.match(/id="statEarnedTickets"[^>]*>([\s\S]*?)<\/div>/);
if (!statEarnedMatch || !statEarnedMatch[1].includes('shiny_feather.webp')) {
  throw new Error('index.html #statEarnedTickets missing initial ticket icon');
}

const statGoalMatch = indexHtml.match(/id="statGoalRemaining"[^>]*>([\s\S]*?)<\/strong>/);
if (!statGoalMatch || !statGoalMatch[1].includes('shiny_feather.webp')) {
  throw new Error('index.html #statGoalRemaining missing initial ticket icon');
}

console.log('✅ TEST 3 PASSED: index.html static markup contains ticket icons.\n');

// Test 4: Verify modals-view.js counter summaries render chapter ticket icons
console.log('Test 4: Verifying modals-view.js counter summaries render chapter ticket icons...');
if (!modalsViewJs.includes('renderChapterTicketIcon')) {
  throw new Error('modals-view.js missing renderChapterTicketIcon');
}
if (!modalsViewJs.includes("activeTixEl.innerHTML = `<span style=\"display:inline-flex; align-items:center; gap:3px;\">${renderChapterTicketIcon(14)}")) {
  throw new Error('modals-view.js activeTixEl missing ticket icon render');
}
if (!modalsViewJs.includes("${renderChapterTicketIcon(16)} <span>${catTickets} Tickets</span>")) {
  throw new Error('modals-view.js categorySummary totalsEl missing ticket icon render');
}
if (!modalsViewJs.includes("${renderChapterTicketIcon(16)} <span>${totalWeekTickets} Tickets</span>")) {
  throw new Error('modals-view.js weekBreakdown totalsEl missing ticket icon render');
}
console.log('✅ TEST 4 PASSED: Modal counter summaries render chapter ticket icons.\n');

console.log('🎉 ALL COUNTER TICKET ICON TESTS PASSED WITH 100% SUCCESS! 🚀');
