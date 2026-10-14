// Lessons (D-012): a unit is split into lessons of 5 sentences; each lesson runs the ladder parts in order. Pure.
import type { ExerciseType } from './scheduler';
import type { Direction } from './exercises';
import { shuffle } from './scheduler';
import type { Award, Word } from './types';

export const LESSON_SIZE = 5;
/** Four rounds; each round asks the whole lesson first EN → DE (understand), then DE → EN (produce, the test direction). */
export const PARTS: { type: ExerciseType; label: string; level: number }[] = [
  { type: 'choice', label: 'Zuordnen', level: 0 },
  { type: 'tiles', label: 'Bauen', level: 1 },
  { type: 'gapsHint', label: 'Lücken', level: 2 },
  { type: 'write', label: 'Schreiben', level: 3 },
];
export const HALVES: Direction[] = ['en-de', 'de-en'];
/** how many EN → DE items open a round before both directions mix */
export const EASY_START = 2;

/**
 * Order of one round: every sentence once per direction. The first EASY_START items are EN → DE (easy entry),
 * the rest is a shuffled mix of both directions; the same sentence never comes twice in a row.
 */
export function roundOrder(words: Word[], rng: () => number): { word: Word; dir: Direction }[] {
  const en = shuffle(words, rng).map((word) => ({ word, dir: 'en-de' as Direction }));
  const head = en.slice(0, EASY_START);
  let rest = shuffle([...en.slice(EASY_START), ...words.map((word) => ({ word, dir: 'de-en' as Direction }))], rng);
  const out = [...head];
  while (rest.length) {
    const last = out[out.length - 1]?.word.id;
    let i = rest.findIndex((x) => x.word.id !== last);
    if (i === -1) i = 0;
    out.push(rest[i]);
    rest = rest.filter((_, j) => j !== i);
  }
  return out;
}
export const MAX_STARS = PARTS.length * 3;

export interface Lesson { unitId: string; n: number; words: Word[] }

/** Lessons per unit in word order: 1 = sentences 1–5, 2 = 6–10, … The last lesson may be shorter, but never 1 sentence alone (merged into the previous one). */
export function splitLessons(words: Word[]): Lesson[] {
  const byUnit = new Map<string, Word[]>();
  for (const w of words) if (w.status === 'active') byUnit.set(w.unitId, [...(byUnit.get(w.unitId) ?? []), w]);
  const out: Lesson[] = [];
  for (const [unitId, ws] of byUnit) {
    const chunks: Word[][] = [];
    for (let i = 0; i < ws.length; i += LESSON_SIZE) chunks.push(ws.slice(i, i + LESSON_SIZE));
    if (chunks.length > 1 && chunks[chunks.length - 1].length === 1) chunks[chunks.length - 2].push(...chunks.pop()!);
    chunks.forEach((c, i) => out.push({ unitId, n: i + 1, words: c }));
  }
  return out;
}

/** 3 stars = no mistake, 2 = one or two, 1 = more (over both halves of a round). A hint counts as a mistake for the stars. */
export const starsFor = (mistakes: number) => (mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1);

export const partRef = (n: number, part: ExerciseType) => `lesson:${n}:${part}`;
export const lessonRef = (n: number) => `lesson:${n}`;

export interface LessonProgress { stars: Record<ExerciseType, number | null>; nextPart: number; crown: boolean; total: number }

/** Reads the awards of a unit into per-part stars, the next open part and the crown. */
export function lessonProgress(awards: Award[], unitId: string, n: number): LessonProgress {
  const stars = Object.fromEntries(PARTS.map((p) => [p.type, null])) as Record<ExerciseType, number | null>;
  let total = 0;
  for (const a of awards) {
    if (a.refId !== unitId || a.kind !== 'star') continue;
    const p = PARTS.find((x) => a.ref === partRef(n, x.type));
    if (p) { stars[p.type] = a.value; total += a.value; }
  }
  const nextPart = PARTS.findIndex((p) => stars[p.type] === null);
  const crown = awards.some((a) => a.kind === 'crown' && a.refId === unitId && a.ref === lessonRef(n));
  return { stars, nextPart: nextPart === -1 ? PARTS.length : nextPart, crown, total };
}
