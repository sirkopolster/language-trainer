import type { ReactNode } from 'react';
import type { Award, Test, Unit, Word } from '../../../domain/types';
import { MAX_STARS, lessonProgress, splitLessons } from '../../../domain/lessons';
import { CrownIcon, FlameIcon, GraduationIcon, StarIcon, TestIcon } from '../../ds';
import type { SessionSummary } from '../../../domain/stats';
import { fmtDate } from './NewTestModal';

/** days until the test date, 0 = today, negative = past */
export const daysUntil = (d: string | null) => (d ? Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000) : null);

export function dateLine(t: Test): string {
  const n = daysUntil(t.testDate);
  if (n === null) return 'Noch kein Testdatum';
  const when = n === 0 ? 'heute' : n === 1 ? 'morgen' : n > 1 ? `in ${n} Tagen` : n === -1 ? 'gestern' : `vor ${-n} Tagen`;
  return `Test am ${fmtDate(t.testDate)} · ${when}`;
}

/** achievements of one test: days learned, answers, stars, parts done, crowns */
export function testProgress(t: Test, units: Unit[], words: Word[], awards: Award[], sessions: SessionSummary[] = []) {
  const unitIds = new Set(units.filter((u) => u.testId === t.id).map((u) => u.id));
  const own = sessions.filter((s) => s.unitId && unitIds.has(s.unitId));
  const days = new Set(own.map((s) => s.startedAt.slice(0, 10))).size;
  const answers = own.reduce((n, s) => n + s.items, 0);
  const lessons = splitLessons(words.filter((w) => unitIds.has(w.unitId)));
  let stars = 0, done = 0, crowns = 0;
  for (const l of lessons) { const p = lessonProgress(awards, l.unitId, l.n); stars += p.total; if (p.nextPart >= 4) done++; if (p.crown) crowns++; }
  return { parts: lessons.length, done, stars, crowns, days, answers, maxStars: lessons.length * MAX_STARS };
}

/** Home card: name large, test date, and only what was accomplished already (nothing shown while it is zero). */
export function TestCard({ test, sub, progress, onClick }: { test: Test; sub?: ReactNode; progress: ReturnType<typeof testProgress>; onClick: () => void }) {
  const chips = [
    progress.days > 0 && { icon: <FlameIcon />, text: progress.days === 1 ? '1 Tag gelernt' : `${progress.days} Tage gelernt` },
    progress.answers > 0 && { icon: <TestIcon />, text: progress.answers === 1 ? '1 Aufgabe gelöst' : `${progress.answers} Aufgaben gelöst` },
    progress.stars > 0 && { icon: <StarIcon />, text: progress.stars === 1 ? '1 Stern' : `${progress.stars} Sterne` },
    progress.done > 0 && { icon: <GraduationIcon />, text: progress.done === 1 ? '1 Teil geschafft' : `${progress.done} Teile geschafft` },
    progress.crowns > 0 && { icon: <CrownIcon />, text: progress.crowns === 1 ? '1 Krone' : `${progress.crowns} Kronen` },
  ].filter(Boolean) as { icon: ReactNode; text: string }[];
  return (
    <button type="button" className="testcard" data-testid={`test-${test.id}`} onClick={onClick}>
      <div className="testcard-name">{test.name}</div>
      <div className="text-sm muted">{dateLine(test)}{sub ? <> · {sub}</> : null}</div>
      {chips.length > 0 && <div className="row" style={{ flexWrap: 'wrap' }}>{chips.map((c) => <span key={c.text} className="chip"><span className="chip-icon">{c.icon}</span>{c.text}</span>)}</div>}
    </button>
  );
}
