// Smoke test: sign-up/login → profile → test from home → upload 2 photos → delete 1 → home lists it → backup → seeded lesson (plan, round 1 Wählen with a hint → 2 stars, round 2 is Bauen). Usage: node scripts/smoke.mjs [baseUrl]
// Rules (blueprint §7): data-testid selectors, waitFor not sleeps, one step per feature, cleanup in finally.
import { chromium } from 'playwright';
import { env } from './env.mjs';
import { qaCleanup } from './qa-cleanup.mjs';
import { qaSeed, SENTENCES } from './qa-seed.mjs';

const base = (process.argv[2] ?? 'http://localhost:4311').replace(/\/+$/, '');
const steps = [];
const step = async (name, fn) => { const t = Date.now(); try { await fn(); steps.push(`✓ ${name} (${Date.now() - t} ms)`); } catch (e) { steps.push(`✗ ${name}: ${e.message.split('\n')[0]}`); throw e; } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const t = (id) => page.getByTestId(id);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

try {
  await qaCleanup();
  await step('login or sign-up', async () => {
    await page.goto(base + '/');
    await t('login-email').fill(env.QA_EMAIL);
    await t('login-password').fill(env.QA_PASSWORD);
    await t('login-submit').click();
    const outcome = await Promise.race([t('profile-add').waitFor().then(() => 'in'), page.getByText('stimmt nicht').waitFor().then(() => 'no-user')]);
    if (outcome === 'no-user') { await t('login-toggle').click(); await t('login-submit').click(); await t('profile-add').waitFor(); }
  });
  await step('add profile', async () => {
    await t('profile-add').click();
    await t('profile-name').fill('QA Kind');
    await t('profile-save').click();
    await page.locator('.item-title', { hasText: 'QA Kind' }).waitFor();
  });
  await step('add test from home', async () => {
    await t('test-add').click();
    await t('test-name').fill('QA Test');
    await t('test-save').click();
    await t('pick-vocab').waitFor({ state: 'attached' });
  });
  await step('upload 2 vocab photos', async () => {
    await t('pick-vocab').setInputFiles([{ name: 'a.png', mimeType: 'image/png', buffer: png }, { name: 'b.png', mimeType: 'image/png', buffer: png }]);
    await page.getByText('2 Fotos hochgeladen').waitFor();
    await t('thumbs-vocab').locator('img').nth(1).waitFor();
  });
  await step('delete 1 photo', async () => {
    await t('thumb-delete').first().click();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="thumb-delete"]').length === 1);
  });
  await step('home lists the test', async () => {
    await page.goto(base + '/');
    await page.locator('.item-title', { hasText: 'QA Test' }).waitFor();
    await page.locator('.item-sub', { hasText: '1 Test' }).waitFor();
  });
  await step('backup download', async () => {
    const dl = page.waitForEvent('download');
    await page.getByText('Backup (JSON)').click();
    const name = (await dl).suggestedFilename();
    if (!name.startsWith('snaplearn-backup-')) throw new Error('unexpected file ' + name);
  });
  await step('lesson: plan, round 1 with one hint, stars', async () => {
    await qaCleanup();
    const seed = await qaSeed();
    await page.goto(`${base}/t/${seed.testId}`);
    await t(`lesson-${seed.unitId}-1`).click();
    await t('lesson-start').click();
    for (let i = 0; i < 16; i++) {
      if (await t('part-next').isVisible().catch(() => false)) break;
      await t('prompt').waitFor();
      const prompt = await t('prompt').innerText();
      const pr = SENTENCES.find(([de, en]) => de === prompt || en === prompt); const answer = pr[0] === prompt ? pr[1] : pr[0];
      if (i === 6 && (await t('hint').count())) { await t('hint').click(); await t('hint-yes').click(); }
      await page.getByTestId('option').filter({ hasText: answer }).first().click();
      await page.getByText('Richtig!').waitFor();
      await t('next').click();
    }
    await t('part-next').waitFor();
    await page.getByLabel('2 Sterne').waitFor(); // one hint = one mistake = 2 stars
    await t('part-next').click();
    await t('prompt').waitFor();
    if (!(await t('tile').count())) throw new Error('round 2 should be tiles');
    if ((await t('dir').innerText()) !== 'Englisch → Deutsch') throw new Error('round 2 should start EN → DE');
  });
  if (errors.length) throw new Error('console errors: ' + errors.join(' | '));
  console.log(steps.join('\n'), '\nSMOKE OK', base);
} catch (e) {
  await page.screenshot({ path: 'smoke-fail.png' }).catch(() => undefined);
  console.log(steps.join('\n'), '\nSMOKE FAILED:', e.message, '\nscreenshot: smoke-fail.png');
  process.exitCode = 1;
} finally {
  await browser.close();
  await qaCleanup();
}
