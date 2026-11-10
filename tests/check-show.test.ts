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
const show = (clips: [number, number, string, number?][]) => ({
  version: 3, id: 'demo', song: 'demo', clips: clips.map(([start, end, widget, track], i) => ({ id: `c${i + 1}`, start, end, track: track ?? 0, widget })),
});

describe('a region\'s blend', () => {
  const withBlend = (blend: unknown) => ({ ...show([[0, 50, 'squares']]),
    clips: [{ id: 'c1', start: 0, end: 50, track: 0, widget: 'squares', region: { mode: 'window', shape: 'rect', x: 0.5, y: 0.5, w: 0.4, h: 0.4, blend } }] });
  it('takes clear, over and lighten, and nothing else', () => {
    for (const blend of ['clear', 'over', 'lighten']) expect(validateShow(withBlend(blend), { duration: 100 }).errors).toEqual([]);
    expect(validateShow(withBlend('key'), { duration: 100 }).errors.map((e) => e.path)).toEqual(['clips[0].region.blend']);
  });
});

describe('npm run check-show', () => {
  it('passes a good show and checks every show in shows/ by default', () => {
    writeFileSync(join(shows, 'demo.json'), JSON.stringify(show([[0, 50, 'squares'], [50, 100, 'kandinsky']])));
    const r = check([]);
    expect(r.out).toMatch(/demo\.json: ok/);
    expect(r.code).toBe(0);
  }, 60_000);

  it('exits 1 on an overlap on one track, naming the other clip; overlaps across tracks are fine', () => {
    const f = join(tmp, 'overlap.json');
    writeFileSync(f, JSON.stringify(show([[0, 50, 'squares'], [45, 100, 'kandinsky']])));
    const r = check([f]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/clips\[1\]\.track: overlaps clips\[0\]/);
    writeFileSync(f, JSON.stringify(show([[0, 50, 'squares'], [45, 100, 'kandinsky', 1]])));
    expect(check([f]).code).toBe(0);
  }, 60_000);

  it('says that an old show is not read, and --fix leaves it alone', () => {
    const f = join(tmp, 'old.json');
    const text = JSON.stringify({ version: 2, id: 'demo', song: 'demo', sections: [{ start: 0, end: 100, layers: [{ widget: 'squares' }] }] });
    writeFileSync(f, text);
    const r = check(['--fix', f]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/version 2: this studio reads version 3/);
    expect(readFileSync(f, 'utf8')).toBe(text);
  }, 60_000);

  it('warns of a clip past the song\'s end, from the pack', () => {
    const f = join(tmp, 'long.json');
    writeFileSync(f, JSON.stringify(show([[0, 110, 'squares']])));
    const r = check([f]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/clips\[0\]\.end: .*110.*100/);
  }, 60_000);

  it('--fix writes the canonical repair: the later clip goes up a track, what cannot play goes', () => {
    const f = join(tmp, 'fixme.json');
    writeFileSync(f, JSON.stringify(show([[0, 50, 'squares'], [45, 100, 'kandinsky'], [101, 102, 'squares'], [50, 60, 'nope', 2]])));
    const r = check(['--fix', f]);
    expect(r.code).toBe(0);
    const text = readFileSync(f, 'utf8'), fixed = JSON.parse(text) as Show;
    expect(fixed.clips.map((c) => [c.id, c.start, c.end, c.track])).toEqual([['c1', 0, 50, 0], ['c2', 45, 100, 1]]);
    expect(text).toBe(canonicalShow(fixed));
    expect(validateShow(fixed, { duration: 100 }).errors).toEqual([]);
  }, 60_000);

  it('--fix says what it drops with a misspelled property, and warns about what it wrote', () => {
    const f = join(tmp, 'typo.json');
    const s = show([[0, 50, 'squares'], [50, 100, 'kandinsky']]);
    Object.assign(s.clips[0], { knob: { size: 1 }, knobs: { nonsense: 1 } });
    writeFileSync(f, JSON.stringify(s));
    const r = check(['--fix', f]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/fixed clips\[0\]\.knob: .*\{"size":1\}/);
    expect(r.out).not.toMatch(/warning clips\[0\]\.knob:/);
    expect(r.out).toMatch(/warning clips\[0\]\.knobs\.nonsense:/);   // kept in the file, so still a warning
    expect(r.out).toMatch(/typo\.json: ok, 1 warning/);
    const written = JSON.parse(readFileSync(f, 'utf8'));
    expect(written.clips[0]).toEqual({ id: 'c1', start: 0, end: 50, track: 0, widget: 'squares', knobs: { nonsense: 1 } });
  }, 60_000);

  it('warns about a listen naming a track or family the song lacks (the pack\'s tracks), not one it has', () => {
    mkdirSync(join(songs, 'band'), { recursive: true });
    writeFileSync(join(songs, 'band', 'pack.json'), JSON.stringify({ duration: 100, tracks: { violin: {}, cello: {} } }));
    const f = join(tmp, 'band.json');
    const clip = (id: string, start: number, track: number, widget: string, listen: string) => ({ id, start, end: start + 50, track, widget, listen });
    writeFileSync(f, JSON.stringify({ version: 3, id: 'band', song: 'band', clips: [
      clip('a', 0, 0, 'squares', 'horn'), clip('b', 0, 1, 'kandinsky', 'violin'),
      clip('c', 50, 0, 'squares', 'family:brass'), clip('d', 50, 1, 'kandinsky', 'family:strings'),
    ] }));
    const r = check([f]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warning clips\[0\]\.listen: this song has no horn: it plays on all notes/);
    expect(r.out).toMatch(/warning clips\[2\]\.listen: this song has no brass track: it plays on all notes/);
    expect(r.out).not.toMatch(/clips\[1\]\.listen/);
    expect(r.out).toMatch(/band\.json: ok, 2 warnings/);
  }, 60_000);

  const picked = (listen: string) => ({ version: 3, id: 'picked', song: 'demo', clips: [
    { id: 'c1', start: 0, end: 50, track: 0, widget: 'squares' }, { id: 'c2', start: 0, end: 50, track: 1, widget: 'pointillism', listen },
    { id: 'c3', start: 50, end: 100, track: 0, widget: 'kandinsky' },
  ], picks: { p1: { notes: [[1, 2, 60, 80], [3, 4, 62, 90]] } } });

  it('passes a file with a valid set of picks', () => {
    const f = join(tmp, 'picked.json');
    writeFileSync(f, JSON.stringify(picked('picks:p1')));
    const r = check([f]);
    expect(r.out).toMatch(/picked\.json: ok\r?\n/);
    expect(r.code).toBe(0);
  }, 60_000);

  it('exits 1 on a listen with no set; --fix drops the clip, never the plain widget', () => {
    const f = join(tmp, 'dangling.json');
    writeFileSync(f, JSON.stringify(picked('picks:p9')));
    const r = check([f]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/clips\[1\]\.listen: .*no set/);
    const x = check(['--fix', f]);
    expect(x.code).toBe(0);
    expect(x.out).toMatch(/fixed clips\[1\]: .*dropped/);
    const written = JSON.parse(readFileSync(f, 'utf8')) as Show;
    expect(validateShow(written, { duration: 100 }).errors).toEqual([]);
    expect(written.clips.map((c) => c.widget)).toEqual(['squares', 'kandinsky']);
  }, 60_000);

  it('exits 1 on a file that is not JSON', () => {
    const f = join(tmp, 'broken.json');
    writeFileSync(f, '{ nope');
    expect(check([f]).code).toBe(1);
  }, 60_000);
});

