import { pool, hashPassword } from './db.js';
import { 
  extractPricesRecursive, 
  getMondayBasedWeekId, 
  parseFarmData 
} from './sfl-parser.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;
  const farmId = req.query.farmId || '8472883706403914';
  const apiKey = req.query.apiKey || process.env.SFL_API_KEY || '';

  try {
    // 1. Get User Vault
    if (action === 'getVault') {
      const username = (req.query.username || '').toLowerCase().trim();
      if (!username) return res.status(200).json({ vaultData: null });

      const client = await pool.connect();
      try {
        const queryRes = await client.query('SELECT vault_data FROM user_vaults WHERE username = $1', [username]);
        if (queryRes.rows.length > 0) {
          const vaultData = queryRes.rows[0].vault_data;
          delete vaultData.apiKey;
          return res.status(200).json({ success: true, vaultData });
        }
        return res.status(200).json({ vaultData: null });
      } finally {
        client.release();
      }
    }

    // 2. User Registration
    if (req.method === 'POST' && action === 'register') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const username = (body.username || '').toLowerCase().trim();
      const password = body.password || '';
      const userFarmId = body.farmId || farmId;

      if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

      const client = await pool.connect();
      try {
        const check = await client.query('SELECT username FROM user_vaults WHERE username = $1', [username]);
        if (check.rows.length > 0) return res.status(400).json({ error: 'Username already taken.' });

        const passwordHash = hashPassword(password);
        const initialVault = {
          farmId: userFarmId,
          logs: [],
          cumulativeTickets: 0,
          cumulativeCost: 0,
          weeks: {},
          trackTickets: 0,
          trackCost: 0,
          dailyLoginTickets: 0,
          lastDailyLoginDate: null,
          deliveries: [],
          bounties: [],
          chores: [],
          milestones: {}
        };

        await client.query(
          'INSERT INTO user_vaults (username, auth_data, vault_data) VALUES ($1, $2, $3)',
          [username, JSON.stringify({ username, passwordHash }), JSON.stringify(initialVault)]
        );

        return res.status(200).json({ success: true, username, farmId: userFarmId });
      } finally {
        client.release();
      }
    }

    // 3. User Login
    if (req.method === 'POST' && action === 'login') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const username = (body.username || '').toLowerCase().trim();
      const password = body.password || '';
      const userFarmId = body.farmId;

      if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

      const client = await pool.connect();
      try {
        const queryRes = await client.query('SELECT auth_data, vault_data FROM user_vaults WHERE username = $1', [username]);
        if (queryRes.rows.length === 0) return res.status(401).json({ error: 'Account not found.' });

        const authData = queryRes.rows[0].auth_data;
        if (authData.passwordHash !== hashPassword(password)) return res.status(401).json({ error: 'Incorrect password.' });

        const vaultData = queryRes.rows[0].vault_data;
        if (userFarmId && !vaultData.farmId) {
          vaultData.farmId = userFarmId;
          await client.query('UPDATE user_vaults SET vault_data = $1 WHERE username = $2', [JSON.stringify(vaultData), username]);
        }

        delete vaultData.apiKey;
        return res.status(200).json({ success: true, username, vaultData });
      } finally {
        client.release();
      }
    }

    // 4. Dedicated Delete Log Endpoint (Prevents Re-creation)
    if (req.method === 'POST' && action === 'deleteLog') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const username = (body.username || '').toLowerCase().trim();
      const logIdx = parseInt(body.logIdx, 10);

      if (!username || isNaN(logIdx)) return res.status(400).json({ error: 'Username and valid logIdx required.' });

      const client = await pool.connect();
      try {
        const queryRes = await client.query('SELECT vault_data FROM user_vaults WHERE username = $1', [username]);
        if (queryRes.rows.length === 0) return res.status(404).json({ error: 'Vault not found.' });

        let vaultData = queryRes.rows[0].vault_data || {};
        if (vaultData.logs && Array.isArray(vaultData.logs)) {
          vaultData.logs.splice(logIdx, 1);
        }

        await client.query('UPDATE user_vaults SET vault_data = $1 WHERE username = $2', [JSON.stringify(vaultData), username]);
        return res.status(200).json({ success: true, vaultData });
      } finally {
        client.release();
      }
    }

    // 5. Save Vault Endpoint
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

        // Persist Logs Array directly without forced re-insertion
        if (body.logs && Array.isArray(body.logs)) {
          existingData.logs = body.logs;
        }

        await client.query('UPDATE user_vaults SET vault_data = $1 WHERE username = $2', [JSON.stringify(existingData), username]);
        return res.status(200).json({ success: true, vaultData: existingData });
      } finally {
        client.release();
      }
    }

    // 6. Default GET: Live Sunflower Land API Data Fetch
    const sflHeaders = {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://sunflower-land.com/',
      'Origin': 'https://sunflower-land.com'
    };
    if (apiKey && apiKey.trim() !== '') sflHeaders['x-api-key'] = apiKey.trim();

    const [sflResponse, pricesResponse] = await Promise.all([
      fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { headers: sflHeaders }).catch(() => null),
      fetch(`https://sfl.world/api/v1/prices`, { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(() => null)
    ]);

    if (!sflResponse || !sflResponse.ok) {
      const status = sflResponse?.status || 500;
      return res.status(status).json({ error: status === 401 ? 'SFL API 401 Unauthorized.' : `SFL API error (${status}). Check Farm ID.` });
    }

    const payload = await sflResponse.json().catch(() => ({}));
    const farm = payload.farm || {};

    let priceMap = {};
    if (pricesResponse && pricesResponse.ok) {
      const rawPricesData = await pricesResponse.json().catch(() => null);
      if (rawPricesData) priceMap = extractPricesRecursive(rawPricesData);
    }

    const parsed = parseFarmData(farm, priceMap);
    const usernameParam = (req.query.username || '').toLowerCase().trim();
    let currentVault = null;

    if (usernameParam) {
      const client = await pool.connect();
      try {
        const queryRes = await client.query('SELECT vault_data FROM user_vaults WHERE username = $1', [usernameParam]);
        if (queryRes.rows.length > 0) {
          currentVault = queryRes.rows[0].vault_data || {};
          const currentWeekMonday = getMondayBasedWeekId();

          currentVault.farmId = farmId;

          // Preserve manual items
          const existingManualDeliveries = (currentVault.deliveries || []).filter(d => d.isManual);
          currentVault.deliveries = [...parsed.deliveryList, ...existingManualDeliveries];

          const existingManualBounties = (currentVault.bounties || []).filter(b => b.isManual);
          currentVault.bounties = [...parsed.activeBounties, ...existingManualBounties];

          const existingManualChores = (currentVault.chores || []).filter(c => c.isManual);
          currentVault.chores = [...parsed.choresList, ...existingManualChores];

          currentVault.milestones = parsed.liveMilestones;

          if (!currentVault.weeks) currentVault.weeks = {};
          if (!currentVault.weeks[currentWeekMonday]) {
            currentVault.weeks[currentWeekMonday] = {
              weekId: currentWeekMonday,
              bounties: currentVault.bounties,
              chores: currentVault.chores
            };
          } else {
            const savedWeekManualChores = (currentVault.weeks[currentWeekMonday].chores || []).filter(c => c.isManual);
            const savedWeekManualBounties = (currentVault.weeks[currentWeekMonday].bounties || []).filter(b => b.isManual);
            currentVault.weeks[currentWeekMonday].chores = [...parsed.choresList, ...savedWeekManualChores];
            currentVault.weeks[currentWeekMonday].bounties = [...parsed.activeBounties, ...savedWeekManualBounties];
          }

          if (!currentVault.logs) currentVault.logs = [];

          // NOTE: We do NOT auto-create a daily log on GET requests, preserving your manual deletions!
          await client.query('UPDATE user_vaults SET vault_data = $1 WHERE username = $2', [JSON.stringify(currentVault), usernameParam]);
        }
      } finally {
        client.release();
      }
    }

    return res.status(200).json({
      farmId,
      isVipActive: parsed.isVipActive,
      isDoubleDeliveryActive: parsed.isDoubleDeliveryActive,
      milestones: parsed.liveMilestones,
      pricesLoadedCount: Object.keys(priceMap).length,
      deliveries: currentVault ? currentVault.deliveries : parsed.deliveryList,
      bounties: currentVault ? currentVault.bounties : parsed.activeBounties,
      chores: currentVault ? currentVault.chores : parsed.choresList,
      vaultData: currentVault
    });
  } catch (err) {
    return res.status(500).json({ error: `Server Error: ${err.message}` });
  }
}
