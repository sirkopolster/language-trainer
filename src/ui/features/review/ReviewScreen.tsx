import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabaseRepository as repo } from '../../../storage/supabaseRepository';
import type { Test, Unit, Word } from '../../../domain/types';
import { AppBar, BackIcon, Badge, Button, Card, EmptyState, StarIcon, useToast } from '../../ds';

/** S2 review: fix extracted words before they go into study. Edit inline, star = priority, delete, move to another unit, "Fertig" activates and deletes the photos. */
export function ReviewScreen() {
  const { testId = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [test, setTest] = useState<Test | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([repo.getTest(testId), repo.listUnits(testId), repo.listWords(testId)])
      .then(([t, u, w]) => { setTest(t); setUnits(u); setWords(w.filter((x) => x.status === 'review')); })
      .catch((e: Error) => toast(e.message, 'bad'));
  }, [testId]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (w: Word, p: Partial<Word>) => {
    const next = { ...w, ...p };
    setWords((ws) => ws.map((x) => (x.id === w.id ? next : x)));
    repo.updateWord(w.id, p).catch((e: Error) => toast(e.message, 'bad'));
  };
  const remove = (w: Word) => { setWords((ws) => ws.filter((x) => x.id !== w.id)); repo.deleteWord(w.id).catch((e: Error) => toast(e.message, 'bad')); };

  async function finish() {
    if (!test) return;
    setBusy(true);
    try {
      await repo.activateWords(testId);
      const keep = (await repo.listProfiles()).find((p) => p.id === test.profileId)?.settings.keepPhotos;
      if (!keep) await repo.deletePhotoFiles(testId);
      toast(`${words.length} Wörter bereit zum Lernen`, 'good');
      nav(`/t/${testId}`);
    } catch (e) { toast((e as Error).message, 'bad'); }
    setBusy(false);
  }

  const prio = words.filter((w) => w.priority).length;

  return (
    <>
      <AppBar title="Wörter prüfen" left={<button className="iconbtn" aria-label="Zurück" onClick={() => nav(`/t/${testId}`)}><BackIcon /></button>} />
      <main className="page stack">
        {words.length === 0 ? (
          <Card flat><EmptyState title="Nichts zu prüfen" text="Alle Wörter sind schon freigegeben oder es wurde noch nichts ausgewertet." action={<Button onClick={() => nav(`/t/${testId}`)}>Zurück zum Test</Button>} /></Card>
        ) : (
          <>
            <p className="text-sm muted">Tippfehler direkt korrigieren. Stern = wichtig (kommt öfter dran). {prio > 0 && <Badge tone="star">{prio} wichtig</Badge>}</p>
            {units.filter((u) => words.some((w) => w.unitId === u.id)).map((u) => (
              <Card key={u.id} title={u.label}>
                <div className="stack-sm">
                  {words.filter((w) => w.unitId === u.id).map((w) => (
                    <div key={w.id} className="row" data-testid="review-word">
                      <button className={`iconbtn${w.priority ? ' iconbtn-on' : ''}`} aria-label="Wichtig" aria-pressed={w.priority} onClick={() => patch(w, { priority: !w.priority })}><StarIcon /></button>
                      <div className="grow stack-sm">
                        <input className="input input-sm" value={w.source} aria-label="Wort" onChange={(e) => setWords((ws) => ws.map((x) => (x.id === w.id ? { ...x, source: e.target.value } : x)))} onBlur={(e) => patch(w, { source: e.target.value.trim() })} />
                        <input className="input input-sm" value={w.target} aria-label="Übersetzung" onChange={(e) => setWords((ws) => ws.map((x) => (x.id === w.id ? { ...x, target: e.target.value } : x)))} onBlur={(e) => patch(w, { target: e.target.value.trim() })} />
                        {units.length > 1 && (
                          <select className="input input-sm" value={w.unitId} aria-label="Unit" onChange={(e) => patch(w, { unitId: e.target.value })}>
                            {units.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                          </select>
                        )}
                      </div>
                      <button className="iconbtn" aria-label="Löschen" onClick={() => remove(w)}>×</button>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
            <Button block data-testid="review-finish" onClick={finish} disabled={busy}>Fertig, {words.length} Wörter lernen</Button>
          </>
        )}
      </main>
    </>
  );
}
