// Tolerant sentence comparison (learning-concept §3). Pure.

export type CompareResult = 'exact' | 'hint' | 'close' | 'wrong';
export interface DiffPart { text: string; kind: 'ok' | 'bad' }
export interface Comparison { result: CompareResult; correct: boolean; /** expected sentence, with the parts the learner got wrong marked */ diff: DiffPart[] }

export const normalize = (s: string) =>
  s.toLowerCase().replace(/[’‘`´]/g, "'").replace(/[“”„]/g, '"').replace(/[.,!?;:"]+$/g, '').replace(/[.,!?;:"]/g, ' ').replace(/\s+/g, ' ').trim();

export function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let left = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = Math.min(prev[j] + 1, left + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev[j - 1] = left; left = cur;
    }
    prev[b.length] = left;
  }
  return prev[b.length];
}

/** Word-level diff: marks expected words that are missing or different in the typed text (LCS on normalised words). */
function wordDiff(expected: string, typed: string, raw: boolean): DiffPart[] {
  const e = expected.split(' ');
  const t = typed.split(' ');
  const key = (w: string) => (raw ? w : normalize(w));
  const ek = e.map(key), tk = t.map(key);
  const L = Array.from({ length: e.length + 1 }, () => new Array<number>(t.length + 1).fill(0));
  for (let i = e.length - 1; i >= 0; i--) for (let j = t.length - 1; j >= 0; j--) L[i][j] = ek[i] === tk[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const parts: DiffPart[] = [];
  let i = 0, j = 0;
  while (i < e.length) {
    if (j < t.length && ek[i] === tk[j]) { parts.push({ text: e[i], kind: 'ok' }); i++; j++; }
    else if (j < t.length && L[i][j + 1] >= L[i + 1][j]) j++;
    else { parts.push({ text: e[i], kind: 'bad' }); i++; }
  }
  return parts;
}

export function compare(typedIn: string, expected: string): Comparison {
  const typed = typedIn.replace(/\s+/g, ' ').trim();
  if (typed === expected.trim()) return { result: 'exact', correct: true, diff: [{ text: expected, kind: 'ok' }] };
  const nt = normalize(typed), ne = normalize(expected);
  if (nt === ne) return { result: 'hint', correct: true, diff: wordDiff(expected, typed, true) };
  const allowed = Math.max(1, Math.round(ne.length / 10));
  if (levenshtein(nt, ne) <= allowed) return { result: 'close', correct: true, diff: wordDiff(expected, typed, false) };
  return { result: 'wrong', correct: false, diff: wordDiff(expected, typed, false) };
}
