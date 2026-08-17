import { pool } from './db.js';
import { extractPricesRecursive, getMondayBasedWeekId, parseFarmData } from './sfl-parser.js';

export default async function handler(req, res) {
  // Verify Vercel cron secret authorization header for security
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized cron request.' });
  }

  const client = await pool.connect();
  let processedCount = 0;
  let errors = [];

  try {
    // Fetch all user vaults from the database
    const vaultsRes = await client.query('SELECT username, vault_data FROM user_vaults');
    
    // Fetch latest global SFL prices once for efficiency
    let priceMap = {};
    try {
      const pricesRes = await fetch('https://sfl.world/api/v1/prices', { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (pricesRes.ok) {
        const rawPricesData = await pricesRes.json();
        if (rawPricesData) priceMap = extractPricesRecursive(rawPricesData);
      }
    } catch (e) {
      console.error('Cron price fetch failed:', e.message);
    }

    const sflHeaders = {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://sunflower-land.com/',
      'Origin': 'https://sunflower-land.com'
    };
    if (process.env.SFL_API_KEY) sflHeaders['x-api-key'] = process.env.SFL_API_KEY;

    for (const row of vaultsRes.rows) {
      const username = row.username;
      const vault = row.vault_data || {};
      const farmId = vault.farmId || '8472883706403914';

      try {
        const sflRes = await fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { headers: sflHeaders });
        if (!sflRes.ok) continue;

        const payload = await sflRes.json();
        const farm = payload.farm || {};
        const parsed = parseFarmData(farm, priceMap);
        const currentWeekMonday = getMondayBasedWeekId();

        // 1. Archive completed deliveries
        if (!vault.archiveDeliveries) vault.archiveDeliveries = [];
        if (vault.deliveries) {
          vault.deliveries.forEach(d => {
            const isTicked = d.checked !== undefined ? d.checked : Boolean(d.completed);
            if (isTicked) {
              const exists = vault.archiveDeliveries.some(ar => ar.id === d.id && ar.completedDate === d.completedDate);
              if (!exists) vault.archiveDeliveries.push(d);
            }
          });
        }

        // 2. Refresh active items while preserving manual entries
        const existingManualDeliveries = (vault.deliveries || []).filter(d => d.isManual);
        vault.deliveries = [...parsed.deliveryList, ...existingManualDeliveries];

        const existingManualBounties = (vault.bounties || []).filter(b => b.isManual);
        vault.bounties = [...parsed.activeBounties, ...existingManualBounties];

        const existingManualChores = (vault.chores || []).filter(c => c.isManual);
        vault.chores = [...parsed.choresList, ...existingManualChores];

        vault.milestones = parsed.liveMilestones;

        // 3. Update weekly storage
        if (!vault.weeks) vault.weeks = {};
        if (!vault.weeks[currentWeekMonday]) {
          vault.weeks[currentWeekMonday] = {
            weekId: currentWeekMonday,
            bounties: vault.bounties,
            chores: vault.chores
          };
        }

        // 4. Update database vault
        await client.query('UPDATE user_vaults SET vault_data = $1 WHERE username = $2', [JSON.stringify(vault), username]);
        processedCount++;
      } catch (userErr) {
        errors.push({ username, error: userErr.message });
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: `Cron executed successfully at 23:00 UTC.`, 
      processedUsers: processedCount,
      errors: errors.length > 0 ? errors : undefined 
    });
  } catch (err) {
    return res.status(500).json({ error: `Cron Server Error: ${err.message}` });
  } finally {
    client.release();
  }
}
