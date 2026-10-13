// Deletes everything the QA user owns: storage objects first, then profiles (cascade). Used by smoke.mjs in `finally`, also runnable alone.
import { createClient } from '@supabase/supabase-js';
import { env } from './env.mjs';

export async function qaCleanup() {
  const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  const { error } = await sb.auth.signInWithPassword({ email: env.QA_EMAIL, password: env.QA_PASSWORD });
  if (error) { console.log('qa-cleanup: no QA user yet'); return; }
  const { data: photos } = await sb.from('photos').select('storage_path');
  const paths = (photos ?? []).map((p) => p.storage_path);
  if (paths.length) await sb.storage.from('photos').remove(paths);
  const { data: profiles } = await sb.from('profiles').select('id');
  if (profiles?.length) await sb.from('profiles').delete().in('id', profiles.map((p) => p.id));
  console.log(`qa-cleanup: ${paths.length} photos, ${profiles?.length ?? 0} profiles removed`);
  await sb.auth.signOut();
}

if (process.argv[1]?.endsWith('qa-cleanup.mjs')) await qaCleanup();
