var globalData = null;
var currentUser = null;
var currentVaultData = { logs: [], cumulativeTickets: 0, cumulativeCost: 0, weeks: {}, deliveries: [], bounties: [], chores: [] };
var isFetchCooldown = false;
var activeColumnType = null;

function formatSFL(val) {
  if (val === undefined || val === null || isNaN(val) || val === 0) return "0.00";
  if (val < 0.01) return val.toFixed(4);
  return val.toFixed(2);
}

function setElemText(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}

function toggleColumnCard(cardId, btn) {
  var card = document.getElementById(cardId);
  if (card) {
    card.classList.toggle('collapsed');
    if (btn) {
      btn.textContent = card.classList.contains('collapsed') ? '▲' : '▼';
    }
  }
}

function saveGoalAndRecalculate() {
  localStorage.setItem('sfl_targetGoal', document.getElementById('targetGoalInput').value);
  localStorage.setItem('sfl_targetWeeks', document.getElementById('targetWeeksInput').value);
  recalculateAll();
}

window.addEventListener('DOMContentLoaded', async function() {
  document.getElementById('boost1').checked = localStorage.getItem('sfl_boost1') === 'true';
  document.getElementById('boost2').checked = localStorage.getItem('sfl_boost2') === 'true';
  document.getElementById('boost3').checked = localStorage.getItem('sfl_boost3') === 'true';

  var savedGoal = localStorage.getItem('sfl_targetGoal');
  if (savedGoal !== null) document.getElementById('targetGoalInput').value = savedGoal;
  var savedWeeks = localStorage.getItem('sfl_targetWeeks');
  if (savedWeeks !== null) document.getElementById('targetWeeksInput').value = savedWeeks;

  var savedVip = localStorage.getItem('sfl_vip');
  if (savedVip !== null) document.getElementById('vipToggle').checked = savedVip === 'true';

  var savedFarmId = localStorage.getItem('sfl_farmId');
  if (savedFarmId) document.getElementById('farmId').value = savedFarmId;

  var savedApiKey = localStorage.getItem('sfl_apiKey');
  if (savedApiKey) document.getElementById('apiKey').value = savedApiKey;

  var savedUser = localStorage.getItem('sfl_username');
  if (savedUser) {
    currentUser = savedUser;
    document.getElementById('authLoggedOut').style.display = 'none';
    document.getElementById('authLoggedIn').style.display = 'flex';
    document.getElementById('displayUsername').textContent = currentUser;
    await fetchUserVault(currentUser);
  }
});

async function fetchUserVault(username) {
  try {
    var res = await fetch('/api/chapter?action=getVault&username=' + encodeURIComponent(username));
    var data = await res.json();
    if (data.vaultData) {
      currentVaultData = data.vaultData;
      if (globalData) {
        globalData.cloudHistory = currentVaultData;
        recalculateAll();
      }
    }
  } catch (err) {
    console.error('Failed to auto-load vault:', err);
  }
}

function getActiveBoostCount() {
  var b1 = document.getElementById('boost1').checked ? 1 : 0;
  var b2 = document.getElementById('boost2').checked ? 1 : 0;
  var b3 = document.getElementById('boost3').checked ? 1 : 0;
  return b1 + b2 + b3;
}

function getActiveVipBonus() {
  return document.getElementById('vipToggle').checked ? 2 : 0;
}

