// Seeds learning data for the QA user: profile, test, unit, 6 active sentences, optional word states per level. Returns ids. Used by smoke.mjs and shot scripts.
import { createClient } from '@supabase/supabase-js';
import { env } from './env.mjs';

export const SENTENCES = [
  ['Der Elefant ist groß.', 'The elephant is big.'],
  ['Der Affe ist klein.', 'The monkey is small.'],
  ['Füttere die Tiere nicht!', "Don't feed the animals!"],
  ['Ich mag den Zoo.', 'I like the zoo.'],
  ['Die Löwen schlafen am Nachmittag.', 'The lions sleep in the afternoon.'],
  ['Wo ist der Käfig?', 'Where is the cage?'],
];

export async function qaSeed({ levels = [] } = {}) {
  const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  let { error } = await sb.auth.signInWithPassword({ email: env.QA_EMAIL, password: env.QA_PASSWORD });
  if (error) ({ error } = await sb.auth.signUp({ email: env.QA_EMAIL, password: env.QA_PASSWORD }));
  if (error) throw error;
  const uid = (await sb.auth.getUser()).data.user.id;
  const { data: prof } = await sb.from('profiles').insert({ name: 'QA Kind', user_id: uid }).select().single();
  const format = { sections: [{ type: 'translate', direction: 'de-en', items: 3, points: 6, label: 'Translate sentences' }, { type: 'choice', direction: 'en', items: 1, points: 1 }], totalPoints: 7, passMark: 5 };
  const { data: test } = await sb.from('tests').insert({ profile_id: prof.id, name: 'QA Test', format }).select().single();
  const { data: unit } = await sb.from('units').insert({ test_id: test.id, label: 'Unit 1' }).select().single();
  const { data: words } = await sb.from('words').insert(SENTENCES.map(([source, target], i) => ({ unit_id: unit.id, source, target, status: 'active', priority: i === 2 }))).select();
  const past = new Date(Date.now() - 3600_000).toISOString();
  if (levels.length) await sb.from('word_state').insert(levels.map((box, i) => ({ word_id: words[i].id, profile_id: prof.id, box, due_at: past })));
  await sb.auth.signOut({ scope: 'local' }); // global sign-out would kill the browser session of the same QA user
  return { profileId: prof.id, testId: test.id, unitId: unit.id, wordIds: words.map((w) => w.id) };
}
