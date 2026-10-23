// Helper for resolving Sunflower Land item .webp icons

export function getItemIconSlug(name) {
  if (!name) return '';
  return name.toLowerCase().trim()
    .replace(/['"&]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function getItemIconUrl(name) {
  const slug = getItemIconSlug(name);
  if (!slug) return '';
  return `assets/items/${slug}.webp`;
}

export function renderItemIcon(name, size = 16, extraClass = '') {
  const url = getItemIconUrl(name);
  if (!url) return '';
  return `<img src="${url}" alt="${name}" width="${size}" height="${size}" class="sfl-item-icon ${extraClass}" onerror="this.style.display='none'" style="vertical-align: middle; object-fit: contain; image-rendering: pixelated; margin-right: 4px;" />`;
}
