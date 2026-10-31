/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeIcon, readLabHarness } from '../src/widgets/lab-harness';
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
