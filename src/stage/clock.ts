/**
 * The music is the clock: a time base that advances only while there is music to
 * see. Every element animates on `MusicClock.time` (and on audio features), never
 * on wall-clock time, so loud and busy music moves the picture fast, a quiet drone
 * barely, and silence not at all — no motion without an audible cause.
 *
 *   time += drive · dt,   drive ← level (soft knee) + musical change + onset density
 *
 * The raw drive is smoothed (fast rise, slower fall: a burst of notes registers at
 * once, a stop eases out), then gated by the silence descriptor *after* smoothing,
 * so true silence is an exact freeze whatever came before. A poke (a MIDI key, a
 * tap on the canvas) adds a short nudge outside the gate: the picture answers a
 * player even when the room is quiet. After ~1 s of silence the frozen picture
 * dims to a faint afterimage over a few seconds, and recovers almost at once when
 * sound returns.
 */

/** What drives the clock, once per frame. */
export interface ClockInput {
  /** 0..1 loudness on an absolute-ish scale (Descriptors.loudness live: not auto-gained). */
  level: number;
  /** 0..1 onset strength this frame (0 when there is no onset). */
  onset: number;
  /**
   * 0..1 musical change. Live: mean of Descriptors.harmonicChange and pitchMotion — raw
   * spectral flux reads room noise as busier than most music, these read it as 0.
   */
  flux: number;
  /** Descriptors.silence: 1 = nothing playing. */
  silence: number;
  /** 0..1 from a MIDI key / pointer tap. */
  poke?: number;
}

/** The faintest the afterimage gets in long silence. */
export const DIM_FLOOR = 0.12;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const fin = (v: number | undefined) => (v !== undefined && Number.isFinite(v) ? v : 0);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const alpha = (dt: number, tau: number) => 1 - Math.exp(-dt / tau);

/**
 * Drive weights. Over the live chain: a loud steady drone ≈ 0.55, whale song ≈ 0.6,
 * Rachmaninoff ≈ 0.85, a waltz ≈ 1.2, ragtime ≈ 1.35; room noise at −45 dBFS ≈ 0.02.
 */
const W_LEVEL = 0.55;
const W_FLUX = 0.6;
const W_ONSET = 0.9;
/** Onset density memory (s), and the weighted onsets/s at which the onset term is ~63 % in. */
const ONSET_TAU = 0.6;
const ONSET_SCALE = 3;
/** Drive smoothing (s): rise, fall. */
const RISE = 0.08;
const FALL = 0.4;
/** Poke nudge decay (s). */
const POKE_TAU = 0.25;
/** Silence descriptor at which the gate starts closing / is shut. */
const GATE_LO = 0.6;
const GATE_HI = 0.95;
/**
 * The picture counts as silent (and starts dimming) from GATE_LO, or whenever the
 * clock has all but stopped (drive < STILL): steady room noise above the silence
 * threshold freezes the picture without driving it, so it dims as well.
 */
const STILL = 0.01;
/** Dimming: hold full brightness for DIM_HOLD s of silence, then fade to DIM_FLOOR by DIM_END. */
const DIM_HOLD = 1;
const DIM_END = 4.5;
/** Recovery time constant (s) when sound returns. */
const DIM_RISE = 0.07;

export class MusicClock {
  /** Seconds of music time. */
  time = 0;
  /** Current rate (music seconds per wall second); exactly 0 in silence. */
  drive = 0;
  /** Wall seconds since the sound stopped (0 while there is sound). */
  silentFor = 0;
  /** 1 = full brightness … DIM_FLOOR in long silence. */
  dim = 1;
  /** Smoothed, ungated activity. */
  private activity = 0;
  /** Leaky sum of onset strengths (weighted onsets per second). */
  private onsets = 0;
  private poke = 0;

  /** Advances by one frame of `dt` wall seconds; returns the music-time delta. */
  advance(input: ClockInput, dt: number): number {
    if (!(dt > 0)) return 0;
    dt = Math.min(dt, 0.25);
    const level = clamp01(fin(input.level));
    const silence = Number.isFinite(input.silence) ? clamp01(input.silence) : 1;
    const poke = clamp01(fin(input.poke));

    // Onsets are impulses into a leaky integrator, so the drive doesn't depend on frame rate.
    this.onsets *= Math.exp(-dt / ONSET_TAU);
    this.onsets += clamp01(fin(input.onset)) / ONSET_TAU;
    // Flux and onsets only count over a real signal: room-noise flicker is not music.
    const body = smoothstep(0.05, 0.3, level);
    const target =
      W_LEVEL * smoothstep(0.1, 0.9, level) +
      body * (W_FLUX * clamp01(fin(input.flux)) + W_ONSET * (1 - Math.exp(-this.onsets / ONSET_SCALE)));
    this.activity += alpha(dt, target > this.activity ? RISE : FALL) * (target - this.activity);
    if (target === 0 && this.activity < 1e-4) this.activity = 0;

    this.poke = Math.max(this.poke * Math.exp(-dt / POKE_TAU), poke);
    if (this.poke < 1e-4) this.poke = 0;
    const gate = 1 - smoothstep(GATE_LO, GATE_HI, silence);
    this.drive = this.activity * gate + this.poke;

    // Dimming runs on wall time: it is about the silence, not the music. A poke wakes it.
    const silent = (silence >= GATE_LO || this.drive < STILL) && poke === 0;
    this.silentFor = silent ? this.silentFor + dt : 0;
    const dimTarget = 1 - (1 - DIM_FLOOR) * smoothstep(DIM_HOLD, DIM_END, this.silentFor);
    if (dimTarget < this.dim) this.dim = dimTarget;
    else {
      this.dim += alpha(dt, DIM_RISE) * (dimTarget - this.dim);
      if (this.dim > 0.999) this.dim = 1;
    }

    const dm = this.drive * dt;
    this.time += dm;
    return dm;
  }

  reset(): void {
    this.time = 0;
    this.drive = 0;
    this.silentFor = 0;
    this.dim = 1;
    this.activity = 0;
    this.onsets = 0;
    this.poke = 0;
  }
}
