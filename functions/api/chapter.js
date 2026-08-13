// Base Chapter Ticket Table for Chapter NPCs
const CHAPTER_NPC_TICKETS = {
  "pumpkin' pete": 1,
  "bert": 2,
  "finley": 2,
  "raven": 4,
  "miranda": 2,
  "finn": 5,
  "pharaoh": 6,
  "cornwell": 3,
  "timmy": 5,
  "tywin": 10,
  "jester": 4
};

// Fallback SFL Base & Ingredient Prices (used when sfl.world market price is 0 or unavailable)
const FALLBACK_PRICES = {
  // Crops
  "sunflower": 0.0002, "potato": 0.001, "pumpkin": 0.005, "carrot": 0.008, "cabbage": 0.015,
  "beetroot": 0.02, "cauliflower": 0.035, "parsnip": 0.04, "radish": 0.05, "wheat": 0.03,
  "kale": 0.04, "corn": 0.01, "onion": 0.02, "soybean": 0.025, "yam": 0.03, "broccoli": 0.04,
  "artichoke": 0.05, "zucchini": 0.03, "pepper": 0.04, "rice": 0.08, "olive": 0.10,

  // Fruits
  "apple": 0.02, "orange": 0.03, "lemon": 0.04, "blueberry": 0.02, "banana": 0.05, "grape": 0.03,

  // Resources
  "wood": 0.005, "stone": 0.01, "iron": 0.05, "gold": 0.20, "crimstone": 0.30, "sunstone": 1.00,
  "sand": 0.02, "oil": 0.08, "egg": 0.02, "milk": 0.05, "wool": 0.08, "merino wool": 0.15,
  "feather": 0.03, "honey": 0.05, "leather": 0.10, "hieroglyph": 0.50, "acorn": 0.05,

  // Fish & Sea
  "crab": 0.10, "olive flounder": 0.12, "napoleanfish": 0.30, "sea slug": 0.25, "anchovy": 0.02,
  "mahi mahi": 0.15, "butterflyfish": 0.08, "sunfish": 0.12, "moray eel": 0.15, "angelfish": 0.20,
  "barnacle": 0.30, "lobster": 0.40, "red snapper": 0.15,

  // Tools & Items
  "axe": 0.02, "pickaxe": 0.03, "stone pickaxe": 0.05, "iron pickaxe": 0.15, "gold pickaxe": 0.50,
  "rod": 0.05, "sand drill": 0.25, "sand shovel": 0.03, "lunar doll": 0.80, "cluck doll": 0.30,
  "moo doll": 0.40, "wooly doll": 0.40, "gilded doll": 0.50,

  // Cooked Meals
  "pumpkin soup": 0.01, "bumpkin broth": 0.03, "popcorn": 0.09, "tofu scramble": 0.51,
  "eggplant cake": 0.85, "pizza margherita": 1.97, "apple juice": 0.10, "carrot juice": 0.06,
  "orange juice": 0.07, "bumpkin roast": 0.72, "reindeer carrot": 0.01, "sauerkraut": 0.04,
  "club sandwich": 0.80, "pancakes": 0.15, "mashed potato": 0.01, "rhubarb tart": 0.01,
  "cabbers n mash": 0.06, "fried tofu": 0.09, "fruit salad": 0.05, "purple smoothie": 0.10,
  "power smoothie": 0.27, "honey cake": 1.40, "steamed red rice": 1.06, "goblin's treat": 0.19,
  "bumpkin ganoush": 0.37, "antipasto": 1.13, "grape juice": 1.25, "slow juice": 4.11,
  "quick juice": 0.06, "caprese salad": 0.81, "blue cheese": 0.80, "sour shake": 0.17,
  "blueberry jam": 0.08, "fermented carrots": 0.04, "fancy fries": 0.30, "banana blast": 0.39,
  "the lot": 0.29, "bumpkin detox": 0.19
};

