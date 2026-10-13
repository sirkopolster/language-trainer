// Live check of the extract function: renders a fake vocab page, uploads it as the QA user, calls `extract`, prints the result, cleans up.
// Usage: node scripts/extract-check.mjs [path-to-real-photo.jpg]
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { env } from './env.mjs';
import { qaCleanup } from './qa-cleanup.mjs';

const html = `<body style="font-family:Georgia;padding:40px;width:700px"><h2>Unit 4 · At the zoo</h2><table style="font-size:22px;border-collapse:collapse">
<tr><td style="padding:6px 24px 6px 0"><b>the elephant</b></td><td>der Elefant</td><td style="color:#555;font-style:italic">The elephant is big.</td></tr>
<tr><td style="padding:6px 24px 6px 0">the monkey</td><td>der Affe</td><td></td></tr>
<tr><td style="padding:6px 24px 6px 0"><b>to feed</b></td><td>füttern</td><td style="color:#555;font-style:italic">Don't feed the animals.</td></tr>
<tr><td style="padding:6px 24px 6px 0">dangerous</td><td>gefährlich</td><td></td></tr>
<tr><td style="padding:6px 24px 6px 0">the cage</td><td>der Käfig</td><td></td></tr>
</table></body>`;

async function fakePage() {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  await p.setContent(html); const buf = await p.screenshot({ type: 'jpeg', quality: 85 }); await b.close(); return buf;
}

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
try {
  let { error } = await sb.auth.signInWithPassword({ email: env.QA_EMAIL, password: env.QA_PASSWORD });
  if (error) ({ error } = await sb.auth.signUp({ email: env.QA_EMAIL, password: env.QA_PASSWORD }));
  if (error) throw error;
  const uid = (await sb.auth.getUser()).data.user.id;
  const { data: prof } = await sb.from('profiles').insert({ name: 'QA Kind', user_id: uid }).select().single();
  const { data: test } = await sb.from('tests').insert({ profile_id: prof.id, name: 'QA Test' }).select().single();
  const jpeg = process.argv[2] ? readFileSync(process.argv[2]) : await fakePage();
  const path = `${uid}/${prof.id}/${test.id}/check.jpg`;
  const up = await sb.storage.from('photos').upload(path, jpeg, { contentType: 'image/jpeg' });
  if (up.error) throw up.error;
  const { data: photo } = await sb.from('photos').insert({ test_id: test.id, kind: 'vocab', storage_path: path }).select().single();
  const t0 = Date.now();
  const { data, error: fe } = await sb.functions.invoke('extract', { body: { photoId: photo.id } });
  if (fe) { const body = await fe.context?.json?.().catch(() => null); throw new Error(`function: ${fe.message} ${JSON.stringify(body)}`); }
  console.log('result', data, `${Date.now() - t0} ms`);
  const { data: words } = await sb.from('words').select('source, target, example, priority');
  console.table(words);
} finally {
  await sb.auth.signOut();
  await qaCleanup();
}
