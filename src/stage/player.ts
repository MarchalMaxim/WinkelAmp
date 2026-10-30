/**
 * ScriptPlayer: song time → what the stage shows, for a composed script.
 *
 * `at(t)` folds every cue up to `t` from scratch, so it is a pure function of
 * song time: a seek, a pause or a jump back lands on exactly what the script
 * says there, with no stale elements and no replayed accents. A concerto's few
 * hundred cues fold in microseconds, so there is no cache to invalidate.
 *
 * Everything that changes over time is a glide (a number moving linearly from
 * where it was to a target) or a switch (a discrete value that changes at an
 * instant). A cue starts a new glide from the value at the cue's time, so cues
 * that interrupt each other (an exit mid-fade-in, a scene change mid-ramp)
 * continue smoothly instead of jumping.
 */
import { normalizeSpec } from './script';
import {
  DEFAULT_LOOK,
  type Accent,
  type CastMember,
  type Cue,
  type Look,
  type Script,
  type SongData,
  type StageDirectives,
} from './types';

/** A cue lands on an onset or beat this close to its written time (seconds). */
const SNAP_WINDOW = 0.12;
const BLEND_DEFAULT = 1.5;
/** Musically triggered transitions finish within 2 s (the global transition rule). */
const BLEND_MAX = 2;
const ENTER_FADE = 0.8;
const EXIT_FADE = 1.2;
/** How long an accent stays listed; the compositor shapes it over this age. */
const ACCENT_LIFE = 1.5;

type Spec = CastMember['spec'];
type AccentCue = Extract<Cue, { accent: unknown }>['accent'];

/** A number moving linearly from `from` (at `t0`) to `to` over `d` seconds; instant when `d` is 0. */
interface Glide {
  t0: number;
  from: number;
  to: number;
  d: number;
}
const steady = (v: number): Glide => ({ t0: 0, from: v, to: v, d: 0 });
function glideAt(g: Glide, t: number): number {
  if (t <= g.t0) return g.d > 0 ? g.from : g.to;
  if (g.d <= 0 || t >= g.t0 + g.d) return g.to;
  return g.from + ((g.to - g.from) * (t - g.t0)) / g.d;
}
const glideTo = (g: Glide, t: number, to: number, d: number): Glide => ({ t0: t, from: glideAt(g, t), to, d: Math.max(0, d) });

/** A discrete value that becomes `after` at time `at`. */
interface Switch<T> {
  before: T;
  after: T;
  at: number;
}
const switchAt = <T>(s: Switch<T>, t: number): T => (t < s.at ? s.before : s.after);
const switchTo = <T>(s: Switch<T>, t: number, v: T, at: number): Switch<T> => ({ before: switchAt(s, t), after: v, at });

/** One element on stage. Its numeric params glide; the rest of its spec switches. */
interface Member {
  presence: Glide;
  spec: Switch<Spec>;
  intensity: Glide;
  size: Glide;
  /** A type change under the same id: presence dips to 0 at `mid` (where the type switches) and back. */
  dip?: { mid: number; half: number };
}

interface LookState {
  /** Palette and mirror (discrete) come from here; the numbers from the glides. */
  base: Switch<Look>;
  trails: Glide;
  warp: Glide;
  glow: Glide;
}
const LOOK_GLIDES = ['trails', 'warp', 'glow'] as const;

/** The fold's working state; built fresh by every `at()` call. */
interface State {
  scene: string;
  look: LookState;
  stage: Map<string, Member>;
}

function newMember(spec: Spec, t: number, fade: number): Member {
  return {
    presence: { t0: t, from: 0, to: 1, d: Math.max(0, fade) },
    spec: { before: spec, after: spec, at: t },
    intensity: steady(spec.params.intensity),
    size: steady(spec.params.size),
  };
}

function presenceAt(m: Member, t: number): number {
  let p = glideAt(m.presence, t);
  if (m.dip && t >= m.dip.mid - m.dip.half && t < m.dip.mid + m.dip.half) p *= Math.abs(t - m.dip.mid) / m.dip.half;
  return Math.min(1, Math.max(0, p));
}

/** Gone: faded all the way out by `t`. */
const gone = (m: Member, t: number) => m.presence.to === 0 && (m.presence.d <= 0 || t >= m.presence.t0 + m.presence.d);

/**
 * `m` stays on stage under a new spec (a scene that keeps its id, or an `enter`
 * of an id already there): presence heads back to 1 if it was leaving, numbers
 * glide to the new values over `d`, everything else switches half-way. A new
 * type under the same id is a different picture, so it dips out and back in
 * around that switch rather than popping.
 */
function restyle(m: Member, spec: Spec, t: number, d: number): void {
  if (m.presence.to !== 1) m.presence = glideTo(m.presence, t, 1, d);
  const mid = t + d / 2;
  if (d > 0 && switchAt(m.spec, t).type !== spec.type) m.dip = { mid, half: d / 2 };
  m.spec = switchTo(m.spec, t, spec, mid);
  m.intensity = glideTo(m.intensity, t, spec.params.intensity, d);
  m.size = glideTo(m.size, t, spec.params.size, d);
}

