import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabaseRepository as repo } from '../../../storage/supabaseRepository';
import type { Award, Photo, PhotoKind, Test, Unit, Word } from '../../../domain/types';
import { PARTS, lessonProgress, splitLessons } from '../../../domain/lessons';
import { AppBar, BackIcon, Badge, Button, CameraIcon, Card, CrownIcon, List, ListItem, StarIcon, useToast } from '../../ds';
import { resizeToJpeg } from '../photos/resize';

const SECTION_LABEL: Record<string, string> = { translate: 'Übersetzen', gap: 'Lückentext', choice: 'Auswahl', match: 'Zuordnen', other: 'Sonstige' };

const SECTIONS: { kind: PhotoKind; title: string; hint: string }[] = [
  { kind: 'vocab', title: 'Vokabelseiten', hint: 'Alle Seiten mit den Vokabeln für diesen Test, eine Seite pro Foto.' },
  { kind: 'test', title: 'Beispieltest', hint: 'Ein alter Test oder eine Übungsseite, damit die Übungen so aussehen wie der echte Test.' },
];

/** S1: photos per test. Capture or pick, resize in the browser, upload to the private bucket, thumbnails via signed URL. */
export function TestScreen() {
  const { testId = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [test, setTest] = useState<Test | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<{ kind: PhotoKind; n: number }>({ kind: 'vocab', n: 0 });
  const [extracting, setExtracting] = useState<string | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [learn, setLearn] = useState<{ active: number; due: number } | null>(null);
  const [lessons, setLessons] = useState<{ units: Unit[]; words: Word[]; awards: Award[] } | null>(null);

  const load = () => Promise.all([repo.listPhotos(testId), repo.listWords(testId), repo.listWordStates(testId), repo.listUnits(testId)]).then(async ([p, w, st, units]) => {
    setPhotos(p); setReviewCount(w.filter((x) => x.status === 'review').length);
    const t = test ?? (await repo.getTest(testId));
    setLessons({ units, words: w, awards: await repo.listAwards(t.profileId) });
    const now = new Date(); const states = new Map(st.map((s) => [s.wordId, s]));
    const active = w.filter((x) => x.status === 'active');
    setLearn({ active: active.length, due: active.filter((x) => { const s = states.get(x.id); return !s || (new Date(s.dueAt) <= now && !(s.box === 5 && s.lastResult)); }).length });
  }).catch((e: Error) => toast(e.message, 'bad'));
  useEffect(() => { repo.getTest(testId).then(setTest).catch((e: Error) => toast(e.message, 'bad')); load(); }, [testId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    photos.filter((p) => !urls[p.id]).forEach((p) => repo.photoUrl(p).then((u) => setUrls((s) => ({ ...s, [p.id]: u }))).catch(() => undefined));
  }, [photos]); // eslint-disable-line react-hooks/exhaustive-deps

  async function upload(kind: PhotoKind, files: FileList | null) {
    const list = Array.from(files ?? []); // copy before any await: the input is reset right after onChange
    if (!list.length) return;
    setPending({ kind, n: list.length });
    const target = test ?? (await repo.getTest(testId)); // the user can be faster than the first fetch
    let ok = 0;
    for (const f of list) {
      try {
        const jpeg = await resizeToJpeg(f);
        await repo.addPhoto(target, kind, jpeg);
        ok++;
      } catch (e) { toast((e as Error).message, 'bad'); }
      setPending((p) => ({ ...p, n: p.n - 1 }));
      load();
    }
    if (ok) toast(ok === 1 ? '1 Foto hochgeladen' : `${ok} Fotos hochgeladen`, 'good');
  }

  async function extract(kind: PhotoKind) {
    const todo = photos.filter((p) => p.kind === kind && p.status !== 'extracted');
    let words = 0;
    for (const p of todo) {
      setExtracting(p.id);
      try {
        const r = await repo.extractPhoto(p.id);
        if (r.kind === 'vocab') words += r.words;
        else { toast(`Testformat erkannt: ${r.sections} Aufgaben, ${r.totalPoints} Punkte`, 'good'); repo.getTest(testId).then(setTest); }
      } catch (e) { toast((e as Error).message, 'bad'); }
      await load();
    }
    setExtracting(null);
    if (kind === 'vocab' && words > 0) nav(`/t/${testId}/review`);
  }

  async function remove(p: Photo) {
    try { await repo.deletePhoto(p); setPhotos((ps) => ps.filter((x) => x.id !== p.id)); }
    catch (e) { toast((e as Error).message, 'bad'); }
  }

  const vocab = photos.filter((p) => p.kind === 'vocab').length;
  const sample = photos.filter((p) => p.kind === 'test').length;

  return (
    <>
      <AppBar title={test?.name ?? '…'} left={<button className="iconbtn" aria-label="Zurück" onClick={() => (test ? nav(`/p/${test.profileId}`) : nav('/'))}><BackIcon /></button>} />
      <main className="page stack">
        {lessons && lessons.units.map((u) => {
          const ls = splitLessons(lessons.words).filter((l) => l.unitId === u.id);
          if (!ls.length) return null;
          return (
            <Card key={u.id} title={u.label}>
              <List>
                {ls.map((l) => {
                  const p = lessonProgress(lessons.awards, u.id, l.n);
                  return <ListItem key={l.n} testId={`lesson-${u.id}-${l.n}`} lead={p.crown ? <span style={{ color: 'var(--accent)' }}><CrownIcon /></span> : <span>{l.n}</span>} title={`Lektion ${l.n}`} sub={p.nextPart === 0 ? `${l.words.length} Sätze · noch nicht begonnen` : p.nextPart < PARTS.length ? `Runde ${p.nextPart + 1} von ${PARTS.length}` : `${p.total} von 15 Sternen`} trail={p.total > 0 ? <span className="row text-sm" style={{ color: 'var(--accent)' }}><StarIcon />{p.total}</span> : undefined} onClick={() => nav(`/t/${testId}/lesson/${u.id}/${l.n}`)} />;
                })}
              </List>
            </Card>
          );
        })}
        {learn && learn.active > 0 && learn.due > 0 && lessons && splitLessons(lessons.words).some((l) => lessonProgress(lessons.awards, l.unitId, l.n).nextPart > 0) && (
          <Card accent>
            <div className="row"><div className="grow">
              <div className="h3">{learn.due} Sätze zum Wiederholen</div>
              <div className="text-sm muted">Gemischt aus allen begonnenen Lektionen</div>
            </div><Button data-testid="learn" onClick={() => nav(`/t/${testId}/learn`)}>Wiederholen</Button></div>
          </Card>
        )}
        {SECTIONS.map((s) => (
          <PhotoSection key={s.kind} {...s} photos={photos.filter((p) => p.kind === s.kind)} urls={urls} busy={pending.kind === s.kind ? pending.n : 0} extracting={extracting} onFiles={(f) => upload(s.kind, f)} onRemove={remove} onExtract={() => extract(s.kind)} />
        ))}
        {test?.format && (
          <Card title="Testformat">
            <div className="stack-sm">
              {test.format.sections.map((s, i) => <div key={i} className="row-between text-sm"><span>{SECTION_LABEL[s.type]}{s.label ? ` · ${s.label}` : ''}</span><span className="muted">{s.items} Aufgaben · {s.points} P.</span></div>)}
              <div className="row-between text-sm"><strong>Gesamt</strong><strong>{test.format.totalPoints} Punkte{test.format.passMark ? ` · bestanden ab ${test.format.passMark}` : ''}</strong></div>
            </div>
          </Card>
        )}
        <Card accent>
          <div className="row"><CameraIcon /><div className="grow">
            <div className="h3">Nächster Schritt</div>
            <div className="text-sm muted">{reviewCount > 0 ? `${reviewCount} Wörter warten auf deine Prüfung.` : vocab === 0 ? 'Zuerst die Vokabelseiten fotografieren.' : photos.some((p) => p.status !== 'extracted') ? 'Fotos auswerten lassen.' : sample === 0 ? 'Noch den Beispieltest fotografieren.' : 'Lernen kommt mit S3.'}</div>
          </div>{reviewCount > 0 && <Button small onClick={() => nav(`/t/${testId}/review`)}>Prüfen</Button>}</div>
        </Card>
      </main>
    </>
  );
}

function PhotoSection({ kind, title, hint, photos, urls, busy, extracting, onFiles, onRemove, onExtract }: { kind: PhotoKind; title: string; hint: string; photos: Photo[]; urls: Record<string, string>; busy: number; extracting: string | null; onFiles: (f: FileList | null) => void; onRemove: (p: Photo) => void; onExtract: () => void }) {
  const open = photos.filter((p) => p.status !== 'extracted').length;
  const cam = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  return (
    <Card title={`${title}${photos.length ? ` (${photos.length})` : ''}`}>
      <div className="stack-sm">
        {photos.length === 0 && busy === 0 && <p className="text-sm muted">{hint}</p>}
        {(photos.length > 0 || busy > 0) && (
          <div className="thumbs" data-testid={`thumbs-${kind}`}>
            {photos.map((p) => (
              <div key={p.id} className="thumb">
                {urls[p.id] && <img src={urls[p.id]} alt="" />}
                <span className="thumb-state">{extracting === p.id ? <Badge tone="primary">liest…</Badge> : p.status === 'extracted' ? <Badge tone="good">✓</Badge> : p.status === 'failed' ? <Badge tone="bad">Fehler</Badge> : null}</span>
                <button className="thumb-x" data-testid="thumb-delete" aria-label="Foto löschen" onClick={() => onRemove(p)}>×</button>
              </div>
            ))}
            {Array.from({ length: busy }, (_, i) => <div key={`b${i}`} className="thumb thumb-busy">lädt…</div>)}
          </div>
        )}
        <div className="row">
          <Button block variant={open ? 'secondary' : 'primary'} onClick={() => cam.current?.click()} disabled={busy > 0 || !!extracting}><CameraIcon /> Foto</Button>
          <Button block variant="secondary" onClick={() => pick.current?.click()} disabled={busy > 0 || !!extracting}>Galerie</Button>
        </div>
        {open > 0 && <Button block data-testid={`extract-${kind}`} onClick={onExtract} disabled={busy > 0 || !!extracting}>{extracting ? 'Wird gelesen…' : open === 1 ? '1 Foto auswerten' : `${open} Fotos auswerten`}</Button>}
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
        <input ref={pick} type="file" accept="image/*" multiple hidden data-testid={`pick-${kind}`} onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
      </div>
    </Card>
  );
}
