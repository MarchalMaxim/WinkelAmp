/**
 * The PCM tap: the mono samples the user hears (or the mic), on the main thread.
 *
 * One long-lived `PcmTap` object is the `PcmSource` everyone holds; behind it a
 * backend fills its ring buffer:
 *   - `worklet`  — an AudioWorklet posts every sample (gapless, ~11 ms latency).
 *   - `analyser` — fallback where AudioWorklet is missing (insecure http:// on a
 *     LAN phone, old browsers): polls AnalyserNode.getFloatTimeDomainData and
 *     appends the samples that elapsed since the last poll (by the audio clock).
 * Switching backends never makes `written` go backwards.
 */
import type { PcmSource } from '../character/types';
import { PCM_CHUNK, PCM_PROCESSOR, pcmWorkletUrl } from './pcm-worklet';

/** Ring buffer of mono samples with a monotonic write counter. */
export class PcmRing implements PcmSource {
  readonly sampleRate: number;
  private buf: Float32Array;
  private mask: number;
  private count = 0;

  /** `capacity` is rounded up to a power of two. */
  constructor(sampleRate: number, capacity = 1 << 19) {
    this.sampleRate = sampleRate;
    let cap = 1;
    while (cap < capacity) cap <<= 1;
    this.buf = new Float32Array(cap);
    this.mask = cap - 1;
  }

  get capacity() {
    return this.buf.length;
  }

  get written() {
    return this.count;
  }

  /** Appends `n` samples of `data` starting at `from`. */
  write(data: ArrayLike<number>, from = 0, n = data.length - from) {
    const buf = this.buf;
    if (n > buf.length) {
      from += n - buf.length;
      this.count += n - buf.length;
      n = buf.length;
    }
    let w = this.count & this.mask;
    for (let i = 0; i < n; i++) {
      buf[w] = data[from + i];
      w = (w + 1) & this.mask;
    }
    this.count += n;
  }

  latest(out: Float32Array) {
    this.copyEndingAt(this.count, out);
  }

  /**
   * Copies the `out.length` samples that end at absolute sample index `end`
   * (exclusive). Anything not (or no longer) in the buffer reads as 0.
   */
  copyEndingAt(end: number, out: Float32Array) {
    const n = out.length;
    const start = end - n;
    const oldest = Math.max(0, this.count - this.buf.length);
    for (let i = 0; i < n; i++) {
      const s = start + i;
      out[i] = s >= oldest && s < this.count ? this.buf[s & this.mask] : 0;
    }
  }
}

export type PcmBackend = 'none' | 'worklet' | 'analyser';

/**
 * The engine's PCM source. Connect anything you want analyzed to `input`.
 * Stable identity: hold on to it, the backend may change underneath.
 */
export class PcmTap implements PcmSource {
  readonly input: GainNode;
  readonly ring: PcmRing;
  backend: PcmBackend = 'none';
  /** Set when the worklet could not be started (the fallback is in use). */
  workletError: string | null = null;
  /** Resolves with the backend once the worklet has started (or failed to). */
  readonly ready: Promise<PcmBackend>;

  private ctx: BaseAudioContext;
  private analyser: AnalyserNode | null = null;
  private analyserBuf: Float32Array<ArrayBuffer> | null = null;
  private lastPoll = -1;
  private node: AudioWorkletNode | null = null;
  private sink: GainNode;

  constructor(ctx: BaseAudioContext, opts: { worklet?: boolean } = {}) {
    this.ctx = ctx;
    this.ring = new PcmRing(ctx.sampleRate);
    this.input = ctx.createGain();
    // Worklet/analyser nodes are only guaranteed to be pulled when they lead to
    // the destination, so route them into a muted gain that does.
    this.sink = ctx.createGain();
    this.sink.gain.value = 0;
    this.sink.connect(ctx.destination);
    this.startAnalyser();
    this.ready = opts.worklet === false ? Promise.resolve(this.backend) : this.startWorklet().then(() => this.backend);
  }

  get sampleRate() {
    return this.ring.sampleRate;
  }

  get written() {
    this.poll();
    return this.ring.written;
  }

  latest(out: Float32Array) {
    this.poll();
    this.ring.latest(out);
  }

  /** Copies the samples ending at absolute index `end` (see PcmRing.copyEndingAt). */
  copyEndingAt(end: number, out: Float32Array) {
    this.poll();
    this.ring.copyEndingAt(end, out);
  }

  /** Brings the fallback's ring up to date. Cheap; called by every read. */
  poll() {
    const an = this.analyser;
    if (!an || !this.analyserBuf) return;
    const now = this.ctx.currentTime;
    if (this.lastPoll < 0) {
      this.lastPoll = now;
      return;
    }
    const elapsed = Math.round((now - this.lastPoll) * this.ctx.sampleRate);
    if (elapsed <= 0) return;
    this.lastPoll = now;
    an.getFloatTimeDomainData(this.analyserBuf);
    const n = Math.min(elapsed, this.analyserBuf.length);
    // A longer gap (hidden tab) is bridged with silence so `written` stays on the audio clock.
    if (elapsed > n) this.ring.write(new Float32Array(Math.min(elapsed - n, this.ring.capacity)));
    this.ring.write(this.analyserBuf, this.analyserBuf.length - n, n);
  }

  private startAnalyser() {
    const an = this.ctx.createAnalyser();
    an.fftSize = 32768;
    an.smoothingTimeConstant = 0;
    an.channelCount = 1;
    an.channelCountMode = 'explicit';
    an.channelInterpretation = 'speakers'; // proper stereo → mono downmix
    this.input.connect(an);
    an.connect(this.sink);
    this.analyser = an;
    this.analyserBuf = new Float32Array(an.fftSize);
    this.backend = 'analyser';
  }

  private async startWorklet() {
    try {
      if (!this.ctx.audioWorklet) throw new Error('AudioWorklet unavailable (insecure context?)');
      await this.ctx.audioWorklet.addModule(pcmWorkletUrl());
      const node = new AudioWorkletNode(this.ctx, PCM_PROCESSOR, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
        processorOptions: { chunk: PCM_CHUNK },
      });
      // Catch up the fallback one last time, then hand over.
      this.poll();
      node.port.onmessage = (e: MessageEvent<Float32Array>) => this.ring.write(e.data);
      node.onprocessorerror = () => {
        this.workletError = 'processor error';
        console.warn('PCM worklet crashed; analysis input is now silent');
      };
      this.input.connect(node);
      node.connect(this.sink);
      this.node = node;
      if (this.analyser) {
        this.input.disconnect(this.analyser);
        this.analyser.disconnect();
        this.analyser = null;
        this.analyserBuf = null;
      }
      this.backend = 'worklet';
    } catch (e) {
      this.workletError = String((e as Error)?.message ?? e);
      console.warn('PCM worklet unavailable, using AnalyserNode fallback:', e);
    }
  }

  dispose() {
    this.node?.port.postMessage('stop');
    this.node?.disconnect();
    this.analyser?.disconnect();
    this.input.disconnect();
    this.sink.disconnect();
  }
}

/** A PcmSource over a fixed array (offline analysis): `written` is whatever the caller says. */
export class ArrayPcm implements PcmSource {
  written = 0;
  constructor(readonly samples: Float32Array, readonly sampleRate: number) {}
  latest(out: Float32Array) {
    const end = this.written;
    const start = end - out.length;
    for (let i = 0; i < out.length; i++) {
      const s = start + i;
      out[i] = s >= 0 && s < this.samples.length ? this.samples[s] : 0;
    }
  }
}
