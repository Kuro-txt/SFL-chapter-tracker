var globalData = null;
var currentUser = null;
var currentVaultData = { logs: [], cumulativeTickets: 0, cumulativeCost: 0, deliveries: [], bounties: [], chores: [] };
var currentDoneTicketsToday = 0;
var currentDoneCostToday = 0;
var isFetchCooldown = false;
var activeColumnType = null;

function formatSFL(val) {
  if (val === undefined || val === null || isNaN(val) || val === 0) return "0.00";
  if (val < 0.01) return val.toFixed(4);
  return val.toFixed(2);
}

window.addEventListener('DOMContentLoaded', async function() {
  document.getElementById('boost1').checked = localStorage.getItem('sfl_boost1') === 'true';
  document.getElementById('boost2').checked = localStorage.getItem('sfl_boost2') === 'true';
  document.getElementById('boost3').checked = localStorage.getItem('sfl_boost3') === 'true';

  var savedVip = localStorage.getItem('sfl_vip');
  if (savedVip !== null) {
    document.getElementById('vipToggle').checked = savedVip === 'true';
  }

  var savedFarmId = localStorage.getItem('sfl_farmId');
  if (savedFarmId) {
    document.getElementById('farmId').value = savedFarmId;
  }

  var savedApiKey = localStorage.getItem('sfl_apiKey');
  if (savedApiKey) {
    document.getElementById('apiKey').value = savedApiKey;
  }

  var savedUser = localStorage.getItem('sfl_username');
  if (savedUser) {
    currentUser = savedUser;
    document.getElementById('authLoggedOut').style.display = 'none';
    document.getElementById('authLoggedIn').style.display = 'flex';
    document.getElementById('displayUsername').textContent = currentUser;
    
    // Automatically fetch vault data on refresh
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
    currentVaultData = data.vaultData || { logs: [], cumulativeTickets: 0, cumulativeCost: 0, deliveries: [], bounties: [], chores: [] };
    
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
  currentVaultData = { logs: [], cumulativeTickets: 0, cumulativeCost: 0, deliveries: [], bounties: [], chores: [] };
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

async function loadTrackerData() {
  if (isFetchCooldown) return;

  var farmId = document.getElementById('farmId').value.trim() || '8472883706403914';
  var apiKey = document.getElementById('apiKey').value.trim();
  
  localStorage.setItem('sfl_farmId', farmId);
  localStorage.setItem('sfl_apiKey', apiKey);

  var priceBadge = document.getElementById('priceBadge');
  priceBadge.style.display = 'inline-block';
  priceBadge.textContent = 'FETCHING...';

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

    var response = await fetch(queryUrl);
    var data = await response.json();

    if (data.error) throw new Error(data.error);

    globalData = data;
    globalData.cloudHistory = currentVaultData;

    if (data.pricesLoadedCount > 0) {
      priceBadge.textContent = data.pricesLoadedCount + ' PRICES LOADED';
    } else {
      priceBadge.textContent = 'PRICE API OFFLINE';
    }

    if (localStorage.getItem('sfl_vip') === null) {
      document.getElementById('vipToggle').checked = data.isVipActive;
      localStorage.setItem('sfl_vip', data.isVipActive);
    }

    recalculateAll();

  } catch (err) {
    alert('Error fetching data: ' + err.message);
  }
}

// NPC Delivery History Modal
function openNpcHistoryModal(npcName) {
  document.getElementById('activeNpcHistoryName').value = npcName;
  document.getElementById('npcHistoryTitle').textContent = '📜 HISTORY: ' + npcName.toUpperCase();
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
  var statsEl = document.getElementById('npcHistoryStats');

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
        records.push({
          logIdx: logIdx,
          itemIdx: itemIdx,
          date: log.date || 'Past Run',
          cost: past.cost || 0,
          tickets: finalTix,
          items: past.items || [],
          checked: past.checked !== false,
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
            '<span style="color:#2E7D32; font-weight:bold;">+' + r.tickets + ' Tix (' + formatSFL(r.cost) + ' SFL)</span>' +
            '<button onclick="deleteNpcHistItem(' + r.logIdx + ', ' + r.itemIdx + ')" class="btn btn-sm btn-amber" style="background:#C0392B; border-color:#922B21; color:#fff; padding:2px 6px;">✕</button>' +
          '</div>' +
        '</div>' +
        (itemsHtml ? '<div style="color:#5C4033; font-size:10px; padding-left:22px;"><strong>Requested:</strong> ' + itemsHtml + '</div>' : '') +
      '</div>';
    }).join('');
  }

  statsEl.textContent = totalTickedTickets + ' Tickets | ' + formatSFL(totalTickedCost) + ' SFL';
}

function toggleNpcHistCheck(logIdx, itemIdx) {
  var logs = globalData.cloudHistory.logs;
  if (logs[logIdx] && logs[logIdx].deliveriesDone && logs[logIdx].deliveriesDone[itemIdx]) {
    var item = logs[logIdx].deliveriesDone[itemIdx];
    item.checked = item.checked === false ? true : false;
    renderNpcHistoryModalList();
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
    targetLog = { date: dateStr, timestamp: new Date().toISOString(), ticketsSaved: 0, costSaved: 0, deliveriesDone: [], bountiesDone: [], choresDone: [] };
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

// Column History Modal (Bounties / Chores)
function openColumnHistoryModal(type) {
  activeColumnType = type;
  document.getElementById('columnHistoryTitle').textContent = type === 'bounty' ? '📜 ALL BOUNTIES HISTORY' : '📜 ALL CHORES HISTORY';
  renderColumnHistoryModalList();
  document.getElementById('columnHistoryModal').classList.add('show');
}

function closeColumnHistoryModal() {
  document.getElementById('columnHistoryModal').classList.remove('show');
}

function renderColumnHistoryModalList() {
  var type = activeColumnType;
  var bodyEl = document.getElementById('columnHistoryBody');
  var statsEl = document.getElementById('columnHistoryStats');

  var logs = (globalData && globalData.cloudHistory && globalData.cloudHistory.logs) || [];
  var records = [];
  var boostCount = getActiveBoostCount();

  logs.forEach((log, logIdx) => {
    var items = type === 'bounty' ? (log.bountiesDone || []) : (log.choresDone || []);
    items.forEach((item, itemIdx) => {
      var baseTix = item.tickets || 1;
      var finalTix = baseTix > 0 ? (baseTix + boostCount) : 0;
      records.push({
        logIdx: logIdx,
        itemIdx: itemIdx,
        date: log.date || 'Past Run',
        name: typeof item === 'string' ? item : (item.name || item.npc || 'Task'),
        cost: item.cost || 0,
        tickets: finalTix,
        checked: item.checked !== false,
        status: item.completed ? '✨ Done' : '⏳ Active'
      });
    });
  });

  var totalTickedTickets = 0;
  var totalTickedCost = 0;

  if (records.length === 0) {
    bodyEl.innerHTML = '<p style="font-size: 12px; color: #8C7853; font-weight: bold;">No past history records found.</p>';
  } else {
    bodyEl.innerHTML = records.map((r) => {
      if (r.checked) {
        totalTickedTickets += r.tickets;
        totalTickedCost += r.cost;
      }
      return '<div style="background:#FFF8DC; padding:8px 12px; border:2px solid #8B5A2B; border-radius:6px; display:flex; justify-content:space-between; align-items:center; font-size:11px;">' +
        '<label style="display:flex; align-items:center; gap:8px; cursor:pointer;">' +
          '<input type="checkbox" ' + (r.checked ? 'checked' : '') + ' onchange="toggleColumnHistCheck(' + r.logIdx + ', ' + r.itemIdx + ')" style="accent-color:#D2691E; width:14px; height:14px;" />' +
          '<div><span style="font-weight:bold; color:#8B4513;">📅 ' + r.date + ' (' + r.status + ')</span><br/><strong style="color:#3E2723;">' + r.name + '</strong></div>' +
        '</label>' +
        '<div style="display:flex; align-items:center; gap:10px;">' +
          '<span style="color:#2E7D32; font-weight:bold;">' + (r.tickets > 0 ? '+' + r.tickets + ' Tix ' : '') + (r.cost > 0 ? '(' + formatSFL(r.cost) + ' SFL)' : '') + '</span>' +
          '<button onclick="deleteColumnHistItem(' + r.logIdx + ', ' + r.itemIdx + ')" class="btn btn-sm btn-amber" style="background:#C0392B; border-color:#922B21; color:#fff; padding:2px 6px;">✕</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  statsEl.textContent = totalTickedTickets + ' Tickets | ' + formatSFL(totalTickedCost) + ' SFL';
}

function toggleColumnHistCheck(logIdx, itemIdx) {
  var logs = globalData.cloudHistory.logs;
  var targetArray = activeColumnType === 'bounty' ? 'bountiesDone' : 'choresDone';
  if (logs[logIdx] && logs[logIdx][targetArray] && logs[logIdx][targetArray][itemIdx]) {
    var item = logs[logIdx][targetArray][itemIdx];
    item.checked = item.checked === false ? true : false;
    renderColumnHistoryModalList();
  }
}

function addCustomHistoryItem() {
  var name = document.getElementById('addHistName').value.trim() || 'Custom Task';
  var tickets = parseInt(document.getElementById('addHistTickets').value) || 1;
  var cost = parseFloat(document.getElementById('addHistCost').value) || 0;
  var todayDate = new Date().toISOString().split('T')[0];

  if (!globalData.cloudHistory.logs) globalData.cloudHistory.logs = [];

  var targetLog = globalData.cloudHistory.logs.find(l => l.date === todayDate);
  if (!targetLog) {
    targetLog = { date: todayDate, timestamp: new Date().toISOString(), ticketsSaved: 0, costSaved: 0, deliveriesDone: [], bountiesDone: [], choresDone: [] };
    globalData.cloudHistory.logs.unshift(targetLog);
  }

  var targetArray = activeColumnType === 'bounty' ? 'bountiesDone' : 'choresDone';
  if (!targetLog[targetArray]) targetLog[targetArray] = [];
  targetLog[targetArray].push({ name: name, cost: cost, tickets: tickets, completed: true, checked: true });

  renderColumnHistoryModalList();
  recalculateAll();
}

function deleteColumnHistItem(logIdx, itemIdx) {
  var logs = globalData.cloudHistory.logs;
  var targetArray = activeColumnType === 'bounty' ? 'bountiesDone' : 'choresDone';
  if (logs[logIdx] && logs[logIdx][targetArray]) {
    logs[logIdx][targetArray].splice(itemIdx, 1);
    renderColumnHistoryModalList();
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

  try {
    var response = await fetch('/api/chapter?action=saveVault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: currentUser,
        ticketsSaved: currentDoneTicketsToday,
        costSaved: currentDoneCostToday,
        deliveries: globalData.deliveries,
        bounties: globalData.bounties,
        chores: globalData.chores
      })
    });

    var resData = await response.json();
    if (resData.error) throw new Error(resData.error);

    currentVaultData = resData.vaultData;
    globalData.cloudHistory = currentVaultData;

    alert('☁️ MASTER VAULT SAVED (Active & Done Synced)!\nSaved +' + currentDoneTicketsToday + ' Tickets (' + formatSFL(currentDoneCostToday) + ' SFL)');
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
          '<div style="color:#5C4033; font-size:11px;"><strong>📦 Deliveries:</strong> ' + 
          log.deliveriesDone.map(function(d) { return (typeof d === 'string' ? d : d.name + ' (' + formatSFL(d.cost) + ' SFL)'); }).join(', ') + '</div>' : '';

        var bountiesHtml = (log.bountiesDone && log.bountiesDone.length > 0) ? 
          '<div style="color:#B26A00; font-size:11px;"><strong>📜 Bounties:</strong> ' + 
          log.bountiesDone.map(function(b) { return (typeof b === 'string' ? b : b.name + ' (' + formatSFL(b.cost) + ' SFL)'); }).join(', ') + '</div>' : '';

        var choresHtml = (log.choresDone && log.choresDone.length > 0) ? 
          '<div style="color:#2E7D32; font-size:11px;"><strong>🧹 Chores:</strong> ' + 
          log.choresDone.map(function(c) { return (typeof c === 'string' ? c : c.name); }).join(', ') + '</div>' : '';

        var logTickets = log.ticketsSaved || 0;
        var logCost = log.costSaved || 0;
        var logRatio = logTickets > 0 ? formatSFL(logCost / logTickets) : "0.00";

        return '<div style="background:#FFF8DC; padding:12px; border:2px solid #8B5A2B; border-radius:6px; display:flex; flex-direction:column; gap:6px;">' +
          '<div style="display:flex; justify-content:space-between; color:#5C4033; font-size:11px; font-weight:900;">' +
            '<span style="color:#8B4513;">Log #' + (logs.length - idx) + ' (' + (log.date || 'Snapshot') + ')</span>' +
          '</div>' +
          '<div style="display:flex; justify-content:space-between; color:#2E7D32; font-weight:900; font-size:12px; border-bottom:1px dashed #D2B48C; padding-bottom:4px;">' +
            '<span>Tickets: +' + logTickets + ' | Cost: ' + formatSFL(logCost) + ' SFL</span>' +
            '<span style="background:#E8F5E9; padding:1px 6px; border-radius:4px; border:1px solid #A5D6A7;">' + logRatio + ' SFL / Ticket</span>' +
          '</div>' +
          '<div style="display:flex; flex-direction:column; gap:3px;">' + delivHtml + bountiesHtml + choresHtml + '</div>' +
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
  var earnedTicketsAll = 0;
  var pendingTicketsAll = 0;

  var totalSflCostAll = 0;
  var earnedSflCostAll = 0;
  var pendingSflCostAll = 0;

  // Deliveries
  var deliveriesContainer = document.getElementById('deliveriesList');
  document.getElementById('deliveriesCount').textContent = globalData.deliveries.length;
  deliveriesContainer.innerHTML = globalData.deliveries.map(function(d) {
    var deliveryAddon = d.isManual ? 0 : (vipBonus + boostCount);
    var finalTickets = d.baseTickets + deliveryAddon;
    var totalSflCost = d.itemsCost || 0;

    totalTicketsAll += finalTickets;
    totalSflCostAll += totalSflCost;

    if (d.completed) {
      earnedTicketsAll += finalTickets;
      earnedSflCostAll += totalSflCost;
    } else {
      pendingTicketsAll += finalTickets;
      pendingSflCostAll += totalSflCost;
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
        '<span style="font-weight:900; color:#8B4513; text-transform:capitalize; display:flex; align-items:center; gap:6px;">' +
          d.from +
          (d.isChapterNpc ? '<span style="font-size:9px; background:#FFB300; color:#3E2723; padding:1px 4px; font-weight:900; border-radius:4px;">CHAPTER</span>' : '') +
        '</span>' +
        '<div style="display:flex; align-items:center; gap:6px;">' +
          '<button class="btn btn-sm btn-indigo" onclick="openNpcHistoryModal(\'' + escapedName + '\')">📜 HISTORY</button>' +
          '<span class="' + badgeClass + '">' + (d.completed ? '✨ DONE' : '⏳ ACTIVE') + '</span>' +
        '</div>' +
      '</div>' +
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

  // Bounties
  var bountiesContainer = document.getElementById('bountiesList');
  document.getElementById('bountiesCount').textContent = globalData.bounties.length;
  bountiesContainer.innerHTML = globalData.bounties.map(function(b) {
    var finalTickets = b.baseTickets + boostCount;
    var totalSflCost = b.itemsCost || 0;

    totalTicketsAll += finalTickets;
    totalSflCostAll += totalSflCost;

    if (b.completed) {
      earnedTicketsAll += finalTickets;
      earnedSflCostAll += totalSflCost;
    } else {
      pendingTicketsAll += finalTickets;
      pendingSflCostAll += totalSflCost;
    }

    var costPerTicket = finalTickets > 0 ? (totalSflCost / finalTickets) : 0;
    var badgeClass = b.completed ? 'badge badge-done' : 'badge badge-active';

    return '<div class="card-item ' + (b.completed ? 'done' : 'active') + '">' +
      '<div style="display:flex; justify-content:space-between; align-items:center;">' +
        '<span style="font-weight:900; color:#3E2723; text-transform:capitalize;">' + b.name + (b.level ? ' <span style="font-size:10px; color:#B26A00;">(Lvl ' + b.level + ')</span>' : '') + '</span>' +
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

  // Chores
  var choresContainer = document.getElementById('choresList');
  document.getElementById('choresCount').textContent = globalData.chores.length;
  choresContainer.innerHTML = globalData.chores.map(function(c) {
    var finalTickets = c.baseTickets > 0 ? (c.baseTickets + boostCount) : 0;
    var hasProgress = c.requirement > 0;

    totalTicketsAll += finalTickets;

    if (c.completed) {
      earnedTicketsAll += finalTickets;
    } else {
      pendingTicketsAll += finalTickets;
    }

    var badgeClass = c.completed ? 'badge badge-done' : 'badge badge-active';

    return '<div class="card-item ' + (c.completed ? 'done' : 'active') + '">' +
      '<div style="display:flex; justify-content:space-between; align-items:center;">' +
        '<span style="font-weight:900; color:#3E2723; text-transform:capitalize;">' + c.npc + '</span>' +
        '<span class="' + badgeClass + '">' + (c.completed ? '✨ DONE' : '⏳ ACTIVE') + '</span>' +
      '</div>' +
      '<div style="color:#5C4033; font-weight:bold;">' + c.task + '</div>' +
      (hasProgress ? '<div style="font-size:11px; color:#8C7853; font-weight:bold;">Progress: ' + c.progress + ' / ' + c.requirement + '</div>' : '') +
      (c.baseTickets > 0 ? '<div style="background:#FFFACD; padding:6px 8px; border-radius:6px; border:1px solid #D2B48C; display:flex; justify-content:space-between; align-items:center; font-size:11px;"><span style="color:#8C7853; font-weight:bold;">Yield:</span><span style="color:#2E7D32; font-weight:900;">' + finalTickets + ' Tickets</span></div>' : '') +
    '</div>';
  }).join('');

  currentDoneTicketsToday = earnedTicketsAll;
  currentDoneCostToday = earnedSflCostAll;

  document.getElementById('statTotalTickets').textContent = totalTicketsAll;
  document.getElementById('statTotalCost').textContent = formatSFL(totalSflCostAll) + ' SFL';
  document.getElementById('statTotalRatio').textContent = (totalTicketsAll > 0 ? formatSFL(totalSflCostAll / totalTicketsAll) : "0.00") + ' SFL / Ticket';

  document.getElementById('statEarnedTickets').textContent = earnedTicketsAll;
  document.getElementById('statEarnedCost').textContent = formatSFL(earnedSflCostAll) + ' SFL';
  document.getElementById('statEarnedRatio').textContent = (earnedTicketsAll > 0 ? formatSFL(earnedSflCostAll / earnedTicketsAll) : "0.00") + ' SFL / Ticket';

  document.getElementById('statPendingTickets').textContent = pendingTicketsAll;
  document.getElementById('statPendingCost').textContent = formatSFL(pendingSflCostAll) + ' SFL';
  document.getElementById('statPendingRatio').textContent = (pendingTicketsAll > 0 ? formatSFL(pendingSflCostAll / pendingTicketsAll) : "0.00") + ' SFL / Ticket';

  var cloud = globalData.cloudHistory || { cumulativeTickets: 0, cumulativeCost: 0 };
  var cloudTickets = cloud.cumulativeTickets || 0;
  var cloudCost = cloud.cumulativeCost || 0;
  document.getElementById('statSavedTickets').textContent = cloudTickets;
  document.getElementById('statSavedCost').textContent = formatSFL(cloudCost) + ' SFL';
  document.getElementById('statSavedRatio').textContent = (cloudTickets > 0 ? formatSFL(cloudCost / cloudTickets) : "0.00") + ' SFL / Ticket';
}
