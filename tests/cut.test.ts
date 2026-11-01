import { describe, expect, it } from 'vitest';
import { CUT_COLOR, cutAt, cutShift, cutSide, freshCuts, MELT_COLUMNS, meltShift, meltSpeed } from '../src/stage/cut';
import { rng } from '../src/stage/gl';
import { ScriptPlayer } from '../src/stage/player';
import { validateScript } from '../src/stage/script';
import type { Accent, Script } from '../src/stage/types';

/** The final pass's mirrorUv (src/stage/post.ts), in JS: the point of the frame that shows at `p`. */
function fold([x, y]: [number, number], mirror: number, aspect: number): [number, number] {
  if (mirror === 2) return [0.5 - Math.abs(x - 0.5), y];
  if (mirror === 4) return [0.5 - Math.abs(x - 0.5), 0.5 - Math.abs(y - 0.5)];
  if (mirror > 4) {
    const px = (x - 0.5) * aspect;
    const py = y - 0.5;
    const seg = (2 * Math.PI) / mirror;
    const t = Math.atan2(py, px) + Math.PI / 2;
    let a = t - seg * Math.floor(t / seg);
    a = Math.abs(a - seg * 0.5) + Math.PI / 2 - seg * 0.5;
    const r = Math.hypot(px, py);
    return [(r * Math.cos(a)) / aspect + 0.5, r * Math.sin(a) + 0.5];
  }
  return [x, y];
}

describe('cut geometry', () => {
  const MIRRORS = [1, 2, 4, 6, 8, 12];

  it('slices through the middle half of the picture without a mirror', () => {
    const r = rng(3);
    for (let i = 0; i < 200; i++) {
      const c = cutAt(r, 1, 16 / 9, 1);
      expect(c.x).toBeGreaterThanOrEqual(0.25);
      expect(c.x).toBeLessThanOrEqual(0.75);
      expect(c.y).toBeGreaterThanOrEqual(0.25);
      expect(c.y).toBeLessThanOrEqual(0.75);
      expect(Math.hypot(c.dx, c.dy)).toBeCloseTo(1);
    }
  });

  it('puts the cut where the mirror shows it, away from the seams', () => {
    for (const mirror of MIRRORS) {
      for (const aspect of [16 / 9, 1, 9 / 16]) {
        const r = rng(mirror * 10 + Math.round(aspect * 10));
        for (let i = 0; i < 100; i++) {
          const c = cutAt(r, mirror, aspect, 0.5);
          const q = fold([c.x, c.y], mirror, aspect);
          const where = `mirror ${mirror}, aspect ${aspect.toFixed(2)}: (${c.x.toFixed(3)}, ${c.y.toFixed(3)})`;
          expect(Math.abs(q[0] - c.x) + Math.abs(q[1] - c.y), where).toBeLessThan(1e-9);
          // Not on a fold, where the two halves would only meet their own reflection.
          if (mirror === 2 || mirror === 4) expect(c.x, where).toBeLessThan(0.45);
          if (mirror === 4) expect(c.y, where).toBeLessThan(0.45);
          expect(Math.min(c.x, c.y), where).toBeGreaterThan(0.05);
          expect(Math.max(c.x, c.y), where).toBeLessThan(0.95);
        }
      }
    }
  });

  it('is repeatable from the seed', () => {
    expect(cutAt(rng(9), 1, 16 / 9, 1)).toEqual(cutAt(rng(9), 1, 16 / 9, 1));
    expect(cutAt(rng(9), 1, 16 / 9, 1)).not.toEqual(cutAt(rng(10), 1, 16 / 9, 1));
  });

  it('shoves harder with strength: about 14 to 40 px at 720 px high', () => {
    const lo = cutAt(rng(1), 1, 16 / 9, 0).d * 720;
    const hi = cutAt(rng(1), 1, 16 / 9, 1).d * 720;
    expect(lo).toBeGreaterThan(12);
    expect(lo).toBeLessThan(16);
    expect(hi).toBeGreaterThan(36);
    expect(hi).toBeLessThan(44);
    expect(cutAt(rng(1), 1, 16 / 9, 0.5).d).toBeGreaterThan(cutAt(rng(1), 1, 16 / 9, 0.2).d);
    // Strength is clamped: a wild value can't tear the picture apart.
    expect(cutAt(rng(1), 1, 16 / 9, 7).d).toBe(cutAt(rng(1), 1, 16 / 9, 1).d);
  });

  it('tells the two sides of the line apart', () => {
    const c = { x: 0.5, y: 0.5, dx: 1, dy: 0, d: 0.03 };
    expect(cutSide(c, 0.3, 0.7, 16 / 9)).toBe(-cutSide(c, 0.3, 0.2, 16 / 9));
    expect(cutSide(c, 0.9, 0.51, 16 / 9)).toBe(cutSide(c, 0.1, 0.99, 16 / 9));
  });

  it('shoves the two halves apart along the line, by whole texels, scaled with the height', () => {
    const c = { x: 0.5, y: 0.5, dx: Math.cos(0.6), dy: Math.sin(0.6), d: 0.04 };
    const aspect = 16 / 9;
    const a = cutShift(c, 0.2, 0.9, aspect, 720);
    const b = cutShift(c, 0.8, 0.1, aspect, 720);
    expect(cutSide(c, 0.2, 0.9, aspect)).not.toBe(cutSide(c, 0.8, 0.1, aspect));
    for (const v of [...a, ...b]) expect(Number.isInteger(v)).toBe(true);
    expect(a[0]).toBe(-b[0]);
    expect(a[1]).toBe(-b[1]);
    // Along the line, d screen heights.
    expect(Math.hypot(a[0], a[1])).toBeCloseTo(0.04 * 720, -0.5);
    expect(Math.abs(a[0] * c.dy - a[1] * c.dx)).toBeLessThan(1);
    // The same cut at another canvas size moves the picture by the same share of its height.
    const big = cutShift(c, 0.2, 0.9, aspect, 1440);
    expect(Math.hypot(big[0], big[1]) / 1440).toBeCloseTo(Math.hypot(a[0], a[1]) / 720, 2);
  });
});

