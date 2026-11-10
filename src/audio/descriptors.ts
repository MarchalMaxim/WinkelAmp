/**
 * Medium-timescale musical descriptors (see Descriptors in types.ts):
 * what the music is *like* over the last few seconds, not what it does this frame.
 *
 * Pure code, no Web Audio: the engine feeds it live and `analyzeOffline` feeds
 * it from a decoded file, through the same AnalysisChain, so both agree.
 *
 * Input per hop (60 Hz): the frame Features, the smoothed linear magnitude
 * spectrum (AnalyserNode scale: a full-scale sine peaks at ≈ 0.21) and, when
 * available, the raw PCM of the hop (exact level and a 2 ms envelope for
 * attacks). Every running average is an exponential moving average whose
 * time constant is in seconds and whose step is weighted by "how much there is
 * to measure" (loudness, tonal content), so silence freezes the picture instead
 * of dragging every descriptor to zero.
 */
import { neutralDescriptors, type Descriptors } from './types';
import type { Features } from './features';

// ---------- small helpers ----------

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/** One EMA step with time constant `tau` (s) over `dt` (s), step weighted by `w` (0..1). */
const ema = (prev: number, next: number, dt: number, tau: number, w = 1) =>
  prev + (next - prev) * (1 - Math.exp((-dt * w) / tau));
const toDb = (power: number) => 10 * Math.log10(power + 1e-20);
const midiOf = (hz: number) => 69 + 12 * Math.log2(hz / 440);
const midiHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** √ of the A-weighting amplitude response (≈ 1 at 1 kHz): half of its dB. */
export function aWeightSqrt(f: number) {
  const f2 = f * f;
  const ra = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  return Math.sqrt(ra * 1.2589);
}

/** Σ|m|² → RMS of the signal, for our Hann-windowed AnalyserNode-scale magnitudes (Parseval; see tests). */
export const MAG_POWER_TO_RMS = 2.7493;

/** Krumhansl–Kessler probe-tone profiles (C major / C minor). */
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** Pearson correlation of a 12-vector with a profile rotated to `tonic`. */
function keyCorrelation(chroma: ArrayLike<number>, profile: number[], tonic: number) {
  let mc = 0, mp = 0;
  for (let i = 0; i < 12; i++) {
    mc += chroma[i];
    mp += profile[i];
  }
  mc /= 12;
  mp /= 12;
  let num = 0, dc = 0, dp = 0;
  for (let i = 0; i < 12; i++) {
    const c = chroma[i] - mc;
    const p = profile[(i - tonic + 12) % 12] - mp;
    num += c * p;
    dc += c * c;
    dp += p * p;
  }
  return dc > 0 ? num / Math.sqrt(dc * dp) : 0;
}

/** Best major and minor key correlations of a chroma vector. */
export function keyEstimate(chroma: ArrayLike<number>) {
  let major = -1, minor = -1, majorKey = 0, minorKey = 0;
  for (let t = 0; t < 12; t++) {
    const a = keyCorrelation(chroma, KK_MAJOR, t);
    const b = keyCorrelation(chroma, KK_MINOR, t);
    if (a > major) [major, majorKey] = [a, t];
    if (b > minor) [minor, minorKey] = [b, t];
  }
  return { major, minor, majorKey, minorKey };
}

/**
 * Sensory dissonance of one pair of partials (Sethares' fit of Plomp–Levelt):
 * zero for unison, peaks at ~¼ critical band, fades for wide intervals.
 */
export function pairDissonance(f1: number, a1: number, f2: number, a2: number) {
  const lo = Math.min(f1, f2);
  const s = 0.24 / (0.0207 * lo + 18.96);
  const d = Math.abs(f2 - f1);
  return Math.min(a1, a2) * (Math.exp(-3.51 * s * d) - Math.exp(-5.75 * s * d));
}

/** Peak of the Plomp–Levelt curve for unit amplitudes, used to normalise. */
const PL_MAX = 0.1825;

/** Fixed-capacity ring of numbers. */
class Ring {
  private buf: Float64Array;
  private n = 0;
  private w = 0;
  constructor(cap: number) {
    this.buf = new Float64Array(cap);
  }
  push(v: number) {
    this.buf[this.w] = v;
    this.w = (this.w + 1) % this.buf.length;
    if (this.n < this.buf.length) this.n++;
  }
  get length() {
    return this.n;
  }
  /** i = 0 is the oldest. */
  at(i: number) {
    return this.buf[(this.w - this.n + i + this.buf.length * 2) % this.buf.length];
  }
  /** Latest − back (back = 0 is the newest). */
  back(k: number) {
    return this.at(this.n - 1 - k);
  }
  clear() {
    this.n = 0;
  }
}

const quantile = (vals: number[], q: number) => {
  if (!vals.length) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const x = q * (s.length - 1);
  const i = Math.floor(x);
  return s[i] + (s[Math.min(i + 1, s.length - 1)] - s[i]) * (x - i);
};

// ---------- tuning ----------

/** Typical long-term loudness of a recording (LUFS-ish, K-weighted). Masters louder or softer are pulled halfway here. */
export const REF_LOUDNESS = -20;
/** Loudness map: dB (after the long-term correction) → 0..1. The energy lane's curve (widgets/curves.ts energyCurve) uses it
    too, after the same correction. */
export const LOUD_LO = -50;
export const LOUD_HI = -12;
/** Rate of the analysis grid for the onset envelope (Hz). */
const GRID = 60;
const MAX_PEAKS = 32;
/** Pitch motion map: semitones / s between 0.25 s block means (the floor is peak-picking jitter). */
const MOTION_FLOOR = 5;
const MOTION_RANGE = 20;
/** Onset threshold: ODF must exceed max(ratio × median, median + delta). */
const ONSET_RATIO = 1.6;
const ONSET_DELTA = 0.006;

interface Peak {
  freq: number;
  mag: number;
}

