import { describe, expect, it } from 'vitest';
import { grammarPrompt, normalizeGrammar } from './grammar';

describe('grammar', () => {
  it('normalizes pairs: trims, drops incomplete and identical, dedupes', () => {
    const out = normalizeGrammar({ pairs: [
      { a: ' I visit the zoo. ', b: 'I visited the zoo.', de: 'Ich besuche den Zoo.' },
      { a: 'I visit the zoo.', b: 'I visited the zoo.', de: 'doppelt' },
      { a: 'I like it.', b: 'I like it.', de: 'gleich' },
      { a: 'No German', b: 'x', de: '' },
      null, 5,
    ] });
    expect(out).toEqual([{ a: 'I visit the zoo.', b: 'I visited the zoo.', de: 'Ich besuche den Zoo.' }]);
    expect(normalizeGrammar(undefined)).toEqual([]);
  });
  it('prompts list the sentences and the task', () => {
    const p = grammarPrompt('negation', [{ en: 'I visited the zoo.', de: 'Ich besuchte den Zoo.' }]);
    expect(p).toContain('- I visited the zoo. (Ich besuchte den Zoo.)');
    expect(p).toContain('did not');
    expect(grammarPrompt('tense', [])).toContain('simple past');
  });
});
