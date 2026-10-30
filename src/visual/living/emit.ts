/**
 * Pure (GPU-free) part of the Living Canvas: turns a Material into physical
 * simulation constants, and SoundEvents / pointer strokes into splats and spark
 * bursts. Everything is a smooth function of the Material — the renderer never
 * asks "is this fire?" — so blends between archetypes look natural.
 */
import type { Gesture, Material, Rgb, SoundEvent } from '../../character/types';

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** One injection of dye + velocity. Positions in uv (0..1, y up), sizes in screen-height units. */
export interface Splat {
  x: number;
  y: number;
  /** Radii along the splat's own axes (anisotropic when they differ). */
  rx: number;
  ry: number;
  color: Rgb;
  /** Temperature injected (drives buoyancy and the blackbody glow). */
  heat: number;
  /** Directional impulse (height units / s). */
  fx: number;
  fy: number;
  /** Outward burst impulse. */
  radial: number;
  /** Rotation of the splat's axes (radians). */
  rot: number;
  /** 0 round … 1 star-shaped. */
  star: number;
  /** Number of star points. */
  points: number;
  /** 0 round … 1 square (quantized, machine-like). */
  square: number;
  /** 0 soft Gaussian … 1 crisp edge. */
  hard: number;
}

/** A burst of spark particles. */
export interface SparkBurst {
  count: number;
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  /** Random speed added in a random direction. */
  spread: number;
  color: Rgb;
  /** Size scale 0..1 (from Material.sparkSize). */
  size: number;
  /** Seconds. */
  life: number;
}

/** Quantities the renderer derives from a Material (none of them are archetype switches). */
export interface Physics {
  /** Vorticity confinement strength. */
  curl: number;
  /** Upward acceleration per unit of heat. */
  buoyancy: number;
  /** Downward acceleration per unit of dye density. */
  gravity: number;
  /** Velocity damping rate (1/s). */
  velFade: number;
  /** Neighbor-averaging of velocity per second: thick fluids lose small eddies. */
  thickness: number;
  /** Dye color fade rate (1/s). */
  dyeFade: number;
  /** Heat fade rate (1/s). */
  heatFade: number;
  /** Strength of the animated turbulent force field. */
  turbulence: number;
  /** 0..1: snap emission to a grid, square splats, axis-aligned motion. */
  grid: number;
  /** 0..1: star-shaped splats and sparks. */
  star: number;
  /** 0..1: white flash on strong onsets (dense, turbulent, non-buoyant: storms). */
  flash: number;
  /** 0..1: heat-haze distortion. */
  shimmer: number;
  /** 0..1: chromatic aberration on strong onsets. */
  aberration: number;
  /** 0..1: wet specular glints on the dye surface (non-emissive materials). */
  gloss: number;
  /** 0..1: how much onsets push outward (steady, broad) rather than in one direction. */
  radial: number;
  /** 0..1: heavy material heaves up from below before sinking back. */
  heave: number;
  /**
   * Brightness of injected dye. Slow-fading materials inject less per splat (so they
   * build up instead of blowing out), and hot materials show their temperature
   * rather than their pigment.
   */
  pigment: number;
  /** Soft ceiling for accumulated dye. */
  cap: number;
  /** Mean dye brightness the canvas may hold before fading faster. */
  budget: number;
  /** Advection sharpness 0..0.5 (MacCormack correction). */
  sharp: number;
  /** 0..1: dye is lit from above and shadows itself (massive, volumetric forms). */
  shade: number;
}

