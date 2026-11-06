// Prickle (lab/tools/prickle.js, plan docs/mockups/nature/plans/prickle.md): one flat thorn per note, from the side edges only, struck
// red with a bone tip, held still as a lighten tone, withdrawn straight back when the next note lands. Stateless from CHORDS.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadCatalogue } from '../scripts/node/catalogue';
import { groupChords } from '../src/widgets/chords';
import { instantiate } from '../src/widgets/instantiate';
import type { Chord, IconLib, Note, ToolDef, WidgetCtx } from '../src/widgets/types';

/** A 2D context that writes every call and every set into `log` (numbers to 3 places). */
function recorder(log: string[]) {
  const fmt = (v: unknown): string => typeof v === 'number' ? v.toFixed(3) : typeof v === 'object' ? 'obj' : String(v);
  const grad = { addColorStop() {} };
  return (canvas: unknown) => new Proxy({ canvas } as Record<string, unknown>, {
    get: (o, k) => k in o ? o[k as string] : (...a: unknown[]) => { log.push(`${String(k)}(${a.map(fmt).join(',')})`); return grad; },
    set: (o, k, v) => { o[k as string] = v; log.push(`${String(k)}=${fmt(v)}`); return true; },
  });
}

const SRC = readFileSync(new URL('../lab/tools/prickle.js', import.meta.url), 'utf8');
const BONE = 'fillStyle=rgb(236,226,208)';

// (a) the flee test's 40-note melody plus bass; (b) one lone note; (c) a 4-note chord, then one note.
const SONG_A: Note[] = [];
for (let i = 0; i < 40; i++) SONG_A.push([0.5 + i * 0.21, 0.7 + i * 0.21, 60 + ((i * 7) % 24), 60 + ((i * 13) % 50)]);
for (let i = 0; i < 6; i++) SONG_A.push([1 + i * 1.3, 1.5 + i * 1.3, 36 + i, 110]);
SONG_A.sort((a, b) => a[0] - b[0]);
const SONG_B: Note[] = [[0.5, 0.7, 64, 90]];
const SONG_C: Note[] = [[0.5, 0.9, 55, 80], [0.5, 0.9, 60, 90], [0.5, 0.9, 64, 100], [0.5, 0.9, 67, 70], [1.0, 1.3, 72, 95]];

const G = globalThis as Record<string, unknown>;
let saved: Record<string, unknown>;
beforeAll(() => { saved = { document: G.document, window: G.window }; });
afterAll(() => { G.document = saved.document; G.window = saved.window; });

/** Plays a song in one fresh prickle for `secs` at 60 Hz; returns each frame's draw log (index = frame number, 1-based). */
function play(notes: Note[], knobs: Record<string, number> = {}, secs = 4, { randomThrows = false, onlyFrame = -1 } = {}) {
  G.window = { NOTES: notes };
  const chords: Chord[] = groupChords(notes);
  const log: string[] = [], rec = recorder(log);
  G.document = { createElement: () => { const c: Record<string, unknown> = { width: 0, height: 0 }; c.getContext = () => (c.g ??= rec(c)); return c; } };
  const tool = instantiate('prickle', SRC, { icon: { ink: '#fff', gauge() {}, red: '#c43a2c' } as unknown as IconLib, chords }) as ToolDef & Record<string, (...a: unknown[]) => void>;
  const vals = { ...Object.fromEntries(tool.params!.map((q) => [q.key, q.value])), ...knobs };
  const x = { g: rec({}), t: 0, dt: 1 / 60, W: 1280, H: 720, feat: { rate: 0.3, bass: 0.2, level: 0.5, pitch: 0.5, density: 0.3 },
    rnd: () => 0.5, p: (k: string) => vals[k], picked: false } as unknown as WidgetCtx & { t: number };
  const random = Math.random;
  if (randomThrows) Math.random = () => { throw new Error('Math.random in prickle'); };
  const frames: string[][] = [];
  try {
    tool.reset!(0 as unknown as WidgetCtx);
    let ci = 0;
    for (let f = 1; f <= secs * 60; f++) {
      x.t = f / 60;
      if (onlyFrame < 0) while (ci < chords.length && chords[ci].t <= x.t) tool.onChord!(chords[ci++], x);
      else if (f !== onlyFrame) continue;
      const before = log.length;
      tool.frame!(x);
      frames[f] = log.slice(before);
    }
  } finally { Math.random = random; }
  return frames;
}

