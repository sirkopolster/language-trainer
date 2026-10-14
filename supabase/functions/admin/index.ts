// Edge Function `admin`: student account management for admins (D-015). Uses the service role (injected by Supabase) only after the caller is verified as admin.
// Actions: { action: 'create-student', name, email, password, profileId? }  → creates the auth user (confirmed) and a profile, or attaches an existing profile
//          { action: 'update-student', profileId, name?, email?, password? } → updates the student's account and profile
//          { action: 'delete-student', profileId }                           → deletes the account (profile cascades)
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const asCaller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: me } = await asCaller.auth.getUser();
    if (!me.user) return json({ error: 'Nicht angemeldet' }, 401);
    const { data: adm } = await asCaller.from('admins').select('user_id').eq('user_id', me.user.id).maybeSingle();
    if (!adm) return json({ error: 'Nur für Eltern-Konten' }, 403);

    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json();

    if (body.action === 'create-student') {
      const { name, email, password, profileId } = body;
      if (!name || !email || !password || String(password).length < 8) return json({ error: 'Name, E-Mail und Passwort (mind. 8 Zeichen) nötig' }, 400);
      const created = await svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role: 'student', name } });
      if (created.error) return json({ error: created.error.message }, 400);
      const uid = created.data.user.id;
      if (profileId) {
        const up = await svc.from('profiles').update({ user_id: uid, admin_id: me.user.id, name, email }).eq('id', profileId).eq('admin_id', me.user.id);
        if (up.error) throw up.error;
        return json({ profileId, userId: uid });
      }
      const ins = await svc.from('profiles').insert({ user_id: uid, admin_id: me.user.id, name, email }).select('id').single();
      if (ins.error) throw ins.error;
      return json({ profileId: ins.data.id, userId: uid });
    }

    if (body.action === 'update-student' || body.action === 'delete-student') {
      const { data: prof } = await svc.from('profiles').select('id, user_id').eq('id', body.profileId).eq('admin_id', me.user.id).maybeSingle();
      if (!prof) return json({ error: 'Profil nicht gefunden' }, 404);
      if (body.action === 'delete-student') {
        if (prof.user_id !== me.user.id) { const del = await svc.auth.admin.deleteUser(prof.user_id); if (del.error) return json({ error: del.error.message }, 400); }
        else { const del = await svc.from('profiles').delete().eq('id', prof.id); if (del.error) throw del.error; }
        return json({ ok: true });
      }
      const attrs: Record<string, unknown> = {};
      if (body.email) attrs.email = body.email;
      if (body.password) { if (String(body.password).length < 8) return json({ error: 'Passwort mind. 8 Zeichen' }, 400); attrs.password = body.password; }
      if (Object.keys(attrs).length && prof.user_id !== me.user.id) {
        const up = await svc.auth.admin.updateUserById(prof.user_id, { ...attrs, email_confirm: true });
        if (up.error) return json({ error: up.error.message }, 400);
      }
      const pp: Record<string, unknown> = {};
      if (body.name) pp.name = body.name;
      if (body.email && prof.user_id !== me.user.id) pp.email = body.email;
      if (Object.keys(pp).length) { const up = await svc.from('profiles').update(pp).eq('id', prof.id); if (up.error) throw up.error; }
      return json({ ok: true });
    }
    return json({ error: 'Unbekannte Aktion' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message ?? 'Fehler' }, 500);
  }
});
