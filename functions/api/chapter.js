// Inside bounties loop in functions/api/chapter.js:
      const isCompleted = typeof b.completedAt === 'number' || b.completed === true || b.status === 'completed' || completedMap[String(b.id)] !== undefined;
      
      let completionTime = null;
      if (typeof b.completedAt === 'number') {
        completionTime = b.completedAt;
      } else if (typeof b.claimedAt === 'number') {
        completionTime = b.claimedAt;
      } else if (completedMap[String(b.id)] !== undefined && completedMap[String(b.id)] !== null) {
        completionTime = completedMap[String(b.id)];
      } else if (isCompleted) {
        // Fallback: If completed on active board without timestamp, stamp with current time
        completionTime = Date.now();
      }

      activeBounties.push({ 
        id: b.id || uniqueKey, 
        name: b.name, 
        level: b.level || null, 
        baseTickets: baseTicketCount, 
        itemsCost: unitPrice, 
        completed: isCompleted,
        checked: isCompleted,
        completedAt: completionTime,
        completedToday: isCompleted
      });
