/**
 * Stage contracts shared by the analysis (melody, structure), the script player,
 * the live director and the compositor. Data shapes and their default values only: no logic lives here.
 */
import type { Fingerprint } from '../audio/fingerprint';

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
}

/** A named set of elements with a look. */
export interface SceneDef {
  look?: Partial<Look>;
  elements: ElementSpec[];
}

/** One timeline entry: exactly one action at song time `at` (seconds). `snap: false` keeps `at` off the onset/beat grid. */
export type Cue = { at: number; snap?: boolean } & (
  | { scene: string; transition?: { kind: 'cut' | 'blend'; duration?: number } }
  | { enter: ElementSpec; fade?: number }
  | { exit: string; fade?: number }
  | { accent: { kind: 'flash' | 'shock' | 'swell'; color?: string; strength?: number } }
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
  kind: 'flash' | 'shock' | 'swell';
  /** RGB, 0..1 per channel. */
  color: [number, number, number];
  strength: number;
  /** Seconds since it fired. */
  age: number;
}

/** What the script player or the live director hands the compositor each frame. */
export interface StageDirectives {
  source: 'scripted' | 'live';
  scene: string;
  look: Look;
  cast: CastMember[];
  accents: Accent[];
}

export const DEFAULT_PARAMS: ElementParams = { intensity: 0.7, size: 0.5, region: 'full', color: 'mood', style: '' };
export const DEFAULT_LOOK: Look = { palette: 'mood', trails: 0.5, warp: 0.2, mirror: 1, glow: 0.6 };
