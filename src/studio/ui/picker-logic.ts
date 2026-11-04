/**
 * The note picker's logic (spec 2026-11-01-note-picker), pure: which notes the roll shows and how they are coloured, what
 * a pointer hits, what Suggest and Loudest choose, how the popup's chips lie, how marks and picks find their notes again,
 * and the draft show the preview plays. The roll, the popup and the overlay (picker*.ts) only draw and listen.
 */
import { TRACKS, TRACK_IDS } from '../pack/instruments';
import type { SongPack } from '../pack/pack';
import { canonicalMelody, LEAVING_MAX, matchMarks, type Mark, type Melody } from '../show/melody';
import { heardPicks, INTENSITY, MAX_AMOUNT, valuesOf, withValues, type NoteValues, type PickNote } from '../show/note-values';
import { instanceKey, picksId, picksListen, validateShow, type Clip, type KnobSetting, type Layer, type Show } from '../show/show';
import { groupChords } from '../../widgets/chords';
import type { WaLayers } from '../../widgets/layers';
import type { Note, Param } from '../../widgets/types';
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

type Box = { x0: number; y0: number; x1: number; y1: number };
function inBox(t: number, m: number, box: Box, g: RollGeo): boolean {
  const x = g.xOf(t), y = g.yOf(m);
  return x >= Math.min(box.x0, box.x1) && x <= Math.max(box.x0, box.x1) && y + g.rowH >= Math.min(box.y0, box.y1) && y <= Math.max(box.y0, box.y1);
}

/** The notes that start inside a box: by time, and by the row of their pitch. */
export function boxHits(candidates: readonly RollNote[], box: Box, g: RollGeo): RollNote[] {
  return candidates.filter((n) => inBox(n.t, n.m, box, g));
}

