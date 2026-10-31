/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import type { WaLayers } from '../src/widgets/layers';
import type { Persist, Region } from '../src/widgets/types';

// The pure parts of lab/layers/region.js (plan Task 5). buildMask draws with canvas operations, so it is looked at in a
// browser by scripts/checks/region-masks.mjs, which also compares its pixels to featherAlpha and vis.
// maskStops is region.js's own helper (the gradient stops buildMask bakes), not part of WaLayers.
const WA = loadLayers() as WaLayers & { maskStops(feather: number, cls: Persist): [number, number][] };
const R = (o: Partial<Region> = {}): Region => ({ mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 0.5, h: 0.5, ...o });

describe('regionBox', () => {
  it('turns fractions into device pixels about the centre', () => {
    expect(WA.regionBox(R(), 2560, 1440)).toEqual({ cx: 1280, cy: 720, w: 1280, h: 720, rot: 0 });
    expect(WA.regionBox(R({ x: 0.25, y: 0.75, w: 0.1, h: 0.2 }), 1280, 720)).toEqual({ cx: 320, cy: 540, w: 128, h: 144, rot: 0 });
  });

  it('gives the rotation in radians', () => {
    expect(WA.regionBox(R({ rot: 90 }), 1280, 720).rot).toBe(Math.PI / 2);
    expect(WA.regionBox(R({ rot: -30 }), 1280, 720).rot).toBeCloseTo(-Math.PI / 6, 15);
  });

  it('means the same at any scale', () => {
    const a = WA.regionBox(R({ x: 0.3, y: 0.6, w: 0.4, h: 0.3, rot: 12 }), 1280, 720);
    const b = WA.regionBox(R({ x: 0.3, y: 0.6, w: 0.4, h: 0.3, rot: 12 }), 3840, 2160);
    expect(b.cx).toBeCloseTo(a.cx * 3, 9); expect(b.cy).toBeCloseTo(a.cy * 3, 9);
    expect(b.w).toBeCloseTo(a.w * 3, 9); expect(b.h).toBeCloseTo(a.h * 3, 9);
    expect(b.rot).toBe(a.rot);
  });
});

describe('featherAlpha', () => {
  it('is 1 inside the feather, 0 at the edge, linear across it', () => {
    expect(WA.featherAlpha(0, 0.25)).toBe(1);
    expect(WA.featherAlpha(0.75, 0.25)).toBe(1);
    expect(WA.featherAlpha(1, 0.25)).toBe(0);
    expect(WA.featherAlpha(0.875, 0.25)).toBe(0.5);
    expect(WA.featherAlpha(0.8, 0.25)).toBeCloseTo(0.8, 12);
  });

  it('is a step at the edge with feather 0', () => {
    expect(WA.featherAlpha(0, 0)).toBe(1);
    expect(WA.featherAlpha(0.999999, 0)).toBe(1);
    expect(WA.featherAlpha(1, 0)).toBe(0);
    expect(WA.featherAlpha(1.5, 0)).toBe(0);
  });

  it('fades from the centre with feather 1, and clamps outside 0..1', () => {
    expect(WA.featherAlpha(0.5, 1)).toBe(0.5);
    expect(WA.featherAlpha(-1, 0.25)).toBe(1);
    expect(WA.featherAlpha(2, 0.25)).toBe(0);
    expect(WA.featherAlpha(0.9, 3)).toBeCloseTo(0.1, 12);   // feather clamps to 1
    expect(WA.featherAlpha(0.9, -1)).toBe(1);               // and to 0
  });

  it('never increases towards the edge', () => {
    for (const f of [0, 0.1, 0.25, 0.5, 1]) {
      let last = 2;
      for (let i = 0; i <= 200; i++) { const a = WA.featherAlpha(i / 200, f); expect(a).toBeLessThanOrEqual(last); last = a; }
    }
  });
});

