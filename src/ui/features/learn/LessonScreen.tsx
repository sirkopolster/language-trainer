import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabaseRepository as repo } from '../../../storage/supabaseRepository';
import type { Award, Test, Word, WordState } from '../../../domain/types';
import { compare, type Comparison } from '../../../domain/compare';
import { applyAnswer, newState, requeueIndex, shuffle } from '../../../domain/scheduler';
import { makeChoice, makeGaps, makeTiles, makeWrite, type Exercise } from '../../../domain/exercises';
import { PARTS, lessonProgress, lessonRef, partRef, splitLessons, starsFor, type Lesson } from '../../../domain/lessons';
import { AppBar, BackIcon, Button, Card, CrownIcon, ProgressBar, StarIcon, useToast } from '../../ds';
import { ExerciseView } from './Exercises';

const FEEDBACK: Record<Comparison['result'], { title: string; tone: 'good' | 'warn' | 'bad' }> = {
  exact: { title: 'Richtig!', tone: 'good' },
  hint: { title: 'Richtig, aber schau auf Groß/Klein und Satzzeichen', tone: 'warn' },
  close: { title: 'Fast richtig, kleiner Tippfehler', tone: 'warn' },
  wrong: { title: 'Noch nicht. So ist es richtig:', tone: 'bad' },
};
type Step = { word: Word; ex: Exercise; retry: boolean };
type Phase = { kind: 'plan' } | { kind: 'run'; part: number; queue: Step[]; done: number; mistakes: number; hints: number; feedback: Comparison | null; hintUsed: boolean } | { kind: 'partDone'; part: number; stars: number; mistakes: number; hints: number } | { kind: 'lessonDone'; crown: boolean; total: number };

