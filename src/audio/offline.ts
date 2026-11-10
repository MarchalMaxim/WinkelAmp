/**
 * The analysis chain — PCM → spectrum → Features → Descriptors — stepped in
 * fixed hops of sampleRate / 60 samples, plus `analyzeOffline`, which runs the
 * very same chain over a decoded file.
 *
 * Fixed hops are clocked by samples, so the result depends only on the audio.
 */
import { neutralDescriptors, type Descriptors, type PcmSource } from './types';
import { DescriptorExtractor } from './descriptors';
import { FeatureExtractor, type Features } from './features';
import { MelodyTracker, SALIENCE_BINS, type MelodyFrame } from './melody';
import { SpectrumAnalyser } from './fft';
import { ArrayPcm } from './pcm';

export interface ChainOptions {
  /** Hops per second (default 60). */
  fps?: number;
  fftSize?: number;
  /** AnalyserNode-style smoothingTimeConstant per 60 Hz hop (default 0.55, as v1). */
  smoothing?: number;
}

export class AnalysisChain {
  readonly fps: number;
  readonly spectrum: SpectrumAnalyser;
  readonly extractor = new FeatureExtractor();
  readonly descriptorExtractor = new DescriptorExtractor();
  private frame: Float32Array;
  private wave = new Float32Array(1024);
  private hopBuf = new Float32Array(0);
  /** Absolute sample index where the last hop ended; −1 before the first hop. */
  private end = -1;

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

  /** Runs one hop ending at absolute sample `end` (offline drives the chain this way). */
  runHop(src: PcmSource, end: number) {
    const sr = src.sampleRate;
    const hopLen = Math.round(sr / this.fps);
    const n = Math.max(1, Math.min(this.frame.length, this.end < 0 ? hopLen : end - this.end));
    this.end = end;
    src.latest(this.frame); // only valid when `end` is the newest sample
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
  /** Also run the live MelodyTracker and keep every hop's salience (for extractMelody). */
  melody?: boolean;
  /**
   * Called after every hop with the chain as it stands (full Features with chroma
   * and spectrum, descriptor internals) and the tracker's frame (null without
   * `melody`): per-hop data the result doesn't keep, without a second pass.
   */
  onHop?: (hop: number, chain: AnalysisChain, melody: MelodyFrame | null) => void;
}

export interface OfflineMelody {
  /** Salience per hop (SALIENCE_BINS each; views into one buffer). */
  salience: Float32Array[];
  /** The live tracker's frame per hop. */
  frames: MelodyFrame[];
  /** The live tracker's latency, seconds (its frames describe the sound this long before the hop). */
  latency: number;
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
  /** Only with the `melody` option. */
  melody?: OfflineMelody;
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
  const tracker = opts.melody ? new MelodyTracker() : null;
  const salBuf = new Float32Array(tracker ? hops * SALIENCE_BINS : 0);
  const melody: OfflineMelody | undefined = tracker ? { salience: [], frames: [], latency: 0 } : undefined;
  let lastReport = -1;
  for (let h = 0; h < hops; h++) {
    src.written = Math.round(((h + 1) * sampleRate) / fps);
    chain.runHop(src, src.written);
    times[h] = src.written / sampleRate;
    features.push(snapshotFeatures(chain.features));
    descriptors.push({ ...neutralDescriptors(), ...chain.descriptors });
    onsets[h] = chain.descriptorExtractor.debug.onset ? 1 : 0;
    let frame: MelodyFrame | null = null;
    if (tracker && melody) {
      frame = tracker.update(chain.spectrum.magnitudes, sampleRate, chain.spectrum.fftSize, times[h]);
      melody.frames.push(frame);
      const view = salBuf.subarray(h * SALIENCE_BINS, (h + 1) * SALIENCE_BINS);
      view.set(tracker.salience);
      melody.salience.push(view);
      melody.latency = tracker.latency;
    }
    opts.onHop?.(h, chain, frame);
    const pct = Math.floor((h / hops) * 20);
    if (opts.onProgress && pct !== lastReport) {
      lastReport = pct;
      opts.onProgress(h / hops);
    }
  }
  return { fps, sampleRate, duration: pcm.length / sampleRate, times, features, descriptors, onsets, melody };
}
