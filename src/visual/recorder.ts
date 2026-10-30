/** Records the canvas plus the audio into a .webm video. */
export class Recorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;

  constructor(private canvas: HTMLCanvasElement, private audio: MediaStream) {}

  get recording() {
    return this.rec?.state === 'recording';
  }

  get seconds() {
    return this.recording ? (performance.now() - this.startedAt) / 1000 : 0;
  }

  static supported() {
    return typeof MediaRecorder !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype;
  }

  start() {
    const stream = this.canvas.captureStream(60);
    for (const t of this.audio.getAudioTracks()) stream.addTrack(t);
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t));
    this.chunks = [];
    this.rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 });
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(250);
    this.startedAt = performance.now();
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
