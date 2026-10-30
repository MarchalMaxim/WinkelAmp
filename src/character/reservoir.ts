/**
 * The "imagination": an echo-state network (reservoir computing) that turns the
 * music's recent history into organic, never-quite-repeating gestures.
 *
 *   x ← (1 − a)·x + a·tanh(W·x + W_in·u + b)        leaky-integrator neurons
 *
 * W is fixed, random, sparse (fan-in K per unit) and scaled to spectral radius
 * ρ < 1 (echo-state property: the state is a fading memory of the input, not of
 * where it started). Everything comes from a seeded PRNG, so two instances with
 * the same seed produce bit-identical gestures.
 *
 * There is no training data for "what Rachmaninoff should look like", so the
 * readouts are designed rather than learned:
 *  1. fixed random projections of the state (one per output channel);
 *  2. a running mean / covariance (≈20 s memory) and a Cholesky whitening, so the
 *     channels are decorrelated and unit-variance whatever the music does —
 *     quiet pieces still move across the whole range, loud ones don't saturate;
 *  3. tanh, so every channel lands in −1..1.
 *
 * Under a steady input a contractive network settles to a fixed point and the
 * picture would freeze, so GestureReservoir also feeds a small bank of slow phase
 * oscillators ("the clock dreams, the music steers"): their speed follows pace
 * and a band-limited noise input grows with agitation, so erratic music makes
 * erratic gestures even when its averages are steady. The leak rate follows pace
 * too: quick music → quick gestures.
 */
import type { Descriptors, Gesture } from './types';
import type { Features } from '../audio/features';

/** mulberry32: tiny, fast, good-enough seeded PRNG. Returns 0..1. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface EsnOptions {
  size: number;
  inputs: number;
  outputs: number;
  seed: number;
  /** Target spectral radius of W (< 1). */
  spectralRadius: number;
  /** Nonzero recurrent weights per unit. */
  fanIn: number;
  /** Scale of the input weights. */
  inputScale: number;
}

/** A plain echo-state network with sparse recurrent weights and linear random readouts. */
export class EchoStateNetwork {
  readonly size: number;
  readonly inputs: number;
  readonly outputs: number;
  readonly state: Float64Array;
  /** Measured spectral radius after scaling (for tests / diagnostics). */
  readonly spectralRadius: number;

  private cols: Int32Array;
  private vals: Float64Array;
  private fanIn: number;
  private win: Float64Array;
  private bias: Float64Array;
  private wout: Float64Array;
  private pre: Float64Array;

  constructor(opts: EsnOptions) {
    const { size: n, inputs, outputs, fanIn } = opts;
    this.size = n;
    this.inputs = inputs;
    this.outputs = outputs;
    this.fanIn = fanIn;
    const rnd = mulberry32(opts.seed);
    const sym = () => rnd() * 2 - 1;
    this.state = new Float64Array(n);
    this.pre = new Float64Array(n);
    this.cols = new Int32Array(n * fanIn);
    this.vals = new Float64Array(n * fanIn);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < fanIn; k++) {
        this.cols[i * fanIn + k] = Math.floor(rnd() * n);
        this.vals[i * fanIn + k] = sym();
      }
    }
    const rho = this.estimateRadius(rnd);
    const scale = opts.spectralRadius / Math.max(1e-9, rho);
    for (let i = 0; i < this.vals.length; i++) this.vals[i] *= scale;
    this.spectralRadius = this.estimateRadius(rnd);
    this.win = new Float64Array(n * inputs);
    for (let i = 0; i < this.win.length; i++) this.win[i] = sym() * opts.inputScale;
    this.bias = new Float64Array(n);
    for (let i = 0; i < n; i++) this.bias[i] = sym() * 0.2;
    // Readouts: random directions, normalized so each output has a comparable scale.
    this.wout = new Float64Array(outputs * n);
    for (let o = 0; o < outputs; o++) {
      let norm = 0;
      for (let i = 0; i < n; i++) {
        const v = sym();
        this.wout[o * n + i] = v;
        norm += v * v;
      }
      norm = 1 / Math.sqrt(norm);
      for (let i = 0; i < n; i++) this.wout[o * n + i] *= norm;
    }
  }

  /**
   * Spectral radius by norm growth: ‖Wᵏv‖^(1/k) → ρ(W) for a generic v, which also
   * works when the dominant eigenvalues are a complex pair (plain power iteration
   * would oscillate there).
   */
  private estimateRadius(rnd: () => number): number {
    const n = this.size;
    let v = new Float64Array(n);
    let w = new Float64Array(n);
    for (let i = 0; i < n; i++) v[i] = rnd() * 2 - 1;
    let logGrowth = 0;
    const burn = 100;
    const iters = 400;
    for (let it = 0; it < iters; it++) {
      this.mulW(v, w);
      let norm = 0;
      for (let i = 0; i < n; i++) norm += w[i] * w[i];
      norm = Math.sqrt(norm) || 1e-30;
      for (let i = 0; i < n; i++) w[i] /= norm;
      if (it >= burn) logGrowth += Math.log(norm);
      const t = v;
      v = w;
      w = t;
    }
    return Math.exp(logGrowth / (iters - burn));
  }

  private mulW(x: Float64Array, out: Float64Array): void {
    const k = this.fanIn;
    for (let i = 0; i < this.size; i++) {
      let s = 0;
      const base = i * k;
      for (let j = 0; j < k; j++) s += this.vals[base + j] * x[this.cols[base + j]];
      out[i] = s;
    }
  }

  /** One update with leak rate `leak` (0..1]. */
  step(u: ArrayLike<number>, leak: number): void {
    const n = this.size;
    const m = this.inputs;
    const x = this.state;
    const pre = this.pre;
    this.mulW(x, pre);
    for (let i = 0; i < n; i++) {
      let s = pre[i] + this.bias[i];
      const base = i * m;
      for (let j = 0; j < m; j++) s += this.win[base + j] * u[j];
      pre[i] = s;
    }
    for (let i = 0; i < n; i++) x[i] += leak * (Math.tanh(pre[i]) - x[i]);
  }

  /** Raw linear readouts into `out` (length = outputs). */
  readout(out: Float64Array): void {
    const n = this.size;
    for (let o = 0; o < this.outputs; o++) {
      let s = 0;
      const base = o * n;
      for (let i = 0; i < n; i++) s += this.wout[base + i] * this.state[i];
      out[o] = s;
    }
  }

  reset(): void {
    this.state.fill(0);
  }
}

