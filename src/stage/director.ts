/**
 * LiveDirector: the show when no script runs (mic, MIDI, a song not in the
 * corpus). It picks a library scene that fits the mood, changes scene on the
 * music's big changes, and lets each element appear only while the music has
 * the stream it follows.
 *
 *   scene:    best affinity with the character's archetype blend; on a change
 *             (ChangeDetector) the best one other than the current: a drop cuts,
 *             a section blends over 1.5 s. A mood that takes the lead for good
 *             (8 s, after 60 s without a change) also moves the show on.
 *   presence: scene weight (the blend) × the element's stream, smoothed over ~1 s.
 *
 * Changes are at least 15 s apart (counted here too, not only in ChangeDetector),
 * which is far longer than a blend, so two transitions never overlap.
 *
 * The stage holds at most 5 elements. Scenes have at most 4, but a blend between
 * two that share little holds both casts at once; then the newcomers that fit
 * least wait for the leavers to go and fade in right after (0.5 s), so nothing
 * pops in or out and the change still ends within 2 s.
 */
import { mulberry32 } from '../audio/instruments';
import type { Character } from '../character/types';
import { LIBRARY, type LibraryScene } from './library';
import { normalizeSpec } from './script';
import { DEFAULT_LOOK, type CastMember, type ElementType, type Look, type StageDirectives } from './types';

/** What the music offers right now, each 0..1: the casting reads these. */
export interface Streams {
  /** Fraction of the last 2 s with a voiced melody. */
  melodyVoiced: number;
  /** Bass level. */
  bass: number;
  /** Descriptors.pulseClarity. */
  pulse: number;
  /** High-register onset activity. */
  highActivity: number;
}

export type Change = { kind: 'section' | 'drop'; strength: number };

/** No two scene changes closer than this (seconds). */
const MIN_GAP = 15;
const BLEND = 1.5;
/** A newcomer held back by the cast limit fades in over this once the blend ends. */
const LATE_FADE = 0.5;
/** Element presence follows its stream with this time constant (seconds). */
const STREAM_TAU = 1;
/** A new leading mood changes the scene by itself only after this long without a change… */
const QUIET = 60;
/** …and once it has led this long. */
const LEADER_HOLD = 8;
/** The stage never holds more than this many elements, mid-blend included. */
const MAX_CAST = 5;
/** Scores this close are a tie (broken by the seeded PRNG). */
const TIE = 1e-9;
const MELODY_GATE = 0.4;
const PULSE_GATE = 0.35;

type Spec = CastMember['spec'];

interface Member {
  spec: Spec;
  /** The spec it had before the current transition (a type both scenes share), for gliding its params. */
  from?: Spec;
  /** Where it stands in the transition: entering, leaving, in both scenes, or waiting for room (the cast limit). */
  role: 'in' | 'out' | 'both' | 'late';
  /** Time its own fade-in started (a newcomer that waited for room); cleared once in. */
  late?: number;
  /** Smoothed stream gate, 0..1. */
  stream: number;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const fin = (x: number) => (Number.isFinite(x) ? x : 0);

/** How much of its stream an element type has now (its presence target). */
function want(type: ElementType, s: Streams): number {
  switch (type) {
    case 'melody':
      return fin(s.melodyVoiced) > MELODY_GATE ? 1 : 0;
    case 'pulse':
      return fin(s.pulse) > PULSE_GATE ? 1 : 0;
    case 'sparks':
      return clamp01(fin(s.highActivity));
    case 'bass':
      return clamp01(fin(s.bass));
    // Fluid and bloom carry the mood and the harmony; the wave is the sound itself. The clock dims silence.
    default:
      return 1;
  }
}

/** How well `scene` suits the character's archetype blend. */
function score(scene: LibraryScene, c: Character): number {
  let s = 0;
  for (const { id, weight } of c.blend) s += weight * (scene.affinity[id] ?? 0);
  return s;
}

const sceneLook = (s: LibraryScene): Look => ({ ...DEFAULT_LOOK, ...s.look });

export class LiveDirector {
  private rand: () => number;
  private scene: LibraryScene | null = null;
  private members = new Map<string, Member>();
  /** The transition in progress: its look endpoints, length (0 = done) and elapsed seconds. */
  private fromLook: Look = DEFAULT_LOOK;
  private toLook: Look = DEFAULT_LOOK;
  private fadeD = 0;
  private fadeT = 0;
  /** Seconds since the first update, and when the current scene was chosen. */
  private time = 0;
  private lastSwitch = 0;
  /** The leading archetype now, how long it has led, and the one leading when the scene was chosen. */
  private leader: string | undefined;
  private leaderHeld = 0;
  private sceneLeader: string | undefined;

  constructor(private readonly seed = 1) {
    this.rand = mulberry32(seed);
  }

  /**
   * One frame. `dt` is wall seconds (blends must finish in ≤ 2 s of real time);
   * like ChangeDetector, do not call it while paused or in silence, or the
   * presences and the 60 s timer run on without the music. `change` is what
   * ChangeDetector reported this frame.
   */
  update(c: Character, streams: Streams, change: Change | null, dt: number): StageDirectives {
    dt = dt > 0 && Number.isFinite(dt) ? dt : 0;
    this.time += dt;
    const lead = c.blend[0]?.id;
    if (lead !== this.leader) {
      this.leader = lead;
      this.leaderHeld = 0;
    } else this.leaderHeld += dt;

    // Follow the streams and the transition so far; a switch this frame starts from here.
    const a = 1 - Math.exp(-dt / STREAM_TAU);
    for (const m of this.members.values()) m.stream += (want(m.spec.type, streams) - m.stream) * a;
    this.fadeT += dt;
    if (this.fadeD > 0 && this.fadeT >= this.fadeD) this.settle();

    if (!this.scene) this.switchTo(this.pick(c, null), 0, streams);
    else if (this.time - this.lastSwitch >= MIN_GAP) {
      const restless = this.time - this.lastSwitch >= QUIET && this.leader !== this.sceneLeader && this.leaderHeld >= LEADER_HOLD;
      if (change) this.switchTo(this.pick(c, this.scene), change.kind === 'drop' ? 0 : BLEND, streams);
      else if (restless) this.switchTo(this.pick(c, this.scene), BLEND, streams);
    }
    return this.directives();
  }

