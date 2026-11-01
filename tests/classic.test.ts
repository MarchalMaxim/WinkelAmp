import { describe, expect, it } from 'vitest';
import { emptyFeatures, type Features } from '../src/audio/features';
import type { Motion } from '../src/mapping';
import { PALETTES } from '../src/visual/color';
import type { Frame, Scene } from '../src/visual/scene';
import { Bloom } from '../src/visual/scenes/bloom';
import { Pulse } from '../src/visual/scenes/pulse';
import { Ribbons } from '../src/visual/scenes/ribbons';
import { Swarm } from '../src/visual/scenes/swarm';

/** A Canvas2D stand-in that logs every call and property set, so two frames' drawing can be compared. */
function recorder() {
  const log: string[] = [];
  const num = (a: unknown) => (typeof a === 'number' ? a.toFixed(4) : String(a));
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(_t, name: string) {
      return (...args: unknown[]) => {
        log.push(`${name}(${args.map(num).join(',')})`);
        if (name.startsWith('create')) return { addColorStop: (o: number, c: string) => log.push(`stop(${num(o)},${c})`) };
      };
    },
    set(_t, name: string, v) {
      log.push(`${name}=${typeof v === 'object' ? 'gradient' : num(v)}`);
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, log };
}

/** Music playing: a chord, a bright spectrum, a sine on the waveform. */
function sound(): Features {
  const f = emptyFeatures();
  Object.assign(f, { level: 0.6, bass: 0.5, mid: 0.4, treble: 0.5, beat: 0.3, note: 4, noteSmooth: 4, tonality: 0.8, bpm: 110 });
  for (let i = 0; i < f.spectrum.length; i++) f.spectrum[i] = 0.3 + 0.3 * Math.sin(i * 0.37);
  for (let i = 0; i < f.waveform.length; i++) f.waveform[i] = 0.4 * Math.sin(i * 0.05);
  f.chroma.set([1, 0.1, 0.1, 0.1, 0.8, 0.1, 0.1, 0.9, 0.1, 0.1, 0.1, 0.1]);
  return f;
}

const motion: Motion = { size: 0.5, speed: 0.5, spin: 0.5, glow: 0.5, shake: 0.3, colorShift: 0.2, zoom: 0.3 };

/** One frame of `scene`; returns everything it drew. */
function draw(scene: Scene, f: Features, dt: number, musicDt: number, t: number) {
  const { ctx, log } = recorder();
  const fr: Frame = {
    ctx, w: 1280, h: 720, r: 360, f, m: motion, palette: PALETTES[0], dt, musicDt, t,
    pointer: { x: 0, y: 0, down: false },
  };
  scene.draw(fr);
  return log.join('\n');
}

describe('Classic scenes move on music time', () => {
  for (const make of [() => new Bloom(), () => new Swarm(), () => new Ribbons(), () => new Pulse()]) {
    const name = make().name;

    it(`${name}: holds still while the clock stands still (wall time passing)`, () => {
      const scene = make();
      const f = sound();
      for (let i = 0; i < 30; i++) draw(scene, f, 1 / 60, 1 / 60, i / 60);
      const a = draw(scene, f, 1 / 60, 0, 0.5);
      // A whole second of wall time, no music time.
      for (let i = 0; i < 59; i++) draw(scene, f, 1 / 60, 0, 0.5);
      expect(draw(scene, f, 1 / 60, 0, 0.5)).toBe(a);
    });

    it(`${name}: moves while music time runs (the control)`, () => {
      const scene = make();
      const f = sound();
      for (let i = 0; i < 30; i++) draw(scene, f, 1 / 60, 1 / 60, i / 60);
      const a = draw(scene, f, 1 / 60, 1 / 60, 0.5);
      for (let i = 0; i < 29; i++) draw(scene, f, 1 / 60, 1 / 60, 0.5 + i / 60);
      expect(draw(scene, f, 1 / 60, 1 / 60, 1)).not.toBe(a);
    });
  }
});
