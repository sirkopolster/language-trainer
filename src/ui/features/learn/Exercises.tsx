import { useState, type FormEvent } from 'react';
import type { Choice, Exercise, Gaps, Tiles, Write } from '../../../domain/exercises';
import { fillGaps, isPunct, joinTokens } from '../../../domain/exercises';
import { Button, BulbIcon } from '../../ds';

/** What to do, in the learner's words: replaces direction labels. */
export function instruction(ex: Exercise): string {
  const lang = ex.dir === 'en-de' ? 'deutsch' : 'englisch';
  const Lang = ex.dir === 'en-de' ? 'Deutsch' : 'Englisch';
  switch (ex.type) {
    case 'choice': return `Welcher Satz heißt das auf ${Lang}?`;
    case 'tiles': return `Baue den ${lang}en Satz aus den Bausteinen.`;
    case 'gaps': return `Fülle die Lücken im ${lang}en Satz.`;
    default: return `Schreib den Satz auf ${Lang}.`;
  }
}

/** One exercise = prompt + answer input. Calls onAnswer with the learner's sentence (or option). Locked after answering. */
export function ExerciseView({ ex, locked, hint, onHint, onAnswer }: { ex: Exercise; locked: boolean; /** show a bulb that reveals the answer (level 0) */ hint?: boolean; onHint?: () => void; onAnswer: (typed: string) => void }) {
  const [shown, setShown] = useState(false);
  const [asking, setAsking] = useState(false);
  return (
    <div className="stack">
      <div className="card card-flat">
        <div className="row-between">
          <div className="grow">
            <div className="text-sm muted" data-testid="dir">{instruction(ex)}</div>
            <div className="h2" data-testid="prompt">{ex.prompt}</div>
          </div>
          {hint && !locked && <button type="button" className={`iconbtn${shown ? ' iconbtn-on' : ''}`} data-testid="hint" aria-label="Tipp" onClick={() => { if (!shown) setAsking(true); }}><BulbIcon /></button>}
        </div>
        {asking && !shown && <div className="row" style={{ marginTop: 'var(--s-2)' }}><span className="text-sm muted grow">Tipp zeigen? Kostet einen Stern.</span><Button small variant="secondary" onClick={() => setAsking(false)}>Nein</Button><Button small data-testid="hint-yes" onClick={() => { setAsking(false); setShown(true); onHint?.(); }}>Ja</Button></div>}
        {shown && <div className="text-md" style={{ color: 'var(--primary)', marginTop: 'var(--s-2)' }}>{ex.answer}</div>}
      </div>
      {ex.type === 'choice' && <ChoiceView ex={ex} locked={locked} onAnswer={onAnswer} />}
      {ex.type === 'tiles' && <TilesView ex={ex} locked={locked} onAnswer={onAnswer} />}
      {ex.type === 'gaps' && <GapsView ex={ex} locked={locked} onAnswer={onAnswer} />}
      {ex.type === 'write' && <WriteView ex={ex} locked={locked} onAnswer={onAnswer} />}
    </div>
  );
}

function ChoiceView({ ex, locked, onAnswer }: { ex: Choice; locked: boolean; onAnswer: (t: string) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="stack-sm">
      {ex.options.map((o) => (
        <button key={o} type="button" data-testid="option" disabled={locked} className={`choice${picked === o ? ' choice-picked' : ''}${locked && o === ex.answer ? ' choice-right' : ''}${locked && picked === o && o !== ex.answer ? ' choice-wrong' : ''}`} onClick={() => { setPicked(o); onAnswer(o); }}>{o}</button>
      ))}
    </div>
  );
}

function TilesView({ ex, locked, onAnswer }: { ex: Tiles; locked: boolean; onAnswer: (t: string) => void }) {
  const [used, setUsed] = useState<number[]>([]);
  const sentence = joinTokens(used.map((i) => ex.tiles[i]));
  return (
    <div className="stack">
      <div className="tile-slot" aria-label="Dein Satz">{used.length === 0 ? <span className="muted text-sm">Tippe die Wörter in der richtigen Reihenfolge</span> : used.map((i, k) => <button key={k} type="button" className="tile tile-used" disabled={locked} onClick={() => setUsed(used.filter((_, j) => j !== k))}>{ex.tiles[i]}</button>)}</div>
      <div className="tile-bank">{ex.tiles.map((t, i) => <button key={i} type="button" data-testid="tile" className="tile" disabled={locked || used.includes(i)} onClick={() => setUsed([...used, i])}>{t}</button>)}</div>
      <Button block data-testid="submit" disabled={locked || used.length === 0} onClick={() => onAnswer(sentence)}>Prüfen</Button>
    </div>
  );
}

function GapsView({ ex, locked, onAnswer }: { ex: Gaps; locked: boolean; onAnswer: (t: string) => void }) {
  const [inputs, setInputs] = useState<string[]>(ex.tokens.map((t) => t.hint ?? ''));
  const submit = (e: FormEvent) => { e.preventDefault(); if (!locked) onAnswer(fillGaps(ex, inputs)); };
  return (
    <form className="stack" onSubmit={submit}>
      <div className="gap-line">
        {ex.tokens.map((t, i) => t.gap
          ? <input key={i} data-testid="gap" className="input gap-input" style={{ width: `${Math.max(5, t.text.length + 3)}ch` }} value={inputs[i]} disabled={locked} autoCapitalize="none" autoComplete="off" onChange={(e) => setInputs(inputs.map((v, j) => (j === i ? e.target.value : v)))} />
          : <span key={i} className={isPunct(t.text) ? 'gap-punct' : undefined}>{t.text}</span>)}
      </div>
      <Button block data-testid="submit" type="submit" disabled={locked || ex.tokens.some((t, i) => t.gap && !inputs[i].trim())}>Prüfen</Button>
    </form>
  );
}

function WriteView({ ex, locked, onAnswer }: { ex: Write; locked: boolean; onAnswer: (t: string) => void }) {
  const [text, setText] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); if (!locked && text.trim()) onAnswer(text); };
  return (
    <form className="stack" onSubmit={submit}>
      <textarea data-testid="write" className="input" rows={3} value={text} disabled={locked} placeholder="Ganzen Satz schreiben…" lang={ex.dir === 'en-de' ? 'de' : 'en'} autoCapitalize="sentences" autoComplete="off" onChange={(e) => setText(e.target.value)} />
      <Button block data-testid="submit" type="submit" disabled={locked || !text.trim()}>Prüfen</Button>
    </form>
  );
}
