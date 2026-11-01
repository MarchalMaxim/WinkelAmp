/**
 * The note picker's logic (spec 2026-11-01-note-picker), pure: which notes the roll shows and how they are coloured, what
 * a pointer hits, what Suggest and Loudest choose, how the popup's chips lie, how marks and picks find their notes again,
 * and the draft show the preview plays. The roll, the popup and the overlay (picker*.ts) only draw and listen.
 */
import { TRACKS, TRACK_IDS } from '../pack/instruments';
import type { SongPack } from '../pack/pack';
import { matchMarks, type Mark } from '../show/melody';
import { picksId, picksListen, validateShow, type KnobSetting, type Layer, type Show } from '../show/show';
import { groupChords } from '../../widgets/chords';
import type { WaLayers } from '../../widgets/layers';
import type { Note } from '../../widgets/types';
import type { LabelNote } from './api';

/** i: the instrument's index; track: its TrackId or YourMT3 label, none for a solo roll. */
export interface RollNote { id: number; t: number; e: number; m: number; v: number; i: number; track?: string }
export interface Instrument { key: string; label: string; color: string }

/** Loudness for a label with no pack note near it; how near is near. */
const GUESS_VEL = 70, GUESS_WITHIN = 0.08;

const sortedRoll = (raw: Omit<RollNote, 'id'>[]): RollNote[] => raw.map((n, k) => [n, k] as const)
  .sort((a, b) => a[0].t - b[0].t || a[1] - b[1]).map(([n], id) => ({ ...n, id }));

/** The roll's notes, sorted by start, ids in that order: the pack's tracks; else labels when they have two or more kinds,
    each taking velocity from the nearest same-pitched pack note within 80 ms, else 70 (guessed true); else pack.notes
    as one instrument. */
export function pickerNotes(pack: Pick<SongPack, 'notes' | 'tracks'>, labels: readonly LabelNote[]):
  { notes: RollNote[]; instruments: Instrument[]; guessed: boolean } {
  const ids = TRACK_IDS.filter((id) => (pack.tracks?.[id]?.notes.length ?? 0) > 0);
  if (ids.length) {
    const raw = ids.flatMap((id, i) => pack.tracks![id]!.notes.map(([t, e, m, v]) => ({ t, e, m, v, i, track: id })));
    const instruments = ids.map((id, k) => { const label = pack.tracks![id]!.label || TRACKS[id].label; return { key: id, label, color: instrumentColor(label, k) }; });
    return { notes: sortedRoll(raw), instruments, guessed: false };
  }
  const kinds = [...new Set(labels.map((l) => l[4]))];
  if (kinds.length >= 2) {
    const byPitch = new Map<number, Note[]>();
    for (const n of pack.notes) { const l = byPitch.get(n[2]); if (l) l.push(n); else byPitch.set(n[2], [n]); }
    const raw = labels.map(([t, e, m, , label]) => {
      let v = GUESS_VEL, near = GUESS_WITHIN;
      for (const n of byPitch.get(m) ?? []) { const d = Math.abs(n[0] - t); if (d < near) { near = d; v = n[3]; } }
      return { t, e, m, v, i: kinds.indexOf(label), track: label };
    });
    return { notes: sortedRoll(raw), instruments: kinds.map((label, k) => ({ key: label, label, color: instrumentColor(label, k) })), guessed: true };
  }
  const solo = sortedRoll(pack.notes.map(([t, e, m, v]) => ({ t, e, m, v, i: 0 })));
  return { notes: solo, instruments: [{ key: 'all', label: 'All notes', color: instrumentColor('', 0) }], guessed: false };
}

const COLORS: Record<string, string> = {
  violin: '#4fc3f7', viola: '#b388ff', cello: '#3ddc97', string: '#9fb3c8', piano: '#ff7eb6', guitar: '#c6e45a', horn: '#ff8a50', trumpet: '#ff5d5d',
  oboe: '#f48fb1', clarinet: '#80deea', bassoon: '#bcaaa4', bass: '#1fa187', flute: '#e6ee9c', voice: '#eeeeee',
};
const SPARE = ['#ce93d8', '#90caf9', '#a5d6a7', '#ffab91', '#b0bec5', '#f8bbd0'];

