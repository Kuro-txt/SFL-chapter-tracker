var globalData = null;
var currentUser = null;
var currentVaultData = { logs: [], cumulativeTickets: 0, cumulativeCost: 0, deliveries: [], bounties: [], chores: [] };
var currentDoneTicketsToday = 0;
var currentDoneCostToday = 0;
var isFetchCooldown = false;

function formatSFL(val) {
  if (val === undefined || val === null || isNaN(val) || val === 0) return "0.00";
  if (val < 0.01) return val.toFixed(4);
  return val.toFixed(2);
}

window.addEventListener('DOMContentLoaded', function() {
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
  }
});

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

    if (currentVaultData.deliveries && currentVaultData.deliveries.length > 0) {
      var liveIds = new Set(globalData.deliveries.map(d => d.id));
      currentVaultData.deliveries.forEach(savedD => {
        if (!liveIds.has(savedD.id)) {
          globalData.deliveries.push(savedD);
        }
      });
    }

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

    alert('☁️ MASTER VAULT SAVED!\nSaved +' + currentDoneTicketsToday + ' Tickets (' + formatSFL(currentDoneCostToday) + ' SFL)');
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

  var vipBonus = document.getElementById('vipToggle').checked ? 2 : 0;
  var boostCount = 
    (document.getElementById('boost1').checked ? 1 : 0) +
    (document.getElementById('boost2').checked ? 1 : 0) +
    (document.getElementById('boost3').checked ? 1 : 0);

  var totalTicketsAll = 0;
  var earnedTicketsAll = 0;
  var pendingTicketsAll = 0;

  var totalSflCostAll = 0;
  var earnedSflCostAll = 0;
  var pendingSflCostAll = 0;

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

    return '<div class="card-item ' + (d.isManual ? 'manual' : (d.completed ? 'done' : 'active')) + '">' +
      '<div style="display:flex; justify-content:space-between; align-items:center;">' +
        '<span style="font-weight:900; color:#8B4513; text-transform:capitalize; display:flex; align-items:center; gap:6px;">' +
          d.from +
          (d.isManual ? '<span style="font-size:9px; background:#8E44AD; color:#FFF8DC; padding:1px 4px; font-weight:900; border-radius:4px;">MANUAL</span>' : '') +
          (d.isChapterNpc ? '<span style="font-size:9px; background:#FFB300; color:#3E2723; padding:1px 4px; font-weight:900; border-radius:4px;">CHAPTER</span>' : '') +
        '</span>' +
        '<div style="display:flex; align-items:center; gap:8px;">' +
          '<span class="' + badgeClass + '">' + (d.isManual ? '✍️ PAST' : (d.completed ? '✨ DONE' : '⏳ ACTIVE')) + '</span>' +
          '<span style="font-size:10px; color:#8C7853;">#' + d.id + '</span>' +
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