describe('melt', () => {
  it('is the identity when no music time passes, whatever the melt and the dither', () => {
    for (let col = 0; col < MELT_COLUMNS; col += 7) {
      for (const jitter of [0, 0.3, 0.999]) {
        expect(meltShift(col, 12.3, 1, 0, 720, jitter)).toBe(0);
        expect(meltShift(col, 12.3, 0, 1 / 60, 720, jitter)).toBe(0);
      }
    }
  });

  it('moves whole texels down, at its own speed per column, about the sketch\'s pace on average', () => {
    const h = 720;
    let sum = 0;
    const speeds = new Set<number>();
    for (let col = 0; col < MELT_COLUMNS; col++) {
      speeds.add(Math.round(meltSpeed(col, 5) * 1000));
      let moved = 0;
      for (let f = 0; f < 600; f++) {
        const v = meltShift(col, 5 + f / 60, 1, 1 / 60, h, (f * 0.618 + col * 0.37) % 1);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        moved += v;
      }
      sum += moved / 10 / h;
    }
    // Columns drip at different speeds.
    expect(speeds.size).toBeGreaterThan(20);
    // Mean speed at melt 1: the sketch's ~2.2 px a frame at 60 fps on 720 px, ≈ 0.18 screen heights a second.
    const mean = sum / MELT_COLUMNS;
    expect(mean).toBeGreaterThan(0.12);
    expect(mean).toBeLessThan(0.25);
  });

  it('scales with melt', () => {
    let half = 0;
    let full = 0;
    for (let f = 0; f < 600; f++) {
      const j = (f * 0.618) % 1;
      half += meltShift(40, 5 + f / 60, 0.5, 1 / 60, 720, j);
      full += meltShift(40, 5 + f / 60, 1, 1 / 60, 720, j);
    }
    expect(half / full).toBeGreaterThan(0.4);
    expect(half / full).toBeLessThan(0.6);
  });
});

