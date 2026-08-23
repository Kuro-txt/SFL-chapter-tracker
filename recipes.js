// Complete Sunflower Land Recipe & Crafting Map
// Maps cooked/crafted items to required base ingredients and coins (1,000 Coins = 1 SFL)

export const SFL_RECIPES = {
  // ==========================================
  // UTENSILS & TOOLS
  // ==========================================
  "axe": { "coins": 20 },
  "crab pot": { "feather": 5, "wool": 3, "coins": 250 },
  "mariner pot": { "feather": 10, "merino wool": 10, "coins": 500 },
  "rod": { "wood": 3, "stone": 1, "coins": 20 },
  "pickaxe": { "wood": 3, "coins": 16 },
  "stone pickaxe": { "wood": 3, "stone": 5, "coins": 16 },
  "iron pickaxe": { "wood": 3, "iron": 5, "coins": 64 },
  "gold pickaxe": { "wood": 3, "gold": 3, "coins": 80 },
  "sand drill": { "oil /1": 1, "crimstone": 1, "wood": 3, "leather": 1 },
  "sand shovel": { "wood": 2, "stone": 1 },
  "oil drill": { "wood": 20, "leather": 10, "iron": 9 },
  "oil 50/3 harvest": { "wood": 20, "iron": 9, "leather": 10, "coins": 100 },
  "oil /1": { "oil 50/3 harvest": 0.06 },

  // ==========================================
  // CRAFTING BOX & MATERIALS
  // ==========================================
  "synthetic fibre": { "wool": 3, "oil /1": 6 },
  "timber": { "wood": 90 },
  "bee box": { "honey": 8 },
  "crimsteel": { "crimstone": 3, "iron": 3 },
  "cushion": { "feather": 9 },
  "doll": { "leather": 4, "wool": 5 },
  "hardened leather": { "leather": 9 },
  "merino cushion": { "merino wool": 9 },

  // ==========================================
  // PANSIES & COSMOS
  // ==========================================
  "yellow pansy": { "sunflower": 50, "coins": 16 },
  "white pansy": { "yellow pansy": 1, "coins": 16 },
  "purple cosmos": { "beetroot": 10, "coins": 16 },
  "blue cosmos": { "cauliflower": 5, "coins": 16 },
  "red pansy": { "radish": 5, "coins": 16 },
  "red cosmos": { "red pansy": 1, "coins": 16 },

  // ==========================================
  // LOTUS & CARNATIONS
  // ==========================================
  "yellow carnation": { "sunflower": 50, "coins": 48 },
  "red lotus": { "beetroot": 10, "coins": 48 },
  "white lotus": { "cauliflower": 5, "coins": 48 },
  "purple carnation": { "eggplant": 5, "coins": 48 },
  "purple lotus": { "blue carnation": 1, "coins": 48 },
  "blue lotus": { "blue pansy": 1, "coins": 48 },
  "primula enigma": { "purple balloon flower": 1, "coins": 48 },
  "blue carnation": { "purple daffodil": 1, "coins": 48 },
  "red carnation": { "purple pansy": 1, "coins": 48 },
  "yellow lotus": { "red pansy": 1, "coins": 48 },
  "white carnation": { "yellow pansy": 1, "coins": 48 },

  // ==========================================
  // LAVENDER FLOWERS
  // ==========================================
  "white lavender": { "rhubarb": 25, "coins": 96 },
  "red lavender": { "pepper": 15, "coins": 96 },
  "blue lavender": { "blue clover": 1, "coins": 96 },
  "purple lavender": { "purple gladiolus": 1, "coins": 96 },
  "yellow lavender": { "yellow gladiolus": 1, "coins": 96 },

  // ==========================================
  // GLADIOLUS FLOWERS
  // ==========================================
  "blue gladiolus": { "rhubarb": 30, "coins": 96 },
  "yellow gladiolus": { "pepper": 5, "coins": 96 },
  "purple gladiolus": { "artichoke": 5, "coins": 96 },
  "white gladiolus": { "white edelweiss": 1, "coins": 96 },
  "red gladiolus": { "yellow gladiolus": 1, "coins": 96 },

  // ==========================================
  // EDELWEISS FLOWERS
  // ==========================================
  "purple edelweiss": { "rhubarb": 30, "coins": 96 },
  "red edelweiss": { "artichoke": 5, "coins": 96 },
  "yellow edelweiss": { "onion": 5, "coins": 96 },
  "white edelweiss": { "blue edelweiss": 1, "coins": 96 },
  "blue edelweiss": { "purple edelweiss": 1, "coins": 96 },

  // ==========================================
  // CLOVER FLOWERS
  // ==========================================
  "blue clover": { "rhubarb": 30, "coins": 96 },
  "yellow clover": { "pepper": 5, "coins": 96 },
  "white clover": { "blue edelweiss": 1, "coins": 96 },
  "red clover": { "red edelweiss": 1, "coins": 96 },
  "purple clover": { "red lavender": 1, "coins": 96 },

  // ==========================================
  // DAFFODIL & BALLOON FLOWERS
  // ==========================================
  "red balloon flower": { "sunflower": 50, "coins": 32 },
  "blue balloon flower": { "cauliflower": 5, "coins": 32 },
  "purple daffodil": { "radish": 5, "coins": 32 },
  "purple balloon flower": { "blue carnation": 1, "coins": 32 },
  "blue daffodil": { "purple carnation": 1, "coins": 32 },
  "white balloon flower": { "white daffodil": 1, "coins": 32 },
  "yellow daffodil": { "white lotus": 1, "coins": 32 },
  "celestial frostbloom": { "white pansy": 1, "coins": 32 },
  "white daffodil": { "yellow cosmos": 1, "coins": 32 },
  "yellow balloon flower": { "yellow lotus": 1, "coins": 32 },
  "red daffodil": { "yellow pansy": 1, "coins": 32 },

// ==========================================
  // EXOTICS, MUTANTS & GIANT FRUITS
  // ==========================================
  "purple cauliflower": { "coins": 7040 },
  "adirondack potato": { "coins": 6400 },
  "chiogga": { "coins": 19200 },
  "chioggia": { "coins": 19200 }, // alias to prevent delivery name mismatches
  "black magic": { "coins": 52000 },
  "warty goblin pumpkin": { "coins": 4000 },
  "white carrot": { "coins": 3200 },
  "golden helios": { "coins": 45000 },
  "giant orange": { "coins": 500 },
  "giant banana": { "coins": 4000 },
  "giant apple": { "coins": 1500 },
  // ==========================================
  // CRUSTACEA & FISH
  // ==========================================
  "blue crab": { "heart leaf": 3, "crab pot": 1 },
  "lobster": { "wild grass": 3, "crab pot": 1 },
  "hermit crab": { "grape": 5, "crab pot": 1 },
  "shrimp": { "crimstone": 2, "crab pot": 1 },
  "mussel": { "moonfur": 1, "crab pot": 1 },
  "isopod": { "crab pot": 1 },
  "sea slug": { "mariner pot": 1, "crimstone": 2 },
  "sea snail": { "mariner pot": 1, "chewed bone": 3 },
  "garden eel": { "mariner pot": 1, "dewberry": 3 },
  "sea grapes": { "mariner pot": 1, "lunara": 3 },
  "octopus": { "mariner pot": 1, "moonfur": 1 },
  "barnacle": { "mariner pot": 1 },
  
  "oyster": { "fish stick": 2, "crab pot": 1 },
  "anemone": { "crab pot": 1, "fish oil": 2 },
  "sea urchin": { "mariner pot": 1, "fish stick": 2 },
  "horseshoe crab": { "mariner pot": 1, "crab stick": 2 },

  "red snapper": { "rod": 1, "apple": 3 },
  "olive founder": { "rod": 1 },
  "anchovy": { "rod": 1, "carrot": 1 },
  "butterflyfish": { "rod": 1 },
  "halibut": { "rod": 1 },
  "blowfish": { "rod": 1 },
  "porgy": { "rod": 1 },
  "clownfish": { "rod": 1 },
  "sea bass": { "rod": 1, "sunflower": 5 },
  "sea horse": { "rod": 1 },
  "muskellunge": { "rod": 1 },
  "mackerel": { "rod": 1 },
  "squid": { "rod": 1 },
  "moray eel": { "rod": 1 },
  "tilapia": { "rod": 1 },
  "napoleanfish": { "rod": 1 },
  "surgeonfish": { "rod": 1 },
  "zebra turkeyfish": { "rod": 1 },
  "walleye": { "rod": 1 },
  "angelfish": { "rod": 1 },
  "ray": { "rod": 1 },
  "rock blackfish": { "rod": 1 },
  "hammerhead shark": { "rod": 1 },
  "tuna": { "rod": 1, "orange": 3 },
  "mahi mahi": { "rod": 1 },
  "blue marlin": { "rod": 1 },
  "weakfish": { "rod": 1 },
  "oarfish": { "rod": 1 },
  "football fish": { "rod": 1 },
  "sunfish": { "rod": 1 },
  "cobia": { "rod": 1 },
  "barred knifejaw": { "rod": 1 },
  "trout": { "rod": 1 },
  "coelacanth": { "rod": 1 },
  "saw shark": { "rod": 1 },
  "whale shark": { "rod": 1 },
  "white shark": { "rod": 1 },
  "parrotfish": { "rod": 1 },
  "horse mackerel": { "rod": 1, "blueberry": 3 },
  "treasurecrab": { "rod": 1 },

  // ==========================================
  // UNIFIED FISH CHUM & ESSENCE
  // ==========================================
  "fish stick": { "red snapper": 6, "olive founder": 2, "zebra turkeyfish": 2 },
  "crab stick": { "shrimp": 1, "barnacle": 1, "lobster": 1 },
  "fish oil": { "tuna": 8, "weakfish": 2, "oarfish": 2 },
  "fish flake": { "anchovy": 4, "porgy": 2, "sea bass": 2 },

  // ==========================================
  // COOKED FOODS & DELI
  // ==========================================
  "apple pie": { "apple": 5, "wheat": 10, "egg": 2 },
  "beetroot cake": { "beetroot": 100, "wheat": 10, "egg": 3 },
  "cabbage cake": { "cabbage": 90, "wheat": 10, "egg": 3 },
  "carrot cake": { "carrot": 120, "wheat": 10, "egg": 3 },
  "cauliflower cake": { "cauliflower": 60, "wheat": 10, "egg": 3 },
  "cornbread": { "wheat": 5, "corn": 15, "egg": 1 },
  "eggplant cake": { "eggplant": 30, "wheat": 10, "egg": 3 },
  "honey cake": { "honey": 10, "wheat": 10, "egg": 2 },
  "lemon cheese cake": { "lemon": 20, "cheese": 5, "egg": 4 },
  "orange cake": { "orange": 5, "wheat": 10, "egg": 3 },
  "parsnip cake": { "parsnip": 45, "wheat": 10, "egg": 3 },
  "potato cake": { "potato": 500, "wheat": 10, "egg": 3 },
  "pumpkin cake": { "pumpkin": 130, "wheat": 10, "egg": 3 },
  "radish cake": { "radish": 25, "wheat": 10, "egg": 3 },
  "sunflower cake": { "sunflower": 1000, "wheat": 10, "egg": 3 },
  "wheat cake": { "wheat": 35, "egg": 3 },
  "kale & mushroom pie": { "wheat": 5, "kale": 5 },

  "blue cheese": { "cheese": 20, "blueberry": 10 },
  "blueberry jam": { "blueberry": 50 },
  "cheese": { "milk": 3 },
  "fancy fries": { "sunflower": 500, "potato": 500 },
  "fermented carrots": { "carrot": 200 },
  "honey cheddar": { "cheese": 30, "honey": 5 },
  "sauerkraut": { "cabbage": 200 },
  "shroom syrup": { "honey": 20 },

  "antipasto": { "olive": 2, "grape": 2 },
  "boiled eggs": { "egg": 10 },
  "bumpkin broth": { "carrot": 10, "cabbage": 5 },
  "cabbers n mash": { "mashed potato": 100, "cabbage": 200 },
  "fried tofu": { "soybean": 15, "sunflower": 200 },
  "kale omelette": { "egg": 40, "kale": 50 },
  "kale stew": { "kale": 100 },
  "mashed potato": { "potato": 8 },
  "pizza margherita": { "tomato": 30, "cheese": 5 },
  "popcorn": { "sunflower": 100, "corn": 50 },
  "pumpkin soup": { "pumpkin": 10 },
  "rapid roast": { "pumpkin": 400 },
  "reindeer carrot": { "carrot": 5 },
  "rhubarb tart": { "rhubarb": 30 },
  "rice bun": { "rice": 2, "wheat": 50 },

  "bumpkin ganoush": { "eggplant": 30, "potato": 50, "parsnip": 10 },
  "bumpkin roast": { "mashed potato": 200, "roast veggies": 50 },
  "bumpkin salad": { "beetroot": 20, "parsnip": 10 },
  "caprese salad": { "cheese": 10, "tomato": 25, "kale": 20 },
  "cauliflower burger": { "cauliflower": 15, "wheat": 5 },
  "club sandwich": { "sunflower": 100, "carrot": 25, "wheat": 5 },
  "fruit salad": { "apple": 1, "orange": 1, "blueberry": 1 },
  "goblins brunch": { "boiled eggs": 50, "goblins treat": 10 },
  "goblins treat": { "pumpkin": 10, "radish": 20, "cabbage": 10 },
  "pancakes": { "wheat": 10, "egg": 10, "honey": 6 },
  "roast veggies": { "cauliflower": 15, "carrot": 10 },
  "spaghettti al limone": { "wheat": 10, "lemon": 15, "cheese": 30 },
  "steamed red rice": { "rice": 3, "beetroot": 50 },
  "sunflower crunch": { "sunflower": 300 },
  "surimi rice bowl": { "rice": 1, "onion": 10 },
  "tofu scramble": { "soybean": 20, "egg": 20, "cauliflower": 10 },
  "beetroot blaze": { "beetroot": 500 },
  "creamy crab bite": { "cheese": 30, "crab stick": 1 },
  "crimstone infused fish oil": { "crimstone": 10 },
  "mushroom jacket potatoes": { "potato": 50 },

  // ==========================================
  // SMOOTHIES
  // ==========================================
  "apple juice": { "apple": 5 },
  "banana blast": { "banana": 10, "egg": 10 },
  "bumpkin detox": { "apple": 5, "orange": 5, "carrot": 10 },
  "carrot juice": { "carrot": 30 },
  "grape juice": { "grape": 5, "radish": 20 },
  "orange juice": { "orange": 5 },
  "power smothie": { "blueberry": 10, "kale": 5 },
  "purple smoothies": { "blueberry": 5, "cabbage": 10 },
  "quick juice": { "sunflower": 50, "pumpkin": 40 },
  "slow juice": { "grape": 10, "kale": 100 },
  "sour shake": { "lemon": 20 },
  "the lot": { "blueberry": 1, "orange": 1, "grape": 1, "apple": 1, "banana": 1 },

  // ==========================================
  // DOLLS
  // ==========================================
  "shadow doll": { "doll": 1, "obsidian": 8 },
  "sizzle doll": { "doll": 1, "synthetic fibre": 8 },
  "wooly doll": { "doll": 1, "merino wool": 8 },
  "buzz doll": { "doll": 1, "honey": 8 },
  "cluck doll": { "doll": 1, "feather": 8 },
  "crude doll": { "doll": 1, "oil /1": 8 },
  "ember doll": { "doll": 1, "crimsteel": 8 },
  "gilded doll": { "doll": 1, "gold": 8 },
  "grubby doll": { "gilded doll": 10, "ember doll": 10, "shadow doll": 10 },
  "harvest doll": { "doll": 1, "turnip": 8 },
  "juicy doll": { "doll": 1, "tomato": 8 },
  "lumber doll": { "doll": 1, "timber": 8 },
  "lunar doll": { "doll": 1, "celestine": 3, "lunara": 3, "duskberry": 2 },
  "moo doll": { "doll": 1, "leather": 8 },
  "bloom doll": { "doll": 1, "prism petal": 3, "celestial frostbloom": 2, "primula enigma": 3 },

  // ==========================================
  // UNIFIED COMPOST & BAIT
  // ==========================================
  "earthworm": { "rhubarb": 2, "carrot": 1 },
  "grub": { "soybean": 1, "corn": 0.6 },
  "red wiggler": { "blueberry": 1.6, "egg": 1 },
  "sprout mix": { "rhubarb": 0.625, "carrot": 0.3125 },
  "fruitful blend": { "soybean": 0.555, "corn": 0.333 },
  "rapid root": { "blueberry": 0.381, "egg": 0.238 }
};
