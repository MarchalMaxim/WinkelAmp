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

/** A chord change: root pitch class 0..11, chroma of 12. */
export interface Chord {
  t: number;
  root: number;
  minor: boolean;
  chroma: number[];
}