async function userRegister() {
  var u = document.getElementById('authUsername').value.trim();
  var p = document.getElementById('authPassword').value;
  if (!u || !p) { alert('Please enter both username and password.'); return; }

  try {
    var res = await fetch('/api/chapter?action=register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    var data = await res.json();
    if (data.error) throw new Error(data.error);

    alert('🎉 Account registered successfully! You can now log in.');
  } catch (err) {
    alert('Registration Failed: ' + err.message);
  }
}

async function userLogin() {
  var u = document.getElementById('authUsername').value.trim();
  var p = document.getElementById('authPassword').value;
  if (!u || !p) { alert('Please enter both username and password.'); return; }

  try {
    var res = await fetch('/api/chapter?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    var data = await res.json();
    if (data.error) throw new Error(data.error);

    currentUser = data.username;
    currentVaultData = data.vaultData || { logs: [], cumulativeTickets: 0, cumulativeCost: 0, weeks: {}, deliveries: [], bounties: [], chores: [] };
    
    localStorage.setItem('sfl_username', currentUser);
    document.getElementById('authLoggedOut').style.display = 'none';
    document.getElementById('authLoggedIn').style.display = 'flex';
    document.getElementById('displayUsername').textContent = currentUser;

    alert('🔓 Logged in successfully!');
    if (globalData) {
      globalData.cloudHistory = currentVaultData;
      recalculateAll();
    }
  } catch (err) {
    alert('Login Failed: ' + err.message);
  }
}

function userLogout() {
  currentUser = null;
  currentVaultData = { logs: [], cumulativeTickets: 0, cumulativeCost: 0, weeks: {}, deliveries: [], bounties: [], chores: [] };
  localStorage.removeItem('sfl_username');
  document.getElementById('authLoggedOut').style.display = 'flex';
  document.getElementById('authLoggedIn').style.display = 'none';
  if (globalData) {
    globalData.cloudHistory = currentVaultData;
    recalculateAll();
  }
}

function saveAndRecalculate() {
  localStorage.setItem('sfl_boost1', document.getElementById('boost1').checked);
  localStorage.setItem('sfl_boost2', document.getElementById('boost2').checked);
  localStorage.setItem('sfl_boost3', document.getElementById('boost3').checked);
  localStorage.setItem('sfl_vip', document.getElementById('vipToggle').checked);
  localStorage.setItem('sfl_farmId', document.getElementById('farmId').value.trim());
  localStorage.setItem('sfl_apiKey', document.getElementById('apiKey').value.trim());

  recalculateAll();
}

async function retryOperation(fn, retries = 3, delay = 8000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`Attempt ${i + 1} failed. Retrying in ${delay / 1000} seconds...`, err);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function loadTrackerData() {
  if (isFetchCooldown) return;

  var farmId = document.getElementById('farmId').value.trim() || '8472883706403914';
  var apiKey = document.getElementById('apiKey').value.trim();
  
  localStorage.setItem('sfl_farmId', farmId);
  localStorage.setItem('sfl_apiKey', apiKey);

  var priceBadge = document.getElementById('priceBadge');
  if (priceBadge) {
    priceBadge.style.display = 'inline-block';
    priceBadge.textContent = 'FETCHING...';
  }

  isFetchCooldown = true;
  var fetchButtons = document.querySelectorAll('button[onclick="loadTrackerData()"]');
  fetchButtons.forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.style.cursor = 'not-allowed';
  });

  var timeLeft = 10;
  var cooldownTimer = setInterval(function() {
    if (timeLeft > 0) {
      fetchButtons.forEach(btn => { btn.textContent = 'WAIT ' + timeLeft + 's'; });
      timeLeft--;
    } else {
      clearInterval(cooldownTimer);
      isFetchCooldown = false;
      fetchButtons.forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.textContent = 'FETCH DATA';
      });
    }
  }, 1000);

  try {
    var queryUrl = '/api/chapter?farmId=' + encodeURIComponent(farmId);
    if (apiKey) queryUrl += '&apiKey=' + encodeURIComponent(apiKey);

    var data = await retryOperation(async () => {
      var response = await fetch(queryUrl);
      var json = await response.json();
      if (json.error) throw new Error(json.error);
      return json;
    }, 3, 8000);

    globalData = data;
    globalData.cloudHistory = currentVaultData;

    if (priceBadge) {
      if (data.pricesLoadedCount > 0) {
        priceBadge.textContent = data.pricesLoadedCount + ' PRICES LOADED';
      } else {
        priceBadge.textContent = 'PRICE API OFFLINE';
      }
    }

    if (localStorage.getItem('sfl_vip') === null) {
      document.getElementById('vipToggle').checked = data.isVipActive;
      localStorage.setItem('sfl_vip', data.isVipActive);
    }

    recalculateAll();

  } catch (err) {
    alert('Error fetching data after 3 attempts: ' + err.message);
  }
}

function openCategorySummaryModal(cat) {
  var modal = document.getElementById('categorySummaryModal');
  var titleEl = document.getElementById('categorySummaryTitle');
  var totalsEl = document.getElementById('categorySummaryTotals');
  var bodyEl = document.getElementById('categorySummaryBody');

  var vipBonus = getActiveVipBonus();
  var boostCount = getActiveBoostCount();

  if (!globalData) {
    alert('Please click "FETCH DATA" first!');
    return;
  }

  var catTickets = 0;
  var catCost = 0;

  if (cat === 'delivery') {
    titleEl.textContent = '📦 NPC DELIVERIES OVERVIEW';
    var sortedDeliv = [...globalData.deliveries].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
    bodyEl.innerHTML = sortedDeliv.map(d => {
      var deliveryAddon = d.isManual ? 0 : (vipBonus + boostCount);
      var finalTickets = d.baseTickets + deliveryAddon;
      if (d.completed) {
        catTickets += finalTickets;
        catCost += (d.itemsCost || 0);
      }
      var itemRows = (d.itemDetails || []).map(it => `• ${it.qty}x ${it.name} (${formatSFL(it.lineCost)} SFL)`).join('<br/>');
      return `<div style="background:#FFF8DC; border:2px solid #8B5A2B; padding:10px; border-radius:8px; display:flex; flex-direction:column; gap:4px; font-size:11px;">
        <div style="display:flex; justify-content:space-between; font-weight:900;">
          <span style="color:#8B4513;">👤 ${d.from.toUpperCase()} ${d.isChapterNpc ? '👑' : ''}</span>
          <span class="badge ${d.completed ? 'badge-done' : 'badge-active'}">${d.completed ? '✨ DONE' : '⏳ ACTIVE'}</span>
        </div>
        <div style="color:#5C4033; font-weight:bold;">${itemRows}</div>
        <div style="display:flex; justify-content:space-between; font-weight:900; color:#2E7D32; border-top:1px dashed #D2B48C; padding-top:4px;">
          <span>Yield: ${finalTickets} Tickets</span>
          <span>${formatSFL(d.itemsCost)} SFL (${formatSFL(finalTickets > 0 ? d.itemsCost / finalTickets : 0)} SFL/Ticket)</span>
        </div>
      </div>`;
    }).join('');
  } else if (cat === 'bounty' || cat === 'animalBounty') {
    var isAnimal = cat === 'animalBounty';
    titleEl.textContent = isAnimal ? '🐄 ANIMAL BOUNTIES OVERVIEW' : '📜 BOUNTIES OVERVIEW';
    
    var filteredBounties = (globalData.bounties || []).filter(b => {
      var n = (b.name || '').toLowerCase();
      var checkAnimal = n.includes('chicken') || n.includes('cow') || n.includes('sheep');
      return isAnimal ? checkAnimal : !checkAnimal;
    });

    var sortedBounties = [...filteredBounties].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));

    bodyEl.innerHTML = sortedBounties.map(b => {
      var finalTickets = b.baseTickets + boostCount;
      if (b.completed) {
        catTickets += finalTickets;
        catCost += (b.itemsCost || 0);
      }
      return `<div style="background:#FFF8DC; border:2px solid #8B5A2B; padding:8px 10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:11px;">
        <div>
          <strong style="color:#3E2723;">${isAnimal ? '🐄' : '📜'} ${b.name.toUpperCase()} ${b.level ? '(Lvl ' + b.level + ')' : ''}</strong><br/>
          <span style="color:#8B4513; font-weight:bold;">Yield: ${finalTickets} Tickets | ${formatSFL(b.itemsCost)} SFL</span>
        </div>
        <span class="badge ${b.completed ? 'badge-done' : 'badge-active'}">${b.completed ? '✨ DONE' : '⏳ ACTIVE'}</span>
      </div>`;
    }).join('');

  } else if (cat === 'chore') {
    titleEl.textContent = '🧹 CHORES OVERVIEW';
    var sortedChores = [...globalData.chores].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
    bodyEl.innerHTML = sortedChores.map(c => {
      var finalTickets = c.baseTickets > 0 ? (c.baseTickets + boostCount) : 0;
      if (c.completed) catTickets += finalTickets;
      return `<div style="background:#FFF8DC; border:2px solid #8B5A2B; padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:11px;">
        <div>
          <strong style="color:#3E2723;">🧹 ${c.npc.toUpperCase()}</strong><br/>
          <span style="color:#5C4033; font-weight:bold;">${c.task}</span><br/>
          ${c.requirement > 0 ? '<span style="color:#8C7853;">Progress: ' + c.progress + ' / ' + c.requirement + '</span><br/>' : ''}
          <span style="color:#2E7D32; font-weight:900;">Yield: ${finalTickets} Tickets</span>
        </div>
        <span class="badge ${c.completed ? 'badge-done' : 'badge-active'}">${c.completed ? '✨ DONE' : '⏳ ACTIVE'}</span>
      </div>`;
    }).join('');
  }

  totalsEl.textContent = catTickets + ' Tickets | ' + formatSFL(catCost) + ' SFL';
  modal.classList.add('show');
}

