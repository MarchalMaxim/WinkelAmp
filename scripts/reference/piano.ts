/**
 * Offline piano renderer for reference recordings (Node, run through tsx).
 * Shares the synthesis with the in-browser studies (src/audio/instruments.ts),
 * adds a sustain pedal, dampers and a hall reverb. Pure DSP (no Node APIs), so tests
 * can import it; the WAV writer lives in wav.ts.
 */
import { damperTau, mulberry32, note, pianoNote, pianoRing } from '../../src/audio/instruments';

export interface PNote {
  /** Onset in seconds. */
  t: number;
  midi: number;
  /** 0..1 (fff = 1). */
  vel: number;
  /** How long the key is held, seconds. */
  hold: number;
  /** Notes struck together (one play() call) share a group. */
  group?: number;
}

/** Pedal down intervals [down, up] in seconds. */
export type Pedal = [number, number][];

/** Small score helper: bars of 4 beats at a (changeable) tempo, notes by name. */
export class Score {
  notes: PNote[] = [];
  pedal: Pedal = [];
  private beat = 0;
  private time = 0;
  private groups = 0;
  /** Ritardandos: [from, to] in nominal seconds, and how much slower the end gets. */
  private rits: [number, number, number][] = [];

  constructor(public bpm: number) {}

  /** Current position in seconds. */
  get now() {
    return this.time;
  }

  tempo(bpm: number) {
    this.bpm = bpm;
  }

  /** Seconds per `beats` at the current tempo. */
  sec(beats: number) {
    return (beats * 60) / this.bpm;
  }

  /** Play notes at offset `at` beats from now (not advancing time). */
  play(names: string | string[], vel: number, holdBeats: number, at = 0, spread = 0) {
    const list = (Array.isArray(names) ? names : names.split(/\s+/)).filter(Boolean);
    // Spread: the hands are never perfectly together; low notes slightly first.
    const group = this.groups++;
    list.forEach((n, i) => {
      this.notes.push({
        t: this.time + this.sec(at) + i * spread,
        midi: note(n),
        vel,
        hold: this.sec(holdBeats),
        group,
      });
    });
    return this;
  }

  /** Broaden the next `beats` (the end ends up `amount` × slower), as at the end of a phrase. */
  rit(beats: number, amount = 0.35) {
    this.rits.push([this.time, this.time + this.sec(beats), amount]);
    return this;
  }

  /**
   * Turn the quantized score into a performance: slow rubato (the tempo breathes
   * by about ±7 %), the ritardandos, the hands never quite together (±15 ms per
   * chord), velocities that vary a little, and the top of each chord voiced
   * out. A metronomic Lento sounds (and analyses) like a machine.
   */
  humanize(seed = 1) {
    const rng = mulberry32(seed);
    const ph = [rng(), rng(), rng()].map((x) => x * 2 * Math.PI);
    const rate = (t: number) => {
      let r = 1 + 0.045 * Math.sin((2 * Math.PI * t) / 9.1 + ph[0]) + 0.03 * Math.sin((2 * Math.PI * t) / 4.3 + ph[1]);
      for (const [a, b, amt] of this.rits) if (t > a && t < b) r += amt * ((t - a) / (b - a)) ** 2;
      return r;
    };
    // Performed time = ∫ rate dt, tabulated every 10 ms.
    const end = Math.max(...this.notes.map((n) => n.t + n.hold), ...this.pedal.map((p) => p[1])) + 1;
    const step = 0.01;
    const table = new Float64Array(Math.ceil(end / step) + 2);
    for (let i = 1; i < table.length; i++) table[i] = table[i - 1] + rate((i - 0.5) * step) * step;
    const warp = (t: number) => {
      const x = Math.max(0, t / step);
      const i = Math.min(table.length - 2, Math.floor(x));
      return table[i] + (table[i + 1] - table[i]) * (x - i);
    };
    const jitter = new Map<number, number>();
    const top = new Map<number, number>();
    for (const n of this.notes) top.set(n.group ?? -1, Math.max(top.get(n.group ?? -1) ?? 0, n.midi));
    for (const n of this.notes) {
      const g = n.group ?? -1;
      if (!jitter.has(g)) jitter.set(g, (rng() - 0.5) * 0.03);
      const t0 = warp(n.t) + jitter.get(g)!;
      const t1 = warp(n.t + n.hold);
      const voiced = n.midi === top.get(g) && this.notes.filter((m) => m.group === g).length >= 3 ? 1.08 : 1;
      n.t = Math.max(0, t0);
      n.hold = Math.max(0.05, t1 - t0);
      n.vel = Math.min(1, n.vel * voiced * (0.95 + rng() * 0.1));
    }
    this.pedal = this.pedal.map(([a, b]) => [warp(a), warp(b)]);
    return this;
  }