describe('npm run check-show -- --summary', () => {
  const full = {
    ...show([[0, 50, 'squares'], [50, 100, 'kandinsky', 1]]),
    clips: [
      { id: 'c1', start: 0, end: 50, track: 0, widget: 'squares', knobs: { size: 3, speed: 1 }, thin: 'loud', fade: 2, intensity: [{ t: 0, v: 1 }, { t: 50, v: 0.2 }] },
      { id: 'c2', start: 50, end: 100, track: 1, widget: 'kandinsky', listen: 'picks:p1' },
    ],
    picks: { p1: { notes: [[50.5, 51, 60, 80], [60, 61, 62, 80]] } },
  };

  it('prints a line per clip and per set of picks, without the notes, by path or by show id', () => {
    const f = join(tmp, 'summary.json');
    writeFileSync(f, JSON.stringify(full));
    writeFileSync(join(shows, 'summary.json'), JSON.stringify(full));
    const lines = [f, 'summary'].map((which) => check(['--summary', which]).out.trimEnd().split(/\r?\n/));
    expect(lines[1]).toEqual(lines[0]);
    expect(lines[0]).toEqual([
      'demo  song demo  2 clips',
      'c1  0-50  track 0  squares  listen all  knobs size,speed  thin=loud fade=2 intensity(2)',
      'c2  50-100  track 1  kandinsky  listen picks:p1  knobs -',
      'picks p1  2 notes  50.5-60',
    ]);
  }, 60_000);

  it('exits 1 on a show that is not there', () => {
    expect(check(['--summary', 'nowhere']).code).toBe(1);
  }, 60_000);
});
