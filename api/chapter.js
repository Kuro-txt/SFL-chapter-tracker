// Enhanced Bounties & Animal Bounties Parser
    const activeBounties = [];
    const seenBountyKeys = new Set();
    
    // Extract completed map
    const completedBountiesRaw = farm.bounties?.completed || farm.bounties?.claimed || [];
    const completedMap = {};
    if (Array.isArray(completedBountiesRaw)) {
      completedBountiesRaw.forEach(b => {
        if (typeof b === 'object' && b.id) {
          const t = typeof b.completedAt === 'number' ? b.completedAt : (typeof b.claimedAt === 'number' ? b.claimedAt : null);
          completedMap[String(b.id)] = t;
        } else if (b) {
          completedMap[String(b)] = null;
        }
      });
    }

    // Collect all possible bounty sources from Sunflower Land API
    const rawBountySources = [
      farm.bounties?.requests,
      farm.bounties?.board,
      farm.bounties?.active,
      farm.bounties,
      farm.seasonBounties,
      farm.flowerBounties,
      farm.animalBounties
    ];

    rawBountySources.forEach(source => {
      if (!source) return;
      const items = Array.isArray(source) ? source : (typeof source === 'object' ? Object.values(source) : []);
      
      items.forEach(b => {
        if (!b || typeof b !== 'object') return;
        
        // Find bounty name / item
        const bName = b.name || b.item || b.itemName || (b.items && Object.keys(b.items)[0]) || '';
        if (!bName && !b.id && !b.level) return;

        let baseTicketCount = 0;
        if (b.reward) baseTicketCount = extractRewardTickets(b.reward);
        if (baseTicketCount === 0 && b.items) baseTicketCount = extractRewardTickets(b.items);
        if (baseTicketCount === 0 && typeof b.tickets === 'number') baseTicketCount = b.tickets;
        if (baseTicketCount === 0 && typeof b.coins === 'number' && b.coins > 0) baseTicketCount = 2; // Default fallback for seasonal bounties
        if (baseTicketCount === 0 && b.level !== undefined) baseTicketCount = 5; // Default for animal bounties
        if (baseTicketCount === 0) baseTicketCount = 2; // Standard base tickets

        const uniqueKey = b.id ? String(b.id) : `${(bName || 'bounty').toLowerCase()}_${b.level || 0}`;
        if (seenBountyKeys.has(uniqueKey)) return;
        seenBountyKeys.add(uniqueKey);

        const unitPrice = bName ? getItemUnitPrice(bName, priceMap) : 0;
        const isCompleted = typeof b.completedAt === 'number' || b.completed === true || b.status === 'completed' || completedMap[String(b.id)] !== undefined;

        let completionTime = null;
        if (typeof b.completedAt === 'number') {
          completionTime = b.completedAt;
        } else if (typeof b.claimedAt === 'number') {
          completionTime = b.claimedAt;
        } else if (completedMap[String(b.id)] !== undefined && completedMap[String(b.id)] !== null) {
          completionTime = completedMap[String(b.id)];
        }

        activeBounties.push({
          id: b.id || uniqueKey,
          name: bName || `Animal Bounty (Lvl ${b.level || 1})`,
          level: b.level || (b.category === 'animal' ? 1 : null),
          baseTickets: baseTicketCount,
          tickets: baseTicketCount,
          cost: unitPrice,
          itemsCost: unitPrice,
          completed: isCompleted,
          checked: isCompleted,
          completedAt: completionTime,
          checkedToday: false
        });
      });
    });