function closeCategorySummaryModal() {
  document.getElementById('categorySummaryModal').classList.remove('show');
}

function openNpcHistoryModal(npcName) {
  document.getElementById('activeNpcHistoryName').value = npcName;
  setElemText('npcHistoryTitle', '📜 HISTORY: ' + npcName.toUpperCase());
  document.getElementById('addNpcHistDate').value = new Date().toISOString().split('T')[0];
  renderNpcHistoryModalList();
  document.getElementById('npcHistoryModal').classList.add('show');
}

function closeNpcHistoryModal() {
  document.getElementById('npcHistoryModal').classList.remove('show');
}

function renderNpcHistoryModalList() {
  var npcName = document.getElementById('activeNpcHistoryName').value;
  var bodyEl = document.getElementById('npcHistoryBody');

  var logs = (globalData && globalData.cloudHistory && globalData.cloudHistory.logs) || [];
  var records = [];
  var boostCount = getActiveBoostCount();
  var vipBonus = getActiveVipBonus();

  logs.forEach((log, logIdx) => {
    (log.deliveriesDone || []).forEach((past, itemIdx) => {
      var name = (typeof past === 'string' ? past : past.name || '').toLowerCase().trim();
      if (name === npcName.toLowerCase().trim()) {
        var baseTix = past.tickets || 2;
        var finalTix = baseTix + vipBonus + boostCount;
        var isChecked = past.checked !== undefined ? past.checked : !!past.completed;

        records.push({
          logIdx: logIdx,
          itemIdx: itemIdx,
          date: log.date || 'Past Run',
          cost: past.cost || 0,
          tickets: finalTix,
          items: past.items || [],
          checked: isChecked,
          status: past.completed ? '✨ Done' : '⏳ Active'
        });
      }
    });
  });

  var totalTickedTickets = 0;
  var totalTickedCost = 0;

  if (records.length === 0) {
    bodyEl.innerHTML = '<p style="font-size: 12px; color: #8C7853; font-weight: bold;">No history found for ' + npcName + '.</p>';
  } else {
    bodyEl.innerHTML = records.map((r) => {
      if (r.checked) {
        totalTickedTickets += r.tickets;
        totalTickedCost += r.cost;
      }
      var itemsHtml = (r.items || []).map(it => '• ' + it.qty + 'x ' + it.name).join(', ');

      return '<div style="background:#FFF8DC; padding:8px 12px; border:2px solid #8B5A2B; border-radius:6px; display:flex; flex-direction:column; gap:4px; font-size:11px;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center;">' +
          '<label style="display:flex; align-items:center; gap:8px; cursor:pointer;">' +
            '<input type="checkbox" ' + (r.checked ? 'checked' : '') + ' onchange="toggleNpcHistCheck(' + r.logIdx + ', ' + r.itemIdx + ')" style="accent-color:#D2691E; width:14px; height:14px;" />' +
            '<span style="font-weight:bold; color:#8B4513;">📅 ' + r.date + ' (' + r.status + ')</span>' +
          '</label>' +
          '<div style="display:flex; align-items:center; gap:8px;">' +
            '<span style="color:#2E7D32; font-weight:bold;">+' + r.tickets + ' Tickets (' + formatSFL(r.cost) + ' SFL)</span>' +
            '<button onclick="deleteNpcHistItem(' + r.logIdx + ', ' + r.itemIdx + ')" class="btn btn-sm btn-amber" style="background:#C0392B; border-color:#922B21; color:#fff; padding:2px 6px;">✕</button>' +
          '</div>' +
        '</div>' +
        (itemsHtml ? '<div style="color:#5C4033; font-size:10px; padding-left:22px;"><strong>Requested:</strong> ' + itemsHtml + '</div>' : '') +
      '</div>';
    }).join('');
  }

  setElemText('npcHistoryStats', totalTickedTickets + ' Tickets | ' + formatSFL(totalTickedCost) + ' SFL');
}

