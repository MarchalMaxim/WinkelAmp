/**
 * The song and its picture: the audio element is the clock (the lab's frame(): freeze on pause, reset on a jump),
 * the Conductor draws the show. A seek while paused previews the picture at the new time: one second at once, then,
 * once the playhead rests, four (SETTLED), so widgets that build a picture over time show what playing would.
 */
import { SETTLED, samePreview, type Conductor } from '../show/conductor';
import type { Show } from '../show/show';
import { startLive } from '../../widgets/driver';
import type { WidgetRuntime } from '../../widgets/runtime';

/** How long the playhead rests before the paused picture settles; a quick preview slower than SLOW_MS (timed up to a
    one-pixel read, so the canvas work the browser defers counts too) is not followed by the ~2–4× longer settled one:
    a heavy section on a slow machine would hang for seconds. */
const SETTLE_MS = 350, SLOW_MS = 150;
/** The element may round a time it is given: within a millisecond is the same moment. */
const at = (a: number, b: number) => Math.abs(a - b) < 1e-3;

export class Player {
  onTick?: (t: number) => void;
  /** While a recording runs: seeks (the timeline, the arrow keys, a section's start) are ignored. */
  locked = false;
  private stream: MediaStream | null = null;
  private readonly stop: () => void;
  /** While paused: the show and time the picture on screen was drawn for (by playing up to the pause, or a preview). */
  private pictured: { show: Show; t: number } | null = null;
  private settleTimer = 0;

  constructor(readonly canvas: HTMLCanvasElement, readonly audio: HTMLAudioElement, readonly conductor: Conductor, readonly runtime: WidgetRuntime) {
    this.stop = startLive(conductor, runtime, audio, (t) => this.onTick?.(t));
    audio.addEventListener('pause', () => { this.pictured = { show: conductor.current, t: this.time }; });
    audio.addEventListener('play', () => { this.pictured = null; clearTimeout(this.settleTimer); });
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
    if (this.locked) return;
    const d = this.duration || Infinity;
    t = Math.max(0, Math.min(d - 0.01, t));
    this.audio.currentTime = t;
    if (this.audio.paused) this.preview(t); else this.conductor.reset(t);
    this.runtime.lastT = t;
    this.onTick?.(t);
  }

  /** Re-draws the paused picture after an edit (a knob, a boundary, a layer), but only when the edit changes what the
      preview at the playhead would draw: an edit elsewhere keeps the picture built up while playing. */
  refresh(): void {
    if (!this.audio.paused) return;
    const t = this.time, show = this.conductor.current, p = this.pictured;
    if (p && at(p.t, t) && samePreview(p.show, show, t)) this.pictured = { show, t };
    else { this.preview(t); this.runtime.lastT = t; }
  }

  /** The quick preview now; the settled one when the playhead and the show have rested for SETTLE_MS. */
  private preview(t: number): void {
    const t0 = performance.now();
    this.conductor.preview(t);
    this.runtime.ctx.g.getImageData(0, 0, 1, 1);   // waits for the drawing, which the browser may do later
    const show = this.conductor.current, quick = performance.now() - t0;
    this.pictured = { show, t };
    clearTimeout(this.settleTimer);
    if (quick > SLOW_MS) return;
    this.settleTimer = window.setTimeout(() => {
      const p = this.pictured;
      if (!this.audio.paused || !p || p.t !== t || p.show !== this.conductor.current || !at(this.time, t)) return;
      this.conductor.preview(t, SETTLED);
      this.runtime.lastT = t;
    }, SETTLE_MS);
  }

  /** The audio as a stream (for recording): routes the element through Web Audio on first call. */
  audioStream(): MediaStream {
    if (this.stream) return this.stream;
    const ac = new AudioContext(), src = ac.createMediaElementSource(this.audio), dest = ac.createMediaStreamDestination();
    src.connect(ac.destination); src.connect(dest);
    // Made outside a click the context starts suspended, and the element would then play silently (and record silence).
    if (ac.state === 'suspended') void ac.resume().catch(() => {});
    return (this.stream = dest.stream);
  }

  dispose(): void { this.stop(); }
}
