// Exercise generators for the ladder levels (learning-concept §1). Pure, rng injectable.
import { shuffle } from './scheduler';
import type { Word } from './types';

/** 'de-en' = German prompt, English answer (the test direction); 'en-de' = understand English, answer in German */
export type Direction = 'de-en' | 'en-de';
export type Kind = 'vocab' | 'tense' | 'negation';
/** rule: D-022 grammar note shown after a mistake (special kinds only) */
interface Base { dir: Direction; kind: Kind; prompt: string; answer: string; rule?: string }
export interface Choice extends Base { type: 'choice'; options: string[]; /** D-022: why a wrong option is wrong (special kinds: options are variations of the answer) */ why?: Record<string, string> }
export interface Tiles extends Base { type: 'tiles'; tiles: string[] }
export interface Gaps extends Base { type: 'gaps'; tokens: { text: string; gap: boolean; hint?: string }[] }
export interface Write extends Base { type: 'write' }
export type Exercise = Choice | Tiles | Gaps | Write;

const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'am', 'to', 'of', 'in', 'on', 'at', 'and', 'or', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'do', 'does', 'did', 'not', "don't", 'this', 'that', 'was', 'were', 'be', 'have', 'has', 'had', 'with', 'for', 'but', 'so',
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'ist', 'sind', 'bin', 'bist', 'war', 'und', 'oder', 'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mein', 'dein', 'sein', 'ihre', 'nicht', 'mit', 'für', 'auf', 'in', 'im', 'am', 'zu', 'von', 'aus', 'wo', 'was', 'wie', 'hat', 'habe', 'haben', 'ein', 'den']);

/** prompt/answer for a direction */
export const sides = (word: Word, dir: Direction) => (dir === 'de-en' ? { prompt: word.source, answer: word.target } : { prompt: word.target, answer: word.source });
const kindOf = (w: Word): Kind => w.kind ?? 'vocab';
const answerOf = (w: Word, dir: Direction) => (dir === 'de-en' ? w.target : w.source);
const strip = (w: string) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
const isContent = (w: string) => { const s = strip(w); return s.length >= 3 && !STOP.has(s.toLowerCase()); };

/** 4 options: the answer + 3 other sentences from the pool (same unit first), prompt = the German sentence. */
export function makeChoice(word: Word, pool: Word[], rng: () => number, dir: Direction = 'de-en'): Choice {
  const { prompt, answer } = sides(word, dir);
  // special kinds (D-022): wrong variations of the answer itself, each with its reason; other sentences only fill up
  const notes = special(word, dir);
  const variants = shuffle(notes.variants, rng).slice(0, 3);
  // distractors come from the same kind of unit: past forms against past forms, negations against negations
  const others = shuffle(pool.filter((w) => w.id !== word.id && kindOf(w) === kindOf(word) && answerOf(w, dir) !== answer), rng);
  const sameUnit = others.filter((w) => w.unitId === word.unitId);
  const distractors = [...variants.map((v) => v.text), ...[...sameUnit, ...others.filter((w) => w.unitId !== word.unitId)].map((w) => answerOf(w, dir))].slice(0, 3);
  return { type: 'choice', dir, kind: kindOf(word), prompt, options: shuffle([answer, ...distractors], rng), answer, ...(notes.rule ? { rule: notes.rule, why: Object.fromEntries(variants.map((v) => [v.text, v.why])) } : {}) };
}

/** Word tiles of the answer plus 2 distractor words from other sentences, shuffled. */
export function makeTiles(word: Word, pool: Word[], rng: () => number, dir: Direction = 'de-en'): Tiles {
  const { prompt, answer } = sides(word, dir);
  const own = tokenize(answer);
  const ownSet = new Set(own.map((w) => strip(w).toLowerCase()));
  const candidates = shuffle(pool.filter((w) => w.id !== word.id).flatMap((w) => answerOf(w, dir).split(/\s+/)).map(strip).filter((w) => w && !ownSet.has(w.toLowerCase())), rng);
  const distractors = [...new Set(candidates)].slice(0, 2);
  return { type: 'tiles', dir, kind: kindOf(word), prompt, tiles: shuffle([...own, ...distractors], rng), answer, ...rule(word, dir) };
}

