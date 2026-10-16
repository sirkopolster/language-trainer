import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabaseRepository as repo } from '../../../storage/supabaseRepository';
import type { Award, Profile, Test, Unit, Word, WordState } from '../../../domain/types';
import { MAX_STARS, PARTS, lessonProgress, splitLessons } from '../../../domain/lessons';
import { readiness } from '../../../domain/mock';
import { SPECIAL, type SpecialKind } from '../../../domain/grammar';
import { fmtDate } from './NewTestModal';
import { AppBar, BackIcon, Button, Card, ClipboardCheckIcon, ColorIcon, CrownIcon, EddieSays, EmptyState, FileTextIcon, GraduationIcon, Input, List, ListItem, Modal, PencilIcon, RocketIcon, SproutIcon, StarIcon, TabBar, TestIcon, TrophyIcon, useToast } from '../../ds';
import { daysUntil, fmtNum, resultLine } from './TestCard';
import { SettingsTab } from './SettingsTab';

const SECTION_LABEL: Record<string, string> = { translate: 'Übersetzen', gap: 'Lückentext', choice: 'Auswahl', match: 'Zuordnen', other: 'Sonstige' };
type Tab = 'lernen' | 'probetest' | 'einstellungen';
const TABS = [{ id: 'einstellungen', label: 'Testinhalt', icon: <FileTextIcon /> }, { id: 'lernen', label: 'Lernen', icon: <GraduationIcon /> }, { id: 'probetest', label: 'Probetest', icon: <ClipboardCheckIcon /> }];