/**
 * Online whitening: running mean and covariance (exponential, time constant
 * `tau` seconds), Cholesky factor refreshed every few frames, z = L⁻¹(y − μ).
 * The covariance gets a variance floor so silence doesn't blow tiny residuals up
 * to full-range motion.
 */
export class Whitener {
  readonly mean: Float64Array;
  private cov: Float64Array;
  private chol: Float64Array;
  private dev: Float64Array;
  private frames = 0;

  constructor(readonly dim: number, private tau = 20, private varFloor = 4e-4) {
    this.mean = new Float64Array(dim);
    this.cov = new Float64Array(dim * dim);
    this.chol = new Float64Array(dim * dim);
    this.dev = new Float64Array(dim);
    for (let i = 0; i < dim; i++) this.cov[i * dim + i] = 0.01;
    this.factor();
  }

  /** Updates statistics with y and writes the whitened vector into out. */
  push(y: Float64Array, dt: number, out: Float64Array): void {
    const n = this.dim;
    // Faster adaptation for the first seconds, so the start isn't dominated by the prior.
    const tau = Math.min(this.tau, 1 + this.frames * dt);
    const a = 1 - Math.exp(-dt / tau);
    for (let i = 0; i < n; i++) {
      this.mean[i] += a * (y[i] - this.mean[i]);
      this.dev[i] = y[i] - this.mean[i];
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        const k = i * n + j;
        this.cov[k] += a * (this.dev[i] * this.dev[j] - this.cov[k]);
      }
    }
    if (this.frames++ % 8 === 0) this.factor();
    // Forward substitution: L z = dev.
    const L = this.chol;
    for (let i = 0; i < n; i++) {
      let s = this.dev[i];
      for (let j = 0; j < i; j++) s -= L[i * n + j] * out[j];
      out[i] = s / L[i * n + i];
    }
  }

  private factor(): void {
    const n = this.dim;
    const C = this.cov;
    const L = this.chol;
    let trace = 0;
    for (let i = 0; i < n; i++) trace += C[i * n + i];
    // Ridge: a little shrinkage towards the mean variance keeps L well conditioned.
    const ridge = 0.05 * (trace / n) + this.varFloor;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let s = C[i * n + j] + (i === j ? ridge : 0);
        for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k];
        L[i * n + j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j * n + j];
      }
    }
  }
}

const OSC_HZ = [0.071, 0.113, 0.173];
const N_DESC = 10;
const N_FAST = 4;
const N_INPUT = N_DESC + N_FAST + OSC_HZ.length * 2 + 2 + 1;
const N_OUT = 9;
/** a / (2 − a) for the noise filter at 60 Hz: the reference the noise strength was tuned at. */
const NOISE_A60 = 1 - Math.exp(-(1 / 60) * 3 * 2 * Math.PI);
const NOISE_GAIN_60 = NOISE_A60 / (2 - NOISE_A60);

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Character-level context the reservoir needs (a subset of CharacterAxes). */
export interface GestureContext {
  pace: number;
  agitation: number;
  energy: number;
}

/**
 * Drives an EchoStateNetwork with descriptors + fast features and turns its
 * readouts into a Gesture. Allocation-free per frame.
 */
