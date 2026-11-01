/**
 * Containers to try, best first. MP4 with H.264 + AAC plays on phones and in
 * WhatsApp; WebM is the fallback for browsers that cannot record MP4 (Firefox).
 * Plain `video/mp4` comes last: it may pick Opus audio, which some players reject.
 */
const TYPES = [
  'video/mp4;codecs=avc1.640033,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
];

/** How a recording is made: the bit rates the encoder aims at and the canvas frame rate. */
export interface RecorderOptions { videoBitsPerSecond: number; audioBitsPerSecond?: number; fps: number }

/** The old app's recordings: 12 Mb/s, 60 fps, the browser's audio rate. */
export const DEFAULT_RECORDER_OPTIONS: RecorderOptions = { videoBitsPerSecond: 12_000_000, fps: 60 };

/** The first container the browser can record (`isSupported` is MediaRecorder.isTypeSupported), or undefined. */
export function pickMimeType(isSupported: (type: string) => boolean): string | undefined {
  return TYPES.find((t) => isSupported(t));
}

/** Records the canvas plus the audio into an .mp4 (or, failing that, .webm) video. */
export class Recorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private pausedAt = 0;
  private pausedFor = 0;

  constructor(private canvas: HTMLCanvasElement, private audio: MediaStream, private opts: RecorderOptions = DEFAULT_RECORDER_OPTIONS) {}

  get recording() {
    return this.rec?.state === 'recording';
  }

  get paused() {
    return this.rec?.state === 'paused';
  }

  /** The container and codecs being written ('' before start). */
  get mimeType() {
    return this.rec?.mimeType ?? '';
  }

  /** Seconds recorded so far, pauses left out. */
  get seconds() {
    if (!this.rec || this.rec.state === 'inactive') return 0;
    const end = this.rec.state === 'paused' ? this.pausedAt : performance.now();
    return (end - this.startedAt - this.pausedFor) / 1000;
  }

  static supported() {
    return typeof MediaRecorder !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype;
  }

  start() {
    const stream = this.canvas.captureStream(this.opts.fps);
    for (const t of this.audio.getAudioTracks()) stream.addTrack(t);
    const mimeType = pickMimeType((t) => MediaRecorder.isTypeSupported(t));
    this.chunks = [];
    const { videoBitsPerSecond, audioBitsPerSecond } = this.opts;
    this.rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond, ...(audioBitsPerSecond ? { audioBitsPerSecond } : {}) });
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(250);
    this.startedAt = performance.now();
    this.pausedFor = 0;
  }

  pause() {
    if (this.rec?.state !== 'recording') return;
    this.rec.pause();
    this.pausedAt = performance.now();
  }

  resume() {
    if (this.rec?.state !== 'paused') return;
    this.rec.resume();
    this.pausedFor += performance.now() - this.pausedAt;
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      const rec = this.rec!;
      rec.onstop = () => resolve(new Blob(this.chunks, { type: rec.mimeType || 'video/webm' }));
      rec.stop();
      rec.stream.getVideoTracks().forEach((t) => t.stop());
    });
  }
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export const stamp = () => new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