describe('glideRegion', () => {
  const a = R({ mode: 'spot', shape: 'ellipse', x: 0.1, y: 0.2, w: 0.3, h: 0.4, rot: 10, feather: 0.1 });
  const b = R({ mode: 'spot', shape: 'rect', x: 0.7, y: 0.6, w: 0.5, h: 0.2, rot: 50, feather: 0.5, blend: 'lighten', fit: 'contain' });
  const geo = (r: Region) => ({ x: r.x, y: r.y, w: r.w, h: r.h, rot: r.rot, feather: r.feather });

  it("is a's geometry at 0 and b's at 1, exactly", () => {
    expect(geo(WA.glideRegion(a, b, 0))).toEqual(geo(a));
    expect(geo(WA.glideRegion(a, b, 1))).toEqual(geo(b));
    expect(WA.glideRegion(a, b, 1)).toEqual(b);
  });

  it('clamps u', () => {
    expect(geo(WA.glideRegion(a, b, -2))).toEqual(geo(a));
    expect(geo(WA.glideRegion(a, b, 7))).toEqual(geo(b));
  });

  it('is the midpoint at 0.5, smoothstep elsewhere', () => {
    const m = WA.glideRegion(a, b, 0.5);
    expect(m.x).toBeCloseTo(0.4, 12); expect(m.y).toBeCloseTo(0.4, 12);
    expect(m.w).toBeCloseTo(0.4, 12); expect(m.h).toBeCloseTo(0.3, 12);
    expect(m.rot).toBeCloseTo(30, 12); expect(m.feather).toBeCloseTo(0.3, 12);
    const q = WA.glideRegion(a, b, 0.25), s = 0.25 * 0.25 * (3 - 2 * 0.25);
    expect(q.x).toBeCloseTo(0.1 + 0.6 * s, 12);
  });

  it("takes mode, shape, blend and fit from b", () => {
    const m = WA.glideRegion(a, b, 0.3);
    expect(m.mode).toBe('spot'); expect(m.shape).toBe('rect'); expect(m.blend).toBe('lighten'); expect(m.fit).toBe('contain');
  });

  it('glides from the defaults of a missing rot or feather, and adds neither when both lack it', () => {
    const plain = R({ x: 0.2 }), turned = R({ x: 0.2, rot: 40, feather: 0.75 });
    const m = WA.glideRegion(plain, turned, 0.5);
    expect(m.rot).toBeCloseTo(20, 12); expect(m.feather).toBeCloseTo(0.5, 12);
    const n = WA.glideRegion(plain, R({ x: 0.6 }), 0.5);
    expect('rot' in n).toBe(false); expect('feather' in n).toBe(false);
  });

  it('cuts on a change of mode: b at once', () => {
    const w = { ...b, mode: 'window' as const };
    expect(WA.glideRegion(a, w, 0.2)).toEqual(w);
  });

  it('does not change its inputs', () => {
    const a0 = JSON.stringify(a), b0 = JSON.stringify(b);
    WA.glideRegion(a, b, 0.5);
    expect(JSON.stringify(a)).toBe(a0); expect(JSON.stringify(b)).toBe(b0);
  });
});