interface Note {
  midi: number;
  /** Σ magnitude of its partials (for chroma). */
  weight: number;
  /** Σ magnitude × √A-weight of each partial at its own frequency (for register). */
  loud: number;
}

interface PendingOnset {
  time: number;
  strength: number;
}

/** Per-hop internals the character engine or a debug HUD may like to see. */
export interface DescriptorDebug {
  /** RMS level of the hop, dBFS (sine at full scale = −3 dB). */
  dbfs: number;
  /** Momentary K-weighted loudness, dB. */
  lufs: number;
  /** Long-term (≈ 40 s) gated loudness reference, dB. */
  reference: number;
  /** True on the hop the descriptor onset detector fired (≈ 1 hop late). */
  onset: boolean;
  /** Onset detection function value (log spectral flux). */
  odf: number;
  /** Tempo in BPM from the onset autocorrelation, 0 if none. */
  bpm: number;
  /** Weighted mean MIDI pitch of this hop's notes (NaN when nothing tonal). */
  pitch: number;
  /** Best key as pitch class 0..11, and whether it is minor. */
  key: number;
  minor: boolean;
  /** Share of spectral energy in tonal peaks, 0..1. */
  tonal: number;
  /** Running values before they are mapped to 0..1 (for calibration). */
  raw: {
    flatness: number; roughness: number; pulse: number; chromaChange: number; motion: number;
    spread: number; register: number; gridDev: number; ioiSpread: number; sustain: number; noteSustain: number; top: number;
  };
}

export class DescriptorExtractor {
  readonly descriptors: Descriptors = neutralDescriptors();
  readonly debug: DescriptorDebug = {
    dbfs: -120, lufs: -120, reference: REF_LOUDNESS, onset: false, odf: 0, bpm: 0, pitch: NaN, key: 0, minor: false, tonal: 0,
    raw: { flatness: 0, roughness: 0, pulse: 0, chromaChange: 0, motion: 0, spread: 0, register: 60, gridDev: 0, ioiSpread: 0, sustain: 0, noteSustain: 0, top: 60 },
  };

  private lastTime = NaN;
  private elapsed = 0;
  // Spectral weights, rebuilt when the sample rate or FFT size changes.
  private kWeight: Float32Array | null = null;
  private wKey = '';
  private prevLog: Float32Array | null = null;
  private curLog: Float32Array | null = null;
  private prefix: Float64Array | null = null;

  // Loudness.
  private momentary = 0; // K-weighted power, τ ≈ 0.4 s
  private shortTerm = 0; // τ ≈ 1.5 s
  private fastPower = 0; // unweighted, τ ≈ 0.12 s (silence)
  private refPower = 10 ** (REF_LOUDNESS / 10);
  private gatedTime = 0;
  private loudHist = new Ring(4 * 10); // momentary dB at 10 Hz over 4 s
  private loudClock = 0;

  // Envelope (2 ms blocks) for attack / sustain.
  private env = new Ring(2048);
  private envDt = 0.002;
  private envFast = 0;
  private envHf = 0;
  private lastSample = 0;
  private bandHist: Float32Array[] = Array.from({ length: 40 }, () => new Float32Array(21));
  private hopCount = 0;
  private decayFrom = -1;
  private decayNum = 0;
  private decayDen = 0;
  private envPeak = 1e-9;
  private sustainRatio = 0;

  // Onsets.
  private odf = new Ring(GRID * 6);
  private odfTimes = new Ring(GRID * 6);
  private odfPrev = [0, 0];
  private odfLevel = 1e-3;
  private lastOnset = -10;
  private onsets: number[] = [];
  private scratch = new Float64Array(0);
  private pending: PendingOnset[] = [];
  private onsetRateRaw = 0;
  private attackNum = 0;
  private attackDen = 0;
  private analysisClock = 0;
  private bpm = 0;
  private noPulseFor = 0;
  private pulseTarget = 0;
  private irregTarget = 0;

  // Pitch.
  private regMean = 60;
  private regVar = 0;
  private regReady = false;
  private blockW = 0;
  private blockP = 0;
  private blockClock = 0;
  private lastBlock = NaN;
  private motion = 0;
  private topVoice = 60;

  // Harmony.
  private chromaLong = new Float64Array(12);
  private chromaShort = new Float64Array(12);
  private chromaHist: Float64Array[] = [];
  private chromaClock = 0;
  private change = 0;
  private majTarget = 0;
  private keyTarget = 0;
  private tonalLong = 0;

  // Timbre.
  private bright = 0.5;
  private flat = 0;
  private rough = 0;

