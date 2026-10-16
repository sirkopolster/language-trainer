import { describe, expect, it } from 'vitest';
import { compare, levenshtein, normalize } from './compare';
import { applyAnswer, composeSession, exerciseFor, newState } from './scheduler';
import { fillGaps, joinTokens, makeChoice, makeGaps, makeTiles, makeWrite, special, tokenize } from './exercises';
import type { Word } from './types';

const now = new Date('2026-10-13T18:00:00Z');
const day = (n: number) => new Date(now.getTime() + n * 86_400_000);
const w = (id: string, target: string, unitId = 'u1', priority = false): Word => ({ id, unitId, source: `de ${id}`, target, example: null, priority, status: 'active' });
const seq = (...vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };

describe('compare', () => {
  it('normalises case, punctuation and apostrophes', () => {
    expect(normalize("Don’t feed the Animals!")).toBe("don't feed the animals");
  });
  it('exact / hint / close / wrong', () => {
    expect(compare('The elephant is big.', 'The elephant is big.').result).toBe('exact');
    const hint = compare('the elephant is big', 'The elephant is big.');
    expect(hint.result).toBe('hint');
    expect(hint.correct).toBe(true);
    expect(hint.diff.filter((d) => d.kind === 'bad').map((d) => d.text)).toEqual(['The', 'big.']);
    expect(compare('The elefant is big.', 'The elephant is big.').result).toBe('close');
    const wrong = compare('The dog is big.', 'The elephant is big.');
    expect(wrong.result).toBe('wrong');
    expect(wrong.diff.filter((d) => d.kind === 'bad').map((d) => d.text)).toEqual(['elephant']);
  });
  it('allows one edit per 10 characters, minimum one', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(compare('I go', 'I do').result).toBe('close');
    expect(compare('I gx', 'I do').result).toBe('wrong');
  });
});

describe('scheduler', () => {
  it('promotes after one correct answer, two for priority, with the level interval', () => {
    let s = applyAnswer(newState('a', now), true, false, now);
    expect(s.box).toBe(1);
    expect(s.dueAt).toBe(day(1).toISOString());
    let p = applyAnswer(newState('b', now), true, true, now);
    expect(p.box).toBe(0);
    expect(p.streak).toBe(1);
    p = applyAnswer(p, true, true, now);
    expect(p.box).toBe(1);
    s = applyAnswer({ ...s, box: 3 }, true, false, now);
    expect(s.box).toBe(4);
    expect(s.dueAt).toBe(day(14).toISOString());
  });
  it('wrong goes one level down and is due now, never below 0', () => {
    const s = applyAnswer({ ...newState('a', now), box: 2, streak: 1 }, false, false, now);
    expect(s.box).toBe(1);
    expect(s.streak).toBe(0);
    expect(s.lapses).toBe(1);
    expect(s.dueAt).toBe(now.toISOString());
    expect(applyAnswer(newState('a', now), false, false, now).box).toBe(0);
  });
  it('maps levels to exercises', () => {
    expect([0, 1, 2, 3, 4, 5].map(exerciseFor)).toEqual(['choice', 'tiles', 'gapsHint', 'gaps', 'write', 'write']);
  });
  it('composes due first, then max 5 new, and interleaves units', () => {
    const words = [w('d1', 'x', 'u1'), w('d2', 'y', 'u1'), ...Array.from({ length: 8 }, (_, i) => w(`n${i}`, `n${i}`, i % 2 ? 'u1' : 'u2'))];
    const states = new Map([
      ['d1', { ...newState('d1', now), box: 2, dueAt: day(-2).toISOString() }],
      ['d2', { ...newState('d2', now), box: 1, dueAt: day(-1).toISOString() }],
    ]);
    const s = composeSession(words, states, now, { size: 10, maxNew: 5, rng: seq(0) });
    expect(s).toHaveLength(7);
    expect(s[0].word.id).toBe('d1');
    expect(s.filter((x) => x.state.box === 0)).toHaveLength(5);
    for (let i = 1; i < s.length; i++) if (s[i].word.unitId === s[i - 1].word.unitId) expect(s.slice(i).every((x) => x.word.unitId === s[i].word.unitId)).toBe(true);
  });
  it('skips items that are not due and secure items answered correctly', () => {
    const words = [w('a', 'x'), w('b', 'y')];
    const states = new Map([
      ['a', { ...newState('a', now), box: 2, dueAt: day(1).toISOString() }],
      ['b', { ...newState('b', now), box: 5, dueAt: day(-1).toISOString(), lastResult: true }],
    ]);
    expect(composeSession(words, states, now, { size: 10, maxNew: 5 })).toHaveLength(0);
  });
});

