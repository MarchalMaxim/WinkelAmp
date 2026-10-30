/**
 * The eight archetypes: prototype regions in "character space" plus the
 * material each one is made of.
 *
 * Character space = the 8 shape axes (warmth is left out: it is derived from
 * energy/valence/brightness, so it would only double-count them) with valence
 * remapped to 0..1 so every dimension has the same range, plus three texture
 * dimensions taken straight from the descriptors — without them a steady
 * electronic groove and an erratic orchestral tutti look alike on the axes:
 *   pulse = pulseClarity, noise = noisiness, tonal = keyClarity.
 *
 * Each prototype names only the dimensions that define it, each with a center
 * and an importance; the distance is the importance-weighted MEAN squared
 * deviation, so an archetype with few constraints is not favoured over a
 * fully specified one.
 */
import type { ArchetypeId, Material } from './types';
import { hex, type Palette } from './palette';

export const SPACE_DIMS = [
  'energy', 'valence', 'weight', 'size', 'agitation', 'sharpness', 'density', 'pace', 'pulse', 'noise', 'tonal',
] as const;
export type SpaceDim = (typeof SPACE_DIMS)[number];
export type SpacePoint = Record<SpaceDim, number>;

export type MaterialShape = Omit<Material, 'palette'>;

export interface Archetype {
  id: ArchetypeId;
  name: string;
  /** Most characteristic first; the first word names the archetype in `Character.words`. */
  words: string[];
  /** [center, importance] per defining dimension (valence on 0..1 here). */
  proto: Partial<Record<SpaceDim, [number, number]>>;
  material: MaterialShape;
  /** Shadow → highlight, linear RGB, monotone in luminance. */
  palette: Palette;
  /** How strongly event colors follow the note's hue (synesthetic pitch color) vs the palette. */
  noteTint: number;
}

const m = (
  buoyancy: number, gravity: number, vorticity: number, viscosity: number, dyeFade: number,
  splatSize: number, splatForce: number, jitter: number, sparkAmount: number, sparkSize: number,
  sparkLife: number, twinkle: number, angularity: number, emissive: number, contrast: number,
  grain: number, aura: number,
): MaterialShape => ({
  buoyancy, gravity, vorticity, viscosity, dyeFade, splatSize, splatForce, jitter, sparkAmount, sparkSize,
  sparkLife, twinkle, angularity, emissive, contrast, grain, aura,
});

const pal = (a: string, b: string, c: string, d: string): Palette => [hex(a), hex(b), hex(c), hex(d)];