export function physics(m: Material): Physics {
  const dyeFade = mix(0.04, 2.6, Math.pow(m.dyeFade, 1.6));
  // Crisp, steady and not glittery. Real machine blends from the engine sit around
  // jitter 0.3 (its per-axis modulation adds some), so the grid must survive that;
  // erratic materials (storm, fire) lose it, and so do twinkly ones (sugar is crisp
  // and fairly steady too, but it sparkles rather than pulses).
  const grid = smoothstep(0.6, 0.85, m.angularity) * (1 - smoothstep(0.3, 0.6, m.jitter)) *
    (1 - smoothstep(0.55, 0.85, m.twinkle));
  return {
    curl: 4 + 32 * Math.pow(m.vorticity, 1.3),
    buoyancy: 7 * m.buoyancy,
    gravity: 2.2 * m.gravity,
    velFade: mix(0.25, 3.2, m.viscosity * m.viscosity),
    // A little smoothing always: it damps grid-scale noise from strong confinement.
    thickness: mix(2, 14, m.viscosity * m.viscosity),
    dyeFade,
    heatFade: mix(0.3, 3.5, m.dyeFade) + 1.5 * m.buoyancy,
    turbulence: m.jitter * (0.15 + 0.85 * m.vorticity) * 1.6,
    grid,
    // Erratic angular materials break into shards rather than tidy stars.
    star: smoothstep(0.3, 0.9, m.angularity) * (1 - grid) * (1 - 0.75 * smoothstep(0.5, 0.9, m.jitter)),
    flash: smoothstep(0.5, 0.9, m.vorticity) * smoothstep(0.35, 0.8, m.jitter) * (1 - m.buoyancy),
    shimmer: m.buoyancy * (0.3 + 0.7 * m.vorticity),
    aberration: m.jitter * m.vorticity,
    gloss: (1 - m.emissive) * m.contrast * smoothstep(0.3, 0.9, m.viscosity),
    radial: (1 - m.jitter) * (1 - m.buoyancy) * (1 - grid * 0.7),
    heave: m.gravity * (1 - m.buoyancy),
    pigment: (0.35 + 0.5 * Math.sqrt(dyeFade)) * (1 - 0.7 * m.buoyancy),
    cap: 0.5 + 1.5 * m.emissive,
    budget: 0.25 + 0.4 * m.splatSize + 0.2 * (1 - m.dyeFade),
    // (Full sharpening under violent turbulence shreds dye into pixel noise.)
    sharp: 0.5 * mix(0.25, 1, Math.max(m.angularity, m.contrast, m.vorticity)) * (1 - 0.6 * m.jitter * m.vorticity),
    shade: (1 - m.emissive) * smoothstep(0.2, 0.8, m.gravity * 0.5 + m.viscosity * 0.5) * (0.4 + 0.6 * m.contrast),
  };
}

/** Splat radius in height units: tiny pin-pricks to huge blobs. */
export const splatRadius = (m: Material, strength: number) =>
  mix(0.006, 0.17, Math.pow(m.splatSize, 1.4)) * (0.45 + 0.85 * strength);

/** Emission speed in height units / s. */
export const splatSpeed = (m: Material, strength: number) => mix(0.08, 2.4, m.splatForce) * (0.25 + strength);

/**
 * Event color pulled halfway into the material's palette (strong events toward the
 * highlight stop), so the material's colors dominate and the note still tints.
 */
export function tint(c: Rgb, m: Material, strength: number, gain: number): Rgb {
  const p = m.palette;
  const t = clamp01(strength);
  // A grey palette (lament) also greys the notes: scale their chroma to the palette's.
  const chroma = (q: Rgb) => (Math.max(...q) - Math.min(...q)) / Math.max(1e-3, Math.max(...q));
  const keep = Math.min(1, Math.max(0.2, Math.max(chroma(p[2]), chroma(p[3])) * 1.5));
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const out: Rgb = [0, 0, 0];
  // Luminous materials show the sound's colors; dull ones stay in their own palette.
  const own = 0.55 + 0.35 * (1 - m.emissive);
  for (let i = 0; i < 3; i++) out[i] = mix(l + (c[i] - l) * keep, mix(p[2][i], p[3][i], t), own) * gain;
  return out;
}

/** Grid columns used when emission is quantized. */
const GRID = 10;

export interface Emitted {
  splats: Splat[];
  sparks: SparkBurst[];
  /** Strongest onset this frame (for flashes / aberration). */
  hit: number;
  /** Onsets that keep emitting for a moment (see Sources). */
  sources: { splat: Splat; life: number }[];
}

/** How long an onset keeps feeding the fluid: hot material burns on as a licking tongue. */
export const sourceLife = (m: Material) => 0.12 + 0.65 * m.buoyancy + 0.4 * m.gravity * m.viscosity;