describe('fresh cuts (script accents)', () => {
  const cut = (at: number, age: number): Accent => ({ kind: 'cut', color: CUT_COLOR, strength: 1, age, at });

  it('cuts once on the frame the accent fires, never again while it stays listed (a pause, a held frame)', () => {
    const seen = new Set<number>();
    expect(freshCuts([cut(10, 0.004)], seen, 1 / 60)).toHaveLength(1);
    expect(freshCuts([cut(10, 0.02)], seen, 1 / 60)).toHaveLength(0);
    for (let i = 0; i < 5; i++) expect(freshCuts([cut(10, 0.02)], seen, 0)).toHaveLength(0);
  });

  it('waits while music time stands still, and cuts when it moves on', () => {
    const seen = new Set<number>();
    expect(freshCuts([cut(10, 0.01)], seen, 0)).toHaveLength(0);
    expect(freshCuts([cut(10, 0.02)], seen, 1 / 60)).toHaveLength(1);
  });

  it('does not cut late: a seek landing mid-accent shows no slice', () => {
    expect(freshCuts([cut(10, 0.6)], new Set(), 1 / 60)).toHaveLength(0);
  });

  it('cuts again when the song comes back round to it (a seek back)', () => {
    const seen = new Set<number>();
    expect(freshCuts([cut(10, 0)], seen, 1 / 60)).toHaveLength(1);
    expect(freshCuts([], seen, 1 / 60)).toHaveLength(0);
    expect(freshCuts([cut(10, 0.01)], seen, 1 / 60)).toHaveLength(1);
  });

  it('ignores the other accents', () => {
    expect(freshCuts([{ kind: 'flash', color: [1, 1, 1], strength: 1, age: 0, at: 3 }], new Set(), 1 / 60)).toHaveLength(0);
  });
});

/** A valid script exercising melt and the cut accent. */
function casket(): any {
  return {
    version: 1, id: 'casket-test', title: 'Casket', duration: 60, match: { kind: 'recording' },
    scenes: {
      casket: {
        look: { melt: 0.6, trails: 0.85, warp: 0.1, glow: 0.5 },
        elements: [{ id: 'low', type: 'bass', params: { style: 'orbs' } }],
      },
    },
    timeline: [
      { at: 0, scene: 'casket' },
      { at: 5, accent: { kind: 'cut' } },
      { at: 6, accent: { kind: 'cut', strength: 0.4, color: '#ff0000' } },
      { at: 7, ramp: { target: 'look.melt', to: 1, duration: 4 } },
    ],
  };
}

describe('validator: melt and the cut accent', () => {
  it('accepts melt, the cut accent and a melt ramp', () => {
    const r = validateScript(casket());
    expect(r.ok ? [] : r.errors).toEqual([]);
  });

  it('rejects melt outside 0..1', () => {
    const s = casket();
    s.scenes.casket.look.melt = 2;
    const r = validateScript(s);
    expect(r.ok ? [] : r.errors).toEqual([expect.stringMatching(/^scenes\.casket\.look\.melt:/)]);
  });

  it('rejects a cut accent with a bad strength', () => {
    const s = casket();
    s.timeline[1].accent.strength = 1.5;
    const r = validateScript(s);
    expect(r.ok ? [] : r.errors).toEqual([expect.stringMatching(/^timeline\[1\]\.accent\.strength:/)]);
  });
});

describe('player: melt and cuts', () => {
  const p = new ScriptPlayer(casket() as Script);

  it('glides melt like the other look numbers, and ramps it', () => {
    expect(p.at(0.75).look.melt).toBeCloseTo(0.3);
    expect(p.at(2).look.melt).toBeCloseTo(0.6);
    expect(p.at(9).look.melt).toBeCloseTo(0.8);
    expect(p.at(12).look.melt).toBeCloseTo(1);
  });

  it('lists a cut with its fire time, in the sketch\'s pale yellow unless told otherwise', () => {
    const [a] = p.at(5.2).accents;
    expect(a.kind).toBe('cut');
    expect(a.at).toBeCloseTo(5);
    expect(a.age).toBeCloseTo(0.2);
    expect(a.color).toEqual(CUT_COLOR);
    const [b] = p.at(6.1).accents.filter((x) => x.at === 6);
    expect(b.color).toEqual([1, 0, 0]);
    expect(b.strength).toBe(0.4);
  });
});
