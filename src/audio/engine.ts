/**
 * Owns the Web Audio graph: plays the demo, the character studies, your files or
 * listens to the mic, and exposes analysis frames.
 *
 *   demo / study / file / input ──► bus ──► PCM tap (analysis)
 *                                    └────► volume ──► speakers
 *                                    └────► recorder tap
 *   mic ──────────────────────────► PCM tap, recorder (not to the speakers: no feedback howl)
 *
 * Analysis runs on our own PCM → FFT → Features → Descriptors chain (offline.ts),
 * in fixed 60 Hz hops of audio, so it matches `analyzeOffline` exactly.
 *
 * Studies play like the demo (source 'demo'); `study` says which one and which loop.
 * A file is also decoded whole while it plays (`onTrackDecoded`), for its fingerprint.
 * `songTime` is where in the song the sound you hear right now is.
 */
import type { Descriptors, PcmSource } from '../character/types';
import type { StudyId } from '../stage/types';
import { DemoGroove } from './demo';
import type { FeatureExtractor, Features } from './features';
import { AnalysisChain } from './offline';
import { PcmTap, type PcmBackend } from './pcm';
import { STUDIES, type Playable, type StudyPlayer, type StudyScore } from './studies';

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

export interface EngineOptions {
  /** false forces the AnalyserNode fallback for the PCM tap (testing). */
  worklet?: boolean;
}

/** A whole track, decoded and mixed down to mono. */
export interface DecodedTrack {
  file: File;
  mono: Float32Array;
  sampleRate: number;
}

export interface StudyState {
  id: StudyId;
  seed: number;
  /** The loop sounding now (0 = the first, composed from `seed`; later loops are re-seeded). */
  loop: number;
  /** Song seconds where that loop began. */
  loopStart: number;
  score: StudyScore;
}

export class AudioEngine {
  readonly ctx: AudioContext;
  readonly chain = new AnalysisChain();
  readonly extractor: FeatureExtractor = this.chain.extractor;
  /** Audio for the recorder. */
  readonly recordTap: MediaStreamAudioDestinationNode;
  /**
   * Connect other sound sources here (e.g. the MIDI key synth): they are heard
   * (through the volume), recorded and analysed. Don't also connect them to the
   * destination, or they play twice.
   */
  readonly input: GainNode;

  private tap: PcmTap;
  private bus: GainNode;
  private volume: GainNode;
  private demo: DemoGroove;
  /** What plays while the source is 'demo': the groove or a study. */
  private playable: Playable;
  /** One player per study (each owns a reverb rig); replaced when asked for another seed. */
  private studies = new Map<StudyId, StudyPlayer>();
  private studyId: StudyId | null = null;
  private audioEl: HTMLAudioElement;
  private mediaSource: MediaElementAudioSourceNode;
  private micStream: MediaStream | null = null;
  private micNode: MediaStreamAudioSourceNode | null = null;
  private tracks: File[] = [];
  private trackIndex = 0;
  private objectUrl: string | null = null;
  private listeners = new Set<() => void>();
  private decodedListeners = new Set<(t: DecodedTrack) => void>();
  /** Bumped on every track load and source switch, so a slow decode of a track we have left is dropped. */
  private decodeGen = 0;

  source: SourceKind = 'none';

  constructor(opts: EngineOptions = {}) {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.tap = new PcmTap(this.ctx, { worklet: opts.worklet });
    void this.tap.ready.then((b) => console.info(`[audio] PCM tap: ${b}${this.tap.workletError ? ` (${this.tap.workletError})` : ''}`));
    this.bus = this.ctx.createGain();
    this.input = this.ctx.createGain();
    this.input.connect(this.bus);
    this.volume = this.ctx.createGain();
    this.recordTap = this.ctx.createMediaStreamDestination();
    this.bus.connect(this.tap.input);
    this.bus.connect(this.volume).connect(this.ctx.destination);
    this.bus.connect(this.recordTap);

    this.demo = new DemoGroove(this.ctx, this.bus);
    this.playable = this.demo;
    this.audioEl = new Audio();
    this.audioEl.crossOrigin = 'anonymous';
    this.mediaSource = this.ctx.createMediaElementSource(this.audioEl);
    this.mediaSource.connect(this.bus);
    this.audioEl.addEventListener('ended', () => this.next());
    for (const ev of ['play', 'pause', 'loadedmetadata', 'durationchange']) {
      this.audioEl.addEventListener(ev, () => this.emit());
    }
  }

  /** The mono PCM being analysed (what you hear, or the mic). Stable for the engine's life. */
  get pcm(): PcmSource {
    return this.tap;
  }

  /** Which PCM backend is live: 'worklet', or the 'analyser' fallback. */
  get pcmBackend(): PcmBackend {
    return this.tap.backend;
  }

  /** Resolves once the PCM tap has settled on a backend. */
  get pcmReady(): Promise<PcmBackend> {
    return this.tap.ready;
  }