/**
 * Short-lived emitters left behind by onsets. Each frame they feed a flickering
 * fraction of their splat back in, so sustained emission makes plumes and flame
 * tongues instead of single puffs.
 */
export class Sources {
  private list: { s: Splat; age: number; life: number }[] = [];

  add(splat: Splat, life: number) {
    if (life < 0.05) return;
    if (this.list.length >= 48) this.list.shift();
    this.list.push({ s: splat, age: 0, life });
  }

  clear() {
    this.list.length = 0;
  }

  get size() {
    return this.list.length;
  }

  tick(dt: number, flicker: number, rand: () => number): Splat[] {
    const out: Splat[] = [];
    for (const src of this.list) {
      src.age += dt;
      const k = Math.max(0, 1 - src.age / src.life);
      const f = 1 - flicker * rand() * 0.8;
      const a = k * f * dt * 4;
      const s = src.s;
      const w = 0.45 + 0.4 * rand() * flicker + 0.2;
      out.push({
        ...s,
        x: s.x + (rand() - 0.5) * s.rx * 0.6 * flicker,
        rx: s.rx * w,
        ry: s.ry * w,
        color: [s.color[0] * a, s.color[1] * a, s.color[2] * a],
        heat: s.heat * a * 1.4,
        fx: s.fx * a * 3,
        fy: s.fy * a * 3,
        radial: 0,
      });
    }
    this.list = this.list.filter((src) => src.age < src.life);
    return out;
  }
}

/**
 * Turns this frame's sound events into splats and spark bursts.
 * `aspect` = width / height; `rand` returns 0..1 (seedable for tests).
 *
 * Onsets inject a full splat. Sustained events (onset = false) are continuous
 * emission: their size follows their strength, but the amount injected is scaled by
 * `dt`, so it doesn't depend on the frame rate. Sparse senders go through `Sustain`
 * first, which holds each tick until the next.
 */
