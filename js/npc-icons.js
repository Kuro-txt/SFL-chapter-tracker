/**
 * NPC Icon Resolver for Sunflower Land NPCs.
 * Renders pixel-art animated WebP icons from Sunflower Land's official animation CDN
 * with seamless fallback to local cached assets and emojis.
 * Matches the reference architecture from eliasSFL/sunflower-land-overview.
 */

export const NPC_TOKENS = {
  "streamer": "32_1_5_104_20_22_145_0_0_0_0_366_0_0_0_0_367",
  "rocket_man": "32_1_5_104_20_22_145_0_0_0_0_366_0_0_0_0_367",
  "bailey": "32_1_5_104_20_22_183_425",
  "richie": "122_1_5_0_146_149_23",
  "cluck_e_cheese": "32_1_5_200_18_22_167_303_0_179_0_0_403",
  "felga": "48_1_5_195_20_41_23_214",
  "minewhack": "48_1_63_0_46_41_126_443",
  "memory": "32_1_184_287_46_65_0_151_0_0_0_0_0_0_0_177",
  "chaac": "32_90_203_320_281_22_162_378_0_431_0_0_0_0_0_0_0_542_554",
  "pharaoh": "352_3_51_0_0_362_318_349_0_0_0_0_0_0_363",
  "petro": "352_1_5_40_360_22_354_358",
  "digby": "352_3_180_353_359_22_355_357",
  "peggy": "392_1_346_13_20_22_0_0_0_0_16",
  "chef_tuck": "394_4_180_320_322_22_239_25_0_0_16_0_0_0_0_0_0_0_551",
  "chef_maple": "394_3_50_330_333_22_0_25_0_0_16",
  "chef_ebon": "394_2_51_325_327_22_58_25_0_0_16",
  "chef_lumen": "394_1_43_335_338_22_0_25_0_0_16",
  "gambit": "394_4_51_66_20_34_103_341_0_0_0_0_0_0_0_0_0_539_551",
  "portaller": "394_1_51_66_20_34_103_341",
  "jester": "394_1_74_13_18_34_145_340_0_0_0_0_0_0_0_0_0_541",
  "victoria": "394_1_346_0_0_34_318_0_0_0_0_0_0_0_344_0_0_0_554",
  "gaucho": "32_1_180_13_18_34_145_197_0_0_0_0_0_0_0_177",
  "chicken": "32_1_5_15_18_22_23_303",
  "flopsy": "32_2_180_181_182_34_183_0_0_179_0_117_0_0_0_177",
  "hopper": "32_1_180_181_182_34_183_0_0_179_0_117_0_0_0_177",
  "greedclaw": "393_4_180_181_182_34_183_0_0_179_0_0_0_0_0_177_0_0_551",
  "grabnab": "393_4_51_0_146_149_145_0_0_0_0_0_0_0_0_0_0_0_551",
  "garbo": "393_4_42_14_18_22_77_0_0_0_0_0_0_0_0_0_0_0_551",
  "gordo": "393_4_51_104_20_22_0_0_0_0_0_0_0_0_0_0_0_0_551",
  "goblet": "393_4_52_15_20_22_123_0_0_0_0_0_0_0_0_0_0_0_551",
  "guria": "393_4_6_13_19_22_96_0_0_0_0_0_0_0_0_0_0_0_551",
  "evie": "32_1_202_15_18_22_23",
  "wizard": "32_1_180_0_0_22_240_214",
  "reelin_roy": "32_1_5_13_18_22_240",
  "wanderleaf": "32_1_51_0_0_22_23",
  "dreadhorn": "32_1_51_0_0_22_23_0_0_0_0_0_160",
  "jake": "32_1_5_13_18_22_23",
  "betty": "392_1_6_13_18_22_0_0_0_0_0_0_0_0_0_0_0_540_550",
  "blacksmith": "392_3_63_40_19_34",
  "bruce": "32_1_42_14_20_22_23_0_0_0_16",
  "otis": "32_1_51_13_35_22_23",
  "hank": "392_3_51_13_35_188_23",
  "grimbly": "392_4_63_14_35_22_0_0_0_0_0_0_0_0_0_0_0_0_551",
  "grimtooth": "392_4_63_13_19_22_0_424_0_0_0_0_0_0_0_0_0_0_551",
  "grubnuk": "393_4_42_40_20_22_96_0_0_0_0_0_0_0_0_0_0_0_551",
  "marcus": "32_3_63_88_19_22_23",
  "bella": "32_3_43_38_39_22_23_151",
  "sofia": "32_3_67_66_20_22_23_0_59_0_0_124",
  "adam": "32_1_5_13_46_22_23",
  "orlin": "53_1_42_134_131_41_23_128",
  "timmy": "392_1_42_137_18_41_103_0_0_0_0_105_0_0_0_0_0_541_549",
  "hammerin_harry": "122_1_150_0_146_149_145_0_0_0_0_0_0_0_0_0_0_540",
  "craig": "53_127_51_15_20_22_126",
  "gabi": "392_1_43_60_20_22",
  "misty_marvel": "53_1_67_66_37_22_123",
  "pumpkin_pete": "392_3_42_14_19_22_23_178_0_0_0_0_0_0_0_0_0_540_550",
  "bert": "392_1_184_185_187_188_23_424_0_0_0_0_0_0_0_0_0_545",
  "birdie": "392_1_50_405_404_22_409_0_406_0_408_0_0_410",
  "buttons": "32_1_50_85_20_22_23_0_0_0_16",
  "frankie": "392_2_201_121_35_22",
  "gordy": "32_2_7_40_18_22",
  "igor": "392_3_63_15_19_34_0_0_0_0_0_0_0_0_0_0_0_542",
  "raven": "392_193_192_0_0_34_123_196_0_0_0_0_0_189_190_0_0_0_554",
  "stella": "392_1_52_289_18_34_23_425_0_0_0_0_0_0_0_0_0_541_550",
  "tywin": "392_1_42_33_36_34_0_0_0_0_0_0_0_0_0_0_0_542_548",
  "old_salty": "352_90_42_88_93_89_96_91_0_0_92_0_0_0_0_0_0_0_552",
  "miranda": "48_1_201_85_0_34_23_87_0_0_86_0_0_0_0_0_0_540",
  "cornwell": "392_1_180_181_182_34_183_0_0_179_0_0_0_0_0_177",
  "luna": "53_3_52_0_0_34_0_0_0_0_0_0_0_0_155",
  "billy": "53_1_5_13_18_34_23_303",
  "phantom_face": "53_2_42_13_18_22_23_165_0_0_0_0_159",
  "farmer_flesh": "53_127_51_208_18_22_23_178",
  "boneyard_betty": "392_127_6_195_18_22",
  "eins": "32_1_470_473_182_149_472",
  "garth": "47_158_203_144_35_22_0_0_0_0_0_0_0_0_0_0_0_0_551",
  "gunter": "47_158_203_411_35_22_162_0_0_0_0_0_0_0_0_0_0_0_551",
  "gorga": "47_158_192_411_35_22_162_163_0_370_0_0_0_0_0_0_0_0_551",
  "finn": "48_3_42_218_234_0_240_225",
  "gilda": "47_158_6_411_35_22_162_163_0_0_0_0_0_0_0_0_0_0_551",
  "finley": "48_3_52_219_234_0_240_136_0_0_0_0_0_0_0_0_0_546",
  "tango": "48_243_42_0_0_22_96",
  "corale": "48_242_67_0_0_22",
  "goldtooth": "48_4_51_94_93_89_96_91_0_0_92_0_0_0_0_0_0_0_551",
  "daphne": "48_3_201_94_93_34_129",
  "damien": "48_3_51_208_93_34_129_79",
  "mayor": "48_3_51_94_20_34_167_214",
  "wobble": "48_3_42_13_18_34_145_253",
  "santa": "71_1_184_0_0_22_261_81_0_0_0_0_267_0_0_266",
  "elf": "71_3_51_0_0_22_261_262_0_0_0_0_265",
  "ginger": "71_1_51_0_0_22_261_262_0_0_0_420_265",
  "misty": "48_1_204_219_233_22_240",
  "murmur": "394_1_74_66_36_34_227_340_0_0_0_0_0_0_0_0_0_541_554",
  "poppy": "78_1_50_0_0_34_23_293_0_0_0_0_0_268_294",
  "stevie": "32_3_43_13_18_22_275_278_0_0_0_0_279",
  "chun_long": "83_3_7_13_0_22_23_304_0_0_0_0_305",
  "lady_day": "32_1_50_38_20_22_23_293_0_0_0_0_0_0_296",
  "robert": "32_3_7_137_46_22_23",
  "grommy": "32_4_51_282_281_22_0_0_0_0_0_0_0_0_0_0_0_0_551",
  "maximus": "32_1_7_13_18_22_23",
  "barlow": "394_1_7_330_333_334_332_376_388_380_0_0_0_384",
  "graxle": "394_4_74_320_322_323_324_377_389_381_0_0_0_385_0_0_0_0_551",
  "nyx": "394_193_192_325_327_328_329_378_390_382_0_0_0_386",
  "reginald": "394_140_0_335_338_339_336_379_391_383_0_0_0_387",
  "glinteye": "32_4_184_33_36_22_145_0_0_0_0_0_0_0_0_177_0_0_551",
  "solara": "32_140_0_33_338_339_336",
  "dusk": "32_193_67_317_327_328_329",
  "haymitch": "32_1_7_299_333_334_332",
  "grizzle": "32_4_50_33_36_22_145_26_0_0_0_0_0_0_0_266_0_0_551",
  "buttercup": "32_1_50_289_333_334_123",
  "shadow": "32_193_52_134_327_328_274",
  "flora": "32_140_75_181_338_339_129",
  "eldric": "394_2_42_325_333_339_324_341_0_0_312_0_0_0_0_177",
  "jafar": "364_3_42_0_0_362_365_361_0_0_0_0_0_0_363",
  "pet": "32_140_0_33_338_339_336",
  "worried_pete": "32_118_42_14_19_22_23_178",
  "chase": "392_3_203_397_398_399_400_396_0_0_0_0_0_0_0_177",
  "new_year_pete": "392_3_42_14_19_22_23_517",
  "neville": "392_2_184_217_233_399_239_197_0_0_16_0_0_0_0_186",
  "pirate_skeleton": "32_485_42_88_93_22_96_91_0_0_92",
  "slime_jim": "0_1_5_569_574_572_570_573_0_0_0_0_0_0_0_0_0_542_554",
  "slime_joe": "566_3_567_568_575_571_570_0_0_0_0_0_0_564_0_0_565_540_550",
  "vampire_jim": "0_1_5_603_601_605_0_598_0_0_0_0_0_0_0_0_0_540_550",
  "skelly_joe": "602_3_5_0_0_0_604_600_0_0_0_0_606_596_0_0_597",
  "gloomwick": "393_4_42_0_0_22_0_589_0_0_0_0_587_588"
};