/** The instrument's colour by a word in its name, else a spare by its index. */
export function instrumentColor(label: string, k: number): string {
  const name = label.toLowerCase();
  return Object.entries(COLORS).find(([w]) => name.includes(w))?.[1] ?? SPARE[k % SPARE.length];
}

/** Notes indexed by start: those sounding in [a, b) without looking at the rest. */
export class NoteIndex {
  private readonly notes: readonly RollNote[];
  /** The latest end among the notes up to each one: a walk back from b stops where nothing earlier reaches a. */
  private readonly reach: Float64Array;

  constructor(notes: readonly RollNote[]) {
    this.notes = notes;
    this.reach = new Float64Array(notes.length);
    let far = -Infinity;
    notes.forEach((n, k) => { far = Math.max(far, n.e); this.reach[k] = far; });
  }

  /** The first note starting at or after t. */
  firstFrom(t: number): number {
    let a = 0, b = this.notes.length;
    while (a < b) { const k = (a + b) >> 1; if (this.notes[k].t < t) a = k + 1; else b = k; }
    return a;
  }

  inView(a: number, b: number): RollNote[] {
    const out: RollNote[] = [];
    for (let k = this.firstFrom(b) - 1; k >= 0 && this.reach[k] > a; k--) if (this.notes[k].e > a) out.push(this.notes[k]);
    return out.reverse();
  }
}

export interface RollGeo { xOf(t: number): number; yOf(m: number): number; rowH: number; gutter: number; top: number }

/** How far a click may miss a note, in px. */
const REACH = 7;

/** The mockup's rule: nearest within 7 px, a tie going to the note attacked nearest the pointer. */
export function noteAt(candidates: readonly RollNote[], x: number, y: number, g: RollGeo): RollNote | null {
  if (x < g.gutter || y < g.top) return null;
  let best: RollNote | null = null, near = REACH;
  for (const n of candidates) {
    const x0 = g.xOf(n.t), x1 = Math.max(x0 + 3, g.xOf(n.e)), mid = g.yOf(n.m) + g.rowH / 2;
    const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0, d = Math.hypot(dx, Math.max(0, Math.abs(y - mid) - g.rowH / 2));
    // a long held note must not swallow the short ones on top of it
    if (d < near || (d === near && best && Math.abs(x - x0) < Math.abs(x - g.xOf(best.t)))) { best = n; near = d; }
  }
  return best;
}

/** The notes that start inside a box: by time, and by the row of their pitch. */
export function boxHits(candidates: readonly RollNote[], box: { x0: number; y0: number; x1: number; y1: number }, g: RollGeo): RollNote[] {
  const xa = Math.min(box.x0, box.x1), xb = Math.max(box.x0, box.x1), ya = Math.min(box.y0, box.y1), yb = Math.max(box.y0, box.y1);
  return candidates.filter((n) => { const x = g.xOf(n.t), y = g.yOf(n.m); return x >= xa && x <= xb && y + g.rowH >= ya && y <= yb; });
}

/** lineNotes(…, 'melody') on these, as the same objects. */
export function suggestLine(L: Pick<WaLayers, 'lineNotes'>, inView: readonly RollNote[]): RollNote[] {
  const back = new Map<Note, RollNote>(inView.map((n) => [[n.t, n.e, n.m, n.v] as Note, n]));
  return L.lineNotes([...back.keys()], 'melody').map((x) => back.get(x)!);
}

/** The k loudest, loudest first, the earlier of two alike first. */
export function loudest(notes: readonly RollNote[], k: number): RollNote[] {
  return [...notes].sort((a, b) => b.v - a.v || a.t - b.t).slice(0, Math.max(0, k));
}

export interface Chip { note: RollNote; x: number; y: number }

