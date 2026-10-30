/**
 * Stage contracts shared by the analysis (melody, structure), the script player,
 * the live director and the compositor. Data shapes and their default values only: no logic lives here.
 */
import type { Features } from '../audio/features';
import type { Fingerprint } from '../audio/fingerprint';
import type { Character, Descriptors, Gesture, LivingInput, Material, Rgb, SoundEvent } from '../character/types';
import type { SpriteBatch, StrokeBatch } from './gl';

export type { Fingerprint };

/** One note of the predominant melody. Times are song seconds (when it was heard, not when the analysis saw it). */
export interface MelodyNote {
  start: number;
  end: number;
  /** Unrounded MIDI pitch: the median of the contour over the note (may be fractional). */
  midi: number;
  /** 0..1: how loud the line is against the rest of the piece. */
  strength: number;
  /** 0..1: how sure the tracker is that this is the melody (salience margin, stability). */
  confidence: number;
}

/** The melody at one analysis hop. */
export interface MelodyFrame {
  /** MIDI float; NaN when unvoiced. */
  pitch: number;
  voiced: boolean;
  /** 0..1 harmonic salience of the chosen pitch (0 in silence). */
  salience: number;
  /** The note sounding now, or null. */
  note: MelodyNote | null;
  /** A note started this frame (it was confirmed this frame: live notes are backdated to their start). */
  noteOn: boolean;
}

/** A stretch of a piece with one character (harmony, register, texture, loudness). Song seconds. */
export interface Section {
  start: number;
  end: number;
  /** 0..1: how strongly the music changes at `start` (0 for the first section). */
  novelty: number;
}

/** The low end coming back hard after a stripped-back moment. */
export interface Drop {
  /** Song seconds: where the bass came in. */
  time: number;
  /** 0..1: how much louder the bass is than its recent average. */
  strength: number;
}

/** One analysis row for structure detection (descriptor values are 0..1, chroma peak-normalised). */
export interface StructureRow {
  chroma: ArrayLike<number>;
  loudness: number;
  register: number;
  brightness: number;
  onsetRate: number;
  sustain: number;
}

// ---- Scripts: what a composed show says (corpus/<id>.json) ----

/** The cast: each element type follows one stream of the music (see the design spec's table). */
export type ElementType = 'melody' | 'bass' | 'sparks' | 'bloom' | 'pulse' | 'wave' | 'fluid';

/** Where on screen an element prefers to be. */
export type Region = 'full' | 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface ElementParams {
  /** 0..1 */
  intensity: number;
  /** 0..1 */
  size: number;
  region: Region;
  /** 'mood' follows the character palette, 'note' colors by pitch class, or a fixed '#rgb' / '#rrggbb'. */
  color: 'mood' | 'note' | string;
  /** One of STYLES[type]; '' means the type's first style. */
  style: string;
}

/** The looks each element type can take; the first is its default. */
export const STYLES: Record<ElementType, readonly string[]> = {
  melody: ['ribbon', 'beads', 'ink'],
  bass: ['orbs', 'tides'],
  sparks: ['stars', 'dust', 'embers'],
  bloom: ['fields', 'aurora'],
  pulse: ['rings', 'grid', 'flash'],
  wave: ['line', 'circle'],
  fluid: ['living'],
};

/** An element as a script writes it: only what differs from DEFAULT_PARAMS. */
export interface ElementSpec {
  /** Unique on stage; cues address the element by it (exit, ramp). */
  id: string;
  type: ElementType;
  params?: Partial<ElementParams>;
}

/** The whole picture's treatment. */
export interface Look {
  /** 'mood' follows the character engine, 'notes' colors by pitch class, or four fixed colors. */
  palette: 'mood' | 'notes' | [string, string, string, string];
  /** 0..1: how long the feedback trails linger. */
  trails: number;
  /** 0..1: how much the feedback drifts and swirls. */
  warp: number;
  /** Kaleidoscope symmetry (1 = none). */
  mirror: 1 | 2 | 4 | 6 | 8 | 12;
  /** 0..1 */
  glow: number;
  /** 0..1: the picture slides down in columns, dripping off the screen (0 = still). */
  melt: number;
}

/** A named set of elements with a look. */
export interface SceneDef {
  look?: Partial<Look>;
  elements: ElementSpec[];
}

/** The accents a script can fire: `cut` slices the picture along a line and shoves the halves apart. */
export type AccentKind = 'flash' | 'shock' | 'swell' | 'cut';

/** One timeline entry: exactly one action at song time `at` (seconds). `snap: false` keeps `at` off the onset/beat grid. */
export type Cue = { at: number; snap?: boolean } & (
  | { scene: string; transition?: { kind: 'cut' | 'blend'; duration?: number } }
  | { enter: ElementSpec; fade?: number }
  | { exit: string; fade?: number }
  | { accent: { kind: AccentKind; color?: string; strength?: number } }
  | { ramp: { target: string /* 'look.trails' | '<elementId>.intensity' | '<elementId>.size' */; to: number; duration: number } }
);

/** The in-app character studies (recognised by id, not fingerprint). */
export type StudyId = 'ember' | 'basalt' | 'sugar' | 'mist';

