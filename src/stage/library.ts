/**
 * The live director's scenes: what goes on stage when no script runs, tagged by
 * the moods (archetypes) each one suits.
 *
 * Each pure scene scores 1 for its own archetype; blends score at most 0.7 for
 * theirs, so a clear mood always gets its own scene and a blend only wins when
 * two moods share the lead (or as the "something else" a change asks for).
 *
 * Element ids are their types (at most one of each type per scene): the stage
 * keeps an instance per id, so a type two scenes share carries over through a
 * change and is restyled instead of running twice during a blend. Scenes keep
 * to four elements (the composer's crowding limit) and leave the palette to the
 * mood: the character engine colors the live show.
 */
import type { ArchetypeId } from '../character/types';
import type { ElementParams, ElementSpec, ElementType, SceneDef } from './types';

export interface LibraryScene extends SceneDef {
  name: string;
  /** 0..1 per archetype: how well the scene suits that mood (unlisted = 0). */
  affinity: Partial<Record<ArchetypeId, number>>;
}

const el = (type: ElementType, params?: Partial<ElementParams>): ElementSpec => ({ id: type, type, ...(params && { params }) });

export const LIBRARY: LibraryScene[] = [
  {
    // Hot dye rising, embers drifting up out of it, the tune written in ink.
    name: 'Embers',
    affinity: { fire: 1, storm: 0.3, gold: 0.2 },
    look: { trails: 0.6, warp: 0.4, glow: 0.8 },
    elements: [
      el('fluid', { intensity: 0.8 }),
      el('sparks', { style: 'embers', region: 'bottom', intensity: 0.8 }),
      el('melody', { style: 'ink' }),
      el('bass', { style: 'orbs', region: 'bottom', size: 0.4 }),
    ],
  },
  {
    // Slow tides at the bottom of a dark field; a faint line of melody above them.
    name: 'Deep water',
    affinity: { abyss: 1, lament: 0.3 },
    look: { trails: 0.75, warp: 0.3, glow: 0.4 },
    elements: [
      el('bass', { style: 'tides', region: 'bottom', size: 0.8, intensity: 0.8 }),
      el('bloom', { style: 'fields', intensity: 0.5 }),
      el('melody', { style: 'ribbon', intensity: 0.5 }),
      el('fluid', { intensity: 0.6 }),
    ],
  },
  {
    // Tiny stars and beads of melody, small rings on the beat, mirrored like a toy.
    name: 'Music box',
    affinity: { sugar: 1, gold: 0.3 },
    look: { trails: 0.35, warp: 0.1, mirror: 6, glow: 0.7 },
    elements: [
      el('sparks', { style: 'stars', size: 0.3 }),
      el('melody', { style: 'beads', size: 0.4 }),
      el('pulse', { style: 'rings', size: 0.3, intensity: 0.5 }),
      el('bloom', { style: 'aurora', intensity: 0.4 }),
    ],
  },
  {
    // Haze: soft fluid and aurora, a thin floating line; long, drifting trails.
    name: 'Fog',
    affinity: { mist: 1, lament: 0.3 },
    look: { trails: 0.85, warp: 0.5, glow: 0.5 },
    elements: [
      el('fluid', { intensity: 0.6 }),
      el('bloom', { style: 'aurora', intensity: 0.6 }),
      el('melody', { style: 'ribbon', size: 0.3, intensity: 0.6 }),
    ],
  },
  {
    // Broad radiant fields, the tune high up, light flashing on the beat, gold dust.
    name: 'Cathedral',
    affinity: { gold: 1, sugar: 0.2 },
    look: { trails: 0.5, warp: 0.15, mirror: 2, glow: 0.9 },
    elements: [
      el('bloom', { style: 'fields', intensity: 0.9 }),
      el('melody', { style: 'ribbon', region: 'top', intensity: 0.8 }),
      el('pulse', { style: 'flash', intensity: 0.4 }),
      el('sparks', { style: 'dust', intensity: 0.5 }),
    ],
  },
  {
    // Turbulence: a churning fluid, rolling low tides, sharp stars, ink.
    name: 'Tempest',
    affinity: { storm: 1, fire: 0.3, abyss: 0.2 },
    look: { trails: 0.6, warp: 0.8, glow: 0.6 },
    elements: [
      el('fluid', { intensity: 0.9 }),
      el('bass', { style: 'tides', size: 0.7 }),
      el('sparks', { style: 'stars', intensity: 0.8 }),
      el('melody', { style: 'ink', intensity: 0.8 }),
    ],
  },
  {
    // A grid that throbs on the beat, a scope trace, dust and orbs: short, crisp trails.
    name: 'Circuit',
    affinity: { machine: 1, sugar: 0.2 },
    look: { trails: 0.3, warp: 0.1, mirror: 4, glow: 0.8 },
    elements: [
      el('pulse', { style: 'grid', intensity: 0.8 }),
      el('wave', { style: 'line', intensity: 0.7 }),
      el('sparks', { style: 'dust', size: 0.3 }),
      el('bass', { style: 'orbs', size: 0.5 }),
    ],
  },
  {
    // Grey fields and falling dust, the tune a slow ribbon through it.
    name: 'Rain',
    affinity: { lament: 1, mist: 0.3 },
    look: { trails: 0.7, warp: 0.15, glow: 0.4 },
    elements: [
      el('bloom', { style: 'fields', intensity: 0.4 }),
      el('melody', { style: 'ribbon', intensity: 0.7 }),
      el('sparks', { style: 'dust', intensity: 0.4, size: 0.3 }),
      el('fluid', { intensity: 0.4 }),
    ],
  },
  {
    // Dark and mournful at once: ink over deep tides under a dim aurora.
    name: 'Nocturne',
    affinity: { lament: 0.7, abyss: 0.7, mist: 0.4 },
    look: { trails: 0.8, warp: 0.25, glow: 0.45 },
    elements: [
      el('melody', { style: 'ink', intensity: 0.7 }),
      el('bass', { style: 'tides', region: 'bottom', size: 0.7 }),
      el('bloom', { style: 'aurora', intensity: 0.5 }),
    ],
  },
  {
    // Bright and precise: stars and rings around a circular scope, deeply mirrored.
    name: 'Kaleidoscope',
    affinity: { sugar: 0.7, machine: 0.7 },
    look: { trails: 0.4, warp: 0.2, mirror: 8, glow: 0.75 },
    elements: [
      el('sparks', { style: 'stars', size: 0.35 }),
      el('pulse', { style: 'rings', intensity: 0.6 }),
      el('wave', { style: 'circle', size: 0.4 }),
    ],
  },
  {
    // Panic and disgust: the picture melts off the screen, paint runs from the top, and every
    // big chord slashes through it all. A blend (never the pure scene) for high-arousal dark moods.
    // Ink without a fluid: the fluid is screened over the feedback, so it would neither melt nor cut.
    name: 'Casket',
    affinity: { storm: 0.6, fire: 0.3, abyss: 0.3 },
    look: { trails: 0.85, warp: 0.1, glow: 0.5, melt: 0.6 },
    elements: [
      el('slash'),
      el('drip', { intensity: 0.7 }),
      el('bass', { style: 'orbs', region: 'bottom', size: 0.6, intensity: 0.45 }),
      el('melody', { style: 'ink', intensity: 0.7 }),
    ],
  },
  {
    // Fire turning to glory: warm fields over the fluid, embers, flashes on the beat.
    name: 'Sunrise',
    affinity: { gold: 0.7, fire: 0.7 },
    look: { trails: 0.55, warp: 0.3, glow: 0.9 },
    elements: [
      el('fluid', { intensity: 0.7 }),
      el('bloom', { style: 'fields', intensity: 0.7 }),
      el('sparks', { style: 'embers', intensity: 0.7 }),
      el('pulse', { style: 'flash', intensity: 0.4 }),
    ],
  },
];
