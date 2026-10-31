/**
 * The song and its picture: the audio element is the clock (the lab's frame(): freeze on pause, reset on a jump),
 * the Conductor draws the show. A seek while paused previews the picture at the new time.
 */
import { samePreview, type Conductor } from '../show/conductor';
import type { Show } from '../show/show';
import { startLive } from '../../widgets/driver';
import type { WidgetRuntime } from '../../widgets/runtime';

export class Player {
  onTick?: (t: number) => void;
  private stream: MediaStream | null = null;
  private readonly stop: () => void;
  /** While paused: the show and time the picture on screen was drawn for (by playing up to the pause, or a preview). */
  private pictured: { show: Show; t: number } | null = null;

  constructor(readonly canvas: HTMLCanvasElement, readonly audio: HTMLAudioElement, readonly conductor: Conductor, readonly runtime: WidgetRuntime) {
    this.stop = startLive(conductor, runtime, audio, (t) => this.onTick?.(t));
    audio.addEventListener('pause', () => { this.pictured = { show: conductor.current, t: this.time }; });
    audio.addEventListener('play', () => { this.pictured = null; });
  }

  get time(): number { return this.audio.currentTime || 0; }
  get duration(): number { return Number.isFinite(this.audio.duration) ? this.audio.duration : 0; }
  get playing(): boolean { return !this.audio.paused; }

  async play(): Promise<void> {
    if (this.audio.ended) this.seek(0);
    await this.audio.play();
  }
  pause(): void { this.audio.pause(); }
  toggle(): void { if (this.audio.paused) void this.play().catch(() => {}); else this.pause(); }

  /** Paused → conductor.preview(t), so the picture shows what plays there; playing → the picture starts again at t. */
  seek(t: number): void {
    const d = this.duration || Infinity;
    t = Math.max(0, Math.min(d - 0.01, t));
    this.audio.currentTime = t;
    if (this.audio.paused) { this.conductor.preview(t); this.pictured = { show: this.conductor.current, t }; } else this.conductor.reset(t);
    this.runtime.lastT = t;
    this.onTick?.(t);
  }

  /** Re-draws the paused picture after an edit (a knob, a boundary, a layer), but only when the edit changes what the
      preview at the playhead would draw: an edit elsewhere keeps the picture built up while playing. */
  refresh(): void {
    if (!this.audio.paused) return;
    const t = this.time, show = this.conductor.current, p = this.pictured;
    if (!(p && p.t === t && samePreview(p.show, show, t))) { this.conductor.preview(t); this.runtime.lastT = t; }
    this.pictured = { show, t };
  }

  /** The audio as a stream (for recording): routes the element through Web Audio on first call. */
  audioStream(): MediaStream {
    if (this.stream) return this.stream;
    const ac = new AudioContext(), src = ac.createMediaElementSource(this.audio), dest = ac.createMediaStreamDestination();
    src.connect(ac.destination); src.connect(dest);
    return (this.stream = dest.stream);
  }

  dispose(): void { this.stop(); }
}
