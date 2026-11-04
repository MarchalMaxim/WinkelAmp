/**
 * A show: widgets placed on a song's timeline, as in DJ software. Each clip has a start, an end and a track, and its own
 * knobs, part to listen to, region, intensity curve and fade. A clip belongs to nothing but the timeline: clips overlap
 * freely across tracks, the same widget can overlap itself (two independent instances), and a stretch with nothing placed
 * is just empty. Track order is draw order, 0 at the bottom. One track holds no overlaps: a clip that lands on an occupied
 * spot goes to the nearest free track at or above it (freeTrack).
 * shows/<id>.json holds canonicalShow(show). validateShow says what is wrong (errors) or odd (warnings), each with a path
 * like 'clips[2].knobs.size'; repairShow fixes what can be fixed without asking.
 * Picks (spec 2026-11-01-note-picker): show.picks holds sets of hand-picked notes, the notes themselves, and a clip with
 * listen 'picks:<id>' answers those notes only. A picks listen never turns into one that hears every note.
 */
import { isSlug } from '../pack/pack';
import { NOTE_TYPES, NOTE_TYPE_LABELS } from '../../widgets/tags';
import type { NoteType } from '../../widgets/types';
import { TRACKS, isTrackId } from '../pack/instruments';
import type { Drive, Family, KnobState, Line, Listen, Note, Pivot, Region, Shape, WidgetMeta } from '../../widgets/types';

export const SHOW_VERSION = 3, DEFAULT_FADE = 1, MAX_LAYERS = 6, MIN_CLIP = 0.25, MAX_FADE = 10;
/** Pivots per clip (WaLayers.MAX_PIVOTS). */
export const MAX_PIVOTS = 256;
/** Seconds a clip may run past the song's end without a word. */
export const END_SLACK = 0.5;

/** number = base; the object is the lab's PST entry ("Copy settings" pastes in). */
export type KnobSetting = number | Partial<KnobState>;
/** What a clip plays. listen absent or 'all': all notes. intensity: pivots in song seconds inside the clip, sorted by t.
    intensityMoves 'present': the curve moves how present instead of fading the clip and thinning its attacks. */
export interface Layer { widget: string; listen?: Listen; knobs?: Record<string, KnobSetting>; region?: Region; intensity?: Pivot[]; intensityMoves?: 'present' }
/** Whether a curve can move how present: the widget has the slider. Without it, the curve fades. */
export const hasHowPresent = (params: readonly { key: string }[]): boolean => params.some((q) => q.key === 'presence');
/** A widget placed on the timeline. id: stable, unique in the show. track: 0 is drawn first (the bottom). fade: seconds it
    fades in at its start and out at its end, default DEFAULT_FADE, 0 a hard cut, at most half its length. */
export interface Clip extends Layer { id: string; start: number; end: number; track: number; fade?: number }
/** Notes in full, sorted by start: a new transcription doesn't move them. */
export interface PickSet { notes: Note[] }
export interface Show {
  version: typeof SHOW_VERSION; id: string; song: string; title?: string;
  composer?: { by: 'auto' | 'claude' | 'user'; at: string };
  clips: Clip[];
  picks?: Record<string, PickSet>;
}
export interface Issue { path: string; message: string }
/** tracks: the song's instrument tracks (pack v2); undefined: no track warnings. */
export interface ShowContext { duration?: number; widgets?: ReadonlyMap<string, WidgetMeta>; tracks?: readonly string[];
  /** Attack times per note type in this song (WaLayers.noteTypeAttacks); undefined: no such warnings. */
  noteTypes?: Partial<Record<NoteType, readonly number[]>> }

export const DRIVES: readonly Drive[] = ['', '+level', '-level', '+rate', '-rate', '+pitch', '-pitch', '+bass', '-bass', '+density', '-density'];
const COMPOSERS = ['auto', 'claude', 'user'];
const KEYS = {
  show: ['version', 'id', 'song', 'title', 'composer', 'clips', 'picks'],
  composer: ['by', 'at'],
  clip: ['id', 'start', 'end', 'track', 'fade', 'widget', 'listen', 'knobs', 'region', 'intensity', 'intensityMoves'],
  knob: ['base', 'drive', 'depth'],
  region: ['mode', 'shape', 'x', 'y', 'w', 'h', 'rot', 'feather', 'blend', 'fit'],
  pivot: ['t', 'v', 'shape', 'bend'],
  pickSet: ['notes'],
} as const;

export const LINES: readonly Line[] = ['melody', 'bassline', 'inner', 'low', 'high', 'accents'];
export const FAMILIES: readonly Family[] = ['keys', 'plucked', 'strings', 'winds', 'brass', 'percussion', 'voice'];
const MODES = ['spot', 'window'], REGION_SHAPES = ['rect', 'ellipse'], BLENDS = ['clear', 'over', 'lighten'], FITS = ['cover', 'contain', 'stretch'];
const SHAPES: readonly Shape[] = ['linear', 'ease', 'hold'];
/** Region size (fraction of the canvas) and centre limits. */
export const REGION_SIZE = [0.02, 2] as const, REGION_CENTRE = [-0.5, 1.5] as const;

const PICKS = 'picks:';
export const picksListen = (id: string): Listen => `${PICKS}${id}`;
/** 'picks:p1' → 'p1'; anything else → null. */
export function picksId(listen: unknown): string | null {
  return typeof listen === 'string' && listen.startsWith(PICKS) && isSlug(listen.slice(PICKS.length)) ? listen.slice(PICKS.length) : null;
}

