import crypto from 'crypto';
import pkg from 'pg';
const { Pool } = pkg;

// Fallback pricing constants & helpers (self-contained to prevent import crashes)
const CHAPTER_NPC_TICKETS = {
  'pumpkin pete': 2,
  'blacksmith': 2,
  'betty': 2,
  'grimtooth': 2,
  'corny': 2,
  'tango': 2,
  'miranda': 2,
  'raven': 2,
  'finn': 2,
  'findlay': 2,
  'tyreless timmy': 2,
  'greg': 2,
  'cornwell': 2,
  'buttercup': 2,
  'bert': 2,
  'timmy': 2,
  'misty': 2,
  'phobos': 2,
  'jester': 2,
  'craig': 2,
  'peggy': 2,
  'flint': 2
};

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function extractRewardTickets(rewardObj) {
  if (!rewardObj) return 0;
  if (typeof rewardObj === 'number') return rewardObj;
  if (rewardObj.tickets !== undefined) return Number(rewardObj.tickets) || 0;
  if (rewardObj['Seasonal Ticket'] !== undefined) return Number(rewardObj['Seasonal Ticket']) || 0;
  if (rewardObj['Chapter Ticket'] !== undefined) return Number(rewardObj['Chapter Ticket']) || 0;
  if (rewardObj.items) {
    if (rewardObj.items['Seasonal Ticket']) return Number(rewardObj.items['Seasonal Ticket']) || 0;
    if (rewardObj.items['Chapter Ticket']) return Number(rewardObj.items['Chapter Ticket']) || 0;
  }
  return 0;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = req.query.action;
  const farmId = req.query.farmId || '8472883706403914';
  const apiKey = req.query.apiKey || process.env.SFL_API_KEY || '';

  try {
    // 1. Fetch User Vault
    if (action === 'getVault') {
      const username = (req.query.username || '').toLowerCase().trim();
      if (!username) return res.status(200).json({ vaultData: null });

      const client = await pool.connect();
      try {
        const queryRes = await client.query('SELECT vault_data FROM user_vaults WHERE username = $1', [username]);
        if (queryRes.rows.length > 0) {
          let vaultData = queryRes.rows[0].vault_data;
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

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required.' });
      }

      const client = await pool.connect();
      try {
        const check = await client.query('SELECT username FROM user_vaults WHERE username = $1', [username]);
        if (check.rows.length > 0) {
          return res.status(400).json({ error: 'Username already taken.' });
        }

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

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required.' });
      }

      const client = await pool.connect();
      try {
        const queryRes = await client.query('SELECT auth_data, vault_data FROM user_vaults WHERE username = $1', [username]);
        if (queryRes.rows.length === 0) {
          return res.status(401).json({ error: 'Account not found.' });
        }

        const authData = queryRes.rows[0].auth_data;
        if (authData.passwordHash !== hashPassword(password)) {
          return res.status(401).json({ error: 'Incorrect password.' });
        }

        let vaultData = queryRes.rows[0].vault_data;
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

    // 4. Save Vault
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
        if (body.trackTickets !== undefined) existingData.trackTickets = parseInt(body.trackTickets) || 0;
        if (body.trackCost !== undefined) existingData.trackCost = parseFloat(body.trackCost) || 0;
        if (body.dailyLoginTickets !== undefined) existingData.dailyLoginTickets = parseInt(body.dailyLoginTickets, 10) || 0;
        if (body.lastDailyLoginDate) existingData.lastDailyLoginDate = body.lastDailyLoginDate;
        if (body.weeks && typeof body.weeks === 'object') existingData.weeks = body.weeks;
        if (body.deliveries) existingData.deliveries = body.deliveries;
        if (body.bounties) existingData.bounties = body.bounties;
        if (body.chores) existingData.chores = body.chores;
        if (body.logs && Array.isArray(body.logs)) existingData.logs = body.logs;

        await client.query(
          'UPDATE user_vaults SET vault_data = $1 WHERE username = $2',
          [JSON.stringify(existingData), username]
        );

        return res.status(200).json({ success: true, vaultData: existingData });
      } finally {
        client.release();
      }
    }

    // 5. Default GET: Live Sunflower Land API Data Fetch
    const sflHeaders = {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://sunflower-land.com/',
      'Origin': 'https://sunflower-land.com'
    };
    if (apiKey && apiKey.trim() !== '') sflHeaders['x-api-key'] = apiKey.trim();

    const sflResponse = await fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { headers: sflHeaders }).catch(() => null);

    if (!sflResponse || !sflResponse.ok) {
      const status = sflResponse?.status || 500;
      return res.status(status).json({ error: status === 401 ? 'SFL API 401 Unauthorized.' : `SFL API error (${status}).` });
    }

    const payload = await sflResponse.json().catch(() => ({}));
    const farm = payload.farm || {};

    const isVipActive = !!(farm.vip?.expiresAt && farm.vip.expiresAt > Date.now());
    const deliveryList = [];
    (farm.delivery?.orders || []).forEach(order => {
      const npcClean = (order.from || '').toLowerCase().trim();
      let totalTickets = extractRewardTickets(order.reward) || extractRewardTickets(order.items);
      if (totalTickets === 0 && CHAPTER_NPC_TICKETS[npcClean] !== undefined) {
        totalTickets = CHAPTER_NPC_TICKETS[npcClean];
      }
      if (totalTickets > 0) {
        deliveryList.push({
          id: order.id,
          from: order.from,
          items: order.items || {},
          baseTickets: totalTickets,
          completed: Boolean(order.completedAt || order.completed),
          checked: Boolean(order.completedAt || order.completed)
        });
      }
    });

    return res.status(200).json({
      farmId,
      isVipActive,
      deliveries: deliveryList,
      bounties: [],
      chores: []
    });
  } catch (err) {
    return res.status(500).json({ error: `Server Error: ${err.message}` });
  }
}
