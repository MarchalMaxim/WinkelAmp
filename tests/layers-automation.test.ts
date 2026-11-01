/// <reference types="node" />
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import type { Pivot } from '../src/widgets/types';

// Determinism: nothing in the curve, thinning or visibility maths may call Math.random.
let spy: MockInstance;
beforeAll(() => { spy = vi.spyOn(Math, 'random'); });
afterAll(() => {
  expect(spy).toHaveBeenCalledTimes(0);
  spy.mockRestore();
});

const WA = loadLayers();

/** FNV-1a 32 over bytes, the reference the tests check against. */
function fnvBytes(bytes: number[]): number {
  let h = 0x811c9dc5;
  for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

describe('automationAt', () => {
  it('is 1 without pivots, and holds before the first and after the last pivot', () => {
    expect(WA.automationAt(undefined, 5)).toBe(1);
    expect(WA.automationAt([], 5)).toBe(1);
    const p: Pivot[] = [{ t: 10, v: 0.2 }, { t: 20, v: 0.8 }];
    expect(WA.automationAt(p, 0)).toBe(0.2);
    expect(WA.automationAt(p, 10)).toBe(0.2);
    expect(WA.automationAt(p, 20)).toBe(0.8);
    expect(WA.automationAt(p, 99)).toBe(0.8);
  });

  it('is linear at the midpoint, bends by u ** 2 ** (−3·bend), eases with smoothstep', () => {
    expect(WA.automationAt([{ t: 0, v: 0 }, { t: 2, v: 1 }], 1)).toBe(0.5);
    expect(WA.automationAt([{ t: 0, v: 0, bend: 1 }, { t: 2, v: 1 }], 1)).toBe(0.5 ** 0.125);
    expect(WA.automationAt([{ t: 0, v: 0, shape: 'linear', bend: -1 }, { t: 2, v: 1 }], 1)).toBe(0.5 ** 8);
    expect(WA.automationAt([{ t: 0, v: 0, shape: 'ease' }, { t: 4, v: 1 }], 1)).toBe(0.15625);
    // bend applies to linear segments only
    expect(WA.automationAt([{ t: 0, v: 0, shape: 'ease', bend: 1 }, { t: 4, v: 1 }], 1)).toBe(0.15625);
  });

  it('holds v₀ until the next pivot, then takes v₁', () => {
    const p: Pivot[] = [{ t: 0, v: 0.25, shape: 'hold' }, { t: 2, v: 0.75 }];
    expect(WA.automationAt(p, 0.5)).toBe(0.25);
    expect(WA.automationAt(p, 1.999)).toBe(0.25);
    expect(WA.automationAt(p, 2)).toBe(0.75);
  });

  it('takes the second of two pivots at the same t', () => {
    const p: Pivot[] = [{ t: 0, v: 0 }, { t: 5, v: 0.2 }, { t: 5, v: 0.9 }, { t: 10, v: 0.9 }];
    expect(WA.automationAt(p, 5)).toBe(0.9);
    expect(WA.automationAt(p, 7)).toBeCloseTo(0.9, 12);
    expect(WA.automationAt(p, 2.5)).toBeCloseTo(0.1, 12);
  });

  it('clamps to 0..1', () => {
    expect(WA.automationAt([{ t: 0, v: -1 }, { t: 1, v: 3 }], 0)).toBe(0);
    expect(WA.automationAt([{ t: 0, v: -1 }, { t: 1, v: 3 }], 1)).toBe(1);
    expect(WA.automationAt([{ t: 0, v: -1 }, { t: 1, v: 3 }], 0.5)).toBe(1);
  });

  it('agrees with a linear scan on 256 pivots', () => {
    const p: Pivot[] = [];
    for (let i = 0; i < 256; i++) p.push({ t: i * 0.5 + (i % 3) * 0.1, v: ((i * 37) % 101) / 100, shape: (['linear', 'ease', 'hold'] as const)[i % 3], bend: i % 5 === 0 ? 0.3 : 0 });
    for (let t = -1; t < 130; t += 0.137) {
      let i = 0;
      while (i + 1 < p.length && p[i + 1].t <= t) i++;
      let want: number;
      if (t <= p[0].t) want = p[0].v;
      else if (t >= p[p.length - 1].t) want = p[p.length - 1].v;
      else {
        const a = p[i], q = p[i + 1];
        let u = (t - a.t) / (q.t - a.t);
        if (a.shape === 'hold') u = 0;
        else if (a.shape === 'ease') u = u * u * (3 - 2 * u);
        else if (a.bend) u = u ** (2 ** (-3 * a.bend));
        want = a.v + (q.v - a.v) * u;
      }
      expect(WA.automationAt(p, t)).toBe(Math.max(0, Math.min(1, want)));
    }
  });
});

describe('fnv32 and passes', () => {
  it('is FNV-1a over UTF-16 code units, low byte then high byte', () => {
    expect(WA.fnv32('')).toBe(0x811c9dc5);
    expect(WA.fnv32('a')).toBe(fnvBytes([0x61, 0x00]));
    expect(WA.fnv32('strings@melody')).toBe(fnvBytes([...'strings@melody'].flatMap((c) => [c.charCodeAt(0), 0])));
    expect(WA.fnv32('€')).toBe(fnvBytes([0xac, 0x20]));
  });

  it('passes over the 8 bytes salt LE, round(t·1000) LE', () => {
    const salt = WA.fnv32('strings@melody'), t = 12.3456, ms = Math.round(t * 1000);
    const h = fnvBytes([salt & 255, (salt >>> 8) & 255, (salt >>> 16) & 255, salt >>> 24, ms & 255, (ms >>> 8) & 255, (ms >>> 16) & 255, ms >>> 24]);
    const u = h / 2 ** 32;
    expect(WA.passes(t, u + 1e-9, salt)).toBe(true);
    expect(WA.passes(t, u, salt)).toBe(false);
  });

  it('always passes at 1, never at 0', () => {
    for (let i = 0; i < 1000; i++) {
      expect(WA.passes(i * 0.013, 1, i)).toBe(true);
      expect(WA.passes(i * 0.013, 0, i)).toBe(false);
      expect(WA.passes(i * 0.013, 1.5, i)).toBe(true);
      expect(WA.passes(i * 0.013, -0.2, i)).toBe(false);
    }
  });

  it('lets through 30 ± 1.5 % at 0.3 over 10 000 chords at 1 ms steps, the same ones every time', () => {
    for (const key of ['strings', 'strings@melody', 'casket@bassline']) {
      const salt = WA.fnv32(key);
      let n = 0;
      const first: boolean[] = [];
      for (let i = 0; i < 10000; i++) { const p = WA.passes(5 + i * 0.001, 0.3, salt); first.push(p); if (p) n++; }
      expect(n / 10000).toBeGreaterThan(0.285);
      expect(n / 10000).toBeLessThan(0.315);
      for (let i = 0; i < 10000; i++) expect(WA.passes(5 + i * 0.001, 0.3, salt)).toBe(first[i]);
    }
  });

  it('thins nested: what passes at 0.3 passes at 0.6', () => {
    const salt = WA.fnv32('x');
    for (let i = 0; i < 2000; i++) if (WA.passes(i * 0.01, 0.3, salt)) expect(WA.passes(i * 0.01, 0.6, salt)).toBe(true);
  });
});

describe('vis', () => {
  it('maps through the measured table for redraw, and is the identity for strokes', () => {
    expect(WA.vis(0.5, 'redraw')).toBe(0.15);
    expect(WA.vis(0.3, 'redraw')).toBeCloseTo(0.069 + (0.15 - 0.069) * 0.2, 12);
    expect(WA.vis(0.4, 'strokes')).toBe(0.4);
    expect(WA.vis(1, 'redraw')).toBe(1);
    expect(WA.vis(0, 'redraw')).toBe(0);
  });
});