  update(
    features: Features,
    magnitudes: Float32Array,
    sampleRate: number,
    fftSize: number,
    time: number,
    /** Raw mono PCM of this hop (since the previous update), if available. */
    hop?: Float32Array,
  ): Descriptors {
    const d = this.descriptors;
    const dt = Number.isFinite(this.lastTime) ? clamp(time - this.lastTime, 0, 0.25) : 1 / 60;
    this.lastTime = time;
    this.elapsed += dt;
    const bins = magnitudes.length;
    const hz = sampleRate / fftSize;
    this.prepareWeights(bins, hz, sampleRate, fftSize);

    // ---- level & loudness ----
    let power = 0;
    let kPower = 0;
    const kw = this.kWeight!;
    for (let i = 1; i < bins; i++) {
      const p = magnitudes[i] * magnitudes[i];
      power += p;
      kPower += p * kw[i];
    }
    let rms = MAG_POWER_TO_RMS * Math.sqrt(power);
    if (hop && hop.length) {
      let s = 0;
      for (let i = 0; i < hop.length; i++) s += hop[i] * hop[i];
      rms = Math.sqrt(s / hop.length);
    }
    const tilt = power > 0 ? kPower / power : 1;
    const kRms2 = rms * rms * tilt;
    const dbfs = toDb(rms * rms);
    this.momentary = ema(this.momentary, kRms2, dt, 0.4);
    this.shortTerm = ema(this.shortTerm, kRms2, dt, 1.5);
    // K-weighted: DC, rumble and sub-bass a listener can't hear don't count as "sound".
    this.fastPower = ema(this.fastPower, kRms2, dt, 0.12);
    const lufs = toDb(this.momentary);
    // Long-term reference: gated mean power (silence and passages > 15 dB below
    // it don't count), a running mean over the first ~40 s seeded with a typical
    // level, then a 40 s moving average.
    const refDb = toDb(this.refPower);
    if (lufs > -55 && lufs > refDb - 15) {
      this.gatedTime += dt;
      const tau = Math.min(40, 8 + this.gatedTime);
      this.refPower = ema(this.refPower, this.momentary, dt, tau);
    }
    // Half of the master's offset from typical is treated as "mastering", half as character.
    const correction = clamp((REF_LOUDNESS - toDb(this.refPower)) * 0.5, -6, 6);
    const loudTarget = clamp01((toDb(this.shortTerm) + correction - LOUD_LO) / (LOUD_HI - LOUD_LO));
    d.loudness = ema(d.loudness, loudTarget, dt, loudTarget > d.loudness ? 0.3 : 0.8);
    // Frame weight: how much sound there is to measure (0 below −60 dB, 1 above −45).
    const wE = clamp01((toDb(kRms2) + 60) / 15);
    const silenceTarget = clamp01((-50 - toDb(this.fastPower)) / 12);
    d.silence = ema(d.silence, silenceTarget, dt, silenceTarget < d.silence ? 0.08 : 0.8);

    // Dynamics: spread of momentary loudness over 4 s (P90 − P10, dB).
    this.loudClock += dt;
    if (this.loudClock >= 0.1) {
      this.loudClock %= 0.1;
      if (lufs > -57) this.loudHist.push(lufs);
    }
    if (this.loudHist.length >= 8) {
      const vals: number[] = [];
      for (let i = 0; i < this.loudHist.length; i++) vals.push(this.loudHist.at(i));
      const spread = quantile(vals, 0.9) - quantile(vals, 0.1);
      d.dynamics = ema(d.dynamics, clamp01(spread / 15), dt, 1.2, clamp01((lufs + 60) / 15));
    }

    // ---- envelope (2 ms blocks of the hop PCM) ----
    this.updateEnvelope(hop, rms, dt, sampleRate);

    // ---- spectral peaks → notes ----
    const peaks = this.findPeaks(magnitudes, hz);
    let peakPower = 0;
    for (const p of peaks) peakPower += 1.5 * p.mag * p.mag; // Hann main lobe ≈ 1.5 × peak²
    const tonal = power > 0 ? clamp01(peakPower / power) : 0;
    const notes = groupHarmonics(peaks);
    const wT = wE * clamp01(tonal * 1.5);
    this.tonalLong = ema(this.tonalLong, tonal, dt, 4, wE);

    // Register: weighted mean pitch and spread of the notes.
    let w0 = 0, w1 = 0, w2 = 0;
    for (const n of notes) {
      // Half the A-weighting (in dB), applied per partial (see groupHarmonics): a
      // deep note needs more energy to sound as present as a high one, but its
      // audible harmonics still count, so bass anchors the register.
      const w = n.loud;
      w0 += w;
      w1 += w * n.midi;
      w2 += w * n.midi * n.midi;
    }
    let framePitch = NaN;
    if (w0 > 0 && wT > 0.05) {
      // Top voice: the highest note with at least 30 % of the strongest note's
      // weight. The ear follows the highest voice (high-voice superiority), so
      // the register leans towards it.
      let maxW = 0, top = 0;
      for (const n of notes) maxW = Math.max(maxW, n.weight * aWeightSqrt(midiHz(n.midi)));
      for (const n of notes) if (n.weight * aWeightSqrt(midiHz(n.midi)) >= 0.3 * maxW) top = Math.max(top, n.midi);
      if (!this.regReady) this.topVoice = top;
      this.topVoice = ema(this.topVoice, top, dt, 2.5, wT);
      framePitch = w1 / w0;
      const frameVar = Math.max(0, w2 / w0 - framePitch * framePitch);
      if (!this.regReady) {
        this.regMean = framePitch;
        this.regReady = true;
      }
      this.regMean = ema(this.regMean, framePitch, dt, 2.5, wT);
      const dev = framePitch - this.regMean;
      this.regVar = ema(this.regVar, frameVar + dev * dev, dt, 3, wT);
    }
    if (this.regReady) {
      const reg = 0.6 * this.regMean + 0.4 * this.topVoice;
      d.register = ema(d.register, clamp01((reg - 24) / 84), dt, 0.5);
      d.registerSpread = ema(d.registerSpread, clamp01((Math.sqrt(this.regVar) - 4) / 16), dt, 0.5);
    }
    // Pitch motion: how far the mean pitch moves between successive 0.25 s
    // blocks (block means average out the frame-to-frame jitter of peak picking).
    if (Number.isFinite(framePitch)) {
      this.blockW += wT;
      this.blockP += wT * framePitch;
    }
    this.blockClock += dt;
    if (this.blockClock >= 0.25) {
      const enough = this.blockW > this.blockClock * 60 * 0.3;
      const mean = enough ? this.blockP / this.blockW : NaN;
      if (Number.isFinite(mean) && Number.isFinite(this.lastBlock)) {
        this.motion = ema(this.motion, Math.min(48, Math.abs(mean - this.lastBlock) / this.blockClock), this.blockClock, 2.5);
      }
      this.lastBlock = mean;
      this.blockClock = this.blockW = this.blockP = 0;
    }
    d.pitchMotion = ema(d.pitchMotion, clamp01((this.motion - MOTION_FLOOR) / MOTION_RANGE), dt, 0.5);

    // ---- timbre ----
    this.bright = ema(this.bright, logCentroid(magnitudes, hz), dt, 1.5, wE);
    d.brightness = this.bright;
    this.flat = ema(this.flat, bandFlatness(magnitudes, hz), dt, 1.5, wE);
    // Band flatness: tonal music ≈ 0.05–0.25, speech ≈ 0.3, drums / breath ≈ 0.4–0.6.
    d.noisiness = clamp01((this.flat - 0.06) / 0.55);
    this.rough = ema(this.rough, roughnessOf(peaks), dt, 2, wE);
    d.roughness = roughnessMap(this.rough);

    // ---- harmony ----
    this.updateHarmony(notes, wT, dt);

    // ---- onsets, rhythm, articulation ----
    // Rhythm descriptors weigh by the momentary (0.4 s) level, not this hop's:
    // the silence between staccato notes is part of the rhythm, not a gap in it.
    this.updateRhythm(magnitudes, hz, rms, wE, clamp01((lufs + 60) / 15), dt, time);

    const dbg = this.debug;
    dbg.dbfs = dbfs;
    dbg.lufs = lufs;
    dbg.reference = toDb(this.refPower);
    dbg.pitch = framePitch;
    dbg.tonal = tonal;
    const raw = dbg.raw;
    raw.flatness = this.flat;
    raw.roughness = this.rough;
    raw.chromaChange = this.change;
    raw.motion = this.motion;
    raw.spread = Math.sqrt(this.regVar);
    raw.register = this.regMean;
    raw.top = this.topVoice;
    raw.sustain = this.sustainRatio;
    void features;
    return d;
  }

