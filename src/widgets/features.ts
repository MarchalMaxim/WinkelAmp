// The lab's step() arithmetic (lab/index.html), in the same operation order, so knob values match to the last bit.
import type { Chord, Drive, Features, KnobMap, KnobState, Param, SoundingNote } from './types';

/** Every feature a knob can follow: adding one here (and to newFeatures) adds its two drives everywhere. */
export const FEATURE_KEYS = ['level', 'rate', 'pitch', 'bass', 'density', 'hit', 'loud', 'pace', 'rel'] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];
/** '' (fixed), then '+key' and '-key' for every feature. */
export const DRIVES: readonly Drive[] = ['', ...FEATURE_KEYS.flatMap((k): Drive[] => [`+${k}`, `-${k}`])];

export function newFeatures(): Features {
  return { level: 0, rate: 0, pitch: 0.5, bass: 0, density: 0, hit: 0, loud: 0, pace: 0, rel: 0 };
}

/** The lab's ctx.p: base, moved by a drive (pitch centred on 0.5), clamped to the knob's range. */
export function knobValue(q: Param, s: KnobState, f: Features): number {
  let v = s.base;
  if (s.drive) v += (s.drive[0] === '+' ? 1 : -1) * s.depth * (q.max - q.min) * (f[s.drive.slice(1) as FeatureKey] - (s.drive.endsWith('pitch') ? 0.5 : 0));
  return Math.max(q.min, Math.min(q.max, v));
}

/** Knob states for a widget's params: the lab's PST defaults, with overrides (a number sets base). Unknown keys are ignored. */
export function resolveKnobs(params: readonly Param[], over?: Record<string, number | Partial<KnobState>>): KnobMap {
  const out: KnobMap = {};
  for (const q of params) {
    const s: KnobState = { base: q.value, drive: q.drive ?? '', depth: 0.5 };
    const o = over && Object.prototype.hasOwnProperty.call(over, q.key) ? over[q.key] : undefined;
    if (typeof o === 'number') s.base = o;
    else if (o && typeof o === 'object') Object.assign(s, o);
    out[q.key] = s;
  }
  return out;
}

/** hit: each attack's jump, gone in a blink (half-life 0.08 s); level and rate are the slow pulse. */
export interface Pulse { level: number; rate: number; hit: number }

/** One step of the lab's features: the pulse decays, fired chords kick it, pitch/bass/density follow what sounds.
    hit's statements stand on their own lines after the others', which are untouched: level and rate run exactly the
    arithmetic they always did, and hit (read by nothing else) is the same whether kicked in that loop or its own.
    hit is kicked toward 1 by a soft union, not a max: a soft note right after a loud one still makes it jump. */
export function advanceFeatures(p: Pulse, f: Features, fired: readonly Chord[], snd: readonly SoundingNote[], dt: number): void {
  p.level *= Math.pow(0.5, dt / 0.8); p.rate *= Math.pow(0.5, dt / 1.0);
  p.hit *= Math.pow(0.5, dt / 0.08);
  for (const ch of fired) { p.level = Math.max(p.level, ch.vel / 115); p.rate += 1 / 1.44; }
  for (const ch of fired) p.hit = 1 - (1 - p.hit) * (1 - Math.pow(ch.vel / 127, 1.4));
  const k = 1 - Math.pow(0.5, dt / 0.25);
  let top: SoundingNote | null = null, bass = 0;
  for (const n of snd) { if (!top || n.m > top.m) top = n; if (n.m < 50) bass += n.v / 127; }
  f.level = p.level; f.rate = Math.min(1, p.rate / 8);
  f.pitch += ((top ? pitch01(top.m) : f.pitch) - f.pitch) * k;
  f.bass += (Math.min(1, bass / 2) - f.bass) * k;
  f.density += (Math.min(1, snd.length / 10) - f.density) * k;
  f.hit = p.hit;
}

/** MIDI → 0..1 over the piano (21..108). */
export const pitch01 = (m: number): number => Math.max(0, Math.min(1, (m - 21) / 87));

/** The lab's live frame(): a jump over 0.5 s resets the picture (also paused); otherwise dt = song time moved, ≤ 0.05. */
export function liveClock(lastT: number, t: number, paused: boolean): { reset: boolean; dt: number } {
  const reset = Math.abs(t - lastT) > 0.5;
  if (reset) return { reset, dt: 0 };
  return { reset, dt: paused ? 0 : Math.min(0.05, Math.max(0, t - lastT)) };
}
