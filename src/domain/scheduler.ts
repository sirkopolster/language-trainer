// Sentence ladder scheduler (learning-concept §1–2). Pure, deterministic given `now` and `rng`.
import type { Word, WordState } from './types';

export const LEVELS = 6;
/** days until the next ask after a correct answer at the new level */
export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 14];
export type ExerciseType = 'choice' | 'tiles' | 'gapsHint' | 'gaps' | 'write';
export const exerciseFor = (level: number): ExerciseType => (['choice', 'tiles', 'gapsHint', 'gaps', 'write', 'write'] as ExerciseType[])[Math.max(0, Math.min(5, level))];

const DAY = 86_400_000;

export const newState = (wordId: string, now: Date, profileId = ''): WordState => ({ wordId, profileId, box: 0, dueAt: now.toISOString(), streak: 0, lapses: 0, lastResult: null });
export const isDue = (s: WordState, now: Date) => new Date(s.dueAt).getTime() <= now.getTime();

/** Correct → one level up once the item has `priority ? 2 : 1` correct answers at this level. Wrong → one level down, due now. */
export function applyAnswer(s: WordState, correct: boolean, priority: boolean, now: Date): WordState {
  if (!correct) return { ...s, box: Math.max(0, s.box - 1), streak: 0, lapses: s.lapses + 1, lastResult: false, dueAt: now.toISOString() };
  const need = priority ? 2 : 1;
  const streak = s.streak + 1;
  if (streak < need) return { ...s, streak, lastResult: true, dueAt: now.toISOString() };
  const box = Math.min(LEVELS - 1, s.box + 1);
  return { ...s, box, streak: 0, lastResult: true, dueAt: new Date(now.getTime() + INTERVAL_DAYS[box] * DAY).toISOString() };
}

export interface SessionItem { word: Word; state: WordState }

/**
 * Due items first (oldest due first, priority items drawn twice as often), then up to `maxNew` unseen items.
 * Interleaved so two consecutive items never share a unit when avoidable.
 */
export function composeSession(words: Word[], states: Map<string, WordState>, now: Date, opts: { size: number; maxNew: number; rng?: () => number }): SessionItem[] {
  const rng = opts.rng ?? Math.random;
  const active = words.filter((w) => w.status === 'active');
  const due: SessionItem[] = [], fresh: SessionItem[] = [];
  for (const w of active) {
    const s = states.get(w.id);
    if (!s) fresh.push({ word: w, state: newState(w.id, now) });
    else if (isDue(s, now) && !(s.box === LEVELS - 1 && s.lastResult)) due.push({ word: w, state: s });
  }
  due.sort((a, b) => new Date(a.state.dueAt).getTime() - new Date(b.state.dueAt).getTime());
  const picked = weightedPick(due, opts.size, rng);
  const room = Math.min(opts.maxNew, opts.size - picked.length);
  picked.push(...weightedPick(shuffle(fresh, rng), room, rng));
  return interleave(picked);
}

function weightedPick(items: SessionItem[], n: number, rng: () => number): SessionItem[] {
  const pool = items.map((it) => ({ it, w: it.word.priority ? 2 : 1 }));
  const out: SessionItem[] = [];
  while (out.length < n && pool.length) {
    // keep order bias (oldest due first) but let priority items jump the queue
    const window = pool.slice(0, Math.min(pool.length, 6));
    const total = window.reduce((a, x) => a + x.w, 0);
    let r = rng() * total, idx = 0;
    for (; idx < window.length - 1; idx++) { r -= window[idx].w; if (r < 0) break; }
    out.push(window[idx].it);
    pool.splice(idx, 1);
  }
  return out;
}

function interleave(items: SessionItem[]): SessionItem[] {
  const out: SessionItem[] = [];
  const rest = [...items];
  while (rest.length) {
    const last = out[out.length - 1]?.word.unitId;
    const i = rest.findIndex((x) => x.word.unitId !== last);
    out.push(rest.splice(i === -1 ? 0 : i, 1)[0]);
  }
  return out;
}

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Position for a wrong item to come back in the queue: 3 items later (or at the end). */
export const requeueIndex = (queueLength: number) => Math.min(queueLength, 3);
