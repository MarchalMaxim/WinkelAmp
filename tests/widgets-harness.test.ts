/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { evalLabHarness, LAB_FIRST_MOMENT, momentAt, widgetOrder } from '../src/widgets/lab-harness';
import { labRandom } from '../src/widgets/random';

const ROOT = new URL('../', import.meta.url);
const HTML = readFileSync(new URL('lab/index.html', ROOT), 'utf8');
const HARNESS = readFileSync(new URL('lab/harness.js', ROOT), 'utf8');
const KIT_SRC = readFileSync(new URL('lab/kit.js', ROOT), 'utf8');

describe('evalLabHarness (the real lab/harness.js)', () => {
  const h = evalLabHarness(HARNESS, KIT_SRC);

  it('lists the widgets that have an order, each with a file', () => {
    expect(h.order).toContain('casket');
    for (const id of h.order) expect(existsSync(new URL(`lab/tools/${id}.js`, ROOT)), id).toBe(true);
  });

  it('reads the verdicts', () => {
    expect(h.verdicts.casket.v).toBe('love');
  });

  it('reads the drives with their words', () => {
    expect(h.drives[0]).toEqual(['', 'fixed']);
    expect(h.drives).toContainEqual(['+density', 'fuller chords → more']);
    expect(h.drives).toContainEqual(['+rel', 'louder than around it → more']);
  });

  it('makes a fresh ICON library each time', () => {
    const icon = h.makeIcon();
    expect(typeof icon.gauge).toBe('function');
    expect(typeof icon.of.size).toBe('function');
    expect(icon.ink).toBe('#e9e2da');
    expect(h.makeIcon()).not.toBe(icon);
  });

  it('reads the songs with their notes file, length and moments', () => {
    const songs = h.songs;
    expect(songs.prelude.notes).toBe('notes.js');
    expect(songs.prelude.dur).toBeCloseTo(232.1);
    expect(songs.prelude.moments).toContainEqual([124, 'casket', 'The casket']);
    expect(songs.b5.notes).toBe('notes-b5.js');
    expect(songs.b5.moments[0]).toEqual([0, 'casket', 'Fate knocks']);
  });

  it('runs in a vm realm whose global is window, and sets only window.LAB', () => {
    const ctx = createContext({ document: {} } as Record<string, unknown>);
    runInContext('this.window = this;', ctx);
    runInContext(HARNESS, ctx);
    const lab = (ctx as { window: { LAB: Record<string, unknown> } }).window.LAB;
    expect(Object.keys(lab).sort()).toEqual(['DRIVES', 'ORDER', 'SONGS', 'VERDICTS', 'makeIcon']);
    expect(Object.keys(ctx).sort()).toEqual(['LAB', 'document', 'window']);
  });

  it('names what is wrong', () => {
    expect(() => evalLabHarness('', KIT_SRC)).toThrow(/window.LAB/);
    expect(() => evalLabHarness(HARNESS.replace("pack: 'pack-prelude.js'", 'pack: 7'), KIT_SRC)).toThrow(/SONGS.prelude.pack/);
    expect(() => evalLabHarness(HARNESS.replace("pack: 'pack-prelude.js'", "pack: '../x.js'"), KIT_SRC)).toThrow(/SONGS.prelude.pack/);
  });

  it('the first moment the lab holds before any step', () => {
    expect(LAB_FIRST_MOMENT).toBe('dread');
    expect(HTML).toMatch(/moment: 'dread',/);
  });
});

describe('widgetOrder', () => {
  it('puts the ordered ids that exist first, then the rest by name', () => {
    expect(widgetOrder(['b', 'gone', 'a'], ['z', 'a', 'c', 'b'])).toEqual(['b', 'a', 'c', 'z']);
  });
  it('lists an id once and accepts any iterable', () => {
    expect(widgetOrder(['a', 'a'], new Set(['a', 'b']))).toEqual(['a', 'b']);
    expect(widgetOrder([], [])).toEqual([]);
  });
});

describe('momentAt', () => {
  const m: [number, string, string?][] = [[0, 'dread', 'Dread'], [83, 'agitato', 'Agitato'], [124, 'casket'], [208, 'agitato']];

  it('the mood name of the last moment started by t', () => {
    expect(momentAt(m, 0)).toBe('dread');
    expect(momentAt(m, 82.99)).toBe('dread');
    expect(momentAt(m, 83)).toBe('agitato');
    expect(momentAt(m, 124)).toBe('casket');
    expect(momentAt(m, 500)).toBe('agitato');
  });

  it('the first mood before the first moment (a preroll seeks before 0)', () => {
    expect(momentAt(m, -3)).toBe('dread');
    expect(momentAt([[10, 'casket']], 2)).toBe('casket');
  });
});

describe('labRandom', () => {
  // The lab's render-mode generator, cut out of lab/index.html and run as it is there.
  const m = /Math\.random = (\(\) => \{[^\n]*\});/.exec(HTML);
  const labGen = (n: number) => new Function('n', `let seed = (n >>> 0) || 1; return ${m![1]};`)(n) as () => number;

  it.each([1, 42])('seed %i gives the lab sequence', (seed) => {
    expect(m).not.toBeNull();
    const a = labRandom(seed), b = labGen(seed);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('seed 0 is seed 1, as the lab reseeds', () => {
    const a = labRandom(0), b = labRandom(1);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });
});
