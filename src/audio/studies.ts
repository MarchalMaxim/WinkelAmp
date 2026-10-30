/**
 * Character studies: four short original pieces, synthesized live, each
 * composed to embody one character of the engine (docs/CHARACTER-PLAN.md) so
 * you can hear-and-see the difference side by side.
 *
 *   Ember        fire   erratic tremolo, ricochet flickers, chromatic, crackle
 *   Basalt       abyss  massive low piano chords and tolling octaves, D minor
 *   Sugar Glass  sugar  celesta & music box, pizzicato, quick runs, grace notes
 *   Mist         mist   slow legato pads, airy, consonant
 *
 * A score is plain data (`compose(seed)` → events), so it can be tested
 * without Web Audio and reproduced exactly. One scheduler plays it: live with a
 * lookahead timer (like the demo groove), or all at once into an
 * OfflineAudioContext (scripts/render-studies.mjs). Live, each loop is
 * re-composed with a new seed so repeats are never identical.
 */
import type { ArchetypeId } from '../character/types';
import {
  envelope,
  mtof,
  mulberry32,
  note,
  PianoBank,
  pitchPan,
  Rig,
  route,
  type Out,
  type RigOpts,
  type Rng,
} from './instruments';

/** What the engine needs from anything it plays like the demo (DemoGroove fits this too). */
export interface Playable {
  start(): void;
  stop(): void;
  readonly playing: boolean;
  /** Seconds played since start(). */
  readonly position: number;
  readonly title: string;
}

/** One sound of a score. `v` is the voice, `m` a MIDI pitch, `d` its length in seconds, `x` a voice-specific extra. */
export interface Ev {
  t: number;
  v: string;
  m: number;
  vel: number;
  d: number;
  x?: number;
}

export interface StudyScore {
  /** Loop length in seconds (includes the breath before the next loop). */
  length: number;
  /** Sorted by t. */
  events: Ev[];
}

export interface StudyPlayer extends Playable {
  /** Length of one pass through the piece, seconds. */
  readonly duration: number;
}

export interface Study {
  id: 'ember' | 'basalt' | 'sugar' | 'mist';
  title: string;
  /** One line about the character it embodies. */
  blurb: string;
  /** The archetype the engine should recognise. */
  archetype: ArchetypeId;
  compose(seed: number): StudyScore;
  create(ctx: BaseAudioContext, destination: AudioNode): StudyPlayer;
}

const LOOKAHEAD = 0.25;
const HIDDEN_LOOKAHEAD = 1.6;
const OFFLINE_CHUNK = 1;

// ---------------------------------------------------------------------------
// Composition helpers
// ---------------------------------------------------------------------------

const pcsOf = (names: string) => names.split(/\s+/).map((n) => ((note(`${n}4`) % 12) + 12) % 12);

/** Smooth voice-leading: every voice moves to the nearest chord tone, then gaps in the chord are filled. */
function lead(prev: number[], pcs: number[], lo: number, hi: number) {
  const pool: number[] = [];
  for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12)) pool.push(m);
  const used = new Set<number>();
  const next = prev.map((p) => {
    let best = pool[0];
    for (const m of pool) if (!used.has(m) && Math.abs(m - p) < Math.abs(best - p)) best = m;
    used.add(best);
    return best;
  });
  // Make sure the chord's colour is present: swap a doubled pitch class for a missing one.
  for (const pc of pcs) {
    if (next.some((m) => m % 12 === pc)) continue;
    const counts = new Map<number, number>();
    for (const m of next) counts.set(m % 12, (counts.get(m % 12) ?? 0) + 1);
    const i = next.findIndex((m) => (counts.get(m % 12) ?? 0) > 1);
    if (i < 0) break;
    const cands = pool.filter((m) => m % 12 === pc && !next.includes(m));
    if (!cands.length) continue;
    next[i] = cands.reduce((a, b) => (Math.abs(b - next[i]) < Math.abs(a - next[i]) ? b : a));
  }
  return next.sort((a, b) => a - b);
}

function poisson(rng: Rng, rate: number, from: number, to: number) {
  const out: number[] = [];
  let t = from;
  for (;;) {
    t += -Math.log(1 - rng()) / Math.max(rate, 1e-6);
    if (t >= to) return out;
    out.push(t);
  }
}

const finish = (events: Ev[], length: number): StudyScore => ({
  length,
  events: events.filter((e) => e.t < length).sort((a, b) => a.t - b.t),
});

// ---------------------------------------------------------------------------
// The scheduler shared by all studies
// ---------------------------------------------------------------------------

abstract class ScorePlayer implements StudyPlayer {
  protected rig: Rig;
  protected out: Out | null = null;
  private session: ReturnType<Rig['session']> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private offline = false;
  private startedAt = 0;
  private loopStart = 0;
  private loop = 0;
  private idx = 0;
  private cur: StudyScore;
  private next: StudyScore;
  private prep = [0, 0];
  private warned = false;

  constructor(
    protected ctx: BaseAudioContext,
    destination: AudioNode,
    rig: RigOpts,
    readonly title: string,
    private compose: (seed: number) => StudyScore,
    private seed: number,
  ) {
    this.rig = new Rig(ctx, destination, rig);
    this.cur = compose(seed);
    this.next = compose(seed + 101);
  }

  get duration() {
    return this.cur.length;
  }

  get playing() {
    return this.timer !== null || this.offline;
  }

  get position() {
    return this.playing ? Math.max(0, this.ctx.currentTime - this.startedAt) : 0;
  }

  protected abstract play(ev: Ev, t: number, out: Out): void;
  /** Expensive per-event preparation (piano synthesis), done ahead of time when live. */
  protected prepare(_ev: Ev) {}
  /** Build per-play-through shared nodes (called on every start, on the fresh session). */
  protected setup(_out: Out) {}
  /** Stop anything setup() started that would otherwise run forever. */
  protected teardown() {}

  start() {
    if (this.playing) return;
    this.session = this.rig.session();
    this.out = this.session.out;
    this.loop = 0;
    this.cur = this.compose(this.seed);
    this.next = this.compose(this.seed + 101);
    this.idx = 0;
    this.prep = [0, 0];
    const t0 = this.ctx.currentTime + 0.1;
    this.startedAt = this.loopStart = t0;
    this.setup(this.out);
    if ('startRendering' in this.ctx) {
      // Offline render: no timers. Schedule in chunks at suspend points, so only the
      // nodes a live performance would hold exist at once (and rendering costs what live costs).
      this.offline = true;
      const ctx = this.ctx as OfflineAudioContext;
      const end = ctx.length / ctx.sampleRate;
      this.pump(OFFLINE_CHUNK + LOOKAHEAD);
      for (let s = OFFLINE_CHUNK; s < end - 0.01; s += OFFLINE_CHUNK) {
        void ctx.suspend(s).then(() => {
          try {
            this.pump(s + OFFLINE_CHUNK + LOOKAHEAD);
          } finally {
            void ctx.resume(); // never leave a render suspended forever
          }
        });
      }
      return;
    }
    this.warm(t0 + 3, Infinity);
    this.timer = setInterval(() => this.tick(), 40);
    this.tick();
  }

