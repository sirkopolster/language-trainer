import { describe, expect, it } from 'vitest';
import { buildMock, readiness, scoreMock } from './mock';
import { newState } from './scheduler';
import type { TestFormat, Word } from './types';

const w = (id: string, source: string, target: string): Word => ({ id, unitId: 'u1', source, target, example: null, priority: false, status: 'active' });
const words = [w('a', 'Der Elefant ist groß.', 'The elephant is big.'), w('b', 'Der Affe ist klein.', 'The monkey is small.'), w('c', 'Ich mag den Zoo.', 'I like the zoo.'), w('d', 'Wo ist der Käfig?', 'Where is the cage?')];
const format: TestFormat = { sections: [{ type: 'translate', direction: 'de-en', items: 3, points: 6, label: 'Translate sentences' }, { type: 'choice', direction: 'en', items: 1, points: 1 }, { type: 'other', direction: 'en', items: 2, points: 2 }], totalPoints: 9, passMark: 5 };
let seed = 3; const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

describe('buildMock', () => {
  it('mirrors the sections, maps types, skips other, no repeats while sentences last', () => {
    const items = buildMock(format, words, rng);
    expect(items).toHaveLength(4);
    expect(items.slice(0, 3).every((i) => i.ex.type === 'write' && i.points === 2 && i.section === 'Translate sentences')).toBe(true);
    expect(items[3].ex.type).toBe('choice');
    expect(items[3].section).toBe('Auswahl');
    expect(new Set(items.map((i) => i.word.id)).size).toBe(4);
    expect(items.every((i) => i.ex.dir === 'de-en')).toBe(true);
  });
  it('is empty without sentences', () => {
    expect(buildMock(format, [])).toEqual([]);
  });
});

describe('scoreMock', () => {
  it('scores tolerant typing and exact choices, applies the pass mark', () => {
    const items = buildMock(format, words, rng);
    const answers = items.map((it, i) => ({ typed: i === 0 ? 'wrong answer here' : it.ex.answer.toLowerCase() }));
    const r = scoreMock(items, answers, format);
    expect(r.maxScore).toBe(7);
    expect(r.score).toBe(items[3].ex.type === 'choice' && answers[3].typed !== items[3].ex.answer ? 4 : 5);
    expect(r.items[0].correct).toBe(false);
    expect(r.passMark).toBe(5);
  });
  it('defaults the pass mark to 80 % when the sheet has none', () => {
    const f = { ...format, passMark: null };
    const items = buildMock(f, words, rng);
    const r = scoreMock(items, items.map((it) => ({ typed: it.ex.answer })), f);
    expect(r.passMark).toBe(5.6);
    expect(r.passed).toBe(true);
  });
});

describe('readiness', () => {
  const now = new Date();
  it('steps practice → almost → ready', () => {
    const st = new Map(words.map((x, i) => [x.id, { ...newState(x.id, now), box: i < 3 ? 3 : 1 }]));
    expect(readiness(words, st, []).level).toBe('almost');
    const all = new Map(words.map((x) => [x.id, { ...newState(x.id, now), box: 4 }]));
    expect(readiness(words, all, []).level).toBe('almost');
    expect(readiness(words, all, [{ passed: true }]).level).toBe('ready');
    expect(readiness(words, new Map(), []).level).toBe('practice');
  });
});