  private prepareWeights(bins: number, hz: number, sampleRate: number, fftSize: number) {
    const key = `${sampleRate}:${fftSize}:${bins}`;
    if (key === this.wKey) return;
    this.wKey = key;
    // K-weighting power response (BS.1770): +4 dB high shelf above ~1.5 kHz and
    // a 2nd-order high-pass at ~38 Hz. Bass-heavy mixes don't read louder than they sound.
    this.kWeight = new Float32Array(bins);
    for (let i = 0; i < bins; i++) {
      const f = Math.max(1, i * hz);
      const shelf = 1 + (10 ** 0.4 - 1) * (f * f) / (f * f + 1500 * 1500);
      const hp = f ** 4 / (f ** 4 + 38 ** 4);
      this.kWeight[i] = shelf * hp;
    }
    this.prevLog = new Float32Array(bins);
    this.curLog = new Float32Array(bins);
    this.prefix = new Float64Array(bins + 1);
  }

  /** Local spectral maxima that stand out from their neighbourhood, parabolically interpolated. */
  private findPeaks(m: Float32Array, hz: number): Peak[] {
    const pre = this.prefix!;
    const bins = m.length;
    for (let i = 0; i < bins; i++) pre[i + 1] = pre[i] + m[i];
    const lo = Math.max(2, Math.ceil(40 / hz));
    const hi = Math.min(bins - 3, Math.floor(5000 / hz));
    let max = 0;
    for (let i = lo; i <= hi; i++) if (m[i] > max) max = m[i];
    if (max < 1e-6) return [];
    const floor = max * 0.01; // −40 dB below the strongest
    const out: Peak[] = [];
    const R = 12;
    for (let i = lo; i <= hi; i++) {
      const v = m[i];
      if (v < floor || v <= m[i - 1] || v < m[i + 1]) continue;
      const a = Math.max(0, i - R), b = Math.min(bins, i + R + 1);
      const localMean = (pre[b] - pre[a]) / (b - a);
      if (v < 2.5 * localMean) continue;
      const la = Math.log(m[i - 1] + 1e-12), lb = Math.log(v + 1e-12), lc = Math.log(m[i + 1] + 1e-12);
      const den = la - 2 * lb + lc;
      const shift = den < 0 ? clamp((0.5 * (la - lc)) / den, -0.5, 0.5) : 0;
      out.push({ freq: (i + shift) * hz, mag: Math.exp(lb - 0.25 * (la - lc) * shift) });
    }
    if (out.length > MAX_PEAKS) {
      out.sort((p, q) => q.mag - p.mag);
      out.length = MAX_PEAKS;
    }
    return out;
  }

  /**
   * Splits the hop PCM into 2 ms blocks. Two envelopes: a pre-emphasised one
   * (first difference, +6 dB/octave) for attacks, so a sustained bass or a
   * reverb tail doesn't mask the click of a celesta or a pizzicato; and the plain
   * one with a peak follower for the sustain fill ratio.
   */
  private updateEnvelope(hop: Float32Array | undefined, rms: number, dt: number, sampleRate: number) {
    const block = Math.max(16, Math.round(sampleRate * 0.002));
    this.envDt = block / sampleRate;
    const push = (amp: number, hf: number, bdt: number) => {
      // 5 ms smoothing so single cycles of bass don't read as envelope.
      this.envFast = ema(this.envFast, amp, bdt, 0.005);
      this.envHf = ema(this.envHf, hf, bdt, 0.005);
      this.env.push(this.envHf);
      // Peak follower: jumps to new peaks, then forgets them over ~1.5 s.
      this.envPeak = Math.max(this.envFast, this.envPeak * Math.exp(-bdt / 1.5), 1e-9);
    };
    if (hop && hop.length >= block) {
      const nb = Math.floor(hop.length / block);
      let last = this.lastSample;
      for (let b = 0; b < nb; b++) {
        let s = 0, h = 0;
        for (let i = b * block; i < (b + 1) * block; i++) {
          const x = hop[i];
          const y = x - 0.95 * last;
          last = x;
          s += x * x;
          h += y * y;
        }
        push(Math.sqrt(s / block), Math.sqrt(h / block), dt / nb);
      }
      this.lastSample = hop[hop.length - 1];
    } else {
      push(rms, rms, dt);
    }
  }

