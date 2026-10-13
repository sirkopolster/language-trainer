// Screenshots every exercise type of the learn screen with seeded data. Usage: node scripts/shot-learn.mjs <baseUrl> <outDir>
import { chromium } from 'playwright';
import { env } from './env.mjs';
import { qaCleanup } from './qa-cleanup.mjs';
import { qaSeed, SENTENCES } from './qa-seed.mjs';

const [base, out] = [process.argv[2] ?? 'http://localhost:4314', process.argv[3] ?? '.'];
await qaCleanup();
const seed = await qaSeed({ levels: [0, 1, 2, 3, 4, 4] });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const t = (id) => page.getByTestId(id);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(base + '/');
  await t('login-email').fill(env.QA_EMAIL); await t('login-password').fill(env.QA_PASSWORD); await t('login-submit').click();
  await t('test-add').waitFor();
  await page.goto(`${base}/t/${seed.testId}/learn`);
  const seen = new Set();
  for (let i = 0; i < 8; i++) {
    await t('prompt').waitFor();
    const prompt = await t('prompt').innerText();
    const answer = SENTENCES.find(([de]) => de === prompt)[1];
    const type = (await t('option').count()) ? 'choice' : (await t('tile').count()) ? 'tiles' : (await t('gap').count()) ? 'gaps' : 'write';
    const name = type + (type === 'gaps' && (await t('gap').first().inputValue()) ? '-hint' : '');
    if (!seen.has(name)) { await page.screenshot({ path: `${out}/learn-${name}.png` }); seen.add(name); }
    if (type === 'choice') await page.getByTestId('option').filter({ hasText: answer }).first().click();
    else if (type === 'tiles') { for (const w of answer.split(' ')) await page.getByTestId('tile').filter({ hasText: w }).first().click(); await t('submit').click(); }
    else if (type === 'gaps') {
      const gaps = await t('gap').all();
      // fill wrong on purpose once to capture the feedback card
      for (const g of gaps) await g.fill(i === 2 ? 'xxx' : answer.split(' ')[(await page.evaluate((el) => Array.from(el.parentElement.children).indexOf(el), await g.elementHandle()))]);
      await t('submit').click();
    } else { await t('write').fill(i === 4 ? answer.toLowerCase().replace(/[.!?]$/, '') : answer); await t('submit').click(); }
    await t('feedback').waitFor();
    const fb = await t('feedback').innerText();
    const key = fb.startsWith('Richtig!') ? 'ok' : fb.startsWith('Noch nicht') ? 'wrong' : 'hint';
    if (!seen.has('fb-' + key)) { await page.screenshot({ path: `${out}/learn-fb-${key}.png` }); seen.add('fb-' + key); }
    await t('next').click();
    if (await t('again').isVisible().catch(() => false)) { await page.screenshot({ path: `${out}/learn-end.png` }); break; }
  }
  console.log('shots:', [...seen].join(', '), errors.length ? '\nERRORS: ' + errors.join(' | ') : '');
} finally {
  await browser.close();
  await qaCleanup();
}
