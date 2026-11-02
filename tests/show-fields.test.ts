import { describe, expect, it } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import { MAX_PIVOTS, repairShow, validateShow, type Issue, type Layer, type Show, type ShowContext } from '../src/studio/show/show';

const base = (): Show => ({
  version: 3, id: 'demo', song: 'demo',
  clips: [
    { id: 'c1', start: 0, end: 10, track: 0, widget: 'strings' },
    { id: 'c2', start: 0, end: 10, track: 1, widget: 'squares' },
    { id: 'c3', start: 10, end: 20, track: 0, fade: 2, widget: 'strings' },
  ],
});
/** base() with the first clip patched. */
const withLayer = (patch: Partial<Layer> | Record<string, unknown>): Show => {
  const s = base();
  Object.assign(s.clips[0], patch);
  return s;
};
const L0 = 'clips[0]';
const at = (list: Issue[], path: string) => list.filter((i) => i.path === path);
const C: ShowContext = { duration: 20, tracks: ['piano', 'violin', 'cello'] };
const errs = (x: unknown, c: ShowContext = C) => validateShow(x, c).errors;
const warns = (x: unknown, c: ShowContext = C) => validateShow(x, c).warnings;
/** repairShow, then: what it fixed at a path, the repaired first clip, and that the result has no errors. */
function repaired(x: Show, path: string) {
  const r = repairShow(x, C);
  expect(validateShow(r.show, C).errors).toEqual([]);
  return { fixed: r.fixed.filter((f) => f.path.startsWith(path)), layer: r.show.clips[0], show: r.show };
}

describe('MAX_PIVOTS', () => {
  it('is the shared one', () => { expect(MAX_PIVOTS).toBe(loadLayers().MAX_PIVOTS); });
});