export const AVAILABLE_NPCS = new Set(Object.keys(NPC_TOKENS));

/**
 * Normalizes an NPC name or ID to the canonical asset/token key.
 * e.g., "Pumpkin' Pete" -> "pumpkin_pete", "Old Salty" -> "old_salty"
 */
export function normalizeNpcKey(nameOrId) {
  if (!nameOrId || typeof nameOrId !== 'string') return '';
  return nameOrId.toLowerCase().trim().replace(/['\s-]+/g, '_');
}

/**
 * Returns the local asset path for an NPC icon, or null if not found.
 */
export function getNpcIconPath(nameOrId) {
  const key = normalizeNpcKey(nameOrId);
  if (AVAILABLE_NPCS.has(key)) {
    return `public/icons/npcs/${key}.webp`;
  }
  return null;
}

/**
 * Returns the official Sunflower Land CDN URL for the bumpkin's animated webp.
 * Format: https://animations.sunflower-land.com/animated_webp/0_v1_${token}/idle-small
 */
export function getNpcCdnUrl(nameOrId) {
  const key = normalizeNpcKey(nameOrId);
  const token = NPC_TOKENS[key];
  if (token) {
    return `https://animations.sunflower-land.com/animated_webp/0_v1_${token}/idle-small`;
  }
  return null;
}

/**
 * Renders an HTML string for an NPC icon.
 * Includes pixelated rendering style, zero background, and multi-tier fallback:
 * 1. Primary local/CDN asset
 * 2. Alternate static path (/icons/ vs public/icons/)
 * 3. CDN animation fallback
 * 4. High-contrast bumpkin farmer emoji
 *
 * @param {string} nameOrId - NPC name (e.g. "Pumpkin' Pete", "Bert", "Raven")
 * @param {object} options - { size = 24, className = '', fallbackEmoji = '🧑‍🌾' }
 * @returns {string} HTML string
 */
export function getNpcIconHtml(nameOrId, options = {}) {
  const key = normalizeNpcKey(nameOrId);
  const fallback = options.fallbackEmoji || '🧑‍🌾';
  const size = options.size || 24;
  const sizeClass = options.className || '';
  const imgPath = getNpcIconPath(key);
  const token = NPC_TOKENS[key] || '';
  const cdnUrl = token ? `https://animations.sunflower-land.com/animated_webp/0_v1_${token}/idle-small` : '';

  if (imgPath || cdnUrl) {
    const primarySrc = imgPath || cdnUrl;
    const escapedFallback = fallback.replace(/'/g, "\\'");
    const onErrorJs = `if(!this.dataset.triedFallback){this.dataset.triedFallback='1';if(this.src.includes('public/icons/')){this.src=this.src.replace('public/icons/','icons/');}else if('${cdnUrl}' && !this.src.includes('animations.sunflower-land.com')){this.src='${cdnUrl}';}else{this.onerror=null;this.replaceWith(document.createTextNode('${escapedFallback}'));}}else if(!this.dataset.triedCdn && '${cdnUrl}' && !this.src.includes('animations.sunflower-land.com')){this.dataset.triedCdn='1';this.src='${cdnUrl}';}else{this.onerror=null;this.replaceWith(document.createTextNode('${escapedFallback}'));}`;

    return `<img src="${primarySrc}" class="sfl-npc-avatar ${sizeClass}" width="${size}" height="${size}" alt="${nameOrId}" decoding="async" onerror="${onErrorJs}" style="width:${size}px; height:${size}px; object-fit:contain; image-rendering:pixelated; vertical-align:middle; display:inline-block; background:transparent; border:none;" />`;
  }

  return `<span class="${sizeClass}" style="display:inline-block; vertical-align:middle; font-size:${Math.round(size * 0.75)}px;">${fallback}</span>`;
}

if (typeof window !== 'undefined') {
  window.getNpcIconHtml = getNpcIconHtml;
  window.getNpcIconPath = getNpcIconPath;
  window.getNpcCdnUrl = getNpcCdnUrl;
  window.normalizeNpcKey = normalizeNpcKey;
  window.NPC_TOKENS = NPC_TOKENS;
}
