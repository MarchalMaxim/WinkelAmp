// Mica: the knobs, the colour law, the geometry of the shards (one angle per pitch class,
// at least 6:1), that nothing moves, that a seek gives the same stone, velocity as a prefix, the bone budget, determinism.
/// <reference types="node" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { groupChords } from '../src/widgets/chords';
import { instantiate } from '../src/widgets/instantiate';
import { kit } from './helpers/widget';
import type { Chord, IconLib, Note, ToolDef, WidgetCtx } from '../src/widgets/types';

type Op = [string, number, number];
class StubPath2D {
  ops: Op[] = [];
  moveTo(x: number, y: number) { this.ops.push(['M', x, y]); }
  lineTo(x: number, y: number) { this.ops.push(['L', x, y]); }
  closePath() { this.ops.push(['Z', 0, 0]); }
}
interface Fill { frame: number; path: StubPath2D; fs: string; comp: string; alpha: number; order: number }

const SRC = readFileSync(new URL('../lab/tools/mica.js', import.meta.url), 'utf8');
const NOTES: Note[] = [];
for (let i = 0; i < 40; i++) NOTES.push([0.5 + i * 0.21, 0.7 + i * 0.21, 60 + ((i * 7) % 24), 40 + ((i * 13) % 71)]);
for (let i = 0; i < 6; i++) NOTES.push([9.0, 9.4, 50 + i * 5, 90]);   // the 6-note chord at 9.0 s
NOTES.push([12.0, 12.4, 64, 80]);                                      // a lone note
NOTES.sort((a, b) => a[0] - b[0]);
const CHORDS: Chord[] = groupChords(NOTES);

const G = globalThis as Record<string, unknown>;
let saved: Record<string, unknown>;
beforeAll(() => { saved = { window: G.window, Path2D: G.Path2D }; G.window = { NOTES }; G.Path2D = StubPath2D; });
afterAll(() => { G.window = saved.window; G.Path2D = saved.Path2D; });

const ICONLIB = { ink: '#fff', gauge() {} } as unknown as IconLib;
const load = (chords: Chord[] = CHORDS) => instantiate('mica', SRC, { kit: kit(), icon: ICONLIB, chords }) as ToolDef & Record<string, (...a: unknown[]) => void>;

/** Plays a fresh mica from `from` to `to` s at 60 Hz (the first frame is at `from`); returns every fill, the per-frame call log and the saves. */
function play(opts: { from?: number; to?: number; knobs?: Record<string, number>; chords?: Chord[]; picked?: boolean } = {}) {
  const { from = 1 / 60, to = 14, knobs = {}, chords = CHORDS, picked = false } = opts;
  const tool = load(chords);
  const vals: Record<string, number> = { ...Object.fromEntries(tool.params!.map((q) => [q.key, q.value])), ...knobs };
  const fills: Fill[] = [], log: string[] = [], bal: number[] = [];
  let frame = 0, depth = 0, order = 0;
  const st = { fillStyle: '', globalCompositeOperation: 'source-over', globalAlpha: 1 };
  const g = new Proxy({} as Record<string, unknown>, {
    get: (_o, k) => {
      const key = String(k);
      if (key in st) return (st as Record<string, unknown>)[key];
      return (...a: unknown[]) => {
        if (key === 'save') depth++;
        else if (key === 'restore') depth--;
        else if (key === 'fill') {
          const p = a[0] as StubPath2D;
          fills.push({ frame, path: p, fs: st.fillStyle, comp: st.globalCompositeOperation, alpha: st.globalAlpha, order: order++ });
          log.push(`fill(${st.globalCompositeOperation},${st.globalAlpha},${st.fillStyle},${p.ops.map((o) => o[0] + o[1].toFixed(3) + ',' + o[2].toFixed(3)).join(';')})`);
          return;
        }
        log.push(key);
      };
    },
    set: (_o, k, v) => { (st as Record<string, unknown>)[String(k)] = v; if (String(k) === 'fillStyle') log.push(`fs=${v}`); return true; },
  });
  const boom = () => { throw new Error('x.rnd / Math.random used'); };
  const x = { g, t: 0, dt: 1 / 60, W: 1280, H: 720, rnd: boom, p: (k: string) => vals[k], picked, level: 0.5, rate: 0.3, hit: 0 } as unknown as WidgetCtx & { t: number };
  const random = Math.random; Math.random = boom;
  const attacks = new Set(chords.map((c) => Math.ceil(c.t * 60 - 1e-9)));
  const attackFrames: number[] = [];
  try {
    tool.reset!(0 as unknown as WidgetCtx);
    for (let f = Math.round(from * 60); f <= to * 60; f++) {
      x.t = f / 60; frame = f; depth = 0;
      tool.frame!(x);
      bal.push(depth);
      if (attacks.has(f)) attackFrames.push(f);
    }
  } finally { Math.random = random; }
  return { tool, fills, log, bal, attackFrames, vals };
}
const rgbOf = (s: string) => (s.match(/\d+/g) ?? []).map(Number);