/** Gaps on content words: with hint = 1–2 gaps and first letter shown; without = about half the content words, no letters. */
export function makeGaps(word: Word, hint: boolean, rng: () => number, dir: Direction = 'de-en'): Gaps {
  const { prompt, answer } = sides(word, dir);
  const tokens = tokenize(answer);
  let idx = tokens.map((t, i) => (isContent(t) ? i : -1)).filter((i) => i >= 0);
  if (idx.length === 0) idx = tokens.map((_, i) => i).filter((i) => !isPunct(tokens[i]) && tokens[i].length >= 2);
  const n = hint ? Math.min(2, idx.length) : Math.max(1, Math.ceil(idx.length / 2));
  const gaps = new Set(shuffle(idx, rng).slice(0, n));
  return {
    type: 'gaps',
    dir,
    kind: kindOf(word),
    prompt,
    tokens: tokens.map((t, i) => (gaps.has(i) ? { text: t, gap: true, ...(hint ? { hint: strip(t).slice(0, 1) } : {}) } : { text: t, gap: false })),
    answer,
    ...rule(word, dir),
  };
}

export const makeWrite = (word: Word, dir: Direction = 'de-en'): Write => ({ type: 'write', dir, kind: kindOf(word), ...sides(word, dir), ...rule(word, dir) });
const rule = (word: Word, dir: Direction) => { const r = special(word, dir).rule; return r ? { rule: r } : {}; };

// ---- D-022: special parts — wrong variations of the answer and the grammar rule behind it ----

