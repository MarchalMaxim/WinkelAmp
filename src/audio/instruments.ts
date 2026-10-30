/**
 * Building blocks for the character studies (src/audio/studies.ts): a seeded
 * random generator, a physically-flavoured piano synthesizer (pure DSP, also
 * used by the Node reference renderer in scripts/reference), and a handful of
 * small Web Audio voices.
 *
 * Nothing here touches the DOM at import time, so Node can import the DSP.
 */

export const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Small, fast, seeded PRNG: renders and tests must be reproducible. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Rng = () => number;

const NOTE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'C#4' → 61, 'Bb0' → 22. Scores stay readable this way. */
export function note(name: string): number {
  const m = /^([A-G])(#|b|##|bb)?(-?\d)$/.exec(name.trim());
  if (!m) throw new Error(`bad note ${name}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : m[2] === '##' ? 2 : m[2] === 'bb' ? -2 : 0;
  return 12 * (Number(m[3]) + 1) + NOTE_PC[m[1]] + acc;
}

// ---------------------------------------------------------------------------
// Piano
// ---------------------------------------------------------------------------

/** Railsback-style stretch: real pianos are tuned flat in the bass and sharp in the treble. */
export function pianoFreq(midi: number) {
  const cents = 0.00035 * (midi - 60) ** 3;
  return mtof(midi) * 2 ** (cents / 1200);
}

/** String inharmonicity coefficient B (f_n = n·f0·√(1+B·n²)): lowest mid-bass, rising steeply in the treble. */
export function inharmonicityB(midi: number) {
  const pts: [number, number][] = [[21, -3.55], [40, -3.85], [60, -3.4], [84, -2.6], [108, -1.8]];
  let lg = pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [m0, l0] = pts[i];
    const [m1, l1] = pts[i + 1];
    if (midi <= m1) {
      lg = l0 + ((clamp(midi, m0, m1) - m0) / (m1 - m0)) * (l1 - l0);
      break;
    }
  }
  return 10 ** lg;
}

export interface PianoOpts {
  /** Length of the rendered note in seconds (its natural ring, before any damper). */
  dur?: number;
  /** Multiplies the inharmonicity: >1 makes the bass more bell-like. */
  inharmonicity?: number;
  /** Multiplies the hammer brightness (cutoff). */
  brightness?: number;
  seed?: number;
}

/** Natural ring length we render, by pitch: bass strings sing for a long time. */
export const pianoRing = (midi: number) => clamp(10 - (midi - 21) * 0.11, 1.6, 10);

/**
 * One piano note, mono, at full natural decay (apply dampers yourself).
 * Additive synthesis of stretched partials; each partial is two slightly
 * detuned unison strings, one with a fast "prompt" decay and one with a slow
 * "aftersound" decay, which yields the piano's double decay and its beating.
 * Velocity sets loudness AND hammer brightness (soft notes are dark, fff is
 * clangorous). Uses damped phasor recurrences instead of Math.sin per sample.
 */
export function pianoNote(sampleRate: number, midi: number, vel: number, o: PianoOpts = {}): Float32Array {
  const v = clamp(vel, 0.03, 1);
  const dur = o.dur ?? pianoRing(midi);
  const n = Math.max(1, Math.ceil(dur * sampleRate));
  const out = new Float32Array(n);
  const acc = new Float64Array(n);
  const rng = mulberry32(o.seed ?? midi * 7919 + Math.round(v * 1000));
  const f0 = pianoFreq(midi);
  const B = inharmonicityB(midi) * (o.inharmonicity ?? 1);
  // Hammer contact acts like a low-pass on the string's excitation; harder blows are shorter and brighter.
  const fc = (260 + 5600 * v ** 2.2) * (1 + f0 / 700) * (o.brightness ?? 1);
  const strike = 0.118 + rng() * 0.01; // hammer at ~1/8.5 of the string: weak 8th/17th partials
  // Aftersound T60: ~30 s at A0, ~5 s at C4, under a second at C8.
  const t60 = 30 * 2 ** (-(midi - 21) / 16);
  const maxF = Math.min(sampleRate * 0.45, 14000);

  const partials: { f: number; a: number }[] = [];
  let norm = 0;
  for (let k = 1; k <= 72; k++) {
    const f = k * f0 * Math.sqrt(1 + B * k * k);
    if (f > maxF) break;
    const hammer = 1 / (1 + (f / fc) ** 2);
    const comb = Math.abs(Math.sin(Math.PI * k * strike)) + 0.04;
    const radiation = (f / (f + 85)) ** 1.6; // the soundboard barely radiates the lowest fundamentals
    const a = (comb * hammer * radiation) / k ** 0.55;
    partials.push({ f, a });
    norm += a * a;
  }
  // Equal-ish loudness across the keyboard, then velocity → level (≈ 36 dB from pp to fff).
  const level = (0.2 / Math.sqrt(norm || 1)) * v ** 1.35;
  const floor = 1e-5;

  for (const { f, a } of partials) {
    const hf = 1 + (f / 1100) ** 1.45; // high partials die quickly
    const tauSlow = t60 / 6.91 / hf;
    const tauFast = tauSlow * 0.22;
    const strings: [number, number, number][] = [
      // [relative amplitude, decay tau, detune ratio]
      [0.72, tauFast, 1],
      [0.28, tauSlow, 1 + (rng() - 0.5) * 0.0011],
    ];
    for (const [w, tau, det] of strings) {
      const amp = a * level * w;
      if (amp < floor) continue;
      const len = Math.min(n, Math.ceil(tau * Math.log(amp / floor) * sampleRate));
      const omega = (2 * Math.PI * f * det) / sampleRate;
      const r = Math.exp(-1 / (tau * sampleRate));
      const cr = Math.cos(omega) * r;
      const sr = Math.sin(omega) * r;
      const ph = rng() * 2 * Math.PI;
      let x = amp * Math.cos(ph);
      let y = amp * Math.sin(ph);
      for (let i = 0; i < len; i++) {
        acc[i] += y;
        const nx = x * cr - y * sr;
        y = x * sr + y * cr;
        x = nx;
      }
    }
  }

  // Hammer: a felt "knock" (band-limited noise, brighter when harder) plus a low soundboard thump.
  const knockLen = Math.floor(sampleRate * (0.012 + 0.03 * (1 - (midi - 21) / 87)));
  const lpA = Math.exp((-2 * Math.PI * (900 + 5000 * v * v)) / sampleRate);
  const hpA = Math.exp((-2 * Math.PI * 180) / sampleRate);
  let lp = 0, hpIn = 0, hpOut = 0;
  const knockAmp = level * Math.sqrt(norm) * 0.55 * v ** 0.8;
  for (let i = 0; i < knockLen; i++) {
    const e = Math.exp(-i / (knockLen * 0.25));
    lp = lp * lpA + (rng() * 2 - 1) * (1 - lpA);
    hpOut = hpA * (hpOut + lp - hpIn);
    hpIn = lp;
    acc[i] += hpOut * e * knockAmp * 1.8;
  }
  const thumpF = 62 + rng() * 25;
  const thumpLen = Math.floor(sampleRate * 0.25);
  const thumpAmp = level * Math.sqrt(norm) * 0.35 * v ** 1.5;
  for (let i = 0; i < thumpLen && i < n; i++) {
    acc[i] += Math.sin((2 * Math.PI * thumpF * i) / sampleRate) * Math.exp(-i / (sampleRate * 0.045)) * thumpAmp;
  }

  // A few ms of attack (slower when soft) kills the click of starting every partial at full height.
  const att = Math.floor(sampleRate * (0.0015 + 0.004 * (1 - v)));
  for (let i = 0; i < n; i++) {
    const g = i < att ? 0.5 - 0.5 * Math.cos((Math.PI * i) / att) : 1;
    out[i] = acc[i] * g;
  }
  // Fade the last 30 ms so the buffer never ends in a step.
  const fade = Math.min(n, Math.floor(sampleRate * 0.03));
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  return out;
}

/** How fast the dampers silence a note once released (bass strings are heavier and keep ringing a bit). */
export const damperTau = (midi: number) => (midi >= 89 ? Infinity : clamp(0.32 - (midi - 21) * 0.0042, 0.04, 0.32));

// ---------------------------------------------------------------------------
// Web Audio rig: master chain, reverb, sessions
// ---------------------------------------------------------------------------

/** Stereo reverb impulse: decaying noise that also darkens as it decays, like a real hall. */
export function makeImpulse(ctx: BaseAudioContext, seconds: number, seed: number, brightness = 0.5) {
  const sr = ctx.sampleRate;
  const len = Math.floor(seconds * sr);
  const buf = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const rng = mulberry32(seed * 31 + c);
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp((-6.9 * t) / seconds) * Math.min(1, t / 0.006);
      const cutoff = (1500 + 9000 * brightness) * Math.exp(-t * 1.6) + 250;
      const a = Math.exp((-2 * Math.PI * cutoff) / sr);
      lp = lp * a + (rng() * 2 - 1) * (1 - a);
      d[i] = lp * env;
    }
    // Unit energy: the wet level then means the same thing whatever the length.
    let e = 0;
    for (let i = 0; i < len; i++) e += d[i] * d[i];
    const k = 1 / Math.sqrt(e || 1);
    for (let i = 0; i < len; i++) d[i] *= k;
  }
  return buf;
}

export interface RigOpts {
  reverbSeconds: number;
  reverbBrightness?: number;
  /** Level of the reverb return. */
  wet: number;
  /** Output trim (studies are deliberately not loudness-normalized: quiet pieces stay quiet). */
  gain: number;
  seed?: number;
}

/** Where a voice sends its sound: the dry bus and the reverb send. */
export interface Out {
  dry: AudioNode;
  wet: AudioNode;
}

/**
 * Master chain for one study:
 *   voices ─► session ─► dry ─► gate ────────────┐
 *                    └─► wet ─► convolver ─► ret ─┴─► trim ─► gentle glue ─► peak limiter ─► soft-clip ceiling ─► destination
 * Gentle on purpose (2:1 glue, limiter only on peaks) so absolute loudness,
 * swells and accents survive: the character engine measures them. The waveshaper is a
 * transparent-below-0.7 ceiling, so nothing ever hard clips.
 */
export class Rig {
  readonly noise: AudioBuffer;
  private mix: GainNode;
  /** The impulse is costly to make, so it is shared; each session gets its own convolver (see session()). */
  private impulse: AudioBuffer;
  private wet: number;

  constructor(readonly ctx: BaseAudioContext, destination: AudioNode, o: RigOpts) {
    this.mix = ctx.createGain();
    this.impulse = makeImpulse(ctx, o.reverbSeconds, o.seed ?? 7, o.reverbBrightness ?? 0.5);
    this.wet = o.wet;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 24;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 2;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    const trim = ctx.createGain();
    trim.gain.value = o.gain;
    // Peak limiter (the compressor's 6 ms lookahead + 1 ms attack catches piano and pizzicato transients).
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -6;
    limit.knee.value = 0;
    limit.ratio.value = 20;
    limit.attack.value = 0.001;
    limit.release.value = 0.12;
    const ceiling = ctx.createWaveShaper();
    ceiling.curve = softClipCurve();
    this.mix.connect(hp).connect(trim).connect(comp).connect(limit).connect(ceiling).connect(destination);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    const rng = mulberry32(99);
    for (let i = 0; i < d.length; i++) d[i] = rng() * 2 - 1;
  }

  /**
   * A fresh pair of buses for one play-through; closing it silences every voice
   * still ringing on it, reverb tail included (like the demo's stop()). The
   * session owns its convolver, so a quick stop → start never brings the old
   * tail back (a shared reverb + master fade did: restarting reopened the master).
   */
  session() {
    const ctx = this.ctx;
    const gate = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const verb = ctx.createConvolver();
    verb.normalize = false;
    verb.buffer = this.impulse;
    const ret = ctx.createGain();
    ret.gain.value = this.wet;
    dry.connect(gate).connect(this.mix);
    wet.connect(verb).connect(ret).connect(this.mix);
    return {
      out: { dry, wet } as Out,
      close: (fade = 0.3) => {
        const t = ctx.currentTime;
        for (const g of [gate, ret]) {
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(g.gain.value, t);
          g.gain.linearRampToValueAtTime(0, t + fade);
        }
        setTimeout(() => {
          gate.disconnect();
          ret.disconnect();
          wet.disconnect();
        }, (fade + 0.1) * 1000);
      },
    };
  }
}

function softClipCurve() {
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const ax = Math.abs(x);
    // Linear to 0.7, then a tanh knee that approaches 0.98.
    const y = ax <= 0.7 ? ax : 0.7 + 0.28 * Math.tanh((ax - 0.7) / 0.28);
    c[i] = Math.sign(x) * y;
  }
  return c;
}

/**
 * Route a voice through a panner into dry and (scaled) reverb send. Pass the
 * voice's last-ending source as `until` and the chain is unplugged when it ends,
 * so finished voices leave the graph at once instead of waiting for GC.
 */
export function route(ctx: BaseAudioContext, node: AudioNode, out: Out, pan: number, wet: number, until?: AudioScheduledSourceNode) {
  const p = ctx.createStereoPanner();
  if (until) until.onended = () => p.disconnect();
  p.pan.value = clamp(pan, -1, 1);
  node.connect(p);
  p.connect(out.dry);
  if (wet > 0) {
    const s = ctx.createGain();
    s.gain.value = wet;
    p.connect(s).connect(out.wet);
  }
  return p;
}

/** Pitch → stereo position, like sitting in front of the instrument (low left, high right). */
export const pitchPan = (midi: number, width = 0.6) => clamp(((midi - 64) / 30) * width, -width, width);

/** Exponential-ish envelope with an attack and a decay, safe for exponential ramps. */
export function envelope(p: AudioParam, t: number, peak: number, attack: number, decay: number) {
  p.setValueAtTime(0.0001, t);
  p.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  p.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

// ---------------------------------------------------------------------------
// Piano bank: synthesized notes cached as AudioBuffers
// ---------------------------------------------------------------------------

// Velocity layers: brightness is baked into each; in-between velocities scale the nearest layer's gain.
const LAYERS = [0.14, 0.3, 0.55, 0.8, 1];

/**
 * Plays pianoNote() renders. Synthesis is costly (~10–60 ms per note) but
 * happens once per pitch × velocity layer; playback is a single buffer source.
 * Call prepare() ahead of time when playing live.
 */
export class PianoBank {
  private cache = new Map<string, AudioBuffer>();

  /** `sampleRate` may be lower than the context's (the source resamples): it halves the memory and synthesis time. */
  constructor(private ctx: BaseAudioContext, private o: { inharmonicity?: number; ringScale?: number; sampleRate?: number } = {}) {}

  private layer(vel: number) {
    let best = LAYERS[0];
    for (const l of LAYERS) if (Math.abs(l - vel) < Math.abs(best - vel)) best = l;
    return best;
  }

  prepare(midi: number, vel: number) {
    const v = this.layer(vel);
    const key = `${midi}:${v}`;
    let buf = this.cache.get(key);
    if (!buf) {
      const sr = this.o.sampleRate ?? this.ctx.sampleRate;
      const data = pianoNote(sr, midi, v, {
        inharmonicity: this.o.inharmonicity,
        dur: pianoRing(midi) * (this.o.ringScale ?? 0.8),
      });
      buf = this.ctx.createBuffer(1, data.length, sr);
      buf.getChannelData(0).set(data);
      this.cache.set(key, buf);
    }
    // pianoNote's level goes as vel^1.35, so the in-between gain follows the same law.
    return { buf, gain: (vel / v) ** 1.35 };
  }

  has(midi: number, vel: number) {
    return this.cache.has(`${midi}:${this.layer(vel)}`);
  }

  /** Strike at `t`, release the damper after `hold` seconds. */
  play(out: Out, midi: number, vel: number, t: number, hold: number, wet = 0.35) {
    const { buf, gain } = this.prepare(midi, vel);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    const tau = damperTau(midi);
    // The rendered ring is shorter than a pedalled bass note's natural one (memory). When the
    // key or pedal holds into its last stretch, let it die away there like a slowly lifted
    // damper; stopping where the buffer runs out was an audible chop (≈ -7 dB in 100 ms).
    // A damper that fits inside the buffer always wins: short treble buffers keep their release.
    const margin = Math.min(1.8, 0.3 * buf.duration);
    const fadeAt = buf.duration - margin;
    let end = t + buf.duration;
    if (isFinite(tau)) {
      if (hold + 6 * tau <= buf.duration || hold < fadeAt) {
        g.gain.setTargetAtTime(0, t + hold, tau);
        end = Math.min(end, t + hold + tau * 6);
      } else g.gain.setTargetAtTime(0, t + fadeAt, margin / 4.7); // ≈ -41 dB by the end
    }
    src.connect(g);
    route(this.ctx, g, out, pitchPan(midi, 0.55), wet, src);
    src.start(t);
    src.stop(end + 0.01);
  }
}
