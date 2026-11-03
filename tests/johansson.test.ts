import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Point { x: number; y: number }
interface Step { k: number; tStart: number; tStrike: number; phrase: number }
interface Helpers { state(): { steps: Step[]; dots: Point[]; shift: number } }
interface Context {
  t: number; dt: number; W: number; H: number; rate: number;
  feat: { level: number; pitch: number };
  p(key: string): number; pitch01(midi: number): number; rnd(a: number, b: number): number;
  top(): null;
}
interface Tool { params: { key: string; value: number }[]; reset(x: Context): void; frame(x: Context): void }
interface Observation { step: number; frame: number; landingError: number; slipX: number; slipY: number }

function walkingFixture() {
  // Constant features and no note jolts isolate the recipe's changing stride/run from the ankle springs.
  const times = [2, 2.34, 2.68, 3.02, 3.36, 3.70, 4.04, 6.8, 7.14, 7.48];
  const velocities = [35, 115, 40, 110, 45, 105, 50, 100, 55, 95];
  const chords = times.map((t, i) => ({ t, vel: velocities[i], lo: 48, hi: 72, notes: [{ m: 48, v: velocities[i], d: .2 }, { m: 72, v: velocities[i], d: .2 }] }));
  const tools: Tool[] = []; let helpers!: Helpers;
  const source = readFileSync(new URL('../lab/tools/johansson.js', import.meta.url), 'utf8')
    .replace('  TOOLS.push({', '  capture({state: () => ({steps,dots,shift})});\n  TOOLS.push({');
  new Function('TOOLS', 'ICON', 'CHORDS', 'capture', source)(tools, { of: { count() {}, speed() {}, size() {}, time() {} } }, chords, (h: Helpers) => { helpers = h; });
  const values = Object.fromEntries(tools[0].params.map((p) => [p.key, p.value])); values.height = 1.3;
  let seed = 1;
  const x: Context = { t: 0, dt: 0, W: 1280, H: 720, rate: 2, feat: { level: .5, pitch: .5 },
    p: (key) => values[key], pitch01: (m) => Math.max(0, Math.min(1, (m - 21) / 87)), top: () => null,
    rnd: (a, b) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return a + (b - a) * seed / 4294967296; } };
  tools[0].reset(x); tools[0].frame(x);
  const steps = helpers.state().steps, probes = new Map<number, { step: Step; frame: number }[]>(), clock = new Set<number>([0]);
  const end = times[times.length - 1] + .06;
  for (let k = 1; k / 60 <= end; k++) clock.add(k / 60);
  for (const step of steps) for (let frame = 0; frame < 4; frame++) {
    const t = step.tStrike + frame / 60; clock.add(t);
    if (!probes.has(t)) probes.set(t, []); probes.get(t)!.push({ step, frame });
  }
  const previous = new Map<number, Point & { shift: number }>(), observations: Observation[] = [], extents: Point[] = [], standing: Point[][] = [];
  let last = 0;
  for (const t of [...clock].sort((a, b) => a - b)) {
    x.t = t; x.dt = t - last; tools[0].frame(x); const state = helpers.state();
    extents.push(...state.dots.map((p) => ({ x: p.x, y: p.y })));
    if (t > 4.1 && t < 5.7) standing.push(state.dots.map((p) => ({ x: p.x, y: p.y })));
    for (const probe of probes.get(t) || []) {
      const p = state.dots[probe.step.k % 2 ? 12 : 11], before = previous.get(probe.step.k);
      observations.push({ step: probe.step.k, frame: probe.frame,
        landingError: Math.max(state.dots[11].y, state.dots[12].y) - p.y,
        slipX: before ? Math.abs(p.x - before.x - (state.shift - before.shift)) : 0,
        slipY: before ? Math.abs(p.y - before.y) : 0 });
      previous.set(probe.step.k, { x: p.x, y: p.y, shift: state.shift });
    }
    last = t;
  }
  return { observations, extents, standing };
}
const fixture = walkingFixture();

describe('Johansson planned footfalls, literal recipe', () => {
  it('lands each planned ankle within one pixel of the lower ankle', () => {
    for (const q of fixture.observations.filter((p) => p.frame === 0)) expect(q.landingError, `step ${q.step}`).toBeLessThanOrEqual(1);
  });
  it('plants that ankle relative to the stars for the following three frames', () => {
    for (const q of fixture.observations.filter((p) => p.frame > 0)) {
      expect(q.slipX, `step ${q.step}, frame ${q.frame}, horizontal`).toBeLessThan(1);
      expect(q.slipY, `step ${q.step}, frame ${q.frame}, vertical`).toBeLessThan(1);
    }
  });
  it('keeps all thirteen joints on screen at height 1.3', () => {
    for (const p of fixture.extents) { expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(1280); expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(720); }
  });
  it('holds every joint still through a standing interval', () => {
    expect(fixture.standing.length).toBeGreaterThan(2);
    for (const frame of fixture.standing) expect(frame).toEqual(fixture.standing[0]);
  });
});