function toggleNpcHistCheck(logIdx, itemIdx) {
  var logs = globalData.cloudHistory.logs;
  if (logs[logIdx] && logs[logIdx].deliveriesDone && logs[logIdx].deliveriesDone[itemIdx]) {
    var item = logs[logIdx].deliveriesDone[itemIdx];
    item.checked = (item.checked === undefined ? !item.completed : !item.checked);
    renderNpcHistoryModalList();
    recalculateAll();
  }
}

function addNpcHistoryItem() {
  var npcName = document.getElementById('activeNpcHistoryName').value;
  var dateStr = document.getElementById('addNpcHistDate').value.trim() || new Date().toISOString().split('T')[0];
  var tickets = parseInt(document.getElementById('addNpcHistTickets').value) || 2;
  var cost = parseFloat(document.getElementById('addNpcHistCost').value) || 0;

  if (!globalData.cloudHistory.logs) globalData.cloudHistory.logs = [];
  
  var targetLog = globalData.cloudHistory.logs.find(l => l.date === dateStr);
  if (!targetLog) {
    targetLog = { date: dateStr, timestamp: new Date().toISOString(), ticketsSaved: 0, costSaved: 0, deliveriesDone: [] };
    globalData.cloudHistory.logs.unshift(targetLog);
  }

  if (!targetLog.deliveriesDone) targetLog.deliveriesDone = [];
  targetLog.deliveriesDone.push({ name: npcName, cost: cost, tickets: tickets, completed: true, items: [], checked: true });

  renderNpcHistoryModalList();
  recalculateAll();
}

function deleteNpcHistItem(logIdx, itemIdx) {
  var logs = globalData.cloudHistory.logs;
  if (logs[logIdx] && logs[logIdx].deliveriesDone) {
    logs[logIdx].deliveriesDone.splice(itemIdx, 1);
    renderNpcHistoryModalList();
    recalculateAll();
  }
}

function openColumnHistoryModal(type) {
  activeColumnType = type;
  setElemText('columnHistoryTitle', type === 'bounty' ? '📜 BOUNTIES EDIT / HISTORY' : '📜 CHORES EDIT / HISTORY');
  renderColumnHistoryModalList();
  document.getElementById('columnHistoryModal').classList.add('show');
}

function closeColumnHistoryModal() {
  document.getElementById('columnHistoryModal').classList.remove('show');
}

