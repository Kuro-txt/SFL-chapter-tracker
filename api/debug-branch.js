import { pool } from './db.js';
import { extractPricesRecursive, parseFarmData } from './sfl-parser.js';
import { getDeliveryRecords } from '../js/state.js'; // or backend parser logic equivalent

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const farmId = req.query.farmId || '8472883706403914';
  const apiKey = req.query.apiKey || process.env.SFL_API_KEY || '';
  const rawUsername = (req.query.username || '').trim();
  const username = rawUsername && rawUsername !== ':' ? rawUsername.toLowerCase().replace(/[^a-z0-9_]/g, '') : '';

  const sflHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://sunflower-land.com/',
    'Origin': 'https://sunflower-land.com'
  };
  if (apiKey && apiKey.trim() !== '') sflHeaders['x-api-key'] = apiKey.trim();

  let sflRawData = null;
  let sflStatus = 200;
  let pricesLoaded = 0;
  let dbVaultData = null;

  try {
    const [sflResponse, pricesResponse] = await Promise.all([
      fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { headers: sflHeaders }).catch(() => null),
      fetch(`https://sfl.world/api/v1/prices`, { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(() => null)
    ]);

    if (sflResponse) {
      sflStatus = sflResponse.status;
      sflRawData = await sflResponse.json().catch(() => ({}));
    }

    let priceMap = {};
    if (pricesResponse && pricesResponse.ok) {
      const rawPricesData = await pricesResponse.json().catch(() => null);
      if (rawPricesData) {
        priceMap = extractPricesRecursive(rawPricesData);
        pricesLoaded = Object.keys(priceMap).length;
      }
    }

    const farm = sflRawData?.farm || {};
    const parsed = parseFarmData(farm, priceMap);

    let client;
    if (username) {
      try {
        client = await pool.connect();
        const queryRes = await client.query('SELECT vault_data FROM user_vaults WHERE username = $1', [username]);
        if (queryRes.rows.length > 0) {
          dbVaultData = queryRes.rows[0].vault_data || {};
        }
      } catch (dbErr) {
        dbVaultData = { error: dbErr.message };
      } finally {
        if (client) client.release();
      }
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      queriedFarmId: farmId,
      queriedUsername: username || 'guest',
      sflApiHttpStatus: sflStatus,
      rawNpcs: farm.npcs || {},
      rawDeliveryOrders: farm.delivery?.orders || [],
      parsedDeliveries: parsed.deliveryList,
      parsedNpcsData: parsed.npcsData,
      databaseVault: dbVaultData,
      pricesLoadedCount: pricesLoaded
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack
    });
  }
}
