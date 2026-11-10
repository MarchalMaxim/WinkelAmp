// Widget tags (plan 2026-10-31 §8): feel words, suited instruments and a stack role per widget, from lab/tags.json, in
// the vocabulary of lab/tag-words.json. Pure: the callers read the two files (sources.ts in the browser, readFileSync
// in Node).
import type { NoteType, Role, WidgetTags } from './types';

export interface TagWords {
  /** axis → word → what it looks and sounds like, and how well it fits loud/dense/low/fast/quiet music (0..1). */
  feel: Record<string, Record<string, { looks: string; sounds: string; fit: Record<string, number> }>>;
  /** word → label, family, the feel words it pairs with, and the tracks it listens to (TrackId | 'family:<f>' | 'all'). */
  instruments: Record<string, { label: string; family: string; pairs: string[]; tracks: string[]; sound?: string }>;
  /** another word → a feel word ("scary" → "dread"). */
  synonyms: Record<string, string>;
}

export const ROLES: readonly Role[] = ['under', 'ground', 'base', 'texture', 'lead', 'accent', 'top', 'standalone'];

/** The kinds of note a layer can listen to (spec 2026-11-01-note-types): those the measurements support. As in
    lab/layers/lines.js. 'long' on a piano means it rings long: the length is mostly the pedal. */
export const NOTE_TYPES: readonly NoteType[] = ['chords', 'runs', 'trills', 'long', 'repeats', 'rolls'];
export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  chords: 'Big chords', runs: 'Fast runs', trills: 'Trills', long: 'Long ringing notes', repeats: 'Repeated notes',
  rolls: 'Rolled chords',
};

/** Every feel word, in vocabulary order (axis by axis, as the file lists them). */
export function feelWords(words: TagWords): string[] {
  return Object.values(words.feel).flatMap((axis) => Object.keys(axis));
}

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Errors: an unknown feel or instrument word, a role not in Role, a note type not in NOTE_TYPES, a key with no widget, a
 * malformed entry, a synonym that names no feel word or shadows one. Warnings: a widget without tags (new lab widgets keep arriving), a word
 * listed twice in one entry.
 */
export function validateTags(tags: unknown, words: TagWords, widgetIds: readonly string[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  const feel = new Set(feelWords(words));
  for (const [syn, to] of Object.entries(words.synonyms)) {
    if (!feel.has(to)) errors.push(`synonym '${syn}' → '${to}': not a feel word`);
    if (feel.has(syn)) errors.push(`synonym '${syn}' is itself a feel word`);
  }
  if (!isObj(tags)) return { errors: [...errors, 'tags: not an object of widget id → tags'], warnings };
  const ids = new Set(widgetIds);
  for (const [id, t] of Object.entries(tags)) {
    if (!ids.has(id)) errors.push(`${id}: no widget lab/tools/${id}.js`);
    if (!isObj(t)) { errors.push(`${id}: not { feel, instruments, role }`); continue; }
    for (const [field, known] of [['feel', (w: string) => feel.has(w)], ['instruments', (w: string) => own(words.instruments, w)]] as const) {
      const list = t[field];
      if (!Array.isArray(list) || list.some((w) => typeof w !== 'string')) { errors.push(`${id}: ${field} is not a list of words`); continue; }
      for (const w of list as string[]) if (!known(w)) errors.push(`${id}: unknown ${field === 'feel' ? 'feel word' : 'instrument'} '${w}'`);
      const dup = (list as string[]).filter((w, i) => list.indexOf(w) !== i);
      if (dup.length) warnings.push(`${id}: ${field} lists ${[...new Set(dup)].map((w) => `'${w}'`).join(', ')} twice`);
    }
    if (!ROLES.includes(t.role as Role)) errors.push(`${id}: role '${String(t.role)}' is not one of ${ROLES.join(', ')}`);
    if (t.noteType !== undefined && !NOTE_TYPES.includes(t.noteType as NoteType)) errors.push(`${id}: noteType '${String(t.noteType)}' is not one of ${NOTE_TYPES.join(', ')}`);
  }
  for (const id of widgetIds) if (!own(tags, id)) warnings.push(`${id}: no tags in lab/tags.json`);
  return { errors, warnings };
}

/** The feel words a text names, directly or through a synonym: lower-cased, unique, in vocabulary order. */
export function feelWordsIn(text: string, words: TagWords): string[] {
  const found = new Set<string>();
  for (const w of text.toLowerCase().split(/[^\p{L}]+/u)) {
    if (!w) continue;
    const feel = own(words.synonyms, w) ? words.synonyms[w] : w;
    found.add(feel);
  }
  return feelWords(words).filter((w) => found.has(w));
}

/** What an instrument word listens to: TrackIds, 'family:<f>' or 'all' (none for an unknown word). */
export function tracksFor(instrument: string, words: TagWords): string[] {
  return own(words.instruments, instrument) ? [...words.instruments[instrument].tracks] : [];
}

/** One widget's entry of a validated lab/tags.json (null when it has none). */
export function tagsOf(tags: Record<string, WidgetTags> | null | undefined, id: string): WidgetTags | null {
  return tags && own(tags, id) ? tags[id] : null;
}