function renderColumnHistoryModalList() {
  var type = activeColumnType;
  var bodyEl = document.getElementById('columnHistoryBody');
  var weeks = (globalData && globalData.cloudHistory && globalData.cloudHistory.weeks) || {};
  var records = [];
  var boostCount = getActiveBoostCount();

  Object.entries(weeks).forEach(([weekId, wk]) => {
    var items = type === 'bounty' ? (wk.bounties || []) : (wk.chores || []);
    items.forEach((item, itemIdx) => {
      var baseTix = item.tickets || 1;
      var finalTix = baseTix > 0 ? (baseTix + boostCount) : 0;
      records.push({
        weekId: weekId,
        itemIdx: itemIdx,
        name: typeof item === 'string' ? item : (item.name || item.npc || 'Task'),
        cost: item.cost || 0,
        tickets: finalTix,
        baseTickets: baseTix,
        checked: item.checked !== undefined ? item.checked : !!item.completed,
        status: item.completed ? '✨ Done' : '⏳ Active'
      });
    });
  });

  var totalTickedTickets = 0;
  var totalTickedCost = 0;

  if (records.length === 0) {
    bodyEl.innerHTML = '<p style="font-size: 12px; color: #8C7853; font-weight: bold;">No weekly records found.</p>';
  } else {
    bodyEl.innerHTML = records.map((r) => {
      if (r.checked) {
        totalTickedTickets += r.tickets;
        totalTickedCost += r.cost;
      }
      return '<div style="background:#FFF8DC; padding:8px 12px; border:2px solid #8B5A2B; border-radius:6px; display:flex; justify-content:space-between; align-items:center; font-size:11px;">' +
        '<label style="display:flex; align-items:center; gap:8px; cursor:pointer;">' +
          '<input type="checkbox" ' + (r.checked ? 'checked' : '') + ' onchange="toggleWeeklyItemCheck(\'' + r.weekId + '\', ' + r.itemIdx + ')" style="accent-color:#D2691E; width:14px; height:14px;" />' +
          '<div><span style="font-weight:bold; color:#8B4513;">📅 ' + r.weekId + ' (' + r.status + ')</span><br/><strong style="color:#3E2723;">' + r.name + '</strong></div>' +
        '</label>' +
        '<div style="display:flex; align-items:center; gap:6px;">' +
          (type === 'bounty' ? 
            '<span>Tickets:</span><input type="number" value="' + r.baseTickets + '" onchange="updateWeeklyItemTickets(\'' + r.weekId + '\', ' + r.itemIdx + ', this.value)" style="width:50px; padding:2px; font-size:10px;" />' : 
            '<span>SFL:</span><input type="number" step="0.01" value="' + r.cost + '" onchange="updateWeeklyItemCost(\'' + r.weekId + '\', ' + r.itemIdx + ', this.value)" style="width:60px; padding:2px; font-size:10px;" />'
          ) +
          '<button onclick="deleteWeeklyItem(\'' + r.weekId + '\', ' + r.itemIdx + ')" class="btn btn-sm btn-amber" style="background:#C0392B; border-color:#922B21; color:#fff; padding:2px 6px;">✕</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  setElemText('columnHistoryStats', totalTickedTickets + ' Tickets | ' + formatSFL(totalTickedCost) + ' SFL');
}

function toggleWeeklyItemCheck(weekId, itemIdx) {
  var weeks = globalData.cloudHistory.weeks;
  var targetArray = activeColumnType === 'bounty' ? 'bounties' : 'chores';
  if (weeks[weekId] && weeks[weekId][targetArray] && weeks[weekId][targetArray][itemIdx]) {
    var item = weeks[weekId][targetArray][itemIdx];
    item.checked = (item.checked === undefined ? !item.completed : !item.checked);
    renderColumnHistoryModalList();
    recalculateAll();
  }
}

function updateWeeklyItemTickets(weekId, itemIdx, val) {
  var weeks = globalData.cloudHistory.weeks;
  var targetArray = activeColumnType === 'bounty' ? 'bounties' : 'chores';
  if (weeks[weekId] && weeks[weekId][targetArray] && weeks[weekId][targetArray][itemIdx]) {
    weeks[weekId][targetArray][itemIdx].tickets = parseInt(val) || 0;
    renderColumnHistoryModalList();
    recalculateAll();
  }
}

function updateWeeklyItemCost(weekId, itemIdx, val) {
  var weeks = globalData.cloudHistory.weeks;
  var targetArray = activeColumnType === 'bounty' ? 'bounties' : 'chores';
  if (weeks[weekId] && weeks[weekId][targetArray] && weeks[weekId][targetArray][itemIdx]) {
    weeks[weekId][targetArray][itemIdx].cost = parseFloat(val) || 0;
    renderColumnHistoryModalList();
    recalculateAll();
  }
}

function deleteWeeklyItem(weekId, itemIdx) {
  var weeks = globalData.cloudHistory.weeks;
  var targetArray = activeColumnType === 'bounty' ? 'bounties' : 'chores';
  if (weeks[weekId] && weeks[weekId][targetArray]) {
    weeks[weekId][targetArray].splice(itemIdx, 1);
    renderColumnHistoryModalList();
    recalculateAll();
  }
}

function addCustomHistoryItem() {
  var name = document.getElementById('addHistName').value.trim() || 'Custom Task';
  var tickets = parseInt(document.getElementById('addHistTickets').value) || 1;
  var cost = parseFloat(document.getElementById('addHistCost').value) || 0;

  var now = new Date();
  var startOfYear = new Date(Date.UTC(now.getFullYear(), 0, 1));
  var currentWeekNum = Math.ceil((((now - startOfYear) / 86400000) + startOfYear.getUTCDay() + 1) / 7);
  var currentWeekId = `${now.getFullYear()}-W${String(currentWeekNum).padStart(2, '0')}`;

  if (!globalData.cloudHistory.weeks) globalData.cloudHistory.weeks = {};
  if (!globalData.cloudHistory.weeks[currentWeekId]) {
    globalData.cloudHistory.weeks[currentWeekId] = { weekId: currentWeekId, bounties: [], chores: [] };
  }

  var targetArray = activeColumnType === 'bounty' ? 'bounties' : 'chores';
  globalData.cloudHistory.weeks[currentWeekId][targetArray].push({ name: name, cost: cost, tickets: tickets, completed: true, checked: true });

  renderColumnHistoryModalList();
  recalculateAll();
}

async function deleteMasterLog(logIdx) {
  if (!globalData || !globalData.cloudHistory || !globalData.cloudHistory.logs) return;
  if (confirm('🗑️ Delete this snapshot log?')) {
    globalData.cloudHistory.logs.splice(logIdx, 1);
    
    if (currentUser) {
      try {
        await fetch('/api/chapter?action=saveVault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: currentUser,
            logs: globalData.cloudHistory.logs,
            deliveries: globalData.deliveries,
            bounties: globalData.bounties,
            chores: globalData.chores
          })
        });
      } catch (err) {
        console.error('Failed to sync log deletion to cloud:', err);
      }
    }

    toggleHistoryModal();
    toggleHistoryModal();
    recalculateAll();
  }
}

async function saveProgressToCloudKV() {
  if (!currentUser) {
    alert('⚠️ Please LOGIN to your secure vault before saving to Cloud KV!');
    return;
  }
  if (!globalData) {
    alert('Please click "FETCH DATA" first before saving!');
    return;
  }

  // Calculate daily deliveries total for today's snapshot
  var dailyDelivTickets = 0;
  var dailyDelivCost = 0;
  var vipBonus = getActiveVipBonus();
  var boostCount = getActiveBoostCount();

  (globalData.deliveries || []).forEach(d => {
    if (d.completed) {
      var deliveryAddon = d.isManual ? 0 : (vipBonus + boostCount);
      dailyDelivTickets += (d.baseTickets + deliveryAddon);
      dailyDelivCost += (d.itemsCost || 0);
    }
  });

  try {
    var response = await fetch('/api/chapter?action=saveVault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: currentUser,
        dailyDeliveryTicketsSaved: dailyDelivTickets,
        dailyDeliveryCostSaved: dailyDelivCost,
        deliveries: globalData.deliveries,
        bounties: globalData.bounties,
        chores: globalData.chores
      })
    });

    var resData = await response.json();
    if (resData.error) throw new Error(resData.error);

    currentVaultData = resData.vaultData;
    globalData.cloudHistory = currentVaultData;

    alert('☁️ MASTER VAULT SAVED!\nDaily Deliveries Recorded (+' + dailyDelivTickets + ' Tickets, ' + formatSFL(dailyDelivCost) + ' SFL)\nWeekly Bounties & Chores Synced Once!');
    recalculateAll();
  } catch (err) {
    alert('Vault Save Failed: ' + err.message);
  }
}

