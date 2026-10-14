import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabaseRepository as repo } from '../../../storage/supabaseRepository';
import type { Award, Test, Unit, Word } from '../../../domain/types';
import { MAX_STARS, PARTS, lessonProgress, splitLessons } from '../../../domain/lessons';
import { AppBar, BackIcon, Button, Card, ClipboardCheckIcon, CrownIcon, EmptyState, FileTextIcon, GraduationIcon, List, ListItem, Modal, StarIcon, TabBar, TestIcon, useToast } from '../../ds';
import { SettingsTab } from './SettingsTab';

type Tab = 'lernen' | 'probetest' | 'einstellungen';
const TABS = [{ id: 'einstellungen', label: 'Testinhalt', icon: <FileTextIcon /> }, { id: 'lernen', label: 'Lernen', icon: <GraduationIcon /> }, { id: 'probetest', label: 'Probetest', icon: <ClipboardCheckIcon /> }];

/** One test: three tabs. Lernen (parts, review), Probetest (S4), Einstellungen (upload, topics, sentence list). Opens on Lernen once sentences exist. */
export function TestScreen() {
  const { testId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const [test, setTest] = useState<Test | null>(null);
  const [learn, setLearn] = useState<{ active: number; due: number } | null>(null);
  const [lessons, setLessons] = useState<{ units: Unit[]; words: Word[]; awards: Award[] } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const load = () => Promise.all([repo.listWords(testId), repo.listWordStates(testId), repo.listUnits(testId)]).then(async ([w, st, units]) => {
    const t = test ?? (await repo.getTest(testId));
    setLessons({ units, words: w, awards: await repo.listAwards(t.profileId) });
    const now = new Date(); const states = new Map(st.map((s) => [s.wordId, s]));
    const active = w.filter((x) => x.status === 'active');
    setLearn({ active: active.length, due: active.filter((x) => { const s = states.get(x.id); return !s || (new Date(s.dueAt) <= now && !(s.box === 5 && s.lastResult)); }).length });
  }).catch((e: Error) => toast(e.message, 'bad'));
  useEffect(() => { repo.getTest(testId).then(setTest).catch((e: Error) => toast(e.message, 'bad')); load(); }, [testId]); // eslint-disable-line react-hooks/exhaustive-deps

  // default tab: Lernen as soon as sentences exist, Einstellungen before
  const tab = (params.get('tab') as Tab | null) ?? (learn === null ? null : learn.active > 0 ? 'lernen' : 'einstellungen');
  const setTab = (id: string) => setParams({ tab: id }, { replace: true });

  async function resetAll() {
    if (!test || !lessons) return;
    try {
      await repo.resetTestProgress(test.profileId, lessons.units.map((u) => u.id), lessons.words.map((w) => w.id));
      toast('Lernfortschritt gelöscht', 'good');
      load();
    } catch (e) { toast((e as Error).message, 'bad'); }
    setConfirmReset(false);
  }

  const allLessons = lessons ? splitLessons(lessons.words) : [];

  return (
    <>
      <AppBar title={test?.name ?? '…'} left={<button className="iconbtn" aria-label="Zurück" onClick={() => nav('/')}><BackIcon /></button>} />
      <main className="page stack" style={{ paddingBottom: 'calc(var(--s-5) * 3)' }}>
        {tab === 'einstellungen' && test && lessons && <SettingsTab test={test} words={lessons.words} onTestChange={setTest} onWordsChange={load} />}
        {tab === 'lernen' && lessons && (
          allLessons.length === 0 ? (
            <Card flat><EmptyState icon={<GraduationIcon />} title="Noch keine Sätze" text="Lade unter Testinhalt die Vokabelseiten hoch und lass sie auswerten, dann geht es hier los." action={<Button onClick={() => setTab('einstellungen')}>Zum Testinhalt</Button>} /></Card>
          ) : (
            <>
              {learn && learn.due > 0 && allLessons.some((l) => lessonProgress(lessons.awards, l.unitId, l.n).nextPart > 0) && (
                <Card accent>
                  <div className="row"><div className="grow">
                    <div className="h3">{learn.due} Sätze zum Wiederholen</div>
                    <div className="text-sm muted">Gemischt aus allen begonnenen Teilen</div>
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
                        return <ListItem key={l.n} testId={`lesson-${u.id}-${l.n}`} lead={p.crown ? <span style={{ color: 'var(--accent)' }}><CrownIcon /></span> : <span>{l.n}</span>} title={`Teil ${l.n}`} sub={p.nextPart === 0 ? `${l.words.length} Sätze · noch nicht begonnen` : p.nextPart < PARTS.length ? `Runde ${p.nextPart + 1} von ${PARTS.length}` : `${p.total} von ${MAX_STARS} Sternen`} trail={p.total > 0 ? <span className="row text-sm" style={{ color: 'var(--accent)' }}><StarIcon />{p.total}</span> : undefined} onClick={() => nav(`/t/${testId}/lesson/${u.id}/${l.n}`)} />;
                      })}
                    </List>
                  </Card>
                );
              })}
              {lessons.awards.length > 0 && <Button block variant="ghost" data-testid="reset-all" onClick={() => setConfirmReset(true)}>Gesamten Lernfortschritt löschen</Button>}
            </>
          )
        )}
        {tab === 'probetest' && (
          !test?.format
            ? <Card flat><EmptyState icon={<TestIcon />} title="Kein Testformat" text="Lade unter Testinhalt einen alten Test hoch, dann baut die App den Probetest genauso auf." action={<Button onClick={() => setTab('einstellungen')}>Zum Testinhalt</Button>} /></Card>
            : <Card accent><div className="h3">Probetest</div><p className="text-sm muted" style={{ margin: 0 }}>Kommt als Nächstes (S4): ein Test im echten Format mit Punkten, Bereitschaft und Krone.</p></Card>
        )}
      </main>
      {tab && <TabBar tabs={TABS} active={tab} onSelect={setTab} />}
      <Modal open={confirmReset} title="Alles zurücksetzen?" onClose={() => setConfirmReset(false)} actions={<><Button variant="danger" data-testid="reset-all-yes" onClick={resetAll}>Ja, alles löschen</Button><Button variant="ghost" onClick={() => setConfirmReset(false)}>Abbrechen</Button></>}>
        <p className="text-sm muted">Alle Sterne, Kronen und Lernstände dieses Tests werden gelöscht. Die Sätze und Fotos bleiben.</p>
      </Modal>
    </>
  );
}