  /** Power in ~⅓-octave bands (60 Hz – 8 kHz) for the note-decay measurement. */
  private bandPowers(m: Float32Array, hz: number): Float32Array {
    const nb = 21;
    const out = new Float32Array(nb);
    for (let b = 0; b < nb; b++) {
      const lo = Math.max(1, Math.round((60 * 2 ** (b / 3)) / hz));
      const hi = Math.min(m.length, Math.max(lo + 1, Math.round((60 * 2 ** ((b + 1) / 3)) / hz)));
      let e = 0;
      for (let i = lo; i < hi; i++) e += m[i] * m[i];
      out[b] = e;
    }
    return out;
  }

  /**
   * Note decay after an onset: in the bands the onset lit up, how much of the
   * added energy is still there up to 0.3 s later (or just before the next
   * onset) → decay rate in dB/s. Bowed / blown / organ ≈ 0–5 dB/s, piano
   * ≈ 10–20, celesta / pizzicato / drums 30+. Mapped so 0 dB/s → 1, 40 → 0.
   */
  private noteDecay(onsetHop: number, endHop: number): number | null {
    const H = this.bandHist;
    const span = endHop - onsetHop;
    const at = (h: number) => H[((h % H.length) + H.length) % H.length];
    if (span < 6 || this.hopCount - (onsetHop - 4) >= H.length) return null;
    const pre = at(onsetHop - 4);
    const later = at(endHop);
    let added = 0, kept = 0;
    for (let b = 0; b < pre.length; b++) {
      let peak = 0;
      for (let h = onsetHop - 1; h <= onsetHop + 3; h++) peak = Math.max(peak, at(h)[b]);
      const delta = peak - pre[b];
      if (delta <= pre[b]) continue; // band rose < 3 dB: not this note's
      added += delta;
      kept += delta * clamp((later[b] - pre[b]) / delta, 0.001, 1);
    }
    if (added <= 0) return null;
    const rate = (-10 * Math.log10(kept / added)) / (span / GRID);
    return clamp01(1 - rate / 40);
  }

  private updateHarmony(notes: Note[], wT: number, dt: number) {
    const d = this.descriptors;
    const frame = new Float64Array(12);
    let sum = 0;
    for (const n of notes) {
      const pc = ((Math.round(n.midi) % 12) + 12) % 12;
      frame[pc] += n.weight;
      sum += n.weight;
    }
    if (sum > 0 && wT > 0.05) {
      for (let i = 0; i < 12; i++) {
        frame[i] /= sum;
        this.chromaLong[i] = ema(this.chromaLong[i], frame[i], dt, 4, wT);
        this.chromaShort[i] = ema(this.chromaShort[i], frame[i], dt, 0.25, wT);
      }
    }
    // Every 0.1 s: harmonic change = chroma distance to 0.5 s ago; key from the long chroma.
    this.chromaClock += dt;
    if (this.chromaClock < 0.1) return;
    this.chromaClock %= 0.1;
    const snap = Float64Array.from(this.chromaShort);
    this.chromaHist.push(snap);
    if (this.chromaHist.length > 6) this.chromaHist.shift();
    if (this.chromaHist.length === 6 && wT > 0.05) {
      const old = this.chromaHist[0];
      let dot = 0, na = 0, nb = 0;
      for (let i = 0; i < 12; i++) {
        dot += snap[i] * old[i];
        na += snap[i] * snap[i];
        nb += old[i] * old[i];
      }
      const dist = na > 0 && nb > 0 ? 1 - dot / Math.sqrt(na * nb) : 0;
      this.change = ema(this.change, dist, 0.1, 2.5, wT);
    }
    d.harmonicChange = clamp01((this.change - 0.1) / 0.3);
    let total = 0;
    for (let i = 0; i < 12; i++) total += this.chromaLong[i];
    if (total > 0) {
      const k = keyEstimate(this.chromaLong);
      // Relative major/minor share their notes, so the difference is small: ±0.1 is already clear.
      this.majTarget = Math.tanh((k.major - k.minor) / 0.08);
      this.keyTarget = clamp01((Math.max(k.major, k.minor) - 0.35) / 0.5);
      this.debug.key = k.major >= k.minor ? k.majorKey : k.minorKey;
      this.debug.minor = k.minor > k.major;
    }
    // A key needs pitched material: drums and noise can correlate with a profile by chance.
    const pitched = clamp01((this.tonalLong - 0.3) / 0.4);
    d.keyClarity = ema(d.keyClarity, this.keyTarget * pitched, 0.1, 1.5);
    d.majorness = ema(d.majorness, this.majTarget * Math.min(1, d.keyClarity * 2), 0.1, 1.5);
  }