/** Splits a stub path into shards (M, L, L, L, Z): centre, long axis angle (mod 180), length, width. */
function shards(p: StubPath2D) {
  const out: { cx: number; cy: number; ang: number; len: number; wid: number }[] = [];
  for (let k = 0; k + 4 < p.ops.length + 0; k += 5) {
    const [m, a, b, c, z] = [p.ops[k], p.ops[k + 1], p.ops[k + 2], p.ops[k + 3], p.ops[k + 4]];
    expect([m[0], a[0], b[0], c[0], z[0]]).toEqual(['M', 'L', 'L', 'L', 'Z']);
    const dx = m[1] - b[1], dy = m[2] - b[2], ex = a[1] - c[1], ey = a[2] - c[2];
    const len = Math.hypot(dx, dy), wid = Math.hypot(ex, ey);
    let ang = Math.atan2(dy, dx); ang = ((ang % Math.PI) + Math.PI) % Math.PI;
    out.push({ cx: (m[1] + b[1]) / 2, cy: (m[2] + b[2]) / 2, ang, len, wid });
  }
  return out;
}
const pitchOf = new Map<StubPath2D, number>();
const sha = (s: string[]) => createHash('sha1').update(s.join('|')).digest('hex');

describe('mica', () => {
  it('has the six knobs of the plan with hints, icons, less values and a leading presence', () => {
    const tool = load();
    const ps = tool.params!;
    expect(ps.map((p) => p.key)).toEqual(['flecks', 'spread', 'size', 'ring', 'colour', 'presence']);
    const want: Record<string, [number, number, number]> = { flecks: [40, 400, 192], spread: [40, 400, 120], size: [16, 90, 56], ring: [0.25, 3, 1], colour: [0, 2, 0], presence: [0, 1, 1] };
    for (const p of ps) expect([p.min, p.max, p.value]).toEqual(want[p.key]);
    expect(ps.find((p) => p.key === 'flecks')!.less).toBe(48);
    expect(ps.find((p) => p.key === 'ring')!.less).toBe(0.5);
    expect(ps.find((p) => p.key === 'presence')!.leads).toBe(true);
    for (const p of ps) { expect(p.hint).toContain('Left:'); expect(p.hint).toContain('Right:'); expect(typeof p.icon).toBe('function'); }
    expect(tool.tag).toBe('new');
  });

  it('strikes each attack step in lighten at alpha 1 with the silver, and every save has its restore', () => {
    const r = play();
    expect(r.bal.every((b) => b === 0)).toBe(true);
    for (const f of r.attackFrames) {
      const at = r.fills.filter((q) => q.frame === f);
      expect(at.length).toBeGreaterThan(0);
      for (const q of at) { expect(q.comp).toBe('lighten'); expect(q.alpha).toBe(1); }
      expect(at.some((q) => q.fs === 'rgb(222,226,238)')).toBe(true);
    }
    expect(r.log.some((l) => l.startsWith('globalCompositeOperation'))).toBe(false);
  });

  it('draws shards with their long axis at (m % 12) x 15 degrees and at least 6:1; an octave apart is parallel, at another height', () => {
    const mk = (m: number): Chord[] => groupChords([[1, 1.4, m, 100], [3, 3.4, 60, 40], [4, 4.4, 61, 127]] as Note[]);
    const mean = new Map<number, number>();
    for (const m of [24, 36, 47, 55, 60, 71, 72, 96]) {
      const r = play({ chords: mk(m), from: 1, to: 1 + 1 / 60, knobs: { flecks: 400 } });
      const q = r.fills.find((f) => f.frame === 60)!;
      const ss = shards(q.path);
      expect(ss.length).toBe(400);
      const want = ((m % 12) * 15 * Math.PI) / 180 % Math.PI;
      for (const s of ss) {
        expect(Math.abs(s.ang - want) < 1e-6 || Math.abs(Math.abs(s.ang - want) - Math.PI) < 1e-6).toBe(true);
        expect(s.len / s.wid).toBeGreaterThanOrEqual(6);
      }
      mean.set(m, ss.reduce((a, s) => a + s.cy, 0) / ss.length);
    }
    expect(mean.get(36)).toBeGreaterThan(mean.get(60)!);   // a lower pitch lies lower on the frame (greater y)
    expect(mean.get(60)).toBeGreaterThan(mean.get(72)!);
    expect(mean.get(24)).toBeGreaterThan(mean.get(96)!);
    void pitchOf;
  });

  it('never moves a shard: between attacks a path keeps its object and ops, and the colour never rises', () => {
    const r = play({ from: 1 / 60, to: 14 });
    // the same pitch reuses the same path object and ops
    const byOps = new Map<string, StubPath2D>();
    for (const q of r.fills) {
      const key = JSON.stringify(q.path.ops);
      const seen = byOps.get(key);
      if (seen) expect(seen).toBe(q.path);
      byOps.set(key, q.path);
    }
    // within one note's life, the same path is redrawn with channels that never rise
    const a = r.fills.filter((q) => q.frame >= 12 * 60 && q.frame <= 12 * 60 + 40);   // the lone note at 12.0 s
    expect(a.length).toBeGreaterThan(5);
    const p0 = a[0].path;
    let prev = rgbOf(a[0].fs);
    for (const q of a.slice(1)) { expect(q.path).toBe(p0); const c = rgbOf(q.fs); c.forEach((v, i) => expect(v).toBeLessThanOrEqual(prev[i])); prev = c; }
    // nothing at all from 12.5 s on
    expect(r.fills.filter((q) => q.frame > 12.5 * 60).length).toBe(0);
  });

  it('gives the same stone after a seek', () => {
    const full = play({ from: 1 / 60, to: 9.5 });
    const seek = play({ from: 9.0, to: 9.2 });
    const f = Math.round(9.0 * 60);
    const a = full.fills.filter((q) => q.frame === f).map((q) => JSON.stringify(q.path.ops));
    const b = seek.fills.filter((q) => q.frame === f).map((q) => JSON.stringify(q.path.ops));
    expect(b.length).toBeGreaterThan(0);
    for (const ops of b) expect(a).toContain(ops);
  });

  it('shows a soft note as a prefix of the loud one, with the biggest shards; defaults give ceil(0.4N) and N', () => {
    const notes: Note[] = [];
    for (let i = 0; i < 20; i++) notes.push([1 + i, 1.4 + i, 60, 20 + i * 5]);   // one pitch, velocity 20 .. 115
    const cs = groupChords(notes);
    const r = play({ chords: cs, from: 1, to: 21 });
    const at = (k: number) => r.fills.find((q) => q.frame === Math.round((1 + k) * 60))!.path;
    const soft = at(0), loud = at(19);
    expect(soft.ops.length / 5).toBe(Math.ceil(0.4 * 192));
    expect(loud.ops.length / 5).toBe(192);
    expect(soft.ops).toEqual(loud.ops.slice(0, soft.ops.length));
    const L = shards(loud).map((s) => s.len);
    expect(Math.max(...shards(soft).map((s) => s.len))).toBe(Math.max(...L));
    expect(L[0]).toBeGreaterThanOrEqual(L[L.length - 1]);
    // one note alone does not throw and draws the whole set
    const one = play({ chords: groupChords([[1, 1.4, 60, 50]] as Note[]), from: 1, to: 1.1 });
    expect(one.fills[0].path.ops.length / 5).toBe(192);
    expect(() => play({ chords: [], from: 1, to: 1.1 })).not.toThrow();
  });

  it('on a crowded strike fills the bone only on the biggest 30 %', () => {
    const r = play({ from: 1 / 60, to: 9.1 });
    const f = Math.round(9.0 * 60);
    const at = r.fills.filter((q) => q.frame === f);
    const strike = at.filter((q) => q.fs === 'rgb(222,226,238)');
    expect(strike.length).toBeGreaterThan(0);
    for (const q of strike) expect(q.path.ops.length / 5).toBe(Math.ceil(0.3 * 192));
    expect(at.length).toBeGreaterThanOrEqual(12);   // each of the 6 notes is filled twice
  });

  it('keeps a crowded chord from re-flashing: over its whole life only the biggest 30 % rise above the body, and no path ever brightens', () => {
    const r = play({ from: 9.0, to: 9.5 });
    const body = [96, 90, 112];
    const full = new Set([Math.ceil(0.4 * 192), Math.ceil(0.7 * 192), 192]);
    const byPath = new Map<StubPath2D, number[]>();
    for (const q of r.fills) {
      const n = q.path.ops.length / 5, c = rgbOf(q.fs);
      if (full.has(n)) c.forEach((v, i) => expect(v).toBeLessThanOrEqual(body[i]));
      const prev = byPath.get(q.path);
      if (q.frame > Math.round(9.0 * 60) && prev && full.has(n)) c.forEach((v, i) => expect(v).toBeLessThanOrEqual(prev[i]));
      if (full.has(n)) byPath.set(q.path, c);
    }
    expect(byPath.size).toBeGreaterThan(0);
  });

  it('does not truncate a dense texture: no live set vanishes while still visible', () => {
    const notes: Note[] = [];
    for (let i = 0; i < 60; i++) for (let k = 0; k < 3; k++) notes.push([1 + i / 12, 1.2 + i / 12, 48 + ((i * 5 + k * 7) % 36), 90]);
    const cs = groupChords(notes);
    const r = play({ chords: cs, from: 5, to: 6, knobs: { ring: 3 } });
    for (let f = 301; f <= 360; f++) {
      const prev = r.fills.filter((q) => q.frame === f - 1 && q.fs !== '').map((q) => Math.max(...rgbOf(q.fs)));
      const now = r.fills.filter((q) => q.frame === f).map((q) => Math.max(...rgbOf(q.fs)));
      expect(now.length).toBeGreaterThan(0);
      expect(prev.length).toBeLessThanOrEqual(64 * 2);
    }
  });

  it('is deterministic, and never reads x.rnd or Math.random', () => {
    const a = play(), b = play();
    expect(a.log.length).toBeGreaterThan(500);
    expect(sha(a.log)).toBe(sha(b.log));
  });
});
