/**
 * Owns the Web Audio graph: plays the demo, your files or listens to the mic,
 * and exposes analysis frames.
 *
 *   demo / file ──► bus ──► analyser
 *                    └────► volume ──► speakers
 *                    └────► recorder tap
 *   mic ──────────► analyser (not to the speakers: no feedback howl)
 */
import { DemoGroove } from './demo';
import { FeatureExtractor, type Features } from './features';

export type SourceKind = 'none' | 'demo' | 'file' | 'mic';

export interface PlayerState {
  source: SourceKind;
  playing: boolean;
  title: string;
  position: number;
  duration: number;
  trackIndex: number;
  trackCount: number;
}

const FFT_SIZE = 4096;

export class AudioEngine {
  readonly ctx: AudioContext;
  readonly extractor = new FeatureExtractor();
  /** Audio for the recorder. */
  readonly recordTap: MediaStreamAudioDestinationNode;

  private analyser: AnalyserNode;
  private bus: GainNode;
  private volume: GainNode;
  private demo: DemoGroove;
  private audioEl: HTMLAudioElement;
  private mediaSource: MediaElementAudioSourceNode;
  private micStream: MediaStream | null = null;
  private micNode: MediaStreamAudioSourceNode | null = null;
  private tracks: File[] = [];
  private trackIndex = 0;
  private objectUrl: string | null = null;
  private freqDb: Float32Array<ArrayBuffer>;
  private mags: Float32Array;
  private wave: Float32Array<ArrayBuffer>;
  private listeners = new Set<() => void>();

  source: SourceKind = 'none';

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = FFT_SIZE;
    this.analyser.smoothingTimeConstant = 0.55;
    this.bus = this.ctx.createGain();
    this.volume = this.ctx.createGain();
    this.recordTap = this.ctx.createMediaStreamDestination();
    this.bus.connect(this.analyser);
    this.bus.connect(this.volume).connect(this.ctx.destination);
    this.bus.connect(this.recordTap);

    this.demo = new DemoGroove(this.ctx, this.bus);
    this.audioEl = new Audio();
    this.audioEl.crossOrigin = 'anonymous';
    this.mediaSource = this.ctx.createMediaElementSource(this.audioEl);
    this.mediaSource.connect(this.bus);
    this.audioEl.addEventListener('ended', () => this.next());
    for (const ev of ['play', 'pause', 'loadedmetadata', 'durationchange']) {
      this.audioEl.addEventListener(ev, () => this.emit());
    }

    this.freqDb = new Float32Array(this.analyser.frequencyBinCount);
    this.mags = new Float32Array(this.analyser.frequencyBinCount);
    this.wave = new Float32Array(1024);
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  get state(): PlayerState {
    const s = this.source;
    return {
      source: s,
      playing: s === 'demo' ? this.demo.playing : s === 'file' ? !this.audioEl.paused : s === 'mic',
      title:
        s === 'demo' ? this.demo.title
        : s === 'file' ? prettyName(this.tracks[this.trackIndex]?.name ?? '')
        : s === 'mic' ? 'Listening to the room'
        : '',
      position: s === 'demo' ? this.demo.position : s === 'file' ? this.audioEl.currentTime : 0,
      duration: s === 'file' && isFinite(this.audioEl.duration) ? this.audioEl.duration : 0,
      trackIndex: this.trackIndex,
      trackCount: s === 'file' ? this.tracks.length : 0,
    };
  }

  get trackNames() {
    return this.tracks.map((t) => prettyName(t.name));
  }

  private async resume() {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  private stopAll() {
    this.demo.stop();
    this.audioEl.pause();
    if (this.micStream) {
      for (const t of this.micStream.getTracks()) t.stop();
      this.micNode?.disconnect();
      this.micStream = null;
      this.micNode = null;
    }
  }

  async playDemo() {
    await this.resume();
    this.stopAll();
    this.source = 'demo';
    this.demo.start();
    this.emit();
  }

  /** Adds files to the queue; starts playing the first new one. */
  async playFiles(files: File[]) {
    const audio = files.filter((f) => f.type.startsWith('audio/') || /\.(mp3|wav|ogg|oga|flac|m4a|aac|opus|webm)$/i.test(f.name));
    if (!audio.length) return false;
    await this.resume();
    const first = this.source === 'file' ? this.tracks.length : 0;
    this.tracks = this.source === 'file' ? [...this.tracks, ...audio] : audio;
    this.stopAll();
    this.source = 'file';
    await this.loadTrack(first);
    return true;
  }

  private async loadTrack(i: number) {
    if (!this.tracks.length) return;
    this.trackIndex = (i + this.tracks.length) % this.tracks.length;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(this.tracks[this.trackIndex]);
    this.audioEl.src = this.objectUrl;
    try {
      await this.audioEl.play();
    } catch (e) {
      console.warn('Could not play track', e);
    }
    this.emit();
  }

  async playMic(): Promise<boolean> {
    await this.resume();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch {
      return false;
    }
    this.stopAll();
    this.micStream = stream;
    this.micNode = this.ctx.createMediaStreamSource(stream);
    this.micNode.connect(this.analyser);
    this.micNode.connect(this.recordTap);
    this.source = 'mic';
    this.emit();
    return true;
  }

  async togglePlay() {
    await this.resume();
    if (this.source === 'demo') {
      if (this.demo.playing) this.demo.stop();
      else this.demo.start();
    } else if (this.source === 'file') {
      if (this.audioEl.paused) await this.audioEl.play();
      else this.audioEl.pause();
    }
    this.emit();
  }

  next() {
    if (this.source === 'file') void this.loadTrack(this.trackIndex + 1);
  }

  prev() {
    if (this.source !== 'file') return;
    if (this.audioEl.currentTime > 3) this.audioEl.currentTime = 0;
    else void this.loadTrack(this.trackIndex - 1);
  }

  playTrack(i: number) {
    if (this.source === 'file') void this.loadTrack(i);
  }

  seek(fraction: number) {
    if (this.source === 'file' && isFinite(this.audioEl.duration)) {
      this.audioEl.currentTime = fraction * this.audioEl.duration;
    }
  }

  setVolume(v: number) {
    this.volume.gain.setTargetAtTime(v * v, this.ctx.currentTime, 0.02);
  }

  /** Reads the analyser and returns this frame's musical features. */
  analyze(): Features {
    this.analyser.getFloatFrequencyData(this.freqDb);
    for (let i = 0; i < this.freqDb.length; i++) {
      const db = this.freqDb[i];
      this.mags[i] = isFinite(db) ? 10 ** (db / 20) : 0;
    }
    this.analyser.getFloatTimeDomainData(this.wave);
    return this.extractor.update({
      magnitudes: this.mags,
      waveform: this.wave,
      sampleRate: this.ctx.sampleRate,
      fftSize: FFT_SIZE,
      time: performance.now() / 1000,
    });
  }
}

/** "01 - my_song.final.mp3" → "my song.final" */
export function prettyName(name: string) {
  return name
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/^\d{1,3}[\s._-]+/, '')
    .replace(/_/g, ' ')
    .trim();
}
