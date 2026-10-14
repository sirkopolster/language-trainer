// Edge Function `login`: sign in with e-mail OR name (D-016). Resolves the name to the e-mail server-side so no e-mail leaks to the client.
// Body: { identifier, password } → { access_token, refresh_token } or { error }
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { identifier, password } = await req.json();
    const id = String(identifier ?? '').trim();
    if (!id || !password) return json({ error: 'Name oder E-Mail und Passwort nötig' }, 400);
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    let email = id.includes('@') ? id : '';
    if (!email) {
      const { data: prof } = await svc.from('profiles').select('user_id, email').ilike('name', id).maybeSingle();
      let uid = prof?.user_id ?? null;
      if (!uid) { const { data: adm } = await svc.from('admins').select('user_id').ilike('name', id).maybeSingle(); uid = adm?.user_id ?? null; }
      if (uid) { const { data: u } = await svc.auth.admin.getUserById(uid); email = u.user?.email ?? prof?.email ?? ''; }
      if (!email) return json({ error: 'Name oder Passwort stimmt nicht' }, 400);
    }
    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session) return json({ error: 'Name oder Passwort stimmt nicht' }, 400);
    return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message ?? 'Fehler' }, 500);
  }
});
