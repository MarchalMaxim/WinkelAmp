/**
 * The "Sound → Motion" patch bay: each motion follows one sound source.
 */
import type { Features } from './audio/features';

export const SOURCES = [
  { id: 'none', label: 'Nothing', icon: '·' },
  { id: 'level', label: 'Loudness', icon: '◉' },
  { id: 'bass', label: 'Bass', icon: '●' },
  { id: 'mid', label: 'Mids', icon: '◐' },
  { id: 'treble', label: 'Highs', icon: '✦' },
  { id: 'beat', label: 'Beat', icon: '♥' },
  { id: 'pitch', label: 'Pitch', icon: '♪' },
  { id: 'brightness', label: 'Brightness', icon: '☀' },
] as const;

export type SourceId = (typeof SOURCES)[number]['id'];

export const MOTIONS = [
  { id: 'size', label: 'Size', hint: 'How big shapes swell' },
  { id: 'speed', label: 'Speed', hint: 'How fast things travel' },
  { id: 'spin', label: 'Spin', hint: 'How fast the picture turns' },
  { id: 'glow', label: 'Glow', hint: 'How brightly light shines' },
  { id: 'shake', label: 'Shake', hint: 'Jolts and wobble' },
  { id: 'colorShift', label: 'Color shift', hint: 'Pushes colors around the palette' },
  { id: 'zoom', label: 'Zoom', hint: 'Pulls the picture into the tunnel' },
] as const;

export type MotionId = (typeof MOTIONS)[number]['id'];

export interface Route {
  source: SourceId;
  /** 0..1 */
  amount: number;
}

export type Mapping = Record<MotionId, Route>;

export type Motion = Record<MotionId, number>;

export const DEFAULT_MAPPING: Mapping = {
  size: { source: 'bass', amount: 0.8 },
  speed: { source: 'mid', amount: 0.6 },
  spin: { source: 'level', amount: 0.3 },
  glow: { source: 'treble', amount: 0.7 },
  shake: { source: 'beat', amount: 0.35 },
  colorShift: { source: 'brightness', amount: 0.5 },
  zoom: { source: 'beat', amount: 0.4 },
};

export function sourceValue(f: Features, source: SourceId): number {
  switch (source) {
    case 'none': return 0;
    case 'level': return f.level;
    case 'bass': return f.bass;
    case 'mid': return f.mid;
    case 'treble': return f.treble;
    case 'beat': return f.beat;
    case 'pitch': return f.noteSmooth / 12;
    case 'brightness': return f.centroid;
  }
}

/**
 * Computes motion values. Each is `0.15 + amount * source * wild`,
 * so there's always a little life even when a route is off.
 */
export function applyMapping(f: Features, mapping: Mapping, wild: number, out: Motion = {} as Motion): Motion {
  for (const m of MOTIONS) {
    const r = mapping[m.id];
    out[m.id] = 0.15 + r.amount * sourceValue(f, r.source) * (0.4 + wild * 1.2);
  }
  return out;
}
