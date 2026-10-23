import fs from 'fs';
import path from 'path';

console.log('🧪 Starting Verification Tests for Light & Dark Mode Dashboard and Boosts Modal...\n');

const indexPath = path.resolve('index.html');
const cssPath = path.resolve('css/styles.css');
const jsPath = path.resolve('js/modals-view.js');

const indexHtml = fs.readFileSync(indexPath, 'utf-8');
const cssText = fs.readFileSync(cssPath, 'utf-8');
const jsText = fs.readFileSync(jsPath, 'utf-8');

// Test 1: Verify complete removal of clunky classes
console.log('Test 1: Verifying obsolete and conflicting CSS classes are removed from index.html & css/styles.css...');
const forbiddenClasses = [
  'panel-control-box',
  'boosts-box',
  'track-box',
  'coins-box',
  'boost-cost-card',
  'boost-cost-badge',
  'boost-cost-input',
  'boost-currency-select',
  'boost-cost-summary',
  'btn-save-boosts'
];

for (const cls of forbiddenClasses) {
  if (indexHtml.includes(cls)) {
    throw new Error(`index.html still contains deprecated class "${cls}"`);
  }
  if (cssText.includes(`.${cls}`)) {
    throw new Error(`css/styles.css still contains deprecated class ".${cls}"`);
  }
}
console.log('✅ TEST 1 PASSED: Obsolete classes completely purged.\n');

// Test 2: Verify Dashboard Controls have zero light-mode background tint overrides
console.log('Test 2: Verifying Dashboard Controls retain clean native light mode (no rgba tint)...');
if (!indexHtml.includes('class="input-group panel-group-boosts"')) {
  throw new Error('index.html missing panel-group-boosts class');
}
if (!indexHtml.includes('class="input-group panel-group-track"')) {
  throw new Error('index.html missing panel-group-track class');
}
if (!indexHtml.includes('class="input-group panel-group-coins"')) {
  throw new Error('index.html missing panel-group-coins class');
}
// Ensure css/styles.css does NOT define light mode background for panel-group-*
const lightModeMatches = cssText.match(/(?:^|\})\s*(\.panel-group-(?:boosts|track|coins)[^{]*)\{([^}]*)\}/g) || [];
for (const match of lightModeMatches) {
  if (match.includes('background')) {
    throw new Error(`css/styles.css must not assign light-mode background to panel groups: ${match}`);
  }
}
console.log('✅ TEST 2 PASSED: Dashboard controls have clean native light mode backgrounds.\n');

// Test 3: Verify Gear icon button is borderless and transparent
console.log('Test 3: Verifying Gear button is borderless and transparent without btn-wood frame...');
if (indexHtml.includes('id="boostsCostBtn"') && indexHtml.includes('btn-wood boosts-gear-btn')) {
  throw new Error('Gear button still has btn-wood applied');
}
if (!cssText.includes('.boosts-gear-btn') || !cssText.includes('background: none')) {
  throw new Error('.boosts-gear-btn CSS rule missing or background is not none');
}
console.log('✅ TEST 3 PASSED: Gear icon button is borderless and transparent.\n');

// Test 4: Verify #boostsCostModal integrates with standard guide-card design system
console.log('Test 4: Verifying #boostsCostModal uses standard guide-card components...');
if (!indexHtml.includes('id="boostsCostModal"')) {
  throw new Error('#boostsCostModal missing in index.html');
}
const modalSlice = indexHtml.substring(indexHtml.indexOf('id="boostsCostModal"'), indexHtml.indexOf('<!-- =========================================='));
const guideCardCount = (modalSlice.match(/class="guide-card"/g) || []).length;
const highlightCardCount = (modalSlice.match(/class="guide-card highlight"/g) || []).length;

if (guideCardCount !== 3) {
  throw new Error(`Expected 3 guide-cards for boosts in modal, found ${guideCardCount}`);
}
if (highlightCardCount !== 1) {
  throw new Error(`Expected 1 guide-card highlight for modal summary, found ${highlightCardCount}`);
}
if (!modalSlice.includes('class="btn btn-emerald"')) {
  throw new Error('Save button should use standard .btn.btn-emerald');
}
console.log('✅ TEST 4 PASSED: Modal uses standard guide-card and btn-emerald.\n');

// Test 5: Verify Dark Mode overrides for Dashboard Controls & Boosts modal exist in styles.css
console.log('Test 5: Verifying Dark Mode theme overrides for dashboard controls and modal...');
if (!cssText.includes('body.dark-mode .panel-group-boosts') ||
    !cssText.includes('body.dark-mode .panel-group-track') ||
    !cssText.includes('body.dark-mode .panel-group-coins')) {
  throw new Error('Missing dark-mode overrides for panel groups in css/styles.css');
}
if (!cssText.includes('body.dark-mode .badge-inactive') ||
    !cssText.includes('body.dark-mode .boost-cost-preview')) {
  throw new Error('Missing dark-mode badge or preview rules in css/styles.css');
}
console.log('✅ TEST 5 PASSED: Dark mode overrides properly configured.\n');

console.log('🎉 ALL THEME TESTS PASSED WITH 100% SUCCESS! 🚀');