describe('a clip: its listen, region and intensity', () => {
  it('a clip with every field passes', () => {
    const s = withLayer({ listen: 'violin', region: { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 0.4, h: 0.3, rot: 10, feather: 0.2, blend: 'lighten', fit: 'contain' },
      intensity: [{ t: 0, v: 0 }, { t: 5, v: 1, shape: 'ease' }, { t: 10, v: 0.5, shape: 'linear', bend: -0.5 }] });
    expect(validateShow(s, C)).toEqual({ errors: [], warnings: [] });
  });

  it('listen: not a part is an error, removed by repair', () => {
    const s = withLayer({ listen: 'drums' });
    const e = at(errs(s), `${L0}.listen`);
    expect(e).toHaveLength(1);
    expect(e[0].message).toMatch(/not a part/);
    const r = repaired(s, `${L0}.listen`);
    expect(r.fixed).toHaveLength(1);
    expect(r.layer.listen).toBeUndefined();
  });

  it('listen: a track or family this song lacks is a warning; lines and present tracks are not', () => {
    const w = at(warns(withLayer({ listen: 'horn' })), `${L0}.listen`);
    expect(w).toHaveLength(1);
    expect(w[0].message).toMatch(/has no horn/);
    expect(w[0].message).toMatch(/all notes/);
    expect(at(warns(withLayer({ listen: 'family:brass' })), `${L0}.listen`)[0].message).toMatch(/has no brass/);
    expect(at(warns(withLayer({ listen: 'family:strings' })), `${L0}.listen`)).toEqual([]);
    expect(at(warns(withLayer({ listen: 'violin' })), `${L0}.listen`)).toEqual([]);
    expect(at(warns(withLayer({ listen: 'melody' })), `${L0}.listen`)).toEqual([]);
    expect(at(warns(withLayer({ listen: 'horn' }), { duration: 20 }), `${L0}.listen`)).toEqual([]);   // no tracks known: no warning
  });

  const rg = (patch: Record<string, unknown>) => withLayer({ region: { mode: 'spot', shape: 'ellipse', x: 0.5, y: 0.5, w: 0.3, h: 0.3, ...patch } });
  const R = `${L0}.region`;

  it('region: an unknown mode or shape is an error; repair removes the region', () => {
    for (const [k, v] of [['mode', 'clip'], ['shape', 'star']] as const) {
      const s = rg({ [k]: v });
      expect(at(errs(s), `${R}.${k}`)).toHaveLength(1);
      const r = repaired(s, R);
      expect(r.layer.region).toBeUndefined();
      expect(r.fixed.length).toBeGreaterThan(0);
    }
    expect(at(errs(withLayer({ region: 'centre' })), R)).toHaveLength(1);
    expect(at(errs(rg({ x: 'left' })), `${R}.x`)).toHaveLength(1);
    expect(repaired(rg({ x: 'left' }), R).layer.region).toBeUndefined();
  });

  it('region: w or h outside 0.02..2 is an error; repair clamps', () => {
    const s = rg({ w: 3, h: 0.01 });
    expect(at(errs(s), `${R}.w`)[0].message).toMatch(/outside/);
    expect(at(errs(s), `${R}.h`)).toHaveLength(1);
    const r = repaired(s, R);
    expect([r.layer.region!.w, r.layer.region!.h]).toEqual([2, 0.02]);
    expect(r.fixed.map((f) => f.path)).toEqual([`${R}.w`, `${R}.h`]);
  });

  it('region: a centre off the canvas is a warning', () => {
    expect(at(warns(rg({ x: 1.7 })), `${R}.x`)[0].message).toMatch(/off the canvas/);
    expect(at(warns(rg({ y: -0.6 })), `${R}.y`)).toHaveLength(1);
    expect(warns(rg({ x: 1.5, y: -0.5 }))).toEqual([]);
    expect(errs(rg({ x: 1.7 }))).toEqual([]);
  });

  it('region: feather outside 0..1 is a warning, clamped; rot outside ±180 a warning, wrapped', () => {
    expect(at(warns(rg({ feather: 1.5 })), `${R}.feather`)).toHaveLength(1);
    expect(repaired(rg({ feather: 1.5 }), R).layer.region!.feather).toBe(1);
    expect(repaired(rg({ feather: -0.2 }), R).layer.region!.feather).toBe(0);
    expect(at(warns(rg({ rot: 270 })), `${R}.rot`)[0].message).toMatch(/wrapped/);
    expect(repaired(rg({ rot: 270 }), R).layer.region!.rot).toBe(-90);
    expect(repaired(rg({ rot: -190 }), R).layer.region!.rot).toBe(170);
    expect(repaired(rg({ rot: 180 }), R).fixed).toEqual([]);
  });

  it('region: blend or fit on a spot is a warning; unknown ones are errors, removed', () => {
    expect(at(warns(rg({ blend: 'lighten' })), `${R}.blend`)[0].message).toMatch(/only a window/);
    expect(at(warns(rg({ fit: 'cover' })), `${R}.fit`)).toHaveLength(1);
    expect(warns(rg({ mode: 'window', blend: 'lighten', fit: 'cover' }))).toEqual([]);
    expect(at(errs(rg({ mode: 'window', blend: 'screen' })), `${R}.blend`)).toHaveLength(1);
    expect(repaired(rg({ mode: 'window', blend: 'screen' }), R).layer.region!.blend).toBeUndefined();
    expect(at(errs(rg({ mode: 'window', fit: 'fill' })), `${R}.fit`)).toHaveLength(1);
  });

  const iv = (intensity: unknown) => withLayer({ intensity });
  const I = `${L0}.intensity`;

  it('intensity: not a list of { t, v } is an error; repair removes it or the bad entries', () => {
    expect(at(errs(iv('fade')), I)[0].message).toMatch(/pivots/);
    expect(repaired(iv('fade'), I).layer.intensity).toBeUndefined();
    expect(at(errs(iv([{ t: 1, v: 1 }, { t: 'a', v: 1 }, null])), `${I}[1]`)).toHaveLength(1);
    expect(at(errs(iv([{ t: 1, v: 1 }, null])), `${I}[1]`)).toHaveLength(1);
    expect(repaired(iv([{ t: 1, v: 1 }, { t: 'a', v: 1 }, null]), I).layer.intensity).toEqual([{ t: 1, v: 1 }]);
    expect(repaired(iv([{ v: 1 }]), I).layer.intensity).toBeUndefined();
  });

  it('intensity: unsorted is an error; repair sorts (stable)', () => {
    const s = iv([{ t: 5, v: 1 }, { t: 2, v: 0 }, { t: 5, v: 0.5 }]);
    expect(at(errs(s), I)[0].message).toMatch(/sorted/);
    expect(repaired(s, I).layer.intensity).toEqual([{ t: 2, v: 0 }, { t: 5, v: 1 }, { t: 5, v: 0.5 }]);
  });

  it('intensity: v outside 0..1 is an error, clamped; t outside the clip a warning, clamped', () => {
    expect(at(errs(iv([{ t: 1, v: 1.5 }])), `${I}[0].v`)).toHaveLength(1);
    expect(repaired(iv([{ t: 1, v: 1.5 }, { t: 2, v: -1 }]), I).layer.intensity).toEqual([{ t: 1, v: 1 }, { t: 2, v: 0 }]);
    const out = iv([{ t: -1, v: 1 }, { t: 12, v: 0 }]);
    expect(at(warns(out), `${I}[1].t`)[0].message).toMatch(/outside the clip/);
    expect(errs(out)).toEqual([]);
    expect(repaired(out, I).layer.intensity).toEqual([{ t: 0, v: 1 }, { t: 10, v: 0 }]);
  });

  it('intensity: an unknown shape or a bend outside −1..1 is an error; repair removes or clamps', () => {
    expect(at(errs(iv([{ t: 1, v: 1, shape: 'zig' }])), `${I}[0].shape`)).toHaveLength(1);
    expect(repaired(iv([{ t: 1, v: 1, shape: 'zig' }]), I).layer.intensity).toEqual([{ t: 1, v: 1 }]);
    expect(at(errs(iv([{ t: 1, v: 1, bend: 2 }])), `${I}[0].bend`)).toHaveLength(1);
    expect(repaired(iv([{ t: 1, v: 1, bend: 2 }]), I).layer.intensity).toEqual([{ t: 1, v: 1, bend: 1 }]);
    expect(repaired(iv([{ t: 1, v: 1, bend: 'up' }]), I).layer.intensity).toEqual([{ t: 1, v: 1 }]);
  });

  it(`intensity: more than ${MAX_PIVOTS} pivots is a warning`, () => {
    const many = Array.from({ length: MAX_PIVOTS + 1 }, (_, i) => ({ t: (i * 10) / (MAX_PIVOTS + 1), v: i % 2 }));
    expect(at(warns(iv(many)), I)[0].message).toMatch(/257 pivots/);
    expect(warns(iv(many.slice(0, MAX_PIVOTS)))).toEqual([]);
  });

  it('unknown keys in a region or a pivot are typos (warnings)', () => {
    expect(at(warns(rg({ colour: 'red' })), `${R}.colour`)).toHaveLength(1);
    expect(at(warns(iv([{ t: 1, v: 1, ease: true }])), `${I}[0].ease`)).toHaveLength(1);
  });
});
