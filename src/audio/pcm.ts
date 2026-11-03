/**
 * Mono samples for the analysis: a ring buffer, and a whole decoded file (offline).
 */
import type { PcmSource } from '../character/types';

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
