// 4. Save Vault Endpoint
    if (req.method === 'POST' && action === 'saveVault') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const username = (body.username || '').toLowerCase().trim();
      if (!username) return res.status(401).json({ error: 'Not logged in.' });

      const client = await pool.connect();
      try {
        const queryRes = await client.query('SELECT vault_data FROM user_vaults WHERE username = $1', [username]);
        let existingData = queryRes.rows.length > 0 ? queryRes.rows[0].vault_data : {
          logs: [],
          cumulativeTickets: 0,
          cumulativeCost: 0,
          weeks: {},
          trackTickets: 0,
          trackCost: 0,
          dailyLoginTickets: 0,
          lastDailyLoginDate: null,
          milestones: {}
        };

        if (body.farmId) existingData.farmId = body.farmId;
        if (body.trackTickets !== undefined) existingData.trackTickets = parseInt(body.trackTickets, 10) || 0;
        if (body.trackCost !== undefined) existingData.trackCost = parseFloat(body.trackCost) || 0;
        if (body.dailyLoginTickets !== undefined) existingData.dailyLoginTickets = parseInt(body.dailyLoginTickets, 10) || 0;
        if (body.lastDailyLoginDate) existingData.lastDailyLoginDate = body.lastDailyLoginDate;
        if (body.cumulativeTickets !== undefined) existingData.cumulativeTickets = parseInt(body.cumulativeTickets, 10) || 0;
        if (body.cumulativeCost !== undefined) existingData.cumulativeCost = parseFloat(body.cumulativeCost) || 0;

        if (body.weeks && typeof body.weeks === 'object') existingData.weeks = body.weeks;
        if (body.deliveries) existingData.deliveries = body.deliveries;
        if (body.bounties) existingData.bounties = body.bounties;
        if (body.chores) existingData.chores = body.chores;
        if (body.milestones) existingData.milestones = body.milestones;
        if (body.logs && Array.isArray(body.logs)) existingData.logs = body.logs;

        await client.query('UPDATE user_vaults SET vault_data = $1 WHERE username = $2', [JSON.stringify(existingData), username]);
        return res.status(200).json({ success: true, vaultData: existingData });
      } finally {
        client.release();
      }
    }