/** One test: three tabs. Lernen (parts, review), Probetest (S4), Einstellungen (upload, topics, sentence list). Opens on Lernen once sentences exist. */
export function TestScreen() {
  const { testId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const [test, setTest] = useState<Test | null>(null);
  const [learn, setLearn] = useState<{ active: number; due: number; secureShare: number } | null>(null);
  const [mocks, setMocks] = useState<{ startedAt: string; score: number; maxScore: number; passed: boolean }[]>([]);
  const [lessons, setLessons] = useState<{ units: Unit[]; words: Word[]; awards: Award[] } | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [others, setOthers] = useState<{ profile: Profile; awards: Award[]; states: WordState[]; mocks: number }[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [rename, setRename] = useState<string | null>(null);
  const [building, setBuilding] = useState<SpecialKind | null>(null);

  async function buildSpecial(kind: SpecialKind) {
    setBuilding(kind);
    try { const r = await repo.generateSpecial(testId, kind); toast(`${SPECIAL[kind].label}: ${r.pairs} Satzpaare`, 'good'); await load(); }
    catch (e) { toast((e as Error).message, 'bad'); }
    setBuilding(null);
  }

  async function saveName() {
    const n = (rename ?? '').trim();
    if (!n || !test) return;
    try { await repo.updateTest(testId, { name: n }); setTest({ ...test, name: n }); toast('Name geändert', 'good', 1500); }
    catch (e) { toast((e as Error).message, 'bad'); }
    setRename(null);
  }

  // inline title: name + pencil, or an input that saves on Enter / blur
  const title = rename === null
    ? <span className="title-edit"><span className="appbar-title" style={{ flex: '0 1 auto' }}>{test?.name ?? '…'}</span><button className="iconbtn" data-testid="test-rename" aria-label="Test umbenennen" onClick={() => setRename(test?.name ?? '')}><PencilIcon /></button></span>
    : <input className="title-input" data-testid="test-rename-input" value={rename} autoFocus aria-label="Name des Tests" onChange={(e) => setRename(e.target.value)} onBlur={saveName} onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setRename(null); }} />;

  const load = () => repo.getMyProfile().then((my) => Promise.all([repo.listWords(testId), repo.listWordStates(testId, my?.id ?? ''), repo.listUnits(testId)]).then(async ([w, st, units]) => {
    setMe(my);
    setLessons({ units, words: w, awards: my ? await repo.listAwards(my.id) : [] });
    // every learner who touched this test (an admin sees the children, a child only itself)
    const unitIds = new Set(units.map((u) => u.id));
    const [profiles, allAwards, allStates, allSessions] = await Promise.all([repo.listProfiles(), repo.listAllAwards(), repo.listAllWordStates(), repo.listAllSessions()]);
    const wordIds = new Set(w.map((x) => x.id));
    setOthers(profiles.map((profile) => ({ profile, awards: allAwards.filter((a) => a.profileId === profile.id && (unitIds.has(a.refId ?? '') || a.refId === testId)), states: allStates.filter((x) => x.profileId === profile.id && wordIds.has(x.wordId)), mocks: allSessions.filter((x) => x.profileId === profile.id && x.kind === 'mock').length })).filter((o) => o.awards.length > 0 || o.states.length > 0));
    const now = new Date(); const states = new Map(st.map((s) => [s.wordId, s]));
    const active = w.filter((x) => x.status === 'active');
    const mk = await repo.listMocks(testId); setMocks(mk);
    setLearn({ active: active.length, due: active.filter((x) => { const s = states.get(x.id); return !s || (new Date(s.dueAt) <= now && !(s.box === 5 && s.lastResult)); }).length, secureShare: readiness(w, states, mk).share });
  })).catch((e: Error) => toast(e.message, 'bad'));
  useEffect(() => { repo.getTest(testId).then(setTest).catch((e: Error) => toast(e.message, 'bad')); load(); }, [testId]); // eslint-disable-line react-hooks/exhaustive-deps

  // default tab: Lernen as soon as sentences exist, Einstellungen before
  const tab = (params.get('tab') as Tab | null) ?? (learn === null ? null : learn.active > 0 ? 'lernen' : 'einstellungen');
  const setTab = (id: string) => setParams({ tab: id }, { replace: true });

  async function resetAll() {
    if (!test || !lessons || !me) return;
    try {
      await repo.resetTestProgress(me.id, lessons.units.map((u) => u.id), lessons.words.map((w) => w.id));
      toast('Lernfortschritt gelöscht', 'good');
      load();
    } catch (e) { toast((e as Error).message, 'bad'); }
    setConfirmReset(false);
  }

  const allLessons = lessons ? splitLessons(lessons.words) : [];

  return (
    <>
      <AppBar title={title} left={<button className="iconbtn" aria-label="Zurück" onClick={() => nav('/')}><BackIcon /></button>} />
      <main className="page stack" style={{ paddingBottom: 'calc(var(--s-5) * 3)' }}>
        {test && tab && (test.result || (daysUntil(test.testDate) ?? 0) < 0) && <ResultCard test={test} onChange={setTest} />}
        {tab === 'einstellungen' && lessons && <EddieSays>{lessons.words.length === 0 ? 'Lade die Vokabelseiten und einen alten Test hoch, dann lese ich alles ein.' : 'Hier kannst du Fotos ergänzen, Themen eintragen und die Sätze prüfen.'}</EddieSays>}
        {tab === 'einstellungen' && test && lessons && <SettingsTab test={test} words={lessons.words} onTestChange={setTest} onWordsChange={load} />}
        {tab === 'lernen' && lessons && (
          allLessons.length === 0 ? (
            <Card flat><EmptyState icon={<GraduationIcon />} title="Noch keine Sätze" text="Lade unter Testinhalt die Vokabelseiten hoch und lass sie auswerten, dann geht es hier los." action={<Button onClick={() => setTab('einstellungen')}>Zum Testinhalt</Button>} /></Card>
          ) : (
            <>
              <EddieSays>{(() => { const open = allLessons.find((l) => lessonProgress(lessons.awards, l.unitId, l.n).nextPart < PARTS.length); const started = allLessons.some((l) => lessonProgress(lessons.awards, l.unitId, l.n).nextPart > 0); return !started ? 'Such dir Teil 1 aus und leg los!' : learn && learn.due > 0 ? `${learn.due} Sätze warten darauf, wiederholt zu werden.` : open ? `Weiter geht’s mit Teil ${open.n}.` : 'Alle Teile geschafft. Zeit für den Probetest!'; })()}</EddieSays>
              {learn && learn.due > 0 && allLessons.some((l) => lessonProgress(lessons.awards, l.unitId, l.n).nextPart > 0) && (
                <Card accent>
                  <div className="row"><div className="grow">
                    <div className="h3">{learn.due} Sätze zum Wiederholen</div>
                    <div className="text-sm muted">Gemischt aus allen begonnenen Teilen</div>
                  </div><Button data-testid="learn" onClick={() => nav(`/t/${testId}/learn`)}>Wiederholen</Button></div>
                </Card>
              )}
              {[...lessons.units].sort((a, b) => a.sort - b.sort).map((u) => {
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
              {others.length > 0 && (
                <Card title="Wer lernt diesen Test?">
                  <List>
                    {others.map((o) => {
                      const stars = o.awards.filter((a) => a.kind === 'star').reduce((n, a) => n + a.value, 0);
                      const crowns = o.awards.filter((a) => a.kind === 'crown').length;
                      const secure = o.states.filter((x) => x.box >= 3).length;
                      return <ListItem key={o.profile.id} lead={<ColorIcon color={o.profile.own ? 'violet' : 'green'}>{o.profile.name.slice(0, 1).toUpperCase()}</ColorIcon>} title={`${o.profile.name}${o.profile.own ? ' (du)' : ''}`} sub={`${stars} Sterne · ${crowns} Kronen · ${secure} Sätze sicher · ${o.mocks} Probetests`} />;
                    })}
                  </List>
                </Card>
              )}
              <Card title="Spezialteile">
                <p className="text-sm muted">Eddie baut aus deinen Sätzen Extra-Übungen. Nur Sätze, deren Verben dafür taugen.</p>
                <List>
                  {(['tense', 'negation'] as SpecialKind[]).map((k) => {
                    const u = lessons.units.find((x) => x.kind === k);
                    const n = u ? lessons.words.filter((w) => w.unitId === u.id).length : 0;
                    return <ListItem key={k} lead={<ColorIcon color={k === 'tense' ? 'pink' : 'blue'}>{k === 'tense' ? 'A' : 'B'}</ColorIcon>} title={SPECIAL[k].title} sub={u ? `${n} Satzpaare · oben als ${SPECIAL[k].label}` : 'noch nicht erstellt'} trail={<Button small variant={u ? 'secondary' : 'primary'} data-testid={`special-${k}`} disabled={building !== null} onClick={() => buildSpecial(k)}>{building === k ? 'Eddie denkt…' : u ? 'Neu erstellen' : 'Erstellen'}</Button>} />;
                  })}
                </List>
              </Card>
              {lessons.awards.length > 0 && <Button block variant="ghost" data-testid="reset-all" onClick={() => setConfirmReset(true)}>Gesamten Lernfortschritt löschen</Button>}
            </>
          )
        )}
        {tab === 'probetest' && (
          !test?.format
            ? <Card flat><EmptyState icon={<TestIcon />} title="Kein Testformat" text="Lade unter Testinhalt einen alten Test hoch, dann baut die App den Probetest genauso auf." action={<Button onClick={() => setTab('einstellungen')}>Zum Testinhalt</Button>} /></Card>
            : learn && learn.active === 0
              ? <Card flat><EmptyState icon={<TestIcon />} title="Noch keine Sätze" text="Erst die Vokabelseiten auswerten, dann kann Eddie einen Probetest bauen." action={<Button onClick={() => setTab('einstellungen')}>Zum Testinhalt</Button>} /></Card>
              : <ProbetestTab test={test} testId={testId} secureShare={learn?.secureShare ?? 0} mocks={mocks} onStart={() => nav(`/t/${testId}/mock`)} />
        )}
      </main>
      {tab && <TabBar tabs={TABS} active={tab} onSelect={setTab} />}
      <Modal open={confirmReset} title="Alles zurücksetzen?" onClose={() => setConfirmReset(false)} actions={<><Button variant="danger" data-testid="reset-all-yes" onClick={resetAll}>Ja, alles löschen</Button><Button variant="ghost" onClick={() => setConfirmReset(false)}>Abbrechen</Button></>}>
        <p className="text-sm muted">Alle Sterne, Kronen und Lernstände dieses Tests werden gelöscht. Die Sätze und Fotos bleiben.</p>
      </Modal>
    </>
  );
}

function ProbetestTab({ test, secureShare, mocks, onStart }: { test: Test; testId: string; secureShare: number; mocks: { startedAt: string; score: number; maxScore: number; passed: boolean }[]; onStart: () => void }) {
  const level = secureShare >= 0.85 && mocks[0]?.passed ? 'ready' : secureShare >= 0.6 ? 'almost' : 'practice';
  const R = {
    practice: { label: 'Noch üben', text: 'Lern erst ein paar Teile durch, dann lohnt sich der Probetest richtig.', color: 'blue' as const, icon: <SproutIcon /> },
    almost: { label: 'Fast bereit', text: 'Die meisten Sätze sitzen. Ein Probetest zeigt dir, was noch wackelt.', color: 'orange' as const, icon: <RocketIcon /> },
    ready: { label: 'Bereit', text: 'Sätze sitzen und der letzte Probetest war bestanden. Du bist so weit!', color: 'yellow' as const, icon: <TrophyIcon /> },
  }[level];
  const f = test.format!;
  return (
    <>
      <EddieSays>{R.text}</EddieSays>
      <Button block data-testid="mock-start" onClick={onStart}>Probetest starten</Button>
      <Card>
        <div className="readiness"><ColorIcon color={R.color} large>{R.icon}</ColorIcon><div className="grow"><div className="h3">{R.label}</div><div className="text-sm muted">{Math.round(secureShare * 100)} % der Sätze sicher{mocks[0] ? ` · letzter Probetest ${mocks[0].score} / ${mocks[0].maxScore}` : ''}</div></div></div>
      </Card>
      <Card title="So ist der Test aufgebaut">
        <div className="stack-sm">
          {f.sections.filter((s) => s.type !== 'other').map((s, i) => <div key={i} className="row-between text-sm"><span>{s.label ?? SECTION_LABEL[s.type]}</span><span className="muted">{s.items} Aufgaben · {s.points} P.</span></div>)}
          <div className="row-between text-sm"><strong>Bestanden ab</strong><strong>{f.passMark ?? Math.round(f.totalPoints * 0.8 * 10) / 10} von {f.totalPoints} Punkten</strong></div>
        </div>
      </Card>
      {mocks.length > 0 && (
        <Card title="Bisherige Probetests">
          <List>
            {mocks.slice(0, 10).map((m, i) => <ListItem key={i} lead={m.passed ? <ColorIcon color="yellow"><CrownIcon /></ColorIcon> : <ColorIcon color="blue"><ClipboardCheckIcon /></ColorIcon>} title={`${m.score} / ${m.maxScore} Punkte`} sub={`${fmtDate(m.startedAt)} · ${m.passed ? 'bestanden' : 'nicht bestanden'}`} />)}
          </List>
        </Card>
      )}
    </>
  );
}

/** D-022: after the test day the learner enters the real result as "x von y"; y is prefilled from the test format. Editable afterwards. */
function ResultCard({ test, onChange }: { test: Test; onChange: (t: Test) => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState(!test.result);
  const [score, setScore] = useState(test.result ? String(test.result.score) : '');
  const [max, setMax] = useState(String(test.result?.max ?? test.format?.totalPoints ?? ''));
  const num = (v: string) => Number(v.replace(',', '.'));
  const valid = score.trim() !== '' && max.trim() !== '' && Number.isFinite(num(score)) && Number.isFinite(num(max)) && num(max) > 0 && num(score) >= 0 && num(score) <= num(max);
  async function save() {
    if (!valid) return;
    const result = { score: num(score), max: num(max) };
    try { await repo.updateTest(test.id, { result }); onChange({ ...test, result, status: 'done' }); setEditing(false); toast('Ergebnis gespeichert', 'good', 1500); }
    catch (e) { toast((e as Error).message, 'bad'); }
  }
  if (!editing && test.result) {
    const share = test.result.score / test.result.max;
    return (
      <Card accent>
        <div className="row"><ColorIcon color={share >= 0.8 ? 'yellow' : 'orange'} large><TrophyIcon /></ColorIcon><div className="grow"><div className="h3" data-testid="result-line">{resultLine(test.result)}</div><div className="text-sm muted">{share >= 0.9 ? 'Spitze! Eddie ist mächtig stolz.' : share >= 0.6 ? 'Gut gemacht. Beim nächsten Test geht noch mehr.' : 'Nicht traurig sein, nächstes Mal packst du es.'}</div></div><Button small variant="secondary" data-testid="result-edit" onClick={() => setEditing(true)}>Ändern</Button></div>
      </Card>
    );
  }
  return (
    <Card accent title="Wie ist der Test gelaufen?">
      <p className="text-sm muted" style={{ marginTop: 0 }}>Trag dein Ergebnis ein, so wie es auf dem Test steht.</p>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <Input label="Punkte" type="number" inputMode="decimal" min={0} step="0.5" data-testid="result-score" value={score} onChange={(e) => setScore(e.target.value)} />
        <span style={{ paddingBottom: 'var(--s-3)' }}>von</span>
        <Input label="Maximal" type="number" inputMode="decimal" min={0.5} step="0.5" data-testid="result-max" value={max} onChange={(e) => setMax(e.target.value)} />
      </div>
      {valid && <div className="text-sm muted">{`${fmtNum(num(score))} von ${fmtNum(num(max))} Punkten`}</div>}
      <div className="row" style={{ marginTop: 'var(--s-2)' }}><Button data-testid="result-save" disabled={!valid} onClick={save}>Ergebnis speichern</Button>{test.result && <Button variant="ghost" onClick={() => setEditing(false)}>Abbrechen</Button>}</div>
    </Card>
  );
}
