export async function onRequest(context) {
  const { searchParams } = new URL(context.request.url);
  const farmId = searchParams.get('farmId') || '8472883706403914';
  const apiKey = context.env.SFL_API_KEY || '';

  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'CloudflarePagesWorker/1.0',
    'Referer': 'https://sunflower-land.com/',
    'Origin': 'https://sunflower-land.com'
  };

  if (apiKey.trim() !== '') {
    headers['x-api-key'] = apiKey.trim();
  }

  try {
    const sflResponse = await fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { headers });
    if (!sflResponse.ok) {
      return new Response(JSON.stringify({ error: `SFL API error: ${sflResponse.status}` }), { status: sflResponse.status });
    }

    const payload = await sflResponse.json();
    const farm = payload.farm || {};

    // 1. FILTER DELIVERIES
    const rawDeliveries = farm.delivery?.orders || [];
    const deliveryList = rawDeliveries.map(order => ({
      id: order.id,
      from: order.from,
      items: order.items || {},
      rewardCoins: order.reward?.coins || 0,
      rewardSFL: order.reward?.sfl || 0,
      rewardItems: order.reward?.items || {},
      readyAt: order.readyAt
    }));

    // 2. FILTER BOUNTIES
    const activeBounties = (farm.bounties?.requests || []).map(b => ({
      id: b.id,
      name: b.name,
      level: b.level || null,
      coins: b.coins || 0,
      rewards: b.items || {}
    }));

    // 3. FILTER CHORES
    const rawChores = farm.choreBoard?.chores || {};
    const choresList = Object.entries(rawChores).map(([npc, details]) => ({
      npc: npc,
      task: details.name,
      reward: details.reward?.items || {},
      progress: details.initialProgress || 0,
      completed: !!details.completedAt
    }));

    // 4. FILTER NPCs
    const rawNpcs = farm.npcs || {};
    const npcList = Object.entries(rawNpcs).map(([name, data]) => ({
      npc: name,
      friendshipPoints: data.friendship?.points || 0,
      deliveriesCompleted: data.deliveryCount || 0,
      deliveriesSkipped: data.skippedCount || 0,
      choresCompleted: data.choreCount || 0
    }));

    return new Response(JSON.stringify({
      farmId,
      deliveries: deliveryList,
      bounties: activeBounties,
      chores: choresList,
      npcs: npcList
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
