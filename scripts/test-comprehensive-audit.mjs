import fs from 'fs';
import path from 'path';

console.log('🧪 Starting Comprehensive Codebase & Function Integrity Audit...\n');

const projectDir = path.resolve('.');
const indexHtmlPath = path.join(projectDir, 'index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// 1. Extract all inline event handlers from index.html
console.log('Audit 1: Auditing inline event handlers in index.html...');
const eventRegex = /\s(on[a-zA-Z]+)=["']([^"']+)["']/g;
const uniqueHandlers = new Set();
let match;
while ((match = eventRegex.exec(indexHtml)) !== null) {
  const handlerCode = match[2].trim();
  uniqueHandlers.add(handlerCode);
}

const calledFunctions = new Set();
for (const handler of uniqueHandlers) {
  // Extract function names (e.g. "openBoostsCostModal()", "openCategorySummaryModal('deliveries')")
  // Exclude keywords like "if", "return", "this"
  const fnMatch = handler.match(/^([a-zA-Z0-9_$]+)\s*\(/);
  if (fnMatch && !['if', 'return', 'this', 'console'].includes(fnMatch[1])) {
    calledFunctions.add(fnMatch[1]);
  }
}

console.log(`Found ${calledFunctions.size} unique function calls in index.html:`);
for (const fn of Array.from(calledFunctions).sort()) {
  console.log(`  • window.${fn}()`);
}

// 2. Audit window bindings across js/app.js and other loaded modules
console.log('\nAudit 2: Auditing window bindings across js/app.js and modal controllers...');
const appJs = fs.readFileSync(path.join(projectDir, 'js', 'app.js'), 'utf8');
const itemsModalJs = fs.readFileSync(path.join(projectDir, 'js', 'modals-items.js'), 'utf8');

const missingInApp = [];
for (const fn of calledFunctions) {
  const isBoundInApp = appJs.includes(`window.${fn} =`) || appJs.includes(`window.${fn}=`);
  const isBoundInItems = itemsModalJs.includes(`window.${fn} =`) || itemsModalJs.includes(`window.${fn}=`);
  if (!isBoundInApp && !isBoundInItems) {
    missingInApp.push(fn);
  }
}

if (missingInApp.length > 0) {
  console.error('❌ Functions invoked in index.html but NOT bound on window:', missingInApp);
  throw new Error(`Missing window bindings: ${missingInApp.join(', ')}`);
} else {
  console.log(`✅ All ${calledFunctions.size} HTML-invoked functions are guaranteed to be bound on window!`);
}

// 3. Audit exports and imports across all js modules
console.log('\nAudit 3: Auditing ES Module export/import integrity across all js files...');
const jsFiles = fs.readdirSync(path.join(projectDir, 'js')).filter(f => f.endsWith('.js'));

const exportsMap = new Map();

for (const file of jsFiles) {
  const filePath = path.join(projectDir, 'js', file);
  const code = fs.readFileSync(filePath, 'utf8');
  const fileExports = new Set();

  // match export function foo
  const fnMatches = code.matchAll(/export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/g);
  for (const m of fnMatches) fileExports.add(m[1]);

  // match export const/let/var foo
  const varMatches = code.matchAll(/export\s+(?:const|let|var)\s+([a-zA-Z0-9_$]+)/g);
  for (const m of varMatches) fileExports.add(m[1]);

  // match export { foo, bar }
  const namedMatches = code.matchAll(/export\s*\{([^}]+)\}/g);
  for (const m of namedMatches) {
    const symbols = m[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop().trim());
    symbols.forEach(s => {
      if (s) fileExports.add(s);
    });
  }

  exportsMap.set(`./${file}`, fileExports);
  exportsMap.set(file, fileExports);
}

// Now verify all imports resolve
let brokenImports = 0;
for (const file of jsFiles) {
  const filePath = path.join(projectDir, 'js', file);
  const code = fs.readFileSync(filePath, 'utf8');

  // match import { ... } from './...'
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g;
  let imp;
  while ((imp = importRegex.exec(code)) !== null) {
    const rawSymbols = imp[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim());
    const relPath = imp[2];
    const targetFile = path.basename(relPath);

    const availableExports = exportsMap.get(targetFile);
    if (!availableExports) {
      console.error(`❌ Module ${file} imports from unknown file: ${relPath}`);
      brokenImports++;
      continue;
    }

    for (const sym of rawSymbols) {
      if (!sym) continue;
      if (!availableExports.has(sym)) {
        console.error(`❌ Module ${file} imports "${sym}" from "${relPath}", but it is NOT exported!`);
        brokenImports++;
      }
    }
  }
}

if (brokenImports === 0) {
  console.log('✅ 100% of ES Module imports resolve cleanly to valid exports across all js files!');
} else {
  throw new Error(`Found ${brokenImports} broken imports in js modules`);
}

// 4. Audit DOM elements targeted by all modals and render logic
console.log('\nAudit 4: Auditing modal element ID targets in index.html...');
const targetedIds = [
  'chapterLogsModal', 'chapterLogsList', 'chapterLogsCount',
  'chapterActiveTix', 'chapterActiveCost', 'chapterActiveRatio',
  'boostsCostModal', 'boost1CostInput', 'boost1CurrencySelect',
  'boost2CostInput', 'boost2CurrencySelect', 'boost3CostInput',
  'boost3CurrencySelect', 'boost1ActiveBadge', 'boost2ActiveBadge',
  'boost3ActiveBadge', 'boost1ConvertedPreview', 'boost2ConvertedPreview',
  'boost3ConvertedPreview', 'boostsModalTotalActiveCost',
  'categorySummaryModal', 'categorySummaryTitle', 'categorySummaryTotals',
  'categorySummaryBody', 'columnHistoryModal', 'columnHistoryTitle',
  'guideModal', 'itemsBurnedModal', 'btnViewGrid', 'btnViewCompact',
  'statTotalTickets', 'statTotalCost', 'statTotalRatio',
  'saveCloudBtn', 'modalSaveCloudBtn'
];

const missingIds = [];
for (const id of targetedIds) {
  if (!indexHtml.includes(`id="${id}"`)) {
    missingIds.push(id);
  }
}

if (missingIds.length > 0) {
  console.error('❌ Missing target DOM element IDs in index.html:', missingIds);
  throw new Error(`Missing ${missingIds.length} required DOM IDs`);
} else {
  console.log(`✅ All ${targetedIds.length} modal and interactive element IDs exist in index.html!`);
}

console.log('\n🎉 ALL INTEGRITY AUDITS PASSED WITH ZERO ERRORS!');