const nums = (s: string) => s.slice(s.indexOf('(') + 1, -1).split(',').map(Number);
const geometry = (fr: string[]) => fr.filter((l) => l.startsWith('moveTo') || l.startsWith('quadraticCurveTo'));
const count = (fr: string[], what: string) => fr.filter((l) => l.startsWith(what)).length;
/** The first moveTo of every body path (the bone tip's path follows a bone fillStyle, so it is left out). */
function bodyStarts(fr: string[]): number[][] {
  const out: number[][] = []; let bone = false;
  for (const l of fr) {
    if (l.startsWith('fillStyle=')) bone = l === BONE;
    else if (l.startsWith('moveTo') && !bone) out.push(nums(l));
  }
  return out;
}

describe('prickle', () => {
  it('has the five knobs and presence, with hints, steps and presence-follow set as planned', () => {
    const w = loadCatalogue().widgets.get('prickle')!;
    expect(w.params.map((p) => p.key)).toEqual(['waist', 'broad', 'hook', 'goneBy', 'touch', 'presence']);
    const by = Object.fromEntries(w.params.map((p) => [p.key, p]));
    expect(by.presence.leads).toBe(true);
    expect(by.goneBy.less).toBe(0.3);
    expect(by.broad.less).toBe(0.6);
    expect(by.touch.step).toBe(1);
    for (const p of w.params) {
      expect(p.min).toBeLessThanOrEqual(p.value);
      expect(p.value).toBeLessThanOrEqual(p.max);
      if (p.key !== 'presence') { expect(p.hint).toContain('Left:'); expect(p.hint).toContain('Right:'); }
    }
  });

  it('strikes whole on the attack step with a bone tip, and draws only lighten tones at alpha 1, restoring what it saves', () => {
    const fr = play(SONG_A, {}, 6);
    const first = fr[30];   // t = 0.5: chord 0 is first heard
    expect(count(first, 'fill(')).toBeGreaterThanOrEqual(1);
    expect(first).toContain(BONE);
    let sawFill = 0;
    for (const f of fr) {
      if (!f) continue;
      let comp = false, alpha = false;
      for (const l of f) {
        if (l === 'save()') { comp = false; alpha = false; }
        else if (l === 'globalCompositeOperation=lighten') comp = true;
        else if (l === 'globalAlpha=1.000') alpha = true;
        else if (l.startsWith('fill(')) { sawFill++; expect(comp && alpha).toBe(true); }
      }
      expect(count(f, 'save(')).toBe(count(f, 'restore('));
    }
    expect(sawFill).toBeGreaterThan(100);
  });

  it('holds still: the geometry does not change while it is held, nothing is drawn after goneBy, and staccato leaves at once', () => {
    const fr = play(SONG_B, {}, 3);
    const ref = geometry(fr[33]);   // age 0.05
    expect(ref.length).toBeGreaterThan(0);
    for (let f = 33; f <= 90; f++) expect(geometry(fr[f])).toEqual(ref);   // up to age 1.0
    for (let f = 102; f <= 180; f++) expect(count(fr[f], 'fill(')).toBe(0);   // from age 1.2 s
    const st = play(SONG_B, { touch: 0 }, 2);
    expect(count(st[30], 'fill(')).toBeGreaterThan(0);
    for (let f = 52; f <= 120; f++) expect(count(st[f], 'fill(')).toBe(0);   // from age 0.37 s
  });

  it('withdraws straight back as the next note lands, and only the new thorn is left after 0.13 s', () => {
    const fr = play(SONG_C, {}, 2);
    expect(count(fr[60], 'fill(')).toBe(4 + 1 + 1);   // four old thorns, the new one, its bone tip
    const dist = (p: number[]) => Math.hypot(p[0] - 640, p[1] - 360);
    for (let k = 0; k < 4; k++) {
      let prev = -1;
      for (let f = 60; f <= 67; f++) {
        const d = dist(bodyStarts(fr[f])[k]);
        expect(d).toBeGreaterThan(prev);
        prev = d;
      }
    }
    expect(count(fr[68], 'fill(')).toBe(1);
    expect(bodyStarts(fr[68]).length).toBe(1);
  });

  it('comes from the sides only: every body starts off frame and never crosses the top or bottom edge', () => {
    let n = 0;
    for (const knobs of [{}, { broad: 1.5, hook: 1 }, { broad: 0.3, waist: 0, hook: 0 }] as Record<string, number>[]) {
      for (const f of play(SONG_A, knobs, 12)) {
        if (!f) continue;
        for (const [x, y] of bodyStarts(f)) { n++; expect(x < 0 || x > 1280).toBe(true); expect(Number.isFinite(y)).toBe(true); }
        // Sample every body's two quadratics: no point inside the frame's width may reach the bottom (or the top) edge.
        const g = f.filter((l) => /^(moveTo|quadraticCurveTo)/.test(l));
        for (let i = 0; i + 2 < g.length; i++) {
          if (!g[i].startsWith('moveTo') || !g[i + 1].startsWith('quad') || !g[i + 2].startsWith('quad')) continue;
          const m = nums(g[i]), q1 = nums(g[i + 1]), q2 = nums(g[i + 2]);
          for (const [p0, q] of [[m, q1], [[q1[2], q1[3]], q2]] as const) {
            for (let u = 0; u <= 1.0001; u += 0.05) {
              const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
              const px = a * p0[0] + b * q[0] + c * q[2], py = a * p0[1] + b * q[1] + c * q[3];
              if (px >= 0 && px <= 1280) { expect(py, JSON.stringify([knobs, m, q1, q2])).toBeLessThan(720); expect(py).toBeGreaterThan(0); }
            }
          }
        }
      }
    }
    expect(n).toBeGreaterThan(300);
  });

  it('ends in a hairline: both sides are quadratics to one tip and their controls are 4 px apart at the waist default', () => {
    const fr = play(SONG_B, {}, 1);
    const g = fr[45].filter((l) => /^(moveTo|quadraticCurveTo|closePath)/.test(l));
    expect(g.slice(0, 4).map((l) => l.split('(')[0])).toEqual(['moveTo', 'quadraticCurveTo', 'quadraticCurveTo', 'closePath']);
    const c1 = nums(g[1]), c2 = nums(g[2]);
    expect(Math.hypot(c1[0] - c2[0], c1[1] - c2[1])).toBeCloseTo(4.0, 1);
    expect(nums(g[1]).length).toBe(4);
  });

  it('is deterministic with no Math.random, and a fresh instance seeking to t 3.0 draws exactly what the long run drew there', () => {
    const a = play(SONG_A, {}, 5, { randomThrows: true }), b = play(SONG_A, {}, 5, { randomThrows: true });
    expect(b).toEqual(a);
    expect(a[180].length).toBeGreaterThan(5);
    const seek = play(SONG_A, {}, 5, { onlyFrame: 180 });
    expect(seek[180]).toEqual(a[180]);
  });

  it('survives a clip of one note and a clip whose velocities are all equal, with no NaN', () => {
    const flat: Note[] = []; for (let i = 0; i < 20; i++) flat.push([0.3 + i * 0.15, 0.4 + i * 0.15, 55 + (i % 7) * 3, 80]);
    for (const song of [SONG_B, flat]) {
      const fr = play(song, {}, 3);
      let drawn = 0;
      for (const f of fr) if (f) { drawn += count(f, 'fill('); for (const l of f) expect(l).not.toMatch(/NaN|Infinity/); }
      expect(drawn).toBeGreaterThan(0);
    }
  });
});
