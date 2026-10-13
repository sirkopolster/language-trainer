// Exercise generators for the ladder levels (learning-concept §1). Pure, rng injectable.
import { shuffle } from './scheduler';
import type { Word } from './types';

export interface Choice { type: 'choice'; prompt: string; options: string[]; answer: string }
export interface Tiles { type: 'tiles'; prompt: string; tiles: string[]; answer: string }
export interface Gaps { type: 'gaps'; prompt: string; tokens: { text: string; gap: boolean; hint?: string }[]; answer: string }
export interface Write { type: 'write'; prompt: string; answer: string }
export type Exercise = Choice | Tiles | Gaps | Write;

const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'am', 'to', 'of', 'in', 'on', 'at', 'and', 'or', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'do', 'does', 'did', 'not', "don't", 'this', 'that', 'was', 'were', 'be', 'have', 'has', 'had', 'with', 'for', 'but', 'so']);
const strip = (w: string) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
const isContent = (w: string) => { const s = strip(w); return s.length >= 3 && !STOP.has(s.toLowerCase()); };

/** 4 options: the answer + 3 other sentences from the pool (same unit first), prompt = the German sentence. */
export function makeChoice(word: Word, pool: Word[], rng: () => number): Choice {
  const others = shuffle(pool.filter((w) => w.id !== word.id && w.target !== word.target), rng);
  const sameUnit = others.filter((w) => w.unitId === word.unitId);
  const distractors = [...sameUnit, ...others.filter((w) => w.unitId !== word.unitId)].slice(0, 3).map((w) => w.target);
  return { type: 'choice', prompt: word.source, options: shuffle([word.target, ...distractors], rng), answer: word.target };
}

/** Word tiles of the answer plus 2 distractor words from other sentences, shuffled. */
export function makeTiles(word: Word, pool: Word[], rng: () => number): Tiles {
  const own = tokenize(word.target);
  const ownSet = new Set(own.map((w) => strip(w).toLowerCase()));
  const candidates = shuffle(pool.filter((w) => w.id !== word.id).flatMap((w) => w.target.split(/\s+/)).map(strip).filter((w) => w && !ownSet.has(w.toLowerCase())), rng);
  const distractors = [...new Set(candidates)].slice(0, 2);
  return { type: 'tiles', prompt: word.source, tiles: shuffle([...own, ...distractors], rng), answer: word.target };
}

/** Gaps on content words: with hint = 1–2 gaps and first letter shown; without = about half the content words, no letters. */
export function makeGaps(word: Word, hint: boolean, rng: () => number): Gaps {
  const tokens = tokenize(word.target);
  let idx = tokens.map((t, i) => (isContent(t) ? i : -1)).filter((i) => i >= 0);
  if (idx.length === 0) idx = tokens.map((_, i) => i).filter((i) => !isPunct(tokens[i]) && tokens[i].length >= 2);
  const n = hint ? Math.min(2, idx.length) : Math.max(1, Math.ceil(idx.length / 2));
  const gaps = new Set(shuffle(idx, rng).slice(0, n));
  return {
    type: 'gaps',
    prompt: word.source,
    tokens: tokens.map((t, i) => (gaps.has(i) ? { text: t, gap: true, ...(hint ? { hint: strip(t).slice(0, 1) } : {}) } : { text: t, gap: false })),
    answer: word.target,
  };
}

export const makeWrite = (word: Word): Write => ({ type: 'write', prompt: word.source, answer: word.target });

/** Splits a sentence into word tokens and separate punctuation tokens: "Don't feed the animals!" → ["Don't","feed","the","animals","!"] */
export function tokenize(sentence: string): string[] {
  const out: string[] = [];
  for (const w of sentence.split(/\s+/).filter(Boolean)) {
    const m = w.match(/^(.*?)([.,!?;:]+)$/);
    if (m && m[1]) { out.push(m[1], m[2]); } else out.push(w);
  }
  return out;
}
export const isPunct = (t: string) => /^[.,!?;:]+$/.test(t);
/** Joins tokens back, no space before punctuation. */
export const joinTokens = (tokens: string[]) => tokens.reduce((s, t) => (s === '' ? t : isPunct(t) ? s + t : `${s} ${t}`), '');

/** Rebuilds the learner's sentence from gap inputs, keeping the given tokens. */
export const fillGaps = (g: Gaps, inputs: string[]) => joinTokens(g.tokens.map((t, i) => (t.gap ? (inputs[i] ?? '').trim() : t.text)));
