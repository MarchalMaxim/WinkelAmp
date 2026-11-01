/**
 * Script validation and normalisation. Scripts are written by Claude (an LLM)
 * in a study session, so every error names the JSON path and what was expected
 * there, all errors are reported in one pass, and unknown keys are errors: a
 * misspelled `intesity` silently ignored would be a show that quietly differs
 * from what was composed. Hand-written (no schema library, no dependencies) and
 * free of Node APIs, because the app bundles it to load the corpus.
 */
import { STYLES, widgetOf } from './elements';
import { DRIVES } from './kit';
import {
  DEFAULT_PARAMS,
  type AccentKind,
  type CastMember,
  type ElementParams,
  type ElementSpec,
  type ElementType,
  type Script,
} from './types';

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
/** Script ids name files (corpus/<id>.json), so they are lowercase slugs. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Element ids appear in ramp targets as `<id>.size`, so no dots (and `look` is taken). */
const ELEMENT_ID = /^[A-Za-z0-9_-]+$/;
const REGIONS = ['full', 'top', 'bottom', 'left', 'right', 'center'];
const MIRRORS = [1, 2, 4, 6, 8, 12];
const STUDIES = ['ember', 'basalt', 'sugar', 'mist'];
const ACTIONS = ['scene', 'enter', 'exit', 'accent', 'ramp'] as const;
const ACCENTS: AccentKind[] = ['flash', 'shock', 'swell', 'cut'];
/** The keys each kind of cue may have besides `at` and `snap`. */
const CUE_KEYS: Record<(typeof ACTIONS)[number], string[]> = {
  scene: ['scene', 'transition'],
  enter: ['enter', 'fade'],
  exit: ['exit', 'fade'],
  accent: ['accent'],
  ramp: ['ramp'],
};
/** Look values that interpolate (mirror and palette are discrete). */
const RAMP_LOOK = ['trails', 'warp', 'glow', 'melt'];
const RAMP_ELEMENT = ['intensity', 'size'];
/** Scene changes are triggered by the music and must finish within 2 s (the global transition rule). */
const MAX_BLEND = 2;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const show = (v: unknown) => (v === undefined ? 'nothing' : JSON.stringify(v));
const oneOf = (xs: readonly unknown[]) => xs.map((x) => (typeof x === 'string' ? `"${x}"` : String(x))).join(', ');

/** Collects path-prefixed errors. */
class Checker {
  readonly errors: string[] = [];

  bad(path: string, msg: string): void {
    this.errors.push(`${path}: ${msg}`);
  }

  /** `v` must be an object with only `allowed` keys; false (with an error) when it isn't an object at all. */
  object(path: string, v: unknown, allowed: readonly string[]): v is Obj {
    if (!isObj(v)) {
      this.bad(path, `expected an object, got ${show(v)}`);
      return false;
    }
    for (const k of Object.keys(v)) {
      if (!allowed.includes(k)) this.bad(`${path}.${k}`, `unknown key (allowed: ${allowed.join(', ')})`);
    }
    return true;
  }

  unit(path: string, v: unknown): void {
    this.range(path, v, 0, 1);
  }

  range(path: string, v: unknown, min: number, max: number): void {
    if (!isNum(v) || v < min || v > max) this.bad(path, `must be a number from ${min} to ${max}, got ${show(v)}`);
  }

  /** `params.knobs` of an element of a known type: names it has, values in range, a known drive, depth 0..1. */
  knobs(path: string, v: unknown, type: string): void {
    if (!this.object(path, v, Object.keys(isObj(v) ? v : {}))) return;
    const w = widgetOf(type);
    const own = w?.knobs ?? [];
    for (const [name, set] of Object.entries(v)) {
      const k = own.find((x) => x.name === name);
      const at = `${path}.${name}`;
      if (!k) {
        this.bad(at, `unknown knob for ${type} (${own.length ? `knobs: ${oneOf(own.map((x) => x.name))}` : 'it has none'})`);
        continue;
      }
      if (!isObj(set)) {
        this.range(at, set, k.min, k.max);
        continue;
      }
      if (!this.object(at, set, ['value', 'drive', 'depth'])) continue;
      if (set.value !== undefined) this.range(`${at}.value`, set.value, k.min, k.max);
      if (set.drive !== undefined) this.member(`${at}.drive`, set.drive, DRIVES, 'drive');
      if (set.depth !== undefined) this.unit(`${at}.depth`, set.depth);
    }
  }