const CHIP_STEP = 24, PAUSE_ROOM = 18, PAUSE = 1, CHIP_TOP = 16, CHIP_RISE = 92;

/** Even spacing, height by pitch, 18 px more and a labelled gap at a pause over 1 s. */
export function chipLayout(notes: readonly RollNote[]): { chips: Chip[]; gaps: { x: number; t: number }[]; width: number } {
  const chips: Chip[] = [], gaps: { x: number; t: number }[] = [];
  const pitches = notes.map((n) => n.m), hi = Math.max(...pitches), lo = Math.min(...pitches);
  let x = 12, last = Infinity;
  for (const n of notes) {
    if (n.t - last > PAUSE) { x += PAUSE_ROOM; gaps.push({ x: x - 12, t: n.t }); }
    last = last === Infinity ? n.e : Math.max(last, n.e);
    chips.push({ note: n, x, y: CHIP_TOP + (hi === lo ? 40 : ((hi - n.m) / (hi - lo)) * CHIP_RISE) });
    x += CHIP_STEP;
  }
  return { chips, gaps, width: x + 12 };
}

/** The popup's count: its number, the words after it, and (when attacks differ from notes) what they make. */
export function countWords(picked: readonly RollNote[], total: number): { count: string; of: string; attacks: string } {
  const n = picked.length, attacks = groupChords(toPicks(picked)).length;
  return { count: String(n), of: `of ${total} melody note${total === 1 ? '' : 's'} picked`,
    attacks: attacks === n ? '' : `${attacks} impulse${attacks === 1 ? '' : 's'}: notes within 40 ms are one` };
}

/** Sorted by start. */
export const toPicks = (n: readonly RollNote[]): Note[] => [...n].sort((a, b) => a.t - b.t).map((x): Note => [x.t, x.e, x.m, x.v]);

export const noteMark = (n: RollNote): Mark => (n.track === undefined ? [n.t, n.e, n.m, n.v] : [n.t, n.e, n.m, n.v, n.track]);

/** A set's notes on the roll (matchMarks): those found, and the picks with no note there. */
export function picksOnRoll(picks: readonly Note[], notes: readonly RollNote[]): { found: RollNote[]; lost: Note[] } {
  const { matched, unmatched } = matchMarks(picks, notes.map(noteMark));
  return { found: [...matched.values()].map((j) => notes[j]), lost: unmatched.map((k) => picks[k]) };
}

/** A melody file's marks on the roll: the ids they find, and the marks with no note here, which stay. */
export function marksOnRoll(marks: readonly Mark[], notes: readonly RollNote[]): { marked: Set<number>; unmatched: Mark[] } {
  const { matched, unmatched } = matchMarks(marks, notes.map(noteMark));
  return { marked: new Set([...matched.values()].map((j) => notes[j].id)), unmatched: unmatched.map((k) => marks[k]) };
}

/** What the file holds: the marked notes and the marks that found none, never dropped. */
export function marksToSave(marked: ReadonlySet<number>, notes: readonly RollNote[], unmatched: readonly Mark[]): Mark[] {
  return [...notes.filter((n) => marked.has(n.id)).map(noteMark), ...unmatched];
}

/** The popup's chips: the melody in order, and when editing every pick of the set too, an unmarked note or a pick with no
    note on the roll (given an id below zero and no instrument), so an update never loses one. on: those of the set. */
export function popupChips(melody: readonly RollNote[], picks: readonly Note[] | null, notes: readonly RollNote[]): { chips: RollNote[]; on: Set<number> } {
  if (!picks) return { chips: [...melody], on: new Set() };
  const { found, lost } = picksOnRoll(picks, notes), ids = new Set(melody.map((n) => n.id));
  const gone = lost.map(([t, e, m, v], k): RollNote => ({ id: -1 - k, t, e, m, v, i: -1 }));
  const chips = [...melody, ...found.filter((n) => !ids.has(n.id)), ...gone].sort((a, b) => a.t - b.t || a.id - b.id);
  return { chips, on: new Set([...found, ...gone].map((n) => n.id)) };
}

