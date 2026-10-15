// Edge Function `extract`: one photo → vision model → units/words (vocab) or tests.format (test). Deploy: npx supabase functions deploy extract --project-ref <ref>
// Secrets: AI_PROVIDER=gemini|anthropic, GEMINI_API_KEY / ANTHROPIC_API_KEY, optional AI_MODEL. Runs under the caller's JWT, so RLS does the ownership check.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { FORMAT_SCHEMA, VOCAB_SCHEMA, formatPrompt, normalizeFormat, normalizeVocab, vocabPrompt } from '../../../src/domain/extraction.ts';
import { callModel, cors, json } from '../_shared/model.ts';


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { photoId } = await req.json();
    const { data: photo, error } = await sb.from('photos').select('id, test_id, kind, storage_path, tests(lang_from, lang_to)').eq('id', photoId).single();
    if (error || !photo) return json({ error: 'Foto nicht gefunden' }, 404);
    const test = photo.tests as unknown as { lang_from: string; lang_to: string };

    const file = await sb.storage.from('photos').download(photo.storage_path);
    if (file.error) return json({ error: 'Foto konnte nicht geladen werden' }, 500);
    const b64 = toBase64(new Uint8Array(await file.data.arrayBuffer()));

    const vocab = photo.kind === 'vocab';
    const raw = await callModel(vocab ? vocabPrompt(test.lang_from, test.lang_to) : formatPrompt(), vocab ? VOCAB_SCHEMA : FORMAT_SCHEMA, b64);

    if (vocab) {
      const v = normalizeVocab(raw);
      const label = v.unit ?? 'Ohne Unit';
      let { data: unit } = await sb.from('units').select('id').eq('test_id', photo.test_id).eq('label', label).maybeSingle();
      if (!unit) {
        const { count } = await sb.from('units').select('*', { count: 'exact', head: true }).eq('test_id', photo.test_id);
        const ins = await sb.from('units').insert({ test_id: photo.test_id, label, sort: count ?? 0 }).select('id').single();
        if (ins.error) throw ins.error;
        unit = ins.data;
      }
      if (v.words.length) {
        const ins = await sb.from('words').insert(v.words.map((w) => ({ unit_id: unit!.id, source: w.source, target: w.target, example: w.example, priority: w.priority, status: 'review' })));
        if (ins.error) throw ins.error;
      }
      await sb.from('photos').update({ status: 'extracted', extracted: raw }).eq('id', photo.id);
      return json({ kind: 'vocab', unit: label, words: v.words.length });
    }
    const f = normalizeFormat(raw);
    const up = await sb.from('tests').update({ format: { sections: f.sections, totalPoints: f.totalPoints, passMark: f.passMark } }).eq('id', photo.test_id);
    if (up.error) throw up.error;
    await sb.from('photos').update({ status: 'extracted', extracted: raw }).eq('id', photo.id);
    return json({ kind: 'test', sections: f.sections.length, totalPoints: f.totalPoints });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message ?? 'Auswertung fehlgeschlagen' }, 500);
  }
});

// chunked: spreading a 300 KB photo into String.fromCharCode(...bytes) overflows the call stack
function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000) as unknown as number[]);
  return btoa(bin);
}

