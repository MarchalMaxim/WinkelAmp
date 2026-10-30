/**
 * Melody accuracy metrics (pure: no Node APIs, so tests can import them):
 * ground-truth melody lines from scores, MIREX-style frame scores, onset F1.
 * Used by scripts/eval/melody-eval.ts and tests/melody.test.ts.
 */
/** A sounding note of a score: onset t, MIDI m, length d (s); voice v; notes struck together may share a group. */
export interface RefEvent {
  t: number;
  m: number;
  d: number;
  v?: string;
  group?: number;
}

export interface RefNote {
  start: number;
  end: number;
  midi: number;
}

/**
 * The melody line of a score: at every moment, the top note of the latest onset
 * cluster (notes starting within `cluster` s of its first, or sharing a group),
 * held until it ends or the next cluster starts. A rolled chord counts once, at
 * its top; a repeated note is a new note; a bass note struck alone is the line
 * until the chord answers it (it is what was just played).
 */
export function melodyLine(events: RefEvent[], voices?: string[], cluster = 0.03): RefNote[] {
  const ev = events.filter((e) => !voices || (e.v !== undefined && voices.includes(e.v))).sort((a, b) => a.t - b.t);
  const out: RefNote[] = [];
  for (let i = 0; i < ev.length; ) {
    const first = ev[i];
    let top = first;
    let j = i + 1;
    for (; j < ev.length; j++) {
      const e = ev[j];
      const same = first.group !== undefined && e.group !== undefined ? e.group === first.group : e.t - first.t <= cluster;
      if (!same) break;
      if (e.m > top.m) top = e;
    }
    out.push({ start: first.t, end: top.t + top.d, midi: top.m });
    i = j;
  }
  for (let k = 0; k + 1 < out.length; k++) out[k].end = Math.min(out[k].end, out[k + 1].start);
  return out.filter((n) => n.end > n.start);
}

/** The truth pitch at each time (MIDI, NaN when no melody note sounds). `notes` sorted, not overlapping. */
export function referenceContour(notes: RefNote[], times: ArrayLike<number>): Float32Array {
  const out = new Float32Array(times.length).fill(NaN);
  let k = 0;
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    while (k < notes.length && notes[k].end <= t) k++;
    if (k < notes.length && notes[k].start <= t) out[i] = notes[k].midi;
    // Times are usually increasing; restart the scan if not.
    if (i + 1 < times.length && times[i + 1] < t) k = 0;
  }
  return out;
}

export interface ContourScore {
  /** Truth-voiced frames estimated voiced and within ±0.5 semitone. */
  rawPitch: number;
  /** Same, octave errors forgiven. */
  rawChroma: number;
  voicingRecall: number;
  voicingFalseAlarm: number;
  /** Fraction of truth frames that are voiced. */
  voicedShare: number;
}

/** MIREX melody metrics over frames of equal times. */
export function scoreContour(ref: Float32Array, est: Float32Array): ContourScore {
  let rv = 0, ru = 0, hit = 0, chroma = 0, recall = 0, fa = 0;
  for (let i = 0; i < Math.min(ref.length, est.length); i++) {
    const r = ref[i], e = est[i];
    const rOn = Number.isFinite(r), eOn = Number.isFinite(e);
    if (!rOn) {
      ru++;
      if (eOn) fa++;
      continue;
    }
    rv++;
    if (!eOn) continue;
    recall++;
    const d = Math.abs(e - r);
    if (d <= 0.5) hit++;
    const c = d % 12;
    if (Math.min(c, 12 - c) <= 0.5) chroma++;
  }
  return {
    rawPitch: rv ? hit / rv : 0,
    rawChroma: rv ? chroma / rv : 0,
    voicingRecall: rv ? recall / rv : 0,
    voicingFalseAlarm: ru ? fa / ru : 0,
    voicedShare: rv / Math.max(1, rv + ru),
  };
}

/** One-to-one onset matching within ±tol s (each truth onset takes the nearest free estimate). */
export function onsetF1(ref: number[], est: number[], tol = 0.05) {
  const r = [...ref].sort((a, b) => a - b);
  const e = [...est].sort((a, b) => a - b);
  const used = new Uint8Array(e.length);
  let hits = 0, lo = 0;
  for (const t of r) {
    while (lo < e.length && e[lo] < t - tol) lo++;
    let best = -1;
    for (let j = lo; j < e.length && e[j] <= t + tol; j++) {
      if (!used[j] && (best < 0 || Math.abs(e[j] - t) < Math.abs(e[best] - t))) best = j;
    }
    if (best >= 0) {
      used[best] = 1;
      hits++;
    }
  }
  const precision = e.length ? hits / e.length : 0;
  const recall = r.length ? hits / r.length : 0;
  return { precision, recall, f1: precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0 };
}
