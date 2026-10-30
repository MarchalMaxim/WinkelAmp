/**
 * Contracts shared by the character engine's modules.
 * See docs/CHARACTER-PLAN.md for the big picture.
 */
import type { Features } from '../audio/features';

/**
 * Medium-timescale musical descriptors (1–8 s windows), updated every frame.
 * All values are 0..1 unless stated otherwise, and change smoothly.
 */
export interface Descriptors {
  /** Loudness on an absolute-ish scale (slow long-term reference, NOT per-song auto-gain). 0 = silence, 1 = very loud. */
  loudness: number;
  /** How much loudness varies over ~4 s (dynamic contrast, swells, accents). */
  dynamics: number;
  /** Pitch height of the tonal content: 0 ≈ C1 (deep bass), 1 ≈ C8 (top of a piano). */
  register: number;
  /** How wide a range of pitches is in use (0 = one narrow band, 1 = bass to treble at once). */
  registerSpread: number;
  /** Spectral centroid on a log scale: 0 = dark/muffled, 1 = bright/brilliant. */
  brightness: number;
  /** Spectral flatness: 0 = pure tones, 1 = noise. */
  noisiness: number;
  /** Sensory dissonance / beating between close partials. */
  roughness: number;
  /** Onsets per second, scaled: value = min(1, rate / 10). */
  onsetRate: number;
  /** Irregularity of inter-onset intervals (coefficient of variation, scaled to 0..1). Erratic = high. */
  irregularity: number;
  /** Sharpness of attacks: 0 = soft swells, 1 = percussive / staccato / pizzicato. */
  attack: number;
  /** Legato: how much energy is sustained between onsets (0 = dry/staccato, 1 = sustained). */
  sustain: number;
  /** Tempo in BPM / 200, 0 when unknown. */
  tempo: number;
  /** How periodic the onsets are (0 = no pulse, 1 = metronomic). */
  pulseClarity: number;
  /** Mode: -1 = clearly minor, +1 = clearly major, 0 = ambiguous. */
  majorness: number;
  /** How confidently a key is established (0 = atonal/noisy, 1 = clear). */
  keyClarity: number;
  /** Rate of harmonic change (chroma movement). */
  harmonicChange: number;
  /** How fast the melodic register moves. */
  pitchMotion: number;
  /** 1 = silence / nothing playing. */
  silence: number;
}

/** The 50 MagnaTagATune tags musicnn predicts, in the model's output order. */
export interface NeuralTags {
  names: readonly string[];
  /** Sigmoid probabilities, same order as `names`. */
  values: Float32Array;
  /** performance.now() / 1000 when computed. */
  at: number;
}

export type ArchetypeId = 'fire' | 'abyss' | 'sugar' | 'mist' | 'gold' | 'storm' | 'machine' | 'lament';

/** Continuous character axes. Range noted per axis. */
export interface CharacterAxes {
  /** Arousal: 0 calm … 1 intense. */
  energy: number;
  /** -1 dark/sad … +1 bright/happy. */
  valence: number;
  /** 0 light/airy … 1 heavy/blunt. */
  weight: number;
  /** 0 tiny … 1 huge. */
  size: number;
  /** 0 steady … 1 erratic. */
  agitation: number;
  /** 0 round/legato … 1 sharp/angular/staccato. */
  sharpness: number;
  /** 0 sparse … 1 dense. */
  density: number;
  /** 0 cool … 1 warm color temperature. */
  warmth: number;
  /** 0 slow … 1 quick. */
  pace: number;
}

export interface Character {
  axes: CharacterAxes;
  /** Archetype blend weights, sorted descending, summing to 1. */
  blend: { id: ArchetypeId; weight: number }[];
  /** 1–3 plain-language words describing the music right now, e.g. ["fiery", "erratic"]. */
  words: string[];
  /** 0..1: how confident the engine is (low during silence or right after a change). */
  confidence: number;
}

/** Linear RGB, each 0..1. */
export type Rgb = [number, number, number];

