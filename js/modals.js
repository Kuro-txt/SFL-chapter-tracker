export async function toggleWeeklyItemCheck(weekId, itemIdx) {
  const type = state.activeColumnType;
  let targetItem = null;

  if (type === 'chore') {
    targetItem = state.globalData?.chores?.[itemIdx];
  } else {
    const isAnimal = type === 'animalBounty';
    const bounties = (state.globalData?.bounties || []).filter(b => {
      const animalCheck = isAnimalBounty(b);
      return isAnimal ? animalCheck : !animalCheck;
    });
    targetItem = bounties?.[itemIdx];
  }

  if (targetItem) {
    const newStatus = !(targetItem.checked !== undefined ? targetItem.checked : Boolean(targetItem.completed));
    targetItem.checked = newStatus;
    targetItem.completed = newStatus;
    
    // Automatically set current timestamp when ticked
    if (newStatus) {
      targetItem.completedAt = targetItem.completedAt || Date.now();
      targetItem.checkedToday = true;
    } else {
      targetItem.completedAt = null;
      targetItem.checkedToday = false;
    }

    if (!state.globalData.cloudHistory) state.globalData.cloudHistory = {};
    if (!state.globalData.cloudHistory.weeks) state.globalData.cloudHistory.weeks = {};
    if (!state.globalData.cloudHistory.weeks[weekId]) {
      state.globalData.cloudHistory.weeks[weekId] = { weekId, bounties: [], chores: [] };
    }
    state.globalData.cloudHistory.weeks[weekId].bounties = state.globalData.bounties || [];
    state.globalData.cloudHistory.weeks[weekId].chores = state.globalData.chores || [];

    renderColumnHistoryModalList();
    recalculateAll();
    await syncCurrentVaultToCloud();
  }
}
