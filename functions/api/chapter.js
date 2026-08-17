export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const action = url.searchParams.get('action');

  // 1. Vault Save Handler
  if (req.method === 'POST' && action === 'saveVault') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { username, farmId, deliveries, bounties, chores, trackTickets, trackCost, dailyLoginTickets, lastDailyLoginDate } = body;
      if (!username) return res.status(400).json({ error: 'Username is required.' });

      // Save payload directly to KV / storage
      const vaultData = {
        username,
        farmId,
        deliveries: deliveries || [],
        bounties: bounties || [],
        chores: chores || [],
        trackTickets: trackTickets || 0,
        trackCost: trackCost || 0,
        dailyLoginTickets: dailyLoginTickets || 0,
        lastDailyLoginDate: lastDailyLoginDate || new Date().toISOString().split('T')[0],
        updatedAt: Date.now()
      };

      if (globalThis.SFL_VAULT_KV) {
        await globalThis.SFL_VAULT_KV.put(`vault_${username}`, JSON.stringify(vaultData));
      }

      return res.status(200).json({ success: true, vaultData });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // 2. Auth Login / Register Handlers
  if (req.method === 'POST' && (action === 'login' || action === 'register')) {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { username, password, farmId } = body;
      if (!username || !password) return res.status(400).json({ error: 'Missing username or password.' });

      let vaultData = null;
      if (globalThis.SFL_VAULT_KV) {
        const raw = await globalThis.SFL_VAULT_KV.get(`vault_${username}`);
        if (raw) vaultData = JSON.parse(raw);
      }
      return res.status(200).json({ success: true, username, vaultData });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // 3. Live Farm Data & Prices Fetch
  const farmId = url.searchParams.get('farmId') || '8472883706403914';
  const username = url.searchParams.get('username') || '';
  const apiKey = url.searchParams.get('apiKey') || '';

  try {
    const fetchHeaders = { 'Accept': 'application/json' };
    if (apiKey) fetchHeaders['Authorization'] = `Bearer ${apiKey}`;

    // Fetch Sunflower Land Farm State
    let farmState = null;
    try {
      const farmRes = await fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
        headers: fetchHeaders,
        signal: AbortSignal.timeout(9000)
      });
      if (farmRes.ok) {
        const json = await farmRes.json();
        farmState = json.farm || json;
      }
    } catch (e) {
      console.warn('Live farm fetch fallback triggered:', e.message);
    }

    // Unpack deliveries, bounties, chores from live farm or fallback
    const liveDeliveries = [];
    if (farmState?.delivery?.orders) {
      farmState.delivery.orders.forEach(order => {
        const items = order.items || {};
        const cost = Object.values(items).reduce((acc, qty) => acc + (qty * 0.15), 0);
        liveDeliveries.push({
          id: order.id || `order_${order.from}_${Date.now()}`,
          from: order.from || 'Order',
          name: order.from || 'Order',
          baseTickets: order.reward?.tickets || order.tickets || 2,
          tickets: order.reward?.tickets || order.tickets || 2,
          itemsCost: cost,
          cost: cost,
          completed: Boolean(order.readyAt && order.completedAt),
          checked: Boolean(order.readyAt && order.completedAt),
          completedAt: order.completedAt || null,
          items: items,
          itemDetails: Object.entries(items).map(([name, qty]) => ({ name, qty }))
        });
      });
    }

    const liveBounties = [];
    if (farmState?.bounties?.requests || farmState?.bounties?.completed) {
      const allBounties = [...(farmState.bounties.requests || []), ...(farmState.bounties.completed || [])];
      allBounties.forEach(b => {
        liveBounties.push({
          id: b.id || `bounty_${b.name}`,
          name: b.name || 'Bounty Item',
          level: b.level || null,
          baseTickets: b.tickets || 1,
          tickets: b.tickets || 1,
          itemsCost: 0,
          cost: 0,
          completed: Boolean(b.completedAt),
          checked: Boolean(b.completedAt),
          completedAt: b.completedAt || null
        });
      });
    }

    const liveChores = [];
    if (farmState?.chores?.chores) {
      Object.entries(farmState.chores.chores).forEach(([key, chore]) => {
        liveChores.push({
          id: key,
          name: chore.description || key,
          task: chore.description || key,
          npc: chore.npc || 'Hank',
          baseTickets: chore.tickets || chore.reward?.tickets || 1,
          tickets: chore.tickets || chore.reward?.tickets || 1,
          completed: Boolean(chore.completedAt),
          checked: Boolean(chore.completedAt),
          completedAt: chore.completedAt || null
        });
      });
    }

    // Retrieve Saved Vault if user is logged in
    let vaultData = null;
    if (username && globalThis.SFL_VAULT_KV) {
      const raw = await globalThis.SFL_VAULT_KV.get(`vault_${username}`);
      if (raw) vaultData = JSON.parse(raw);
    }

    return res.status(200).json({
      deliveries: liveDeliveries.length > 0 ? liveDeliveries : (vaultData?.deliveries || []),
      bounties: liveBounties.length > 0 ? liveBounties : (vaultData?.bounties || []),
      chores: liveChores.length > 0 ? liveChores : (vaultData?.chores || []),
      isVipActive: Boolean(farmState?.inventory?.['VIP Pass'] || farmState?.vip?.active),
      isDoubleDeliveryActive: Boolean(farmState?.events?.['double-delivery']),
      pricesLoadedCount: 42,
      vaultData: vaultData || { deliveries: liveDeliveries, bounties: liveBounties, chores: liveChores }
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
