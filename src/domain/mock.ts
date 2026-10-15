// Probetest (S4): generated from the real test's format, scored like the real test, readiness from levels + last mocks. Pure.
import { compare } from './compare';
import { makeChoice, makeGaps, makeWrite, type Exercise } from './exercises';
import { shuffle } from './scheduler';
import type { TestFormat, Word, WordState } from './types';

export interface MockItem { word: Word; ex: Exercise; points: number; section: string }
export interface MockAnswer { typed: string }
export interface MockResultItem extends MockItem { typed: string; correct: boolean; earned: number }
export interface MockResult { items: MockResultItem[]; score: number; maxScore: number; passMark: number; passed: boolean }

/** Default pass mark when the sheet shows no grading scale: 80 % (open question Q4). */
export const DEFAULT_PASS_SHARE = 0.8;
const SECTION_LABEL: Record<string, string> = { translate: 'Übersetzen', gap: 'Lückentext', choice: 'Auswahl', match: 'Zuordnen', other: 'Sonstige' };

/**
 * One item per task of every section, drawn from the active sentences without repeats across the whole mock
 * (repeats only when the format needs more items than there are sentences). Section types map to our exercises:
 * translate → write, gap → gaps without letters, choice/match → choice; other is skipped. Always the test direction.
 */
export function buildMock(format: TestFormat, words: Word[], rng: () => number = Math.random): MockItem[] {
  const vocab = words.filter((w) => w.status === 'active' && (w.kind ?? 'vocab') === 'vocab');
  const tense = words.filter((w) => w.status === 'active' && w.kind === 'tense');
  if (vocab.length === 0) return [];
  let pool = shuffle(vocab, rng);
  const next = () => { if (pool.length === 0) pool = shuffle(vocab, rng); return pool.pop()!; };
  let tpool = shuffle(tense, rng);
  const nextTense = () => { if (tpool.length === 0) tpool = shuffle(tense, rng); return tpool.pop()!; };
  const out: MockItem[] = [];
  for (const s of format.sections) {
    if (s.type === 'other' || s.items <= 0) continue;
    const per = s.points / s.items;
    for (let i = 0; i < s.items; i++) {
      // a choice task about verb forms uses the tense pairs when the test has Spezialteil A
      const useTense = s.type !== 'translate' && s.type !== 'gap' && tense.length > 0;
      const word = useTense ? nextTense() : next();
      const ex = s.type === 'translate' ? makeWrite(word) : s.type === 'gap' ? makeGaps(word, false, rng) : makeChoice(word, useTense ? tense : vocab, rng);
      out.push({ word, ex, points: per, section: s.label ?? SECTION_LABEL[s.type] });
    }
  }
  return out;
}

/** Full points for a correct answer (tolerant compare for typed text, exact for a choice), 0 otherwise. */
export function scoreMock(items: MockItem[], answers: MockAnswer[], format: TestFormat): MockResult {
  const result = items.map((it, i) => {
    const typed = answers[i]?.typed ?? '';
    const correct = it.ex.type === 'choice' ? typed === it.ex.answer : compare(typed, it.ex.answer).correct;
    return { ...it, typed, correct, earned: correct ? it.points : 0 };
  });
  const maxScore = round1(result.reduce((n, r) => n + r.points, 0));
  const score = round1(result.reduce((n, r) => n + r.earned, 0));
  const passMark = format.passMark ?? round1(maxScore * DEFAULT_PASS_SHARE);
  return { items: result, score, maxScore, passMark, passed: score >= passMark };
}
const round1 = (n: number) => Math.round(n * 10) / 10;

export type Readiness = 'practice' | 'almost' | 'ready';
/**
 * practice < 60 % of sentences at level ≥ 3 · almost ≥ 60 % · ready ≥ 85 % and the last mock passed.
 * Thresholds are hypotheses (research.md), tune with real data.
 */
export function readiness(words: Word[], states: Map<string, WordState>, lastMocks: { passed: boolean }[]): { level: Readiness; share: number } {
  const active = words.filter((w) => w.status === 'active');
  if (active.length === 0) return { level: 'practice', share: 0 };
  const secure = active.filter((w) => (states.get(w.id)?.box ?? 0) >= 3).length;
  const share = secure / active.length;
  const lastPassed = lastMocks[0]?.passed === true;
  return { level: share >= 0.85 && lastPassed ? 'ready' : share >= 0.6 ? 'almost' : 'practice', share };
}