  /** The latest medium-timescale descriptors (updated by `analyze()`). */
  get descriptors(): Descriptors {
    return this.chain.descriptors;
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Called once per loaded file with the whole track decoded (mono mix-down, at the
   * context's rate). Decoding runs alongside playback, so the music starts at once;
   * a file left (another track, or the demo / mic) before its decode finishes is never reported.
   */
  onTrackDecoded(fn: (t: DecodedTrack) => void) {
    this.decodedListeners.add(fn);
    return () => this.decodedListeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  get state(): PlayerState {
    const s = this.source;
    return {
      source: s,
      playing: s === 'demo' ? this.playable.playing : s === 'file' ? !this.audioEl.paused : s === 'mic',
      title:
        s === 'demo' ? this.playable.title
        : s === 'file' ? prettyName(this.tracks[this.trackIndex]?.name ?? '')
        : s === 'mic' ? 'Listening to the room'
        : '',
      position: s === 'demo' ? this.playable.position : s === 'file' ? this.audioEl.currentTime : 0,
      duration: s === 'file' && isFinite(this.audioEl.duration) ? this.audioEl.duration : 0,
      trackIndex: this.trackIndex,
      trackCount: s === 'file' ? this.tracks.length : 0,
    };
  }

  /** Seconds from the graph to your ears: what you hear now left the graph this long ago. */
  get outputLatency(): number {
    const fin = (v: number | undefined) => (v !== undefined && Number.isFinite(v) && v > 0 ? v : 0);
    return fin(this.ctx.outputLatency) + fin(this.ctx.baseLatency);
  }

  /**
   * Song seconds of the sound you hear now: the source's position minus the output
   * latency. Holds still while paused, jumps on a seek. For the mic it is the audio
   * clock (it only ever moves forward); with nothing playing, 0.
   */
  get songTime(): number {
    const s = this.source;
    const pos =
      s === 'file' ? this.audioEl.currentTime
      : s === 'demo' ? this.playable.position
      : s === 'mic' ? this.ctx.currentTime
      : 0;
    return Math.max(0, pos - this.outputLatency);
  }

  /** The study playing (source 'demo'), with the loop sounding now; null for anything else. */
  get study(): StudyState | null {
    if (this.source !== 'demo' || !this.studyId) return null;
    const p = this.playable as StudyPlayer;
    const pass = p.passAt(this.songTime);
    return { id: this.studyId, seed: p.seed, loop: pass.loop, loopStart: pass.start, score: pass.score };
  }

  /** The file playing (source 'file'); null for any other source. */
  get currentFile(): File | null {
    return this.source === 'file' ? this.tracks[this.trackIndex] ?? null : null;
  }

  get trackNames() {
    return this.tracks.map((t) => prettyName(t.name));
  }

  private async resume() {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  /** Stops every source; also drops a decode in flight (it is for a track we are leaving). */
  private stopAll() {
    this.decodeGen++;
    this.playable.stop();
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
    this.playable = this.demo;
    this.studyId = null;
    this.demo.start();
    this.emit();
  }

  /**
   * Plays a character study from its start. `opts.seed` pins the first loop's score
   * (a scripted performance asks for the seed its script was composed from); without
   * it, the study's own seed. Pause/play restarts it, like the demo.
   */
  async playStudy(id: StudyId, opts: { seed?: number } = {}) {
    const def = STUDIES.find((s) => s.id === id);
    if (!def) throw new Error(`Unknown study: ${id}`);
    await this.resume();
    this.stopAll();
    const seed = opts.seed ?? def.seed;
    let player = this.studies.get(id);
    if (!player || player.seed !== seed) {
      player = def.create(this.ctx, this.bus, { seed });
      this.studies.set(id, player);
    }
    this.source = 'demo';
    this.playable = player;
    this.studyId = id;
    player.start();
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
    const file = this.tracks[this.trackIndex];
    const gen = ++this.decodeGen;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(file);
    this.audioEl.src = this.objectUrl;
    try {
      await this.audioEl.play();
    } catch (e) {
      console.warn('Could not play track', e);
    }
    this.emit();
    if (this.decodedListeners.size) void this.decode(file, gen);
  }

  /** Decodes the whole file (from its own copy of the bytes) and hands the mono mix-down to the listeners. */
  private async decode(file: File, gen: number) {
    try {
      const bytes = await file.arrayBuffer(); // a fresh copy: decodeAudioData detaches it
      if (gen !== this.decodeGen) return;
      const buf = await this.ctx.decodeAudioData(bytes);
      if (gen !== this.decodeGen) return;
      const mono = new Float32Array(buf.length);
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const ch = buf.getChannelData(c);
        for (let i = 0; i < mono.length; i++) mono[i] += ch[i];
      }
      if (buf.numberOfChannels > 1) for (let i = 0; i < mono.length; i++) mono[i] /= buf.numberOfChannels;
      const track: DecodedTrack = { file, mono, sampleRate: buf.sampleRate };
      for (const fn of this.decodedListeners) fn(track);
    } catch (e) {
      console.warn(`Could not decode ${file.name}`, e);
    }
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
    this.micNode.connect(this.tap.input);
    this.micNode.connect(this.recordTap);
    this.source = 'mic';
    this.emit();
    return true;
  }

  async togglePlay() {
    await this.resume();
    if (this.source === 'demo') {
      if (this.playable.playing) this.playable.stop();
      else this.playable.start();
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

  /**
   * Analyses the audio that arrived since the last call (0..n hops of 1/60 s)
   * and returns this frame's musical features. Call once per animation frame.
   */
  analyze(): Features {
    const hops = this.chain.step(this.tap);
    const f = this.chain.features;
    // Onsets are one-frame events: report one if any hop had one, and never twice.
    f.onset = hops > 0 && this.chain.onsetInStep;
    // Scenes animate on wall-clock time (the audio clock stops while suspended).
    f.time = performance.now() / 1000;
    return f;
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
