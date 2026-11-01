/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import {
  MAX_PIVOTS, canonicalShow, instanceKey, isListen, repairShow, usesV2, validateShow, type Issue, type Layer, type Show, type ShowContext,
} from '../src/studio/show/show';

const SHOWS = resolve(__dirname, '..', 'shows');
const files = readdirSync(SHOWS).filter((f) => f.endsWith('.json')).sort();

const base = (): Show => ({
  version: 1, id: 'demo', song: 'demo',
  sections: [
    { start: 0, end: 10, layers: [{ widget: 'strings' }, { widget: 'squares' }] },
    { start: 10, end: 20, fade: 2, layers: [{ widget: 'strings' }] },
  ],
});
/** base() with section 0's first layer patched. */
const withLayer = (patch: Partial<Layer> | Record<string, unknown>, version: 1 | 2 = 2): Show => {
  const s = base(); s.version = version;
  Object.assign(s.sections[0].layers[0], patch);
  return s;
};
const L0 = 'sections[0].layers[0]';
const at = (list: Issue[], path: string) => list.filter((i) => i.path === path);
const C: ShowContext = { duration: 20, tracks: ['piano', 'violin', 'cello'] };
const errs = (x: unknown, c: ShowContext = C) => validateShow(x, c).errors;
const warns = (x: unknown, c: ShowContext = C) => validateShow(x, c).warnings;
/** repairShow, then: what it fixed at a path, the repaired first layer, and that the result has no errors. */
function repaired(x: Show, path: string) {
  const r = repairShow(x, C);
  expect(validateShow(r.show, C).errors).toEqual([]);
  return { fixed: r.fixed.filter((f) => f.path.startsWith(path)), layer: r.show.sections[0].layers[0], show: r.show };
}

/** The lines of a JSON text without trailing commas, sorted: equal when two texts differ only in key order (and a final newline). */
const lineSet = (text: string) => text.trimEnd().split('\n').map((l) => l.replace(/,$/, '')).sort();