/** A composed show (corpus/<id>.json). */
export interface Script {
  version: 1;
  /** Slug; the file is corpus/<id>.json and its song data corpus/<id>.data.json. */
  id: string;
  title: string;
  artist?: string;
  /** Song seconds. */
  duration: number;
  /** The composer's notes: what the piece is and why the show is built as it is. */
  notes?: string;
  match: { kind: 'recording' } | { kind: 'study'; study: StudyId; seed: number };
  scenes: Record<string, SceneDef>;
  /** Sorted by `at` (ties allowed: they apply in order). */
  timeline: Cue[];
}

/** The precomputed analysis bundled with a recording's script (corpus/<id>.data.json). Song seconds throughout. */
export interface SongData {
  version: 1;
  id: string;
  duration: number;
  fingerprint: Fingerprint;
  /** `contour.midi[i]` is the heard pitch at song time i · hop (analysis latency already removed; null = unvoiced), as SongFeed reads it. */
  melody: { notes: MelodyNote[]; contour: { hop: number; midi: (number | null)[] } };
  beats: number[];
  /** Onset time and strength 0..1. */
  onsets: { t: number; s: number }[];
  sections: Section[];
  drops: Drop[];
  /** Chord changes: root pitch class 0..11, chroma of 12. */
  chords: { t: number; root: number; minor: boolean; chroma: number[] }[];
  /** The character engine's leading archetype and words over time. */
  mood: { t: number; leader: string; words: string[] }[];
}

// ---- Directives: what the stage is told to show at one instant ----

export interface CastMember {
  spec: ElementSpec & { params: ElementParams };
  /** 0..1: how far it has faded in (enter/exit, scene blends). */
  presence: number;
}

export interface Accent {
  kind: AccentKind;
  /** RGB, 0..1 per channel. */
  color: [number, number, number];
  strength: number;
  /** Seconds since it fired. */
  age: number;
  /** Song seconds it fired at: who it is (a cut slices once, however long it stays listed). */
  at: number;
}

/** What the script player or the live director hands the compositor each frame. */
export interface StageDirectives {
  source: 'scripted' | 'live';
  scene: string;
  look: Look;
  cast: CastMember[];
  accents: Accent[];
}

// ---- The compositor: what the stage is handed each frame, and what an element is ----

/** Everything the stage needs for one frame. Motion comes from `clock` / `musicDt` and the audio values only. */
export interface StageFrame {
  /** Wall seconds since the last frame (pointer painting and musically triggered transitions only). */
  dt: number;
  /** Music seconds since the last frame: 0 in silence, so the picture freezes. */
  musicDt: number;
  clock: { time: number; drive: number; dim: number };
  f: Features;
  d: Descriptors;
  character: Character;
  material: Material;
  gesture: Gesture;
  melody: MelodyFrame;
  events: SoundEvent[];
  /** phase 0..1 within the beat; `hit` on the frame a beat lands. */
  beat: { phase: number; hit: boolean; strength: number };
  /** 12 pitch-class energies, max 1. */
  chroma: Float32Array;
  /** The latest ~2048 mono samples, -1..1. */
  wave: Float32Array;
  /** 0..1 Calm ↔ Wild: how strongly everything reacts. */
  wild: number;
  pointer: LivingInput['pointer'];
  directives: StageDirectives;
}

/** What the stage lends its elements: drawing helpers and this frame's shared state. */
export interface StageShared {
  /** Scene target size in pixels; aspect = w / h. */
  w: number;
  h: number;
  aspect: number;
  /** Draws a full-screen triangle with whatever program is bound. */
  quad(): void;
  sprites: SpriteBatch;
  strokes: StrokeBatch;
  /** This frame's palette, shadow → highlight, linear RGB: `look.palette` resolved against the material's. */
  palette: [Rgb, Rgb, Rgb, Rgb];
  /** `look.palette === 'notes'`: 'mood'-colored elements color by pitch instead. */
  notes: boolean;
  /** 0.5 (calm) … 1.5 (wild): scales how strongly audio moves things. */
  react: number;
  /** Seeded randomness (repeatable screenshots). */
  rand: () => number;
  /** A fluid is on stage this frame: melody ink goes into it. */
  fluid: boolean;
  /** Ink for the fluid this frame (the melody writes, the fluid reads; drawn melody-first). */
  ink: SoundEvent[];
  /** Pinned Living Canvas quality level for fluids (undefined = adaptive). */
  fluidLevel?: number;
  /** Full-screen layers composited after the feedback (the fluid's own finished picture: sRGB values). */
  layers: { tex: WebGLTexture; gain: number }[];
  /** Cuts asked for this frame (a slash on a chord): the stage slices the picture once, after the elements draw. */
  cuts: CutRequest[];
}

/** A cut an element asks the stage for. */
export interface CutRequest {
  /** 0..1: how far the halves are shoved apart. */
  strength: number;
  /** The scar's color, sRGB 0..1. */
  color: [number, number, number];
  /** Multiplies the shove (an element's size). */
  scale?: number;
}

export interface StageElement {
  readonly type: ElementType;
  init(gl: WebGL2RenderingContext, shared: StageShared): void;
  /** Draws into the bound scene framebuffer with additive blending; `presence` 0..1 scales everything. */
  draw(fr: StageFrame, member: CastMember): void;
  dispose(): void;
}

export const DEFAULT_PARAMS: ElementParams = { intensity: 0.7, size: 0.5, region: 'full', color: 'mood', style: '' };
export const DEFAULT_LOOK: Look = { palette: 'mood', trails: 0.5, warp: 0.2, mirror: 1, glow: 0.6, melt: 0 };
