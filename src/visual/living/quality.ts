/**
 * Adaptive quality: watches frame times and steps the simulation/render
 * resolution down quickly when the GPU can't keep up, and back up cautiously.
 * Pure logic (no GL) so it can be unit tested.
 */

export interface Level {
  /** Velocity/pressure grid, cells along the short side. */
  sim: number;
  /** Dye texture, texels along the short side (capped by the render size). */
  dye: number;
  /** Pressure Jacobi iterations. */
  iterations: number;
  /** Render resolution as a fraction of the canvas backbuffer… */
  scale: number;
  /** …but never more than this many pixels. */
  maxPixels: number;
  /** Live spark particles. */
  sparks: number;
  /** Second-order (MacCormack) dye advection: crisper detail. */
  maccormack: boolean;
}

export const LEVELS: readonly Level[] = [
  { sim: 64, dye: 256, iterations: 10, scale: 0.5, maxPixels: 0.5e6, sparks: 8192, maccormack: false },
  { sim: 96, dye: 384, iterations: 14, scale: 0.6, maxPixels: 0.9e6, sparks: 16384, maccormack: false },
  { sim: 128, dye: 512, iterations: 18, scale: 0.75, maxPixels: 1.4e6, sparks: 24576, maccormack: false },
  { sim: 160, dye: 720, iterations: 22, scale: 1, maxPixels: 2.2e6, sparks: 32768, maccormack: true },
  { sim: 224, dye: 1024, iterations: 28, scale: 1, maxPixels: 4.2e6, sparks: 65536, maccormack: true },
];

/**
 * rAF intervals are capped by the display refresh, so "fast" just looks like the
 * refresh interval: we can only see when we're too slow. Hence: drop a level after
 * ~0.6 s of slow frames; climb only after a long stretch at full refresh, and a level
 * that failed before must prove itself for longer each time (no flip-flopping).
 */
export class QualityController {
  level: number;
  private ema = 0;
  private slowFor = 0;
  private goodFor = 0;
  private settle = 0;
  /** Shortest frame seen recently ≈ the display's refresh interval. */
  private refresh = 1 / 60;
  private failures: number[];

  constructor(start = 3, readonly max = LEVELS.length - 1) {
    this.level = Math.min(start, max);
    this.failures = new Array(max + 1).fill(0);
  }

  /** Feeds one frame interval (seconds). Returns true when the level changed. */
  update(dt: number): boolean {
    // Hitches (tab switch, GC, shader compile) are not a performance signal.
    if (!(dt > 0) || dt > 0.25) return false;
    if (this.settle > 0) {
      this.settle -= dt;
      return false;
    }
    this.refresh = Math.min(this.refresh * 1.0005 + 1e-6, dt, 1 / 30);
    this.ema = this.ema === 0 ? dt : this.ema + (dt - this.ema) * 0.08;
    // Below ~50 fps (or clearly below the display rate on slower displays) is slow.
    const slow = this.ema > Math.max(1 / 50, this.refresh * 1.25);
    const good = this.ema < Math.max(this.refresh * 1.08, 1 / 58);
    this.slowFor = slow ? this.slowFor + dt : Math.max(0, this.slowFor - dt * 0.5);
    this.goodFor = good ? this.goodFor + dt : 0;

    if (this.slowFor > 0.6 && this.level > 0) {
      this.failures[this.level]++;
      return this.set(this.level - 1);
    }
    if (this.level < this.max) {
      const need = 8 * Math.pow(3, this.failures[this.level + 1]);
      if (this.goodFor > need) return this.set(this.level + 1);
    }
    return false;
  }

  private set(level: number) {
    this.level = level;
    this.slowFor = 0;
    this.goodFor = 0;
    this.ema = 0;
    // Resizing textures costs a frame or two; don't judge the new level by it.
    this.settle = 0.4;
    return true;
  }
}
