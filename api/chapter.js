import { hashPassword } from '../utils/auth-crypto.js';
import { 
  CHAPTER_NPC_TICKETS, 
  extractPricesRecursive, 
  getDirectMarketPrice, 
  getItemUnitPrice, 
  extractRewardTickets 
} from '../utils/sfl-pricing.js';
import { SFL_RECIPES } from '../../recipes.js';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const jsonRes = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
});

async function ensureTableExists() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_vaults (
        username TEXT PRIMARY KEY,
        auth_data JSONB,
        vault_data JSONB
      );
    `);
  } catch (err) {
    console.error('Table creation error:', err);
  }
}
ensureTableExists();

export async function GET(request) {
  try {
    return await handleRequest(request);
  } catch (err) {
    return jsonRes({ error: `Server Error: ${err.message}` }, 500);
  }
}

export async function POST(request) {
  try {
    return await handleRequest(request);
  } catch (err) {
    return jsonRes({ error: `Server Error: ${err.message}` }, 500);
  }
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const farmId = url.searchParams.get('farmId') || '8472883706403914';
  const apiKey = url.searchParams.get('apiKey') || process.env.SFL_API_KEY || '';

  if (action === 'getVault') {
    const username = (url.searchParams.get('username') || '').toLowerCase().trim();
    if (username) {
      const res = await pool.query('SELECT vault_data FROM user_vaults WHERE username = $1', [username]);
      if (res.rows.length > 0) {
        let vaultData = res.rows[0].vault_data;
        delete vaultData.apiKey;
        return jsonRes({ success: true, vaultData });
      }
    }
    return jsonRes({ vaultData: null });
  }

  if (request.method === 'POST' && action === 'register') {
    const body = await request.json().catch(() => ({}));
    const username = (body.username || '').toLowerCase().trim();
    const password = body.password || '';
    const userFarmId = body.farmId || farmId;

    if (!username || !password) return jsonRes({ error: 'Username and password required.' }, 400);

    const check = await pool.query('SELECT username FROM user_vaults WHERE username = $1', [username]);
    if (check.rows.length > 0) return jsonRes({ error: 'Username already taken.' }, 400);

    const passwordHash = await hashPassword(password);
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

    await pool.query(
      'INSERT INTO user_vaults (username, auth_data, vault_data) VALUES ($1, $2, $3)',
      [username, JSON.stringify({ username, passwordHash }), JSON.stringify(initialVault)]
    );

    return jsonRes({ success: true, username, farmId: userFarmId });
  }

  if (request.method === 'POST' && action === 'login') {
    const body = await request.json().catch(() => ({}));
    const username = (body.username || '').toLowerCase().trim();
    const password = body.password || '';
    const userFarmId = body.farmId;

    if (!username || !password) return jsonRes({ error: 'Username and password required.' }, 400);

    const res = await pool.query('SELECT auth_data, vault_data FROM user_vaults WHERE username = $1', [username]);
    if (res.rows.length === 0) return jsonRes({ error: 'Account not found.' }, 401);

    const authData = res.rows[0].auth_data;
    if (authData.passwordHash !== await hashPassword(password)) return jsonRes({ error: 'Incorrect password.' }, 401);

    let vaultData = res.rows[0].vault_data;
    if (userFarmId && !vaultData.farmId) {
      vaultData.farmId = userFarmId;
      await pool.query('UPDATE user_vaults SET vault_data = $1 WHERE username = $2', [JSON.stringify(vaultData), username]);
    }

    delete vaultData.apiKey;
    return jsonRes({ success: true, username, vaultData });
  }

  if (request.method === 'POST' && action === 'saveVault') {
    const body = await request.json().catch(() => ({}));
    const username = (body.username || '').toLowerCase().trim();
    if (!username) return jsonRes({ error: 'Not logged in.' }, 401);

    const res = await pool.query('SELECT vault_data FROM user_vaults WHERE username = $1', [username]);
    let existingData = res.rows.length > 0 ? res.rows[0].vault_data : {
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

    await pool.query(
      'UPDATE user_vaults SET vault_data = $1 WHERE username = $2',
      [JSON.stringify(existingData), username]
    );

    return jsonRes({ success: true, vaultData: existingData });
  }

  // Default GET: Fetch live data from Sunflower-Land API
  const sflHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://sunflower-land.com/',
    'Origin': 'https://sunflower-land.com'
  };
  if (apiKey && apiKey.trim() !== '') sflHeaders['x-api-key'] = apiKey.trim();

  const [sflResponse, pricesResponse] = await Promise.all([
    fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { headers: sflHeaders }).catch(() => ({ ok: false, status: 500 })),
    fetch(`https://sfl.world/api/v1/prices`, { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(() => null)
  ]);

  if (!sflResponse || !sflResponse.ok) {
    const status = sflResponse?.status || 500;
    throw new Error(status === 401 ? 'SFL API returned 401 Unauthorized.' : `SFL API error (${status}). Check Farm ID.`);
  }

  const payload = await sflResponse.json().catch(() => ({}));
  const farm = payload.farm || {};

  let priceMap = {};
  if (pricesResponse && pricesResponse.ok) {
    const rawPricesData = await pricesResponse.json().catch(() => null);
    if (rawPricesData) priceMap = extractPricesRecursive(rawPricesData);
  }

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

  return jsonRes({
    farmId,
    isVipActive,
    deliveries: deliveryList,
    bounties: [],
    chores: [],
    pricesLoadedCount: Object.keys(priceMap).length
  });
}