  stop() {
    if (!this.playing) return;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.offline = false;
    this.teardown();
    this.session?.close();
    this.session = null;
    this.out = null;
  }

  private tick() {
    // Hidden tabs fire timers about once a second: look further ahead there, or the music
    // stutters. stop() stays instant either way (the session gate fades what is queued).
    const hidden = typeof document !== 'undefined' && document.hidden;
    this.pump(this.ctx.currentTime + (hidden ? HIDDEN_LOOKAHEAD : LOOKAHEAD));
    this.warm(this.ctx.currentTime + 8, 12);
  }

  private pump(until: number) {
    const out = this.out;
    if (!out) return;
    for (;;) {
      if (this.idx >= this.cur.events.length) {
        this.loopStart += this.cur.length;
        this.loop++;
        this.cur = this.next;
        this.next = this.compose(this.seed + 101 * (this.loop + 1));
        this.idx = 0;
        this.prep = [this.prep[1], 0];
        if (!this.cur.events.length) return;
      }
      const ev = this.cur.events[this.idx];
      const t = this.loopStart + ev.t;
      if (t >= until) return;
      this.idx++;
      try {
        this.play(ev, Math.max(t, this.ctx.currentTime), out);
      } catch (e) {
        // One bad note must not stop the music.
        if (!this.warned) console.warn(`${this.title}: ${ev.v} failed`, e);
        this.warned = true;
      }
    }
  }

  /** Prepare events up to `horizon` within a time budget (ms), across the loop seam. */
  private warm(horizon: number, budgetMs: number) {
    const t0 = performance.now();
    const passes: [StudyScore, number][] = [
      [this.cur, this.loopStart],
      [this.next, this.loopStart + this.cur.length],
    ];
    for (let p = 0; p < 2; p++) {
      const [score, offset] = passes[p];
      while (this.prep[p] < score.events.length) {
        const ev = score.events[this.prep[p]];
        if (offset + ev.t > horizon) return;
        this.prepare(ev);
        this.prep[p]++;
        if (performance.now() - t0 > budgetMs) return;
      }
    }
  }

  /** A looping noise source for this voice (offset randomised so layers never phase). */
  protected noiseSrc(t: number, end: number, rng = Math.random) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.rig.noise;
    src.loop = true;
    src.start(t, rng() * 1.5);
    if (isFinite(end)) src.stop(end);
    return src;
  }
}

// ---------------------------------------------------------------------------
// 1. Ember — fire
// ---------------------------------------------------------------------------

/** [chord, bass, seconds, intensity 0..1] — D minor, with a chromatic climb to the climax. */
const EMBER_PLAN: [string, string, number, number][] = [
  ['D F A', 'D2', 4.6, 0.25],
  ['Eb G Bb', 'Eb2', 3.1, 0.35],
  ['C# E G Bb', 'C#2', 3.9, 0.45],
  ['D F A', 'D2', 6.4, 0.3],
  ['D F A', 'D2', 3.8, 0.42],
  ['Bb D F#', 'Bb1', 3.6, 0.48],
  ['G Bb D', 'G1', 3.4, 0.5],
  ['A C# E G Bb', 'A1', 4.2, 0.62],
  ['D F A', 'D2', 4.0, 0.5],
  ['F Ab C', 'F2', 2.4, 0.7],
  ['F# A C Eb', 'F#2', 2.2, 0.75],
  ['G Bb D', 'G2', 2.2, 0.8],
  ['G# B D F', 'G#2', 2.0, 0.85],
  ['A C E', 'A2', 2.0, 0.9],
  ['Bb D F', 'Bb2', 1.9, 0.95],
  ['B D F Ab', 'B1', 1.8, 1],
  ['A C# E G Bb', 'A1', 3.2, 1],
  ['D F A', 'D2', 5.0, 0.3],
  ['D F A', 'D2', 4.5, 0.15],
  ['D F A', 'D2', 3.6, 0.06],
];

/** The violin's fiery line over bars 5–9: [note, seconds] ('r' = rest). */
const EMBER_MELODY: [string, number][] = [
  ['A4', 0.3], ['D5', 0.9], ['Eb5', 0.25], ['C#5', 0.35], ['D5', 1.1], ['r', 0.2],
  ['F5', 0.3], ['A5', 0.8], ['G#5', 0.18], ['A5', 0.2], ['Bb5', 0.9], ['A5', 0.6], ['r', 0.35],
  ['G5', 0.3], ['F5', 0.22], ['E5', 0.3], ['D5', 0.22], ['C#5', 0.5], ['D5', 1.3], ['r', 0.5],
  ['A5', 0.22], ['Bb5', 0.22], ['B5', 0.22], ['C6', 0.3], ['C#6', 1.0], ['D6', 0.5],
  ['Bb5', 0.3], ['G5', 0.3], ['E5', 0.4], ['F5', 0.25], ['D5', 1.6],
];

