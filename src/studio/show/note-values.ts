/**
 * What a link from a picked note to its widget can carry: values set by hand in the picker. `intensity` makes the note
 * louder or softer, for every widget that follows loudness. Any other key is one of the widget's knobs, like a sequencer's
 * parameter lock: from that note's attack until the next attack of the set, the clip plays with that value; an attack
 * without it returns the knob to the clip's own. A function of the time, so seeks and renders need nothing else, and the
 * widgets know nothing of it. A knob read at the attack marks that note; one read every frame changes the whole picture
 * until the next attack, which is always a real one, so it is no fake attack.
 */
import { groupChords } from '../../widgets/chords';
import type { Note, Param } from '../../widgets/types';

export type NoteValues = Record<string, number>;
/** A note of a set. The fifth place: a number when it holds only an intensity, an object once it holds a knob too. */
export type PickNote = [start: number, end: number, midi: number, vel: number, values?: number | NoteValues];

export const INTENSITY = 'intensity';
/** A note's intensity is a factor on its velocity, 0..MAX_AMOUNT, and 1 is no value at all. */
export const MAX_AMOUNT = 2;

type PerNoteParam = Pick<Param, 'key' | 'perNote'>;

/** Whether a note can set this knob of a widget (its params, if known): not `presence`, which draws nothing itself or is
    what a clip's curve moves (intensity is the per-note word for it), and not a knob that says `perNote: false`. */
export const perNote = (params: readonly PerNoteParam[] | undefined, key: string): boolean =>
  key !== 'presence' && key !== INTENSITY && params?.find((q) => q.key === key)?.perNote !== false;

/** The knobs a note can set on a widget with these params. */
export const noteKnobs = <P extends PerNoteParam>(params: readonly P[]): P[] => params.filter((q) => perNote([q], q.key));

/** A note's values, read only. */
export const valuesOf = (n: PickNote): Readonly<NoteValues> => (typeof n[4] === 'number' ? { [INTENSITY]: n[4] } : n[4] ?? {});

const r4 = (v: number) => Math.round(v * 1e4) / 1e4 || 0;

/** The note with these values in their one stored form, so equal values are equal text: keys sorted, rounded, intensity 1
    and an empty object not written, and a lone intensity a plain number, as old shows have it. */
export function withValues(n: PickNote, values?: Readonly<NoteValues>): PickNote {
  const [s, e, m, v] = n, out: NoteValues = {};
  for (const key of Object.keys(values ?? {}).sort()) {
    const x = values![key];
    if (key !== INTENSITY) out[key] = r4(x);
    else if (x !== 1) out[key] = r4(Math.max(0, Math.min(MAX_AMOUNT, x)));
  }
  const keys = Object.keys(out);
  if (!keys.length) return [s, e, m, v];
  return [s, e, m, v, keys.length === 1 && keys[0] === INTENSITY ? out[INTENSITY] : out];
}

/** What is wrong with a value of a note, or null. Ranges of knobs are the widget's: the runtime holds a value inside them. */
export function badValue(key: string, x: unknown): string | null {
  if (!/^\w+$/.test(key)) return `${JSON.stringify(key)} is not a knob`;
  if (typeof x !== 'number' || !Number.isFinite(x)) return `${key} is not a number`;
  if (key === INTENSITY && (x < 0 || x > MAX_AMOUNT)) return `intensity ${x} is outside 0..${MAX_AMOUNT}`;
  return null;
}

const heardCache = new WeakMap<readonly PickNote[], Note[]>();
/** The set as its widgets hear it: a note with an intensity as loud as that makes it, the factor on it for a widget that
    wants it itself, and no knob values, so setting one doesn't start the widget again. The same array for the same set,
    as new notes make the runtime evaluate a widget again. */
export function heardPicks(notes: readonly PickNote[]): Note[] {
  if (notes.every((n) => n[4] === undefined)) return notes as Note[];
  let heard = heardCache.get(notes);
  if (!heard) {
    heard = notes.map((n): Note => {
      const [s, e, m, v] = n, a = valuesOf(n)[INTENSITY];
      return a === undefined ? [s, e, m, v] : [s, e, m, Math.min(127, Math.round(v * a)), a];
    });
    heardCache.set(notes, heard);
  }
  return heard;
}

/** All of a show's sets as they are heard, for what reads them outside the Conductor: curves and ticks. */
export const heardSets = (picks: Record<string, { notes: PickNote[] }> | undefined): Record<string, { notes: Note[] }> | undefined =>
  picks && Object.fromEntries(Object.entries(picks).map(([id, set]) => [id, { notes: heardPicks(set.notes) }]));

/** Each attack of a set (the runtime's own grouping, so a value lands in the step its attack fires) with its knob values;
    the later note wins within one. null: no note holds a knob. */
type Attacks = { t: number; values: NoteValues }[] | null;
const attackSets = new WeakMap<readonly PickNote[], Attacks>();
function attacksOf(notes: readonly PickNote[]): Attacks {
  let table = attackSets.get(notes);
  if (table === undefined) {
    let at = 0, any = false;
    const rows = groupChords(heardPicks(notes)).map((c) => {
      const values: NoteValues = {};
      for (const n of notes.slice(at, (at += c.notes.length))) {
        for (const [key, x] of Object.entries(valuesOf(n))) if (key !== INTENSITY) { values[key] = x; any = true; }
      }
      return { t: c.t, values };
    });
    table = any ? rows : null;
    attackSets.set(notes, table);
  }
  return table;
}

/** The knob values a clip holds at t: those of the last attack at or before t, if the clip has begun by then. */
export function heldValues(notes: readonly PickNote[], from: number, t: number): Readonly<NoteValues> | null {
  const table = attacksOf(notes);
  if (!table) return null;
  let a = 0, b = table.length;
  while (a < b) { const k = (a + b) >> 1; if (table[k].t <= t) a = k + 1; else b = k; }
  return a > 0 && table[a - 1].t >= from ? table[a - 1].values : null;
}