  private updateRhythm(m: Float32Array, hz: number, rms: number, wE: number, wM: number, dt: number, time: number) {
    const d = this.descriptors;
    const dbg = this.debug;
    // Onset detection function: log-compressed spectral flux, 30 Hz – 10 kHz,
    // against a ±1-bin maximum filter of the previous spectrum (SuperFlux, Böck
    // & Widmer 2013): vibrato wobbling a partial into its neighbour bin is not a
    // new note, so bowed and sung music keeps a low baseline and its real note
    // changes stand out. The compression reference follows the long-term level,
    // so the ODF doesn't depend on how loud the recording is.
    const prev = this.prevLog!;
    const cur = this.curLog!;
    if (wE > 0.05) this.odfLevel = ema(this.odfLevel, rms, dt, 5);
    const ref = Math.max(1e-7, (this.odfLevel / MAG_POWER_TO_RMS / Math.sqrt(m.length)) * 0.1);
    const lo = Math.max(1, Math.floor(30 / hz));
    const hi = Math.min(m.length, Math.ceil(10000 / hz));
    let flux = 0;
    for (let i = lo; i < hi; i++) {
      const lg = (cur[i] = Math.log1p(m[i] / ref));
      const df = lg - Math.max(prev[i - 1], prev[i], prev[i + 1] ?? 0);
      if (df > 0) flux += df;
    }
    this.prevLog = cur;
    this.curLog = prev;
    flux = (flux / (hi - lo)) * (1 / 60 / Math.max(dt, 1 / 240));
    dbg.odf = flux;
    this.odf.push(flux);
    this.odfTimes.push(time);

    // Peak picking, one hop late: the previous value must be a local maximum
    // clearly above the median of the last 1.5 s. A median (not mean + σ)
    // threshold, so one big accent doesn't hide the softer notes after it.
    dbg.onset = false;
    const [p1, p2] = this.odfPrev; // p1 = previous hop, p2 = the one before
    this.odfPrev = [flux, p1];
    const n = this.odf.length;
    if (n > 20) {
      const win = Math.min(n - 1, Math.round(GRID * 1.5));
      const vals = this.scratch.length === win ? this.scratch : (this.scratch = new Float64Array(win));
      for (let i = 0; i < win; i++) vals[i] = this.odf.back(i + 1);
      vals.sort();
      const med = vals[win >> 1];
      const thr = Math.max(ONSET_RATIO * med, med + ONSET_DELTA);
      const tPrev = this.odfTimes.back(1);
      if (p1 > p2 && p1 >= flux && p1 > thr && tPrev - this.lastOnset > 0.06 && toDb(this.momentary) > -55) {
        dbg.onset = true;
        this.lastOnset = tPrev;
        // Sub-hop timing by parabolic interpolation: IOIs need better than 17 ms.
        const den = p2 - 2 * p1 + flux;
        const shift = den < 0 ? clamp((0.5 * (p2 - flux)) / den, -0.5, 0.5) : 0;
        this.onsets.push(tPrev + shift * (time - tPrev));
        this.pending.push({ time: tPrev, strength: clamp01((p1 - thr) / (p1 + 1e-9) * 2) });
        this.onsetRateRaw += 1 / 3; // EMA of an impulse train: τ = 3 s → events / s
      }
    }
    // Note decay of the previous onset, judged 0.3 s later or just before this onset.
    this.bandHist[this.hopCount % this.bandHist.length] = this.bandPowers(m, hz);
    if (this.decayFrom >= 0 && (dbg.onset || this.hopCount - this.decayFrom >= 18)) {
      const end = dbg.onset ? this.hopCount - 4 : this.hopCount;
      const v = this.noteDecay(this.decayFrom, end);
      if (v !== null) {
        this.decayNum += v;
        this.decayDen += 1;
      }
      this.decayFrom = -1;
    }
    if (dbg.onset) this.decayFrom = this.hopCount - 1;
    this.hopCount++;
    this.onsetRateRaw *= Math.exp(-dt / 3);
    while (this.onsets.length && time - this.onsets[0] > 8) this.onsets.shift();
    d.onsetRate = ema(d.onsetRate, Math.min(1, this.onsetRateRaw / 10), dt, 0.4);

    // Attack: judge each onset 120 ms after detection, from the 2 ms envelope.
    while (this.pending.length && time - this.pending[0].time >= 0.12) {
      const p = this.pending.shift()!;
      const a = this.attackOf(time, p.time);
      if (a) {
        const w = 0.3 + 0.7 * p.strength;
        this.attackNum += w * a;
        this.attackDen += w;
      }
    }
    const decay = Math.exp(-dt / 3);
    this.attackNum *= decay;
    this.attackDen *= decay;
    // A small prior towards "soft" so a lone click doesn't read as percussive music.
    d.attack = ema(d.attack, this.attackNum / (this.attackDen + 0.4), dt, 0.5);

    // Sustain, two views averaged: how full the envelope stays relative to its
    // recent peak (fill ratio; catches drones and pads that have no onsets), and
    // how slowly the notes themselves decay (noteDecay; immune to a sustained
    // bass under staccato treble).
    const ratio = this.envFast / this.envPeak;
    this.sustainRatio = ema(this.sustainRatio, ratio, dt, 2.5, wM);
    const fill = clamp01((this.sustainRatio - 0.2) / 0.65);
    this.decayNum *= decay;
    this.decayDen *= decay;
    const notes = this.decayDen > 0 ? this.decayNum / this.decayDen : fill;
    const wNotes = 0.5 * clamp01(this.decayDen / 2); // trust note decays once there are a few
    d.sustain = ema(d.sustain, (1 - wNotes) * fill + wNotes * notes, dt, 0.5);
    this.debug.raw.noteSustain = notes;

    // Every 0.25 s: tempo and pulse clarity from the ODF autocorrelation, irregularity from onsets.
    this.analysisClock += dt;
    if (this.analysisClock >= 0.25) {
      this.analysisClock %= 0.25;
      this.analysePulse();
      this.analyseIrregularity();
    }
    d.pulseClarity = ema(d.pulseClarity, this.pulseTarget, dt, 1.5, Math.max(wM, 0.2));
    d.irregularity = ema(d.irregularity, this.irregTarget, dt, 1.5, wM);
    if (d.pulseClarity < 0.1) this.noPulseFor += dt;
    else this.noPulseFor = 0;
    const tempoTarget = this.noPulseFor > 4 ? 0 : Math.min(1, this.bpm / 200);
    d.tempo = tempoTarget === 0 || d.tempo === 0 ? ema(d.tempo, tempoTarget, dt, 0.3) : ema(d.tempo, tempoTarget, dt, 1);
    dbg.bpm = this.bpm;
  }