export function composeEmber(seed: number): StudyScore {
  const rng = mulberry32(seed);
  const ev: Ev[] = [];
  let t = 0.2;
  let violins = [69, 74, 77];
  let viola = 65;
  let melodyAt = -1;
  EMBER_PLAN.forEach(([chord, bass, dur, I], i) => {
    const pcs = pcsOf(chord);
    const end = t + dur;
    const lift = Math.round(I * 7);
    violins = lead(violins, pcs, 60 + lift, 84 + lift);
    viola = lead([viola], pcs, 60, 72)[0];
    // Shapes: 0 steady, 1 crescendo, 2 sforzando-piano-crescendo, 3 swell and fall.
    const shape = i >= 17 ? 3 : I > 0.65 ? (rng() < 0.5 ? 1 : 2) : Math.floor(rng() * 4);
    const bare = I < 0.5 && i !== 0 && rng() < 0.4;
    if (!bare) for (const m of violins) ev.push({ t, v: 'trem', m, vel: 0.12 + 0.88 * I, d: dur + 0.12, x: shape });
    if (!bare) ev.push({ t, v: 'trem', m: viola, vel: 0.12 + 0.35 * I, d: dur + 0.12, x: shape });
    ev.push({ t, v: 'crackle', m: 0, vel: 0.35 + 0.65 * (1 - Math.abs(I - 0.55)), d: dur + 0.3 });

    // Low accents: on the change when things are hot, and at random, off the grid.
    if (I > 0.4) ev.push({ t: t + rng() * 0.05, v: 'low', m: note(bass), vel: 0.5 + 0.5 * I, d: 0.9 });
    for (const a of poisson(rng, I * 0.55, t + 0.3, end - 0.2)) {
      ev.push({ t: a, v: 'low', m: note(bass) + (rng() < 0.3 ? 12 : 0), vel: 0.35 + 0.6 * I * rng(), d: 0.7 });
    }

    // Flickers: ricochet bursts at irregular (Poisson) times, rising like flames.
    for (const s of poisson(rng, 0.5 + 3.6 * I, t + 0.05, end)) {
      if (rng() < 0.18) {
        // A lone spark, very high.
        ev.push({ t: s, v: 'spic', m: 86 + Math.floor(rng() * 9), vel: 0.25 + 0.3 * rng(), d: 0.05 });
        continue;
      }
      const tones: number[] = [];
      for (let m = 67 + lift; m <= 88 + lift; m++) if (pcs.includes(m % 12)) tones.push(m);
      let m = tones[Math.floor(rng() * tones.length * 0.6)];
      let dt = 0.05 + rng() * 0.035;
      let vel = 0.45 + 0.45 * I + rng() * 0.1;
      const n = 3 + Math.floor(rng() * 4 + I * 3);
      let at = s;
      const steps = [1, 2, 1, 3, -1, 2, 1, -2, 4];
      for (let k = 0; k < n; k++) {
        ev.push({ t: at, v: 'spic', m, vel, d: 0.06 + rng() * 0.04 });
        m += steps[Math.floor(rng() * steps.length)];
        at += dt * (0.8 + rng() * 0.4);
        dt *= 0.86 + rng() * 0.1; // the bow bounces faster and faster
        vel *= 0.84;
      }
    }

    // Gusts of flame in the climb.
    if (I >= 0.7 && i < 17) ev.push({ t: t + rng() * 0.4, v: 'gust', m: 0, vel: 0.4 + 0.5 * I, d: dur * (0.8 + rng() * 0.4) });
    if (i === 4) melodyAt = t + 0.1;
    if (i === 16) {
      // Climax: a tutti sforzando, then a gasp of silence before the embers.
      ev.push({ t: end - 0.45, v: 'low', m: note('D2'), vel: 1, d: 1.2 });
      for (const m of [62, 69, 74, 77, 81, 86]) ev.push({ t: end - 0.45, v: 'spic', m, vel: 0.95, d: 0.35 });
    }
    t = end + (i === 16 ? 0.5 : 0);
  });

  // The melody, pushed and pulled.
  let mt = melodyAt;
  for (const [n, d] of EMBER_MELODY) {
    const dd = d * (0.9 + rng() * 0.2);
    if (n !== 'r') ev.push({ t: mt, v: 'mel', m: note(n), vel: 0.55 + 0.35 * rng(), d: Math.min(dd * 0.8, 0.12 + dd * 0.6) });
    mt += dd;
  }
  // A last upward ricochet into the dark.
  let m = 81;
  for (let k = 0, at = t - 3.2, dt = 0.07; k < 7; k++, at += dt, dt *= 0.85) {
    ev.push({ t: at, v: 'spic', m, vel: 0.4 * 0.85 ** k, d: 0.06 });
    m += [2, 1, 3, 1, 2, 4, 3][k];
  }
  return finish(ev, t + 0.6);
}

class EmberPlayer extends ScorePlayer {
  private crackle: AudioBuffer;
  private rng = mulberry32(5);

  constructor(ctx: BaseAudioContext, dest: AudioNode, title: string, compose: (s: number) => StudyScore) {
    super(ctx, dest, { reverbSeconds: 2.2, reverbBrightness: 0.6, wet: 0.5, gain: 1.9, seed: 11 }, title, compose, 1);
    // Sparse, heavy-tailed pops: mostly tiny ticks, sometimes a loud snap.
    const sr = ctx.sampleRate;
    this.crackle = ctx.createBuffer(1, sr * 3, sr);
    const d = this.crackle.getChannelData(0);
    const r = mulberry32(77);
    for (const at of poisson(r, 38, 0, 3)) {
      const i0 = Math.floor(at * sr);
      const amp = Math.min(1, 0.08 / (r() + 0.02));
      const len = Math.floor(sr * (0.0008 + r() * 0.003));
      for (let i = 0; i < len && i0 + i < d.length; i++) d[i0 + i] += (r() * 2 - 1) * amp * Math.exp((-5 * i) / len);
    }
  }

  protected play(ev: Ev, t: number, out: Out) {
    switch (ev.v) {
      case 'trem': return this.trem(ev, t, out);
      case 'spic': return this.spic(ev, t);
      case 'low': return this.low(ev, t, out);
      case 'mel': return this.mel(ev, t, out);
      case 'gust': return this.gust(ev, t, out);
      case 'crackle': return this.crack(ev, t, out);
    }
  }

