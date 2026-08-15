} else if (cat === 'chore') {
    titleEl.textContent = '🧹 CHORES OVERVIEW';
    const sortedChores = [...state.globalData.chores].sort((a, b) => {
      const aDone = a.checked !== undefined ? a.checked : Boolean(a.completed);
      const bDone = b.checked !== undefined ? b.checked : Boolean(b.completed);
      return aDone === bDone ? 0 : aDone ? 1 : -1;
    });

    bodyEl.innerHTML = sortedChores.map(c => {
      const isTicked = c.checked !== undefined ? c.checked : Boolean(c.completed);
      const finalTickets = c.baseTickets > 0 ? (c.baseTickets + vipBonus + boostCount) : 0;
      if (isTicked) {
        catTickets += finalTickets;
        catCost += (c.itemsCost || c.cost || 0);
      }
      return `<div style="background:#FFF8DC; border:2px solid #8B5A2B; padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:11px;">
        <div>
          <strong style="color:#3E2723;">🧹 ${(c.npc || 'NPC').toUpperCase()}</strong><br/>
          <span style="color:#5C4033; font-weight:bold;">${c.task || c.name}</span><br/>
          ${c.requirement > 0 ? '<span style="color:#8C7853;">Progress: ' + c.progress + ' / ' + c.requirement + '</span><br/>' : ''}
          <span style="color:#2E7D32; font-weight:900;">Yield: ${finalTickets} Tickets | ${formatSFL(c.itemsCost || c.cost || 0)} SFL</span>
        </div>
        <span class="badge ${isTicked ? 'badge-done' : 'badge-active'}">${isTicked ? '✨ DONE' : '⏳ ACTIVE'}</span>
      </div>`;
    }).join('');
  }
