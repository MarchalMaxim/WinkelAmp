/**
 * The analysis chain — PCM → spectrum → Features → Descriptors — stepped in
 * fixed hops of sampleRate / 60 samples, plus `analyzeOffline`, which runs the
 * very same chain over a decoded file.
 *
 * Fixed hops (clocked by samples, not by animation frames) make live and offline
 * identical: a 144 Hz display doesn't change any flux, envelope or threshold,
 * and calibrating on a file calibrates the app.
 */
import { neutralDescriptors, type Descriptors, type PcmSource } from '../character/types';
import { DescriptorExtractor } from './descriptors';
import { FeatureExtractor, type Features } from './features';
import { SpectrumAnalyser } from './fft';
import { ArrayPcm } from './pcm';

export interface ChainOptions {
  /** Hops per second (default 60). */
  fps?: number;
  fftSize?: number;
  /** AnalyserNode-style smoothingTimeConstant per 60 Hz hop (default 0.55, as v1). */
  smoothing?: number;
}

/** A source the chain can read at an arbitrary end position. */
interface Readable extends PcmSource {
  copyEndingAt?(end: number, out: Float32Array): void;
}

export class AnalysisChain {
  readonly fps: number;
  readonly spectrum: SpectrumAnalyser;
  readonly extractor = new FeatureExtractor();
  readonly descriptorExtractor = new DescriptorExtractor();
  /** True if any hop in the last `step` call detected an onset (FeatureExtractor's). */
  onsetInStep = false;
  private frame: Float32Array;
  private wave = new Float32Array(1024);
  private hopBuf = new Float32Array(0);
  /** Absolute sample index where the last hop ended; −1 before the first hop. */
  private end = -1;
  /** Index of the last hop run; hop k ends at sample round(k · sr / fps) (an absolute grid, as offline). */
  private hopIndex = 0;
  private sr = 0;

  constructor(opts: ChainOptions = {}) {
    this.fps = opts.fps ?? 60;
    const n = opts.fftSize ?? 4096;
    this.spectrum = new SpectrumAnalyser(n, opts.smoothing ?? 0.55);
    this.frame = new Float32Array(n);
  }

  get features(): Features {
    return this.extractor.features;
  }

  get descriptors(): Descriptors {
    return this.descriptorExtractor.descriptors;
  }

  /**
   * Runs every whole hop that `src` has data for (at most `maxHops`; if it is
   * further behind — a hidden tab — it skips ahead). Returns the number of hops run.
   */
  step(src: Readable, maxHops = 6): number {
    const sr = src.sampleRate;
    const written = src.written;
    if (sr !== this.sr) {
      this.sr = sr;
      this.end = -1;
    }
    const hopLen = sr / this.fps;
    if (this.end < 0) this.resync(written, written <= hopLen * (maxHops + 1));
    else if (written - this.end > hopLen * (maxHops + 2)) this.resync(written, false);
    this.onsetInStep = false;
    let hops = 0;
    while (hops < maxHops) {
      const next = Math.round(((this.hopIndex + 1) * sr) / this.fps);
      if (next > written) break;
      this.runHop(src, next);
      this.hopIndex++;
      hops++;
    }
    return hops;
  }

  /** Jumps to the hop grid just before `at` (or to the very start, for a fresh stream). */
  private resync(at: number, fromStart: boolean) {
    this.hopIndex = fromStart ? 0 : Math.max(0, Math.floor((at * this.fps) / this.sr) - 1);
    this.end = Math.round((this.hopIndex * this.sr) / this.fps);
  }