/** The outlines of marks with no note here that a box crosses: an Alt-drag drops them on purpose. */
export function unmatchedInBox(marks: readonly Mark[], box: Box, g: RollGeo): Mark[] {
  return marks.filter((k) => inBox(k[0], k[2], box, g));
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

/** A note's chip: where it is, and how far its tail runs while it sounds (px). */
export interface Chip { note: RollNote; x: number; y: number; tail: number }

const CHIP_STEP = 24, CHIP_SIZE = 20, PAUSE = 1, CHIP_TOP = 16, CHIP_RISE = 92, SAME_ATTACK = 0.04;
/** A longer wait than this many px grows only slowly, or one long rest would push the rest of the melody far away. */
const LONG_WAIT = 220, LONG_TAIL = 400;

/**
 * The strip keeps time. The usual wait between attacks of this melody is one chip's width, so a fast run sits close and a
 * longer wait is a wider space; a chip's tail shows how long the note sounds, so a space with no tail in it is silence.
 * Notes of one attack (within 40 ms) stand over each other, if there is room. Height by pitch. A pause over 1 s gets a line
 * saying when it ends and how long it was.
 */
export function chipLayout(notes: readonly RollNote[]): { chips: Chip[]; gaps: { x: number; t: number; secs: number }[]; width: number } {
  const chips: Chip[] = [], gaps: { x: number; t: number; secs: number }[] = [];
  const pitches = notes.map((n) => n.m), hi = Math.max(...pitches), lo = Math.min(...pitches);
  const waits: number[] = [];
  for (let i = 1; i < notes.length; i++) { const w = notes[i].t - notes[i - 1].t; if (w > SAME_ATTACK) waits.push(w); }
  waits.sort((a, b) => a - b);
  const usual = waits.length ? waits[waits.length >> 1] : 0.5, pps = Math.max(30, Math.min(100, CHIP_STEP / usual));
  const room = (w: number) => { const px = w * pps; return px <= CHIP_STEP ? CHIP_STEP : px <= LONG_WAIT ? px : LONG_WAIT + 30 * Math.log2(px / LONG_WAIT); };
  let x = 12, last = Infinity, attack = -Infinity, column: number[] = [];
  for (const n of notes) {
    const y = CHIP_TOP + (hi === lo ? 40 : ((hi - n.m) / (hi - lo)) * CHIP_RISE);
    const stack = n.t - attack <= SAME_ATTACK && column.every((c) => Math.abs(c - y) >= CHIP_SIZE - 2);
    if (chips.length && !stack) {
      const was = x;
      x += room(n.t - attack);
      if (n.t - last > PAUSE) gaps.push({ x: Math.round((was + CHIP_SIZE + x) / 2), t: n.t, secs: n.t - last });
    }
    if (!stack) { attack = n.t; column = []; }
    column.push(y);
    last = last === Infinity ? n.e : Math.max(last, n.e);
    chips.push({ note: n, x, y, tail: Math.min(LONG_TAIL, Math.max(0, (n.e - n.t) * pps)) });
  }
  return { chips, gaps, width: x + CHIP_STEP + 12 };
}

/** Where the strip prints the time: under the first note of an attack, whenever the last label is at least `every` px back. */
export function chipRuler(chips: readonly Chip[], every = 56): { x: number; t: number }[] {
  const out: { x: number; t: number }[] = [];
  let attack = -Infinity;
  for (const c of chips) {
    if (c.note.t - attack <= SAME_ATTACK) continue;
    attack = c.note.t;
    if (!out.length || c.x - out[out.length - 1].x >= every) out.push({ x: c.x, t: c.note.t });
  }
  return out;
}

/** The chips a drag across the strip from a to b has passed (by their middles; content px). */
export function sweptChips(chips: readonly Chip[], a: number, b: number): RollNote[] {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return chips.filter((c) => c.x + CHIP_SIZE / 2 >= lo && c.x + CHIP_SIZE / 2 <= hi).map((c) => c.note);
}

/** The notes of the phrase a note is in: from the pause before it to the pause after it, as the strip draws them. */
export function phraseOf(notes: readonly RollNote[], id: number): RollNote[] {
  let phrase: RollNote[] = [], last = Infinity, found = false;
  for (const n of notes) {
    if (n.t - last > PAUSE) { if (found) return phrase; phrase = []; }
    phrase.push(n);
    if (n.id === id) found = true;
    last = last === Infinity ? n.e : Math.max(last, n.e);
  }
  return found ? phrase : [];
}

/** Every other attack of these notes, the first one kept: notes of one attack stay together. */
export function everyOther(notes: readonly RollNote[]): RollNote[] {
  const out: RollNote[] = [];
  let attack = -Infinity, keep = false;
  for (const n of notes) {
    if (n.t - attack > SAME_ATTACK) { attack = n.t; keep = !keep; }
    if (keep) out.push(n);
  }
  return out;
}

/** The popup's count: its number, the words after it, and (when attacks differ from notes) what they make. */
export function countWords(picked: readonly RollNote[], total: number): { count: string; of: string; attacks: string } {
  const n = picked.length, attacks = groupChords(heardPicks(toPicks(picked))).length;
  return { count: String(n), of: `of ${total} melody note${total === 1 ? '' : 's'} picked`,
    attacks: attacks === n ? '' : `${attacks} impulse${attacks === 1 ? '' : 's'}: notes within 40 ms are one` };
}

/** Sorted by start. */
export const toPicks = (n: readonly RollNote[], values?: ReadonlyMap<number, Readonly<NoteValues>>): PickNote[] => [...n].sort((a, b) => a.t - b.t).map((x): PickNote => withValues([x.t, x.e, x.m, x.v], values?.get(x.id)));

export const noteMark = (n: RollNote): Mark => (n.track === undefined ? [n.t, n.e, n.m, n.v] : [n.t, n.e, n.m, n.v, n.track]);

/** A set's notes on the roll (matchMarks): those found, and the picks with no note there. */
export function picksOnRoll(picks: readonly PickNote[], notes: readonly RollNote[]): { found: RollNote[]; lost: PickNote[]; values: Map<number, Readonly<NoteValues>> } {
  // Without the intensity: in a mark, the fifth place is a track.
  const { matched, unmatched } = matchMarks(picks.map(([s, e, m, v]): Mark => [s, e, m, v]), notes.map(noteMark)), values = new Map<number, Readonly<NoteValues>>();
  for (const [k, j] of matched) if (picks[k][4] !== undefined) values.set(notes[j].id, valuesOf(picks[k]));
  return { found: [...matched.values()].map((j) => notes[j]), lost: unmatched.map((k) => picks[k]), values };
}

/** A melody file's marks on the roll: the ids they find, and the marks with no note here, which stay. */
export function marksOnRoll(marks: readonly Mark[], notes: readonly RollNote[]): { marked: Set<number>; unmatched: Mark[] } {
  const { matched, unmatched } = matchMarks(marks, notes.map(noteMark));
  return { marked: new Set([...matched.values()].map((j) => notes[j].id)), unmatched: unmatched.map((k) => marks[k]) };
}

/** What the file holds: the earlier marks and the notes being picked now, each note once, and the marks that found none,
    never dropped. Unpicking a note only takes it out of `picked`, so an earlier mark stays. */
export function marksToSave(stored: ReadonlySet<number>, picked: ReadonlySet<number>, notes: readonly RollNote[], unmatched: readonly Mark[]): Mark[] {
  return [...notes.filter((n) => stored.has(n.id) || picked.has(n.id)).map(noteMark), ...unmatched];
}

/** The earlier marks Bring back offers: not being picked now, and not connected to a widget (not in any set of the show). */
export function earlierMarks(stored: ReadonlySet<number>, picked: ReadonlySet<number>, connected: { has(id: number): boolean }): number[] {
  return [...stored].filter((id) => !picked.has(id) && !connected.has(id));
}

/** The popup's chips: the notes being picked, in order, and when editing every pick of the set too, a note not being picked
    or a pick with no note on the roll (given an id below zero and no instrument), so an update never loses one. on: those
    of the set. */
export function popupChips(melody: readonly RollNote[], picks: readonly PickNote[] | null, notes: readonly RollNote[]): { chips: RollNote[]; on: Set<number>; values: Map<number, Readonly<NoteValues>> } {
  if (!picks) return { chips: [...melody], on: new Set(), values: new Map() };
  const { found, lost, values } = picksOnRoll(picks, notes), ids = new Set(melody.map((n) => n.id));
  lost.forEach((n, k) => { if (n[4] !== undefined) values.set(-1 - k, valuesOf(n)); });
  const gone = lost.map(([t, e, m, v], k): RollNote => ({ id: -1 - k, t, e, m, v, i: -1 }));
  const chips = [...melody, ...found.filter((n) => !ids.has(n.id)), ...gone].sort((a, b) => a.t - b.t || a.id - b.id);
  return { chips, on: new Set([...found, ...gone].map((n) => n.id)), values };
}

/** The notice for marks with no note here. */
export function unmatchedWords(k: number): string {
  return `${k} earlier mark${k === 1 ? ' has' : 's have'} no note here any more: drawn as an outline and kept in the file. To drop one, Alt-drag a small box around just that outline, touching no notes.`;
}

/** What an undo in the picker did, told once after a widget was placed or removed, which it does not undo. */
export function undoWords(changed: number): string {
  const what = changed ? `Undo here took back ${changed} change${changed === 1 ? '' : 's'} to your picked notes.` : 'Undo here is for your picked notes.';
  return `${what} To undo placing or removing a widget: Back to the studio, then Ctrl+Z.`;
}

/** The preview's instance, on either side of the compare. */
export const draftKey = (widget: string, mode: 'pick' | 'all'): string => instanceKey({ id: 'draft', widget, ...(mode === 'pick' ? { listen: picksListen('draft') } : {}) });

/** The recording under ♪: turned down so its tones are heard. The popup's preview plays no tones, so it hears it whole. */
export const recordingVolume = (hearing: number, popupOpen: boolean): number => (hearing && !popupOpen ? 0.3 : 1);

/**
 * The marks' saving, one write at a time and in order, so a slow save never lands over a later one, and what is still
 * unsaved when the page goes. A change waits for save(); leaving() writes at once, since nothing queued runs after that;
 * atRisk() is what leaving() can't cover, which is worth a warning.
 */
export class MarksSaver {
  saving: Promise<unknown> = Promise.resolve();
  private version = 0;
  private queued = 0;
  private savedAt = 0;
  private lastFailed = false;
  private blocked = false;

  constructor(private readonly d: {
    snapshot(): Melody; write(m: Melody, leaving: boolean): Promise<void>; saved(): void; failed(e: Error): void;
  }) {}

  private get unsaved(): boolean { return this.savedAt !== this.version; }

  changed(): void { this.version++; }
  /** Never written, and so a warning: a melody file that could not be read is not written over. */
  block(): void { this.blocked = true; }

  save(): void {
    if (this.blocked || this.queued === this.version) return;
    const v = (this.queued = this.version), m = this.d.snapshot();
    this.saving = this.saving.then(() => this.d.write(m, false)).then(() => this.wrote(v), (e: Error) => this.refused(v, e));
  }

  /** The page is going: pagehide can't wait for the queue, so this goes now, whatever a slower save is doing. */
  leaving(): void {
    if (this.blocked || !this.unsaved) return;
    const v = (this.queued = this.version);
    this.d.write(this.d.snapshot(), true).then(() => this.wrote(v), (e: Error) => this.refused(v, e));
  }

  atRisk(): boolean {
    if (!this.unsaved) return false;
    return this.blocked || this.lastFailed || canonicalMelody(this.d.snapshot()).length > LEAVING_MAX;
  }

  private wrote(v: number): void {
    this.savedAt = Math.max(this.savedAt, v);
    this.lastFailed = false;
    this.d.saved();
  }

  /** The next change, or closing, tries again. Overtaken by a later write that landed, it no longer matters. */
  private refused(v: number, e: Error): void {
    if (v <= this.savedAt) return;
    this.lastFailed = true;
    this.queued = this.savedAt;
    this.d.failed(e);
  }
}

export interface SetRow { id: string; widget: string | null; notes: readonly PickNote[]; neverHeard: number }

/** A row per set of the show: the widget of its first clip (null when no clip uses it) and how many of its picks lie
    outside every clip using it, which validateShow warns of: a moved clip can do that. */
export function setRows(show: Show): SetRow[] {
  const sets = show.picks ?? {}, ids = Object.keys(sets);
  if (!ids.length) return [];
  const { warnings } = validateShow(show);
  return ids.map((id) => ({
    id, notes: sets[id].notes,
    widget: firstClipOf(show, id)?.widget ?? null,
    neverHeard: warnings.filter((w) => w.path.startsWith(`picks.${id}.notes[`)).length,
  }));
}

/** The set's first clip in time: its knobs go to the preview, when the widget stays, and it is what the picker selects. */
export function firstClipOf(show: Show, id: string): Clip | null {
  return show.clips.filter((c) => picksId(c.listen) === id).sort((a, b) => a.start - b.start)[0] ?? null;
}

/** The preview's show: one clip, of this widget only, over the whole song, the draft set when `notes` is given, else the
    plain widget on every note. It has no fade: the preview is that one widget, at full strength. Never validated, never in
    the store. */
export function draftShow(song: string, duration: number, widget: string, notes: readonly PickNote[] | null, knobs?: Record<string, KnobSetting>): Show {
  const layer: Layer = { widget, ...(notes ? { listen: picksListen('draft') } : {}), ...(knobs ? { knobs } : {}) };
  return { version: 3, id: 'draft', song, clips: [{ id: 'draft', start: 0, end: duration, track: 0, fade: 0, ...layer }], ...(notes ? { picks: { draft: { notes: [...notes] } } } : {}) };
}

/** The intensity bars under the chips, their room shared between the notes of one attack, which stand at the same x. */
export function amountBars(chips: readonly Chip[], room = 16): { id: number; x: number; w: number }[] {
  const atX = new Map<number, number>();
  for (const c of chips) atX.set(c.x, (atX.get(c.x) ?? 0) + 1);
  const seen = new Map<number, number>();
  return chips.map((c) => {
    const k = seen.get(c.x) ?? 0, w = room / atX.get(c.x)!;
    seen.set(c.x, k + 1);
    return { id: c.note.id, x: c.x + 2 + k * w, w };
  });
}

/** What the lane's bars set. base: the value no bar has, which a line marks: as played, or the clip's own knob. */
export interface LaneScale { key: string; label: string; hint: string; min: number; max: number; step: number; base: number }
export const INTENSITY_LANE: LaneScale = { key: INTENSITY, label: 'Intensity', hint: 'How loud the note counts, for widgets that follow loudness, and Ivory.', min: 0, max: MAX_AMOUNT, step: 0.05, base: 1 };

/** The lane on one of a widget's knobs: the clip's own value is its base. */
export function knobLane(q: Pick<Param, 'key' | 'label' | 'hint' | 'min' | 'max' | 'step' | 'value'>, own?: KnobSetting): LaneScale {
  const base = typeof own === 'number' ? own : own?.base ?? q.value;
  return { key: q.key, label: q.label ?? q.key, hint: q.hint ?? '', min: q.min, max: q.max, step: q.step || (q.max - q.min) / 100, base };
}

/** A height in the lane as a value: the bottom is min, the top max, on the knob's step, and caught at the base; on a knob
    of few steps only as near as the next step, so that one can be had. */
export function laneValue(fromTop: number, height: number, s: LaneScale): number {
  const u = 1 - Math.max(0, Math.min(1, fromTop / height)), v = s.min + u * (s.max - s.min);
  const range = s.max - s.min;
  if (Math.abs(v - s.base) <= (s.step >= range / 50 ? s.step / 2 : range * 0.03)) return s.base;
  return Number(Math.max(s.min, Math.min(s.max, s.min + Math.round((v - s.min) / s.step) * s.step)).toFixed(4));
}

/** A value as a share of the lane's height. */
export const laneShare = (v: number, s: LaneScale): number => (s.max > s.min ? Math.max(0, Math.min(1, (v - s.min) / (s.max - s.min))) : 0);

/** A bar's words. For an intensity, how loud the note then plays, which stops at 127 however high the bar. */
export function barWords(n: { m: number; t: number; v: number }, value: number, s: LaneScale): string {
  const at = `${nameOf(n.m)} at ${fineClock(n.t)}`;
  if (s.key === INTENSITY) return `${at}: intensity ×${value.toFixed(2)}, played as ${Math.min(127, Math.round(n.v * value))} of 127`;
  return `${at}: ${s.label} ${Number(value.toFixed(3))}${value === s.base ? ' (the clip\'s own)' : ` until the next picked note (the clip\'s own is ${Number(s.base.toFixed(3))})`}`;
}

/** The chips that share an attack with each chip, by the runtime's 40 ms from its first note: one knob value can hold
    per attack, so a bar on a knob moves them together. */
export function attackMates(notes: readonly { id: number; t: number }[]): Map<number, number[]> {
  const out = new Map<number, number[]>();
  let first = -Infinity, group: number[] = [];
  for (const n of [...notes].sort((a, b) => a.t - b.t)) {
    if (n.t - first >= SAME_ATTACK) { first = n.t; group = []; }
    group.push(n.id);
    out.set(n.id, group);
  }
  return out;
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
/** To the tenth of a second: a fast sweep has many notes in one second. */
export const fineClock = (s: number): string => {
  const tenths = Math.round(s * 10);
  return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, '0')}`;
};
/** When the picked notes start and end, in the song. */
export function pickedSpan(notes: readonly RollNote[]): string {
  if (!notes.length) return '';
  const ts = notes.map((n) => n.t), lo = Math.min(...ts), hi = Math.max(...ts);
  return hi - lo < 0.05 ? `at ${fineClock(lo)}` : `${fineClock(lo)} to ${fineClock(hi)}`;
}
const loudWord = (v: number): string => (v > 95 ? 'loud' : v > 60 ? 'medium' : 'soft');

/** Hovering a note: its instrument (an ensemble's), note, time and loudness. */
export const tipWords = (n: RollNote, instrument: string | null): string =>
  `${instrument ? `${instrument} · ` : ''}${nameOf(n.m)} · ${clock(n.t)} · ${loudWord(n.v)}`;

/** The layer controls' line and the set rows' name for a set. */
export function impulseWords(notes: readonly PickNote[]): string {
  const k = groupChords(heardPicks(notes)).length, n = notes.length;
  return `${k} impulse${k === 1 ? '' : 's'} (${n} note${n === 1 ? '' : 's'} picked)`;
}
