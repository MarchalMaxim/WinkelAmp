/**
 * Stage contracts shared by the analysis (melody, structure), the script player,
 * the live director and the compositor. Data only: no code lives here.
 */

/** One note of the predominant melody. Times are song seconds (when it was heard, not when the analysis saw it). */
export interface MelodyNote {
  start: number;
  end: number;
  /** Rounded-free MIDI pitch: the median of the contour over the note (may be fractional). */
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