describe('show v2: committed shows', () => {
  // beethoven5 and rach-prelude-recording were committed with "fade" after "layers" (rach also without a final
  // newline), and last night's canonicalShow already rewrote them so (the only differences). Pinned: the bytes are
  // canonical up to key order, nothing in them changes, and chopin-winter-wind (written by canonicalShow) is
  // byte-identical. Since T20 the hand-composed shows route some layers (listen only, so version 2): with every listen
  // taken out, each is still last night's version-1 show, line for line.
  const unrouted = (show: Show): Show => ({
    ...show, sections: show.sections.map((s) => ({ ...s, layers: s.layers.map(({ listen: _l, ...l }) => l) })),
  });
  it.each(files)('%s saves as its version, the same data, canonical up to key order, and validates', (f) => {
    const text = readFileSync(resolve(SHOWS, f), 'utf8').replace(/\r\n/g, '\n');
    const show = JSON.parse(text) as Show;
    const out = canonicalShow(show);
    expect(show.version).toBe(usesV2(show) ? 2 : 1);
    expect(out).toContain(`\n  "version": ${show.version},`);
    expect(JSON.parse(out)).toEqual(show);
    expect(lineSet(out)).toEqual(lineSet(text));
    expect(canonicalShow(JSON.parse(out) as Show)).toBe(out);
    expect(validateShow(show).errors).toEqual([]);
    if (usesV2(unrouted(show))) return;   // edited in the studio since: it has regions or curves, so it stays version 2
    const v1 = canonicalShow(unrouted(show));
    expect(v1).toContain('\n  "version": 1,');
    expect(lineSet(v1)).toEqual(lineSet(text.replace(/\n *"listen": "[^"]*",?/g, '').replace('\n  "version": 2,', '\n  "version": 1,')));
  });

  it('chopin-winter-wind.json is byte-identical', () => {
    const text = readFileSync(resolve(SHOWS, 'chopin-winter-wind.json'), 'utf8').replace(/\r\n/g, '\n');
    expect(canonicalShow(JSON.parse(text) as Show)).toBe(text);
  });

  it.each(files)('a listen turns %s into version 2, and removing it gives the same bytes back', (f) => {
    const text = readFileSync(resolve(SHOWS, f), 'utf8').replace(/\r\n/g, '\n');
    const before = canonicalShow(JSON.parse(text) as Show);
    const routed = JSON.parse(text) as Show;
    // the first layer that listens to all notes (vivaldi-winter.json routes its first one already)
    const [si, li] = routed.sections.flatMap((s, i) => s.layers.map((l, j) => [i, j, l.listen] as const)).find((x) => x[2] === undefined)!;
    const layer = () => routed.sections[si].layers[li];
    layer().listen = 'melody';
    const v2 = canonicalShow(routed);
    expect(v2).toContain('\n  "version": 2,');
    expect(v2).toContain(`"listen": "melody"`);
    expect(Object.keys((JSON.parse(v2) as Show).sections[si].layers[li])[1]).toBe('listen');
    expect(validateShow(JSON.parse(v2)).errors).toEqual([]);
    delete layer().listen;
    expect(canonicalShow(routed)).toBe(before);
    layer().listen = 'all';   // 'all' is all notes: nothing to write
    expect(canonicalShow(routed)).toBe(before);
  });
});

describe('show v2: canonical form', () => {
  const full = (): Show => withLayer({
    // keys deliberately out of order, with an unknown one and long decimals
    intensity: [{ v: 0.123456, t: 1.23456 }, { bend: 0.333333, shape: 'ease', v: 1, t: 5 }, { t: 9, v: 0 }],
    region: { fit: 'cover', blend: 'lighten', feather: 0.3, rot: 12.3456789, h: 0.4, w: 0.5, y: 0.25, x: 0.333333333, shape: 'ellipse', mode: 'window', junk: 1 },
    restart: true, knobs: { size: 1 }, listen: 'melody',
  } as Record<string, unknown>, 1);

  it('writes version 2, keys in schema order, rounded numbers and one line per pivot', () => {
    const text = canonicalShow(full());
    expect(text).toContain('\n  "version": 2,');
    const layer = (JSON.parse(text) as Show).sections[0].layers[0];
    expect(Object.keys(layer)).toEqual(['widget', 'listen', 'knobs', 'restart', 'region', 'intensity']);
    expect(Object.keys(layer.region!)).toEqual(['mode', 'shape', 'x', 'y', 'w', 'h', 'rot', 'feather', 'blend', 'fit']);
    expect(layer.region!.x).toBe(0.3333);
    expect(layer.region!.rot).toBe(12.3457);
    expect(text).toContain('\n            { "t": 1.235, "v": 0.1235 },\n');
    expect(text).toContain('\n            { "t": 5, "v": 1, "shape": "ease", "bend": 0.3333 },\n');
    expect(text).toContain('\n            { "t": 9, "v": 0 }\n');
    expect(text).not.toContain('junk');
  });

  it('is a fixed point', () => {
    const once = canonicalShow(full());
    expect(canonicalShow(JSON.parse(once) as Show)).toBe(once);
  });

  it('an empty intensity and listen all are version 1 and are left out', () => {
    const s = withLayer({ intensity: [], listen: 'all' }, 1);
    expect(usesV2(s)).toBe(false);
    expect(canonicalShow(s)).toBe(canonicalShow(base()));
    expect(usesV2(withLayer({ region: { mode: 'spot', shape: 'rect', x: 0.5, y: 0.5, w: 0.2, h: 0.2 } }))).toBe(true);
    expect(usesV2(withLayer({ intensity: [{ t: 1, v: 1 }] }))).toBe(true);
  });

  it('MAX_PIVOTS is the shared one', () => {
    expect(MAX_PIVOTS).toBe(loadLayers().MAX_PIVOTS);
  });
});

describe('instanceKey and isListen', () => {
  it('keys', () => {
    expect(instanceKey({ widget: 'strings' })).toBe('strings');
    expect(instanceKey({ widget: 'strings', listen: 'all' })).toBe('strings');
    expect(instanceKey({ widget: 'strings', listen: 'melody' })).toBe('strings@melody');
    expect(instanceKey({ widget: 'strings', listen: 'family:brass' })).toBe('strings@family:brass');
  });
  it('parts', () => {
    for (const x of ['all', 'piano', 'horn', 'saxophone', 'family:strings', 'family:voice', 'melody', 'bassline', 'inner', 'low', 'high', 'accents']) expect(isListen(x)).toBe(true);
    for (const x of ['', 'Melody', 'drums', 'family:', 'family:drums', 'family:melody', 3, null, undefined]) expect(isListen(x)).toBe(false);
  });
});

describe('show v2: validation and repair (§5)', () => {
  it('a v2 show with every field passes', () => {
    const s = withLayer({ listen: 'violin', region: { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 0.4, h: 0.3, rot: 10, feather: 0.2, blend: 'lighten', fit: 'contain' },
      intensity: [{ t: 0, v: 0 }, { t: 5, v: 1, shape: 'ease' }, { t: 10, v: 0.5, shape: 'linear', bend: -0.5 }] });
    expect(validateShow(s, C)).toEqual({ errors: [], warnings: [] });
  });

  it('version: 1 or 2; 1 with v2 fields is a warning; others are errors', () => {
    expect(validateShow({ ...base(), version: 2 }, C)).toEqual({ errors: [], warnings: [] });
    const w = at(warns(withLayer({ listen: 'melody' }, 1)), 'version');
    expect(w).toHaveLength(1);
    expect(w[0].message).toMatch(/version-2 fields/);
    expect(errs(withLayer({ listen: 'melody' }, 1))).toEqual([]);
    for (const v of [0, 3, '2', null]) expect(at(errs({ ...base(), version: v }), 'version')).toHaveLength(1);
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

  it('the same instance key twice in a section is an error (overlap); repair drops the second', () => {
    const s = base(); s.version = 2;
    s.sections[0].layers = [{ widget: 'strings', listen: 'melody' }, { widget: 'strings' }, { widget: 'strings', listen: 'melody', knobs: { size: 1 } }];
    const e = at(errs(s), 'sections[0].layers[2].listen');
    expect(e).toHaveLength(1);
    expect(e[0].message).toMatch(/overlap/);
    expect(e[0].message).toMatch(/strings@melody/);
    const r = repairShow(s, C);
    expect(r.show.sections[0].layers.map(instanceKey)).toEqual(['strings@melody', 'strings']);
    expect(r.fixed.some((f) => f.path === 'sections[0].layers[2]')).toBe(true);
    // the same widget on two parts is fine
    s.sections[0].layers = [{ widget: 'strings', listen: 'melody' }, { widget: 'strings', listen: 'bassline' }, { widget: 'strings' }];
    expect(errs(s)).toEqual([]);
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

  it('intensity: v outside 0..1 is an error, clamped; t outside the section a warning, clamped', () => {
    expect(at(errs(iv([{ t: 1, v: 1.5 }])), `${I}[0].v`)).toHaveLength(1);
    expect(repaired(iv([{ t: 1, v: 1.5 }, { t: 2, v: -1 }]), I).layer.intensity).toEqual([{ t: 1, v: 1 }, { t: 2, v: 0 }]);
    const out = iv([{ t: -1, v: 1 }, { t: 12, v: 0 }]);
    expect(at(warns(out), `${I}[1].t`)[0].message).toMatch(/outside the section/);
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
