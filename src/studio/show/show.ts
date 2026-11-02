/**
 * A show: a song's sections, each with a stack of lab widgets (bottom → top) and their knob settings. Plan §4.
 * shows/<id>.json holds canonicalShow(show). validateShow says what is wrong (errors) or odd (warnings), each with a
 * path like 'sections[2].layers[0].knobs.size'; repairShow fixes what can be fixed without asking.
 * Version 2 (plan 2026-10-31-instruments-regions-automation-hd §5): a layer may listen to a part, sit in a region and
 * follow an intensity curve. canonicalShow writes version 2 only when some layer does, so v1 files keep their bytes.
 * Picks (spec 2026-11-01-note-picker): show.picks holds sets of hand-picked notes, the notes themselves, and a layer
 * with listen 'picks:<id>' answers those notes only. A picks listen never turns into one that hears every note.
 */
import { isSlug } from '../pack/pack';
import { TRACKS, isTrackId } from '../pack/instruments';
import type { Drive, Family, KnobState, Line, Listen, Note, Pivot, Region, Shape, WidgetMeta } from '../../widgets/types';

export const SHOW_VERSION = 2, DEFAULT_FADE = 3, MAX_LAYERS = 6, MIN_SECTION = 1;
/** Pivots per layer per section (WaLayers.MAX_PIVOTS). */
export const MAX_PIVOTS = 256;
/** Seconds two sections may miss each other by, and the show's end the song's. */
export const JOIN_SLACK = 0.05, END_SLACK = 0.5, MAX_FADE = 10;

/** number = base; the object is the lab's PST entry ("Copy settings" pastes in). */
export type KnobSetting = number | Partial<KnobState>;
/** listen absent or 'all': all notes. intensity: pivots in song seconds inside the section, sorted by t. */
export interface Layer { widget: string; listen?: Listen; knobs?: Record<string, KnobSetting>; restart?: boolean;
  region?: Region; intensity?: Pivot[] }
export interface ShowSection { start: number; end: number; label?: string; fade?: number; layers: Layer[] }
/** Notes in full, sorted by start: a new transcription doesn't move them. */
export interface PickSet { notes: Note[] }
export interface Show {
  version: 1 | 2; id: string; song: string; title?: string;
  composer?: { by: 'auto' | 'claude' | 'user'; at: string };
  sections: ShowSection[];
  picks?: Record<string, PickSet>;
}
export interface Issue { path: string; message: string }
/** tracks: the song's instrument tracks (pack v2); undefined: no track warnings. */
export interface ShowContext { duration?: number; widgets?: ReadonlyMap<string, WidgetMeta>; tracks?: readonly string[] }

export const DRIVES: readonly Drive[] = ['', '+level', '-level', '+rate', '-rate', '+pitch', '-pitch', '+bass', '-bass', '+density', '-density'];
const COMPOSERS = ['auto', 'claude', 'user'];
const KEYS = {
  show: ['version', 'id', 'song', 'title', 'composer', 'sections', 'picks'],
  composer: ['by', 'at'],
  section: ['start', 'end', 'label', 'fade', 'layers'],
  layer: ['widget', 'listen', 'knobs', 'restart', 'region', 'intensity'],
  knob: ['base', 'drive', 'depth'],
  region: ['mode', 'shape', 'x', 'y', 'w', 'h', 'rot', 'feather', 'blend', 'fit'],
  pivot: ['t', 'v', 'shape', 'bend'],
  pickSet: ['notes'],
} as const;

export const LINES: readonly Line[] = ['melody', 'bassline', 'inner', 'low', 'high', 'accents'];
export const FAMILIES: readonly Family[] = ['keys', 'plucked', 'strings', 'winds', 'brass', 'percussion', 'voice'];
const MODES = ['spot', 'window'], REGION_SHAPES = ['rect', 'ellipse'], BLENDS = ['over', 'lighten'], FITS = ['cover', 'contain', 'stretch'];
const SHAPES: readonly Shape[] = ['linear', 'ease', 'hold'];
/** Region size (fraction of the canvas) and centre limits. */
export const REGION_SIZE = [0.02, 2] as const, REGION_CENTRE = [-0.5, 1.5] as const;