/** 'all' | a TrackId | family:<Family> | a Line | a NoteType | picks:<slug> (only validateShow can see whether the set exists). */
export function isListen(x: unknown): x is Listen {
  if ((NOTE_TYPES as readonly unknown[]).includes(x)) return true;
  if (typeof x !== 'string') return false;
  if (x === 'all' || isTrackId(x) || (LINES as readonly string[]).includes(x) || picksId(x) !== null) return true;
  return x.startsWith('family:') && (FAMILIES as readonly string[]).includes(x.slice(7));
}
/** The part a layer listens to, or undefined for all notes ('all' is the same as absent). */
export const listenOf = (l: Pick<Layer, 'listen'>): Listen | undefined => (l.listen === undefined || l.listen === 'all' ? undefined : l.listen);
/** A clip's instance in the runtime: its own state, however many other clips play the same widget. widget#id, or
    widget@listen#id when it listens to a part, so a change of part is a new instance (a loaded one is never re-routed). */
export function instanceKey(c: Pick<Clip, 'id' | 'widget' | 'listen'>): string {
  const p = listenOf(c);
  return `${p === undefined ? c.widget : `${c.widget}@${p}`}#${c.id}`;
}
/** The widget an instance key plays. */
export const widgetOfKey = (key: string): string => key.split(/[@#]/)[0];

/** A stretch of song, in seconds. */
export interface Span { start: number; end: number }
const EDGE = 5e-4;   // half a millisecond: times are stored to the ms, so clips that touch never count as overlapping
/** Whether two spans share more than a touch. */
export const overlaps = (a: Span, b: Span): boolean => a.start < b.end - EDGE && b.start < a.end - EDGE;
/** The nearest track at or above `wanted` free over this span: a track that does not exist yet is free. */
export function freeTrack(clips: readonly Clip[], span: Span, wanted: number, except?: string): number {
  let t = Math.max(0, Math.round(wanted));
  while (clips.some((c) => c.id !== except && c.track === t && overlaps(c, span))) t++;
  return t;
}
/** The lowest track above every clip overlapping this span: a new clip there draws on top of what plays with it. */
export const topTrack = (clips: readonly Clip[], span: Span): number =>
  clips.reduce((top, c) => (overlaps(c, span) ? Math.max(top, c.track + 1) : top), 0);
/** The next clip id: one past the highest, so a delete never hands its id to another clip. */
export function nextClipId(clips: readonly Pick<Clip, 'id'>[]): string {
  let n = 0;
  for (const c of clips) { const m = /^c(\d+)$/.exec(String(c.id)); if (m) n = Math.max(n, Number(m[1])); }
  return `c${n + 1}`;
}
/** Clips in the order a show is saved and loaded: by start, then track, then id. */
export function sortedClips(clips: readonly Clip[]): Clip[] {
  return [...clips].sort((a, b) => a.start - b.start || a.track - b.track || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
/** A time as people read it: ms precision, no trailing zeros. */
export const fmt = (t: number): string => `${Math.round(t * 1000) / 1000}`;
const ms = (t: number): number => Math.round(t * 1000) / 1000 || 0;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export function validateShow(x: unknown, c: ShowContext = {}): { errors: Issue[]; warnings: Issue[] } {
  const errors: Issue[] = [], warnings: Issue[] = [];
  const err = (path: string, message: string) => errors.push({ path, message });
  const warn = (path: string, message: string) => warnings.push({ path, message });
  const typos = (o: Record<string, unknown>, known: readonly string[], at: string) => {
    for (const k of Object.keys(o)) if (!known.includes(k)) warn(at ? `${at}.${k}` : k, `unknown property '${k}' (ignored; known: ${known.join(', ')})`);
  };

  if (!isObj(x)) { err('', 'a show is a JSON object { version, id, song, clips }'); return { errors, warnings }; }
  typos(x, KEYS.show, '');
  if (x.version !== SHOW_VERSION) err('version', `version ${JSON.stringify(x.version)}: this studio reads version ${SHOW_VERSION}, a list of clips (older shows are not read)`);
  if (!isSlug(x.id)) err('id', `${JSON.stringify(x.id)} is not a slug (lowercase letters, digits, single dashes)`);
  if (!isSlug(x.song)) err('song', `${JSON.stringify(x.song)} is not a song id (a slug: the folder songs/<id>/)`);
  if (x.title !== undefined && typeof x.title !== 'string') err('title', 'not a string');
  if (x.composer !== undefined) {
    if (!isObj(x.composer) || !COMPOSERS.includes(x.composer.by as string) || typeof x.composer.at !== 'string') {
      err('composer', `not { by: ${COMPOSERS.join(' | ')}, at: '<time>' }`);
    } else typos(x.composer, KEYS.composer, 'composer');
  }

  const sets: ReadonlySet<string> = new Set(isObj(x.picks) ? Object.keys(x.picks) : []);
  const clips = x.clips;
  if (!Array.isArray(clips)) { err('clips', 'a show holds a list of clips [{ id, start, end, track, widget }]'); return { errors, warnings }; }
  const ids = new Set<string>(), placed: { start: number; end: number; track: number; i: number }[] = [];
  clips.forEach((o: unknown, i) => {
    const at = `clips[${i}]`;
    if (!isObj(o)) { err(at, 'not a clip { id, start, end, track, widget }'); return; }
    typos(o, KEYS.clip, at);
    if (!isSlug(o.id)) err(`${at}.id`, `${JSON.stringify(o.id)} is not a slug`);
    else if (ids.has(o.id)) err(`${at}.id`, `'${o.id}' is the id of an earlier clip: a clip's id is its own`);
    else ids.add(o.id);
    const timesOk = isNum(o.start) && isNum(o.end);
    if (!isNum(o.start)) err(`${at}.start`, 'not a number of seconds');
    if (!isNum(o.end)) err(`${at}.end`, 'not a number of seconds');
    const start = o.start as number, end = o.end as number;
    if (timesOk) {
      if (start < 0) err(`${at}.start`, `starts at ${fmt(start)} s, before the song`);
      if (start >= end) err(`${at}.end`, `ends at ${fmt(end)} s, not after its start ${fmt(start)} s`);
      else if (end - start < MIN_CLIP) warn(at, `lasts ${fmt(end - start)} s: under ${MIN_CLIP} s is hard to see`);
      if (isNum(c.duration) && end > c.duration + END_SLACK) warn(`${at}.end`, `ends at ${fmt(end)} s but the song lasts ${fmt(c.duration)} s`);
    }
    const trackOk = Number.isInteger(o.track) && (o.track as number) >= 0;
    if (!trackOk) err(`${at}.track`, `${JSON.stringify(o.track)} is not a track (a whole number, 0 at the bottom)`);
    if (timesOk && start < end && trackOk) {
      const other = placed.find((p) => p.track === o.track && overlaps(p, { start, end }));
      if (other) err(`${at}.track`, `overlaps clips[${other.i}] on track ${String(o.track)} (${fmt(other.start)}..${fmt(other.end)} s): one track holds no overlaps`);
      placed.push({ start, end, track: o.track as number, i });
    }
    if (o.fade !== undefined) {
      if (!isNum(o.fade)) err(`${at}.fade`, 'not a number of seconds');
      else if (o.fade < 0 || o.fade > MAX_FADE) warn(`${at}.fade`, `fade ${fmt(o.fade)} s: expected 0 (a cut) to ${MAX_FADE} s`);
    }
    validateLayer(o, at, timesOk ? { start, end } : null, c, sets, err, warn, typos);
  });
  const most = mostAtOnce(placed);
  if (most > MAX_LAYERS) warn('clips', `${most} clips play at once: more than ${MAX_LAYERS} gets muddy and slow`);
  if (x.picks !== undefined) validatePicks(x.picks, clips, err, warn, typos);
  return { errors, warnings };
}

/** The most spans that are open at one time. */
function mostAtOnce(spans: readonly Span[]): number {
  const ev = spans.flatMap((s) => [[s.start, 1], [s.end, -1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let n = 0, most = 0;
  for (const [, d] of ev) { n += d; most = Math.max(most, n); }
  return most;
}

type Report = (p: string, m: string) => void;
type Typos = (o: Record<string, unknown>, known: readonly string[], at: string) => void;

/** Why a listen is not heard as written, or null: a track or family this song does not have (c.tracks given). */
function missingPart(listen: string, c: ShowContext): string | null {
  if ((NOTE_TYPES as readonly string[]).includes(listen)) {
    const t = listen as NoteType;
    return c.noteTypes?.[t]?.length === 0 ? `this song has no ${NOTE_TYPE_LABELS[t].toLowerCase()}: this clip stays still` : null;
  }
  if (!c.tracks) return null;
  if (isTrackId(listen) && !c.tracks.includes(listen)) return `this song has no ${listen}: it plays on all notes`;
  if (listen.startsWith('family:')) {
    const f = listen.slice(7);
    if (!c.tracks.some((t) => isTrackId(t) && TRACKS[t].family === f)) return `this song has no ${f} track: it plays on all notes`;
  }
  return null;
}

function validateLayer(l: Record<string, unknown>, at: string, span: Span | null, c: ShowContext, sets: ReadonlySet<string>,
  err: Report, warn: Report, typos: Typos): void {
  if (typeof l.widget !== 'string') { err(`${at}.widget`, 'not a widget id'); return; }
  const meta = c.widgets?.get(l.widget);
  if (c.widgets && !meta) err(`${at}.widget`, `unknown widget '${l.widget}' (no lab/tools/${l.widget}.js)`);
  const listenOk = l.listen === undefined || isListen(l.listen);
  if (!listenOk) {
    err(`${at}.listen`, `${JSON.stringify(l.listen)} is not a part: 'all', a track (${Object.keys(TRACKS).join(', ')}), family:<${FAMILIES.join('|')}>, a line (${LINES.join(', ')}), a kind of note (${NOTE_TYPES.join(', ')}) or picks:<id>`);
  } else if (picksId(l.listen) !== null) {
    if (!sets.has(picksId(l.listen)!)) err(`${at}.listen`, `${JSON.stringify(l.listen)} has no set in show.picks: it would hear nothing`);
  } else if (typeof l.listen === 'string') {
    const why = missingPart(l.listen, c);
    if (why) warn(`${at}.listen`, why);
  }
  const type = (NOTE_TYPES as readonly unknown[]).includes(l.listen) ? (l.listen as NoteType) : null, times = type && c.noteTypes?.[type];
  if (type && span && times?.length && !times.some((t) => t >= span.start && t < span.end)) {
    warn(`${at}.listen`, `this clip has no ${NOTE_TYPE_LABELS[type].toLowerCase()}: it stays still`);
  }
  if (l.region !== undefined) validateRegion(l.region, `${at}.region`, err, warn, typos);
  if (l.intensity !== undefined) validateIntensity(l.intensity, `${at}.intensity`, span, err, warn, typos);
  if (l.intensityMoves !== undefined) {
    if (l.intensityMoves !== 'present') err(`${at}.intensityMoves`, "not 'present'");
    else if (meta && !hasHowPresent(meta.params)) warn(`${at}.intensityMoves`, `'${l.widget}' has no how present slider: its curve fades it`);
  }
  if (l.knobs === undefined) return;
  if (!isObj(l.knobs)) { err(`${at}.knobs`, 'not an object { key: value }'); return; }
  for (const [key, v] of Object.entries(l.knobs)) {
    const kp = `${at}.knobs.${key}`, q = meta?.params.find((p) => p.key === key);
    if (meta && !q) warn(kp, `'${l.widget}' has no knob '${key}' (its knobs: ${meta.params.map((p) => p.key).join(', ') || 'none'})`);
    const range = (b: number, p: string) => { if (q && (b < q.min || b > q.max)) warn(p, `${b} is outside ${key}'s range ${q.min}..${q.max} (it will be clamped)`); };
    if (isNum(v)) { range(v, kp); continue; }
    if (!isObj(v)) { err(kp, 'not a number (the base) or { base, drive, depth }'); continue; }
    typos(v, KEYS.knob, kp);
    if (v.base !== undefined) { if (!isNum(v.base)) err(`${kp}.base`, 'not a number'); else range(v.base, `${kp}.base`); }
    if (v.drive !== undefined && !DRIVES.includes(v.drive as Drive)) err(`${kp}.drive`, `${JSON.stringify(v.drive)} is not a drive (one of ${DRIVES.map((d) => `'${d}'`).join(', ')})`);
    if (v.depth !== undefined && !(isNum(v.depth) && v.depth >= 0 && v.depth <= 1)) err(`${kp}.depth`, `${JSON.stringify(v.depth)} is not a depth from 0 to 1`);
  }
}

/** A picked note's intensity, set by hand: a factor on its velocity, 0..MAX_AMOUNT, and 1 is no value at all. */
export const MAX_AMOUNT = 2;
/** The note with this intensity: none stored for 1, so a set nobody touched stays as it was. */
export function withAmount(n: Note, amount: number | undefined): Note {
  const [s, e, m, v] = n;
  return amount === undefined || amount === 1 ? [s, e, m, v] : [s, e, m, v, Math.round(Math.max(0, Math.min(MAX_AMOUNT, amount)) * 1e4) / 1e4];
}

/** What is wrong with a note of a set, or null. */
function badNote(n: unknown): string | null {
  if (!Array.isArray(n) || (n.length !== 4 && n.length !== 5) || !n.every(isNum)) return 'not [start, end, midi, velocity] or [start, end, midi, velocity, intensity]';
  const [s, e, m, v, amount] = n as Note;
  if (e < s) return `ends at ${fmt(e)} s, before it starts at ${fmt(s)} s`;
  if (m < 0 || m > 127) return `midi ${m} is outside 0..127`;
  if (v < 0 || v > 127) return `velocity ${v} is outside 0..127`;
  if (amount !== undefined && (amount < 0 || amount > MAX_AMOUNT)) return `intensity ${amount} is outside 0..${MAX_AMOUNT}`;
  return null;
}

/** The longest step live playing takes: a pick goes to whoever plays at the end of the step it falls in. */
export const LONGEST_STEP = 1 / 20;

function validatePicks(picks: unknown, clips: unknown[], err: Report, warn: Report, typos: Typos): void {
  if (!isObj(picks)) { err('picks', 'not an object { <id>: { notes } }'); return; }
  for (const [id, set] of Object.entries(picks)) {
    const at = `picks.${id}`;
    if (!isSlug(id)) err(at, `${JSON.stringify(id)} is not a slug (lowercase letters, digits, single dashes)`);
    if (!isObj(set)) { err(at, 'not a set { notes }'); continue; }
    typos(set, KEYS.pickSet, at);
    const notes = set.notes;
    if (!Array.isArray(notes)) { err(`${at}.notes`, 'not a list of notes [start, end, midi, velocity]'); continue; }
    if (!notes.length) err(`${at}.notes`, 'no notes: a set of picks needs at least one');
    let prev = -Infinity, sorted = true;
    notes.forEach((n: unknown, i) => {
      const why = badNote(n);
      if (why) { err(`${at}.notes[${i}]`, why); return; }
      if ((n as Note)[0] < prev) sorted = false;
      prev = (n as Note)[0];
    });
    if (!sorted) err(`${at}.notes`, 'the notes are not sorted by start');
    // A pick is heard by a clip playing at its time, unless a live step can carry it past that clip's end.
    const using = clips.filter((o): o is Clip => isObj(o) && isNum(o.start) && isNum(o.end) && picksId(o.listen) === id);
    if (!using.length) { warn(at, 'no clip uses it'); continue; }
    const holds = (t: number) => using.some((o) => t >= o.start && t < o.end);
    notes.forEach((n: unknown, i) => {
      if (badNote(n)) return;
      const t = (n as Note)[0], after = t + LONGEST_STEP;
      if (!holds(t)) warn(`${at}.notes[${i}]`, `starts at ${fmt(t)} s, outside every clip using it: never heard`);
      else if (!holds(after)) warn(`${at}.notes[${i}]`, `starts at ${fmt(t)} s, within ${LONGEST_STEP * 1000} ms of the end of the clip using it: a live step can carry it past, never heard`);
    });
  }
}

const fmt4 = (x: number): string => `${Math.round(x * 1e4) / 1e4}`;
const quoted = (list: readonly string[]): string => list.map((m) => `'${m}'`).join(', ');

function validateRegion(r: unknown, at: string, err: Report, warn: Report, typos: Typos): void {
  if (!isObj(r)) { err(at, 'not a region { mode, shape, x, y, w, h }'); return; }
  typos(r, KEYS.region, at);
  if (!MODES.includes(r.mode as string)) err(`${at}.mode`, `${JSON.stringify(r.mode)} is not a mode (${quoted(MODES)})`);
  if (!REGION_SHAPES.includes(r.shape as string)) err(`${at}.shape`, `${JSON.stringify(r.shape)} is not a shape (${quoted(REGION_SHAPES)})`);
  for (const k of ['x', 'y', 'w', 'h'] as const) {
    const v = r[k];
    if (!isNum(v)) { err(`${at}.${k}`, 'not a number (a fraction of the canvas)'); continue; }
    if ((k === 'w' || k === 'h') && (v < REGION_SIZE[0] || v > REGION_SIZE[1])) err(`${at}.${k}`, `${k} ${fmt4(v)} is outside ${REGION_SIZE[0]}..${REGION_SIZE[1]} of the canvas`);
    if ((k === 'x' || k === 'y') && (v < REGION_CENTRE[0] || v > REGION_CENTRE[1])) warn(`${at}.${k}`, `${k} ${fmt4(v)}: the centre is off the canvas (expected ${REGION_CENTRE[0]}..${REGION_CENTRE[1]})`);
  }
  if (r.rot !== undefined) {
    if (!isNum(r.rot)) err(`${at}.rot`, 'not a number of degrees');
    else if (r.rot < -180 || r.rot > 180) warn(`${at}.rot`, `rot ${fmt4(r.rot)}°: expected -180..180 (it will be wrapped)`);
  }
  if (r.feather !== undefined) {
    if (!isNum(r.feather)) err(`${at}.feather`, 'not a number from 0 to 1');
    else if (r.feather < 0 || r.feather > 1) warn(`${at}.feather`, `feather ${fmt4(r.feather)}: expected 0..1 (it will be clamped)`);
  }
  for (const [k, list] of [['blend', BLENDS], ['fit', FITS]] as const) {
    if (r[k] === undefined) continue;
    if (!list.includes(r[k] as string)) err(`${at}.${k}`, `${JSON.stringify(r[k])} is not a ${k} (${quoted(list)})`);
    else if (r.mode === 'spot') warn(`${at}.${k}`, `a spot has no ${k}: only a window uses it`);
  }
}

function validateIntensity(p: unknown, at: string, span: Span | null, err: Report, warn: Report, typos: Typos): void {
  if (!Array.isArray(p)) { err(at, 'not a list of pivots [{ t, v }]'); return; }
  let prev = -Infinity, sorted = true;
  p.forEach((q: unknown, i) => {
    const pa = `${at}[${i}]`;
    if (!isObj(q) || !isNum(q.t) || !isNum(q.v)) { err(pa, 'not a pivot { t, v } (t in song seconds, v from 0 to 1)'); return; }
    typos(q, KEYS.pivot, pa);
    if (q.t < prev) sorted = false;
    prev = q.t;
    if (q.v < 0 || q.v > 1) err(`${pa}.v`, `v ${fmt4(q.v)} is outside 0..1`);
    if (span && (q.t < span.start || q.t > span.end)) warn(`${pa}.t`, `t ${fmt(q.t)} s is outside the clip (${fmt(span.start)}..${fmt(span.end)} s)`);
    if (q.shape !== undefined && !SHAPES.includes(q.shape as Shape)) err(`${pa}.shape`, `${JSON.stringify(q.shape)} is not a shape (${quoted(SHAPES)})`);
    if (q.bend !== undefined && !(isNum(q.bend) && q.bend >= -1 && q.bend <= 1)) err(`${pa}.bend`, `${JSON.stringify(q.bend)} is not a bend from -1 to 1`);
  });
  if (!sorted) err(at, 'the pivots are not sorted by t');
  if (p.length > MAX_PIVOTS) warn(at, `${p.length} pivots: more than ${MAX_PIVOTS} per clip`);
}

/** Degrees into −180..180 (180 stays 180). */
const wrapDeg = (d: number): number => { const w = ((((d + 180) % 360) + 360) % 360) - 180; return w === -180 && d > 0 ? 180 : w; };

/** A region as validateShow wants it, or undefined when it cannot be one (no known mode and shape, or no numeric
    centre and size). Says each fix through `fix` (paths under `at`); never mutates `r`. */
export function repairRegion(r: unknown, at = 'region', fix: Report = () => {}): Region | undefined {
  if (!isObj(r)) { fix(at, 'was not a region: removed'); return undefined; }
  if (!MODES.includes(r.mode as string) || !REGION_SHAPES.includes(r.shape as string)) {
    fix(at, `mode ${JSON.stringify(r.mode)} or shape ${JSON.stringify(r.shape)} is not known: the region removed`);
    return undefined;
  }
  if (!isNum(r.x) || !isNum(r.y) || !isNum(r.w) || !isNum(r.h)) { fix(at, 'x, y, w and h are not all numbers: the region removed'); return undefined; }
  const out: Region = { mode: r.mode as Region['mode'], shape: r.shape as Region['shape'], x: r.x, y: r.y, w: r.w, h: r.h };
  for (const k of ['w', 'h'] as const) {
    const v = clamp(out[k], REGION_SIZE[0], REGION_SIZE[1]);
    if (v !== out[k]) { fix(`${at}.${k}`, `${fmt4(out[k])} → ${v}`); out[k] = v; }
  }
  if (r.rot !== undefined) {
    if (!isNum(r.rot)) fix(`${at}.rot`, 'was not a number: removed');
    else { out.rot = wrapDeg(r.rot); if (out.rot !== r.rot) fix(`${at}.rot`, `${fmt4(r.rot)}° → ${fmt4(out.rot)}°`); }
  }
  if (r.feather !== undefined) {
    if (!isNum(r.feather)) fix(`${at}.feather`, 'was not a number: removed');
    else { out.feather = clamp(r.feather, 0, 1); if (out.feather !== r.feather) fix(`${at}.feather`, `${fmt4(r.feather)} → ${out.feather}`); }
  }
  if (r.blend !== undefined) { if (BLENDS.includes(r.blend as string)) out.blend = r.blend as Region['blend']; else fix(`${at}.blend`, `${JSON.stringify(r.blend)} is not a blend: removed`); }
  if (r.fit !== undefined) { if (FITS.includes(r.fit as string)) out.fit = r.fit as Region['fit']; else fix(`${at}.fit`, `${JSON.stringify(r.fit)} is not a fit: removed`); }
  return out;
}

/** Pivots as validateShow wants them: entries without numeric t and v dropped, unknown shapes and non-numeric bends
    removed, v and bend clamped, t clamped into `span` when given, sorted by t (stable); `cap` also keeps only the
    first MAX_PIVOTS (edits do; a file over the limit only gets a warning). undefined when none are left. Says each
    fix through `fix`; never mutates `p`. */
export function repairPivots(p: unknown, at = 'intensity', span: Span | null = null, fix: Report = () => {}, cap = false): Pivot[] | undefined {
  if (!Array.isArray(p)) { fix(at, 'was not a list of pivots: removed'); return undefined; }
  let out: Pivot[] = [];
  p.forEach((q: unknown, i) => {
    const pa = `${at}[${i}]`;
    if (!isObj(q) || !isNum(q.t) || !isNum(q.v)) { fix(pa, 'not a pivot { t, v }: dropped'); return; }
    const x: Pivot = { t: q.t, v: clamp(q.v, 0, 1) };
    if (x.v !== q.v) fix(`${pa}.v`, `${fmt4(q.v)} → ${x.v}`);
    if (span) { x.t = clamp(q.t, span.start, span.end); if (x.t !== q.t) fix(`${pa}.t`, `${fmt(q.t)} s → ${fmt(x.t)} s (inside the clip)`); }
    if (q.shape !== undefined) { if (SHAPES.includes(q.shape as Shape)) x.shape = q.shape as Shape; else fix(`${pa}.shape`, `${JSON.stringify(q.shape)} is not a shape: removed`); }
    if (q.bend !== undefined) {
      if (!isNum(q.bend)) fix(`${pa}.bend`, 'was not a number: removed');
      else { x.bend = clamp(q.bend, -1, 1); if (x.bend !== q.bend) fix(`${pa}.bend`, `${fmt4(q.bend)} → ${x.bend}`); }
    }
    out.push(x);
  });
  if (out.some((x, i) => i > 0 && x.t < out[i - 1].t)) {
    out = out.map((x, i) => [x, i] as const).sort((a, b) => a[0].t - b[0].t || a[1] - b[1]).map(([x]) => x);
    fix(at, 'sorted the pivots by t');
  }
  if (cap && out.length > MAX_PIVOTS) { fix(at, `${out.length} pivots: kept the first ${MAX_PIVOTS}`); out = out.slice(0, MAX_PIVOTS); }
  if (!out.length) { if (p.length) fix(at, 'no pivots left: removed'); return undefined; }
  return out;
}

/** Notes as a set holds them: malformed ones dropped, numbers to 4 decimals, sorted by start (stable). Says each fix
    (the rounding is no fix: canonicalShow writes that anyway); never mutates `n`. */
export function repairPickNotes(n: unknown, at = 'notes', fix: Report = () => {}): Note[] {
  if (!Array.isArray(n)) { fix(at, 'was not a list of notes: removed'); return []; }
  const out: Note[] = [];
  n.forEach((raw: unknown, i) => {
    // A bad intensity is no reason to lose the note: back to none.
    const x = Array.isArray(raw) && raw.length === 5 && (!isNum(raw[4]) || raw[4] < 0 || raw[4] > MAX_AMOUNT) ? raw.slice(0, 4) : raw;
    if (x !== raw) fix(`${at}[${i}]`, `intensity ${JSON.stringify((raw as unknown[])[4])} is not in 0..${MAX_AMOUNT}: removed`);
    const why = badNote(x);
    if (why) { fix(`${at}[${i}]`, `${why}: dropped`); return; }
    const [s, e, m, v, amount] = (x as Note).map((u) => Math.round((u as number) * 1e4) / 1e4 || 0) as Note;
    out.push(withAmount([s, e, m, v], amount));
  });
  if (out.every((x, i) => i === 0 || x[0] >= out[i - 1][0])) return out;
  fix(at, 'sorted the notes by start');
  return out.map((x, i) => [x, i] as const).sort((a, b) => a[0][0] - b[0][0] || a[1] - b[1]).map(([x]) => x);
}

/** The sets as validateShow wants them: their notes repaired; a set left with no notes goes (and with it its clips, in
    repairClip), an unused one stays for its warning, since it's hand work. Says which ids are left. */
function repairPicks(s: Show, fix: Report): ReadonlySet<string> {
  const picks: unknown = s.picks;
  if (picks === undefined) return new Set();
  delete s.picks;
  if (!isObj(picks)) { fix('picks', 'was not an object: removed'); return new Set(); }
  const out: Record<string, PickSet> = {};
  for (const [id, set] of Object.entries(picks)) {
    const at = `picks.${id}`;
    if (!isSlug(id)) { fix(at, `${JSON.stringify(id)} is not a slug: the set removed`); continue; }
    if (!isObj(set)) { fix(at, 'was not a set: removed'); continue; }
    const notes = repairPickNotes(set.notes, `${at}.notes`, fix);
    if (notes.length) out[id] = { notes }; else fix(at, 'no notes left: the set removed');
  }
  if (Object.keys(out).length) s.picks = out;
  return new Set(Object.keys(out));
}

/** Fixes what validateShow complains about, where the fix is obvious; never mutates `show`. A clip on an occupied spot goes
    to a free track, so nothing is lost; a clip past the song's end is cut there, or goes when none of it is left. */
export function repairShow(show: Show, c: ShowContext): { show: Show; fixed: Issue[] } {
  const s = clone(show), fixed: Issue[] = [];
  const fix = (path: string, message: string) => fixed.push({ path, message });
  if (!Array.isArray(s.clips)) fix('clips', 'no list of clips: an empty timeline');
  const sets = repairPicks(s, fix), D = isNum(c.duration) ? c.duration : Infinity;
  const kept: Clip[] = [];
  (Array.isArray(s.clips) ? s.clips : []).forEach((x, i) => {
    const at = `clips[${i}]`;
    if (!isObj(x) || !isNum(x.start) || !isNum(x.end)) { fix(at, 'not a clip with a start and an end: dropped'); return; }
    if (x.end < x.start) { fix(at, `ended before it started: ${fmt(x.start)}..${fmt(x.end)} s swapped`); [x.start, x.end] = [x.end, x.start]; }
    if (x.start < 0) { fix(`${at}.start`, `started at ${fmt(x.start)} s: now at 0`); x.start = 0; }
    if (x.start >= D) { fix(at, `starts at ${fmt(x.start)} s, after the song's end: dropped`); return; }
    if (x.end > D + END_SLACK) { fix(`${at}.end`, `ended at ${fmt(x.end)} s: now at the song's end, ${fmt(D)} s`); x.end = D; }
    if (x.end - x.start < MIN_CLIP) {
      const end = Math.min(D, x.start + MIN_CLIP);
      fix(at, `lasted ${fmt(x.end - x.start)} s: now ${fmt(end - x.start)} s`);
      x.end = end;
    }
    if (repairClip(x, at, c, sets, fix)) kept.push(x);
  });
  // Ids once all clips are known, tracks earliest first: an overlap sends the later clip up.
  const ids = new Set<string>();
  kept.forEach((x, i) => {
    if (typeof x.id === 'string' && isSlug(x.id) && !ids.has(x.id)) { ids.add(x.id); return; }
    const id = nextClipId([...kept, ...[...ids].map((v) => ({ id: v }))]);
    fix(`clips[${i}].id`, `${JSON.stringify(x.id)} is not an id of its own: now '${id}'`);
    x.id = id; ids.add(id);
  });
  const placed: Clip[] = [];
  for (const x of [...kept].sort((a, b) => a.start - b.start || (a.track ?? 0) - (b.track ?? 0))) {
    let want = x.track;
    if (!Number.isInteger(want) || want < 0) { want = 0; fix(`clips.${x.id}.track`, `${JSON.stringify(x.track)} is not a track: now 0`); }
    x.track = freeTrack(placed, x, want);
    if (x.track !== want) fix(`clips.${x.id}.track`, `track ${want} is taken at ${fmt(x.start)} s: now on track ${x.track}`);
    placed.push(x);
  }
  s.clips = kept;
  return { show: s, fixed };
}

/** A clip's own fields as validateShow wants them; false when it has to go (an unknown widget, a set that is gone). */
function repairClip(x: Clip, at: string, c: ShowContext, sets: ReadonlySet<string>, fix: Report): boolean {
  const l = x;
  if (typeof l.widget !== 'string') { fix(at, 'no widget: dropped'); return false; }
  const meta = c.widgets?.get(l.widget);
  if (c.widgets && !meta) { fix(at, `unknown widget '${l.widget}': dropped`); return false; }
  // Never by deleting the listen: that would make it the plain widget on every note.
  if (typeof l.listen === 'string' && l.listen.startsWith(PICKS) && !sets.has(picksId(l.listen) ?? '')) { fix(at, `listens to ${JSON.stringify(l.listen)}, which has no set: dropped`); return false; }
  if (l.listen !== undefined && !isListen(l.listen)) { fix(`${at}.listen`, `${JSON.stringify(l.listen)} is not a part: removed (all notes)`); delete l.listen; }
  if (x.fade !== undefined) {
    if (!isNum(x.fade)) { fix(`${at}.fade`, `was not a number: removed (the default, ${DEFAULT_FADE} s)`); delete x.fade; }
    else if (x.fade < 0 || x.fade > MAX_FADE) { const f = clamp(x.fade, 0, MAX_FADE); fix(`${at}.fade`, `${fmt(x.fade)} s → ${f} s`); x.fade = f; }
  }
  if (l.region !== undefined) { const r = repairRegion(l.region, `${at}.region`, fix); if (r) l.region = r; else delete l.region; }
  if (l.intensity !== undefined) {
    const p = repairPivots(l.intensity, `${at}.intensity`, { start: x.start, end: x.end }, fix);
    if (p) l.intensity = p; else delete l.intensity;
  }
  if (l.intensityMoves !== undefined && l.intensityMoves !== 'present') { fix(`${at}.intensityMoves`, "was not 'present': removed"); delete l.intensityMoves; }
  if (l.knobs !== undefined && !isObj(l.knobs)) { fix(`${at}.knobs`, 'was not an object: removed'); delete l.knobs; }
  for (const [key, v] of Object.entries(l.knobs ?? {})) {
    const kp = `${at}.knobs.${key}`, q = meta?.params.find((p) => p.key === key);
    const inRange = (b: number, p: string): number => {
      if (!q || (b >= q.min && b <= q.max)) return b;
      const b2 = clamp(b, q.min, q.max);
      fix(p, `${b} → ${b2} (${key} goes ${q.min}..${q.max})`);
      return b2;
    };
    if (isNum(v)) { l.knobs![key] = inRange(v, kp); continue; }
    if (!isObj(v)) { fix(kp, 'was neither a number nor { base, drive, depth }: removed'); delete l.knobs![key]; continue; }
    if (v.base !== undefined) { if (isNum(v.base)) v.base = inRange(v.base, `${kp}.base`); else { fix(`${kp}.base`, 'not a number: removed'); delete v.base; } }
    if (v.drive !== undefined && !DRIVES.includes(v.drive)) { fix(`${kp}.drive`, `${JSON.stringify(v.drive)} is not a drive: removed`); delete v.drive; }
    if (v.depth !== undefined && !(isNum(v.depth) && v.depth >= 0 && v.depth <= 1)) {
      if (isNum(v.depth)) { const d = clamp(v.depth, 0, 1); fix(`${kp}.depth`, `${v.depth} → ${d}`); v.depth = d; }
      else { fix(`${kp}.depth`, 'not a number: removed'); delete v.depth; }
    }
  }
  return true;
}

/** What shows/<id>.json holds: clips by start, then track, then id; keys in schema order (unknown properties dropped), times
    to ms, 2-space indent, a final newline. listen 'all' and an empty intensity are left out (they mean nothing); region
    numbers and pivot v and bend are rounded to 4 decimals, pivot t to ms, and each pivot sits on one line. picks come after
    the clips ({} left out), a note a line, its numbers to 4 decimals: a pick is exactly the note. */
export function canonicalShow(show: Show): string {
  const pick = (o: Record<string, unknown>, keys: readonly string[], map: (k: string, v: unknown) => unknown = (_k, v) => v) => {
    const out: Record<string, unknown> = {};
    for (const k of keys) if (o[k] !== undefined) out[k] = map(k, o[k]);
    return out;
  };
  const r4 = (v: unknown) => (isNum(v) ? Math.round(v * 1e4) / 1e4 || 0 : v);
  // A pivot is written as a token, swapped for its one-line JSON once the whole show is stringified.
  const pivots: string[] = [];
  const pivot = (p: unknown): unknown => {
    if (!isObj(p)) return p;
    const q = pick(p, KEYS.pivot, (k, v) => (k === 't' ? (isNum(v) ? ms(v) : v) : k === 'v' || k === 'bend' ? r4(v) : v));
    pivots.push(`{ ${Object.entries(q).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`);
    return `\u0000P${pivots.length - 1}`;
  };
  const noteLines: string[] = [];
  const note = (n: unknown): unknown => {
    if (!Array.isArray(n)) return n;
    noteLines.push(`[${n.map((x) => JSON.stringify(r4(x))).join(', ')}]`);
    return `\u0000N${noteLines.length - 1}`;
  };
  const pickSet = (p: unknown) => (isObj(p) ? pick(p, KEYS.pickSet, (_k, v) => (Array.isArray(v) ? v.map(note) : v)) : p);
  const knob = (v: unknown) => (isObj(v) ? pick(v, KEYS.knob) : v);
  const clip = (c: Clip) => pick(c as unknown as Record<string, unknown>, KEYS.clip, (k, v) =>
    k === 'start' || k === 'end' || k === 'fade' ? (isNum(v) ? ms(v) : v)
    : k === 'knobs' && isObj(v) ? Object.fromEntries(Object.entries(v).map(([key, x]) => [key, knob(x)]))
    : k === 'listen' ? (v === 'all' ? undefined : v)
    : k === 'region' && isObj(v) ? pick(v, KEYS.region, (_k, x) => r4(x))
    : k === 'intensity' && Array.isArray(v) ? (v.length ? v.map(pivot) : undefined)
    : v);
  const o = pick(show as unknown as Record<string, unknown>, KEYS.show, (k, v) =>
    k === 'version' ? SHOW_VERSION : k === 'composer' && isObj(v) ? pick(v, KEYS.composer)
    : k === 'clips' && Array.isArray(v) ? sortedClips(v as Clip[]).map(clip)
    : k === 'picks' && isObj(v) ? (Object.keys(v).length ? Object.fromEntries(Object.entries(v).map(([id, p]) => [id, pickSet(p)])) : undefined) : v);
  const text = JSON.stringify(o, null, 2);
  const swap = (t: string, re: RegExp, lines: string[]) => (lines.length ? t.replace(re, (_m, i: string) => lines[Number(i)]) : t);
  return `${swap(swap(text, /"\\u0000P(\d+)"/g, pivots), /"\\u0000N(\d+)"/g, noteLines)}\n`;
}
