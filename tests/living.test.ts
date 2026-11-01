import { describe, expect, it } from 'vitest';
import type { Gesture, Material, SoundEvent } from '../src/character/types';
import {
  cleanEvent, cleanGesture, cleanMaterial, emitEvents, emitStroke, physics, rng, Sources, splatRadius, Sustain, tint,
} from '../src/visual/living/emit';
import { LEVELS, QualityController } from '../src/visual/living/quality';

const base: Material = {
  buoyancy: 0.5, gravity: 0.5, vorticity: 0.5, viscosity: 0.5, dyeFade: 0.5, splatSize: 0.5, splatForce: 0.5,
  jitter: 0.5, sparkAmount: 0.5, sparkSize: 0.5, sparkLife: 0.5, twinkle: 0.5, angularity: 0.5, emissive: 0.5,
  contrast: 0.5, grain: 0.5, aura: 0.5,
  palette: [[0, 0, 0], [0.2, 0.1, 0.3], [0.8, 0.4, 0.2], [1, 0.9, 0.7]],
};
const mat = (p: Partial<Material>): Material => ({ ...base, ...p });
const still: Gesture = { x: 0, y: 0, angle: 0, swirl: 0, breath: 0.5, extra: [0, 0, 0, 0] };
const ev = (p: Partial<SoundEvent>): SoundEvent => ({ height: 0.5, pan: 0, strength: 0.8, note: 0, color: [1, 0, 0], onset: true, ...p });

/** Frames of a given duration until the controller changes level (or gives up). */
function framesUntilChange(q: QualityController, dt: number, max = 2000) {
  for (let i = 1; i <= max; i++) if (q.update(dt)) return i;
  return -1;
}

describe('QualityController', () => {
  it('steps down within about a second on a GPU that only manages 30 fps', () => {
    const q = new QualityController(3);
    const n = framesUntilChange(q, 1 / 30);
    expect(n).toBeGreaterThan(0);
    expect(n / 30).toBeLessThan(1.2);
    expect(q.level).toBe(2);
  });

  it('keeps stepping down to the lowest level while still too slow', () => {
    const q = new QualityController(4);
    for (let i = 0; i < 30 * 20; i++) q.update(1 / 20);
    expect(q.level).toBe(0);
  });

  it('stays put at a steady 60 fps for a while, then climbs one level', () => {
    const q = new QualityController(2);
    for (let i = 0; i < 60 * 5; i++) expect(q.update(1 / 60)).toBe(false);
    for (let i = 0; i < 60 * 5; i++) q.update(1 / 60);
    expect(q.level).toBe(3);
  });

  it('ignores hitches (tab switches, shader compiles)', () => {
    const q = new QualityController(3);
    for (let i = 0; i < 100; i++) {
      q.update(1 / 60);
      if (i % 10 === 0) q.update(2);
    }
    expect(q.level).toBe(3);
  });

  it('does not flip-flop: a level that failed must prove itself for much longer', () => {
    // A GPU that runs level 2 at 60 fps but level 3 at 35 fps.
    const q = new QualityController(3);
    const fps = () => (q.level >= 3 ? 35 : 60);
    const changes: number[] = [];
    let t = 0;
    while (t < 120) {
      const dt = 1 / fps();
      t += dt;
      if (q.update(dt)) changes.push(t);
    }
    // Down at the start; each retry of level 3 waits 3x longer, so in 2 minutes only a
    // handful of switches happen and most of the time is spent on the good level.
    expect(changes.length).toBeLessThanOrEqual(5);
    expect(changes[0]).toBeLessThan(1.5);
    // Retry after >20 s, and the retry after that waits >3x as long.
    expect(changes[1] - changes[0]).toBeGreaterThan(20);
    if (changes.length >= 4) expect(changes[3] - changes[2]).toBeGreaterThan(60);
  });

  it('levels get cheaper monotonically', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].sim).toBeGreaterThan(LEVELS[i - 1].sim);
      expect(LEVELS[i].iterations).toBeGreaterThanOrEqual(LEVELS[i - 1].iterations);
      expect(LEVELS[i].sparks).toBeGreaterThanOrEqual(LEVELS[i - 1].sparks);
    }
  });
});