/*                       buoy grav vort visc fade size force jitr spark ssz slife twin ang  emis cont grain aura */
export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  fire: {
    id: 'fire', name: 'Fire', words: ['fiery', 'flickering', 'blazing'],
    proto: {
      energy: [0.72, 1], agitation: [0.75, 2], pace: [0.65, 1], sharpness: [0.55, 0.6], weight: [0.35, 0.6],
      size: [0.45, 0.4], valence: [0.4, 0.4], pulse: [0.3, 0.6], density: [0.6, 0.5],
    },
    material: m(0.9, 0, 0.85, 0.15, 0.7, 0.4, 0.75, 0.8, 0.8, 0.45, 0.35, 0.7, 0.6, 0.85, 0.75, 0.3, 0.45),
    // Blackbody: ember red → orange → yellow → white-hot.
    palette: pal('#2a0400', '#b31b00', '#ff7a00', '#ffe7a0'),
    noteTint: 0.2,
  },
  abyss: {
    id: 'abyss', name: 'Abyss', words: ['dark', 'blunt', 'heavy', 'brooding'],
    proto: {
      weight: [0.82, 2], size: [0.78, 1.4], pace: [0.3, 1], valence: [0.15, 1], sharpness: [0.25, 0.8],
      agitation: [0.35, 0.6], energy: [0.55, 0.6],
    },
    material: m(0, 0.8, 0.2, 0.85, 0.2, 0.95, 0.55, 0.15, 0.08, 0.7, 0.7, 0.1, 0.15, 0.2, 0.85, 0.45, 0.6),
    // Near-black indigo, bruised purple, oxblood, dim lavender highlight: dark and blunt.
    palette: pal('#05030c', '#22103a', '#4d0f22', '#5e4f7c'),
    noteTint: 0.15,
  },
  sugar: {
    id: 'sugar', name: 'Sugar', words: ['whimsical', 'tiny', 'twinkling', 'quick'],
    proto: {
      size: [0.25, 1.6], weight: [0.25, 1.2], sharpness: [0.7, 1], pace: [0.62, 0.8], agitation: [0.4, 0.5],
      energy: [0.45, 0.6], pulse: [0.65, 0.5], density: [0.4, 0.4], valence: [0.6, 0.3],
    },
    material: m(0.3, 0.05, 0.3, 0.1, 0.75, 0.12, 0.4, 0.55, 0.95, 0.1, 0.3, 0.95, 0.75, 0.7, 0.5, 0.1, 0.35),
    // Pastel pink, mint, ice, white sparkle over a soft plum shadow.
    palette: pal('#4b3a5e', '#ffb3d1', '#b8f5dc', '#f4fbff'),
    noteTint: 0.75,
  },
  mist: {
    id: 'mist', name: 'Mist', words: ['serene', 'hazy', 'floating'],
    proto: {
      energy: [0.25, 1.5], agitation: [0.15, 1], sharpness: [0.15, 1.2], pace: [0.2, 1], density: [0.2, 0.6],
      valence: [0.5, 0.5], weight: [0.4, 0.3],
    },
    material: m(0.2, 0.05, 0.1, 0.6, 0.15, 0.7, 0.15, 0.2, 0.05, 0.3, 0.9, 0.15, 0, 0.35, 0.2, 0.2, 0.8),
    // Cool dusk, lavender grey, pale teal, pale lavender.
    palette: pal('#1d2333', '#6f7fa6', '#8fc7c4', '#e6e2f5'),
    noteTint: 0.45,
  },
  gold: {
    id: 'gold', name: 'Gold', words: ['radiant', 'triumphant', 'golden'],
    proto: {
      valence: [0.78, 1.6], energy: [0.7, 1], agitation: [0.3, 0.8], size: [0.55, 0.5], pulse: [0.7, 0.6],
      tonal: [0.75, 0.5], pace: [0.6, 0.4],
    },
    material: m(0.5, 0.1, 0.3, 0.35, 0.45, 0.75, 0.65, 0.2, 0.5, 0.4, 0.55, 0.4, 0.35, 0.9, 0.6, 0.15, 0.6),
    // Amber, gold, white.
    palette: pal('#2a1600', '#a8650a', '#f2c14e', '#fff8e6'),
    noteTint: 0.35,
  },
  storm: {
    id: 'storm', name: 'Storm', words: ['stormy', 'driving', 'turbulent'],
    proto: {
      energy: [0.82, 1.5], density: [0.78, 1.2], agitation: [0.7, 1.6], valence: [0.3, 0.8], weight: [0.55, 0.7],
      size: [0.65, 0.6], pace: [0.62, 0.6], noise: [0.4, 0.3],
    },
    material: m(0.3, 0.3, 0.9, 0.25, 0.55, 0.65, 0.9, 0.65, 0.45, 0.25, 0.2, 0.8, 0.7, 0.6, 0.9, 0.5, 0.5),
    // Slate, steel blue, violet, white flash.
    palette: pal('#0d1117', '#34475e', '#6a5acd', '#eef3ff'),
    noteTint: 0.25,
  },
  machine: {
    id: 'machine', name: 'Machine', words: ['mechanical', 'pulsing', 'electric'],
    proto: {
      pulse: [0.85, 2.5], noise: [0.55, 2], tonal: [0.3, 1], sharpness: [0.72, 0.8], energy: [0.6, 0.5],
      pace: [0.62, 0.5], agitation: [0.45, 0.3],
    },
    material: m(0.1, 0.1, 0.2, 0.3, 0.85, 0.35, 0.7, 0.05, 0.6, 0.15, 0.15, 0.3, 0.95, 0.8, 0.85, 0.25, 0.45),
    // Black, neon magenta, neon cyan, cyan-white.
    palette: pal('#020208', '#ff1fa8', '#00e5ff', '#e8ffff'),
    noteTint: 0.6,
  },
  lament: {
    id: 'lament', name: 'Lament', words: ['mournful', 'wistful', 'grey'],
    proto: {
      valence: [0.2, 1.5], energy: [0.3, 1], pace: [0.25, 1], sharpness: [0.2, 0.8], agitation: [0.25, 0.6],
      weight: [0.55, 0.5], tonal: [0.6, 0.3],
    },
    material: m(0, 0.45, 0.12, 0.7, 0.25, 0.6, 0.2, 0.1, 0.2, 0.2, 0.9, 0.2, 0.05, 0.25, 0.35, 0.35, 0.65),
    // Blue-black, blue-grey, desaturated teal, pale grey.
    palette: pal('#121820', '#3e4c5a', '#5f8582', '#b9c4cc'),
    noteTint: 0.25,
  },
};

/** Importance-weighted mean squared distance from a point to an archetype's prototype. */
export function protoDistance(a: Archetype, p: SpacePoint): number {
  let sum = 0;
  let wSum = 0;
  for (const dim of SPACE_DIMS) {
    const spec = a.proto[dim];
    if (!spec) continue;
    const d = p[dim] - spec[0];
    sum += spec[1] * d * d;
    wSum += spec[1];
  }
  return wSum > 0 ? sum / wSum : 0;
}