describe('fitRect', () => {
  const cw = 1280, ch = 720;

  it('cover of a 0.4 x 0.5 region on 16:9 crops the sides', () => {
    const r = WA.fitRect(R({ w: 0.4, h: 0.5, fit: 'cover' }), cw, ch);
    const aspect = (0.4 * cw) / (0.5 * ch);
    expect(r.sy).toBe(0); expect(r.sh).toBe(ch);
    expect(r.sw).toBeCloseTo(ch * aspect, 9); expect(r.sw).toBeLessThan(cw);
    expect(r.sx).toBeCloseTo((cw - r.sw) / 2, 9);
  });

  it('cover is the default', () => {
    expect(WA.fitRect(R({ w: 0.4, h: 0.5 }), cw, ch)).toEqual(WA.fitRect(R({ w: 0.4, h: 0.5, fit: 'cover' }), cw, ch));
  });

  it('cover of a wide strip crops top and bottom', () => {
    const r = WA.fitRect(R({ w: 1, h: 0.25 }), cw, ch);
    expect(r.sx).toBe(0); expect(r.sw).toBe(cw);
    expect(r.sh).toBeCloseTo(cw / ((1 * cw) / (0.25 * ch)), 9); expect(r.sy).toBeCloseTo((ch - r.sh) / 2, 9);
  });

  it('contain letterboxes: the whole canvas inside a source rect larger than it', () => {
    const r = WA.fitRect(R({ w: 0.4, h: 0.5, fit: 'contain' }), cw, ch);
    const aspect = (0.4 * cw) / (0.5 * ch);
    expect(r.sx).toBe(0); expect(r.sw).toBe(cw);
    expect(r.sh).toBeCloseTo(cw / aspect, 9); expect(r.sh).toBeGreaterThan(ch);
    expect(r.sy).toBeCloseTo((ch - r.sh) / 2, 9); expect(r.sy).toBeLessThan(0);
  });

  it('stretch is the whole canvas', () => {
    expect(WA.fitRect(R({ w: 0.4, h: 0.5, fit: 'stretch' }), cw, ch)).toEqual({ sx: 0, sy: 0, sw: cw, sh: ch });
  });

  it('a 16:9 region is the whole canvas in every fit', () => {
    for (const fit of ['cover', 'contain', 'stretch'] as const) {
      const r = WA.fitRect(R({ w: 0.5, h: 0.5, fit }), cw, ch);
      expect(r.sx).toBeCloseTo(0, 9); expect(r.sy).toBeCloseTo(0, 9);
      expect(r.sw).toBeCloseTo(cw, 9); expect(r.sh).toBeCloseTo(ch, 9);
    }
  });

  it('is the same picture at any scale', () => {
    const a = WA.fitRect(R({ w: 0.3, h: 0.7 }), 1280, 720), b = WA.fitRect(R({ w: 0.3, h: 0.7 }), 2560, 1440);
    expect(b.sx).toBeCloseTo(a.sx * 2, 9); expect(b.sw).toBeCloseTo(a.sw * 2, 9);
    expect(b.sy).toBeCloseTo(a.sy * 2, 9); expect(b.sh).toBeCloseTo(a.sh * 2, 9);
  });

  it('a degenerate region falls back to the whole canvas', () => {
    expect(WA.fitRect(R({ w: 0, h: 0.5 }), cw, ch)).toEqual({ sx: 0, sy: 0, sw: cw, sh: ch });
  });
});

describe('maskStops', () => {
  it('follows featherAlpha across the band, through vis for the redraw class', () => {
    const st = WA.maskStops(0.25, 'strokes');
    expect(st[0]).toEqual([0.75, 1]);
    expect(st[st.length - 1]).toEqual([1, 0]);
    for (const [d, a] of st) expect(a).toBeCloseTo(WA.featherAlpha(d, 0.25), 12);
    const rd = WA.maskStops(0.25, 'redraw');
    for (const [d, a] of rd) expect(a).toBeCloseTo(WA.vis(WA.featherAlpha(d, 0.25), 'redraw'), 12);
    for (const [x] of WA.VIS_REDRAW) expect(rd.some(([d]) => Math.abs(d - (1 - 0.25 * x)) < 1e-12)).toBe(true);   // the table's nodes are stops
  });

  it('is sorted by d, within 0..1', () => {
    for (const f of [0.01, 0.25, 1]) for (const cls of ['redraw', 'strokes'] as const) {
      const st = WA.maskStops(f, cls);
      for (let i = 1; i < st.length; i++) expect(st[i][0]).toBeGreaterThan(st[i - 1][0]);
      expect(st[0][0]).toBeGreaterThanOrEqual(0); expect(st[st.length - 1][0]).toBe(1);
    }
  });

  it('is empty with feather 0: a hard edge', () => {
    expect(WA.maskStops(0, 'redraw')).toEqual([]);
  });
});

describe('region.js', () => {
  it('never calls Math.random', () => {
    // Pure functions only; buildMask is exercised in the browser check.
    const spy = { n: 0 }, orig = Math.random;
    Math.random = () => { spy.n++; return orig(); };
    try {
      WA.regionBox(R({ rot: 5 }), 1280, 720); WA.glideRegion(R(), R({ x: 0.9 }), 0.4);
      WA.fitRect(R({ w: 0.2 }), 1280, 720); WA.maskStops(0.3, 'redraw');
    } finally { Math.random = orig; }
    expect(spy.n).toBe(0);
  });
});
