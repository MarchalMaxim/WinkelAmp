/**
 * The AudioWorklet half of the PCM tap: runs on the audio thread, downmixes
 * whatever is connected to mono and posts it to the main thread in small chunks.
 *
 * The processor is written as a self-contained function and shipped as a Blob
 * URL (see `pcmWorkletUrl`). That sidesteps bundler differences between dev and
 * build (Vite copies `new URL('x.ts')` assets uncompiled) and keeps the worklet
 * type-checked with the rest of the code. Because it is stringified, the
 * function must not reference anything outside itself — and it avoids class
 * fields so a down-levelling bundler can't inject helpers it would not see.
 */

declare const AudioWorkletProcessor: { new (): { readonly port: MessagePort } };
declare function registerProcessor(name: string, ctor: unknown): void;

export const PCM_PROCESSOR = 'winkelamp-pcm-tap';

/** Samples per message: 512 at 48 kHz ≈ 11 ms of latency, ~94 messages/s. */
export const PCM_CHUNK = 512;

function pcmTapModule(name: string) {
  class PcmTapProcessor extends AudioWorkletProcessor {
    buf: Float32Array;
    size: number;
    fill: number;
    alive: boolean;
    constructor(options?: { processorOptions?: { chunk?: number } }) {
      super();
      this.size = options?.processorOptions?.chunk ?? 512;
      this.buf = new Float32Array(this.size);
      this.fill = 0;
      this.alive = true;
      this.port.onmessage = (e: MessageEvent) => {
        if (e.data === 'stop') this.alive = false;
      };
    }
    process(inputs: Float32Array[][]): boolean {
      const chans = inputs[0] ?? [];
      // 128 frames per render quantum; with nothing connected we still advance
      // time with silence, so consumers can tell "quiet" from "stalled".
      const frames = chans.length ? chans[0].length : 128;
      const inv = chans.length ? 1 / chans.length : 0;
      for (let i = 0; i < frames; i++) {
        let s = 0;
        for (let c = 0; c < chans.length; c++) s += chans[c][i];
        this.buf[this.fill++] = s * inv;
        if (this.fill === this.size) {
          // Transferring detaches the buffer (its length becomes 0), so the
          // next one is sized from `size`, never from the old array.
          const out = this.buf;
          this.port.postMessage(out, [out.buffer]);
          this.buf = new Float32Array(this.size);
          this.fill = 0;
        }
      }
      return this.alive;
    }
  }
  registerProcessor(name, PcmTapProcessor);
}

let url: string | null = null;

/** Blob URL for `audioWorklet.addModule`, created once. */
export function pcmWorkletUrl(): string {
  url ??= URL.createObjectURL(
    new Blob([`(${pcmTapModule.toString()})(${JSON.stringify(PCM_PROCESSOR)});`], { type: 'text/javascript' }),
  );
  return url;
}