  seconds(path: string, v: unknown, max = Infinity): void {
    if (!isNum(v) || v < 0 || v > max) {
      this.bad(path, `must be a number of seconds from 0${max < Infinity ? ` to ${max}` : ''}, got ${show(v)}`);
    }
  }

  hex(path: string, v: unknown): void {
    if (typeof v !== 'string' || !HEX.test(v)) this.bad(path, `must be a hex color like "#ffcc00" or "#fc0", got ${show(v)}`);
  }

  member(path: string, v: unknown, xs: readonly unknown[], what: string): boolean {
    if (xs.includes(v)) return true;
    this.bad(path, `unknown ${what} ${show(v)} (expected one of ${oneOf(xs)})`);
    return false;
  }

  string(path: string, v: unknown, optional = false): void {
    if (optional && v === undefined) return;
    if (typeof v !== 'string' || !v.trim()) this.bad(path, `must be a non-empty string, got ${show(v)}`);
  }

  look(path: string, v: unknown): void {
    if (!this.object(path, v, ['palette', 'trails', 'warp', 'mirror', 'glow', 'melt'])) return;
    const p = v.palette;
    if (Array.isArray(p)) {
      if (p.length !== 4) this.bad(`${path}.palette`, `a fixed palette has exactly 4 colors, got ${p.length}`);
      p.forEach((c, i) => this.hex(`${path}.palette[${i}]`, c));
    } else if (p !== undefined && p !== 'mood' && p !== 'notes') {
      this.bad(`${path}.palette`, `must be "mood", "notes" or an array of 4 hex colors, got ${show(p)}`);
    }
    for (const k of ['trails', 'warp', 'glow', 'melt']) if (v[k] !== undefined) this.unit(`${path}.${k}`, v[k]);
    if (v.mirror !== undefined) this.member(`${path}.mirror`, v.mirror, MIRRORS, 'mirror');
  }

  /** Returns the element's id when it is a usable one. */
  spec(path: string, v: unknown): string | null {
    if (!this.object(path, v, ['id', 'type', 'params'])) return null;
    let id: string | null = null;
    if (typeof v.id !== 'string' || !ELEMENT_ID.test(v.id) || v.id === 'look') {
      this.bad(`${path}.id`, `must be a name of letters, digits, "-" or "_" (not "look"), got ${show(v.id)}`);
    } else id = v.id;
    const typeOk = this.member(`${path}.type`, v.type, Object.keys(STYLES), 'element type');
    const p = v.params;
    if (p === undefined || !this.object(`${path}.params`, p, [...Object.keys(DEFAULT_PARAMS), 'knobs'])) return id;
    if (p.intensity !== undefined) this.unit(`${path}.params.intensity`, p.intensity);
    if (p.size !== undefined) this.unit(`${path}.params.size`, p.size);
    if (p.region !== undefined) this.member(`${path}.params.region`, p.region, REGIONS, 'region');
    if (p.color !== undefined && p.color !== 'mood' && p.color !== 'note') {
      if (typeof p.color !== 'string' || !HEX.test(p.color)) {
        this.bad(`${path}.params.color`, `must be "mood", "note" or a hex color like "#ffcc00", got ${show(p.color)}`);
      }
    }
    if (p.style !== undefined) {
      if (typeOk) this.member(`${path}.params.style`, p.style, STYLES[v.type as ElementType], `style for ${v.type}`);
      else if (typeof p.style !== 'string') this.bad(`${path}.params.style`, `must be a string, got ${show(p.style)}`);
    }
    if (p.knobs !== undefined && typeOk) this.knobs(`${path}.params.knobs`, p.knobs, v.type as string);
    return id;
  }
}

/**
 * Checks a parsed script. Never throws; on success the input is returned as is
 * (defaults are filled later, per element, by normalizeSpec).
 */
