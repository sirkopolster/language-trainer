// Renders public/logo.svg to the PWA icons. Usage: node scripts/make-icons.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../public/logo.svg', import.meta.url), 'utf8');
const b = await chromium.launch();
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<body style="margin:0;background:transparent">${svg.replace('width="160" height="160"', `width="${size}" height="${size}"`)}</body>`);
  await p.screenshot({ path: new URL(`../public/${name}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), omitBackground: true });
  await p.close();
}
await b.close(); console.log('icons written');
