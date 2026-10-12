// Screenshot a route at phone width. Usage: node scripts/shot.mjs <url> <out.png>
import { chromium } from 'playwright';
const [url = 'http://localhost:4173/styleguide', out = 'shot.png'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url, { waitUntil: 'networkidle' });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(errors.length ? `ERRORS\n${errors.join('\n')}` : `ok ${out}`);