  private strings(f: number, t: number, end: number, vib: number, vibDelay = 0) {
    const ctx = this.ctx;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.3 + this.rng() * 0.8;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(f * vib, t + vibDelay + 0.15);
    lfo.connect(depth);
    const oscs = [0, 7].map((cents) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = cents;
      depth.connect(o.frequency);
      o.start(t);
      o.stop(end);
      return o;
    });
    lfo.start(t);
    lfo.stop(end);
    return oscs;
  }

  private trem(ev: Ev, t: number, out: Out) {
    const ctx = this.ctx;
    const f = mtof(ev.m);
    const end = t + ev.d;
    const oscs = this.strings(f, t, end + 0.3, 0.004);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1800 + 3500 * ev.vel;
    tone.Q.value = 0.9;
    const body = ctx.createBiquadFilter();
    body.type = 'peaking';
    body.frequency.value = 2900;
    body.gain.value = 5;
    for (const o of oscs) o.connect(tone);
    // Bow strokes at an unsteady 9–24 per second, each a different weight, and now
    // and then the flame gutters for a moment: the tremolo itself flickers. The
    // strokes are detached (deep dips between them): a smooth wall of tremolo
    // reads as a storm, not a flame.
    const strokes = ctx.createGain();
    strokes.gain.value = 0.3;
    let s = t;
    while (s < end) {
      const w = 0.45 + this.rng() * 0.55;
      strokes.gain.setTargetAtTime(w, s, 0.004);
      strokes.gain.setTargetAtTime(0.08 * w, s + 0.02, 0.016);
      s += (1 / (9 + this.rng() * 15)) * (0.6 + this.rng() * 0.8);
      if (this.rng() < 0.1) {
        const gap = 0.08 + this.rng() * 0.22;
        strokes.gain.setTargetAtTime(0.02, s, 0.015);
        s += gap;
      }
    }
    const dyn = ctx.createGain();
    const p = ev.vel * 0.05;
    const g = dyn.gain;
    g.setValueAtTime(0.0001, t);
    switch (ev.x) {
      case 1: // crescendo
        g.exponentialRampToValueAtTime(p * 0.25, t + 0.08);
        g.exponentialRampToValueAtTime(p, end - 0.1);
        break;
      case 2: // sfz, subito piano, crescendo
        g.exponentialRampToValueAtTime(p * 1.6, t + 0.02);
        g.exponentialRampToValueAtTime(p * 0.07, t + 0.3);
        g.exponentialRampToValueAtTime(p * 0.95, end - 0.1);
        break;
      case 3: // swell and fall
        g.exponentialRampToValueAtTime(p * 0.3, t + 0.1);
        g.exponentialRampToValueAtTime(p, t + ev.d * 0.4);
        g.exponentialRampToValueAtTime(p * 0.1, end - 0.1);
        break;
      default:
        g.exponentialRampToValueAtTime(p * 0.8, t + 0.12);
        g.setValueAtTime(p * 0.8, end - 0.15);
    }
    g.exponentialRampToValueAtTime(0.0001, end + 0.2);
    tone.connect(body).connect(strokes).connect(dyn);
    route(ctx, dyn, out, pitchPan(ev.m, 0.7), 0.3, oscs[0]);
  }

  /** Spiccato notes are many (~15 a second at the climax): keep each to 2 nodes and share the rest. */
  private spicBus: GainNode[] = [];
  private click: { gain: GainNode; src: AudioBufferSourceNode } | null = null;

  protected setup(out: Out) {
    const ctx = this.ctx;
    this.spicBus = [-0.8, -0.4, 0, 0.4, 0.8].map((pan) => {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 7000;
      route(ctx, lp, out, pan, 0.35);
      const g = ctx.createGain();
      g.connect(lp);
      return g;
    });
    // The bow's bite: one rosin-noise path whose gain spikes at every note.
    const src = this.noiseSrc(ctx.currentTime, Infinity, this.rng);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3500;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(bp).connect(gain);
    route(ctx, gain, out, 0.1, 0.3);
    this.click = { gain, src };
  }

  protected teardown() {
    this.click?.src.stop();
    this.click = null;
  }

  private spic(ev: Ev, t: number) {
    const ctx = this.ctx;
    const f = mtof(ev.m);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 1.01, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.02);
    const g = ctx.createGain();
    envelope(g.gain, t, ev.vel * 0.1, 0.004, ev.d);
    const pan = pitchPan(ev.m, 0.8) + (this.rng() - 0.5) * 0.5;
    o.connect(g).connect(this.spicBus[Math.max(0, Math.min(4, Math.round((pan + 0.8) / 0.4)))]);
    o.start(t);
    o.stop(t + ev.d + 0.06);
    if (this.click) {
      const c = this.click.gain.gain;
      c.setValueAtTime(0, t);
      c.linearRampToValueAtTime(ev.vel * 0.06, t + 0.001);
      c.setTargetAtTime(0, t + 0.002, 0.004);
    }
  }

  private low(ev: Ev, t: number, out: Out) {
    const ctx = this.ctx;
    const f = mtof(ev.m);
    const oscs = this.strings(f, t, t + ev.d + 0.1, 0.002);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(600 + 2200 * ev.vel, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + ev.d);
    const g = ctx.createGain();
    envelope(g.gain, t, ev.vel * 0.15, 0.012, ev.d);
    for (const o of oscs) o.connect(lp);
    lp.connect(g);
    const n = this.noiseSrc(t, t + 0.2, this.rng);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    const ng = ctx.createGain();
    envelope(ng.gain, t, ev.vel * 0.08, 0.003, 0.12);
    n.connect(bp).connect(ng).connect(g);
    route(ctx, g, out, -0.25, 0.3, oscs[0]);
  }

  private mel(ev: Ev, t: number, out: Out) {
    const ctx = this.ctx;
    const f = mtof(ev.m);
    const end = t + ev.d;
    const oscs = this.strings(f, t, end + 0.25, 0.006, 0.12);
    for (const o of oscs) {
      o.frequency.setValueAtTime(f * 0.985, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    }
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5200;
    const body = ctx.createBiquadFilter();
    body.type = 'peaking';
    body.frequency.value = 2600;
    body.gain.value = 6;
    const g = ctx.createGain();
    const p = ev.vel * 0.075;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(p * 1.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(p * 0.75, t + 0.15);
    g.gain.setValueAtTime(p * 0.75, Math.max(t + 0.16, end - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.2);
    for (const o of oscs) o.connect(lp);
    lp.connect(body).connect(g);
    route(ctx, g, out, 0.15, 0.4, oscs[0]);
  }

  private gust(ev: Ev, t: number, out: Out) {
    const ctx = this.ctx;
    const end = t + ev.d;
    const n = this.noiseSrc(t, end + 0.1, this.rng);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(350, t);
    bp.frequency.exponentialRampToValueAtTime(2800, end);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(ev.vel * 0.07, t + ev.d * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    n.connect(bp).connect(g);
    route(ctx, g, out, (this.rng() - 0.5) * 0.8, 0.6, n);
  }

  private crack(ev: Ev, t: number, out: Out) {
    const ctx = this.ctx;
    const end = t + ev.d;
    const src = ctx.createBufferSource();
    src.buffer = this.crackle;
    src.loop = true;
    src.playbackRate.value = 0.8 + this.rng() * 0.5;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(ev.vel * 0.12, t + 0.2);
    g.gain.setValueAtTime(ev.vel * 0.12, end - 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    src.connect(hp).connect(g);
    route(ctx, g, out, (this.rng() - 0.5) * 1.2, 0.15, src);
    src.start(t, this.rng() * 3);
    src.stop(end + 0.05);
  }
}

// ---------------------------------------------------------------------------
// 2. Basalt — abyss
// ---------------------------------------------------------------------------

/** A little beat-based writer for piano scores with tempo changes. */
function pianoWriter(rng: Rng) {
  const ev: Ev[] = [];
  let t = 0.15;
  let spb = 60 / 46;
  return {
    ev,
    get t() {
      return t;
    },
    tempo(bpm: number) {
      spb = 60 / bpm;
    },
    /** Notes (low first, rolled by `spread` s) at `at` beats from now, ringing `ring` beats (the pedal). */
    hit(names: string, vel: number, ring: number, at = 0, spread = 0.006) {
      const list = names.split(/\s+/);
      const human = (rng() - 0.5) * 0.02;
      list.forEach((n, i) =>
        ev.push({ t: t + at * spb + i * spread + human, v: 'pno', m: note(n), vel: Math.min(1, vel * (0.96 + rng() * 0.08)), d: ring * spb }),
      );
    },
    wait(beats: number) {
      t += beats * spb;
    },
    /** Seconds of `beats` at the current tempo. */
    sec(beats: number) {
      return beats * spb;
    },
  };
}

/**
 * Tempo shaping, [from, to] in score seconds: `amount` > 0 broadens toward the
 * end of the span (a ritardando: quadratic, so it arrives late), < 0 presses
 * forward evenly through it.
 */
type Shape = [from: number, to: number, amount: number];

/**
 * Turn a metronomic score into a performance: the tempo breathes by a few
 * percent (a different breath each loop), presses through the crescendo, and
 * broadens into cadences and before the blows. Chords on beats 2-3-4 at an exact
 * Lento sound, and read in the engine, as a machine. Returns the new length.
 */
function perform(ev: Ev[], length: number, rng: Rng, shapes: Shape[]) {
  const ph = [rng(), rng()].map((x) => x * 2 * Math.PI);
  const rate = (t: number) => {
    let r = 1 + 0.045 * Math.sin((2 * Math.PI * t) / 9.1 + ph[0]) + 0.025 * Math.sin((2 * Math.PI * t) / 4.3 + ph[1]);
    for (const [a, b, amt] of shapes) if (t > a && t < b) r += amt > 0 ? amt * ((t - a) / (b - a)) ** 2 : amt;
    return r;
  };
  // Performed time = ∫ rate dt, tabulated every 10 ms.
  const step = 0.01;
  const table = new Float64Array(Math.ceil((length + 30) / step) + 2);
  for (let i = 1; i < table.length; i++) table[i] = table[i - 1] + rate((i - 0.5) * step) * step;
  const warp = (t: number) => {
    const x = Math.max(0, t / step);
    const i = Math.min(table.length - 2, Math.floor(x));
    return table[i] + (table[i + 1] - table[i]) * (x - i);
  };
  for (const e of ev) {
    const t0 = warp(e.t);
    e.d = warp(e.t + e.d) - t0;
    e.t = t0;
  }
  return warp(length);
}

const PPP = 0.1, PP = 0.14, P = 0.24, MP = 0.42, MF = 0.55, F = 0.7, FF = 0.85, FFF = 1;

export function composeBasalt(seed: number): StudyScore {
  const rng = mulberry32(seed);
  const w = pianoWriter(rng);
  const shapes: Shape[] = [];
  /** Broaden (amount > 0) or press on (< 0) over the next `beats`. */
  const shape = (beats: number, amount: number, at = 0) => shapes.push([w.t + w.sec(at), w.t + w.sec(at + beats), amount]);
  // I. The motif A–B♭–A–D, fff, in triple octaves; a held breath before the low D.
  w.tempo(40);
  shape(2, 0.3, 2);
  w.hit('A1 A2 A3', FFF, 1.1, 0, 0.004);
  w.hit('Bb1 Bb2 Bb3', FFF, 1.1, 1, 0.004);
  w.hit('A1 A2 A3', FFF, 2, 2, 0.004);
  w.wait(4);
  w.hit('D1 D2 D3', FFF, 7, 0, 0.006);
  w.wait(4);

  // II. Una corda chorale: the bass sinks chromatically (D–C♯–C–B–B♭–A), chords answer on 2-3-4.
  w.tempo(48);
  const bar = (bass: string, chords: string[], vel: number) => {
    w.hit(bass, vel + 0.12, 4, 0, 0.003);
    chords.forEach((c, i) => w.hit(c, vel * (i === 0 ? 1.08 : 1), 1, 1 + i, 0.008));
    w.wait(4);
  };
  bar('D1 D2', ['F3 A3 D4 F4 A4', 'F3 Bb3 D4 F4 Bb4', 'F3 A3 D4 F4 A4'], PP);
  bar('C#1 C#2', ['E3 A3 C#4 E4 A4', 'E3 G3 C#4 E4 G4', 'E3 G3 Bb3 E4 G4'], PP + 0.03);
  bar('C1 C2', ['F3 A3 D4 F4', 'F3 A3 C4 F4', 'F3 A3 D4 F4 A4'], P);
  bar('B0 B1', ['F3 A3 B3 D4 F4', 'F3 Ab3 B3 D4 F4', 'E3 Ab3 B3 D4 E4'], P);
  bar('Bb0 Bb1', ['F3 Bb3 D4 F4 A4', 'G3 Bb3 D4 E4 G4', 'F3 Bb3 D4 F4 Bb4'], PP + 0.04);
  shape(4, 0.3); // the chorale settles on its half cadence
  bar('A0 A1', ['E3 G3 C#4 E4 A4', 'E3 G3 Bb3 C#4 G4', 'E3 G3 A3 C#4 E4'], PP);

  // III. Gathering weight: blunt quarter-note chords, crescendo, pressing on, then holding back before the blow.
  w.tempo(52);
  shape(6, -0.07);
  shape(2, 0.45, 6);
  for (let b = 0; b < 4; b++) {
    if (b % 2 === 0) w.hit('D1 D2', MP + b * 0.05, 2, b, 0.003);
    w.hit('D3 F3 A3 D4 F4', MP + b * 0.05, 1, b, 0.006);
  }
  w.wait(4);
  for (let b = 0; b < 3; b++) {
    if (b % 2 === 0) w.hit('Bb0 Bb1', MF + b * 0.06, 2, b, 0.003);
    w.hit('D3 F3 Bb3 D4 F4 Bb4', MF + b * 0.06, 1, b, 0.006);
  }
  w.hit('E1 E2 E3 G#3 B3 D4 E4', F, 1, 3, 0.006);
  w.wait(4);

  // IV. fff: the motif in massive chords, the lowest A of the piano tolling between them.
  w.tempo(44);
  w.hit('D1 D2', FFF, 3, 0, 0.003);
  w.hit('F3 A3 D4 F4 A4 D5 A5', FFF, 1, 0);
  w.hit('G3 Bb3 D4 G4 Bb4 D5 Bb5', FF, 1, 1);
  w.hit('F3 A3 D4 F4 A4 D5 A5', FF, 1, 2);
  w.hit('A0 A1', FF, 1, 3, 0.003);
  w.wait(4);
  w.hit('D1 D2', FFF, 2, 0, 0.003);
  w.hit('F3 A3 D4 F4 A4 D5', FFF, 2, 0);
  w.hit('Bb0 Bb1 F3 Bb3 D4 F4 Bb4 D5', FF, 1, 2);
  w.hit('A0 A1 E3 G3 C#4 E4 G4 C#5', FF, 1, 3);
  w.wait(4);
  shape(4, 0.35); // the last approach is dragged out
  w.hit('Bb0 Bb1 F3 Bb3 D4 F4 Bb4 D5 F5', FFF, 2, 0);
  w.hit('E1 E2 G3 Bb3 C#4 E4 G4 Bb4', FF, 1, 2);
  w.hit('A0 A1 E3 A3 C#4 E4 A4 C#5 E5', FFF, 1, 3);
  w.wait(4);
  w.tempo(40);
  w.hit('D1 D2 D3 F3 A3 D4 F4 A4 D5 F5', FFF, 9, 0, 0.007);
  w.wait(5);

  // V. Coda: the motif again, far away and soft, dying away; the low D one last time.
  shape(4, 0.25);
  w.hit('A4', PP, 1);
  w.hit('Bb4', PP, 1, 1);
  w.hit('A4', PP, 2, 2);
  w.wait(3);
  w.hit('D1 D2 F3 A3 D4', PPP + 0.06, 8, 0, 0.02);
  w.wait(5);
  const length = perform(w.ev, w.t, rng, shapes);
  return finish(w.ev, length);
}

class BasaltPlayer extends ScorePlayer {
  private piano: PianoBank;

  constructor(ctx: BaseAudioContext, dest: AudioNode, title: string, compose: (s: number) => StudyScore) {
    super(ctx, dest, { reverbSeconds: 3.6, reverbBrightness: 0.3, wet: 0.45, gain: 2.7, seed: 23 }, title, compose, 3);
    // Bass strings a little more inharmonic than a textbook piano: that's where the bell-like toll comes from.
    this.piano = new PianoBank(ctx, { inharmonicity: 1.4, ringScale: 0.75, sampleRate: 24000 });
  }

  protected prepare(ev: Ev) {
    this.piano.prepare(ev.m, ev.vel);
  }

  protected play(ev: Ev, t: number, out: Out) {
    this.piano.play(out, ev.m, ev.vel, t, ev.d, 0.4);
  }
}

// ---------------------------------------------------------------------------
// 3. Sugar Glass — sugar
// ---------------------------------------------------------------------------

/**
 * Melodies in sixteenths (2/4: 8 per bar). Tokens: `G5:2` (note, sixteenths),
 * `r:2` rest, `~C#6` a crushed grace note before the next note.
 */
/** A: a tiptoeing E minor tune (like Tchaikovsky's own), chromatic grace notes on every strong beat. */
const SUGAR_A = [
  '~D#6 E6:2 B5:2 G5:2 B5:2',
  '~G#5 A5:2 C6:2 ~D#6 E6:2 r:2',
  '~E#6 F#6:1 E6:1 D#6:1 E6:1 C6:2 A5:2',
  'B5:1 C6:1 B5:1 A5:1 G5:2 F#5:2',
  '~D#6 E6:2 B5:2 G5:2 B5:2',
  '~F6 E6:2 G6:2 ~D#6 E6:2 C6:2',
  'B5:1 A5:1 G5:1 F#5:1 ~C#6 D#6:2 F#6:2',
  'E6:2 r:2 E5:1 r:3',
];
const SUGAR_A_HARM = ['Em', 'Am', 'Am', 'B7', 'Em', 'C', 'B7', 'Em'];
const SUGAR_B = [
  'r:4 G5:0.5 A5:0.5 B5:0.5 C6:0.5 D6:0.5 E6:0.5 F#6:0.5 G6:0.5',
  'A6:2 r:2 ~G#6 A6:1 G6:1 F#6:1 E6:1',
  'D#6:1 E6:1 r:2 C7:0.5 B6:0.5 A6:0.5 G6:0.5 F#6:0.5 E6:0.5 D6:0.5 C6:0.5',
  'B5:2 r:2 D6:2 r:2',
  'E6:1 r:1 F6:1 r:1 F#6:1 r:1 G6:1 r:1',
  '~G#6 A6:1 r:1 r:2 E7:0.5 D7:0.5 C7:0.5 B6:0.5 A6:0.5 G6:0.5 F#6:0.5 E6:0.5',
  'D6:1 F#6:1 A6:1 C7:1 B6:1 A6:1 G6:1 F#6:1',
  'A6:2 r:2 D6:2 r:2',
];
const SUGAR_B_HARM = ['G', 'A7', 'B7', 'Em', 'C', 'A7', 'D7', 'D7'];
const SUGAR_CODA = [
  '~C#7 D7:2 B6:2 G6:2 B6:2',
  'G6:0.5 A6:0.5 B6:0.5 C7:0.5 D7:0.5 E7:0.5 F#7:0.5 G7:0.5 r:4',
  'G5:1 r:7',
  'r:8',
];
const SUGAR_CODA_HARM = ['G', 'G', 'G', '-'];
/** Harmony → [bass, fifth, upper dyad]. */
const SUGAR_CHORDS: Record<string, [string, string, string]> = {
  G: ['G2', 'D3', 'B3 D4'],
  C: ['C3', 'G2', 'C4 E4'],
  Am: ['A2', 'E3', 'C4 E4'],
  D7: ['D3', 'A2', 'C4 F#4'],
  A7: ['A2', 'E3', 'C#4 G4'],
  B7: ['B2', 'F#3', 'D#4 A4'],
  Em: ['E3', 'B2', 'G3 B3'],
};

function parseLine(line: string) {
  const out: { at: number; m: number; grace: boolean; len: number }[] = [];
  let at = 0;
  for (const tok of line.split(/\s+/)) {
    if (tok.startsWith('~')) {
      out.push({ at, m: note(tok.slice(1)), grace: true, len: 0 });
      continue;
    }
    const [n, d] = tok.split(':');
    const len = Number(d ?? 1);
    if (n !== 'r') out.push({ at, m: note(n), grace: false, len });
    at += len;
  }
  return out;
}

export function composeSugar(seed: number): StudyScore {
  const rng = mulberry32(seed);
  const ev: Ev[] = [];
  const s16 = 60 / 76 / 4;
  const barLen = 8 * s16;
  let bar = 0;
  const t0 = 0.15;
  const at = (b: number, six: number) => t0 + b * barLen + six * s16 + (rng() - 0.5) * 0.008;

  const melody = (lines: string[], voice: string, shift: number, vel: number, echo = 0) => {
    lines.forEach((line, i) => {
      for (const n of parseLine(line)) {
        const m = n.m + shift;
        const t = at(bar + i, n.at);
        const v = vel * (n.at % 2 === 0 ? 1 : 0.85) * (0.92 + rng() * 0.16);
        if (n.grace) ev.push({ t: t - 0.055, v: voice, m, vel: v * 0.6, d: 0.25 });
        else ev.push({ t, v: voice, m, vel: v, d: n.len < 1 ? 0.35 : 0.55 + n.len * 0.1 });
        if (echo && !n.grace) ev.push({ t: t + echo * s16, v: 'box', m: m + 12, vel: v * 0.5, d: 0.4 });
      }
    });
  };
  const pizz = (harm: string[], vel: number) => {
    harm.forEach((h, i) => {
      const c = SUGAR_CHORDS[h];
      if (!c) return;
      ev.push({ t: at(bar + i, 0), v: 'pizz', m: note(c[0]), vel, d: 0.3 });
      ev.push({ t: at(bar + i, 4), v: 'pizz', m: note(c[1]), vel: vel * 0.8, d: 0.3 });
      for (const six of [2, 6]) for (const n of c[2].split(' ')) ev.push({ t: at(bar + i, six), v: 'pizc', m: note(n) + 12, vel: vel * (six === 2 ? 0.5 : 0.35), d: 0.2 });
    });
  };
  const ting = (b: number, vel: number) => ev.push({ t: at(b, 0), v: 'ting', m: 0, vel, d: 1.2 });

  // Intro: tip-toe pizzicato.
  pizz(['G', 'G'], 0.5);
  bar += 2;
  // A: the celesta tune.
  melody(SUGAR_A, 'cel', 0, 0.55);
  pizz(SUGAR_A_HARM, 0.5);
  ting(bar + 7, 0.4);
  bar += 8;
  // B: sparkling runs.
  melody(SUGAR_B, 'cel', 0, 0.5);
  pizz(SUGAR_B_HARM, 0.45);
  ting(bar + 3, 0.3);
  bar += 8;
  // A': music box an octave up, celesta in the original octave, sparkle arpeggios on the second beat.
  melody(SUGAR_A, 'box', 12, 0.45);
  melody(SUGAR_A, 'cel', 0, 0.35);
  SUGAR_A_HARM.forEach((h, i) => {
    const c = SUGAR_CHORDS[h][2].split(' ').map((n) => note(n) + 24);
    [...c, c[0] + 12].forEach((m, k) => ev.push({ t: at(bar + i, 4 + k * 0.67), v: 'cel', m, vel: 0.28, d: 0.3 }));
  });
  pizz(SUGAR_A_HARM, 0.5);
  ting(bar + 7, 0.4);
  bar += 8;
  // B': the runs in canon — the music box answers a sixteenth later, an octave up.
  melody(SUGAR_B, 'cel', 0, 0.45, 1);
  pizz(SUGAR_B_HARM, 0.42);
  bar += 8;
  // Coda: up and away.
  melody(SUGAR_CODA, 'cel', 0, 0.5);
  pizz(SUGAR_CODA_HARM, 0.4);
  ting(bar + 1, 0.45);
  ting(bar + 2, 0.25);
  bar += 4;
  return finish(ev, t0 + bar * barLen);
}

class SugarPlayer extends ScorePlayer {
  private rng = mulberry32(9);

  constructor(ctx: BaseAudioContext, dest: AudioNode, title: string, compose: (s: number) => StudyScore) {
    super(ctx, dest, { reverbSeconds: 1.8, reverbBrightness: 0.85, wet: 0.55, gain: 1.8, seed: 31 }, title, compose, 7);
  }

  protected play(ev: Ev, t: number, out: Out) {
    switch (ev.v) {
      case 'cel': return this.bell(ev, t, out, 3.5, 2.2, 0.1);
      case 'box': return this.bell(ev, t, out, 5.4, 1.3, 0.07);
      case 'pizz': return this.pizz(ev, t, out, 0.075);
      case 'pizc': return this.pizz(ev, t, out, 0.03);
      case 'ting': return this.ting(ev, t, out);
    }
  }

  /** FM bell: an inharmonic modulator whose index collapses fast — the "tink" — over a pure, decaying tone. */
  private bell(ev: Ev, t: number, out: Out, ratio: number, index: number, level: number) {
    const ctx = this.ctx;
    const f = mtof(ev.m);
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f * ratio;
    const idx = ctx.createGain();
    idx.gain.setValueAtTime(f * index * (0.5 + ev.vel), t);
    idx.gain.exponentialRampToValueAtTime(f * 0.02, t + 0.09);
    mod.connect(idx).connect(car.frequency);
    // The celesta's octave partial gives it body.
    const oct = ctx.createOscillator();
    oct.frequency.value = f * 2.005;
    const og = ctx.createGain();
    envelope(og.gain, t, ev.vel * level * 0.25, 0.002, 0.18);
    oct.connect(og);
    const g = ctx.createGain();
    envelope(g.gain, t, ev.vel * level, 0.002, ev.d);
    car.connect(g);
    og.connect(g);
    route(ctx, g, out, pitchPan(ev.m, 0.7) + (this.rng() - 0.5) * 0.2, 0.45, car);
    const end = t + ev.d + 0.05;
    for (const o of [car, mod, oct]) {
      o.start(t);
      o.stop(end);
    }
  }

  private pizz(ev: Ev, t: number, out: Out, level: number) {
    const ctx = this.ctx;
    const f = mtof(ev.m);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f * 1.012, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    const s = ctx.createOscillator();
    s.type = 'sawtooth';
    s.frequency.value = f;
    const sg = ctx.createGain();
    sg.gain.value = 0.35;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(9000, f * 8), t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.12);
    const g = ctx.createGain();
    envelope(g.gain, t, ev.vel * level, 0.003, ev.d);
    o.connect(lp);
    s.connect(sg).connect(lp);
    lp.connect(g);
    route(ctx, g, out, pitchPan(ev.m, 0.5) - 0.1, 0.3, o);
    for (const x of [o, s]) {
      x.start(t);
      x.stop(t + ev.d + 0.05);
    }
  }

  /** Triangle: a cluster of high inharmonic sines. */
  private ting(ev: Ev, t: number, out: Out) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    envelope(g.gain, t, ev.vel * 0.02, 0.001, ev.d);
    let last!: OscillatorNode;
    for (const f of [4810, 6230, 7390, 9120]) {
      const o = (last = ctx.createOscillator());
      o.frequency.value = f * (0.99 + this.rng() * 0.02);
      o.connect(g);
      o.start(t);
      o.stop(t + ev.d + 0.05);
    }
    route(ctx, g, out, 0.5, 0.6, last);
  }
}

// ---------------------------------------------------------------------------
// 4. Mist — serene
// ---------------------------------------------------------------------------

/**
 * D♭ major, voiced open and high: [bass, pad voicing]. Only 6/9, add9 and plain
 * triads (a maj7 hides a minor triad, which reads as sad), and no two pad voices
 * a second apart (that rubbing reads as rough, not hazy).
 */
const MIST_PLAN: [string, string][] = [
  ['Db3', 'F4 Ab4 Eb5 Bb5'], // D♭6/9
  ['Gb2', 'Gb4 Bb4 Db5 Ab5'], // G♭add9
  ['C3', 'Ab4 C5 Eb5 Bb5'], // A♭add9/C
  ['Gb2', 'Gb4 Bb4 Eb5 Ab5'], // G♭6/9
  ['F2', 'F4 Ab4 Db5 F5'], // D♭/F
  ['Gb2', 'Gb4 Bb4 Db5 Gb5'], // G♭
  ['Ab2', 'Eb4 Ab4 Db5 Ab5'], // A♭sus4
  ['Ab2', 'Eb4 Ab4 C5 Eb5'], // A♭
  ['Db3', 'F4 Ab4 Eb5 Bb5'], // D♭6/9
  ['Gb2', 'Gb4 Bb4 Db5 Ab5'], // G♭add9
  ['Db3', 'F4 Ab4 Db5 F5'], // D♭, at rest
];

export function composeMist(seed: number): StudyScore {
  const rng = mulberry32(seed);
  const ev: Ev[] = [];
  const span = 7.2;
  let mel = 84;
  MIST_PLAN.forEach(([bass, voicing], i) => {
    const pad = voicing.split(' ').map(note);
    const pcs = [...pad, note(bass)].map((m) => m % 12);
    const t = 0.3 + i * span;
    const last = i === MIST_PLAN.length - 1;
    const d = last ? span + 4 : span + 3; // long overlaps: chords dissolve into each other
    for (const m of pad) ev.push({ t: t + rng() * 0.6, v: 'pad', m, vel: 0.5 + rng() * 0.15, d });
    ev.push({ t, v: 'bass', m: note(bass), vel: 0.5, d });
    // A thin shimmer an octave above the top of the pad.
    ev.push({ t: t + 1.5, v: 'glass', m: pad[pad.length - 1] + 12, vel: 0.35, d: span });
    ev.push({ t: t + rng(), v: 'air', m: 0, vel: 0.4 + rng() * 0.3, d: span + 2 });
    // The flute: one or two long legato tones per chord, gliding from the last, floating above the pad.
    if (i > 0 && i < MIST_PLAN.length - 1) {
      const notes = rng() < 0.55 ? 2 : 1;
      let mt = t + 0.4 + rng() * 0.8;
      for (let k = 0; k < notes; k++) {
        const cands: number[] = [];
        const top = pad[pad.length - 1];
        for (let m = Math.max(77, top + 3); m <= 92; m++) if (pcs.includes(m % 12) && m !== mel) cands.push(m);
        if (!cands.length) break;
        cands.sort((a, b) => Math.abs(a - mel) - Math.abs(b - mel));
        const nm = cands[Math.floor(rng() * Math.min(3, cands.length))];
        const nd = (span - 1.2) / notes;
        ev.push({ t: mt, v: 'flute', m: nm, vel: 0.5 + rng() * 0.2, d: nd + 0.6, x: mel });
        mel = nm;
        mt += nd;
      }
    }
  });
  return finish(ev, 0.3 + MIST_PLAN.length * span + 3.5);
}

class MistPlayer extends ScorePlayer {
  private rng = mulberry32(13);

  constructor(ctx: BaseAudioContext, dest: AudioNode, title: string, compose: (s: number) => StudyScore) {
    super(ctx, dest, { reverbSeconds: 4.5, reverbBrightness: 0.4, wet: 0.7, gain: 0.2, seed: 41 }, title, compose, 11);
  }

  protected play(ev: Ev, t: number, out: Out) {
    switch (ev.v) {
      case 'pad': return this.pad(ev, t, out);
      case 'bass': return this.bass(ev, t, out);
      case 'glass': return this.glass(ev, t, out);
      case 'air': return this.air(ev, t, out);
      case 'flute': return this.flute(ev, t, out);
    }
  }

  /** Swell in, hold, fade — no edges anywhere. */
  private swell(g: GainNode, t: number, d: number, peak: number, attack: number, release: number) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + d - release);
    g.gain.linearRampToValueAtTime(0, t + d);
  }

  private pad(ev: Ev, t: number, out: Out) {
    const ctx = this.ctx;
    const f = mtof(ev.m);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.linearRampToValueAtTime(1200 + this.rng() * 300, t + ev.d * 0.5);
    lp.frequency.linearRampToValueAtTime(800, t + ev.d);
    const g = ctx.createGain();
    this.swell(g, t, ev.d, ev.vel * 0.05, 2.8, 3.5);
    let last!: OscillatorNode;
    // Sine + triangle in unison: detuned pairs beat at 2–3 Hz in this register, which reads as a pulse.
    for (const type of ['sine', 'triangle'] as const) {
      const o = (last = ctx.createOscillator());
      o.type = type;
      o.frequency.value = f;
      o.connect(lp);
      o.start(t);
      o.stop(t + ev.d + 0.05);
    }
    lp.connect(g);
    route(ctx, g, out, pitchPan(ev.m, 0.6) + (this.rng() - 0.5) * 0.4, 0.8, last);
  }

  private bass(ev: Ev, t: number, out: Out) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.value = mtof(ev.m);
    const g = ctx.createGain();
    this.swell(g, t, ev.d, ev.vel * 0.03, 3, 3.5);
    o.connect(g);
    route(ctx, g, out, -0.15, 0.4, o);
    o.start(t);
    o.stop(t + ev.d + 0.05);
  }

  private glass(ev: Ev, t: number, out: Out) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.value = mtof(ev.m);
    const g = ctx.createGain();
    this.swell(g, t, ev.d, ev.vel * 0.018, 2.5, 3);
    o.connect(g);
    route(ctx, g, out, 0.35, 1, o);
    o.start(t);
    o.stop(t + ev.d + 0.05);
  }

  private air(ev: Ev, t: number, out: Out) {
    const ctx = this.ctx;
    const n = this.noiseSrc(t, t + ev.d + 0.05, this.rng);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(2500 + this.rng() * 2000, t);
    bp.frequency.linearRampToValueAtTime(4000 + this.rng() * 3000, t + ev.d);
    const g = ctx.createGain();
    this.swell(g, t, ev.d, ev.vel * 0.012, ev.d * 0.45, ev.d * 0.45);
    n.connect(bp).connect(g);
    route(ctx, g, out, (this.rng() - 0.5) * 1.4, 0.9, n);
  }

  /** Breathy sine flute that glides in from the previous note. */
  private flute(ev: Ev, t: number, out: Out) {
    const ctx = this.ctx;
    const f = mtof(ev.m);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(mtof(ev.x ?? ev.m), t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.35);
    const vib = ctx.createOscillator();
    vib.frequency.setValueAtTime(3.6 + this.rng(), t);
    vib.frequency.linearRampToValueAtTime(4.2 + this.rng() * 1.2, t + ev.d);
    const vg = ctx.createGain();
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(f * 0.0022, t + 1.6);
    vib.connect(vg).connect(o.frequency);
    const h = ctx.createOscillator();
    h.frequency.value = f * 2;
    const hg = ctx.createGain();
    hg.gain.value = 0.12;
    o.connect(hg);
    h.connect(hg);
    const g = ctx.createGain();
    this.swell(g, t, ev.d, ev.vel * 0.045, 0.9, 1.4);
    o.connect(g);
    hg.connect(g);
    const breath = this.noiseSrc(t, t + ev.d, this.rng);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * 2;
    bp.Q.value = 4;
    const bg = ctx.createGain();
    this.swell(bg, t, ev.d, ev.vel * 0.006, 0.6, 1.2);
    breath.connect(bp).connect(bg).connect(g);
    route(ctx, g, out, 0.1, 0.8, o);
    for (const x of [o, vib, h]) {
      x.start(t);
      x.stop(t + ev.d + 0.05);
    }
  }
}