const PICKS = 'picks:';
export const picksListen = (id: string): Listen => `${PICKS}${id}`;
/** 'picks:p1' → 'p1'; anything else → null. */
export function picksId(listen: unknown): string | null {
  return typeof listen === 'string' && listen.startsWith(PICKS) && isSlug(listen.slice(PICKS.length)) ? listen.slice(PICKS.length) : null;
}

/** 'all' | a TrackId | family:<Family> | a Line | picks:<slug> (only validateShow can see whether the set exists). */
export function isListen(x: unknown): x is Listen {
  if (typeof x !== 'string') return false;
  if (x === 'all' || isTrackId(x) || (LINES as readonly string[]).includes(x) || picksId(x) !== null) return true;
  return x.startsWith('family:') && (FAMILIES as readonly string[]).includes(x.slice(7));
}
/** The part a layer listens to, or undefined for all notes ('all' is the same as absent). */
export const listenOf = (l: Pick<Layer, 'listen'>): Listen | undefined => (l.listen === undefined || l.listen === 'all' ? undefined : l.listen);
/** widget when it listens to all notes, else widget@listen (spec Decisions 7). */
export function instanceKey(l: Pick<Layer, 'widget' | 'listen'>): string {
  const p = listenOf(l);
  return p === undefined ? l.widget : `${l.widget}@${p}`;
}
const hasCurve = (l: { intensity?: unknown }): boolean => Array.isArray(l.intensity) && l.intensity.length > 0;
/** Some layer listens to a part, sits in a region or follows a curve, or the show has a set of picks: it is saved as
    version 2. Defensive, so validateShow can ask it of raw JSON. */
export function usesV2(show: Show): boolean {
  const picks: unknown = (show as { picks?: unknown }).picks;
  if (isObj(picks) && Object.keys(picks).length) return true;
  const secs: unknown = (show as { sections?: unknown }).sections;
  if (!Array.isArray(secs)) return false;
  return secs.some((s) => isObj(s) && Array.isArray(s.layers) && s.layers.some((l: unknown) =>
    isObj(l) && ((l.listen !== undefined && l.listen !== 'all') || l.region !== undefined || hasCurve(l))));
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

  if (!isObj(x)) { err('', 'a show is a JSON object { version, id, song, sections }'); return { errors, warnings }; }
  typos(x, KEYS.show, '');
  if (x.version !== 1 && x.version !== 2) err('version', `version ${JSON.stringify(x.version)}: this studio reads versions 1 and ${SHOW_VERSION}`);
  else if (x.version === 1 && usesV2(x as unknown as Show)) warn('version', 'uses version-2 fields (listen, region, intensity or picks): saved as version 2');
  if (!isSlug(x.id)) err('id', `${JSON.stringify(x.id)} is not a slug (lowercase letters, digits, single dashes)`);
  if (!isSlug(x.song)) err('song', `${JSON.stringify(x.song)} is not a song id (a slug: the folder songs/<id>/)`);
  if (x.title !== undefined && typeof x.title !== 'string') err('title', 'not a string');
  if (x.composer !== undefined) {
    if (!isObj(x.composer) || !COMPOSERS.includes(x.composer.by as string) || typeof x.composer.at !== 'string') {
      err('composer', `not { by: ${COMPOSERS.join(' | ')}, at: '<time>' }`);
    } else typos(x.composer, KEYS.composer, 'composer');
  }

  const sets: ReadonlySet<string> = new Set(isObj(x.picks) ? Object.keys(x.picks) : []);
  const sections = x.sections;
  if (!Array.isArray(sections) || !sections.length) { err('sections', 'a show needs at least one section'); return { errors, warnings }; }
  let prev: { start: number; end: number; i: number } | null = null;
  sections.forEach((s: unknown, i) => {
    const at = `sections[${i}]`;
    if (!isObj(s)) { err(at, 'not a section { start, end, layers }'); prev = null; return; }
    typos(s, KEYS.section, at);
    const timesOk = isNum(s.start) && isNum(s.end);
    if (!isNum(s.start)) err(`${at}.start`, 'not a number of seconds');
    if (!isNum(s.end)) err(`${at}.end`, 'not a number of seconds');
    if (timesOk) {
      const start = s.start as number, end = s.end as number;
      if (start >= end) err(`${at}.end`, `${at} ends at ${fmt(end)} s, not after its start ${fmt(start)} s`);
      else if (end - start < MIN_SECTION) warn(at, `${at} lasts ${fmt(end - start)} s: under ${MIN_SECTION} s is hard to see`);
      if (i === 0 && Math.abs(start) > JOIN_SLACK) err(`${at}.start`, `the first section starts at ${fmt(start)} s: it must start at 0`);
      if (prev) {
        const p: { start: number; end: number; i: number } = prev;
        if (start < p.start) err(`${at}.start`, `sections must be sorted by start: ${at} starts at ${fmt(start)} s, before sections[${p.i}] (${fmt(p.start)} s)`);
        else if (start < p.end - JOIN_SLACK) err(`${at}.start`, `${at} starts at ${fmt(start)} s, before sections[${p.i}] ends at ${fmt(p.end)} s: they overlap`);
        else if (start > p.end + JOIN_SLACK) err(`${at}.start`, `${at} starts at ${fmt(start)} s but sections[${p.i}] ends at ${fmt(p.end)} s: a gap of ${fmt(start - p.end)} s`);
      }
      if (i === sections.length - 1 && isNum(c.duration) && Math.abs(end - c.duration) > END_SLACK) {
        err(`${at}.end`, `the last section ends at ${fmt(end)} s but the song lasts ${fmt(c.duration)} s`);
      }
      prev = { start, end, i };
    } else prev = null;
    if (s.label !== undefined && typeof s.label !== 'string') err(`${at}.label`, 'not a string');
    if (s.fade !== undefined) {
      if (!isNum(s.fade)) err(`${at}.fade`, 'not a number of seconds');
      else if (s.fade < 0 || s.fade > MAX_FADE) warn(`${at}.fade`, `fade ${fmt(s.fade)} s: expected 0 (cut) to ${MAX_FADE} s`);
    }
    if (!Array.isArray(s.layers)) { err(`${at}.layers`, 'not a list of layers [{ widget }]'); return; }
    if (!s.layers.length) warn(`${at}.layers`, 'no layers: the picture fades to black here');
    if (s.layers.length > MAX_LAYERS) warn(`${at}.layers`, `${s.layers.length} layers: more than ${MAX_LAYERS} gets muddy and slow`);
    const seen = new Set<string>(), span = timesOk ? { start: s.start as number, end: s.end as number } : null;
    s.layers.forEach((l: unknown, j) => validateLayer(l, `${at}.layers[${j}]`, seen, span, c, sets, err, warn, typos));
  });
  if (x.picks !== undefined) validatePicks(x.picks, sections, err, warn, typos);
  return { errors, warnings };
}

