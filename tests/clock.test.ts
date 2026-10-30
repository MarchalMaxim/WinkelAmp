import { describe, expect, it } from 'vitest';
import { DIM_FLOOR, MusicClock, type ClockInput } from '../src/stage/clock';

const SILENT: ClockInput = { level: 0, onset: 0, flux: 0, silence: 1 };
const DRONE: ClockInput = { level: 0.8, onset: 0, flux: 0.05, silence: 0 };

/** Runs `seconds` of input at `fps`; `input` may depend on the frame's time. Returns the drive per frame. */
function run(c: MusicClock, input: ClockInput | ((t: number) => ClockInput), seconds: number, fps = 60): number[] {
  const drives: number[] = [];
  const n = Math.round(seconds * fps);
  for (let i = 0; i < n; i++) {
    c.advance(typeof input === 'function' ? input(i / fps) : input, 1 / fps);
    drives.push(c.drive);
  }
  return drives;
}

const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;

/** Onsets of strength 0.8 every 125 ms (one frame each), over loud, changing sound. */
function busy() {
  let lastBeat = -1;
  return (t: number): ClockInput => {
    const beat = Math.floor(t / 0.125 + 1e-9);
    const onset = beat !== lastBeat ? 0.8 : 0;
    lastBeat = beat;
    return { level: 0.8, onset, flux: 0.5, silence: 0 };
  };
}

describe('MusicClock', () => {
  it('silence freezes', () => {
    const c = new MusicClock();
    run(c, DRONE, 2); // some music first: the freeze must not depend on history
    run(c, SILENT, 1);
    const t0 = c.time;
    run(c, SILENT, 5);
    expect(c.time).toBe(t0);
    expect(c.drive).toBe(0);
    const fresh = new MusicClock();
    run(fresh, SILENT, 5);
    expect(fresh.time).toBe(0);
    expect(fresh.drive).toBe(0);
  });

  it('noise floor does not drive', () => {
    const c = new MusicClock();
    const d = run(c, { level: 0.03, onset: 0, flux: 0.02, silence: 0.9 }, 5);
    expect(Math.max(...d)).toBeLessThan(0.02);
  });

  it('steady room noise above the silence threshold freezes and dims too', () => {
    const c = new MusicClock();
    run(c, DRONE, 2);
    const d = run(c, { level: 0.06, onset: 0, flux: 0, silence: 0 }, 6);
    expect(d[d.length - 1]).toBe(0);
    expect(c.dim).toBeLessThanOrEqual(0.2);
  });

  it('steady drone moves slowly', () => {
    const c = new MusicClock();
    run(c, DRONE, 3);
    expect(c.drive).toBeGreaterThanOrEqual(0.3);
    expect(c.drive).toBeLessThanOrEqual(0.8);
  });

  for (const fps of [60, 144]) {
    it(`busy music moves fast (${fps} fps)`, () => {
      const c = new MusicClock();
      const d = run(c, busy(), 6, fps);
      expect(mean(d.slice(d.length / 2))).toBeGreaterThanOrEqual(1.2);
    });
  }

  it('monotone in activity', () => {
    const at = (level: number) => {
      const c = new MusicClock();
      run(c, { level, onset: 0, flux: 0.1, silence: 0 }, 3);
      return c.drive;
    };
    expect(at(0.3)).toBeLessThan(at(0.8));
  });

  it('time advances by drive × dt and advance() returns that delta', () => {
    const c = new MusicClock();
    run(c, DRONE, 2);
    const t0 = c.time;
    const dm = c.advance(DRONE, 1 / 60);
    expect(dm).toBeCloseTo(c.drive / 60, 12);
    expect(c.time - t0).toBeCloseTo(dm, 12);
  });

  it('dims after silence', () => {
    const c = new MusicClock();
    run(c, DRONE, 2);
    let minDim = 1;
    const fps = 60;
    for (let i = 1; i <= 20 * fps; i++) {
      c.advance(SILENT, 1 / fps);
      minDim = Math.min(minDim, c.dim);
      if (i === Math.round(0.9 * fps)) expect(c.dim).toBe(1);
      if (i === 5 * fps) expect(c.dim).toBeLessThanOrEqual(0.2);
    }
    expect(minDim).toBeGreaterThanOrEqual(DIM_FLOOR);
    expect(c.silentFor).toBeCloseTo(20, 6);
  });

  it('recovers', () => {
    const c = new MusicClock();
    run(c, DRONE, 2);
    run(c, SILENT, 10);
    expect(c.dim).toBeLessThan(0.2);
    run(c, DRONE, 0.3);
    expect(c.dim).toBeGreaterThanOrEqual(0.95);
    expect(c.silentFor).toBe(0);
  });

  it('poke advances in silence', () => {
    const c = new MusicClock();
    run(c, SILENT, 3);
    const t0 = c.time;
    c.advance({ ...SILENT, poke: 1 }, 1 / 60);
    expect(c.time).toBeGreaterThan(t0);
    // …briefly: the nudge dies away and the picture freezes again.
    run(c, SILENT, 4);
    expect(c.drive).toBe(0);
  });

  it('ignores bad dt and inputs', () => {
    const c = new MusicClock();
    run(c, DRONE, 1);
    const t0 = c.time;
    c.advance(DRONE, NaN);
    c.advance(DRONE, -1);
    expect(c.time).toBe(t0);
    c.advance({ level: NaN, onset: NaN, flux: NaN, silence: NaN, poke: NaN }, 1 / 60);
    expect(Number.isFinite(c.time) && Number.isFinite(c.drive) && Number.isFinite(c.dim)).toBe(true);
  });

  it('reset() returns to rest', () => {
    const c = new MusicClock();
    run(c, busy(), 2);
    run(c, SILENT, 3);
    c.reset();
    expect([c.time, c.drive, c.silentFor, c.dim]).toEqual([0, 0, 0, 1]);
  });
});