export function validateScript(json: unknown): { ok: true; script: Script } | { ok: false; errors: string[] } {
  const c = new Checker();
  if (!isObj(json)) return { ok: false, errors: [`(root): expected a script object, got ${show(json)}`] };
  for (const k of Object.keys(json)) {
    if (!['version', 'id', 'title', 'artist', 'duration', 'notes', 'match', 'scenes', 'timeline'].includes(k)) {
      c.bad(k, 'unknown key (allowed: version, id, title, artist, duration, notes, match, scenes, timeline)');
    }
  }
  if (json.version !== 1) c.bad('version', `must be 1, got ${show(json.version)}`);
  if (typeof json.id !== 'string' || !SLUG.test(json.id)) {
    c.bad('id', `must be a lowercase slug like "rach-pc2-mvt1" (it names corpus/<id>.json), got ${show(json.id)}`);
  }
  c.string('title', json.title);
  c.string('artist', json.artist, true);
  c.string('notes', json.notes, true);
  if (!isNum(json.duration) || json.duration <= 0) c.bad('duration', `must be the song's length in seconds (> 0), got ${show(json.duration)}`);

  const m = json.match;
  if (isObj(m) && m.kind === 'study') {
    c.object('match', m, ['kind', 'study', 'seed']);
    c.member('match.study', m.study, STUDIES, 'study');
    if (!Number.isInteger(m.seed)) c.bad('match.seed', `must be an integer, got ${show(m.seed)}`);
  } else if (isObj(m) && m.kind === 'recording') {
    c.object('match', m, ['kind']);
  } else {
    c.bad('match', `must be { "kind": "recording" } or { "kind": "study", "study": ..., "seed": ... }, got ${show(m)}`);
  }

  // Scenes. Every id any scene puts on stage is addressable by exit/ramp cues.
  const known = new Set<string>();
  const scenes = isObj(json.scenes) ? json.scenes : {};
  if (!isObj(json.scenes) || !Object.keys(scenes).length) c.bad('scenes', `must be an object with at least one named scene, got ${show(json.scenes)}`);
  for (const [name, def] of Object.entries(scenes)) {
    const path = `scenes.${name}`;
    if (!c.object(path, def, ['look', 'elements'])) continue;
    if (def.look !== undefined) c.look(`${path}.look`, def.look);
    if (!Array.isArray(def.elements)) {
      c.bad(`${path}.elements`, `must be an array of elements, got ${show(def.elements)}`);
      continue;
    }
    const ids = new Set<string>();
    def.elements.forEach((e, i) => {
      const id = c.spec(`${path}.elements[${i}]`, e);
      if (id === null) return;
      if (ids.has(id)) c.bad(`${path}.elements[${i}].id`, `"${id}" is already used in this scene`);
      ids.add(id);
      known.add(id);
    });
  }

  // Timeline: sorted, one action per cue, references resolve. An id entered by a cue is known from then on.
  if (!Array.isArray(json.timeline)) {
    c.bad('timeline', `must be an array of cues, got ${show(json.timeline)}`);
    return finish(c, json);
  }
  let prevAt = 0;
  json.timeline.forEach((cue: unknown, i) => {
    const path = `timeline[${i}]`;
    if (!isObj(cue)) return c.bad(path, `expected a cue object, got ${show(cue)}`);
    if (!isNum(cue.at) || cue.at < 0) c.bad(`${path}.at`, `must be song seconds >= 0, got ${show(cue.at)}`);
    else {
      if (cue.at < prevAt) c.bad(`${path}.at`, `the timeline must be sorted by time, but ${cue.at} is earlier than a cue before it (${prevAt})`);
      prevAt = Math.max(prevAt, cue.at);
    }
    if (cue.snap !== undefined && typeof cue.snap !== 'boolean') c.bad(`${path}.snap`, `must be true or false, got ${show(cue.snap)}`);
    const actions = ACTIONS.filter((a) => a in cue);
    if (actions.length !== 1) {
      return c.bad(path, `a cue needs exactly one of ${ACTIONS.join(', ')}; found ${actions.length ? actions.join(', ') : 'none'}`);
    }
    const action = actions[0];
    c.object(path, cue, ['at', 'snap', ...CUE_KEYS[action]]);
    if ('fade' in cue) c.seconds(`${path}.fade`, cue.fade);

    if (action === 'scene') {
      if (typeof cue.scene !== 'string' || !Object.hasOwn(scenes, cue.scene)) {
        c.bad(`${path}.scene`, `unknown scene ${show(cue.scene)} (scenes: ${oneOf(Object.keys(scenes))})`);
      }
      const t = cue.transition;
      if (t !== undefined && c.object(`${path}.transition`, t, ['kind', 'duration'])) {
        c.member(`${path}.transition.kind`, t.kind, ['cut', 'blend'], 'transition');
        if (t.duration !== undefined) c.seconds(`${path}.transition.duration`, t.duration, MAX_BLEND);
      }
    } else if (action === 'enter') {
      const id = c.spec(`${path}.enter`, cue.enter);
      if (id !== null) known.add(id);
    } else if (action === 'exit') {
      if (typeof cue.exit !== 'string' || !known.has(cue.exit)) {
        c.bad(`${path}.exit`, `${show(cue.exit)} is in no scene and was not entered by an earlier cue`);
      }
    } else if (action === 'accent') {
      const a = cue.accent;
      if (c.object(`${path}.accent`, a, ['kind', 'color', 'strength'])) {
        c.member(`${path}.accent.kind`, a.kind, ACCENTS, 'accent');
        if (a.color !== undefined) c.hex(`${path}.accent.color`, a.color);
        if (a.strength !== undefined) c.unit(`${path}.accent.strength`, a.strength);
      }
    } else {
      const r = cue.ramp;
      if (c.object(`${path}.ramp`, r, ['target', 'to', 'duration'])) {
        const msg = rampTargetProblem(r.target, known);
        if (msg) c.bad(`${path}.ramp.target`, msg);
        c.unit(`${path}.ramp.to`, r.to);
        c.seconds(`${path}.ramp.duration`, r.duration);
      }
    }
  });
  return finish(c, json);
}

