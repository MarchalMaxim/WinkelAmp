/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import { evalLayers } from '../src/widgets/layers';

describe('evalLayers', () => {
  it('runs every source on one object', () => {
    const WA = evalLayers({ 'b.js': 'WA.two = () => 2; WA.sawOne = WA.one;', 'a.js': 'WA.one = 1;' }) as unknown as Record<string, any>;
    expect(WA.one).toBe(1);
    expect(WA.two()).toBe(2);
  });

  it('evaluates the files in name order: b.js sees what a.js defined', () => {
    const WA = evalLayers({ 'b.js': 'WA.sawOne = WA.one;', 'a.js': 'WA.one = 1;' }) as unknown as Record<string, any>;
    expect(WA.sawOne).toBe(1);
  });

  it('throws, naming the file, when a source throws or does not parse', () => {
    expect(() => evalLayers({ 'a.js': 'WA.one = 1;', 'boom.js': "throw new Error('no');" })).toThrow(/boom\.js: no/);
    expect(() => evalLayers({ 'bad.js': 'WA.x = ;' })).toThrow(/bad\.js/);
  });

  it('runs a lab file in the lab wrapper form, without touching globalThis', () => {
    const src = "(function (WA) { WA.k = 3; })(typeof WA !== 'undefined' ? WA : (globalThis.WA_LAYERS ??= {}));";
    const WA = evalLayers({ 'k.js': src }) as unknown as Record<string, any>;
    expect(WA.k).toBe(3);
    expect((globalThis as Record<string, unknown>).WA_LAYERS).toBeUndefined();
  });
});

describe('loadLayers (lab/layers on disk)', () => {
  const WA = loadLayers();

  it('has persist.js: vis on the table nodes and between them', () => {
    expect(WA.vis(0.5, 'redraw')).toBe(0.15);
    expect(WA.vis(0.4, 'strokes')).toBe(0.4);
    for (const [x, y] of WA.VIS_REDRAW) expect(WA.vis(x, 'redraw')).toBe(y);
    expect(WA.vis(0.05, 'redraw')).toBeCloseTo(0.022, 12);
    expect(WA.vis(0.95, 'redraw')).toBeCloseTo(0.7805, 12);
    expect(WA.vis(-1, 'redraw')).toBe(0);
    expect(WA.vis(2, 'redraw')).toBe(1);
    expect(WA.vis(1.5, 'strokes')).toBe(1);
    expect(WA.vis(Number.NaN, 'strokes')).toBe(0);
  });

  it('is monotonic on the redraw class', () => {
    let last = -1;
    for (let i = 0; i <= 1000; i++) { const v = WA.vis(i / 1000, 'redraw'); expect(v).toBeGreaterThanOrEqual(last); last = v; }
  });

  it('keeps the PERSIST block between its markers, for persist-probe to rewrite', () => {
    const src = readFileSync(new URL('../lab/layers/persist.js', import.meta.url), 'utf8');
    expect(src).toMatch(/\/\/ persist:start\n\s*WA\.PERSIST = \{[^]*?\};\n\s*\/\/ persist:end/);
    expect(typeof WA.PERSIST).toBe('object');
  });
});