describe('exercises', () => {
  const pool = [w('a', 'The elephant is big.'), w('b', 'The monkey is small.'), w('c', 'I like the zoo.', 'u2'), w('d', 'We feed the cage.')];
  it('en-de swaps prompt and answer for every exercise', () => {
    const c = makeChoice(pool[0], pool, seq(0.3), 'en-de');
    expect(c.prompt).toBe('The elephant is big.');
    expect(c.answer).toBe('de a');
    expect(c.options.every((o) => o.startsWith('de '))).toBe(true);
    const t = makeTiles(pool[0], pool, seq(0.5), 'en-de');
    expect(t.tiles).toContain('de');
    expect(t.answer).toBe('de a');
    const g = makeGaps(pool[0], true, seq(0.1), 'en-de');
    expect(g.answer).toBe('de a');
  });
  it('choice has 4 unique options including the answer', () => {
    const c = makeChoice(pool[0], pool, seq(0.3, 0.7, 0.1));
    expect(c.options).toHaveLength(4);
    expect(new Set(c.options).size).toBe(4);
    expect(c.options).toContain('The elephant is big.');
  });
  it('tokenizes punctuation as its own token and joins it back', () => {
    expect(tokenize("Don't feed the animals!")).toEqual(["Don't", 'feed', 'the', 'animals', '!']);
    expect(tokenize('Hello, world.')).toEqual(['Hello', ',', 'world', '.']);
    expect(joinTokens(['Hello', ',', 'world', '.'])).toBe('Hello, world.');
  });
  it('tiles contain every token of the answer (punctuation separate) plus 2 distractors', () => {
    const t = makeTiles(pool[0], pool, seq(0.5, 0.2, 0.9));
    expect(t.tiles).toHaveLength(7);
    for (const x of ['The', 'elephant', 'is', 'big', '.']) expect(t.tiles).toContain(x);
  });
  it('gaps hit content words; hint shows the first letter; fillGaps rebuilds', () => {
    const g = makeGaps(pool[0], true, seq(0.1, 0.9));
    const gaps = g.tokens.filter((t) => t.gap);
    expect(gaps.length).toBeLessThanOrEqual(2);
    expect(gaps.every((t) => t.hint && t.hint.length === 1)).toBe(true);
    expect(gaps.every((t) => !['The', 'is'].includes(t.text))).toBe(true);
    expect(g.tokens.map((t) => t.text)).toEqual(['The', 'elephant', 'is', 'big', '.']);
    expect(g.tokens[4].gap).toBe(false);
    const inputs = g.tokens.map((t) => (t.gap ? t.text : ''));
    expect(fillGaps(g, inputs)).toBe('The elephant is big.');
    expect(makeGaps(pool[0], false, seq(0.1)).tokens.filter((t) => t.gap).every((t) => !t.hint)).toBe(true);
  });
});

describe('special parts (D-022): choice options are variations of the answer, mistakes get a reason', () => {
  const neg: Word = { id: 'n1', unitId: 'un', source: 'We had fresh milkshakes.', target: 'We did not have fresh milkshakes.', example: 'Wir hatten frische Milchshakes.', priority: false, status: 'active', kind: 'negation' };
  const neg2: Word = { ...neg, id: 'n2', source: 'She likes the zoo.', target: 'She does not like the zoo.' };
  const tense: Word = { id: 't1', unitId: 'ut', source: 'We visit the zoo.', target: 'We visited the zoo.', example: 'Wir besuchen den Zoo.', priority: false, status: 'active', kind: 'tense' };
  const tense2: Word = { ...tense, id: 't2', source: 'He goes home.', target: 'He went home.' };
  it('negation forward: missing did, wrong verb form, wrong tense, no instead of not', () => {
    const texts = special(neg, 'de-en').variants.map((v) => v.text);
    expect(texts).toEqual(['We not have fresh milkshakes.', 'We did not had fresh milkshakes.', 'We do not have fresh milkshakes.', 'We did no have fresh milkshakes.']);
    expect(special(neg, 'de-en').rule).toContain('did not have');
  });
  it('negation backward: variants never equal the answer or the prompt', () => {
    const { variants, rule } = special(neg, 'en-de');
    expect(variants.map((v) => v.text)).toEqual(['We did have fresh milkshakes.', 'We have fresh milkshakes.', 'We not had fresh milkshakes.', 'We did had fresh milkshakes.']);
    expect(rule).toContain('had');
  });
  it('tense forward: did + past, present perfect, regular -ed on an irregular verb', () => {
    expect(special(tense2, 'de-en').variants.map((v) => v.text)).toEqual(['He did went home.', 'He has went home.', 'He goed home.']); // the present form equals the prompt and is dropped
    expect(special(tense, 'de-en').variants.map((v) => v.text)).toEqual(['We did visited the zoo.', 'We have visited the zoo.', 'We were visiting the zoo.']);
  });
  it('tense backward: third-person -s, is/are + verb, -ing', () => {
    expect(special(tense2, 'en-de').variants.map((v) => v.text)).toEqual(['He go home.', 'He is go home.', 'He going home.']); // the past form equals the prompt and is dropped
  });
  it('choice uses the variants first and carries a reason per wrong option; vocabulary is untouched', () => {
    const c = makeChoice(neg, [neg, neg2], () => 0.4, 'de-en');
    expect(c.options).toHaveLength(4);
    expect(c.options).toContain(neg.target);
    expect(c.options).not.toContain(neg2.target);
    for (const o of c.options.filter((o) => o !== c.answer)) expect(c.why?.[o]).toBeTruthy();
    expect(makeWrite(tense, 'de-en').rule).toContain('visited');
    const plain = makeChoice(w('a', 'The cat sleeps.'), [w('a', 'The cat sleeps.'), w('b', 'The dog runs.')], () => 0.1);
    expect(plain.why).toBeUndefined();
    expect(plain.rule).toBeUndefined();
  });
});
