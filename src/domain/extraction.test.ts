import { describe, expect, it } from 'vitest';
import { normalizeFormat, normalizeVocab } from './extraction';

describe('normalizeVocab', () => {
  it('trims, drops empty and duplicate pairs, maps emphasis to priority', () => {
    const out = normalizeVocab({ unit: 'UNIT 4', words: [
      { source: ' to run ', target: 'laufen', example: null, emphasis: true },
      { source: 'to run', target: 'Laufen', example: 'I run.', emphasis: false },
      { source: '', target: 'x', example: null, emphasis: false },
      { source: 'house', target: 'Haus', example: '  The  house. ', emphasis: false },
    ] });
    expect(out.unit).toBe('Unit 4');
    expect(out.words).toEqual([
      { source: 'to run', target: 'laufen', example: null, priority: true },
      { source: 'house', target: 'Haus', example: 'The house.', priority: false },
    ]);
  });
  it('keeps free unit labels and survives garbage', () => {
    expect(normalizeVocab({ unit: 'Chapter 2b', words: [] }).unit).toBe('Chapter 2b');
    expect(normalizeVocab({ unit: 'At the zoo', words: [] }).unit).toBe('At the zoo');
    expect(normalizeVocab(null)).toEqual({ unit: null, words: [] });
    expect(normalizeVocab({ words: [null, 5, 'x'] }).words).toEqual([]);
  });
});

describe('normalizeFormat', () => {
  it('drops empty sections, defaults points to items, sums total', () => {
    const out = normalizeFormat({ sections: [
      { type: 'translate', direction: 'DE-EN', items: 10, points: 0, label: ' Translate ' },
      { type: 'weird', direction: '', items: 4, points: 8, label: null },
      { type: 'gap', direction: 'en', items: 0, points: 5, label: null },
    ], total_points: null, pass_mark: null });
    expect(out).toEqual({ sections: [
      { type: 'translate', direction: 'de-en', items: 10, points: 10, label: 'Translate' },
      { type: 'other', direction: 'de-en', items: 4, points: 8 },
    ], totalPoints: 18, passMark: null });
  });
  it('keeps printed totals and pass marks', () => {
    const out = normalizeFormat({ sections: [{ type: 'match', direction: 'en-de', items: 6, points: 6, label: null }], total_points: 20, pass_mark: 12 });
    expect(out.totalPoints).toBe(20);
    expect(out.passMark).toBe(12);
  });
});
