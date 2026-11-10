/** The analysis's data shapes: the melody, the structure and the song data. No logic lives here. */

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

/** One analysis row for structure detection (descriptor values are 0..1, chroma peak-normalised). */
export interface StructureRow {
  chroma: ArrayLike<number>;
  loudness: number;
  register: number;
  brightness: number;
  onsetRate: number;
  sustain: number;
}

/** A chord change: root pitch class 0..11, chroma of 12. */
export interface Chord {
  t: number;
  root: number;
  minor: boolean;
  chroma: number[];
}

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

export function neutralDescriptors(): Descriptors {
  return {
    loudness: 0, dynamics: 0, register: 0.5, registerSpread: 0, brightness: 0.5, noisiness: 0, roughness: 0,
    onsetRate: 0, irregularity: 0, attack: 0, sustain: 0, tempo: 0, pulseClarity: 0, majorness: 0,
    keyClarity: 0, harmonicChange: 0, pitchMotion: 0, silence: 1,
  };
}

/** Read access to the most recent mono PCM. */
export interface PcmSource {
  readonly sampleRate: number;
  /** Total samples written so far (monotonic); lets consumers detect fresh data. */
  readonly written: number;
  /** Copies the most recent `out.length` mono samples into `out` (zero-filled if not enough yet). */
  latest(out: Float32Array): void;
}
