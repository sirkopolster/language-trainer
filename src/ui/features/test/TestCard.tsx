import type { ReactNode } from 'react';
import type { Award, Test, Unit, Word } from '../../../domain/types';
import { MAX_STARS, lessonProgress, splitLessons } from '../../../domain/lessons';
import { ColorIcon, CrownIcon, FlameIcon, GraduationIcon, RocketIcon, SproutIcon, StarIcon, TestIcon, TrophyIcon } from '../../ds';
import type { SessionSummary } from '../../../domain/stats';
import { fmtDate } from './NewTestModal';

/** days until the test date, 0 = today, negative = past */
export const daysUntil = (d: string | null) => (d ? Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000) : null);

export const dateLine = (t: Test) => (t.testDate ? `Test am ${fmtDate(t.testDate)}` : 'Noch kein Testdatum');

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

export type TestStatusLabel = 'new' | 'started' | 'done';
export const testStatus = (p: ReturnType<typeof testProgress>): TestStatusLabel => (p.parts > 0 && p.done === p.parts ? 'done' : p.days > 0 || p.answers > 0 || p.stars > 0 ? 'started' : 'new');
const STATUS = { new: { label: 'Noch nicht angefangen', color: 'blue' as const, icon: <SproutIcon /> }, started: { label: 'Angefangen', color: 'orange' as const, icon: <RocketIcon /> }, done: { label: 'Abgeschlossen', color: 'yellow' as const, icon: <TrophyIcon /> } };

/** Home card: name large, test date, status, and only what was accomplished already (nothing shown while it is zero). */
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
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div className="testcard-name grow">{test.name}</div>
        <div className="testcard-status" data-testid="test-status"><ColorIcon color={STATUS[testStatus(progress)].color}>{STATUS[testStatus(progress)].icon}</ColorIcon><span className="text-xs" style={{ fontWeight: 600 }}>{STATUS[testStatus(progress)].label}</span></div>
      </div>
      <div className="text-sm muted">{dateLine(test)}{sub ? <> · {sub}</> : null}</div>
      {chips.length > 0 && <div className="row" style={{ flexWrap: 'wrap' }}>{chips.map((c) => <span key={c.text} className="chip"><span className="chip-icon">{c.icon}</span>{c.text}</span>)}</div>}
    </button>
  );
}
