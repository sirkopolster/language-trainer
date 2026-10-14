// Accomplishment counters for the home screen. Pure.
import { PARTS } from './lessons';
import type { Award } from './types';

export interface SessionSummary { startedAt: string; kind: 'study' | 'mock'; items: number; profileId?: string; unitId?: string | null }
export interface Stats { days: number; partsDone: number; answers: number; mocks: number }

/** days = distinct calendar days with a session · partsDone = parts where every round has stars · answers = all logged answers · mocks = mock sessions */
export function computeStats(sessions: SessionSummary[], awards: Award[]): Stats {
  const days = new Set(sessions.map((s) => s.startedAt.slice(0, 10))).size;
  const byPart = new Map<string, Set<string>>();
  for (const a of awards) {
    if (a.kind !== 'star') continue;
    const m = a.ref.match(/^lesson:(\d+):(\w+)$/);
    if (!m) continue;
    const key = `${a.refId}:${m[1]}`;
    byPart.set(key, (byPart.get(key) ?? new Set()).add(m[2]));
  }
  const partsDone = [...byPart.values()].filter((rounds) => PARTS.every((p) => rounds.has(p.type))).length;
  return { days, partsDone, answers: sessions.reduce((n, s) => n + s.items, 0), mocks: sessions.filter((s) => s.kind === 'mock').length };
}
