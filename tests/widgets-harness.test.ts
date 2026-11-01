/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LAB_FIRST_MOMENT, makeIcon, momentAt, readLabHarness, readLabSongs } from '../src/widgets/lab-harness';
import { labRandom } from '../src/widgets/random';

const ROOT = new URL('../', import.meta.url);
const HTML = readFileSync(new URL('lab/index.html', ROOT), 'utf8');

describe('readLabHarness (the real lab/index.html)', () => {
  const h = readLabHarness(HTML);

  it('reads TOOL_IDS in card order, each with a file', () => {
    // relative order (the lab puts new widgets in front of these)
    expect(['harmonograph', 'hilma', 'kline'].map((id) => h.toolIds.indexOf(id))).toEqual(
      ['harmonograph', 'hilma', 'kline'].map((id) => h.toolIds.indexOf(id)).sort((a, b) => a - b));
    expect(h.toolIds.indexOf('harmonograph')).toBeGreaterThanOrEqual(0);
    expect(h.toolIds).toContain('casket');
    for (const id of h.toolIds) expect(existsSync(new URL(`lab/tools/${id}.js`, ROOT)), id).toBe(true);
  });

  it('reads the verdicts', () => {
    expect(h.verdicts.casket.v).toBe('love');
    expect(h.verdicts.fields.v).toBe('keep');
  });

  it('reads the drives with their words', () => {
    expect(h.drives.length).toBe(11);
    expect(h.drives[0]).toEqual(['', 'fixed']);
    expect(h.drives).toContainEqual(['+density', 'fuller chords → more']);
  });

  it('builds the ICON library from its source', () => {
    const icon = makeIcon(h.iconSource);
    for (const k of 'dot ring square rect line arrow lines dots wave blur alpha palette pie fade shake keys trail glyph shape gauge rng lerp'.split(' '))
      expect(typeof icon[k], k).toBe('function');
    expect(typeof icon.of.size).toBe('function');
    expect(icon.ink).toBe('#e9e2da');
  });

  it('names a missing block', () => {
    expect(() => readLabHarness('<html></html>')).toThrow(/TOOL_IDS/);
  });
});

describe('readLabSongs (the real lab/index.html)', () => {
  const songs = readLabSongs(HTML);

  it('reads both songs with their notes file, length and moments', () => {
    expect(songs.prelude.notes).toBe('notes.js');
    expect(songs.prelude.dur).toBeCloseTo(232.1);
    expect(songs.prelude.moments).toContainEqual([124, 'casket', 'The casket']);
    expect(songs.prelude.moments).toContainEqual([208, 'agitato']);
    expect(songs.b5.notes).toBe('notes-b5.js');
    expect(songs.b5.moments[0]).toEqual([0, 'casket', 'Fate knocks']);
  });

  it('names a missing block', () => {
    expect(() => readLabSongs('<html></html>')).toThrow(/SONGS/);
  });

  it('the first moment the lab holds before any step', () => {
    expect(LAB_FIRST_MOMENT).toBe('dread');
    expect(HTML).toMatch(/moment: 'dread',/);
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
