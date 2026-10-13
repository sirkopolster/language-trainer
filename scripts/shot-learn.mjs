// Screenshots the lesson flow with seeded data: plan, each exercise type, feedback, part result, lesson result. Usage: node scripts/shot-learn.mjs <baseUrl> <outDir>
import { chromium } from 'playwright';
import { env } from './env.mjs';
import { qaCleanup } from './qa-cleanup.mjs';
import { qaSeed, SENTENCES } from './qa-seed.mjs';

const [base, out] = [process.argv[2] ?? 'http://localhost:4314', process.argv[3] ?? '.'];
await qaCleanup();
const seed = await qaSeed();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const t = (id) => page.getByTestId(id);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const shot = (name) => page.screenshot({ path: `${out}/lesson-${name}.png` });

try {
  await page.goto(base + '/');
  await t('login-email').fill(env.QA_EMAIL); await t('login-password').fill(env.QA_PASSWORD); await t('login-submit').click();
  await t('test-add').waitFor();
  await page.goto(`${base}/t/${seed.testId}`);
  await t(`lesson-${seed.unitId}-1`).waitFor(); await shot('test-screen');
  await t(`lesson-${seed.unitId}-1`).click();
  await t('lesson-start').waitFor(); await shot('plan');
  await t('lesson-start').click();
  const seen = new Set();
  for (let part = 0; part < 5; part++) {
    for (let i = 0; i < 12; i++) {
      if (await t('part-next').isVisible().catch(() => false)) break;
      await t('prompt').waitFor();
      const prompt = await t('prompt').innerText();
      const ans = SENTENCES.find(([de]) => de === prompt)[1];
      const type = (await t('option').count()) ? 'choice' : (await t('tile').count()) ? 'tiles' : (await t('gap').count()) ? 'gaps' : 'write';
      const name = type + (type === 'gaps' && (await t('gap').first().inputValue()) ? '-hint' : '');
      if (type === 'choice' && i === 0) { await t('hint').click(); await shot('choice-hint-ask'); await t('hint-yes').click(); await shot('choice-hint'); }
      if (!seen.has(name)) { await shot(name); seen.add(name); }
      if (type === 'choice') await page.getByTestId('option').filter({ hasText: ans }).first().click();
      else if (type === 'tiles') { for (const w of ans.split(' ').flatMap((x) => { const m = x.match(/^(.*?)([.,!?;:]+)$/); return m && m[1] ? [m[1], m[2]] : [x]; })) await page.locator('.tile-bank').getByRole('button', { name: w, exact: true, disabled: false }).first().click(); await t('submit').click(); }
      else if (type === 'gaps') { const gaps = await t('gap').all(); const words = ans.split(' '); for (const g of gaps) { const len = Number((await g.evaluate((el) => el.style.width)).replace('ch', '')) - 3; const first = await g.inputValue(); const toks = words.map((w) => w.replace(/[.,!?;:]+$/, '')); await g.fill(toks.find((w) => w.length === len && (!first || w.startsWith(first))) ?? toks.find((w) => w.length === len) ?? 'x'); } await t('submit').click(); }
      else { await t('write').fill(i === 1 ? ans.toLowerCase().replace(/[.!?]$/, '') : i === 2 ? 'totally wrong sentence' : ans); await t('submit').click(); }
      await t('feedback').waitFor();
      const fb = await t('feedback').innerText();
      const key = fb.startsWith('Richtig!') ? 'ok' : fb.startsWith('Noch nicht') ? 'wrong' : 'hint';
      if (!seen.has('fb-' + key)) { await shot('fb-' + key); seen.add('fb-' + key); }
      await t('next').click();
    }
    await t('part-next').waitFor();
    if (part === 0 || part === 4) await shot(`part-done-${part + 1}`);
    await t('part-next').click();
  }
  await page.getByText('Zurück zum Test').waitFor(); await shot('lesson-done');
  await page.getByText('Zurück zum Test').click(); await t(`lesson-${seed.unitId}-1`).waitFor(); await shot('test-screen-after');
  console.log('shots:', [...seen].join(', '), errors.length ? '\nERRORS: ' + errors.join(' | ') : '');
} finally {
  await browser.close();
  await qaCleanup();
}