export function emitEvents(
  events: SoundEvent[], m: Material, g: Gesture, aspect: number, rand: () => number, dt = 1 / 60,
): Emitted {
  const ph = physics(m);
  const out: Emitted = { splats: [], sparks: [], hit: 0, sources: [] };
  for (const e of events) {
    const s = clamp01(e.strength) * (e.onset ? 1 : 0.6);
    // Sustained emission rate follows the fade rate, so held notes build to a similar
    // level whatever the material (instead of saturating slow-fading ones).
    const amt = e.onset ? 1 : Math.min(1, dt * (0.3 + 1.2 * ph.dyeFade));
    if (s <= 0.01) continue;
    if (e.onset) out.hit = Math.max(out.hit, s);
    const j = m.jitter;
    // Low notes low, high notes high; pan across; the gesture wanders the emitter.
    let x = 0.5 + e.pan * 0.38 + g.x * 0.12 + (rand() - 0.5) * j * 0.5;
    let y = 0.07 + clamp01(e.height) * 0.84 + g.y * 0.06 + (rand() - 0.5) * j * 0.22;
    if (ph.grid > 0) {
      const cols = GRID;
      const rows = Math.max(3, Math.round(GRID / aspect));
      x = mix(x, (Math.round(x * cols - 0.5) + 0.5) / cols, ph.grid);
      y = mix(y, (Math.round(y * rows - 0.5) + 0.5) / rows, ph.grid);
    }
    if (!e.onset) {
      // Sustained emission paints an area, not a point.
      const r0 = splatRadius(m, s);
      x += ((rand() - 0.5) * r0 * 1.6) / aspect;
      y += (rand() - 0.5) * r0 * 1.6;
    }
    x = Math.min(0.98, Math.max(0.02, x));
    y = Math.min(0.97, Math.max(0.03, y));

    // Direction: the gesture's angle, pulled upward by buoyancy (and by the heave of heavy
    // material rising from below), scattered by jitter, snapped to an axis on a grid.
    let a = g.angle + (rand() - 0.5) * j * Math.PI * 1.6;
    let dx = Math.cos(a);
    let dy = Math.sin(a);
    const up = clamp01(m.buoyancy * 1.2 + ph.heave * (1 - e.height) * 1.1);
    dx = mix(dx, 0, up);
    dy = mix(dy, 1, up);
    if (ph.grid > 0) {
      const ax = Math.abs(dx) > Math.abs(dy);
      dx = mix(dx, ax ? Math.sign(dx) : 0, ph.grid);
      dy = mix(dy, ax ? 0 : Math.sign(dy), ph.grid);
    }
    const len = Math.hypot(dx, dy) || 1;
    a = Math.atan2(dy, dx);
    const speed = splatSpeed(m, s);
    const r = splatRadius(m, s);
    // Erratic materials stretch splats into shards along their motion.
    const stretch = 1 + j * m.angularity * 2.2 * rand();
    out.splats.push({
      x, y,
      rx: r * stretch,
      ry: r / Math.sqrt(stretch),
      color: tint(e.color, m, s, ph.pigment * amt),
      heat: m.buoyancy * s * 3 * amt,
      // Grids pulse in place rather than shove the fluid around.
      fx: (dx / len) * speed * amt * (1 - ph.radial * 0.6) * (1 - ph.grid * 0.75),
      fy: (dy / len) * speed * amt * (1 - ph.radial * 0.6) * (1 - ph.grid * 0.75),
      // Onsets burst outward; sustained notes pour rather than inflate.
      radial: speed * amt * ph.radial * (e.onset ? 0.9 : 0.15),
      rot: a,
      star: ph.star,
      points: 4 + Math.round(rand() * 3),
      square: ph.grid,
      hard: m.angularity,
    });
    if (e.onset) out.sources.push({ splat: out.splats[out.splats.length - 1], life: sourceLife(m) * (0.6 + 0.6 * s) });

    // Fractional counts round randomly, so slow continuous emission still sparkles.
    const n = Math.floor(Math.pow(m.sparkAmount, 1.6) * (e.onset ? 3 + 60 * s : 30 * s * amt) + rand());
    if (n > 0) {
      out.sparks.push({
        count: n, x, y,
        radius: r * 0.8,
        vx: (dx / len) * speed * 0.6,
        vy: (dy / len) * speed * 0.6,
        // Hot sparks drift up lazily; cold ones scatter.
        spread: (0.1 + speed * (0.3 + j * 0.8)) * (1 - 0.6 * m.buoyancy),
        color: tint(e.color, m, 1, 1),
        size: m.sparkSize,
        life: mix(0.25, 4.5, m.sparkLife),
      });
    }
  }
  return out;
}

/**
 * Painting with the pointer: splats along the stroke since the last frame so fast
 * drags draw continuous ribbons, pushing the fluid the way the hand moves.
 */
export function emitStroke(
  from: { x: number; y: number }, to: { x: number; y: number }, vel: { x: number; y: number },
  m: Material, color: Rgb, aspect: number, rand: () => number,
): Emitted {
  const out: Emitted = { splats: [], sparks: [], hit: 0, sources: [] };
  const r = mix(0.012, 0.045, m.splatSize);
  const dist = Math.hypot((to.x - from.x) * aspect, to.y - from.y);
  const steps = Math.min(24, Math.max(1, Math.ceil(dist / (r * 0.6))));
  const speed = Math.hypot(vel.x, vel.y);
  const push = 0.55 + m.splatForce * 0.6;
  for (let i = 1; i <= steps; i++) {
    const u = i / steps;
    out.splats.push({
      // A little wobble keeps strokes from looking machine-drawn.
      x: mix(from.x, to.x, u) + (rand() - 0.5) * r * 0.3 / aspect, y: mix(from.y, to.y, u) + (rand() - 0.5) * r * 0.3, rx: r, ry: r,
      color: [color[0] * 0.55, color[1] * 0.55, color[2] * 0.55],
      heat: m.buoyancy * 0.6 / steps,
      fx: vel.x * push, fy: vel.y * push, radial: 0, rot: 0,
      star: 0, points: 5, square: 0, hard: 0.2,
    });
  }
  const n = Math.round(m.sparkAmount * Math.min(40, 4 + speed * 12));
  if (n > 0) {
    out.sparks.push({
      count: n, x: to.x, y: to.y, radius: r, vx: vel.x * 0.3, vy: vel.y * 0.3, spread: 0.15 + speed * 0.15,
      color, size: m.sparkSize, life: mix(0.3, 3, m.sparkLife),
    });
  }
  return out;
}