function toggleHistoryModal() {
  var modal = document.getElementById('historyModal');
  modal.classList.toggle('show');

  if (modal.classList.contains('show') && globalData && globalData.cloudHistory) {
    var logs = globalData.cloudHistory.logs || [];
    var container = document.getElementById('modalLogList');

    if (logs.length === 0) {
      container.innerHTML = '<p style="color:#8C7853; font-size:12px; font-weight:bold;">No saved vault logs found for this account yet.</p>';
    } else {
      container.innerHTML = logs.map(function(log, idx) {
        var delivHtml = (log.deliveriesDone && log.deliveriesDone.length > 0) ? 
          '<div style="color:#5C4033; font-size:11px;"><strong>📦 Daily Deliveries:</strong> ' + 
          log.deliveriesDone.map(function(d) { return (typeof d === 'string' ? d : d.name + ' (' + formatSFL(d.cost) + ' SFL)'); }).join(', ') + '</div>' : '';

        var logTickets = log.ticketsSaved || 0;
        var logCost = log.costSaved || 0;
        var logRatio = logTickets > 0 ? formatSFL(logCost / logTickets) : "0.00";

        return '<div style="background:#FFF8DC; padding:12px; border:2px solid #8B5A2B; border-radius:6px; display:flex; flex-direction:column; gap:6px;">' +
          '<div style="display:flex; justify-content:space-between; align-items:center; color:#5C4033; font-size:11px; font-weight:900;">' +
            '<span style="color:#8B4513;">Log #' + (logs.length - idx) + ' (' + (log.date || 'Snapshot') + ')</span>' +
            '<button onclick="deleteMasterLog(' + idx + ')" class="btn btn-sm btn-amber" style="background:#C0392B; border-color:#922B21; color:#fff; padding:2px 8px;">🗑️ DELETE</button>' +
          '</div>' +
          '<div style="display:flex; justify-content:space-between; color:#2E7D32; font-weight:900; font-size:12px; border-bottom:1px dashed #D2B48C; padding-bottom:4px;">' +
            '<span>Daily Yield: +' + logTickets + ' | Cost: ' + formatSFL(logCost) + ' SFL</span>' +
            '<span style="background:#E8F5E9; padding:1px 6px; border-radius:4px; border:1px solid #A5D6A7;">' + logRatio + ' SFL / Ticket</span>' +
          '</div>' +
          '<div style="display:flex; flex-direction:column; gap:3px;">' + delivHtml + '</div>' +
        '</div>';
      }).join('');
    }
  }
}

