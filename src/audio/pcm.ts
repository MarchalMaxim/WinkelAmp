/**
 * Mono samples for the analysis: a whole decoded file (offline).
 */
import type { PcmSource } from './types';

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
