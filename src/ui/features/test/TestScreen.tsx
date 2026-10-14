import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabaseRepository as repo } from '../../../storage/supabaseRepository';
import type { Award, Photo, PhotoKind, Test, Unit, Word } from '../../../domain/types';
import { MAX_STARS, PARTS, lessonProgress, splitLessons } from '../../../domain/lessons';
import { AppBar, BackIcon, BookIcon, Button, CameraIcon, Card, CrownIcon, EmptyState, List, ListItem, StarIcon, TabBar, TestIcon, useToast } from '../../ds';
import { resizeToJpeg } from '../photos/resize';
import { PhotoSection, SECTIONS } from './PhotoSection';

const SECTION_LABEL: Record<string, string> = { translate: 'Übersetzen', gap: 'Lückentext', choice: 'Auswahl', match: 'Zuordnen', other: 'Sonstige' };
type Tab = 'fotos' | 'lernen' | 'probetest';
const TABS = [{ id: 'fotos', label: 'Fotos', icon: <CameraIcon /> }, { id: 'lernen', label: 'Lernen', icon: <BookIcon /> }, { id: 'probetest', label: 'Probetest', icon: <TestIcon /> }];

/** One test: three tabs. Fotos (upload + extraction), Lernen (lessons, review), Probetest (S4). Opens on Lernen once sentences exist. */
export function TestScreen() {
  const { testId = '' } = useParams();
  const [params, setParams] = useSearchParams();
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

  // default tab: Lernen as soon as sentences exist, Fotos before
  const tab = (params.get('tab') as Tab | null) ?? (learn === null ? null : learn.active > 0 ? 'lernen' : 'fotos');
  const setTab = (id: string) => setParams({ tab: id }, { replace: true });

  async function upload(kind: PhotoKind, files: FileList | null) {
    const list = Array.from(files ?? []); // copy before any await: the input is reset right after onChange
    if (!list.length) return;
    setPending({ kind, n: list.length });
    const target = test ?? (await repo.getTest(testId)); // the user can be faster than the first fetch
    let ok = 0;
    for (const f of list) {
      try { await repo.addPhoto(target, kind, await resizeToJpeg(f)); ok++; }
      catch (e) { toast((e as Error).message, 'bad'); }
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
  const allLessons = lessons ? splitLessons(lessons.words) : [];

  return (
    <>
      <AppBar title={test?.name ?? '…'} left={<button className="iconbtn" aria-label="Zurück" onClick={() => nav('/')}><BackIcon /></button>} />
      <main className="page stack" style={{ paddingBottom: 'calc(var(--s-5) * 3)' }}>
        {tab === 'fotos' && (
          <>
            {SECTIONS.map((s) => (
              <PhotoSection key={s.kind} {...s} photos={photos.filter((p) => p.kind === s.kind)} urls={urls} busy={pending.kind === s.kind ? pending.n : 0} extracting={extracting} onFiles={(f) => upload(s.kind, f)} onRemove={remove} onExtract={() => extract(s.kind)} />
            ))}
            <Card accent>
              <div className="row"><CameraIcon /><div className="grow">
                <div className="h3">Nächster Schritt</div>
                <div className="text-sm muted">{reviewCount > 0 ? `${reviewCount} Wörter warten auf deine Prüfung.` : vocab === 0 ? 'Zuerst die Vokabelseiten fotografieren.' : photos.some((p) => p.status !== 'extracted') ? 'Fotos auswerten lassen.' : sample === 0 ? 'Noch den Beispieltest fotografieren.' : 'Alles da. Ab zum Lernen.'}</div>
              </div>{reviewCount > 0 ? <Button small onClick={() => nav(`/t/${testId}/review`)}>Prüfen</Button> : learn && learn.active > 0 && photos.every((p) => p.status === 'extracted') ? <Button small onClick={() => setTab('lernen')}>Lernen</Button> : null}</div>
            </Card>
          </>
        )}
        {tab === 'lernen' && lessons && (
          allLessons.length === 0 ? (
            <Card flat><EmptyState icon={<BookIcon />} title="Noch keine Sätze" text="Fotografiere die Vokabelseiten und lass sie auswerten, dann geht es hier los." action={<Button onClick={() => setTab('fotos')}>Zu den Fotos</Button>} /></Card>
          ) : (
            <>
              {learn && learn.due > 0 && allLessons.some((l) => lessonProgress(lessons.awards, l.unitId, l.n).nextPart > 0) && (
                <Card accent>
                  <div className="row"><div className="grow">
                    <div className="h3">{learn.due} Sätze zum Wiederholen</div>
                    <div className="text-sm muted">Gemischt aus allen begonnenen Lektionen</div>
                  </div><Button data-testid="learn" onClick={() => nav(`/t/${testId}/learn`)}>Wiederholen</Button></div>
                </Card>
              )}
              {lessons.units.map((u) => {
                const ls = allLessons.filter((l) => l.unitId === u.id);
                if (!ls.length) return null;
                return (
                  <Card key={u.id} title={u.label}>
                    <List>
                      {ls.map((l) => {
                        const p = lessonProgress(lessons.awards, u.id, l.n);
                        return <ListItem key={l.n} testId={`lesson-${u.id}-${l.n}`} lead={p.crown ? <span style={{ color: 'var(--accent)' }}><CrownIcon /></span> : <span>{l.n}</span>} title={`Lektion ${l.n}`} sub={p.nextPart === 0 ? `${l.words.length} Sätze · noch nicht begonnen` : p.nextPart < PARTS.length ? `Runde ${p.nextPart + 1} von ${PARTS.length}` : `${p.total} von ${MAX_STARS} Sternen`} trail={p.total > 0 ? <span className="row text-sm" style={{ color: 'var(--accent)' }}><StarIcon />{p.total}</span> : undefined} onClick={() => nav(`/t/${testId}/lesson/${u.id}/${l.n}`)} />;
                      })}
                    </List>
                  </Card>
                );
              })}
            </>
          )
        )}
        {tab === 'probetest' && (
          <>
            {test?.format ? (
              <Card title="So sieht der echte Test aus">
                <div className="stack-sm">
                  {test.format.sections.map((s, i) => <div key={i} className="row-between text-sm"><span>{SECTION_LABEL[s.type]}{s.label ? ` · ${s.label}` : ''}</span><span className="muted">{s.items} Aufgaben · {s.points} P.</span></div>)}
                  <div className="row-between text-sm"><strong>Gesamt</strong><strong>{test.format.totalPoints} Punkte{test.format.passMark ? ` · bestanden ab ${test.format.passMark}` : ''}</strong></div>
                </div>
              </Card>
            ) : (
              <Card flat><EmptyState icon={<TestIcon />} title="Kein Testformat" text="Fotografiere einen alten Test, dann baut die App den Probetest genauso auf." action={<Button onClick={() => setTab('fotos')}>Zu den Fotos</Button>} /></Card>
            )}
            <Card accent><div className="h3">Probetest</div><p className="text-sm muted" style={{ margin: 0 }}>Kommt als Nächstes (S4): ein Test im echten Format mit Punkten, Bereitschaft und Krone.</p></Card>
          </>
        )}
      </main>
      {tab && <TabBar tabs={TABS} active={tab} onSelect={setTab} />}
    </>
  );
}
