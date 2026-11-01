/// <reference types="node" />
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { canonicalShow, validateShow, type Show } from '../src/studio/show/show';

const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)));
const tmp = mkdtempSync(join(tmpdir(), 'wa-check-show-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const shows = join(tmp, 'shows'), songs = join(tmp, 'songs');
mkdirSync(shows); mkdirSync(join(songs, 'demo'), { recursive: true });
writeFileSync(join(songs, 'demo', 'pack.json'), JSON.stringify({ duration: 100 }));

function check(args: string[]) {
  const r = spawnSync(process.execPath, ['--import', 'tsx', join(REPO, 'scripts', 'check-show.ts'), ...args], {
    cwd: REPO, encoding: 'utf8', env: { ...process.env, WINKELAMP_SHOWS: shows, WINKELAMP_SONGS: songs }, timeout: 60_000,
  });
  return { code: r.status, out: r.stdout + r.stderr };
}
const show = (sections: [number, number, string][]) => ({
  version: 1, id: 'demo', song: 'demo', sections: sections.map(([start, end, widget]) => ({ start, end, layers: [{ widget }] })),
});

describe('npm run check-show', () => {
  it('passes a good show and checks every show in shows/ by default', () => {
    writeFileSync(join(shows, 'demo.json'), JSON.stringify(show([[0, 50, 'squares'], [50, 100, 'kandinsky']])));
    const r = check([]);
    expect(r.out).toMatch(/demo\.json: ok/);
    expect(r.code).toBe(0);
  }, 60_000);

  it('exits 1 naming both overlapping sections and the times', () => {
    const f = join(tmp, 'overlap.json');
    writeFileSync(f, JSON.stringify(show([[0, 50, 'squares'], [45, 100, 'kandinsky']])));
    const r = check([f]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/sections\[1\]\.start: .*sections\[1\].*45.*sections\[0\].*50.*overlap/);
  }, 60_000);

  it('checks the end against the pack', () => {
    const f = join(tmp, 'short.json');
    writeFileSync(f, JSON.stringify(show([[0, 50, 'squares'], [50, 90, 'kandinsky']])));
    const r = check([f]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/sections\[1\]\.end: .*90.*100/);
  }, 60_000);

  it('--fix writes the canonical repair', () => {
    const f = join(tmp, 'fixme.json');
    writeFileSync(f, JSON.stringify(show([[0, 50, 'squares'], [45, 100, 'kandinsky'], [100, 100.3, 'nope']])));
    const r = check(['--fix', f]);
    expect(r.code).toBe(0);
    const text = readFileSync(f, 'utf8'), fixed = JSON.parse(text) as Show;
    expect(fixed.sections.map((s) => [s.start, s.end])).toEqual([[0, 45], [45, 100.3]]);   // the 0.3 s section merged in; 100.3 is within 0.5 s of the end
    expect(text).toBe(canonicalShow(fixed));
    expect(validateShow(fixed, { duration: 100 }).errors).toEqual([]);
  }, 60_000);

  it('--fix says what it drops with a misspelled property, and warns about what it wrote', () => {
    const f = join(tmp, 'typo.json');
    const s = show([[0, 50, 'squares'], [50, 100, 'kandinsky']]);
    Object.assign(s.sections[0].layers[0], { knob: { size: 1 }, knobs: { nonsense: 1 } });
    writeFileSync(f, JSON.stringify(s));
    const r = check(['--fix', f]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/fixed sections\[0\]\.layers\[0\]\.knob: .*\{"size":1\}/);
    expect(r.out).not.toMatch(/warning sections\[0\]\.layers\[0\]\.knob:/);
    expect(r.out).toMatch(/warning sections\[0\]\.layers\[0\]\.knobs\.nonsense:/);   // kept in the file, so still a warning
    expect(r.out).toMatch(/typo\.json: ok, 1 warning/);
    const written = JSON.parse(readFileSync(f, 'utf8'));
    expect(written.sections[0].layers[0]).toEqual({ widget: 'squares', knobs: { nonsense: 1 } });
  }, 60_000);

  it('warns about a listen naming a track or family the song lacks (the pack\'s tracks), not one it has', () => {
    mkdirSync(join(songs, 'band'), { recursive: true });
    writeFileSync(join(songs, 'band', 'pack.json'), JSON.stringify({ duration: 100, tracks: { violin: {}, cello: {} } }));
    const f = join(tmp, 'band.json');
    writeFileSync(f, JSON.stringify({ version: 2, id: 'band', song: 'band', sections: [
      { start: 0, end: 50, layers: [{ widget: 'squares', listen: 'horn' }, { widget: 'kandinsky', listen: 'violin' }] },
      { start: 50, end: 100, layers: [{ widget: 'squares', listen: 'family:brass' }, { widget: 'kandinsky', listen: 'family:strings' }] },
    ] }));
    const r = check([f]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warning sections\[0\]\.layers\[0\]\.listen: this song has no horn: it plays on all notes/);
    expect(r.out).toMatch(/warning sections\[1\]\.layers\[0\]\.listen: this song has no brass track: it plays on all notes/);
    expect(r.out).not.toMatch(/layers\[1\]\.listen/);
    expect(r.out).toMatch(/band\.json: ok, 2 warnings/);
  }, 60_000);

  it('exits 1 on a file that is not JSON', () => {
    const f = join(tmp, 'broken.json');
    writeFileSync(f, '{ nope');
    expect(check([f]).code).toBe(1);
  }, 60_000);
});
