/**
 * Turns raw spectrum + waveform data into musical features.
 *
 * Pure code (no Web Audio dependency) so it can be unit tested with
 * synthetic spectra.
 */

export const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export const SPECTRUM_BANDS = 64;

export interface Features {
  /** Overall loudness, 0..1 (auto-gained). */
  level: number;
  bass: number;
  mid: number;
  treble: number;
  /** 1 on a beat, decays towards 0. */
  beat: number;
  /** True only on the frame an onset was detected. */
  onset: boolean;
  /** Strength of the last onset, 0..1. */
  onsetStrength: number;
  /** Estimated tempo, 0 if unknown. */
  bpm: number;
  /** Dominant pitch class, 0 = C … 11 = B. */
  note: number;
  /** Smoothed, continuous version of `note` (0..12, wraps) for gliding colors. */
  noteSmooth: number;
  /** How tonal the sound is: 0 = noise/drums, 1 = clear pitch. */
  tonality: number;
  /** 12 pitch-class energies, normalized so the max is 1. */
  chroma: Float32Array;
  /** Brightness of the timbre, 0 = dark, 1 = bright. */
  centroid: number;
  /** 64 log-spaced bands, 0..1. */
  spectrum: Float32Array;
  /** Time-domain samples, -1..1. */
  waveform: Float32Array;
  /** Seconds since start, for animation. */
  time: number;
}

export function emptyFeatures(): Features {
  return {
    level: 0, bass: 0, mid: 0, treble: 0, beat: 0, onset: false, onsetStrength: 0,
    bpm: 0, note: 0, noteSmooth: 0, tonality: 0, chroma: new Float32Array(12),
    centroid: 0, spectrum: new Float32Array(SPECTRUM_BANDS), waveform: new Float32Array(1024), time: 0,
  };
}

/** Frequency (Hz) of a bin. */
const binFreq = (bin: number, sampleRate: number, fftSize: number) => (bin * sampleRate) / fftSize;

/** Pitch class (0..11, C=0) of a frequency. */
export function pitchClass(freq: number): number {
  const midi = 12 * Math.log2(freq / 440) + 69;
  return ((Math.round(midi) % 12) + 12) % 12;
}

/** Follows the recent peak of a signal so values can be normalized to 0..1. */
class PeakFollower {
  private peak: number;
  constructor(private floor: number, private release = 0.9985) {
    this.peak = floor;
  }
  normalize(v: number): number {
    this.peak = Math.max(v, this.peak * this.release, this.floor);
    return Math.min(1, v / this.peak);
  }
}

/** Asymmetric smoothing: fast attack, slower release. */
const smooth = (prev: number, next: number, attack: number, release: number) =>
  prev + (next - prev) * (next > prev ? attack : release);

/** Estimates tempo from onset times using an inter-onset-interval histogram. */
export function estimateBpm(onsetTimes: number[]): number {
  if (onsetTimes.length < 4) return 0;
  const votes = new Map<number, number>();
  for (let i = 1; i < onsetTimes.length; i++) {
    // Compare with a few previous onsets so syncopation still votes for the pulse.
    for (let j = Math.max(0, i - 4); j < i; j++) {
      let interval = onsetTimes[i] - onsetTimes[j];
      if (interval <= 0.2) continue;
      let bpm = 60 / interval;
      while (bpm < 70) bpm *= 2;
      while (bpm > 180) bpm /= 2;
      const key = Math.round(bpm);
      const weight = 1 / (i - j);
      for (let d = -2; d <= 2; d++) {
        votes.set(key + d, (votes.get(key + d) ?? 0) + weight * (d === 0 ? 1 : 0.5 / Math.abs(d)));
      }
    }
  }
  let best = 0;
  let bestVotes = 0;
  for (const [bpm, v] of votes) {
    if (v > bestVotes) {
      best = bpm;
      bestVotes = v;
    }
  }
  return best;
}

export interface AnalyzerInput {
  /** Linear magnitudes, one per bin (length fftSize / 2). */
  magnitudes: Float32Array;
  waveform: Float32Array;
  sampleRate: number;
  fftSize: number;
  /** Seconds. */
  time: number;
}

