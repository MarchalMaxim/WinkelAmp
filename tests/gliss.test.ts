/// <reference types="node" />
// Gliss's plan: which sweeps it makes of the notes and the bell over each, worked out in advance.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Chord { t: number; notes: { m: number; v: number; d: number }[]; vel: number; lo: number; hi: number }
interface Sweep { t0: number; tp: number; t1: number; height: number; notes: { t: number; m: number; v: number }[] }
interface Run { start: number; end: number; sweeps: Sweep[] }
interface Tool {
  id: string; params: { key: string; value: number; min: number; max: number }[];
  plan: (c: Chord[]) => { sweeps: Sweep[] };
  runAt: (s: Sweep[], t: number, tail: number) => Run | null;
  heightAt: (s: Sweep, t: number) => number;
  tintOf: (hue: number) => number[];
}

const tools: Tool[] = [];
new Function('TOOLS', 'ICON', 'CHORDS', readFileSync('lab/tools/gliss.js', 'utf8'))(tools, {}, []);
const [tool] = tools, { plan, runAt, heightAt, tintOf } = tool;

const chord = (t: number, ...ms: number[]): Chord => ({ t, notes: ms.map((m) => ({ m, v: 80, d: 0.5 })), vel: 80, lo: Math.min(...ms), hi: Math.max(...ms) });
// The sweep the widget was made for: Liebesleid at 2:53.6.
const LIEBESLEID: [number, ...number[]][] = [[173.556, 45], [173.638, 52], [173.745, 55], [173.819, 56], [173.895, 59], [173.937, 64], [174.036, 55], [174.107, 68], [174.2, 71], [174.297, 60, 76, 72], [174.414, 71], [174.543, 64], [174.699, 59], [174.844, 64], [174.996, 58], [175.071, 37], [175.156, 45], [175.235, 52], [175.285, 57]];

describe('gliss plan', () => {
  it('has nothing to do without notes', () => {
    expect(plan([])).toEqual({ sweeps: [] });
  });
  it('makes one bell of the Liebesleid sweep, topping on its highest note and ending on its last', () => {
    const { sweeps } = plan(LIEBESLEID.map(([t, ...ms]) => chord(t, ...ms)));
    expect(sweeps).toHaveLength(1);
    expect(sweeps[0].t0).toBe(173.556);
    expect(sweeps[0].tp).toBe(174.297);
    expect(sweeps[0].t1).toBe(175.285);
    expect(sweeps[0].notes).toHaveLength(21);
  });
  it('starts at its baseline, tops out, and comes back to it', () => {
    const [s] = plan([chord(1, 60), chord(1.5, 84), chord(2, 60)]).sweeps;
    expect(heightAt(s, s.t0)).toBe(0);
    expect(heightAt(s, s.tp)).toBe(1);
    expect(heightAt(s, s.t1)).toBe(0);
    expect(heightAt(s, 1.25)).toBeGreaterThan(0);
  });
  it('still comes back down when the notes only climb', () => {
    const [s] = plan([chord(1, 60), chord(1.2, 67), chord(1.4, 72)]).sweeps;
    expect(s.tp).toBe(1.4);
    expect(s.t1).toBeGreaterThan(s.tp);
    expect(heightAt(s, s.t1)).toBe(0);
  });
  it('still rises first when the notes only fall', () => {
    const [s] = plan([chord(1, 72), chord(1.2, 67), chord(1.4, 60)]).sweeps;
    expect(s.tp).toBeGreaterThan(s.t0);
    expect(s.tp).toBeLessThan(s.t1);
  });
  it('survives a single note', () => {
    const [s] = plan([chord(3, 60)]).sweeps;
    expect(s.t1).toBeGreaterThan(s.tp);
    expect(s.tp).toBeGreaterThan(s.t0);
  });
  it('gives a small line a lower bell than a big one', () => {
    const small = plan([chord(1, 60), chord(1.2, 62), chord(1.4, 60)]).sweeps[0];
    const big = plan([chord(1, 40), chord(1.2, 80), chord(1.4, 40)]).sweeps[0];
    expect(small.height).toBeLessThan(big.height);
  });
  it('makes separate sweeps of notes a silence apart', () => {
    const { sweeps } = plan([chord(1, 60), chord(1.3, 72), chord(3, 60), chord(3.3, 72)]);
    expect(sweeps.map((s) => s.t0)).toEqual([1, 3]);
  });
  it('finds the fast climbs in a whole song, and no sweep too long to read', () => {
    const song: Chord[] = [];
    for (let i = 0; i < 300; i++) song.push(chord(i * 0.5, 60 + (i % 3)));
    for (const at of [30, 80]) for (let k = 0; k < 8; k++) song.push(chord(at + 0.03 + k * 0.08, 45 + k * 5));
    song.sort((a, b) => a.t - b.t);
    const { sweeps } = plan(song);
    expect(sweeps.map((s) => Math.round(s.t0))).toEqual([30, 80]);
    for (const s of sweeps) expect(s.t1 - s.t0).toBeLessThan(3);
  });
});

describe('gliss in time', () => {
  const sweeps = plan([chord(10, 60), chord(10.5, 80), chord(11, 60), chord(12.5, 60), chord(13, 80), chord(30, 60), chord(30.5, 80), chord(31, 60)]).sweeps;
  it('is off before a sweep and after its tail', () => {
    expect(runAt(sweeps, 9.9, 2)).toBeNull();
    expect(runAt(sweeps, 20, 2)).toBeNull();
  });
  it('keeps one fluid while a tail reaches the next sweep', () => {
    const run = runAt(sweeps, 13, 2)!;
    expect(run.start).toBe(10);
    expect(run.sweeps).toHaveLength(2);
  });
  it('starts over after a real silence', () => {
    const run = runAt(sweeps, 30.2, 2)!;
    expect(run.start).toBe(30);
    expect(run.sweeps).toHaveLength(1);
  });
});

describe('gliss knobs', () => {
  it('has a colour knob over the whole wheel, amber by default', () => {
    const hue = tool.params.find((p) => p.key === 'hue')!;
    expect([hue.min, hue.max]).toEqual([0, 360]);
    const [r, g, b] = tintOf(hue.value);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });
  it('turns the colour of the light with the knob', () => {
    const [r, g, b] = tintOf(220);
    expect(b).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(r);
  });
  it('keeps to five knobs and how present', () => {
    expect(tool.params.filter((p) => p.key !== 'presence').length).toBeLessThanOrEqual(5);
    expect(tool.params.some((p) => p.key === 'presence')).toBe(true);
  });
});