  /** Runs one hop ending at absolute sample `end` (offline drives the chain this way). */
  runHop(src: Readable, end: number) {
    const sr = src.sampleRate;
    const hopLen = Math.round(sr / this.fps);
    const n = Math.max(1, Math.min(this.frame.length, this.end < 0 ? hopLen : end - this.end));
    this.end = end;
    if (src.copyEndingAt) {
      src.copyEndingAt(end, this.frame);
    } else {
      src.latest(this.frame); // only valid when `end` is the newest sample
    }
    // One NaN/Inf sample (a broken node upstream, a bad decode) would otherwise
    // poison every running average for good.
    const fr = this.frame;
    for (let i = 0; i < fr.length; i++) if (!Number.isFinite(fr[i])) fr[i] = 0;
    if (this.hopBuf.length !== n) this.hopBuf = new Float32Array(n);
    this.hopBuf.set(this.frame.subarray(this.frame.length - n));
    this.wave.set(this.frame.subarray(this.frame.length - this.wave.length));
    const time = end / sr;
    const mags = this.spectrum.process(this.frame, 1 / this.fps);
    const f = this.extractor.update({ magnitudes: mags, waveform: this.wave, sampleRate: sr, fftSize: this.spectrum.fftSize, time });
    if (f.onset) this.onsetInStep = true;
    this.descriptorExtractor.update(f, mags, sr, this.spectrum.fftSize, time, this.hopBuf);
  }
}

/** The scalar part of Features (no big arrays), for timelines. */
export interface FeatureSnapshot {
  level: number;
  bass: number;
  mid: number;
  treble: number;
  beat: number;
  onset: boolean;
  onsetStrength: number;
  bpm: number;
  note: number;
  noteSmooth: number;
  tonality: number;
  centroid: number;
  time: number;
}

export interface OfflineOptions extends ChainOptions {
  /** Called every ~5 % with 0..1. */
  onProgress?: (fraction: number) => void;
}

export interface OfflineResult {
  fps: number;
  sampleRate: number;
  duration: number;
  /** Hop end times, seconds. */
  times: Float32Array;
  features: FeatureSnapshot[];
  descriptors: Descriptors[];
  /** Per hop: the descriptor onset detector fired. */
  onsets: Uint8Array;
}

export function snapshotFeatures(f: Features): FeatureSnapshot {
  return {
    level: f.level, bass: f.bass, mid: f.mid, treble: f.treble, beat: f.beat, onset: f.onset,
    onsetStrength: f.onsetStrength, bpm: f.bpm, note: f.note, noteSmooth: f.noteSmooth, tonality: f.tonality,
    centroid: f.centroid, time: f.time,
  };
}

/** Runs the live analysis chain over a whole mono signal, one snapshot per hop. */
export function analyzeOffline(pcm: Float32Array, sampleRate: number, opts: OfflineOptions = {}): OfflineResult {
  const chain = new AnalysisChain(opts);
  const src = new ArrayPcm(pcm, sampleRate);
  const fps = chain.fps;
  const hops = Math.floor((pcm.length * fps) / sampleRate);
  const times = new Float32Array(hops);
  const features: FeatureSnapshot[] = [];
  const descriptors: Descriptors[] = [];
  const onsets = new Uint8Array(hops);
  const reader = {
    sampleRate,
    get written() {
      return src.written;
    },
    latest: (out: Float32Array) => src.latest(out),
    copyEndingAt: (end: number, out: Float32Array) => {
      src.written = end;
      src.latest(out);
    },
  };
  let lastReport = -1;
  for (let h = 0; h < hops; h++) {
    src.written = Math.round(((h + 1) * sampleRate) / fps);
    chain.onsetInStep = false;
    chain.runHop(reader, src.written);
    times[h] = src.written / sampleRate;
    features.push(snapshotFeatures(chain.features));
    descriptors.push({ ...neutralDescriptors(), ...chain.descriptors });
    onsets[h] = chain.descriptorExtractor.debug.onset ? 1 : 0;
    const pct = Math.floor((h / hops) * 20);
    if (opts.onProgress && pct !== lastReport) {
      lastReport = pct;
      opts.onProgress(h / hops);
    }
  }
  return { fps, sampleRate, duration: pcm.length / sampleRate, times, features, descriptors, onsets };
}