export class FeatureExtractor {
  readonly features = emptyFeatures();

  /** Multiplies sensitivity of onset detection; > 1 means more beats. */
  sensitivity = 1;

  private gainLevel = new PeakFollower(1e-4);
  private gainBass = new PeakFollower(1e-4);
  private gainMid = new PeakFollower(1e-4);
  private gainTreble = new PeakFollower(1e-4);
  private gainSpectrum = new PeakFollower(1e-4, 0.999);
  private prevLog: Float32Array | null = null;
  private fluxHistory: number[] = [];
  private lastOnset = -1;
  private onsetTimes: number[] = [];
  private chromaSmooth = new Float32Array(12);
  private lastTime = 0;
  private bandEdges: number[] = [];

  update(input: AnalyzerInput): Features {
    const { magnitudes, sampleRate, fftSize, time } = input;
    const f = this.features;
    const dt = Math.max(0.001, Math.min(0.1, time - this.lastTime || 1 / 60));
    this.lastTime = time;
    f.time = time;
    f.waveform = input.waveform;
    const bins = magnitudes.length;
    const hzPerBin = sampleRate / fftSize;

    // Band energies.
    const band = (lo: number, hi: number) => {
      const a = Math.max(1, Math.floor(lo / hzPerBin));
      const b = Math.min(bins - 1, Math.ceil(hi / hzPerBin));
      let sum = 0;
      for (let i = a; i <= b; i++) sum += magnitudes[i] * magnitudes[i];
      return Math.sqrt(sum / Math.max(1, b - a + 1));
    };
    const bass = band(20, 160);
    const mid = band(160, 2000);
    const treble = band(2000, 12000);
    const level = band(20, 12000);
    f.bass = smooth(f.bass, this.gainBass.normalize(bass), 0.6, 0.12);
    f.mid = smooth(f.mid, this.gainMid.normalize(mid), 0.5, 0.12);
    f.treble = smooth(f.treble, this.gainTreble.normalize(treble), 0.6, 0.18);
    f.level = smooth(f.level, this.gainLevel.normalize(level), 0.5, 0.08);

    // Log-spaced spectrum for drawing.
    if (this.bandEdges.length !== SPECTRUM_BANDS + 1) {
      const lo = Math.log(30);
      const hi = Math.log(14000);
      this.bandEdges = Array.from({ length: SPECTRUM_BANDS + 1 }, (_, i) =>
        Math.max(1, Math.round(Math.exp(lo + ((hi - lo) * i) / SPECTRUM_BANDS) / hzPerBin)),
      );
    }
    let specMax = 0;
    const raw = new Float32Array(SPECTRUM_BANDS);
    for (let i = 0; i < SPECTRUM_BANDS; i++) {
      const a = this.bandEdges[i];
      const b = Math.max(a, this.bandEdges[i + 1] - 1);
      let m = 0;
      for (let k = a; k <= b && k < bins; k++) m = Math.max(m, magnitudes[k]);
      // Tilt so highs are visible (music has ~1/f spectra).
      raw[i] = m * (1 + i / 16);
      specMax = Math.max(specMax, raw[i]);
    }
    const specNorm = this.gainSpectrum.normalize(specMax) / Math.max(specMax, 1e-9);
    for (let i = 0; i < SPECTRUM_BANDS; i++) {
      const v = Math.min(1, raw[i] * specNorm);
      f.spectrum[i] = smooth(f.spectrum[i], v, 0.7, 0.15);
    }

    // Spectral flux onset detection (on log magnitudes, weighted towards lows/mids).
    const maxBin = Math.min(bins, Math.ceil(8000 / hzPerBin));
    if (!this.prevLog || this.prevLog.length !== maxBin) this.prevLog = new Float32Array(maxBin);
    let flux = 0;
    for (let i = 1; i < maxBin; i++) {
      const lg = Math.log1p(magnitudes[i] * 1000);
      const d = lg - this.prevLog[i];
      if (d > 0) flux += d * (binFreq(i, sampleRate, fftSize) < 250 ? 2 : 1);
      this.prevLog[i] = lg;
    }
    flux /= maxBin;
    const hist = this.fluxHistory;
    hist.push(flux);
    if (hist.length > 43) hist.shift();
    const mean = hist.reduce((s, v) => s + v, 0) / hist.length;
    const sd = Math.sqrt(hist.reduce((s, v) => s + (v - mean) ** 2, 0) / hist.length);
    const threshold = mean + (1.6 / this.sensitivity) * sd + 0.002;
    f.onset = false;
    if (hist.length > 8 && flux > threshold && time - this.lastOnset > 0.14 && level > 1e-4) {
      f.onset = true;
      f.onsetStrength = Math.min(1, (flux - mean) / (4 * sd + 1e-6));
      f.beat = Math.max(f.beat, 0.4 + 0.6 * f.onsetStrength);
      this.lastOnset = time;
      this.onsetTimes.push(time);
      while (this.onsetTimes.length && time - this.onsetTimes[0] > 8) this.onsetTimes.shift();
      f.bpm = estimateBpm(this.onsetTimes);
    }
    f.beat *= Math.exp(-dt * 6);
    if (time - this.lastOnset > 4) f.bpm = 0;

    // Chromagram: fold 55 Hz..2.5 kHz into 12 pitch classes.
    const chroma = new Float32Array(12);
    const loBin = Math.max(2, Math.ceil(55 / hzPerBin));
    const hiBin = Math.min(bins - 2, Math.floor(2500 / hzPerBin));
    for (let i = loBin; i <= hiBin; i++) {
      // Only count local peaks: suppresses smeared noise energy.
      const m = magnitudes[i];
      if (m <= magnitudes[i - 1] || m < magnitudes[i + 1]) continue;
      // Parabolic interpolation finds the true frequency between bins —
      // essential for low notes, where a semitone is narrower than a bin.
      const a = Math.log(magnitudes[i - 1] + 1e-12);
      const b = Math.log(m + 1e-12);
      const c = Math.log(magnitudes[i + 1] + 1e-12);
      const denom = a - 2 * b + c;
      const shift = denom < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / denom)) : 0;
      chroma[pitchClass(binFreq(i + shift, sampleRate, fftSize))] += m;
    }
    let cMax = 0;
    let cSum = 0;
    for (let i = 0; i < 12; i++) {
      this.chromaSmooth[i] += (chroma[i] - this.chromaSmooth[i]) * 0.25;
      cMax = Math.max(cMax, this.chromaSmooth[i]);
      cSum += this.chromaSmooth[i];
    }
    if (cMax > 0) {
      let best = 0;
      for (let i = 0; i < 12; i++) {
        f.chroma[i] = this.chromaSmooth[i] / cMax;
        if (this.chromaSmooth[i] > this.chromaSmooth[best]) best = i;
      }
      f.note = best;
      // Tonality: how peaked the chroma is (1 = a single class, 0 = flat).
      const peakiness = (cMax / cSum - 1 / 12) / (1 - 1 / 12);
      f.tonality = smooth(f.tonality, Math.min(1, peakiness * 2.2), 0.2, 0.05);
    } else {
      f.chroma.fill(0);
      f.tonality = smooth(f.tonality, 0, 0.2, 0.05);
    }
    // Glide the continuous note along the shortest way around the circle.
    let diff = f.note - f.noteSmooth;
    if (diff > 6) diff -= 12;
    if (diff < -6) diff += 12;
    f.noteSmooth = (f.noteSmooth + diff * Math.min(1, dt * 4) + 12) % 12;

    // Spectral centroid on a log-frequency scale.
    let wSum = 0;
    let mSum = 0;
    for (let i = 1; i < maxBin; i++) {
      wSum += Math.log2(binFreq(i, sampleRate, fftSize)) * magnitudes[i];
      mSum += magnitudes[i];
    }
    if (mSum > 0) {
      const c = (wSum / mSum - Math.log2(100)) / (Math.log2(8000) - Math.log2(100));
      f.centroid = smooth(f.centroid, Math.max(0, Math.min(1, c)), 0.2, 0.1);
    }
    return f;
  }
}