export interface Variant { text: string; why: string }
const AUX_DO = new Set(['do', 'does', 'did']);
const AUX_BE = new Set(['is', 'are', 'am', 'was', 'were']);
const lc = (t: string) => t.toLowerCase();
const expand = (s: string) => s.replace(/\bcan't\b/gi, 'can not').replace(/\bwon't\b/gi, 'will not').replace(/(\w+)n['’]t\b/g, '$1 not');
const swapDo = (aux: string) => (lc(aux) === 'did' ? 'do' : 'did');
const swapBe = (aux: string) => ({ is: 'was', are: 'were', am: 'was', was: 'is', were: 'are' } as Record<string, string>)[lc(aux)] ?? aux;
const ing = (v: string) => (/e$/i.test(v) && !/ee$/i.test(v) ? v.slice(0, -1) + 'ing' : v + 'ing');
const regularPast = (v: string) => (/e$/i.test(v) ? v + 'd' : /[^aeiou]y$/i.test(v) ? v.slice(0, -1) + 'ied' : v + 'ed');
const dropS = (v: string) => (/ies$/i.test(v) ? v.slice(0, -3) + 'y' : /(oes|shes|ches|xes|sses)$/i.test(v) ? v.slice(0, -2) : v.slice(0, -1));
const addS = (v: string) => (/[^aeiou]y$/i.test(v) ? v.slice(0, -1) + 'ies' : /(o|sh|ch|x|ss)$/i.test(v) ? v + 'es' : v + 's');
const q = (s: string) => `„${s}“`;
const third = (subj: string) => ['he', 'she', 'it'].includes(lc(subj));
const normalizeKey = (s: string) => lc(expand(s)).replace(/[^\p{L}\p{N}' ]+/gu, '').replace(/\s+/g, ' ').trim();

/** For tense/negation words: the rule to show after a mistake and wrong variations of the answer for the choice round. Empty for vocabulary. */
export function special(word: Word, dir: Direction): { rule?: string; variants: Variant[] } {
  const kind = kindOf(word);
  if (kind === 'vocab') return { variants: [] };
  const { prompt, answer } = sides(word, dir);
  const out = kind === 'tense' ? tenseNotes(word, dir) : negationNotes(word, dir);
  const seen = new Set([normalizeKey(answer), normalizeKey(prompt)]);
  const variants = out.variants.filter((v) => { const k = normalizeKey(v.text); if (!k || seen.has(k)) return false; seen.add(k); return true; });
  return { rule: out.rule, variants };
}

/** first index where the two sentences differ (the verb) */
function verbIndex(a: string[], b: string[]): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (lc(a[i]) !== lc(b[i])) return i;
  return -1;
}
const withToken = (tokens: string[], i: number, t: string) => joinTokens(tokens.map((x, j) => (j === i ? t : x)));
const insertAt = (tokens: string[], i: number, t: string) => joinTokens([...tokens.slice(0, i), t, ...tokens.slice(i)]);
const without = (tokens: string[], i: number, n = 1) => joinTokens([...tokens.slice(0, i), ...tokens.slice(i + n)]);

function tenseNotes(word: Word, dir: Direction): { rule?: string; variants: Variant[] } {
  const pres = tokenize(expand(word.source)), past = tokenize(expand(word.target));
  const i = verbIndex(pres, past);
  if (i < 0) return { variants: [] };
  const p = pres[i], pa = past[i];
  const subj = pres[0];
  const be = AUX_BE.has(lc(p)) || AUX_BE.has(lc(pa));
  const stem = third(subj) && !be ? dropS(p) : p; // goes → go
  const v: Variant[] = [];
  if (dir === 'de-en') {
    // answer = simple past
    if (be) {
      const other = lc(pa) === 'was' ? 'were' : 'was';
      v.push({ text: withToken(past, i, other), why: `Nach ${subj} heißt es ${q(pa)}, nicht ${q(other)}.` });
      v.push({ text: withToken(past, i, 'have been'), why: `${q('have been')} ist Present Perfect. Simple Past ist einfach ${q(pa)}.` });
      v.push({ text: withToken(past, i, p), why: `${q(p)} ist Gegenwart. Die Vergangenheit heißt ${q(pa)}.` });
      return { rule: `Merke: Die Vergangenheit von ${q(p)} ist ${q(pa)} – nach we/you/they steht were, nach I/he/she/it was.`, variants: v };
    }
    const irregular = lc(regularPast(stem)) !== lc(pa);
    v.push({ text: insertAt(past, i, 'did'), why: `Nach did stünde die Grundform. Simple Past braucht kein did: einfach ${q(pa)}.` });
    v.push({ text: insertAt(past, i, third(subj) ? 'has' : 'have'), why: `Das ist Present Perfect (have + Partizip). Simple Past steht ohne have: ${q(pa)}.` });
    v.push(irregular
      ? { text: withToken(past, i, regularPast(stem)), why: `${q(stem)} ist unregelmäßig: die Vergangenheit heißt ${q(pa)}, nicht ${q(regularPast(stem))}.` }
      : { text: withToken(past, i, `${third(subj) || lc(subj) === 'i' ? 'was' : 'were'} ${ing(stem)}`), why: `Das ist die Verlaufsform (was/were + -ing). Simple Past ist einfach ${q(pa)}.` });
    v.push({ text: withToken(past, i, p), why: `${q(p)} ist Gegenwart. Die Vergangenheit heißt ${q(pa)}.` });
    return { rule: `Merke: Simple Past von ${q(stem)} ist ${q(pa)}${irregular ? ' (unregelmäßig, kein -ed)' : ' (regelmäßig mit -ed)'} – ohne did oder have davor.`, variants: v };
  }
  // answer = simple present
  if (be) {
    const other = lc(p) === 'are' ? 'is' : 'are';
    v.push({ text: withToken(pres, i, other), why: `Nach ${subj} heißt es ${q(p)}, nicht ${q(other)}.` });
    v.push({ text: withToken(pres, i, 'be'), why: `${q('be')} muss gebeugt werden: ${q(p)}.` });
    v.push({ text: withToken(pres, i, pa), why: `${q(pa)} ist Vergangenheit. Gegenwart: ${q(p)}.` });
    return { rule: `Merke: In der Gegenwart heißt es ${q(p)} (nach we/you/they are, nach he/she/it is, nach I am), nicht ${q(pa)}.`, variants: v };
  }
  v.push(third(subj)
    ? { text: withToken(pres, i, dropS(p)), why: `Nach he/she/it bekommt das Verb ein -s: ${q(p)}.` }
    : { text: withToken(pres, i, addS(p)), why: `Das -s gibt es nur nach he/she/it. Hier heißt es ${q(p)}.` });
  v.push({ text: withToken(pres, i, `${third(subj) ? 'is' : lc(subj) === 'i' ? 'am' : 'are'} ${stem}`), why: `Gegenwart ohne is/are davor: einfach ${q(p)}.` });
  v.push({ text: withToken(pres, i, ing(stem)), why: `${q(ing(stem))} allein ist kein ganzer Satz. Gegenwart: ${q(p)}.` });
  v.push({ text: withToken(pres, i, pa), why: `${q(pa)} ist Vergangenheit. Gegenwart: ${q(p)}.` });
  return { rule: `Merke: In der Gegenwart heißt es ${q(p)}, nicht ${q(pa)}${third(subj) ? ' – nach he/she/it mit -s' : ' – ohne -s, weil das Subjekt nicht he/she/it ist'}.`, variants: v };
}

function negationNotes(word: Word, dir: Direction): { rule?: string; variants: Variant[] } {
  const pos = tokenize(expand(word.source)), neg = tokenize(expand(word.target));
  const ni = neg.findIndex((t) => lc(t) === 'not');
  if (ni < 1) return { variants: [] };
  const aux = neg[ni - 1], a = lc(aux);
  const isDo = AUX_DO.has(a);
  const base = isDo ? neg[ni + 1] ?? null : null; // base form after do/does/did not
  const posVerb = pos[ni - 1] && lc(pos[ni - 1]) !== a ? pos[ni - 1] : null; // the finite verb of the positive sentence (had)
  const changed = !!(posVerb && base && lc(posVerb) !== lc(base));
  const past = a === 'did' || a === 'was' || a === 'were';
  const tense = past ? 'Vergangenheit' : 'Gegenwart';
  const v: Variant[] = [];
  if (dir === 'de-en') {
    // answer = negated
    if (isDo) {
      v.push({ text: without(neg, ni - 1), why: `Die Verneinung braucht ein Hilfsverb: ${q(`${a} not`)}. Nur ${q('not')} allein reicht nicht.` });
      if (changed) v.push({ text: withToken(neg, ni + 1, posVerb!), why: `Nach ${q(`${a} not`)} steht das Verb in der Grundform: ${q(`${a} not ${base}`)}, nicht ${q(`${a} not ${posVerb}`)}.` });
      v.push({ text: withToken(neg, ni - 1, swapDo(aux)), why: `Falsche Zeit: Der Satz steht in der ${tense}, also ${q(`${a} not`)}.` });
      v.push({ text: withToken(neg, ni, 'no'), why: `Verneint wird mit ${q('not')}, nicht mit ${q('no')}.` });
      return { rule: `Merke: Verneinung mit ${q(`${a} not`)} + Grundform des Verbs: ${q(`${a} not ${base ?? ''}`.trim())}${changed ? ` (nicht ${q(`${a} not ${posVerb}`)})` : ''}.`, variants: v };
    }
    v.push({ text: joinTokens(neg.map((t, j) => (j === ni - 1 ? 'not' : j === ni ? aux : t))), why: `${q('not')} steht hinter dem Hilfsverb: ${q(`${a} not`)}.` });
    v.push({ text: insertAt(neg, ni - 1, past ? 'did' : 'do'), why: `Bei ${q(a)} braucht man kein do/did: einfach ${q(`${a} not`)}.` });
    v.push({ text: withToken(neg, ni - 1, swapBe(aux)), why: `Falsche Zeit: Der Satz steht in der ${tense}, also ${q(`${a} not`)}.` });
    v.push({ text: without(neg, ni), why: `Da fehlt die Verneinung: ${q(`${a} not`)}.` });
    return { rule: `Merke: Bei ${q(a)} steht not einfach dahinter: ${q(`${a} not`)} – ohne do/does/did.`, variants: v };
  }
  // answer = positive
  if (isDo) {
    const verb = posVerb ?? base ?? aux;
    v.push({ text: without(neg, ni), why: `Im positiven Satz braucht man kein ${q(a)}: einfach ${q(verb)}.` });
    if (changed) v.push({ text: without(neg, ni - 1, 2), why: `Ohne ${q(a)} muss das Verb selbst die Zeit zeigen: ${q(posVerb!)}, nicht ${q(base!)}.` });
    v.push({ text: insertAt(pos, ni - 1, 'not'), why: `Der Satz soll positiv sein, also ohne ${q('not')}.` });
    if (changed) v.push({ text: insertAt(pos, ni - 1, a), why: `${q(a)} braucht die Grundform – und im positiven Satz braucht man es gar nicht: ${q(posVerb!)}.` });
    return { rule: `Merke: Der positive Satz kommt ohne ${q(a)} und ohne not aus${changed ? `: das Verb heißt dann ${q(posVerb!)}, nicht ${q(base!)}` : `: einfach ${q(verb)}`}.`, variants: v };
  }
  v.push({ text: insertAt(pos, ni - 1, past ? 'did' : 'do'), why: `Bei ${q(a)} braucht man kein do/did.` });
  v.push({ text: withToken(pos, ni - 1, swapBe(aux)), why: `Falsche Zeit: Der Satz steht in der ${tense}, also ${q(a)}.` });
  v.push({ text: withToken(pos, ni - 1, `not ${aux}`), why: `Der Satz soll positiv sein, also ohne ${q('not')}.` });
  return { rule: `Merke: Im positiven Satz fällt nur das not weg: ${q(a)}.`, variants: v };
}

/** Splits a sentence into word tokens and separate punctuation tokens: "Don't feed the animals!" → ["Don't","feed","the","animals","!"] */
export function tokenize(sentence: string): string[] {
  const out: string[] = [];
  for (const w of sentence.split(/\s+/).filter(Boolean)) {
    const m = w.match(/^(.*?)([.,!?;:]+)$/);
    if (m && m[1]) { out.push(m[1], m[2]); } else out.push(w);
  }
  return out;
}
export const isPunct = (t: string) => /^[.,!?;:]+$/.test(t);
/** Joins tokens back, no space before punctuation. */
export const joinTokens = (tokens: string[]) => tokens.reduce((s, t) => (s === '' ? t : isPunct(t) ? s + t : `${s} ${t}`), '');

/** Rebuilds the learner's sentence from gap inputs, keeping the given tokens. */
export const fillGaps = (g: Gaps, inputs: string[]) => joinTokens(g.tokens.map((t, i) => (t.gap ? (inputs[i] ?? '').trim() : t.text)));
