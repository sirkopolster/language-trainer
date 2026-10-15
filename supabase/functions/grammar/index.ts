// Edge Function `grammar` (D-020): builds a special part from the test's own sentences. Body: { testId, kind: 'tense' | 'negation' }
// Creates (or replaces) one unit of that kind with the generated pairs as words: source = form a, target = form b, example = German meaning.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GRAMMAR_SCHEMA, SPECIAL, grammarPrompt, normalizeGrammar, type SpecialKind } from '../../../src/domain/grammar.ts';
import { callModel, cors, json } from '../_shared/model.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { testId, kind } = await req.json() as { testId: string; kind: SpecialKind };
    if (!SPECIAL[kind]) return json({ error: 'Unbekannter Spezialteil' }, 400);

    const { data: units, error: ue } = await sb.from('units').select('id, kind').eq('test_id', testId);
    if (ue) throw ue;
    const vocabUnits = (units ?? []).filter((u) => u.kind === 'vocab').map((u) => u.id);
    const { data: words, error: we } = await sb.from('words').select('source, target').in('unit_id', vocabUnits).eq('status', 'active');
    if (we) throw we;
    if (!words?.length) return json({ error: 'Erst die Vokabelseiten auswerten' }, 400);

    const raw = await callModel(grammarPrompt(kind, words.map((w) => ({ en: w.target, de: w.source }))), GRAMMAR_SCHEMA);
    const pairs = normalizeGrammar(raw);
    if (pairs.length === 0) return json({ error: 'Im Wortschatz stecken keine passenden Verben' }, 400);

    // replace an earlier generation of the same kind (its learning state goes with it)
    const old = (units ?? []).filter((u) => u.kind === kind).map((u) => u.id);
    if (old.length) { const del = await sb.from('units').delete().in('id', old); if (del.error) throw del.error; }
    const ins = await sb.from('units').insert({ test_id: testId, label: `${SPECIAL[kind].label} · ${SPECIAL[kind].title}`, kind, sort: 100 + (kind === 'tense' ? 0 : 1) }).select('id').single();
    if (ins.error) throw ins.error;
    const rows = pairs.map((p) => ({ unit_id: ins.data.id, source: p.a, target: p.b, example: p.de, status: 'active' }));
    const wi = await sb.from('words').insert(rows);
    if (wi.error) throw wi.error;
    return json({ kind, unitId: ins.data.id, pairs: pairs.length });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message ?? 'Fehler' }, 500);
  }
});
