/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import { simplifyStroke, sliceCurve } from '../src/studio/ui/lanes';
import type { Pivot } from '../src/widgets/types';

const WA = loadLayers(), P = WA.presets;
const s = { start: 10, end: 30 };

function sane(ps: Pivot[], span = s) {
  expect(ps.length).toBeLessThanOrEqual(WA.MAX_PIVOTS);
  ps.forEach((p, i) => {
    expect(p.t).toBeGreaterThanOrEqual(span.start); expect(p.t).toBeLessThanOrEqual(span.end);
    expect(p.v).toBeGreaterThanOrEqual(0); expect(p.v).toBeLessThanOrEqual(1);
    if (i) expect(p.t).toBeGreaterThanOrEqual(ps[i - 1].t);
  });
}

describe('the new shapes', () => {
  it('fades keep their old curve, and take a floor', () => {
    expect(P.fadeIn(s, 4, { floor: 0.3 })).toEqual([{ t: 10, v: 0.3 }, { t: 14, v: 1 }]);
    expect(P.fadeOut(s, 4, { floor: 0.3 })).toEqual([{ t: 26, v: 1 }, { t: 30, v: 0.3 }]);
  });
  it('build starts slow and decay starts fast', () => {
    const b = P.build(s), d = P.decay(s), mid = 20;
    expect(WA.automationAt(b, s.start)).toBe(0); expect(WA.automationAt(b, s.end)).toBe(1);
    expect(WA.automationAt(b, mid)).toBeLessThan(0.25);
    expect(WA.automationAt(d, s.start)).toBe(1); expect(WA.automationAt(d, s.end)).toBe(0);
    expect(WA.automationAt(d, mid)).toBeLessThan(0.3);
    sane(b); sane(d);
  });
  it('dip goes down in the middle and comes back', () => {
    const p = P.dip(s, { floor: 0.2 });
    expect(WA.automationAt(p, 10)).toBe(1); expect(WA.automationAt(p, 20)).toBeCloseTo(0.2, 9); expect(WA.automationAt(p, 30)).toBe(1);
  });
  it('breathe alternates on the beats, reaches the end, and stays under the pivot limit', () => {
    const beats = Array.from({ length: 41 }, (_, i) => 10 + i * 0.5);
    const p = P.breathe(s, beats, { every: 4, floor: 0.1 });
    expect(p.slice(0, 3).map((x) => [x.t, x.v])).toEqual([[10, 0.1], [12, 1], [14, 0.1]]);
    expect(p[p.length - 1].t).toBe(30);
    sane(p);
    const dense = Array.from({ length: 20000 }, (_, i) => 10 + i * 0.001);
    sane(P.breathe(s, dense, { every: 1 }));
    sane(P.breathe(s, [], { every: 4 }));
  });
  it('steps climb evenly and hold, level stays', () => {
    const p = P.steps(s, { n: 4 });
    expect(p.map((x) => x.v)).toEqual([0.25, 0.5, 0.75, 1, 1]);
    expect(WA.automationAt(p, 14.9)).toBe(0.25); expect(WA.automationAt(p, 15.1)).toBe(0.5);
    expect(P.level(s, 0.5)).toEqual([{ t: 10, v: 0.5 }, { t: 30, v: 0.5 }]);
    sane(p);
  });
});

describe('sliceCurve', () => {
  const cut = (piv: Pivot[], a: number, b: number) => sliceCurve(piv, { start: a, end: b }, (t) => WA.automationAt(piv, t));
  const same = (piv: Pivot[], a: number, b: number) => {
    const part = cut(piv, a, b);
    sane(part, { start: a, end: b });
    for (let t = a; t <= b; t += (b - a) / 40) expect(WA.automationAt(part, t)).toBeCloseTo(WA.automationAt(piv, t), 2);
  };
  it('a curve inside the span comes back as it was', () => {
    const piv = P.swell(s);
    expect(cut(piv, 10, 30)).toEqual(piv);
    const bent = P.build(s);
    expect(cut(bent, 10, 30)).toEqual(bent);
  });
  it('sections cut from a stretched shape draw the same line, whatever the segment', () => {
    for (const piv of [P.swell(s), P.build(s), P.decay(s), P.steps(s, { n: 4 }), P.level(s, 0.5), P.fadeIn(s, 4), P.dip(s)]) {
      same(piv, 10, 17.3); same(piv, 17.3, 24); same(piv, 24, 30);
    }
  });
  it('a span past either end of the curve holds its value', () => {
    expect(cut([{ t: 12, v: 0.4 }, { t: 14, v: 0.8 }], 20, 25)).toEqual([{ t: 20, v: 0.8 }]);
    expect(cut([{ t: 12, v: 0.4 }, { t: 14, v: 0.8 }], 2, 5)).toEqual([{ t: 5, v: 0.4 }]);
  });
  it('no curve stays no curve', () => {
    expect(cut([], 10, 20)).toEqual([]);
  });
});

describe('simplifyStroke', () => {
  const x = (t: number) => t * 100, y = (v: number) => (1 - v) * 100;
  it('a straight line drawn with many points is its two ends', () => {
    const pts = Array.from({ length: 50 }, (_, i) => ({ t: i * 0.02, v: i / 49 }));
    expect(simplifyStroke(pts, x, y)).toEqual([{ t: 0, v: 0 }, { t: 0.98, v: 1 }]);
  });
  it('keeps the corners', () => {
    const pts = [...Array.from({ length: 20 }, (_, i) => ({ t: i * 0.05, v: 0 })), ...Array.from({ length: 20 }, (_, i) => ({ t: 1 + i * 0.05, v: 0.05 * i }))];
    const line = simplifyStroke(pts, x, y);
    expect(line.length).toBeLessThanOrEqual(4);
    expect(line.some((p) => Math.abs(p.t - 1) < 0.06 && p.v < 0.06)).toBe(true);
  });
  it('a click is one point, kept inside 0..1', () => {
    expect(simplifyStroke([{ t: 1, v: 1.4 }], x, y)).toEqual([{ t: 1, v: 1 }]);
  });
});
