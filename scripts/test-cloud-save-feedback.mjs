import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('🧪 Starting Automated Tests for Cloud Save in Edit Section & Toast Feedback...');

// Test 1: Verify index.html contains both save buttons with SVG icons
console.log('\nTest 1: Verifying index.html has both save buttons and SVG icons...');
{
  const indexPath = path.resolve('index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');

  // Verify main button
  assert(indexHtml.includes('id="saveCloudBtn"'), 'Main saveCloudBtn must exist');
  assert(indexHtml.includes('class="btn btn-wood save-cloud-btn"'), 'Main button should have save-cloud-btn class');

  // Verify modal button in edit section
  assert(indexHtml.includes('id="modalSaveCloudBtn"'), 'modalSaveCloudBtn must exist in edit section');
  assert(indexHtml.includes('onclick="saveProgressToCloudKV()"'), 'modalSaveCloudBtn must call saveProgressToCloudKV()');

  // Verify SVG cloud upload icon in both
  const svgMatches = indexHtml.match(/<svg width="1[45]" height="1[45]" viewBox="0 0 24 24"/g);
  assert(svgMatches && svgMatches.length >= 2, 'Both buttons must have SVG cloud upload icons');

  // Verify .app-toast and .btn-saved CSS exists
  assert(indexHtml.includes('.app-toast'), 'CSS must define .app-toast');
  assert(indexHtml.includes('.btn-wood.btn-saved'), 'CSS must define .btn-wood.btn-saved');

  console.log('✅ TEST 1 PASSED: index.html markup and styles verified.');
}

// Test 2: Verify js/api.js does not call alert() on save
console.log('\nTest 2: Verifying alert() removed from saveProgressToCloudKV in js/api.js...');
{
  const apiPath = path.resolve('js/api.js');
  const apiJs = fs.readFileSync(apiPath, 'utf-8');

  // Extract saveProgressToCloudKV function body
  const saveFnStart = apiJs.indexOf('export async function saveProgressToCloudKV');
  assert(saveFnStart !== -1, 'saveProgressToCloudKV must be exported');
  const saveFnBody = apiJs.slice(saveFnStart);

  // Ensure no alert calls in saveProgressToCloudKV
  assert(!saveFnBody.includes('alert(`☁️ SAVED IN CLOUD!'), 'Old alert popup must be removed');
  assert(!saveFnBody.includes('alert(`Cloud Save Error:'), 'Old alert error popup must be removed');
  assert(saveFnBody.includes('showToast'), 'showToast must be called instead of alert');
  assert(saveFnBody.includes('setSaveButtonsState'), 'Button states must be updated on save');

  console.log('✅ TEST 2 PASSED: alert() successfully replaced with showToast and button feedback.');
}

// Test 3: Verify showToast functionality in simulated DOM
console.log('\nTest 3: Verifying showToast function...');
{
  // Simulated DOM environment
  global.document = {
    _elements: {},
    getElementById(id) {
      return this._elements[id] || null;
    },
    createElement(tag) {
      const el = {
        tagName: tag,
        id: '',
        className: '',
        innerHTML: '',
        classList: {
          _classes: new Set(),
          add(c) { this._classes.add(c); },
          remove(c) { this._classes.delete(c); },
          contains(c) { return this._classes.has(c); }
        }
      };
      return el;
    },
    body: {
      appendChild(el) {
        if (el.id) global.document._elements[el.id] = el;
      }
    }
  };

  const { showToast } = await import('../js/api.js');
  showToast('Test Message', 'success', 100);

  const toastEl = global.document.getElementById('appToast');
  assert(toastEl !== null, 'Toast element must be created');
  assert.strictEqual(toastEl.innerHTML, 'Test Message', 'Toast content must match');
  assert(toastEl.className.includes('success'), 'Toast must have success class');
  assert(toastEl.className.includes('show'), 'Toast must have show class');

  console.log('✅ TEST 3 PASSED: showToast operates correctly.');
}

console.log('\n🎉 ALL CLOUD SAVE FEEDBACK TESTS PASSED SUCCESSFULLY! 🚀');