export interface SetRow { id: string; widget: string | null; notes: readonly Note[]; neverHeard: number }

/** A row per set of the show: the widget of its first layer (null when no layer uses it) and how many of its picks lie
    outside every section using it, which validateShow warns of: a moved boundary can do that. */
export function setRows(show: Show): SetRow[] {
  const sets = show.picks ?? {}, ids = Object.keys(sets);
  if (!ids.length) return [];
  const { warnings } = validateShow(show), layers = show.sections.flatMap((s) => s.layers);
  return ids.map((id) => ({
    id, notes: sets[id].notes,
    widget: layers.find((l) => picksId(l.listen) === id)?.widget ?? null,
    neverHeard: warnings.filter((w) => w.path.startsWith(`picks.${id}.notes[`)).length,
  }));
}

/** Where a set's first layer is, in section order. */
export function firstLayerOf(show: Show, id: string): { section: number; layer: number } | null {
  for (let section = 0; section < show.sections.length; section++) {
    const layer = show.sections[section].layers.findIndex((l) => picksId(l.listen) === id);
    if (layer >= 0) return { section, layer };
  }
  return null;
}

/** The set's first layer: its knobs go to the preview, when the widget stays. */
export function firstLayer(show: Show, id: string): Layer | null {
  const at = firstLayerOf(show, id);
  return at && show.sections[at.section].layers[at.layer];
}

/** The preview's show: one section, one layer, of this widget only, the draft set when `notes` is given, else the plain
    widget on every note. Never validated, never in the store. */
export function draftShow(song: string, duration: number, widget: string, notes: readonly Note[] | null, knobs?: Record<string, KnobSetting>): Show {
  const layer: Layer = { widget, ...(notes ? { listen: picksListen('draft') } : {}), ...(knobs ? { knobs } : {}) };
  return { version: 2, id: 'draft', song, sections: [{ start: 0, end: duration, layers: [layer] }], ...(notes ? { picks: { draft: { notes: [...notes] } } } : {}) };
}

/** From a second before the first note to 1.5 s after the last has ended. */
export function previewSpan(notes: readonly { t: number; e: number }[]): { from: number; to: number } | null {
  if (!notes.length) return null;
  return { from: Math.max(0, notes[0].t - 1), to: Math.max(...notes.map((n) => n.e)) + 1.5 };
}

export interface View { a: number; b: number }

/** The view moved to start at `a`, kept inside the song. */
export function moveView(v: View, a: number, duration: number): View {
  const span = v.b - v.a, at = Math.max(0, Math.min(duration - span, a));
  return { a: at, b: at + span };
}

const MIN_SPAN = 3;

/** The view zoomed by f about a time, which stays where it is on the screen; 3 s to the whole song. */
export function zoomView(v: View, f: number, about: number, duration: number): View {
  const span = Math.max(MIN_SPAN, Math.min(duration, (v.b - v.a) * f)), k = (about - v.a) / (v.b - v.a), a = about - k * span;
  return moveView({ a, b: a + span }, a, duration);
}

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const pitchClass = (m: number): string => NAMES[m % 12];
export const nameOf = (m: number): string => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
export const clock = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const loudWord = (v: number): string => (v > 95 ? 'loud' : v > 60 ? 'medium' : 'soft');

/** Hovering a note: its instrument (an ensemble's), note, time and loudness. */
export const tipWords = (n: RollNote, instrument: string | null): string =>
  `${instrument ? `${instrument} · ` : ''}${nameOf(n.m)} · ${clock(n.t)} · ${loudWord(n.v)}`;

/** The layer controls' line and the set rows' name for a set. */
export function impulseWords(notes: readonly Note[]): string {
  const k = groupChords(notes).length, n = notes.length;
  return `${k} impulse${k === 1 ? '' : 's'} (${n} note${n === 1 ? '' : 's'} picked)`;
}