describe('material → physics', () => {
  it('is continuous: a tiny change in the material makes a tiny change in physics', () => {
    const keys = Object.keys(base).filter((k) => k !== 'palette') as (keyof Material)[];
    for (const k of keys) {
      for (const v of [0, 0.25, 0.5, 0.75, 0.999]) {
        const a = physics(mat({ [k]: v }));
        const b = physics(mat({ [k]: v + 0.001 }));
        for (const p of Object.keys(a) as (keyof typeof a)[]) {
          const scale = Math.max(1, Math.abs(a[p]));
          expect(Math.abs(a[p] - b[p]) / scale, `${String(k)}=${v} → ${p}`).toBeLessThan(0.02);
        }
      }
    }
  });

  it('derives a grid only for crisp, steady materials, and flashes only for turbulent, cold ones', () => {
    expect(physics(mat({ angularity: 0.95, jitter: 0.03 })).grid).toBeGreaterThan(0.9);
    expect(physics(mat({ angularity: 0.95, jitter: 0.6 })).grid).toBe(0);
    expect(physics(mat({ vorticity: 1, jitter: 0.9, buoyancy: 0.05 })).flash).toBeGreaterThan(0.8);
    expect(physics(mat({ vorticity: 1, jitter: 0.9, buoyancy: 0.9 })).flash).toBeLessThan(0.15);
  });

  it('slow-fading materials inject less dye per splat than fast-fading ones', () => {
    expect(physics(mat({ dyeFade: 0.1, buoyancy: 0 })).pigment).toBeLessThan(physics(mat({ dyeFade: 0.9, buoyancy: 0 })).pigment);
  });
});

describe('events → splats', () => {
  const r = () => 0.5;

  it('puts low notes low and high notes high, pan across', () => {
    const m = mat({ jitter: 0, angularity: 0 });
    const lo = emitEvents([ev({ height: 0.05, pan: -1 })], m, still, 16 / 9, r).splats[0];
    const hi = emitEvents([ev({ height: 0.95, pan: 1 })], m, still, 16 / 9, r).splats[0];
    expect(lo.y).toBeLessThan(0.2);
    expect(hi.y).toBeGreaterThan(0.8);
    expect(lo.x).toBeLessThan(0.2);
    expect(hi.x).toBeGreaterThan(0.8);
  });

  it('makes bigger splats for bigger materials and stronger events', () => {
    expect(splatRadius(mat({ splatSize: 0.9 }), 0.8)).toBeGreaterThan(5 * splatRadius(mat({ splatSize: 0.1 }), 0.8));
    expect(splatRadius(base, 1)).toBeGreaterThan(splatRadius(base, 0.2));
  });

  it('sends buoyant material upward and spawns sparks in proportion to sparkAmount', () => {
    const fire = emitEvents([ev({})], mat({ buoyancy: 1, jitter: 0, sparkAmount: 1 }), { ...still, angle: Math.PI }, 1, r);
    expect(fire.splats[0].fy).toBeGreaterThan(Math.abs(fire.splats[0].fx));
    expect(fire.splats[0].heat).toBeGreaterThan(0);
    expect(fire.sparks[0].count).toBeGreaterThan(20);
    const none = emitEvents([ev({})], mat({ sparkAmount: 0 }), still, 1, r);
    expect(none.sparks.length).toBe(0);
  });

  it('scales sustained emission by dt so it does not depend on the frame rate', () => {
    const m = mat({});
    const sustained = ev({ onset: false });
    const at60 = emitEvents([sustained], m, still, 1, r, 1 / 60).splats[0].color[0];
    const at30 = emitEvents([sustained], m, still, 1, r, 1 / 30).splats[0].color[0];
    expect(at30 / at60).toBeCloseTo(2, 1);
    expect(emitEvents([sustained], m, still, 1, r).hit).toBe(0);
    expect(emitEvents([ev({ strength: 0.7 })], m, still, 1, r).hit).toBeCloseTo(0.7);
  });

  it('pulls note colors into the palette, more for dull materials', () => {
    const red: [number, number, number] = [1, 0, 0];
    const bright = tint(red, mat({ emissive: 1 }), 0.5, 1);
    const dull = tint(red, mat({ emissive: 0 }), 0.5, 1);
    // The palette's green channel (0.4..0.9) leaks in more for the dull material.
    expect(dull[1]).toBeGreaterThan(bright[1]);
  });

  it('paints continuous strokes: fast drags get more splats', () => {
    const slow = emitStroke({ x: 0.5, y: 0.5 }, { x: 0.51, y: 0.5 }, { x: 0.5, y: 0 }, base, [1, 1, 1], 1, rng(1));
    const fast = emitStroke({ x: 0.1, y: 0.5 }, { x: 0.6, y: 0.5 }, { x: 20, y: 0 }, base, [1, 1, 1], 1, rng(1));
    expect(fast.splats.length).toBeGreaterThan(slow.splats.length);
    expect(fast.splats[0].fx).toBeGreaterThan(0);
  });
});

