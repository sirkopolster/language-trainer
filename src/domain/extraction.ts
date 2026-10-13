// Extraction contract (D-004): JSON schemas sent to the vision model and normalizers for its output.
// Pure: used by the Edge Function (Deno) and by vitest. No imports.

export const VOCAB_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    unit: { type: ['string', 'null'], description: 'Unit or chapter label printed on the page, e.g. "Unit 4" or "Lektion 3", null if none' },
    words: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          source: { type: 'string', description: 'word or phrase in the source (foreign) language exactly as printed' },
          target: { type: 'string', description: 'translation in the target language exactly as printed' },
          example: { type: ['string', 'null'], description: 'example sentence printed next to the word, null if none' },
          emphasis: { type: 'boolean', description: 'true if the word is visually emphasised: bold, boxed, highlighted, marked with a star or similar' },
        },
        required: ['source', 'target', 'example', 'emphasis'],
      },
    },
  },
  required: ['unit', 'words'],
} as const;

export const FORMAT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string', enum: ['translate', 'gap', 'choice', 'match', 'other'], description: 'translate = write the translation; gap = fill a gap in a sentence; choice = pick from options; match = connect pairs; other = anything else' },
          direction: { type: 'string', description: 'language direction as two ISO codes like "de-en" (given German, answer English); "en" if only one language is involved' },
          items: { type: 'integer', description: 'number of items in this section' },
          points: { type: 'integer', description: 'points for this section, same as items if not printed' },
          label: { type: ['string', 'null'], description: 'the task instruction as printed, shortened' },
        },
        required: ['type', 'direction', 'items', 'points', 'label'],
      },
    },
    total_points: { type: ['integer', 'null'] },
    pass_mark: { type: ['integer', 'null'], description: 'points needed to pass if a grading scale is printed, else null' },
  },
  required: ['sections', 'total_points', 'pass_mark'],
} as const;

export const vocabPrompt = (langFrom: string, langTo: string) =>
  `This is a photo of a vocabulary page from a school book. Source language: ${langTo}. Target language: ${langFrom}. ` +
  `Extract every word pair in reading order. Keep spelling exactly as printed, keep articles and phrase forms. ` +
  `Ignore page numbers, names, handwriting and grades. Set emphasis=true only for visually emphasised entries. Return JSON only.`;

export const formatPrompt = () =>
  `This is a photo of a vocabulary test or exercise sheet. Describe its structure: one entry per task section with type, language direction, number of items and points. ` +
  `Ignore the student's name, handwriting and the grade. Return JSON only.`;

export interface ExtractedWord { source: string; target: string; example: string | null; priority: boolean }
export interface ExtractedVocab { unit: string | null; words: ExtractedWord[] }
export interface ExtractedSection { type: 'translate' | 'gap' | 'choice' | 'match' | 'other'; direction: string; items: number; points: number; label?: string }
export interface ExtractedFormat { sections: ExtractedSection[]; totalPoints: number; passMark: number | null }

const str = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const int = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : fallback);

/** Drops empty/duplicate pairs, trims, normalises the unit label ("UNIT 4" → "Unit 4"). */
export function normalizeVocab(raw: unknown): ExtractedVocab {
  const r = (raw ?? {}) as { unit?: unknown; words?: unknown };
  const seen = new Set<string>();
  const words: ExtractedWord[] = [];
  for (const w of Array.isArray(r.words) ? r.words : []) {
    const x = (w ?? {}) as Record<string, unknown>;
    const source = str(x.source), target = str(x.target);
    if (!source || !target) continue;
    const key = `${source.toLowerCase()}|${target.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    words.push({ source, target, example: str(x.example) || null, priority: x.emphasis === true });
  }
  const unitRaw = str(r.unit);
  const m = unitRaw.match(/^(unit|lektion|lesson|kapitel|chapter|unité|unidad)\s*(\d+[a-z]?)$/i);
  const unit = m ? `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} ${m[2]}` : unitRaw || null;
  return { unit, words };
}

const TYPES = new Set(['translate', 'gap', 'choice', 'match', 'other']);

/** Keeps only sections with items > 0, derives total points when missing. */
export function normalizeFormat(raw: unknown): ExtractedFormat {
  const r = (raw ?? {}) as { sections?: unknown; total_points?: unknown; pass_mark?: unknown };
  const sections: ExtractedSection[] = [];
  for (const s of Array.isArray(r.sections) ? r.sections : []) {
    const x = (s ?? {}) as Record<string, unknown>;
    const items = int(x.items);
    if (items === 0) continue;
    const type = TYPES.has(String(x.type)) ? (String(x.type) as ExtractedSection['type']) : 'other';
    const label = str(x.label);
    sections.push({ type, direction: str(x.direction).toLowerCase() || 'de-en', items, points: int(x.points, items) || items, ...(label ? { label } : {}) });
  }
  const sum = sections.reduce((a, s) => a + s.points, 0);
  const totalPoints = int(r.total_points) || sum;
  const passMark = r.pass_mark === null || r.pass_mark === undefined ? null : int(r.pass_mark) || null;
  return { sections, totalPoints, passMark };
}
