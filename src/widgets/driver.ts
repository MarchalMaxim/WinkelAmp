// Clocks for the runtime: the lab's live rAF loop (audio clock, freeze on pause, reset on a jump) and its render API
// (?render=1: song time moved on demand in substeps of 1/hz, so a video frame shows what a live screen would).
import { liveClock, newFeatures } from './features';
import { momentAt } from './lab-harness';
import type { Slot, WidgetRuntime } from './runtime';
import type { LabMoment } from './types';

/** What a clock drives: the runtime directly (labCompat) or a show (the Conductor). */
export interface Stepper { reset(t: number): void; step(t: number, dt: number): void }

/** The lab's frame(): returns stop(). */
export function startLive(s: Stepper, rt: WidgetRuntime, audio: HTMLMediaElement, onFrame?: (t: number) => void): () => void {
  let raf = 0, stopped = false;
  const frame = () => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    const t = audio.currentTime;
    const { reset, dt } = liveClock(rt.lastT, t, audio.paused);
    if (reset) s.reset(t);
    rt.ctx.now = performance.now() / 1000;
    rt.ctx.t = t; rt.ctx.dt = dt; rt.lastT = t;
    if (dt > 0) s.step(t, dt);   // silence/pause freezes the picture
    onFrame?.(t);
  };
  raf = requestAnimationFrame(frame);
  return () => { stopped = true; cancelAnimationFrame(raf); };
}

/** FNV-1a (32 bit) over bytes, as 8 hex digits. */
export function fnv1a(data: Uint8ClampedArray | Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) { h ^= data[i]; h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function base64(bytes: Uint8ClampedArray): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000) as unknown as number[]);
  return btoa(s);
}

declare global {
  interface Window {
    renderSeek?: (t: number, seed?: number) => number;
    renderStep?: (dt: number) => number;
    renderTo?: (t: number) => number;
    renderErrors?: Record<string, string>;
    renderReady?: boolean;
    renderFrameHash?: () => string;
    renderPixels?: () => string;
    renderInfo?: { duration: number; title: string };
    renderTools?: { id: string; name: string }[];
    /** the canvas's real size: 1280·S × 720·S */
    renderSize?: { w: number; h: number };
  }
}

/** The lab's render API on window (plan §3), plus a frame hash and the raw pixels for the fidelity test. */
export function exposeRenderApi(s: Stepper, rt: WidgetRuntime, reseed: (seed: number) => void, hz: number): void {
  const ctx = rt.ctx;
  window.renderSeek = (t, seed = 1) => {
    reseed(seed); Object.assign(ctx.feat, newFeatures());
    ctx.now = 0; s.reset(t); return t;
  };
  window.renderStep = (dt) => {
    const n = Math.max(1, Math.ceil(dt * hz - 1e-6)), t0 = rt.lastT;
    for (let i = 1; i <= n; i++) { const t = t0 + (dt * i) / n; const d = t - rt.lastT; rt.lastT = t; ctx.now += d; s.step(t, d); }
    return rt.lastT;
  };
  window.renderTo = (t) => window.renderStep!(t - rt.lastT);
  window.renderErrors = rt.errors;
  // The REAL context over the real size: at scale S ctx.g is a proxy that refuses pixel reads, and ctx.W × ctx.H a quarter.
  const canvas = ctx.canvas, real = canvas.getContext('2d')!;
  const pixels = () => real.getImageData(0, 0, canvas.width, canvas.height).data;
  window.renderSize = { w: canvas.width, h: canvas.height };
  window.renderFrameHash = () => fnv1a(pixels());
  window.renderPixels = () => base64(pixels());
}

/** The lab itself: every loaded widget gets resets, the `only` ones draw, in load (lab) order, at weight 1. Every step
    first sets ctx.moment from the song's moments, as the top of the lab's step() does; a reset leaves it alone. */
export function labCompat(rt: WidgetRuntime, only: readonly string[], moments: readonly LabMoment[]): Stepper {
  const on = new Set(only);
  return {
    reset: (t) => rt.reset(t),
    step: (t, dt) => {
      rt.setMoment(momentAt(moments, t));
      const slots: Slot[] = rt.loaded().filter((id) => on.has(id)).map((id) => ({ id, receiving: true, weight: 1 }));
      rt.step(t, dt, slots);
    },
  };
}

