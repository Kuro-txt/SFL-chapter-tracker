// Bounties Parser
    const activeBounties = [];
    const completedBountiesRaw = farm.bounties?.completed || farm.bounties?.claimed || [];
    
    // Map completed bounty IDs to their actual completedAt timestamps
    const completedMap = {};
    if (Array.isArray(completedBountiesRaw)) {
      completedBountiesRaw.forEach(b => {
        if (typeof b === 'object' && b.id) {
          completedMap[String(b.id)] = b.completedAt || b.claimedAt || Date.now();
        } else if (b) {
          completedMap[String(b)] = Date.now();
        }
      });
    }

    const rawBountyArray = Array.isArray(farm.bounties) ? farm.bounties : (farm.bounties?.requests || farm.bounties?.board || []);

    rawBountyArray.forEach(b => {
      let baseTicketCount = extractRewardTickets(b.reward) + extractRewardTickets(b.items);
      if (baseTicketCount === 0) baseTicketCount = b.tickets || b.reward?.tickets || 1;

      const unitPrice = b.name ? getItemUnitPrice(b.name, priceMap) : 0;
      const isCompleted = typeof b.completedAt === 'number' || b.completed === true || b.status === 'completed' || completedMap[String(b.id)] !== undefined;
      const completionTime = b.completedAt || b.claimedAt || completedMap[String(b.id)] || null;

      activeBounties.push({ 
        id: b.id, 
        name: b.name, 
        level: b.level || null, 
        baseTickets: baseTicketCount, 
        itemsCost: unitPrice, 
        completed: isCompleted,
        completedAt: completionTime
      });
    });