  /**
   * Attack sharpness of the onset detected at `t`: log attack time (10 % → 90 %
   * of the rise) and the size of the rise, from the 2 ms envelope.
   */
  private attackOf(now: number, t: number): number | null {
    const env = this.env;
    const n = env.length;
    const per = this.envDt;
    // Search window: from 150 ms before detection to now (≥ 120 ms after).
    const back = Math.min(n - 1, Math.round((now - t + 0.15) / per));
    const fwd = Math.max(0, Math.round((now - t) / per));
    if (back < 10) return null;
    // Peak: max between 90 ms before detection and 100 ms after it.
    let iPeak = -1, peak = 0;
    const from = n - 1 - back;
    for (let i = Math.max(from, n - 1 - fwd - Math.round(0.09 / per)); i <= Math.min(n - 1, n - 1 - fwd + Math.round(0.1 / per)); i++) {
      const v = env.at(i);
      if (v > peak) [peak, iPeak] = [v, i];
    }
    if (iPeak < 0 || peak <= 0) return null;
    let base = peak;
    let iBase = iPeak;
    for (let i = iPeak; i >= from; i--) {
      const v = env.at(i);
      if (v < base) [base, iBase] = [v, i];
    }
    const rise = peak - base;
    if (rise <= 0) return null;
    // 10 % and 90 % points of the rise, searched backwards from the peak.
    let i90 = iPeak, i10 = iBase;
    for (let i = iPeak; i >= iBase; i--) if (env.at(i) >= base + 0.9 * rise) i90 = i;
    for (let i = i90; i >= iBase; i--) {
      if (env.at(i) <= base + 0.1 * rise) {
        i10 = i;
        break;
      }
    }
    const attackTime = Math.max(per, (i90 - i10) * per);
    // 5 ms → 1 (percussive), 200 ms → 0 (bowed swell), log scale.
    const sharp = clamp01(1 - Math.log(attackTime / 0.005) / Math.log(0.2 / 0.005));
    const riseDb = 20 * Math.log10(peak / Math.max(base, peak * 1e-3));
    const strength = clamp01(riseDb / 20);
    return 0.6 * sharp + 0.4 * strength;
  }

  private analysePulse() {
    const n = this.odf.length;
    if (n < GRID * 3) {
      this.pulseTarget = 0;
      return;
    }
    const x = new Float64Array(n);
    let mean = 0;
    for (let i = 0; i < n; i++) mean += (x[i] = this.odf.at(i));
    mean /= n;
    let e = 0;
    for (let i = 0; i < n; i++) {
      x[i] -= mean;
      e += x[i] * x[i];
    }
    if (e <= 1e-12) {
      this.pulseTarget = 0;
      return;
    }
    // Normalised, unbiased autocorrelation over 40–240 BPM.
    const minLag = Math.round((GRID * 60) / 240);
    const maxLag = Math.min(n >> 1, Math.round((GRID * 60) / 40));
    const r = new Float64Array(maxLag * 2 + 2);
    for (let lag = minLag; lag <= Math.min(2 * maxLag, n - 1); lag++) {
      let s = 0;
      for (let i = 0; i + lag < n; i++) s += x[i] * x[i + lag];
      r[lag] = (s / e) * (n / (n - lag));
    }
    // Pulse clarity: the strongest periodicity. Tempo: periodicity reinforced at
    // twice the lag (the bar-level echo), weighted by a log-Gaussian preference
    // around 120 BPM (people tap near there), as in Ellis (2007).
    let best = 0, bestLag = 0, clarity = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      const isPeak = r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1];
      if (!isPeak) continue;
      clarity = Math.max(clarity, r[lag]);
      const bpm = (GRID * 60) / lag;
      const prior = Math.exp(-0.5 * (Math.log2(bpm / 120) / 1) ** 2);
      const score = (r[lag] + 0.5 * Math.max(0, r[2 * lag] ?? 0)) * prior;
      if (score > best) [best, bestLag] = [score, lag];
    }
    this.debug.raw.pulse = clarity;
    // Raw clarity: metronomic ≈ 0.9, steady pop/dance 0.5–0.8, rubato or speech ≈ 0.2.
    this.pulseTarget = clamp01((clarity - 0.2) / 0.5);
    if (bestLag > 0 && clarity > 0.25) {
      const a = r[bestLag - 1], b = r[bestLag], c = r[bestLag + 1];
      const den = a - 2 * b + c;
      const shift = den < 0 ? clamp((0.5 * (a - c)) / den, -0.5, 0.5) : 0;
      this.bpm = (GRID * 60) / (bestLag + shift);
    }
  }

  /**
   * Irregularity of timing, from the inter-onset intervals (IOIs) of the last 8 s:
   *  - grid deviation: how far each IOI is from a whole number of grid steps,
   *    the grid being a 16th or a triplet 8th of the beat (or of the median IOI
   *    when there is no beat). In-time syncopation stays low; rubato and erratic
   *    timing rise. Random IOIs average ≈ 0.15 grid steps, metronomic ≈ 0.
   *  - log-IOI spread (MAD, robust to the odd missed or extra onset): busy vs.
   *    even rhythms.
   *  - lack of pulse.
   */
  private analyseIrregularity() {
    const t = this.onsets;
    if (t.length < 5) return;
    const ioi: number[] = [];
    for (let i = 1; i < t.length; i++) ioi.push(t[i] - t[i - 1]);
    const logs = ioi.map((v) => Math.log2(v));
    const med = quantile(logs, 0.5);
    const mad = quantile(logs.map((v) => Math.abs(v - med)), 0.5) * 1.4826;
    const pulse = this.descriptors.pulseClarity;
    const beat = this.bpm > 0 && pulse > 0.15 ? 60 / this.bpm : 2 * 2 ** med;
    // Candidate grids: the beat subdivided down to ≤ 130 ms steps (16ths of slow
    // music, 32nds of a half-time drum'n'bass estimate), binary and ternary; and
    // the tatum — the typical shortest IOI — in case the beat estimate is off.
    let bin = beat, ter = beat / 3;
    while (bin > 0.13) bin /= 2;
    while (ter > 0.13) ter /= 2;
    const sorted = [...ioi].sort((a, b) => a - b);
    const tatum = quantile(sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 3))), 0.5);
    const steps = [bin, ter, Math.max(0.06, tatum)];
    // Deviation in grid steps, after forgiving ±8 ms of detection jitter, so a
    // fine grid isn't punished for timing noise a coarse one would hide.
    const devs = ioi.map((v) => {
      let best = 0.5;
      for (const g of steps) {
        const u = v / g;
        best = Math.min(best, u < 0.6 ? 0.25 : Math.max(0, Math.abs(u - Math.round(u)) * g - 0.008) / g);
      }
      return best;
    });
    devs.sort((a, b) => a - b);
    // Trimmed mean: drop the worst 10 % (a missed onset, a fermata).
    const keep = devs.slice(0, Math.max(1, Math.ceil(devs.length * 0.9)));
    const gridDev = keep.reduce((s, v) => s + v, 0) / keep.length;
    this.debug.raw.gridDev = gridDev;
    this.debug.raw.ioiSpread = mad;
    // Erratic needs events: a few sparse sounds (a whale, a bell) are not "irregular".
    const density = clamp01(this.onsetRateRaw / 1.5);
    this.irregTarget = density * clamp01(0.6 * clamp01((gridDev - 0.01) / 0.06) + 0.2 * clamp01(mad / 0.7) + 0.2 * (1 - pulse));
  }
}