/**
 * What the picture is made of. Produced by the character engine, consumed by the
 * Living Canvas. All 0..1; the renderer decides the physical units.
 */
export interface Material {
  /** Hot dye rises (fire). */
  buoyancy: number;
  /** Downward pull (heavy things sink). */
  gravity: number;
  /** Curl / vorticity confinement: turbulence, flicker. */
  vorticity: number;
  /** 0 runny … 1 thick and slow (velocity damping). */
  viscosity: number;
  /** How quickly color fades away. */
  dyeFade: number;
  /** Size of injected blobs: 0 tiny … 1 huge. */
  splatSize: number;
  /** Strength of injected motion. */
  splatForce: number;
  /** Randomness of emission position/direction (erratic). */
  jitter: number;
  /** Amount of spark/mote particles. */
  sparkAmount: number;
  /** Spark size: 0 pin-pricks … 1 fat embers. */
  sparkSize: number;
  /** Spark lifetime. */
  sparkLife: number;
  /** Spark flicker / twinkle. */
  twinkle: number;
  /** 0 round soft forms … 1 jagged, angular, crisp. */
  angularity: number;
  /** Glow / bloom strength. */
  emissive: number;
  /** Tonal contrast of the final image. */
  contrast: number;
  /** Film-grain / texture amount. */
  grain: number;
  /** Strength of the background neural aura (CPPN field). */
  aura: number;
  /** Palette from shadow to highlight, 4 stops, linear RGB. */
  palette: [Rgb, Rgb, Rgb, Rgb];
}

/** One sound event for the canvas to express (an onset, or a sustained note tick). */
export interface SoundEvent {
  /** Pitch height 0..1 (same scale as Descriptors.register) → vertical position. */
  height: number;
  /** -1..1 horizontal position hint (from the reservoir or stereo). */
  pan: number;
  /** 0..1 strength. */
  strength: number;
  /** Pitch class 0..11, or -1 for unpitched. */
  note: number;
  /** Linear RGB color for this event. */
  color: Rgb;
  /** true for onsets, false for continuous emission while sustained. */
  onset: boolean;
}

/** Organic, slowly-evolving gestures produced by the echo-state network. */
export interface Gesture {
  /** Emitter wander, -1..1 each. */
  x: number;
  y: number;
  /** Direction of motion injection, radians. */
  angle: number;
  /** -1..1 global swirl tendency. */
  swirl: number;
  /** 0..1 slow "breath" used for aura and global intensity. */
  breath: number;
  /** A few extra raw readout channels (-1..1) for the aura shader. */
  extra: [number, number, number, number];
}

export interface LivingInput {
  dt: number;
  time: number;
  features: Features;
  descriptors: Descriptors;
  character: Character;
  material: Material;
  gesture: Gesture;
  events: SoundEvent[];
  /** Pointer in normalized coordinates (0..1, y down), with velocity in normalized units / s. */
  pointer: { x: number; y: number; dx: number; dy: number; down: boolean };
}

export const ARCHETYPE_IDS: readonly ArchetypeId[] = ['fire', 'abyss', 'sugar', 'mist', 'gold', 'storm', 'machine', 'lament'];

export function neutralDescriptors(): Descriptors {
  return {
    loudness: 0, dynamics: 0, register: 0.5, registerSpread: 0, brightness: 0.5, noisiness: 0, roughness: 0,
    onsetRate: 0, irregularity: 0, attack: 0, sustain: 0, tempo: 0, pulseClarity: 0, majorness: 0,
    keyClarity: 0, harmonicChange: 0, pitchMotion: 0, silence: 1,
  };
}

/** Read access to the most recent mono PCM the user hears (or the mic). */
export interface PcmSource {
  readonly sampleRate: number;
  /** Total samples written so far (monotonic); lets consumers detect fresh data. */
  readonly written: number;
  /** Copies the most recent `out.length` mono samples into `out` (zero-filled if not enough yet). */
  latest(out: Float32Array): void;
}