export async function onRequest(context) {
  const { searchParams } = new URL(context.request.url);
  const farmId = searchParams.get('farmId') || '8472883706403914';
  const apiKey = context.env.SFL_API_KEY || '';

  const browserHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  };

  const sflHeaders = { ...browserHeaders, 'Referer': 'https://sunflower-land.com/', 'Origin': 'https://sunflower-land.com' };
  if (apiKey.trim() !== '') sflHeaders['x-api-key'] = apiKey.trim();

  try {
    // Fetch SFL Farm + sfl.world market prices
    const [sflResponse, pricesResponse] = await Promise.all([
      fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, { headers: sflHeaders }),
      fetch(`https://sfl.world/api/v1/prices`, { headers: browserHeaders }).catch(() => null)
    ]);

    if (!sflResponse.ok) {
      return new Response(JSON.stringify({ error: `SFL API error: ${sflResponse.status}` }), { status: sflResponse.status });
    }

    const payload = await sflResponse.json();
    const farm = payload.farm || {};

    // Build Live Price Map
    let livePriceMap = {};
    if (pricesResponse && pricesResponse.ok) {
      const rawPrices = await pricesResponse.json().catch(() => ({}));
      const sourceObj = rawPrices.data || rawPrices.prices || rawPrices;

      if (Array.isArray(sourceObj)) {
        sourceObj.forEach(item => {
          if (item && item.name) {
            const p = item.price ?? item.sfl ?? item.value ?? 0;
            livePriceMap[item.name.toLowerCase().trim()] = Number(p) || 0;
          }
        });
      } else if (typeof sourceObj === 'object') {
        Object.entries(sourceObj).forEach(([key, val]) => {
          const cleanKey = key.toLowerCase().trim();
          if (typeof val === 'number') {
            livePriceMap[cleanKey] = val;
          } else if (val && typeof val === 'object') {
            const p = val.price ?? val.sfl ?? val.value ?? val.buy ?? 0;
            livePriceMap[cleanKey] = Number(p) || 0;
          }
        });
      }
    }

    // Resolver: Check live market price first, then fallback dictionary
    const getItemUnitPrice = (itemName) => {
      const cleanName = itemName.toLowerCase().trim();
      if (livePriceMap[cleanName] && livePriceMap[cleanName] > 0) {
        return livePriceMap[cleanName];
      }
      if (FALLBACK_PRICES[cleanName] && FALLBACK_PRICES[cleanName] > 0) {
        return FALLBACK_PRICES[cleanName];
      }
      return 0.01; // Minimum default floor
    };

    const calculateItemsCost = (items) => {
      let totalCost = 0;
      const details = [];

      Object.entries(items).forEach(([itemName, qty]) => {
        const unitPrice = getItemUnitPrice(itemName);
        const itemTotal = unitPrice * qty;
        totalCost += itemTotal;

        details.push({
          name: itemName,
          qty,
          unitPrice,
          totalPrice: itemTotal
        });
      });

      return { totalCost, details };
    };

    const isVipActive = !!(farm.vip?.expiresAt && farm.vip.expiresAt > Date.now());

    // 1. DELIVERIES
    const rawDeliveries = farm.delivery?.orders || [];
    const deliveryList = [];

    rawDeliveries.forEach(order => {
      const npcNameClean = (order.from || '').toLowerCase().trim();
      const baseTickets = CHAPTER_NPC_TICKETS[npcNameClean];

      let baseTicketCount = baseTickets !== undefined ? baseTickets : 0;

      if (order.reward?.items) {
        Object.entries(order.reward.items).forEach(([item, qty]) => {
          if (item === 'Shiny Feather' || item === 'Tickets') {
            baseTicketCount += qty;
          }
        });
      }

      if (baseTicketCount > 0) {
        const costData = calculateItemsCost(order.items || {});

        deliveryList.push({
          id: order.id,
          from: order.from,
          items: order.items || {},
          itemsCost: costData.totalCost,
          itemDetails: costData.details,
          baseTickets: baseTicketCount,
          isChapterNpc: baseTickets !== undefined
        });
      }
    });

    // 2. BOUNTIES
    const activeBounties = [];
    (farm.bounties?.requests || []).forEach(b => {
      let baseTicketCount = 0;
      if (b.items) {
        Object.entries(b.items).forEach(([item, qty]) => {
          if (item === 'Shiny Feather' || item === 'Tickets') {
            baseTicketCount += qty;
          }
        });
      }

      if (baseTicketCount > 0) {
        const targetItems = b.name ? { [b.name]: 1 } : {};
        const costData = calculateItemsCost(targetItems);

        activeBounties.push({
          id: b.id,
          name: b.name,
          level: b.level || null,
          baseTickets: baseTicketCount,
          itemsCost: costData.totalCost,
          itemDetails: costData.details
        });
      }
    });

    // 3. CHORES
    const rawChores = farm.choreBoard?.chores || {};
    const choresList = Object.entries(rawChores).map(([npc, details]) => {
      let baseTicketCount = 0;
      if (details.reward?.items) {
        Object.entries(details.reward.items).forEach(([item, qty]) => {
          if (item === 'Shiny Feather' || item === 'Tickets') {
            baseTicketCount += qty;
          }
        });
      }

      return {
        npc: npc,
        task: details.name,
        baseTickets: baseTicketCount,
        progress: details.initialProgress || 0,
        completed: !!details.completedAt
      };
    });

    return new Response(JSON.stringify({
      farmId,
      isVipActive,
      pricesLoadedCount: Object.keys(livePriceMap).length,
      deliveries: deliveryList,
      bounties: activeBounties,
      chores: choresList
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
