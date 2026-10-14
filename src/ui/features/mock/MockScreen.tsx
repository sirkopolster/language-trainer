import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabaseRepository as repo } from '../../../storage/supabaseRepository';
import type { Award, Test, WordState } from '../../../domain/types';
import { buildMock, scoreMock, type MockItem, type MockResult } from '../../../domain/mock';
import { newState } from '../../../domain/scheduler';
import { AppBar, Button, Card, CloseIcon, EddieSays, ProgressBar, TrophyIcon, useToast } from '../../ds';
import { ExerciseView } from '../learn/Exercises';

/** S4 Probetest: items from the real format, no feedback until the end, then score, corrections, and wrong sentences back to level 2. */
export function MockScreen() {
  const { testId = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [test, setTest] = useState<Test | null>(null);
  const [items, setItems] = useState<MockItem[] | null>(null);
  const [answers, setAnswers] = useState<{ typed: string }[]>([]);
  const answersRef = useRef<{ typed: string }[]>([]); // the view can fire twice before React re-renders; the ref keeps one answer per item
  const [result, setResult] = useState<MockResult | null>(null);
  const [startedAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    Promise.all([repo.getTest(testId), repo.listWords(testId)]).then(([t, words]) => {
      setTest(t);
      setItems(t.format ? buildMock(t.format, words) : []);
    }).catch((e: Error) => toast(e.message, 'bad'));
  }, [testId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function answer(typed: string) {
    if (!items || !test?.format || answersRef.current.length >= items.length) return;
    const next = [...answersRef.current, { typed }];
    answersRef.current = next;
    setAnswers(next);
    if (next.length < items.length) return;
    const r = scoreMock(items, next, test.format);
    setResult(r);
    // wrong sentences drop to level 2 and are due now; the attempt is saved as a mock session; a passed mock earns a crown
    try {
      const states = new Map((await repo.listWordStates(testId)).map((s) => [s.wordId, s]));
      for (const it of r.items.filter((x) => !x.correct)) {
        const s: WordState = states.get(it.word.id) ?? newState(it.word.id, new Date());
        await repo.saveWordState({ ...s, box: Math.min(s.box, 2), dueAt: new Date().toISOString(), streak: 0, lastResult: false });
      }
      await repo.addSession({ profileId: test.profileId, kind: 'mock', unitId: null, startedAt, score: r.score, maxScore: r.maxScore, items: r.items.map((x) => ({ testId, word_id: x.word.id, type: x.ex.type, typed: x.typed, correct: x.correct, points: x.points, earned: x.earned, passed: r.passed })) });
      if (r.passed) {
        const crown: Award = { id: '', profileId: test.profileId, kind: 'crown', refId: testId, ref: 'mock', value: 1, awardedAt: new Date().toISOString() };
        await repo.saveAward(crown);
      }
    } catch (e) { toast((e as Error).message, 'bad'); }
  }

  const back = () => nav(`/t/${testId}?tab=probetest`);
  if (items === null) return <><AppBar title="Probetest" onBack={back} /><main className="page"><p className="muted text-sm">Lädt…</p></main></>;
  if (items.length === 0) return <><AppBar title="Probetest" onBack={back} /><main className="page"><EddieSays>Noch nichts zum Testen. Erst Sätze auswerten und das Testformat hochladen.</EddieSays></main></>;

  if (result) return (
    <>
      <AppBar title="Ergebnis" onBack={back} />
      <main className="page stack">
        <Card accent>
          <div className="result">
            {result.passed && <span className="crown-big"><TrophyIcon /></span>}
            <div className="h2">{result.score} von {result.maxScore} Punkten</div>
            <p className="text-sm muted">{result.passed ? `Bestanden! Nötig waren ${result.passMark}.` : `Noch nicht bestanden, nötig sind ${result.passMark}. Die Fehler sind jetzt wieder im Training.`}</p>
          </div>
        </Card>
        <EddieSays>{result.passed ? 'Stark! So kannst du in den echten Test gehen.' : 'Kein Stress. Schau dir die Sätze unten an, dann klappt es.'}</EddieSays>
        <Card title="Deine Antworten">
          <div className="stack-sm">
            {result.items.map((it, i) => (
              <div key={i} className={`mock-item ${it.correct ? 'mock-ok' : 'mock-bad'}`} data-testid="mock-item">
                <div className="text-xs muted">{i + 1} · {it.section} · {it.earned} / {it.points} P.</div>
                <div className="text-sm">{it.ex.prompt}</div>
                {it.correct ? <div className="text-sm" style={{ color: 'var(--good)' }}>{it.ex.answer}</div> : <><div className="text-sm" style={{ textDecoration: 'line-through', color: 'var(--muted)' }}>{it.typed || '–'}</div><div className="text-sm" style={{ color: 'var(--bad)', fontWeight: 600 }}>{it.ex.answer}</div></>}
              </div>
            ))}
          </div>
        </Card>
        <Button block data-testid="mock-done" onClick={back}>Zurück</Button>
      </main>
    </>
  );

  const i = answers.length;
  const it = items[i];
  return (
    <>
      <AppBar title={`Probetest · ${i + 1} von ${items.length}`} right={<button className="iconbtn iconbtn-lg" aria-label="Abbrechen" onClick={back}><CloseIcon /></button>} />
      <main className="page stack">
        <ProgressBar value={i} max={items.length} thin />
        <div className="text-xs muted">{it.section} · {it.points} {it.points === 1 ? 'Punkt' : 'Punkte'}</div>
        <ExerciseView key={i} ex={it.ex} locked={false} onAnswer={answer} />
      </main>
    </>
  );
}
