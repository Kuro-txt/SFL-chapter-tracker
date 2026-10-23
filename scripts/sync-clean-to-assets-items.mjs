import fs from 'fs';
import path from 'path';

// For every clean item in public/icons that was in assets/items, overwrite assets/items/<base>.webp or .png
const publicIcons = fs.readdirSync('public/icons');
let updatedCount = 0;

for (const pi of publicIcons) {
  const ext = path.extname(pi);
  const base = path.basename(pi, ext);
  const src = path.join('public/icons', pi);
  const destWebp = path.join('assets/items', `${base}.webp`);
  const destPng = path.join('assets/items', `${base}.png`);

  if (fs.existsSync(destWebp)) {
    fs.copyFileSync(src, destWebp);
    updatedCount++;
  }
  if (fs.existsSync(destPng)) {
    fs.copyFileSync(src, destPng);
    updatedCount++;
  }
}

console.log(`Updated ${updatedCount} files in assets/items to transparent clean versions!`);