function finish(c: Checker, json: Obj): { ok: true; script: Script } | { ok: false; errors: string[] } {
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, script: json as unknown as Script };
}

/** Why a ramp target can't be ramped, or null when it can. */
function rampTargetProblem(target: unknown, known: Set<string>): string | null {
  const expected = `expected "look.${RAMP_LOOK.join('" | "look.')}" or "<elementId>.${RAMP_ELEMENT.join('" | "<elementId>.')}"`;
  if (typeof target !== 'string') return `${expected}, got ${show(target)}`;
  const dot = target.indexOf('.');
  const [owner, prop] = dot < 0 ? [target, ''] : [target.slice(0, dot), target.slice(dot + 1)];
  if (owner === 'look') return RAMP_LOOK.includes(prop) ? null : `"${target}" can't ramp; ${expected}`;
  if (!RAMP_ELEMENT.includes(prop)) return `"${target}" can't ramp; ${expected}`;
  if (!known.has(owner)) return `"${target}" names element "${owner}", which is in no scene and was not entered by an earlier cue`;
  return null;
}

/** An element with every param filled: DEFAULT_PARAMS under the spec's own, and the type's first style when none is given. */
export function normalizeSpec(spec: ElementSpec): CastMember['spec'] {
  const params: ElementParams = { ...DEFAULT_PARAMS };
  for (const [k, v] of Object.entries(spec.params ?? {})) if (v !== undefined) (params as unknown as Obj)[k] = v;
  if (!params.style) params.style = STYLES[spec.type][0];
  return { ...spec, params };
}

/** Elements on stage at once beyond which the picture reads as clutter. */
const MAX_ON_STAGE = 4;
/** Scene changes closer than this feel hurried. */
const MIN_SCENE_GAP = 8;

/**
 * Pacing advice for a valid script (warnings, not errors): a crowded stage,
 * hurried scene changes, cues past the end. The stage is followed cue by cue: a
 * scene cue replaces the cast with the scene's elements, `enter` adds, `exit`
 * removes (blend overlaps are transitional and not counted).
 */
export function pacingWarnings(script: Script): string[] {
  const out: string[] = [];
  const s = (t: number) => `${t.toFixed(1)} s`;
  let cast = new Set<string>();
  let crowded = false;
  let lastScene: number | null = null;
  script.timeline.forEach((cue, i) => {
    const path = `timeline[${i}]`;
    if (cue.at > script.duration) out.push(`${path}: at ${s(cue.at)} is after the end of the song (${s(script.duration)})`);
    if ('scene' in cue) {
      if (lastScene !== null && cue.at - lastScene < MIN_SCENE_GAP) {
        out.push(`${path}: scene "${cue.scene}" comes ${s(cue.at - lastScene)} after the previous scene change; let a scene breathe at least ${MIN_SCENE_GAP} s`);
      }
      lastScene = cue.at;
      cast = new Set(script.scenes[cue.scene].elements.map((e) => e.id));
    } else if ('enter' in cue) cast.add(cue.enter.id);
    else if ('exit' in cue) cast.delete(cue.exit);
    const now = cast.size > MAX_ON_STAGE;
    if (now && !crowded) {
      out.push(`${path}: ${cast.size} elements on stage at ${s(cue.at)} (${[...cast].join(', ')}); more than ${MAX_ON_STAGE} at once reads as clutter`);
    }
    crowded = now;
  });
  return out;
}