/**
 * Groups spectral peaks into notes: a peak at (close to) an integer multiple of a
 * lower note is that note's partial, and lends it its magnitude. So a violin A4
 * counts as one A4, not as A4 + A5 + E6 + A6 …, and the pitch reflects notes.
 *
 * `loud` weighs each partial by √A-weight at its own frequency: weighing the
 * whole note at its fundamental counted a bass note's audible 200–800 Hz
 * harmonics as if they were 60 Hz rumble. A lone peak above C6 that no lower
 * note claims is far more often a stray upper partial (beyond h = 12, stretched
 * by a stiff piano string, or of a bass fundamental the FFT can't resolve) than
 * a melody note, so it counts at 35 %. Together these took the register of
 * rendered Rachmaninoff from 8–10 semitones above its score to 3–5.
 * (A wider, stretched tolerance for stiff strings gained only ~1 more semitone
 * and moved the chroma of plain harmonic chords, so it is not used.)
 */
export function groupHarmonics(peaks: Peak[]): Note[] {
  const sorted = [...peaks].sort((a, b) => a.freq - b.freq);
  const fund: { freq: number; weight: number; mag: number; loud: number; parts: number }[] = [];
  for (const p of sorted) {
    let owner = -1;
    for (let i = 0; i < fund.length && owner < 0; i++) {
      const f0 = fund[i].freq;
      const h = Math.round(p.freq / f0);
      if (h < 2 || h > 12) continue;
      // Within ~⅓ semitone (2 %) of the harmonic, and the fundamental is not negligible.
      if (Math.abs(p.freq / (h * f0) - 1) < 0.02 && fund[i].mag > p.mag * 0.08) owner = i;
    }
    const loud = p.mag * aWeightSqrt(p.freq);
    if (owner >= 0) {
      const f = fund[owner];
      f.weight += p.mag;
      f.loud += loud;
      f.parts++;
    } else fund.push({ freq: p.freq, weight: p.mag, mag: p.mag, loud, parts: 1 });
  }
  return fund.map((f) => {
    const midi = midiOf(f.freq);
    return { midi, weight: f.weight, loud: f.parts > 1 || midi < 84 ? f.loud : 0.35 * f.loud };
  });
}

/**
 * Raw roughness → 0..1: linear up to 0.6 (where almost all music sits), then a
 * soft knee. Dense low piano chords reach 2–3× the roughness of a string
 * orchestra (the sum over pairs grows with the number of close partials) and
 * used to pin the descriptor at 1 for whole pieces; now they keep their shape.
 */
export function roughnessMap(raw: number) {
  const x = Math.max(0, (raw - 0.01) / 0.14);
  return x <= 0.6 ? x : 0.6 + 0.4 * (1 - Math.exp(-(x - 0.6) / 0.7));
}

/** Spectral centroid on a log-frequency axis: 150 Hz → 0, 5 kHz → 1. */
export function logCentroid(m: Float32Array, hz: number) {
  let ws = 0, ms = 0;
  const lo = Math.max(1, Math.floor(50 / hz));
  const hi = Math.min(m.length, Math.ceil(12000 / hz));
  for (let i = lo; i < hi; i++) {
    ws += Math.log2(i * hz) * m[i];
    ms += m[i];
  }
  if (ms <= 0) return 0.5;
  return clamp01((ws / ms - Math.log2(150)) / Math.log2(5000 / 150));
}

/**
 * Spectral flatness (geometric / arithmetic mean of power) per octave band from
 * 125 Hz to 8 kHz, averaged over the bands that carry energy. Per-band so the
 * natural 1/f tilt of music doesn't make everything read as "tonal".
 */
export function bandFlatness(m: Float32Array, hz: number) {
  let sum = 0, count = 0, maxE = 0;
  const res: { e: number; f: number }[] = [];
  for (let lo = 125; lo < 8000; lo *= 2) {
    const a = Math.max(1, Math.round(lo / hz));
    const b = Math.min(m.length, Math.round((2 * lo) / hz));
    if (b - a < 4) continue;
    let lg = 0, ar = 0;
    for (let i = a; i < b; i++) {
      const p = m[i] * m[i] + 1e-18;
      lg += Math.log(p);
      ar += p;
    }
    const k = b - a;
    const e = ar / k;
    res.push({ e, f: Math.exp(lg / k) / e });
    maxE = Math.max(maxE, e);
  }
  for (const r of res) {
    if (r.e < maxE * 1e-4) continue; // bands 40 dB below the loudest are just floor
    sum += r.f;
    count++;
  }
  return count ? sum / count : 0;
}

/** Sethares roughness over the strongest peaks, normalised by their total amplitude. */
export function roughnessOf(peaks: Peak[]) {
  const top = peaks.length > 16 ? [...peaks].sort((a, b) => b.mag - a.mag).slice(0, 16) : peaks;
  let r = 0, amp = 0;
  for (let i = 0; i < top.length; i++) {
    amp += top[i].mag;
    for (let j = i + 1; j < top.length; j++) r += pairDissonance(top[i].freq, top[i].mag, top[j].freq, top[j].mag);
  }
  return amp > 0 ? r / (amp * PL_MAX) : 0;
}