type Report = (p: string, m: string) => void;
type Typos = (o: Record<string, unknown>, known: readonly string[], at: string) => void;
interface Span { start: number; end: number }

/** Why a listen is not heard as written, or null: a track or family this song does not have (c.tracks given). */
function missingPart(listen: string, c: ShowContext): string | null {
  if (!c.tracks) return null;
  if (isTrackId(listen) && !c.tracks.includes(listen)) return `this song has no ${listen}: it plays on all notes`;
  if (listen.startsWith('family:')) {
    const f = listen.slice(7);
    if (!c.tracks.some((t) => isTrackId(t) && TRACKS[t].family === f)) return `this song has no ${f} track: it plays on all notes`;
  }
  return null;
}

function validateLayer(l: unknown, at: string, seen: Set<string>, span: Span | null, c: ShowContext, sets: ReadonlySet<string>,
  err: Report, warn: Report, typos: Typos): void {
  if (!isObj(l) || typeof l.widget !== 'string') { err(at, 'not a layer { widget: "<id>" }'); return; }
  typos(l, KEYS.layer, at);
  const meta = c.widgets?.get(l.widget);
  if (c.widgets && !meta) err(`${at}.widget`, `unknown widget '${l.widget}' (no lab/tools/${l.widget}.js)`);
  const listenOk = l.listen === undefined || isListen(l.listen);
  if (!listenOk) {
    err(`${at}.listen`, `${JSON.stringify(l.listen)} is not a part: 'all', a track (${Object.keys(TRACKS).join(', ')}), family:<${FAMILIES.join('|')}>, a line (${LINES.join(', ')}) or picks:<id>`);
  } else if (picksId(l.listen) !== null) {
    if (!sets.has(picksId(l.listen)!)) err(`${at}.listen`, `${JSON.stringify(l.listen)} has no set in show.picks: it would hear nothing`);
  } else if (typeof l.listen === 'string') {
    const why = missingPart(l.listen, c);
    if (why) warn(`${at}.listen`, why);
  }
  const key = listenOk ? instanceKey(l as unknown as Layer) : l.widget;
  if (seen.has(key)) {
    err(key === l.widget ? `${at}.widget` : `${at}.listen`, `'${key}' is already in this section: an instance plays once per section (two would overlap)`);
  }
  seen.add(key);
  if (l.restart !== undefined && typeof l.restart !== 'boolean') err(`${at}.restart`, 'not true or false');
  if (l.region !== undefined) validateRegion(l.region, `${at}.region`, err, warn, typos);
  if (l.intensity !== undefined) validateIntensity(l.intensity, `${at}.intensity`, span, err, warn, typos);
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

/** What is wrong with a note of a set, or null. */
function badNote(n: unknown): string | null {
  if (!Array.isArray(n) || n.length !== 4 || !n.every(isNum)) return 'not [start, end, midi, velocity]';
  const [s, e, m, v] = n as Note;
  if (e < s) return `ends at ${fmt(e)} s, before it starts at ${fmt(s)} s`;
  if (m < 0 || m > 127) return `midi ${m} is outside 0..127`;
  if (v < 0 || v > 127) return `velocity ${v} is outside 0..127`;
  return null;
}

/** The longest step live playing takes: a pick goes to whoever plays at the end of the step it falls in. */
export const LONGEST_STEP = 1 / 20;

function validatePicks(picks: unknown, sections: unknown[], err: Report, warn: Report, typos: Typos): void {
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
    // A pick starts in the section holding its time: a section's end is the next one's.
    const using = sections.filter((s): s is ShowSection => isObj(s) && isNum(s.start) && isNum(s.end) && Array.isArray(s.layers)
      && s.layers.some((l: unknown) => isObj(l) && picksId(l.listen) === id));
    if (!using.length) { warn(at, 'no layer uses it'); continue; }
    const holds = (t: number) => using.some((s) => t >= s.start && t < s.end);
    const showEnd = Math.max(...sections.map((s) => (isObj(s) && isNum(s.end) ? s.end : 0)));
    notes.forEach((n: unknown, i) => {
      if (badNote(n)) return;
      const t = (n as Note)[0], after = t + LONGEST_STEP;
      if (!holds(t)) warn(`${at}.notes[${i}]`, `starts at ${fmt(t)} s, outside every section using it: never heard`);
      else if (after < showEnd && !holds(after)) warn(`${at}.notes[${i}]`, `starts at ${fmt(t)} s, within ${LONGEST_STEP * 1000} ms of the end of the sections using it: a live step can carry it past them, never heard`);
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
    if (span && (q.t < span.start || q.t > span.end)) warn(`${pa}.t`, `t ${fmt(q.t)} s is outside the section (${fmt(span.start)}..${fmt(span.end)} s)`);
    if (q.shape !== undefined && !SHAPES.includes(q.shape as Shape)) err(`${pa}.shape`, `${JSON.stringify(q.shape)} is not a shape (${quoted(SHAPES)})`);
    if (q.bend !== undefined && !(isNum(q.bend) && q.bend >= -1 && q.bend <= 1)) err(`${pa}.bend`, `${JSON.stringify(q.bend)} is not a bend from -1 to 1`);
  });
  if (!sorted) err(at, 'the pivots are not sorted by t');
  if (p.length > MAX_PIVOTS) warn(at, `${p.length} pivots: more than ${MAX_PIVOTS} per layer per section`);
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
    if (span) { x.t = clamp(q.t, span.start, span.end); if (x.t !== q.t) fix(`${pa}.t`, `${fmt(q.t)} s → ${fmt(x.t)} s (inside the section)`); }
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
  n.forEach((x: unknown, i) => {
    const why = badNote(x);
    if (why) fix(`${at}[${i}]`, `${why}: dropped`);
    else out.push((x as Note).map((v) => Math.round(v * 1e4) / 1e4 || 0) as Note);
  });
  if (out.every((x, i) => i === 0 || x[0] >= out[i - 1][0])) return out;
  fix(at, 'sorted the notes by start');
  return out.map((x, i) => [x, i] as const).sort((a, b) => a[0][0] - b[0][0] || a[1] - b[1]).map(([x]) => x);
}

/** The sets as validateShow wants them: their notes repaired; a set left with no notes goes (and with it its layers, in
    repairSection), an unused one stays for its warning, since it's hand work. Says which ids are left. */
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

/** Fixes what validateShow complains about, where the fix is obvious; never mutates `show`. */
export function repairShow(show: Show, c: ShowContext): { show: Show; fixed: Issue[] } {
  const s = clone(show), fixed: Issue[] = [];
  const fix = (path: string, message: string) => fixed.push({ path, message });
  let secs = Array.isArray(s.sections) ? s.sections.filter((x) => isObj(x) && isNum(x.start) && isNum(x.end)) : [];
  if (secs.length !== (Array.isArray(s.sections) ? s.sections.length : -1)) fix('sections', 'dropped sections without a start and an end');
  if (!secs.length) {
    secs = [{ start: 0, end: isNum(c.duration) ? c.duration : MIN_SECTION, layers: [] }];
    fix('sections', 'no sections: one empty section over the whole song');
  }
  if (secs.some((x, i) => i > 0 && x.start < secs[i - 1].start)) {
    secs = secs.map((x, i) => [x, i] as const).sort((a, b) => a[0].start - b[0].start || a[1] - b[1]).map(([x]) => x);
    fix('sections', 'sorted the sections by start');
  }
  secs.forEach((x, i) => { if (x.end < x.start) { fix(`sections[${i}].end`, `ended before it started (${fmt(x.end)} s): now ends at its start`); x.end = x.start; } });
  for (let i = 1; i < secs.length; i++) {
    const p = secs[i - 1], x = secs[i];
    if (x.start < p.end - JOIN_SLACK) fix(`sections[${i - 1}].end`, `overlapped sections[${i}]: now ends at ${fmt(x.start)} s instead of ${fmt(p.end)} s`);
    else if (x.start > p.end + JOIN_SLACK) fix(`sections[${i - 1}].end`, `left a gap before sections[${i}]: now ends at ${fmt(x.start)} s instead of ${fmt(p.end)} s`);
    else continue;
    p.end = x.start;
  }
  if (Math.abs(secs[0].start) > JOIN_SLACK) { fix('sections[0].start', `started at ${fmt(secs[0].start)} s: now at 0`); secs[0].start = 0; }
  const last = secs[secs.length - 1];
  if (isNum(c.duration) && Math.abs(last.end - c.duration) > END_SLACK) {
    fix(`sections[${secs.length - 1}].end`, `ended at ${fmt(last.end)} s: now at the song's end, ${fmt(c.duration)} s`);
    last.end = c.duration;
  }
  // A section that ends up at or past the song's end (a shorter recording under the same id) merges like a short one;
  // the widened section before it is checked again, so a run of them all fold into the last one that fits.
  for (let i = 0; secs.length > 1 && i < secs.length;) {
    const x = secs[i];
    if (x.end - x.start >= MIN_SECTION) { i++; continue; }
    const why = x.end > x.start ? `lasted ${fmt(x.end - x.start)} s` : `started at ${fmt(x.start)} s, at or after its end ${fmt(x.end)} s`;
    if (i > 0) { secs[i - 1].end = x.end; fix(`sections[${i}]`, `${why}: merged into the section before`); }
    else { secs[1].start = x.start; fix('sections[0]', `${why}: merged into the section after`); }
    secs.splice(i, 1);
    if (i > 0) i--;
  }
  const sets = repairPicks(s, fix);
  secs.forEach((x, i) => repairSection(x, `sections[${i}]`, c, sets, fix));
  s.sections = secs;
  return { show: s, fixed };
}

function repairSection(x: ShowSection, at: string, c: ShowContext, sets: ReadonlySet<string>, fix: (p: string, m: string) => void): void {
  if (x.fade !== undefined) {
    if (!isNum(x.fade)) { fix(`${at}.fade`, 'was not a number: removed (the default, 3 s)'); delete x.fade; }
    else if (x.fade < 0 || x.fade > MAX_FADE) { const f = clamp(x.fade, 0, MAX_FADE); fix(`${at}.fade`, `${fmt(x.fade)} s → ${f} s`); x.fade = f; }
  }
  if (x.label !== undefined && typeof x.label !== 'string') { fix(`${at}.label`, 'was not text: removed'); delete x.label; }
  const seen = new Set<string>(), keep: Layer[] = [];
  (Array.isArray(x.layers) ? x.layers : []).forEach((l, j) => {
    const lp = `${at}.layers[${j}]`;
    if (!isObj(l) || typeof l.widget !== 'string') { fix(lp, 'not a layer: dropped'); return; }
    const meta = c.widgets?.get(l.widget);
    if (c.widgets && !meta) { fix(lp, `unknown widget '${l.widget}': dropped`); return; }
    // Never by deleting the listen: that would make it the plain widget on every note.
    if (typeof l.listen === 'string' && l.listen.startsWith(PICKS) && !sets.has(picksId(l.listen) ?? '')) { fix(lp, `listens to ${JSON.stringify(l.listen)}, which has no set: dropped`); return; }
    if (l.listen !== undefined && !isListen(l.listen)) { fix(`${lp}.listen`, `${JSON.stringify(l.listen)} is not a part: removed (all notes)`); delete l.listen; }
    const key = instanceKey(l);
    if (seen.has(key)) { fix(lp, `'${key}' twice in one section: the second dropped`); return; }
    seen.add(key);
    if (l.restart !== undefined && typeof l.restart !== 'boolean') { fix(`${lp}.restart`, 'was not true or false: removed'); delete l.restart; }
    if (l.region !== undefined) { const r = repairRegion(l.region, `${lp}.region`, fix); if (r) l.region = r; else delete l.region; }
    if (l.intensity !== undefined) {
      const p = repairPivots(l.intensity, `${lp}.intensity`, { start: x.start, end: x.end }, fix);
      if (p) l.intensity = p; else delete l.intensity;
    }
    if (l.knobs !== undefined && !isObj(l.knobs)) { fix(`${lp}.knobs`, 'was not an object: removed'); delete l.knobs; }
    for (const [key, v] of Object.entries(l.knobs ?? {})) {
      const kp = `${lp}.knobs.${key}`, q = meta?.params.find((p) => p.key === key);
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
    keep.push(l);
  });
  x.layers = keep;
}

/** What shows/<id>.json holds: keys in schema order (unknown properties dropped), times to ms, 2-space indent, a final
    newline. version is 2 when usesV2, else 1. listen 'all' and an empty intensity are left out (they mean nothing);
    region numbers and pivot v and bend are rounded to 4 decimals, pivot t to ms, and each pivot sits on one line. picks
    come after sections ({} left out), a note a line, its numbers to 4 decimals: a pick is exactly the note. */
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
  const layer = (l: Layer) => pick(l as unknown as Record<string, unknown>, KEYS.layer, (k, v) =>
    k === 'knobs' && isObj(v) ? Object.fromEntries(Object.entries(v).map(([key, x]) => [key, knob(x)]))
    : k === 'listen' ? (v === 'all' ? undefined : v)
    : k === 'region' && isObj(v) ? pick(v, KEYS.region, (_k, x) => r4(x))
    : k === 'intensity' && Array.isArray(v) ? (v.length ? v.map(pivot) : undefined)
    : v);
  const section = (s: ShowSection) => pick(s as unknown as Record<string, unknown>, KEYS.section, (k, v) =>
    k === 'start' || k === 'end' || k === 'fade' ? (isNum(v) ? ms(v) : v) : k === 'layers' && Array.isArray(v) ? v.map(layer) : v);
  const version = usesV2(show) ? 2 : 1;
  const o = pick(show as unknown as Record<string, unknown>, KEYS.show, (k, v) =>
    k === 'version' ? version : k === 'composer' && isObj(v) ? pick(v, KEYS.composer) : k === 'sections' && Array.isArray(v) ? v.map(section)
    : k === 'picks' && isObj(v) ? (Object.keys(v).length ? Object.fromEntries(Object.entries(v).map(([id, p]) => [id, pickSet(p)])) : undefined) : v);
  const text = JSON.stringify(o, null, 2);
  const swap = (t: string, re: RegExp, lines: string[]) => (lines.length ? t.replace(re, (_m, i: string) => lines[Number(i)]) : t);
  return `${swap(swap(text, /"\\u0000P(\d+)"/g, pivots), /"\\u0000N(\d+)"/g, noteLines)}\n`;
}
