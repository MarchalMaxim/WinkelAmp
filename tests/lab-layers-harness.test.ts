/// <reference types="node" />
// The lab runs layers: its SONGS may name a pack file, and it loads the shared layer code.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evalLabHarness } from '../src/widgets/lab-harness';

const ROOT = new URL('../', import.meta.url);
const HTML = readFileSync(new URL('lab/index.html', ROOT), 'utf8');

const HARNESS = readFileSync(new URL('lab/harness.js', ROOT), 'utf8');
const KIT_SRC = readFileSync(new URL('lab/kit.js', ROOT), 'utf8');

describe('the songs and the pack file', () => {
  it('a song need not have a pack', () => {
    const copy = HARNESS.replace("pack: 'pack-prelude.js', ", '');
    expect(copy).not.toBe(HARNESS);
    expect(evalLabHarness(copy, KIT_SRC).songs.prelude.pack).toBeUndefined();
  });

  it('names the pack files that npm run lab-notes writes, for every song', () => {
    const { songs } = evalLabHarness(HARNESS, KIT_SRC);
    expect(songs.b5.pack).toBe('pack-beethoven5.js');
    expect(songs['vivaldi-winter'].pack).toBe('pack-vivaldi-winter.js');
    for (const [id, song] of Object.entries(songs)) expect(song.pack, id).toMatch(/^pack-[a-z0-9-]+.js$/);
  });

  it('refuses a pack that is not a pack-<id>.js file name', () => {
    const bad = HARNESS.replace("pack: 'pack-prelude.js'", "pack: '../songs/x.json'");
    expect(bad).not.toBe(HARNESS);
    expect(() => evalLabHarness(bad, KIT_SRC)).toThrow(/SONGS.prelude.pack/);
    expect(() => evalLabHarness(HARNESS.replace("pack: 'pack-prelude.js'", 'pack: 3'), KIT_SRC)).toThrow(/SONGS.prelude.pack/);
  });
});

describe('the shared layer code in the lab', () => {
  it('loads every lab/layers/*.js as a classic script, in file-name order (as evalLayers), before the tools', () => {
    const files = readdirSync(new URL('lab/layers/', ROOT)).filter((f) => f.endsWith('.js')).sort();
    expect(files.length).toBeGreaterThan(0);
    const at = files.map((f) => HTML.indexOf(`<script src="layers/${f}"></script>`));
    for (const [i, f] of files.entries()) expect(at[i], f).toBeGreaterThan(0);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(at[at.length - 1]).toBeLessThan(HTML.indexOf('async function loadTools('));
  });

  it("never reads the layer store in render mode", () => {
    expect(HTML).toMatch(/if \(!RENDER\) LAYERS = JSON\.parse\(localStorage\.getItem\('wa-layers'\)/);
  });
});
