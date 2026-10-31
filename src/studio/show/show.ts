/**
 * A show: a song's sections, each with a stack of lab widgets (bottom → top) and their knob settings. Plan §4.
 * shows/<id>.json holds canonicalShow(show). validateShow says what is wrong (errors) or odd (warnings), each with a
 * path like 'sections[2].layers[0].knobs.size'; repairShow fixes what can be fixed without asking.
 */
import { isSlug } from '../pack/pack';
import type { Drive, KnobState, WidgetMeta } from '../../widgets/types';

export const SHOW_VERSION = 1, DEFAULT_FADE = 3, MAX_LAYERS = 6, MIN_SECTION = 1;
/** Seconds two sections may miss each other by, and the show's end the song's. */
export const JOIN_SLACK = 0.05, END_SLACK = 0.5, MAX_FADE = 10;

/** number = base; the object is the lab's PST entry ("Copy settings" pastes in). */
export type KnobSetting = number | Partial<KnobState>;
export interface Layer { widget: string; knobs?: Record<string, KnobSetting>; restart?: boolean }
export interface ShowSection { start: number; end: number; label?: string; fade?: number; layers: Layer[] }
export interface Show {
  version: 1; id: string; song: string; title?: string;
  composer?: { by: 'auto' | 'claude' | 'user'; at: string };
  sections: ShowSection[];
}
export interface Issue { path: string; message: string }
export interface ShowContext { duration?: number; widgets?: ReadonlyMap<string, WidgetMeta> }

export const DRIVES: readonly Drive[] = ['', '+level', '-level', '+rate', '-rate', '+pitch', '-pitch', '+bass', '-bass', '+density', '-density'];
const COMPOSERS = ['auto', 'claude', 'user'];
const KEYS = {
  show: ['version', 'id', 'song', 'title', 'composer', 'sections'],
  composer: ['by', 'at'],
  section: ['start', 'end', 'label', 'fade', 'layers'],
  layer: ['widget', 'knobs', 'restart'],
  knob: ['base', 'drive', 'depth'],
} as const;

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
  if (x.version !== SHOW_VERSION) err('version', `version ${JSON.stringify(x.version)}: this studio reads version ${SHOW_VERSION}`);
  if (!isSlug(x.id)) err('id', `${JSON.stringify(x.id)} is not a slug (lowercase letters, digits, single dashes)`);
  if (!isSlug(x.song)) err('song', `${JSON.stringify(x.song)} is not a song id (a slug: the folder songs/<id>/)`);
  if (x.title !== undefined && typeof x.title !== 'string') err('title', 'not a string');
  if (x.composer !== undefined) {
    if (!isObj(x.composer) || !COMPOSERS.includes(x.composer.by as string) || typeof x.composer.at !== 'string') {
      err('composer', `not { by: ${COMPOSERS.join(' | ')}, at: '<time>' }`);
    } else typos(x.composer, KEYS.composer, 'composer');
  }

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
    if (s.layers.length > MAX_LAYERS) warn(`${at}.layers`, `${s.layers.length} layers: more than ${MAX_LAYERS} gets muddy and slow`);
    const seen = new Set<string>();
    s.layers.forEach((l: unknown, j) => validateLayer(l, `${at}.layers[${j}]`, seen, c, err, warn, typos));
  });
  return { errors, warnings };
}

function validateLayer(l: unknown, at: string, seen: Set<string>, c: ShowContext, err: (p: string, m: string) => void,
  warn: (p: string, m: string) => void, typos: (o: Record<string, unknown>, known: readonly string[], at: string) => void): void {
  if (!isObj(l) || typeof l.widget !== 'string') { err(at, 'not a layer { widget: "<id>" }'); return; }
  typos(l, KEYS.layer, at);
  const meta = c.widgets?.get(l.widget);
  if (c.widgets && !meta) err(`${at}.widget`, `unknown widget '${l.widget}' (no lab/tools/${l.widget}.js)`);
  if (seen.has(l.widget)) err(`${at}.widget`, `'${l.widget}' is already in this section: a widget plays once per section`);
  seen.add(l.widget);
  if (l.restart !== undefined && typeof l.restart !== 'boolean') err(`${at}.restart`, 'not true or false');
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
  secs.forEach((x, i) => repairSection(x, `sections[${i}]`, c, fix));
  s.sections = secs;
  return { show: s, fixed };
}

function repairSection(x: ShowSection, at: string, c: ShowContext, fix: (p: string, m: string) => void): void {
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
    if (seen.has(l.widget)) { fix(lp, `'${l.widget}' twice in one section: the second dropped`); return; }
    seen.add(l.widget);
    if (l.restart !== undefined && typeof l.restart !== 'boolean') { fix(`${lp}.restart`, 'was not true or false: removed'); delete l.restart; }
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

/** What shows/<id>.json holds: keys in schema order (unknown properties dropped), times to ms, 2-space indent, a final newline. */
export function canonicalShow(show: Show): string {
  const pick = (o: Record<string, unknown>, keys: readonly string[], map: (k: string, v: unknown) => unknown = (_k, v) => v) => {
    const out: Record<string, unknown> = {};
    for (const k of keys) if (o[k] !== undefined) out[k] = map(k, o[k]);
    return out;
  };
  const knob = (v: unknown) => (isObj(v) ? pick(v, KEYS.knob) : v);
  const layer = (l: Layer) => pick(l as unknown as Record<string, unknown>, KEYS.layer, (k, v) =>
    k === 'knobs' && isObj(v) ? Object.fromEntries(Object.entries(v).map(([key, x]) => [key, knob(x)])) : v);
  const section = (s: ShowSection) => pick(s as unknown as Record<string, unknown>, KEYS.section, (k, v) =>
    k === 'start' || k === 'end' || k === 'fade' ? (isNum(v) ? ms(v) : v) : k === 'layers' && Array.isArray(v) ? v.map(layer) : v);
  const o = pick(show as unknown as Record<string, unknown>, KEYS.show, (k, v) =>
    k === 'composer' && isObj(v) ? pick(v, KEYS.composer) : k === 'sections' && Array.isArray(v) ? v.map(section) : v);
  return `${JSON.stringify(o, null, 2)}\n`;
}