function recalculateAll() {
  if (!globalData) return;

  var vipBonus = getActiveVipBonus();
  var boostCount = getActiveBoostCount();

  var totalTicketsAll = 0;
  var totalSflCostAll = 0;

  var delivCatTickets = 0;
  var bountyCatTickets = 0;
  var choreCatTickets = 0;

  var weekTicketsAll = 0;
  var weekCostAll = 0;

  var now = new Date();
  var startOfYear = new Date(Date.UTC(now.getFullYear(), 0, 1));
  var currentWeekNum = Math.ceil((((now - startOfYear) / 86400000) + startOfYear.getUTCDay() + 1) / 7);
  var currentWeekId = `${now.getFullYear()}-W${String(currentWeekNum).padStart(2, '0')}`;

  var logs = (globalData.cloudHistory && globalData.cloudHistory.logs) || [];
  var weeks = (globalData.cloudHistory && globalData.cloudHistory.weeks) || {};

  // 1. Process Historical Daily Deliveries across logs
  logs.forEach(log => {
    var isThisWeek = log.weekId === currentWeekId || (log.date && log.date.slice(0, 4) === now.getFullYear().toString());

    (log.deliveriesDone || []).forEach(item => {
      var isTicked = item.checked !== undefined ? item.checked : !!item.completed;
      if (isTicked) {
        var baseTix = item.tickets || 2;
        var finalTix = baseTix > 0 ? (baseTix + vipBonus + boostCount) : 0;
        var itemCost = item.cost || 0;

        delivCatTickets += finalTix;
        totalSflCostAll += itemCost;

        if (isThisWeek) {
          weekTicketsAll += finalTix;
          weekCostAll += itemCost;
        }
      }
    });
  });

  // 2. Process Weekly Bounties and Chores ONCE per week (preventing day-over-day duplication)
  Object.entries(weeks).forEach(([wkId, wk]) => {
    var isThisWeek = wkId === currentWeekId;

    (wk.bounties || []).forEach(b => {
      var isTicked = b.checked !== undefined ? b.checked : !!b.completed;
      if (isTicked) {
        var baseTix = b.tickets || 1;
        var finalTix = baseTix > 0 ? (baseTix + boostCount) : 0;
        var bCost = b.cost || 0;

        bountyCatTickets += finalTix;
        totalSflCostAll += bCost;

        if (isThisWeek) {
          weekTicketsAll += finalTix;
          weekCostAll += bCost;
        }
      }
    });

    (wk.chores || []).forEach(c => {
      var isTicked = c.checked !== undefined ? c.checked : !!c.completed;
      if (isTicked) {
        var baseTix = c.tickets || 1;
        var finalTix = baseTix > 0 ? (baseTix + boostCount) : 0;

        choreCatTickets += finalTix;

        if (isThisWeek) {
          weekTicketsAll += finalTix;
        }
      }
    });
  });

  totalTicketsAll = delivCatTickets + bountyCatTickets + choreCatTickets;

  // Render live columns (Today)
  var earnedTicketsToday = 0;
  var earnedCostToday = 0;

  var sortedDeliveries = [...globalData.deliveries].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
  
  var allBounties = globalData.bounties || [];
  var regularBountiesRaw = [];
  var animalBountiesRaw = [];

  allBounties.forEach(b => {
    var n = (b.name || '').toLowerCase();
    if (n.includes('chicken') || n.includes('cow') || n.includes('sheep')) {
      animalBountiesRaw.push(b);
    } else {
      regularBountiesRaw.push(b);
    }
  });

  var sortedBounties = [...regularBountiesRaw].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
  var sortedAnimalBounties = [...animalBountiesRaw].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
  var sortedChores = [...globalData.chores].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));

  // DELIVERIES COLUMN
  var deliveriesContainer = document.getElementById('deliveriesList');
  if (deliveriesContainer && globalData.deliveries) {
    setElemText('deliveriesCount', globalData.deliveries.length);
    deliveriesContainer.innerHTML = sortedDeliveries.map(function(d) {
      var deliveryAddon = d.isManual ? 0 : (vipBonus + boostCount);
      var finalTickets = d.baseTickets + deliveryAddon;
      var totalSflCost = d.itemsCost || 0;

      if (d.completed) {
        earnedTicketsToday += finalTickets;
        earnedCostToday += totalSflCost;
      }

      var itemRows = (d.itemDetails || []).map(function(detail) {
        return '<div style="display:flex; justify-content:space-between; font-size:11px;">' +
          '<span>• ' + detail.qty + 'x <strong style="color:#3E2723;">' + detail.name + '</strong> ' + (detail.isRecipe ? '<span class="badge badge-recipe">RECIPE</span>' : '') + '</span>' +
          '<span style="color:#8C7853; font-weight:bold;">' + (detail.lineCost > 0 ? formatSFL(detail.lineCost) + ' SFL' : '0.00') + '</span>' +
        '</div>';
      }).join('');

      var costPerTicket = finalTickets > 0 ? (totalSflCost / finalTickets) : 0;
      var badgeClass = d.isManual ? 'badge badge-manual' : (d.completed ? 'badge badge-done' : 'badge badge-active');
      var escapedName = d.from.replace(/'/g, "\\'");

      return '<div class="card-item ' + (d.isManual ? 'manual' : (d.completed ? 'done' : 'active')) + '">' +
        '<div style="display:flex; justify-content:space-between; align-items:center;">' +
          '<button class="btn-pop" onclick="openNpcHistoryModal(\'' + escapedName + '\')">📜 EDIT / HISTORY</button>' +
          '<span class="' + badgeClass + '">' + (d.completed ? '✨ DONE' : '⏳ ACTIVE') + '</span>' +
        '</div>' +
        '<div style="font-weight:900; color:#8B4513; font-size:12px;">👤 ' + d.from.toUpperCase() + (d.isChapterNpc ? ' 👑' : '') + '</div>' +
        '<div style="background:#FFFACD; padding:8px; border-radius:6px; border:1px solid #D2B48C; display:flex; flex-direction:column; gap:4px;">' + itemRows + '</div>' +
        '<div style="background:#FFFACD; padding:8px; border-radius:6px; border:1px solid #D2B48C; display:flex; flex-direction:column; gap:4px; font-size:11px;">' +
          '<div style="display:flex; justify-content:space-between; border-bottom:1px dashed #D2B48C; padding-bottom:4px;">' +
            '<span style="color:#B26A00; font-weight:900;">Yield: ' + finalTickets + ' Tickets</span>' +
            '<span style="color:#3E2723; font-weight:900;">' + formatSFL(totalSflCost) + ' SFL</span>' +
          '</div>' +
          '<div style="display:flex; justify-content:space-between; color:#2E7D32; font-weight:900;">' +
            '<span>Cost / Ticket:</span>' +
            '<span>' + formatSFL(costPerTicket) + ' SFL</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // BOUNTIES COLUMN
  var bountiesContainer = document.getElementById('bountiesList');
  if (bountiesContainer) {
    setElemText('bountiesCount', sortedBounties.length);
    bountiesContainer.innerHTML = sortedBounties.map(function(b) {
      var finalTickets = b.baseTickets + boostCount;
      var totalSflCost = b.itemsCost || 0;
      var costPerTicket = finalTickets > 0 ? (totalSflCost / finalTickets) : 0;
      var badgeClass = b.completed ? 'badge badge-done' : 'badge badge-active';

      return '<div class="card-item ' + (b.completed ? 'done' : 'active') + '">' +
        '<div style="display:flex; justify-content:space-between; align-items:center;">' +
          '<span style="font-weight:900; color:#3E2723; text-transform:capitalize;">📜 ' + b.name.toUpperCase() + (b.level ? ' (Lvl ' + b.level + ')' : '') + '</span>' +
          '<span class="' + badgeClass + '">' + (b.completed ? '✨ DONE' : '⏳ ACTIVE') + '</span>' +
        '</div>' +
        '<div style="background:#FFFACD; padding:8px; border-radius:6px; border:1px solid #D2B48C; display:flex; flex-direction:column; gap:4px; font-size:11px;">' +
          '<div style="display:flex; justify-content:space-between; color:#5C4033; font-weight:bold;">' +
            '<span>Yield: ' + finalTickets + ' Tickets</span>' +
            '<span>Cost: ' + formatSFL(totalSflCost) + ' SFL</span>' +
          '</div>' +
          '<div style="display:flex; justify-content:space-between; color:#2E7D32; font-weight:900;">' +
            '<span>Cost / Ticket:</span>' +
            '<span>' + formatSFL(costPerTicket) + ' SFL</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ANIMAL BOUNTIES COLUMN
  var animalBountiesContainer = document.getElementById('animalBountiesList');
  if (animalBountiesContainer) {
    setElemText('animalBountiesCount', sortedAnimalBounties.length);
    animalBountiesContainer.innerHTML = sortedAnimalBounties.map(function(b) {
      var finalTickets = b.baseTickets + boostCount;
      var totalSflCost = b.itemsCost || 0;
      var costPerTicket = finalTickets > 0 ? (totalSflCost / finalTickets) : 0;
      var badgeClass = b.completed ? 'badge badge-done' : 'badge badge-active';

      return '<div class="card-item ' + (b.completed ? 'done' : 'active') + '">' +
        '<div style="display:flex; justify-content:space-between; align-items:center;">' +
          '<span style="font-weight:900; color:#3E2723; text-transform:capitalize;">🐄 ' + b.name.toUpperCase() + (b.level ? ' (Lvl ' + b.level + ')' : '') + '</span>' +
          '<span class="' + badgeClass + '">' + (b.completed ? '✨ DONE' : '⏳ ACTIVE') + '</span>' +
        '</div>' +
        '<div style="background:#FFFACD; padding:8px; border-radius:6px; border:1px solid #D2B48C; display:flex; flex-direction:column; gap:4px; font-size:11px;">' +
          '<div style="display:flex; justify-content:space-between; color:#5C4033; font-weight:bold;">' +
            '<span>Yield: ' + finalTickets + ' Tickets</span>' +
            '<span>Cost: ' + formatSFL(totalSflCost) + ' SFL</span>' +
          '</div>' +
          '<div style="display:flex; justify-content:space-between; color:#2E7D32; font-weight:900;">' +
            '<span>Cost / Ticket:</span>' +
            '<span>' + formatSFL(costPerTicket) + ' SFL</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // CHORES COLUMN
  var choresContainer = document.getElementById('choresList');
  if (choresContainer && globalData.chores) {
    setElemText('choresCount', globalData.chores.length);
    choresContainer.innerHTML = sortedChores.map(function(c) {
      var finalTickets = c.baseTickets > 0 ? (c.baseTickets + boostCount) : 0;
      var hasProgress = c.requirement > 0;
      var badgeClass = c.completed ? 'badge badge-done' : 'badge badge-active';

      return '<div class="card-item ' + (c.completed ? 'done' : 'active') + '">' +
        '<div style="display:flex; justify-content:space-between; align-items:center;">' +
          '<span style="font-weight:900; color:#3E2723; text-transform:capitalize;">🧹 ' + c.npc.toUpperCase() + '</span>' +
          '<span class="' + badgeClass + '">' + (c.completed ? '✨ DONE' : '⏳ ACTIVE') + '</span>' +
        '</div>' +
        '<div style="color:#5C4033; font-weight:bold;">' + c.task + '</div>' +
        (hasProgress ? '<div style="font-size:11px; color:#8C7853; font-weight:bold;">Progress: ' + c.progress + ' / ' + c.requirement + '</div>' : '') +
        (c.baseTickets > 0 ? '<div style="background:#FFFACD; padding:6px 8px; border-radius:6px; border:1px solid #D2B48C; display:flex; justify-content:space-between; align-items:center; font-size:11px;"><span style="color:#8C7853; font-weight:bold;">Yield:</span><span style="color:#2E7D32; font-weight:900;">' + finalTickets + ' Tickets</span></div>' : '') +
      '</div>';
    }).join('');
  }

  // 1. OVERALL STATS
  setElemText('statTotalTickets', totalTicketsAll + ' Tickets');
  setElemText('statTotalCost', formatSFL(totalSflCostAll) + ' SFL');
  setElemText('statTotalRatio', (totalTicketsAll > 0 ? formatSFL(totalSflCostAll / totalTicketsAll) : "0.00") + ' SFL / Ticket');

  // 2. THIS WEEK'S STATS
  setElemText('statWeekTickets', weekTicketsAll + ' Tickets');
  setElemText('statWeekCost', formatSFL(weekCostAll) + ' SFL');
  setElemText('statWeekRatio', (weekTicketsAll > 0 ? formatSFL(weekCostAll / weekTicketsAll) : "0.00") + ' SFL / Ticket');

  // 3. TODAY'S STATS (Daily Deliveries Completed Today)
  setElemText('statEarnedTickets', earnedTicketsToday + ' Tickets');
  setElemText('statEarnedCost', formatSFL(earnedCostToday) + ' SFL');
  var earnedRatioVal = earnedTicketsToday > 0 ? (earnedCostToday / earnedTicketsToday) : 0;
  setElemText('statEarnedRatio', formatSFL(earnedRatioVal) + ' SFL / Ticket');

  // 4. CHAPTER END GOAL CALCULATOR
  var targetGoal = parseInt(document.getElementById('targetGoalInput').value) || 1000;
  var targetWeeks = parseInt(document.getElementById('targetWeeksInput').value) || 12;
  var remainingNeeded = Math.max(0, targetGoal - totalTicketsAll);
  var targetPerWeek = targetWeeks > 0 ? Math.ceil(remainingNeeded / targetWeeks) : 0;

  setElemText('statGoalRemaining', remainingNeeded + ' Tickets');
  setElemText('statGoalPerWeek', targetPerWeek + ' Tickets / Wk');
}
