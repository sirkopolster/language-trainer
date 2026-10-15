// Special parts (D-020): grammar drills generated from the test's own sentences. Schemas, prompts and normalizers; pure, shared with the Edge Function.

export type SpecialKind = 'tense' | 'negation';
export const SPECIAL: Record<SpecialKind, { label: string; title: string; forward: string; backward: string }> = {
  tense: { label: 'Spezialteil A', title: 'Gegenwart ↔ Vergangenheit', forward: 'Setze den Satz in die Vergangenheit.', backward: 'Setze den Satz in die Gegenwart.' },
  negation: { label: 'Spezialteil B', title: 'Verneinung', forward: 'Verneine den Satz.', backward: 'Mach aus dem verneinten Satz einen positiven.' },
};

export const GRAMMAR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pairs: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          a: { type: 'string', description: 'tense: the sentence in simple present · negation: the positive sentence' },
          b: { type: 'string', description: 'tense: the same sentence in simple past · negation: the same sentence negated' },
          de: { type: 'string', description: 'German meaning of sentence a' },
        },
        required: ['a', 'b', 'de'],
      },
    },
  },
  required: ['pairs'],
} as const;

export function grammarPrompt(kind: SpecialKind, sentences: { en: string; de: string }[]): string {
  const list = sentences.map((s) => `- ${s.en} (${s.de})`).join('\n');
  const task = kind === 'tense'
    ? 'Pick only sentences whose main verb can naturally stand in simple present AND simple past (visit/visited, enjoy/enjoyed, go/went …). For each, give the present form as "a", the past form as "b" (simple past, no progressive, keep every other word), and the German meaning of "a" as "de". If a sentence is already in the past, "b" is the original and "a" its present form.'
    : 'Pick only sentences with a verb that can be negated with do/does/did not, is/are/was not or can/will not. For each, give the positive sentence as "a", the negated sentence as "b" (use the long form "did not", "do not", keep every other word), and the German meaning of "a" as "de". If a sentence is already negative, "b" is the original and "a" its positive form.';
  return `These are English sentences a child learns for a school test, with German meanings:\n${list}\n\n${task} Use only vocabulary from the list, keep sentences short and natural for a 10-year-old, no duplicates, at most 15 pairs. Return JSON only.`;
}

export interface GrammarPair { a: string; b: string; de: string }

/** Trims, drops incomplete or identical pairs, dedupes on "a" (case-insensitive). */
export function normalizeGrammar(raw: unknown): GrammarPair[] {
  const r = (raw ?? {}) as { pairs?: unknown };
  const seen = new Set<string>();
  const out: GrammarPair[] = [];
  for (const p of Array.isArray(r.pairs) ? r.pairs : []) {
    const x = (p ?? {}) as Record<string, unknown>;
    const a = str(x.a), b = str(x.b), de = str(x.de);
    if (!a || !b || !de || a.toLowerCase() === b.toLowerCase()) continue;
    const key = a.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ a, b, de });
  }
  return out;
}
const str = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