  /** Advance time by beats. */
  wait(beats: number) {
    this.time += this.sec(beats);
    this.beat += beats;
    return this;
  }

  /** Pedal down from now+at for `beats` (with a short gap before the next change). */
  ped(beats: number, at = 0) {
    const a = this.time + this.sec(at) + 0.02;
    this.pedal.push([a, a + this.sec(beats) - 0.06]);
    return this;
  }
}

function pedalUpAfter(pedal: Pedal, t: number) {
  for (const [d, u] of pedal) if (t >= d && t < u) return u;
  return t;
}

/** Freeverb-style stereo reverb (Schroeder–Moorer: 8 damped combs + 4 allpasses per side). */
function reverb(L: Float32Array, R: Float32Array, sr: number, room = 0.86, damp = 0.35, wet = 0.22) {
  const k = sr / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const aps = [556, 441, 341, 225];
  const n = L.length;
  const outs = [new Float32Array(n), new Float32Array(n)];
  const input = new Float32Array(n);
  for (let i = 0; i < n; i++) input[i] = (L[i] + R[i]) * 0.5;
  for (let ch = 0; ch < 2; ch++) {
    const spread = ch * 23;
    const y = outs[ch];
    for (const c of combs) {
      const len = Math.round((c + spread) * k);
      const buf = new Float32Array(len);
      let idx = 0, store = 0;
      for (let i = 0; i < n; i++) {
        const o = buf[idx];
        store = o * (1 - damp) + store * damp;
        buf[idx] = input[i] * 0.015 + store * room;
        if (++idx >= len) idx = 0;
        y[i] += o;
      }
    }
    for (const a of aps) {
      const len = Math.round((a + spread) * k);
      const buf = new Float32Array(len);
      let idx = 0;
      for (let i = 0; i < n; i++) {
        const b = buf[idx];
        const x = y[i];
        y[i] = b - x;
        buf[idx] = x + b * 0.5;
        if (++idx >= len) idx = 0;
      }
    }
  }
  for (let i = 0; i < n; i++) {
    L[i] += outs[0][i] * wet;
    R[i] += outs[1][i] * wet;
  }
}

/**
 * Mix the score. The file lasts until the last note has died away (released by
 * its damper, or faded where its rendered ring runs out) plus `tail` seconds of
 * hall, then fades over its final second: sizing it from the last onset cut
 * Op. 3 No. 2's final fff chord off mid-ring (-37 dBFS in the last 0.5 s).
 */
