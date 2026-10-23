import fs from 'fs';
import path from 'path';

async function main() {
  const imagesTs = await (await fetch('https://raw.githubusercontent.com/sunflower-land/sunflower-land/main/src/features/game/types/images.ts')).text();
  const sunnysideTs = await (await fetch('https://raw.githubusercontent.com/sunflower-land/sunflower-land/main/src/assets/sunnyside.ts')).text();

  // Imports
  const importRegex = /import\s+([a-zA-Z0-9_]+)\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  const imports = {};
  while ((m = importRegex.exec(imagesTs)) !== null) {
    let p = m[2];
    if (p.startsWith('assets/')) p = 'src/' + p;
    imports[m[1]] = p;
  }

  // Parse SUNNYSIDE
  const sunnysidePaths = {};
  const sunnysideRegex = /([a-zA-Z0-9_]+):\s*`\$\{CONFIG\.PROTECTED_IMAGE_URL\}\/([^`]+)`/g;
  while ((m = sunnysideRegex.exec(sunnysideTs)) !== null) {
    sunnysidePaths[m[1]] = m[2];
  }

  // Our 64 items
  const items = [
    'Adirondack Potato', 'Aged Anchovy', 'Aged Blowfish', 'Aged Butterflyfish', 'Aged Clownfish',
    'Aged Halibut', 'Aged Olive Flounder', 'Aged Red Snapper', 'Aged Sea Bass', 'Aged Squid',
    'Aged Tuna', 'Anemone', 'Barnacle', 'Bee Box', 'Black Magic', 'Blue Crab', 'Celestine',
    'Chewed Bone', 'Chiogga', 'Cluck Doll', 'Cobia', 'Crab Pot', 'Crimsteel', 'Cushion',
    'Dewberry', 'Duskberry', 'Garden Eel', 'Giant Apple', 'Giant Banana', 'Giant Orange',
    'Golden Helios', 'Hardened Leather', 'Hermit Crab', 'Honey Cheddar', 'Horse Mackerel',
    'Horseshoe Crab', 'Kale & Mushroom Pie', 'Lobster', 'Lunara', 'Mariner Pot', 'Merino Cushion',
    'Mud', 'Mushroom Jacket Potatoes', 'Mussel', 'Napoleanfish', 'Octopus', 'Oil Drill', 'Oyster',
    'Pizza Margherita', 'Purple Cauliflower', 'Sand Drill', 'Sea Grapes', 'Sea Slug', 'Sea Snail',
    'Sea Urchin', 'Shrimp', 'Sizzle Doll', 'Spaghetti al Limone', 'Steamed Red Rice', 'Timber',
    'Truffle', 'Warty Goblin Pumpkin', 'White Carrot', 'Wild Grass'
  ];

  console.log(`Testing download of ${items.length} items...`);
  const successList = [];
  const failList = [];

  for (const it of items) {
    const escaped = it.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`['"]?${escaped}['"]?\\s*:\\s*\\{[^}]*image\\s*:\\s*([a-zA-Z0-9_.]+)`, 'i');
    const match = imagesTs.match(regex);
    if (!match) {
      failList.push({ item: it, reason: 'Regex failed' });
      continue;
    }
    const expr = match[1];
    let url = null;
    if (expr.startsWith('SUNNYSIDE.')) {
      const parts = expr.split('.');
      const key = parts[parts.length - 1];
      if (sunnysidePaths[key]) {
        url = `https://sunflower-land.com/testnet-assets/${sunnysidePaths[key]}`;
      }
    } else if (imports[expr]) {
      url = `https://raw.githubusercontent.com/sunflower-land/sunflower-land/main/${imports[expr]}`;
    }

    if (!url) {
      failList.push({ item: it, reason: 'No URL resolved' });
      continue;
    }

    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const ext = path.extname(new URL(url).pathname) || '.png';
        const cleanName = it.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') + ext;
        const targetDir = path.join(process.cwd(), 'public', 'icons');
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        const targetPath = path.join(targetDir, cleanName);
        fs.writeFileSync(targetPath, buf);
        successList.push({ item: it, file: `public/icons/${cleanName}`, bytes: buf.length });
      } else {
        failList.push({ item: it, url, status: res.status });
      }
    } catch (e) {
      failList.push({ item: it, url, error: e.message });
    }
  }

  console.log(`Success: ${successList.length} / ${items.length}`);
  if (failList.length > 0) {
    console.error('Failed items:', failList);
  }
}

main().catch(console.error);
