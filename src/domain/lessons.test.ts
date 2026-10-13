import { describe, expect, it } from 'vitest';
import { lessonProgress, partRef, splitLessons, starsFor } from './lessons';
import type { Award, Word } from './types';

const w = (id: string, unitId = 'u1'): Word => ({ id, unitId, source: id, target: id, example: null, priority: false, status: 'active' });

describe('splitLessons', () => {
  it('splits a unit into lessons of 5, merging a lonely last sentence', () => {
    const l = splitLessons(Array.from({ length: 11 }, (_, i) => w(`s${i}`)));
    expect(l.map((x) => x.words.length)).toEqual([5, 6]);
    expect(l[0].n).toBe(1);
    expect(l[1].words[5].id).toBe('s10');
  });
  it('keeps units apart and ignores inactive words', () => {
    const l = splitLessons([w('a'), w('b', 'u2'), { ...w('c'), status: 'review' }]);
    expect(l.map((x) => [x.unitId, x.words.length])).toEqual([['u1', 1], ['u2', 1]]);
  });
});

describe('stars and progress', () => {
  it('maps mistakes to stars', () => {
    expect([0, 1, 2, 3, 9].map(starsFor)).toEqual([3, 2, 2, 1, 1]);
  });
  it('reads part stars, next open part and crown from awards', () => {
    const a = (ref: string, value: number, kind: Award['kind'] = 'star'): Award => ({ id: ref, profileId: 'p', kind, refId: 'u1', ref, value, awardedAt: '' });
    const awards = [a(partRef(1, 'choice'), 3), a(partRef(1, 'tiles'), 2), a(partRef(2, 'choice'), 3), a('lesson:2', 1, 'crown')];
    const p = lessonProgress(awards, 'u1', 1);
    expect(p.stars.choice).toBe(3);
    expect(p.stars.tiles).toBe(2);
    expect(p.stars.gapsHint).toBeNull();
    expect(p.nextPart).toBe(2);
    expect(p.total).toBe(5);
    expect(p.crown).toBe(false);
    expect(lessonProgress(awards, 'u1', 2).crown).toBe(true);
    expect(lessonProgress(awards, 'u2', 1).nextPart).toBe(0);
  });
});
