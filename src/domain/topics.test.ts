import { describe, expect, it } from 'vitest';
import { suggestTopics } from './topics';

describe('suggestTopics', () => {
  it('derives topics from section types and instruction keywords, deduplicated', () => {
    const t = suggestTopics({ sections: [
      { type: 'translate', direction: 'de-en', items: 6, points: 8, label: 'Translate sentences' },
      { type: 'choice', direction: 'en', items: 1, points: 1, label: 'Umkreise alle Verbformen in der Vergangenheit (simple past)!' },
      { type: 'translate', direction: 'de-en', items: 2, points: 2 },
    ], totalPoints: 10, passMark: 7 }, true);
    expect(t).toEqual(['Vokabeln lernen', 'Sätze übersetzen (Deutsch → Englisch)', 'Richtige Form auswählen', 'Vergangenheit ↔ Gegenwart (simple past)']);
  });
  it('is empty without format and words', () => {
    expect(suggestTopics(null, false)).toEqual([]);
  });
});