describe('Sources', () => {
  it('keeps feeding a fading copy of the onset, then expires', () => {
    const s = new Sources();
    const splat = emitEvents([ev({})], mat({ buoyancy: 1 }), still, 1, () => 0.5).splats[0];
    s.add(splat, 0.5);
    const first = s.tick(1 / 60, 0, () => 0.5)[0];
    expect(first.heat).toBeGreaterThan(0);
    let last = first;
    for (let i = 0; i < 20; i++) last = s.tick(1 / 60, 0, () => 0.5)[0];
    expect(last.heat).toBeLessThan(first.heat);
    for (let i = 0; i < 30; i++) s.tick(1 / 60, 0, () => 0.5);
    expect(s.size).toBe(0);
  });
});

describe('input hygiene', () => {
  it('replaces NaN / out-of-range material values with the previous good ones', () => {
    const good = mat({ buoyancy: 0.7 });
    const bad = { ...mat({}), buoyancy: NaN, gravity: 5, palette: [[NaN, 0, 0], [0, 0, 0], [0, 0, 0], [1, 1, Infinity]] } as unknown as Material;
    const c = cleanMaterial(bad, good);
    expect(c.buoyancy).toBe(0.7);
    expect(c.gravity).toBe(1);
    expect(c.palette[0][0]).toBe(good.palette[0][0]);
    expect(c.palette[3][2]).toBe(good.palette[3][2]);
    for (const v of Object.values(physics(c))) expect(Number.isFinite(v)).toBe(true);
    // No previous material: still finite.
    expect(Number.isFinite(cleanMaterial(bad, null).buoyancy)).toBe(true);
  });

  it('cleans events and gestures, dropping events that cannot be salvaged', () => {
    expect(cleanEvent(ev({ strength: NaN }))).toBeNull();
    const e = cleanEvent(ev({ height: NaN, pan: 7, color: [NaN, 2, -1] }))!;
    expect(e.height).toBe(0.5);
    expect(e.pan).toBe(1);
    expect(e.color.every((c) => Number.isFinite(c) && c >= 0)).toBe(true);
    const g = cleanGesture({ ...still, x: NaN, swirl: -3, extra: [NaN, 0, 0, 0] });
    expect(g.x).toBe(0);
    expect(g.swirl).toBe(-1);
    expect(g.extra[0]).toBe(0);
  });
});

describe('Sustain', () => {
  const held = ev({ onset: false });
  it('passes every-frame senders straight through', () => {
    const s = new Sustain();
    let n = 0;
    for (let i = 0; i < 120; i++) n += s.update([held], 1 / 60).length;
    expect(n).toBe(120);
    // Stops promptly when the sender stops.
    expect(s.update([], 1 / 60).length).toBe(1);
    expect(s.update([], 1 / 60).length).toBe(0);
  });

  it('holds sparse ticks (5/s, as the character engine sends) so emission stays continuous', () => {
    const s = new Sustain();
    let frames = 0;
    for (let i = 0; i < 600; i++) if (s.update(i % 12 === 0 ? [held] : [], 1 / 60).length) frames++;
    // After the interval estimate settles, (almost) every frame emits.
    expect(frames / 600).toBeGreaterThan(0.9);
    // ...and it lets go once the ticks stop.
    let tail = 0;
    for (let i = 0; i < 60; i++) if (s.update([], 1 / 60).length) tail++;
    expect(tail).toBeLessThan(20);
  });
});

describe('grid', () => {
  it('survives the moderate jitter of real machine blends, but not glitter or turbulence', () => {
    // A drum-and-bass machine blend as the engine produced it.
    expect(physics(mat({ angularity: 0.82, jitter: 0.33, twinkle: 0.32 })).grid).toBeGreaterThan(0.8);
    // Sugar: crisp but twinkly.
    expect(physics(mat({ angularity: 0.85, jitter: 0.4, twinkle: 0.95 })).grid).toBe(0);
    // Storm / fire: erratic.
    expect(physics(mat({ angularity: 0.7, jitter: 0.65, twinkle: 0.8 })).grid).toBe(0);
  });
});
