// Helper for resolving Sunflower Land in-game item .webp icons

// Set of all 298 available item icon slugs in assets/items/
const AVAILABLE_SLUGS = new Set(["adirondack_potato","aged_anchovy","aged_blowfish","aged_butterflyfish","aged_clownfish","aged_halibut","aged_olive_flounder","aged_red_snapper","aged_sea_bass","aged_squid","aged_tuna","anchovy","anemone","angelfish","antipasto","apple","apple_juice","apple_pie","artichoke","axe","banana","banana_blast","barnacle","barred_knifejaw","bee_box","beetle_wing","beetroot","beetroot_blaze","beetroot_cake","black_magic","bloom_doll","blowfish","blue_balloon_flower","blue_carnation","blue_cheese","blue_clover","blue_cosmos","blue_crab","blue_daffodil","blue_edelweiss","blue_gladiolus","blue_lavender","blue_lotus","blue_marlin","blue_pansy","blueberry","blueberry_jam","boiled_eggs","broccoli","bumpkin_broth","bumpkin_detox","bumpkin_ganoush","bumpkin_roast","bumpkin_salad","butterflyfish","buzz_doll","cabbage","cabbage_cake","cabbers_n_mash","caprese_salad","carrot","carrot_cake","carrot_juice","cauliflower","cauliflower_burger","cauliflower_cake","celestial_frostbloom","celestine","cheese","chewed_bone","chiogga","clownfish","club_sandwich","cluck_doll","cobia","coelacanth","corn","cornbread","crab_pot","crab_stick","creamy_crab_bite","crimsteel","crimstone","crimstone_infused_fish_oil","crude_doll","cushion","dewberry","doll","duskberry","earthworm","egg","eggplant","eggplant_cake","ember_doll","fancy_fries","feather","fermented_carrots","fish_flake","fish_oil","fish_stick","football_fish","fried_tofu","fruit_salad","fruitful_blend","garden_eel","giant_apple","giant_banana","giant_orange","gilded_doll","gold","gold_pickaxe","golden_helios","grape","grape_juice","grub","grubby_doll","halibut","hammerhead_shark","hardened_leather","harvest_doll","heart_leaf","hermit_crab","honey","honey_cake","honey_cheddar","horse_mackerel","horseshoe_crab","iron","iron_pickaxe","isopod","juicy_doll","kale","kale_mushroom_pie","kale_omelette","kale_stew","leather","lemon","lobster","lumber_doll","lunar_doll","lunara","mahi_mahi","mariner_pot","mashed_potato","merino_cushion","merino_wool","milk","moo_doll","moonfur","moray_eel","mud","mushroom_jacket_potatoes","muskellunge","mussel","napoleanfish","oarfish","obsidian","octopus","oil","oil_drill","olive","olive_flounder","onion","orange","orange_cake","orange_juice","oyster","pancakes","parrotfish","parsnip","parsnip_cake","pepper","pickaxe","pickled_broccoli","pizza_margherita","popcorn","porgy","potato","potato_cake","power_smoothie","primula_enigma","prism_petal","pumpkin","pumpkin_cake","pumpkin_soup","purple_balloon_flower","purple_carnation","purple_cauliflower","purple_clover","purple_cosmos","purple_daffodil","purple_edelweiss","purple_gladiolus","purple_lavender","purple_lotus","purple_pansy","quick_juice","radish","radish_cake","rapid_roast","rapid_root","ray","red_balloon_flower","red_carnation","red_clover","red_cosmos","red_daffodil","red_edelweiss","red_gladiolus","red_lavender","red_lotus","red_pansy","red_snapper","red_wiggler","refined_salt","reindeer_carrot","rhubarb","rhubarb_tart","rice","rice_bun","roast_veggies","rock_blackfish","rod","salt","sand","sand_drill","sand_shovel","sauerkraut","saw_shark","sea_bass","sea_grapes","sea_horse","sea_slug","sea_snail","sea_urchin","shadow_doll","shiny_feather","shrimp","shroom_syrup","sizzle_doll","slow_juice","sour_shake","soybean","spaghetti_al_limone","sprout_mix","squid","steamed_red_rice","stone","stone_pickaxe","sunfish","sunflower","sunflower_cake","sunflower_crunch","sunstone","surgeonfish","surimi_rice_bowl","the_lot","tilapia","timber","tofu_scramble","tomato","trout","truffle","tuna","turbofruit_mix","turnip","walleye","warty_goblin_pumpkin","weakfish","whale_shark","wheat","wheat_cake","white_balloon_flower","white_carnation","white_carrot","white_clover","white_daffodil","white_edelweiss","white_gladiolus","white_lavender","white_lotus","white_pansy","white_shark","wild_grass","wood","wool","wooly_doll","yellow_balloon_flower","yellow_carnation","yellow_clover","yellow_cosmos","yellow_daffodil","yellow_edelweiss","yellow_gladiolus","yellow_lavender","yellow_lotus","yellow_pansy","zebra_turkeyfish"]);

const SLUG_ALIASES = {
  "crimsonstone": "crimstone",
  "spaghettti_al_limone": "spaghetti_al_limone",
  "power_smothie": "power_smoothie",
  "purple_smoothies": "purple_smoothie",
  "olive_founder": "olive_flounder",
  "chioggia": "chiogga"
};

export function getItemIconSlug(name) {
  if (!name) return '';
  const raw = name.toLowerCase().trim()
    .replace(/['"&]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return SLUG_ALIASES[raw] || raw;
}

export function getItemIconUrl(name) {
  const slug = getItemIconSlug(name);
  if (!slug || !AVAILABLE_SLUGS.has(slug)) return '';
  return `assets/items/${slug}.webp`;
}

/**
 * Renders an in-game item icon with bulletproof fallback to emoji.
 *
 * @param {string} name - Item name (e.g., 'Wood', 'Stone', 'Potato')
 * @param {string|number} fallbackEmoji - Emoji fallback if icon not found (or size if 2nd arg)
 * @param {number} size - Desired pixel size (e.g., 18 or 22)
 * @param {string} extraClass - Additional CSS class name
 * @returns {string} HTML string
 */
export function renderItemIcon(name, fallbackEmoji = '✨', size = 20, extraClass = '') {
  // Defensive argument shifting if called as (name, size, ...)
  if (typeof fallbackEmoji === 'number') {
    size = fallbackEmoji;
    fallbackEmoji = '✨';
  }

  const numSize = parseInt(size, 10) || 20;
  const safeFallback = typeof fallbackEmoji === 'string' ? fallbackEmoji : '✨';
  const url = getItemIconUrl(name);

  // If no icon file exists for this item, return the fallback emoji directly
  if (!url) {
    return safeFallback;
  }

  // Clean JS-safe fallback string for the onerror handler
  const escapedFallback = safeFallback.replace(/'/g, "\\'");

  return `<img src="${url}" alt="${name}" width="${numSize}" height="${numSize}" class="sfl-item-icon ${extraClass}" onerror="this.onerror=null;this.replaceWith(document.createTextNode('${escapedFallback}'));" style="width:${numSize}px; height:${numSize}px; object-fit:contain; image-rendering:pixelated; vertical-align:middle; display:inline-block;" loading="lazy" />`;
}
