async function deleteMasterLog(logIdx) {
  if (!globalData || !globalData.cloudHistory || !globalData.cloudHistory.logs) return;
  if (confirm('🗑️ Delete this snapshot log?')) {
    globalData.cloudHistory.logs.splice(logIdx, 1);
    
    // Recalculate cumulative totals locally
    var totalTix = 0;
    var totalCost = 0;
    globalData.cloudHistory.logs.forEach(l => {
      totalTix += (l.ticketsSaved || 0);
      totalCost += (l.costSaved || 0);
    });
    globalData.cloudHistory.cumulativeTickets = totalTix;
    globalData.cloudHistory.cumulativeCost = totalCost;

    // Push the updated logs to Cloud KV immediately if logged in
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
