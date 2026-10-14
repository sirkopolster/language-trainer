import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseRepository as repo } from '../../../storage/supabaseRepository';
import type { Photo, PhotoKind, Test, Word } from '../../../domain/types';
import { suggestTopics } from '../../../domain/topics';
import { Button, Card, ListIcon, useToast } from '../../ds';
import { resizeToJpeg } from '../photos/resize';
import { PhotoSection, SECTIONS } from './PhotoSection';

/** Einstellungen tab: 1 upload test material, 2 what the test covers (prefilled, editable), 3 the sentence list to check and fix. */
export function SettingsTab({ test, words, onTestChange, onWordsChange }: { test: Test; words: Word[]; onTestChange: (t: Test) => void; onWordsChange: () => void }) {
  const nav = useNavigate();
  const toast = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<{ kind: PhotoKind; n: number }>({ kind: 'vocab', n: 0 });
  const [extracting, setExtracting] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>(test.topics ?? []);
  const [draft, setDraft] = useState('');

  const loadPhotos = () => repo.listPhotos(test.id).then(setPhotos).catch((e: Error) => toast(e.message, 'bad'));
  useEffect(() => { loadPhotos(); }, [test.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    photos.filter((p) => !urls[p.id]).forEach((p) => repo.photoUrl(p).then((u) => setUrls((s) => ({ ...s, [p.id]: u }))).catch(() => undefined));
  }, [photos]); // eslint-disable-line react-hooks/exhaustive-deps
  // first visit: prefill from what the photos taught us
  useEffect(() => {
    if (test.topics === null) {
      const s = suggestTopics(test.format, words.length > 0);
      if (s.length) saveTopics(s);
    }
  }, [test.format, words.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function saveTopics(next: string[]) {
    setTopics(next);
    repo.updateTest(test.id, { topics: next }).then(() => onTestChange({ ...test, topics: next })).catch((e: Error) => toast(e.message, 'bad'));
  }

  async function upload(kind: PhotoKind, files: FileList | null) {
    const list = Array.from(files ?? []); // copy before any await: the input is reset right after onChange
    if (!list.length) return;
    setPending({ kind, n: list.length });
    let ok = 0;
    for (const f of list) {
      try { await repo.addPhoto(test, kind, await resizeToJpeg(f)); ok++; }
      catch (e) { toast((e as Error).message, 'bad'); }
      setPending((p) => ({ ...p, n: p.n - 1 }));
      loadPhotos();
    }
    if (ok) toast(ok === 1 ? '1 Foto hochgeladen' : `${ok} Fotos hochgeladen`, 'good');
  }

  async function extract(kind: PhotoKind) {
    const todo = photos.filter((p) => p.kind === kind && p.status !== 'extracted');
    let n = 0;
    for (const p of todo) {
      setExtracting(p.id);
      try {
        const r = await repo.extractPhoto(p.id);
        if (r.kind === 'vocab') n += r.words;
        else { toast(`Testformat erkannt: ${r.sections} Aufgaben, ${r.totalPoints} Punkte`, 'good'); const t = await repo.getTest(test.id); onTestChange(t); if (t.topics === null || t.topics.length === 0) saveTopics(suggestTopics(t.format, words.length > 0)); }
      } catch (e) { toast((e as Error).message, 'bad'); }
      await loadPhotos();
    }
    setExtracting(null);
    onWordsChange();
    if (kind === 'vocab' && n > 0) nav(`/t/${test.id}/review`);
  }

  async function remove(p: Photo) {
    try { await repo.deletePhoto(p); setPhotos((ps) => ps.filter((x) => x.id !== p.id)); }
    catch (e) { toast((e as Error).message, 'bad'); }
  }

  const review = words.filter((w) => w.status === 'review').length;
  const active = words.filter((w) => w.status === 'active').length;

  return (
    <>
      <h2 className="h2">1 · Testinhalte hochladen</h2>
      {SECTIONS.map((s) => (
        <PhotoSection key={s.kind} {...s} photos={photos.filter((p) => p.kind === s.kind)} urls={urls} busy={pending.kind === s.kind ? pending.n : 0} extracting={extracting} onFiles={(f) => upload(s.kind, f)} onRemove={remove} onExtract={() => extract(s.kind)} />
      ))}

      <h2 className="h2">2 · Das kommt im Test dran</h2>
      <Card>
        <div className="stack-sm">
          {topics.length === 0 && <p className="text-sm muted">Noch nichts eingetragen. Nach dem Auswerten des Beispieltests schlägt die App Themen vor, du kannst sie hier ändern.</p>}
          {topics.map((t, i) => (
            <div key={i} className="row">
              <input className="input input-sm grow" data-testid="topic" value={t} aria-label="Thema" onChange={(e) => setTopics(topics.map((x, j) => (j === i ? e.target.value : x)))} onBlur={(e) => saveTopics(topics.map((x, j) => (j === i ? e.target.value.trim() : x)).filter(Boolean))} />
              <button className="iconbtn" aria-label="Entfernen" onClick={() => saveTopics(topics.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { saveTopics([...topics, draft.trim()]); setDraft(''); } }}>
            <input className="input input-sm grow" data-testid="topic-new" placeholder="Thema ergänzen, z. B. Sätze bilden" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <Button small type="submit" disabled={!draft.trim()}>+</Button>
          </form>
        </div>
      </Card>

      <h2 className="h2">3 · Vokabeln und Sätze</h2>
      <Card>
        <div className="row">
          <ListIcon />
          <div className="grow">
            <div className="h3">{active + review === 0 ? 'Noch keine Sätze' : `${active + review} Sätze`}</div>
            <div className="text-sm muted">{review > 0 ? `${review} warten auf deine Prüfung` : 'Prüfen, Tippfehler korrigieren, Sterne für wichtige Sätze setzen'}</div>
          </div>
          {active + review > 0 && <Button small data-testid="open-list" onClick={() => nav(`/t/${test.id}/review?all=1`)}>{review > 0 ? 'Prüfen' : 'Öffnen'}</Button>}
        </div>
      </Card>
    </>
  );
}