// ---------------------------------------------------------------------------

/** Titles live outside the objects so create() works however it is called (it never needs `this`). */
const TITLE = {
  ember: 'Character study — Ember',
  basalt: 'Character study — Basalt',
  sugar: 'Character study — Sugar Glass',
  mist: 'Character study — Mist',
};

export const STUDIES: Study[] = [
  {
    id: 'ember',
    title: TITLE.ember,
    blurb: 'Erratic like fire: flickering tremolo, ricochet sparks, sudden swells, D minor and chromatic.',
    archetype: 'fire',
    compose: composeEmber,
    create: (ctx, dest) => new EmberPlayer(ctx, dest, TITLE.ember, composeEmber),
  },
  {
    id: 'basalt',
    title: TITLE.basalt,
    blurb: 'Dark and blunt: massive low piano chords and tolling octaves, slow and heavy.',
    archetype: 'abyss',
    compose: composeBasalt,
    create: (ctx, dest) => new BasaltPlayer(ctx, dest, TITLE.basalt, composeBasalt),
  },
  {
    id: 'sugar',
    title: TITLE.sugar,
    blurb: 'Whimsical, tiny and quick: celesta and music box, pizzicato, sparkling runs.',
    archetype: 'sugar',
    compose: composeSugar,
    create: (ctx, dest) => new SugarPlayer(ctx, dest, TITLE.sugar, composeSugar),
  },
  {
    id: 'mist',
    title: TITLE.mist,
    blurb: 'Serene: slow, soft legato pads and a distant flute, consonant and airy.',
    archetype: 'mist',
    compose: composeMist,
    create: (ctx, dest) => new MistPlayer(ctx, dest, TITLE.mist, composeMist),
  },
];