export function render(score: Score, sr = 44100, tail = 3, opts: { inharmonicity?: number } = {}) {
  const cache = new Map<string, Float32Array>();
  const plan = score.notes.map((nt) => {
    const v = Math.round(nt.vel * 50) / 50;
    const key = `${nt.midi}:${v}`;
    let data = cache.get(key);
    if (!data) {
      data = pianoNote(sr, nt.midi, v, { dur: pianoRing(nt.midi) * 1.2, inharmonicity: opts.inharmonicity });
      cache.set(key, data);
    }
    const release = pedalUpAfter(score.pedal, nt.t + nt.hold);
    const damper = damperTau(nt.midi);
    // A key or pedal held into the last stretch of the rendered ring: die away there instead of
    // stopping dead. A damper that fits inside the buffer always wins.
    const margin = Math.min(1.8, (0.3 * data.length) / sr);
    const fadeI = data.length - Math.round(margin * sr);
    let relI = Math.round((release - nt.t) * sr);
    let tau = damper;
    if (isFinite(damper) && relI + 6 * damper * sr > data.length && relI >= fadeI) {
      relI = fadeI;
      tau = margin / 4.7;
    }
    const endI = isFinite(tau) ? Math.min(data.length, relI + Math.round(tau * 9.3 * sr)) : data.length;
    return { nt, data, relI, tau, endT: nt.t + endI / sr };
  });
  const end = Math.max(...plan.map((p) => p.endT)) + tail;
  const len = Math.ceil(end * sr);
  const L = new Float32Array(len);
  const R = new Float32Array(len);
  for (const { nt, data, relI, tau } of plan) {
    const pan = Math.max(-0.6, Math.min(0.6, (nt.midi - 64) / 40));
    const gl = Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = Math.sin(((pan + 1) * Math.PI) / 4);
    const start = Math.round(nt.t * sr);
    const kDamp = isFinite(tau) ? Math.exp(-1 / (tau * sr)) : 1;
    let g = 1;
    for (let i = 0; i < data.length && start + i < len; i++) {
      if (i > relI) {
        g *= kDamp;
        if (g < 1e-4) break;
      }
      const s = data[i] * g;
      L[start + i] += s * gl;
      R[start + i] += s * gr;
    }
  }
  reverb(L, R, sr);
  const fade = Math.min(len, sr);
  for (let i = 0; i < fade; i++) {
    const k = 0.5 - 0.5 * Math.cos((Math.PI * i) / fade);
    L[len - 1 - i] *= k;
    R[len - 1 - i] *= k;
  }
  return { L, R, sr };
}

/**
 * Light mastering, like a commercial recording: make-up gain toward a target
 * RMS (at most `maxGainDb` of peak limiting), then a 5 ms lookahead peak
 * limiter to `ceilingDb`. Without it a piano's ~25 dB crest factor leaves the
 * file far quieter than real recordings, and the engine's absolute loudness
 * would misjudge it. Returns the largest gain reduction applied, in dB.
 */
export function master(L: Float32Array, R: Float32Array, sr: number, targetRmsDb = -21, ceilingDb = -1, maxGainDb = 10) {
  const n = L.length;
  let peak = 0, sum = 0;
  for (let i = 0; i < n; i++) {
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    sum += L[i] * L[i] + R[i] * R[i];
  }
  const rmsDb = 10 * Math.log10(sum / (2 * n));
  const ceil = 10 ** (ceilingDb / 20);
  const peakGainDb = 20 * Math.log10(ceil / peak);
  const gain = 10 ** (Math.min(targetRmsDb - rmsDb, peakGainDb + maxGainDb) / 20);
  // Desired gain per sample, then a sliding minimum over the lookahead window (monotonic deque),
  // then instant attack / smooth release.
  const look = Math.round(sr * 0.005);
  const want = new Float32Array(n);
  for (let i = 0; i < n; i++) want[i] = Math.min(1, ceil / (Math.max(Math.abs(L[i]), Math.abs(R[i])) * gain + 1e-12));
  const dq = new Int32Array(n);
  let head = 0, tail = 0;
  const rel = Math.exp(-1 / (sr * 0.12));
  let g = 1, worst = 1;
  for (let i = 0; i < n + look; i++) {
    if (i < n) {
      while (tail > head && want[dq[tail - 1]] >= want[i]) tail--;
      dq[tail++] = i;
    }
    const j = i - look;
    if (j < 0) continue;
    while (dq[head] < j) head++;
    const target = want[dq[head]];
    g = target < g ? target : target - (target - g) * rel;
    worst = Math.min(worst, g);
    L[j] *= gain * g;
    R[j] *= gain * g;
  }
  return { makeupDb: 20 * Math.log10(gain), maxReductionDb: -20 * Math.log10(worst) };
}