export class GestureReservoir {
  readonly esn: EchoStateNetwork;
  private u = new Float64Array(N_INPUT);
  private raw = new Float64Array(N_OUT);
  private white = new Float64Array(N_OUT);
  private smooth = new Float64Array(N_OUT);
  private whitener = new Whitener(N_OUT);
  private phase = new Float64Array(OSC_HZ.length);
  private noise = new Float64Array(2);
  private rnd: () => number;
  private breath = 0.5;
  readonly gesture: Gesture = { x: 0, y: 0, angle: 0, swirl: 0, breath: 0.5, extra: [0, 0, 0, 0] };

  constructor(seed = 0x5eed, size = 300) {
    this.esn = new EchoStateNetwork({
      size, inputs: N_INPUT, outputs: N_OUT, seed, spectralRadius: 0.92, fanIn: 10, inputScale: 0.6,
    });
    this.rnd = mulberry32(seed ^ 0x9e3779b9);
    for (let i = 0; i < this.phase.length; i++) this.phase[i] = this.rnd() * Math.PI * 2;
  }

  /**
   * One step of `dt` seconds of MUSIC time (MusicClock): with dt = 0 the whole
   * reservoir — state, oscillators, noise, whitening, smoothing — holds still, so
   * the gesture freezes with the music.
   */
  update(d: Descriptors, f: Features, ctx: GestureContext, dt: number): Gesture {
    if (dt <= 0) return this.gesture;
    dt = clamp(Number.isFinite(dt) ? dt : 1 / 60, 1e-4, 0.1);
    const pace = clamp(ctx.pace, 0, 1);
    const agit = clamp(ctx.agitation, 0, 1);
    const u = this.u;
    const c = (v: number) => clamp(Number.isFinite(v) ? v : 0, 0, 1) * 2 - 1;
    // Descriptors, centered to −1..1 so they steer rather than just bias.
    u[0] = c(d.loudness);
    u[1] = c(d.register);
    u[2] = c(d.brightness);
    u[3] = c(d.onsetRate);
    u[4] = c(d.irregularity);
    u[5] = c(d.attack);
    u[6] = c(d.sustain);
    u[7] = clamp(Number.isFinite(d.majorness) ? d.majorness : 0, -1, 1);
    u[8] = c(d.roughness);
    u[9] = c(d.pulseClarity);
    // Fast features: the moment-to-moment kicks.
    u[10] = c(f.level);
    u[11] = c(f.bass);
    u[12] = c(f.treble);
    u[13] = c(f.beat);
    // Slow oscillators, speed ∝ pace (0.35× … 2.6×).
    const speed = 0.35 + 2.25 * pace;
    for (let i = 0; i < OSC_HZ.length; i++) {
      this.phase[i] = (this.phase[i] + 2 * Math.PI * OSC_HZ[i] * speed * dt) % (2 * Math.PI);
      u[14 + i * 2] = Math.sin(this.phase[i]);
      u[15 + i * 2] = Math.cos(this.phase[i]);
    }
    // Band-limited noise (≈3 Hz), amplitude ∝ agitation: erratic music, erratic gestures.
    // A one-pole low-pass of per-frame white noise has variance ∝ a / (2 − a): scale the
    // white input so the filtered noise has the same strength at any frame rate (as at 60 Hz).
    const na = 1 - Math.exp(-dt * 3 * 2 * Math.PI);
    const white = 1.7 * Math.sqrt(((2 - na) / na) * NOISE_GAIN_60);
    for (let i = 0; i < 2; i++) {
      this.noise[i] += na * ((this.rnd() * 2 - 1) * white - this.noise[i]);
      u[20 + i] = this.noise[i] * (0.15 + 1.6 * agit);
    }
    u[22] = 1;

    // Leak: time constant 0.9 s (slow music) … 0.12 s (quick music).
    const tauLeak = 0.9 * Math.pow(0.12 / 0.9, pace);
    this.esn.step(u, 1 - Math.exp(-dt / tauLeak));
    this.esn.readout(this.raw);
    this.whitener.push(this.raw, dt, this.white);

    // Final smoothing removes frame jitter but keeps the reservoir's own timing.
    const sa = 1 - Math.exp(-dt / (0.08 + 0.35 * (1 - pace)));
    for (let i = 0; i < N_OUT; i++) {
      const v = Math.tanh(0.85 * this.white[i]);
      this.smooth[i] += sa * ((Number.isFinite(v) ? v : 0) - this.smooth[i]);
    }
    const s = this.smooth;
    const g = this.gesture;
    // Wander range grows with energy/agitation: calm music stays near home.
    const amp = 0.55 + 0.45 * Math.max(ctx.energy, agit);
    g.x = s[0] * amp;
    g.y = s[1] * amp;
    g.angle = s[2] * Math.PI;
    g.swirl = s[3];
    this.breath += (1 - Math.exp(-dt / 1.5)) * (0.5 + 0.5 * s[4] - this.breath);
    g.breath = clamp(this.breath, 0, 1);
    g.extra[0] = s[5];
    g.extra[1] = s[6];
    g.extra[2] = s[7];
    g.extra[3] = s[8];
    return g;
  }
}
