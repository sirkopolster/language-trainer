import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabaseRepository as repo } from '../../../storage/supabaseRepository';
import type { Profile, Test, Word, WordState } from '../../../domain/types';
import { compare, type Comparison } from '../../../domain/compare';
import { applyAnswer, composeSession, exerciseFor, requeueIndex, type SessionItem } from '../../../domain/scheduler';
import { makeChoice, makeGaps, makeTiles, makeWrite, type Direction, type Exercise } from '../../../domain/exercises';
import { AppBar, Button, Card, CloseIcon, EmptyState, ProgressBar, StarIcon, useToast } from '../../ds';
import { ExerciseView, explanation } from './Exercises';

type Step = { item: SessionItem; ex: Exercise; retry: boolean };
const FEEDBACK: Record<Comparison['result'], { title: string; tone: 'good' | 'warn' | 'bad' }> = {
  exact: { title: 'Richtig!', tone: 'good' },
  hint: { title: 'Richtig, aber schau auf Groß/Klein und Satzzeichen', tone: 'warn' },
  close: { title: 'Fast richtig, kleiner Tippfehler', tone: 'warn' },
  wrong: { title: 'Noch nicht. So ist es richtig:', tone: 'bad' },
};

/** S3a session: composes 10 items from due + new, runs the ladder exercises, loops wrong items back, saves state per answer. */
export function LearnScreen() {
  const { testId = '' } = useParams();
  const [params] = useSearchParams();
  const unitId = params.get('unit');
  const size = Number(params.get('n') ?? 10);
  const nav = useNavigate();
  const toast = useToast();
  const [test, setTest] = useState<Test | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [pool, setPool] = useState<Word[]>([]);
  const [queue, setQueue] = useState<Step[] | null>(null);
  const [done, setDone] = useState<{ correct: number; total: number; climbed: number }>({ correct: 0, total: 0, climbed: 0 });
  const [feedback, setFeedback] = useState<Comparison | null>(null);
  const [lastTyped, setLastTyped] = useState('');
  const [startedAt] = useState(() => new Date());
  const [log, setLog] = useState<{ word_id: string; level: number; type: string; correct: boolean; typed: string }[]>([]);

  useEffect(() => {
    repo.getMyProfile().then((my) => Promise.all([repo.getTest(testId), repo.listWords(testId), repo.listWordStates(testId, my?.id ?? '')]).then(([t, words, states]) => {
      setTest(t); setMe(my);
      const active = words.filter((w) => w.status === 'active');
      setPool(active);
      const scope = unitId ? active.filter((w) => w.unitId === unitId) : active;
      const items = composeSession(scope, new Map(states.map((s) => [s.wordId, s])), new Date(), { size, maxNew: 5 }).map((it) => ({ ...it, state: { ...it.state, profileId: my?.id ?? '' } }));
      // both directions in review too: alternate per item
      setQueue(items.map((item, i) => ({ item, ex: build(item, active, i % 2 ? 'de-en' : 'en-de'), retry: false })));
    })).catch((e: Error) => toast(e.message, 'bad'));
  }, [testId, unitId, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = queue?.[0];
  const total = useMemo(() => (queue ? queue.length + done.total : 0), [queue, done.total]);

  function answer(typed: string) {
    if (!step || feedback) return;
    const c = step.ex.type === 'choice' ? (typed === step.ex.answer ? compare(step.ex.answer, step.ex.answer) : { ...compare(typed, step.ex.answer), result: 'wrong' as const, correct: false }) : compare(typed, step.ex.answer);
    setFeedback(c); setLastTyped(typed);
    setLog((l) => [...l, { word_id: step.item.word.id, level: step.item.state.box, type: step.ex.type, correct: c.correct, typed }]);
    if (step.retry) return; // the retype after a wrong answer does not change the level
    const next = applyAnswer(step.item.state, c.correct, step.item.word.priority, new Date());
    step.item.state = next;
    repo.saveWordState(next).catch((e: Error) => toast(e.message, 'bad'));
  }

  function proceed() {
    if (!step || !feedback || !queue) return;
    const rest = queue.slice(1);
    if (feedback.correct) {
      setDone((d) => ({ correct: d.correct + (step.retry ? 0 : 1), total: d.total + (step.retry ? 0 : 1), climbed: d.climbed + (!step.retry && step.item.state.streak === 0 && step.item.state.lastResult ? 1 : 0) }));
      if (step.retry) rest.splice(requeueIndex(rest.length), 0, { item: step.item, ex: build(step.item, pool, step.ex.dir), retry: false });
    } else if (!step.retry) {
      setDone((d) => ({ ...d, total: d.total + 1 }));
      // retype once right away, then the item comes back later in the session
      rest.unshift({ item: step.item, ex: step.ex.type === 'choice' ? makeWrite(step.item.word, step.ex.dir) : step.ex, retry: true });
    } else {
      rest.splice(requeueIndex(rest.length), 0, { item: step.item, ex: build(step.item, pool, step.ex.dir), retry: false });
    }
    setFeedback(null);
    setQueue(rest);
    if (rest.length === 0 && test && me) repo.addSession({ profileId: me.id, kind: 'study', unitId, startedAt: startedAt.toISOString(), items: log }).catch(() => undefined);
  }

  if (queue === null) return <main className="page"><p className="muted text-sm">Lädt…</p></main>;
  if (queue.length === 0 && done.total === 0) return (
    <>
      <AppBar title="Lernen" />
      <main className="page"><Card flat><EmptyState icon="🎉" title="Nichts fällig" text="Alle Sätze sitzen gerade. Schau später wieder rein oder nimm einen Probetest." action={<Button onClick={() => nav(`/t/${testId}`)}>Zurück</Button>} /></Card></main>
    </>
  );
  if (queue.length === 0) return (
    <>
      <AppBar title="Geschafft" />
      <main className="page stack">
        <Card accent>
          <EmptyState icon={<StarIcon />} title={`${done.correct} von ${done.total} beim ersten Versuch`} text={done.climbed > 0 ? `${done.climbed} Sätze sind eine Stufe hochgeklettert.` : 'Dranbleiben, die Stufen kommen.'} />
        </Card>
        <Button block data-testid="again" onClick={() => nav(0)}>Noch eine Runde</Button>
        <Button block variant="ghost" onClick={() => nav(`/t/${testId}`)}>Fertig für heute</Button>
      </main>
    </>
  );
  const fb = feedback ? FEEDBACK[feedback.result] : null;
  return (
    <>
      <AppBar title={step?.retry ? 'Nochmal tippen' : 'Lernen'} right={<button className="iconbtn iconbtn-lg" aria-label="Beenden" onClick={() => nav(`/t/${testId}`)}><CloseIcon /></button>} />
      <main className="page stack">
        <ProgressBar value={done.total} max={total} thin />
        {step && <ExerciseView key={`${step.item.word.id}-${step.retry}-${done.total}`} ex={step.ex} locked={!!feedback} hint={step.item.state.box === 0 && !step.retry && step.ex.type === 'choice' && step.ex.dir === 'de-en'} onAnswer={answer} />}
        {feedback && fb && (
          <Card className={`feedback feedback-${fb.tone}`}>
            <div className="h3" data-testid="feedback">{fb.title}</div>
            {feedback.result !== 'exact' && <p className="text-md" style={{ margin: 'var(--s-2) 0 0' }}>{feedback.diff.map((d, i) => <span key={i} className={d.kind === 'bad' ? 'diff-bad' : undefined}>{d.text} </span>)}</p>}
            {!feedback.correct && step && explanation(step.ex, lastTyped) && <p className="text-sm" data-testid="explain" style={{ margin: 'var(--s-2) 0 0' }}>{explanation(step.ex, lastTyped)}</p>}
            <Button block data-testid="next" onClick={proceed} autoFocus>{feedback.correct ? 'Weiter' : 'Nochmal tippen'}</Button>
          </Card>
        )}
      </main>
    </>
  );
}

function build(item: SessionItem, pool: Word[], dir: Direction): Exercise {
  const rng = Math.random;
  switch (exerciseFor(item.state.box)) {
    case 'choice': return makeChoice(item.word, pool, rng, dir);
    case 'tiles': return makeTiles(item.word, pool, rng, dir);
    case 'gapsHint': return makeGaps(item.word, true, rng, dir);
    case 'gaps': return makeGaps(item.word, false, rng, dir);
    default: return makeWrite(item.word, dir);
  }
}

export type { WordState };