/** The Material's scalar fields (everything but the palette). */
export const MATERIAL_KEYS = [
  'buoyancy', 'gravity', 'vorticity', 'viscosity', 'dyeFade', 'splatSize', 'splatForce', 'jitter', 'sparkAmount',
  'sparkSize', 'sparkLife', 'twinkle', 'angularity', 'emissive', 'contrast', 'grain', 'aura',
] as const;

const fin = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const clampTo = (v: unknown, lo: number, hi: number, fallback: number) => Math.min(hi, Math.max(lo, fin(v, fallback)));

/**
 * A finite, in-range copy of a Material. One NaN from upstream would otherwise
 * stick in the eased material forever (x += (NaN − x)·k) and black out the GPU
 * fields for good, so bad values fall back to the previous good ones.
 */
export function cleanMaterial(m: Material, prev: Material | null): Material {
  const out = {} as Record<string, number>;
  const src = m as unknown as Record<string, unknown>;
  const old = prev as unknown as Record<string, number> | null;
  for (const k of MATERIAL_KEYS) out[k] = clampTo(src[k], 0, 1, old ? old[k] : 0.5);
  const palette = [0, 1, 2, 3].map((i) =>
    [0, 1, 2].map((c) => clampTo(m.palette?.[i]?.[c], 0, 4, prev ? prev.palette[i][c] : 0.1 + 0.25 * i)),
  ) as Material['palette'];
  return { ...(out as unknown as Omit<Material, 'palette'>), palette };
}

/** A finite, in-range copy of a SoundEvent, or null when it can't be salvaged. */
export function cleanEvent(e: SoundEvent): SoundEvent | null {
  const strength = clampTo(e?.strength, 0, 1, 0);
  if (!(strength > 0)) return null;
  const c = e.color;
  return {
    height: clampTo(e.height, 0, 1, 0.5), pan: clampTo(e.pan, -1, 1, 0), strength, note: fin(e.note, -1),
    color: [clampTo(c?.[0], 0, 4, 0.5), clampTo(c?.[1], 0, 4, 0.5), clampTo(c?.[2], 0, 4, 0.5)], onset: !!e.onset,
  };
}

/** A finite, in-range copy of a Gesture. */
export function cleanGesture(g: Gesture): Gesture {
  const x = g?.extra;
  return {
    x: clampTo(g?.x, -1, 1, 0), y: clampTo(g?.y, -1, 1, 0), angle: fin(g?.angle, 0) % (Math.PI * 64),
    swirl: clampTo(g?.swirl, -1, 1, 0), breath: clampTo(g?.breath, 0, 1, 0.5),
    extra: [clampTo(x?.[0], -1, 1, 0), clampTo(x?.[1], -1, 1, 0), clampTo(x?.[2], -1, 1, 0), clampTo(x?.[3], -1, 1, 0)],
  };
}

/**
 * Sustained events (onset = false) arrive either every frame while a note is held,
 * or as sparse ticks (the character engine sends a few per second). Each batch is
 * held and re-emitted every frame until the next one is due, so both kinds of
 * sender paint the same continuous stream instead of sparse ticks fading to nothing.
 */
export class Sustain {
  private held: SoundEvent[] = [];
  private left = 0;
  private since = 0;
  /** Smoothed time between batches (seconds). */
  interval = 1 / 60;

  /** Takes this frame's sustained events; returns the ones to emit this frame. */
  update(events: SoundEvent[], dt: number): SoundEvent[] {
    this.since += dt;
    if (events.length) {
      const gap = Math.min(0.5, this.since);
      this.interval += (gap - this.interval) * 0.35;
      this.since = 0;
      this.held = events;
      // A little overlap so jittery tick timing doesn't leave gaps.
      this.left = Math.min(0.5, Math.max(dt, this.interval * 1.2));
    }
    if (this.left <= 0) return [];
    this.left -= dt;
    return this.held;
  }

  clear() {
    this.held = [];
    this.left = 0;
  }
}

/** Small seeded PRNG (mulberry32) so tests and screenshots are repeatable. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