  /** Forget everything (a new track): the next update picks afresh, with the PRNG re-seeded. */
  reset(): void {
    this.rand = mulberry32(this.seed);
    this.scene = null;
    this.members.clear();
    this.fromLook = this.toLook = DEFAULT_LOOK;
    this.fadeD = this.fadeT = 0;
    this.time = this.lastSwitch = 0;
    this.leader = this.sceneLeader = undefined;
    this.leaderHeld = 0;
  }

  /** The best-scoring scene other than `not`; ties go to the seeded PRNG. */
  private pick(c: Character, not: LibraryScene | null): LibraryScene {
    let best: LibraryScene[] = [];
    let top = -Infinity;
    for (const s of LIBRARY) {
      if (s === not) continue;
      // A non-finite blend weight scores as nothing, so there is always a scene to pick.
      const raw = score(s, c);
      const v = Number.isFinite(raw) ? raw : -Infinity;
      if (v > top + TIE) {
        top = v;
        best = [s];
      } else if (v >= top - TIE) best.push(s);
    }
    return best.length > 1 ? best[Math.floor(this.rand() * best.length)] : best[0];
  }

  /** Starts the change to `next` over `d` seconds (0: a cut). */
  private switchTo(next: LibraryScene, d: number, streams: Streams): void {
    this.settle();
    const ids = new Set(next.elements.map((e) => e.id));
    for (const [id, m] of this.members) {
      if (ids.has(id)) continue;
      if (d > 0) m.role = 'out';
      else this.members.delete(id);
    }
    for (const e of next.elements) {
      const spec = normalizeSpec(e);
      const m = this.members.get(e.id);
      // Same id means same type (library ids are types): it stays and is restyled.
      if (m) Object.assign(m, { spec, from: d > 0 ? m.spec : undefined, role: d > 0 ? 'both' : 'in' });
      // A newcomer starts at its stream's level: the scene weight does the fading in.
      else this.members.set(e.id, { spec, role: 'in', stream: want(spec.type, streams) });
    }
    // Over the cast limit mid-blend: the newcomers with the least of their stream (then the last listed) wait.
    let excess = this.members.size - MAX_CAST;
    if (excess > 0) {
      const fresh = next.elements.map((e) => this.members.get(e.id)!).filter((m) => m.role === 'in');
      for (const m of fresh.reverse().sort((x, y) => x.stream - y.stream)) if (excess-- > 0) m.role = 'late';
    }
    this.fromLook = this.scene ? this.lookNow() : sceneLook(next);
    this.toLook = sceneLook(next);
    this.fadeD = d;
    this.fadeT = 0;
    this.scene = next;
    this.lastSwitch = this.time;
    this.sceneLeader = this.leader;
    if (d === 0) this.settle();
  }

  /** Ends the transition: leavers go, everyone else is simply in the scene. */
  private settle(): void {
    for (const [id, m] of this.members) {
      if (m.role === 'out') this.members.delete(id);
      else {
        if (m.role === 'late') m.late = this.time;
        m.role = 'in';
        m.from = undefined;
      }
    }
    this.fromLook = this.toLook;
    this.fadeD = 0;
  }

  /** Transition progress 0..1 (1 when none is running). */
  private progress(): number {
    return this.fadeD > 0 ? Math.min(1, this.fadeT / this.fadeD) : 1;
  }

  private lookNow(): Look {
    const p = this.progress();
    const [a, b] = [this.fromLook, this.toLook];
    const base = p < 0.5 ? a : b;
    return {
      ...base,
      palette: Array.isArray(base.palette) ? [...base.palette] : base.palette,
      trails: a.trails + (b.trails - a.trails) * p,
      warp: a.warp + (b.warp - a.warp) * p,
      glow: a.glow + (b.glow - a.glow) * p,
    };
  }

  private directives(): StageDirectives {
    const p = this.progress();
    const cast: CastMember[] = [];
    const leaving: CastMember[] = [];
    for (const m of this.members.values()) {
      if (m.role === 'late') continue;
      if (m.late !== undefined && this.time - m.late >= LATE_FADE) m.late = undefined;
      const weight =
        m.role === 'out' ? 1 - p
        : m.late !== undefined ? (this.time - m.late) / LATE_FADE
        : m.role === 'in' && this.fadeD > 0 ? p
        : 1;
      let spec = m.spec;
      if (m.from) {
        // A type both scenes use: numbers glide across the blend, the rest switches half-way.
        const f = m.from;
        const base = p < 0.5 ? f : spec;
        const mix = (k: 'intensity' | 'size') => f.params[k] + (spec.params[k] - f.params[k]) * p;
        spec = { ...base, params: { ...base.params, intensity: mix('intensity'), size: mix('size') } };
      } else spec = { ...spec, params: { ...spec.params } };
      (m.role === 'out' ? leaving : cast).push({ spec, presence: clamp01(weight * m.stream) });
    }
    // Late newcomers keep this within the limit; the slice is only a guard.
    cast.push(...leaving);
    cast.length = Math.min(cast.length, MAX_CAST);
    return { source: 'live', scene: this.scene?.name ?? '', look: this.lookNow(), cast, accents: [] };
  }
}
