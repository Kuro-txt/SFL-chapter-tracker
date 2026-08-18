import { pool } from './db.js';
import { extractPricesRecursive, getMondayBasedWeekId, parseFarmData } from './sfl-parser.js';
import { reconcileDeliveriesWithNpcs } from './chapter.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized cron request.' });
  }

  const client = await pool.connect();
  let processedCount = 0;
  let errors = [];

  try {
    const vaultsRes = await client.query('SELECT username, vault_data FROM user_vaults');
    
    let priceMap = {};
    try {
      const pricesRes = await fetch('https://sfl.world/api/v1/prices', { 
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000)
      });
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

      let success = false;
      let lastError = null;
      const retryGaps = [4000, 6000];

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const sflRes = await fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { 
            headers: sflHeaders,
            signal: AbortSignal.timeout(9000)
          });
          
          if (!sflRes.ok) throw new Error(`SFL API error status: ${sflRes.status}`);

          const payload = await sflRes.json();
          const farm = payload.farm || {};
          const parsed = parseFarmData(farm, priceMap);
          const currentWeekMonday = getMondayBasedWeekId();

          // 1. Reconcile Deliveries with NPC Counts & Stacks
          reconcileDeliveriesWithNpcs(vault, parsed.deliveryList, parsed.npcsData);

          // 2. Archive Chores & Bounties
          if (!vault.weeks) vault.weeks = {};
          if (!vault.weeks[currentWeekMonday]) {
            vault.weeks[currentWeekMonday] = {
              weekId: currentWeekMonday,
              bounties: [],
              chores: []
            };
          }

          const existingManualChores = (vault.weeks[currentWeekMonday].chores || []).filter(c => c.isManual);
          const existingManualBounties = (vault.weeks[currentWeekMonday].bounties || []).filter(b => b.isManual);
          
          vault.weeks[currentWeekMonday].chores = [...parsed.choresList, ...existingManualChores];
          vault.weeks[currentWeekMonday].bounties = [...parsed.activeBounties, ...existingManualBounties];

          vault.bounties = [...parsed.activeBounties, ...existingManualBounties];
          vault.chores = [...parsed.choresList, ...existingManualChores];
          vault.milestones = parsed.liveMilestones;

          await client.query('UPDATE user_vaults SET vault_data = $1 WHERE username = $2', [JSON.stringify(vault), username]);
          
          success = true;
          processedCount++;
          break;
        } catch (attemptErr) {
          lastError = attemptErr.message;
          if (attempt < 1) await sleep(retryGaps[attempt]);
        }
      }

      if (!success) {
        errors.push({ username, farmId, error: lastError });
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
