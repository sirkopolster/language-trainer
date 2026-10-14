import { describe, expect, it } from 'vitest';
import { computeStats } from './stats';
import type { Award } from './types';

const a = (refId: string, ref: string, kind: Award['kind'] = 'star'): Award => ({ id: ref, profileId: 'p', kind, refId, ref, value: 2, awardedAt: '' });

describe('computeStats', () => {
  it('counts days, finished parts, answers and mocks', () => {
    const s = computeStats([
      { startedAt: '2026-10-13T18:00:00Z', kind: 'study', items: 10 },
      { startedAt: '2026-10-13T19:00:00Z', kind: 'study', items: 12 },
      { startedAt: '2026-10-14T07:00:00Z', kind: 'mock', items: 7 },
    ], [a('u1', 'lesson:1:choice'), a('u1', 'lesson:1:tiles'), a('u1', 'lesson:1:gapsHint'), a('u1', 'lesson:1:write'), a('u1', 'lesson:2:choice'), a('u1', 'lesson:1', 'crown')]);
    expect(s).toEqual({ days: 2, partsDone: 1, answers: 29, mocks: 1 });
  });
  it('is all zero without data', () => {
    expect(computeStats([], [])).toEqual({ days: 0, partsDone: 0, answers: 0, mocks: 0 });
  });
});