/** '#rgb' / '#rrggbb' → RGB 0..1. */
function rgb(hex: string): [number, number, number] {
  const h = hex.length === 4 ? hex.slice(1).replace(/./g, (c) => c + c) : hex.slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

export class ScriptPlayer {
  /** Cue times after snapping, indexed like `script.timeline` (for the preview tool and tests). */
  readonly cueTimes: number[];
  /** Timeline indices in the order they apply: by snapped time, ties in timeline order. */
  private readonly order: number[];
  private readonly scenes: Record<string, { look: Look; elements: Spec[] }> = {};

  constructor(
    private readonly script: Script,
    data?: SongData,
  ) {
    const grid = data ? [...data.onsets.map((o) => o.t), ...data.beats].sort((a, b) => a - b) : [];
    this.cueTimes = script.timeline.map((c) => (c.snap === false ? c.at : snap(c.at, grid)));
    this.order = script.timeline.map((_, i) => i).sort((a, b) => this.cueTimes[a] - this.cueTimes[b] || a - b);
    for (const [name, def] of Object.entries(script.scenes)) {
      this.scenes[name] = { look: { ...DEFAULT_LOOK, ...def.look }, elements: def.elements.map(normalizeSpec) };
    }
  }

  /** Pure: the same `t` always gives the same directives. `t` is song time in seconds. */
  at(t: number): StageDirectives {
    const s: State = {
      scene: '',
      look: { base: { before: DEFAULT_LOOK, after: DEFAULT_LOOK, at: 0 }, trails: steady(DEFAULT_LOOK.trails), warp: steady(DEFAULT_LOOK.warp), glow: steady(DEFAULT_LOOK.glow) },
      stage: new Map(),
    };
    const accents: Accent[] = [];
    for (const i of this.order) {
      const c = this.cueTimes[i];
      if (c > t) break;
      for (const [id, m] of s.stage) if (gone(m, c)) s.stage.delete(id);
      const cue = this.script.timeline[i];
      if ('accent' in cue) {
        if (t - c < ACCENT_LIFE) accents.push(accent(cue.accent, t - c));
      } else this.apply(s, cue, c);
    }

    const cast: CastMember[] = [];
    for (const m of s.stage.values()) {
      if (gone(m, t)) continue;
      const spec = switchAt(m.spec, t);
      cast.push({
        spec: { ...spec, params: { ...spec.params, intensity: glideAt(m.intensity, t), size: glideAt(m.size, t) } },
        presence: presenceAt(m, t),
      });
    }
    const base = switchAt(s.look.base, t);
    const look: Look = {
      ...base,
      palette: Array.isArray(base.palette) ? [...base.palette] : base.palette,
      trails: glideAt(s.look.trails, t),
      warp: glideAt(s.look.warp, t),
      glow: glideAt(s.look.glow, t),
    };
    return { source: 'scripted', scene: s.scene, look, cast, accents };
  }

  /** Applies one non-accent cue at its (snapped) time `c`. */
  private apply(s: State, cue: Cue, c: number): void {
    if ('scene' in cue) {
      const scene = this.scenes[cue.scene];
      const d = cue.transition?.kind === 'cut' ? 0 : Math.min(BLEND_MAX, cue.transition?.duration ?? BLEND_DEFAULT);
      s.scene = cue.scene;
      const ids = new Set(scene.elements.map((e) => e.id));
      for (const [id, m] of s.stage) {
        if (ids.has(id)) continue;
        if (d > 0) m.presence = glideTo(m.presence, c, 0, d);
        else s.stage.delete(id);
      }
      for (const spec of scene.elements) {
        const m = s.stage.get(spec.id);
        if (m) restyle(m, spec, c, d);
        else s.stage.set(spec.id, newMember(spec, c, d));
      }
      s.look.base = switchTo(s.look.base, c, scene.look, c + d / 2);
      for (const k of LOOK_GLIDES) s.look[k] = glideTo(s.look[k], c, scene.look[k], d);
    } else if ('enter' in cue) {
      const spec = normalizeSpec(cue.enter);
      const fade = cue.fade ?? ENTER_FADE;
      const m = s.stage.get(spec.id);
      if (m) restyle(m, spec, c, fade);
      else s.stage.set(spec.id, newMember(spec, c, fade));
    } else if ('exit' in cue) {
      // Snapping can move an exit before its enter; an id not on stage is then simply not there to leave.
      const m = s.stage.get(cue.exit);
      const fade = cue.fade ?? EXIT_FADE;
      if (m && fade > 0) m.presence = glideTo(m.presence, c, 0, fade);
      else s.stage.delete(cue.exit);
    } else if ('ramp' in cue) {
      const { target, to, duration } = cue.ramp;
      const [owner, prop] = target.split('.');
      if (owner === 'look') {
        const k = prop as (typeof LOOK_GLIDES)[number];
        s.look[k] = glideTo(s.look[k], c, to, duration);
      } else {
        const m = s.stage.get(owner);
        const k = prop as 'intensity' | 'size';
        if (m) m[k] = glideTo(m[k], c, to, duration);
      }
    }
  }
}

/** `at` moved to the nearest point of the sorted `grid` within SNAP_WINDOW (ties go earlier), or `at` itself. */
function snap(at: number, grid: number[]): number {
  let lo = 0;
  let hi = grid.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (grid[mid] < at) lo = mid + 1;
    else hi = mid;
  }
  let best = at;
  let bestDist = SNAP_WINDOW + 1e-9;
  for (const j of [lo - 1, lo]) {
    if (j < 0 || j >= grid.length) continue;
    const dist = Math.abs(grid[j] - at);
    if (dist < bestDist) {
      best = grid[j];
      bestDist = dist;
    }
  }
  return best;
}

function accent(a: AccentCue, age: number): Accent {
  return { kind: a.kind, color: a.color ? rgb(a.color) : [1, 1, 1], strength: a.strength ?? 1, age };
}