/** D-012 lesson: 5 sentences through Wählen → Bauen → Lücken → Lücken ohne Hilfe → Schreiben. Plan first, stars per part, crown when all parts are perfect. */
export function LessonScreen() {
  const { testId = '', unitId = '', n: nStr = '1' } = useParams();
  const n = Number(nStr);
  const nav = useNavigate();
  const toast = useToast();
  const [test, setTest] = useState<Test | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [pool, setPool] = useState<Word[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [states, setStates] = useState<Map<string, WordState>>(new Map());
  const [phase, setPhase] = useState<Phase>({ kind: 'plan' });
  const [log, setLog] = useState<unknown[]>([]);

  useEffect(() => {
    repo.getTest(testId).then(async (t) => {
      const [words, st, aw] = await Promise.all([repo.listWords(testId), repo.listWordStates(testId), repo.listAwards(t.profileId)]);
      setTest(t); setPool(words.filter((w) => w.status === 'active')); setAwards(aw); setStates(new Map(st.map((s) => [s.wordId, s])));
      setLesson(splitLessons(words).find((l) => l.unitId === unitId && l.n === n) ?? null);
    }).catch((e: Error) => toast(e.message, 'bad'));
  }, [testId, unitId, n]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = lessonProgress(awards, unitId, n);

  function startPart(part: number) {
    if (!lesson) return;
    const queue = shuffle(lesson.words, Math.random).map((word) => ({ word, ex: build(word, PARTS[part].type, pool), retry: false }));
    setPhase({ kind: 'run', part, queue, done: 0, mistakes: 0, hints: 0, feedback: null, hintUsed: false });
  }

  function answer(typed: string) {
    if (phase.kind !== 'run' || phase.feedback) return;
    const step = phase.queue[0];
    const c = step.ex.type === 'choice' ? (typed === step.ex.answer ? compare(typed, typed) : { ...compare(typed, step.ex.answer), result: 'wrong' as const, correct: false }) : compare(typed, step.ex.answer);
    setLog((l) => [...l, { word_id: step.word.id, part: PARTS[phase.part].type, correct: c.correct, typed, hint: phase.hintUsed }]);
    if (!step.retry) {
      const prev = states.get(step.word.id) ?? newState(step.word.id, new Date());
      // the ladder state follows the part: a correct answer at part k lifts the sentence to level k+1 at most
      const base = { ...prev, box: Math.min(prev.box, PARTS[phase.part].level) };
      const next = applyAnswer(base, c.correct, step.word.priority, new Date());
      setStates((m) => new Map(m).set(step.word.id, next));
      repo.saveWordState(next).catch((e: Error) => toast(e.message, 'bad'));
    }
    setPhase({ ...phase, feedback: c, mistakes: phase.mistakes + (!step.retry && (!c.correct || phase.hintUsed) ? 1 : 0), hints: phase.hints + (!step.retry && phase.hintUsed ? 1 : 0) });
  }

  function proceed() {
    if (phase.kind !== 'run' || !phase.feedback || !lesson || !test) return;
    const step = phase.queue[0];
    const rest = phase.queue.slice(1);
    let done = phase.done;
    if (phase.feedback.correct) {
      if (!step.retry) done++;
      else rest.splice(requeueIndex(rest.length), 0, { word: step.word, ex: build(step.word, PARTS[phase.part].type, pool), retry: false });
    } else if (!step.retry) rest.unshift({ word: step.word, ex: step.ex.type === 'choice' ? makeWrite(step.word) : step.ex, retry: true });
    else rest.splice(requeueIndex(rest.length), 0, { word: step.word, ex: build(step.word, PARTS[phase.part].type, pool), retry: false });
    if (rest.length > 0) { setPhase({ ...phase, queue: rest, done, feedback: null, hintUsed: false }); return; }
    const stars = starsFor(phase.mistakes);
    const star: Award = { id: '', profileId: test.profileId, kind: 'star', refId: unitId, ref: partRef(n, PARTS[phase.part].type), value: stars, awardedAt: new Date().toISOString() };
    const nextAwards = [...awards.filter((a) => !(a.kind === 'star' && a.refId === unitId && a.ref === star.ref)), star];
    const perfect = PARTS.every((p) => lessonProgress(nextAwards, unitId, n).stars[p.type] === 3);
    const crown: Award | null = phase.part === PARTS.length - 1 && perfect ? { ...star, kind: 'crown', ref: lessonRef(n), value: 1 } : null;
    if (crown) nextAwards.push(crown);
    // show the result right away, persist in the background
    setAwards(nextAwards);
    setPhase({ kind: 'partDone', part: phase.part, stars, mistakes: phase.mistakes, hints: phase.hints });
    const items = log; setLog([]);
    const save = async () => { await repo.saveAward(star); if (crown) await repo.saveAward(crown); await repo.addSession({ profileId: test.profileId, kind: 'study', unitId, startedAt: new Date().toISOString(), items }); };
    save().catch((e: Error) => toast(e.message, 'bad'));
  }

  const back = <button className="iconbtn" aria-label="Zurück" onClick={() => nav(`/t/${testId}`)}><BackIcon /></button>;
  if (!lesson) return <><AppBar title="Lektion" left={back} /><main className="page"><p className="muted text-sm">Lädt…</p></main></>;
  const title = `Lektion ${n}`;

  if (phase.kind === 'plan') return (
    <>
      <AppBar title={title} left={back} />
      <main className="page stack">
        <Card title="So läuft die Lektion">
          <p className="text-sm muted">{lesson.words.length} Sätze, fünf Runden. Jede Runde wird ein Stück schwerer.</p>
          <ol className="plan">
            {PARTS.map((p, i) => <li key={p.type} className={i === progress.nextPart ? 'plan-next' : i < progress.nextPart ? 'plan-done' : ''}><span className="plan-n">{i + 1}</span><span className="grow">{p.label}</span><Stars n={progress.stars[p.type]} /></li>)}
          </ol>
          {progress.crown && <p className="row text-sm" style={{ color: 'var(--accent)' }}><CrownIcon /> Krone: alle Runden perfekt</p>}
        </Card>
        <Card flat><ul className="plan-words">{lesson.words.map((w) => <li key={w.id}>{w.source}</li>)}</ul></Card>
        {progress.nextPart < PARTS.length
          ? <Button block data-testid="lesson-start" onClick={() => startPart(progress.nextPart)}>{progress.nextPart === 0 ? 'Los geht’s' : `Weiter mit Runde ${progress.nextPart + 1}`}</Button>
          : <Button block data-testid="lesson-start" variant="secondary" onClick={() => startPart(PARTS.length - 1)}>Schreiben nochmal üben</Button>}
      </main>
    </>
  );

  if (phase.kind === 'partDone') return (
    <>
      <AppBar title={title} />
      <main className="page stack">
        <Card accent>
          <div className="result"><div className="h2">Runde {phase.part + 1}: {PARTS[phase.part].label}</div><Stars n={phase.stars} big /><p className="text-sm muted">{phase.stars === 3 ? 'Perfekt, kein Fehler!' : phase.stars === 2 ? 'Gut, fast fehlerfrei.' : 'Geschafft. Beim nächsten Mal klappt mehr.'}</p>{phase.mistakes > 0 && <p className="text-sm muted" data-testid="part-detail">{[phase.mistakes - phase.hints > 0 ? `${phase.mistakes - phase.hints} Fehler` : '', phase.hints > 0 ? `${phase.hints} Tipp genutzt (kostet je einen Stern)` : ''].filter(Boolean).join(' · ')}</p>}</div>
        </Card>
        {phase.part + 1 < PARTS.length
          ? <Button block data-testid="part-next" onClick={() => startPart(phase.part + 1)}>Runde {phase.part + 2}: {PARTS[phase.part + 1].label}</Button>
          : <Button block data-testid="part-next" onClick={() => setPhase({ kind: 'lessonDone', crown: lessonProgress(awards, unitId, n).crown, total: lessonProgress(awards, unitId, n).total })}>Ergebnis</Button>}
        <Button block variant="ghost" onClick={() => nav(`/t/${testId}`)}>Pause</Button>
      </main>
    </>
  );

  if (phase.kind === 'lessonDone') return (
    <>
      <AppBar title={title} />
      <main className="page stack">
        <Card accent>
          <div className="result">{phase.crown ? <span className="crown-big"><CrownIcon /></span> : <StarIcon />}<div className="h2">{phase.crown ? 'Krone! Alles perfekt.' : `${phase.total} von 15 Sternen`}</div><p className="text-sm muted">{phase.crown ? 'Diese fünf Sätze sitzen.' : 'Runden mit weniger als drei Sternen kannst du wiederholen.'}</p></div>
        </Card>
        <Button block onClick={() => nav(`/t/${testId}`)}>Zurück zum Test</Button>
      </main>
    </>
  );

  const step = phase.queue[0];
  const fb = phase.feedback ? FEEDBACK[phase.feedback.result] : null;
  return (
    <>
      <AppBar title={`Runde ${phase.part + 1}: ${PARTS[phase.part].label}`} right={<Button small variant="ghost" onClick={() => nav(`/t/${testId}`)}>Abbrechen</Button>} />
      <main className="page stack">
        <ProgressBar value={phase.done} max={lesson.words.length} thin />
        <ExerciseView key={`${step.word.id}-${step.retry}-${phase.queue.length}`} ex={step.ex} locked={!!phase.feedback} hint={phase.part === 0 && !step.retry} onHint={() => setPhase({ ...phase, hintUsed: true })} onAnswer={answer} />
        {phase.feedback && fb && (
          <Card className={`feedback feedback-${fb.tone}`}>
            <div className="h3" data-testid="feedback">{fb.title}</div>
            {phase.feedback.result !== 'exact' && <p className="text-md" style={{ margin: 'var(--s-2) 0 0' }}>{phase.feedback.diff.map((d, i) => <span key={i} className={d.kind === 'bad' ? 'diff-bad' : undefined}>{d.text} </span>)}</p>}
            <Button block data-testid="next" onClick={proceed} autoFocus>{phase.feedback.correct ? 'Weiter' : 'Nochmal tippen'}</Button>
          </Card>
        )}
      </main>
    </>
  );
}

function Stars({ n, big }: { n: number | null; big?: boolean }) {
  return <span className={`stars${big ? ' stars-big' : ''}`} aria-label={n === null ? 'offen' : `${n} Sterne`}>{[1, 2, 3].map((i) => <span key={i} className={n !== null && i <= n ? 'star-on' : 'star-off'}><StarIcon /></span>)}</span>;
}

function build(word: Word, type: (typeof PARTS)[number]['type'], pool: Word[]): Exercise {
  const rng = Math.random;
  switch (type) {
    case 'choice': return makeChoice(word, pool, rng);
    case 'tiles': return makeTiles(word, pool, rng);
    case 'gapsHint': return makeGaps(word, true, rng);
    case 'gaps': return makeGaps(word, false, rng);
    default: return makeWrite(word);
  }
}
