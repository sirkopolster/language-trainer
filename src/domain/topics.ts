// Test topics: what the real test covers, suggested from the extracted format and the words. Pure.
import type { TestFormat } from './types';

const TYPE_TOPIC: Record<string, string> = { translate: 'Sätze übersetzen (Deutsch → Englisch)', gap: 'Lückentexte ausfüllen', choice: 'Richtige Form auswählen', match: 'Zuordnen' };
const KEYWORDS: [RegExp, string][] = [
  [/simple past|past tense|vergangenheit|preterit/i, 'Vergangenheit ↔ Gegenwart (simple past)'],
  [/present progressive|-ing form|verlaufsform/i, 'Verlaufsform (present progressive)'],
  [/question|frage/i, 'Fragen bilden'],
  [/negat|vernein/i, 'Verneinung'],
  [/plural|mehrzahl/i, 'Plural'],
  [/vocab|vokabel|wörter|words/i, 'Vokabeln'],
];

/** Topics suggested from the test format sections (type + instruction text) plus "Vokabeln lernen" when words exist. Deduplicated, in reading order. */
export function suggestTopics(format: TestFormat | null, hasWords: boolean): string[] {
  const out: string[] = [];
  const add = (t: string) => { if (!out.includes(t)) out.push(t); };
  if (hasWords) add('Vokabeln lernen');
  for (const s of format?.sections ?? []) {
    if (TYPE_TOPIC[s.type]) add(TYPE_TOPIC[s.type]);
    for (const [re, topic] of KEYWORDS) if (s.label && re.test(s.label)) add(topic);
  }
  return out;
}
