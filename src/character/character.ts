/**
 * The character engine's "mind": descriptors (+ optional neural tags) →
 * Character (axes, archetype blend, words) → Material, plus organic gestures
 * (echo-state network) and the sound events the canvas should express.
 *
 * Usage, once per animation frame, in this order:
 *
 *   const ch = engine.update(descriptors, tags, features, dt, musicDt, melody);  // tags, melody: null is fine
 *   const mat = engine.material();   // what the picture is made of
 *   const g = engine.gesture();      // organic motion
 *   const evs = engine.events(features, descriptors);  // onsets + sustained ticks
 *
 * `material()`, `gesture()` and `events()` reflect the last `update()`; `events()`
 * uses that update's dt. `material()` and `gesture()` return live objects that the
 * next update() overwrites — copy them if you need to keep a snapshot.
 * `midiEvent(note, velocity, material)` turns a played key into a SoundEvent
 * (velocity 0..1, as src/control/midi.ts normalizes it).
 * `melody` (a MelodyTracker frame, optional) puts the size axis and the event
 * heights on the tune's register when a melody is voiced: the spectrum's register
 * is dragged down by the bass, so a celesta tune over pizzicato basses read as low
 * and large (Sugar Plum read as lament).
 * `update()` should see the analysis Features every frame (it tracks spectral
 * change between calls to place onsets); `f.onset` must be true for one frame per
 * onset, as AudioEngine.analyze() reports it.
 *
 * Axis formulas (all saturating logistic/tanh curves of weighted deviations from
 * TYPICAL — what ordinary real recordings measure — so nothing jumps or clips hard
 * and a mastered record lands mid-range) follow robust cross-modal correspondences
 * (Spence 2011; Eitan & Timmers 2010; Walker 2010; Palmer et al. 2013 PNAS;
 * Gabrielsson & Lindström 2010 for emotion cues):
 *   pace      ← onset rate, tempo, melodic & harmonic motion
 *   energy    ← (absolute) loudness first, then onset rate, tempo, brightness, roughness
 *   valence   ← mode (weighted by key clarity) + pace + brightness + register − roughness
 *   weight    ← low register, loud, sustained, dark timbre, slow
 *   size      ← low register, loud, sustained, wide register spread, soft attack
 *   agitation ← rhythmic irregularity (trusted only with enough onsets), roughness,
 *               dynamic contrast, onset density, harmonic change
 *   sharpness ← attack sharpness, lack of sustain (staccato), noisiness — "kiki vs bouba"
 *   density   ← onset rate, register spread, loudness, noisiness, sustain
 *   warmth    ← energy, valence, brightness (arousal reds, positive valence yellows)
 * Each axis is smoothed with its own time constant (≈1–2.5 s), rising faster than
 * it falls where a sudden change should register quickly (energy, size, density,
 * agitation). Silence pulls every axis towards a calm rest state.
 */
import type {
  ArchetypeId, Character, CharacterAxes, Descriptors, Gesture, Material, NeuralTags, Rgb, SoundEvent,
} from './types';
import { ARCHETYPE_IDS } from './types';
import type { Features } from '../audio/features';
import type { MelodyFrame } from '../stage/types';
import { ARCHETYPES, protoDistance, type MaterialShape, type SpacePoint } from './archetypes';
import { GestureReservoir, mulberry32 } from './reservoir';
import { moodPalette, noteRgb, samplePalette, tintKeepLuma, type Palette } from './palette';

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const sig = (x: number) => 1 / (1 + Math.exp(-x));
/** Frame-rate independent smoothing coefficient. */
const alpha = (dt: number, tau: number) => 1 - Math.exp(-dt / tau);
/** NaN-safe read of a descriptor, clamped to its range. */
const val = (v: number, lo = 0, hi = 1) => (Number.isFinite(v) ? clamp(v, lo, hi) : lo < 0 ? 0 : lo);

export type AxisName = keyof CharacterAxes;
const AXES: AxisName[] = ['energy', 'valence', 'weight', 'size', 'agitation', 'sharpness', 'density', 'warmth', 'pace'];

/** What every axis drifts to in silence: calm, neutral, a little mist. */
const REST: CharacterAxes = {
  energy: 0, valence: 0, weight: 0.3, size: 0.45, agitation: 0, sharpness: 0.15, density: 0, warmth: 0.35, pace: 0.1,
};

/** Smoothing time constants (s): [rising, falling]. */
const TAU: Record<AxisName, [number, number]> = {
  energy: [0.35, 1.5],
  valence: [2.5, 2.5],
  weight: [1.2, 1.8],
  size: [0.6, 1.5],
  agitation: [0.6, 2.0],
  sharpness: [1.0, 1.4],
  density: [0.7, 1.5],
  warmth: [2.0, 2.0],
  pace: [1.2, 1.6],
};

/**
 * Where "ordinary" music sits on each descriptor: the median over a mixed set of
 * real recordings (orchestral, ragtime, waltz, drum & bass, pop, jazz-electronic,
 * whale song). Every axis term is a deviation from these, so a typical mastered
 * record lands mid-axis and the extremes have room on both sides — without this,
 * absolute loudness alone (mastered music sits at ≈0.65–0.85) pins everything
 * as huge and intense.
 */
export const TYPICAL = {
  loudness: 0.7, onsetRate: 0.35, tempo: 0.47, brightness: 0.47, roughness: 0.45, dynamics: 0.3, irregularity: 0.32,
  attack: 0.55, sustain: 0.38, registerSpread: 0.7, register: 0.47, pitchMotion: 0.43, harmonicChange: 0.55, noisiness: 0.3,
} as const;

/**
 * Pure, unsmoothed mapping from descriptors to axes (exported for tests and
 * offline tools): saturating curves of weighted deviations from TYPICAL.
 * `melodyRegister` (same 0..1 scale as Descriptors.register), when given,
 * stands in for the register in `size`: a tune's size is where the tune is.
 */
export function descriptorAxes(d: Descriptors, melodyRegister = NaN): CharacterAxes {
  const T = TYPICAL;
  const loud = val(d.loudness) - T.loudness;
  const reg = val(d.register) - T.register;
  const sizeReg = Number.isFinite(melodyRegister) ? clamp01(melodyRegister) - T.register : reg;
  const spread = val(d.registerSpread) - T.registerSpread;
  const bright = val(d.brightness) - T.brightness;
  const noise = val(d.noisiness) - T.noisiness;
  const rough = val(d.roughness) - T.roughness;
  const onsetsRaw = val(d.onsetRate);
  const onsets = onsetsRaw - T.onsetRate;
  const attack = val(d.attack) - T.attack;
  const sustain = val(d.sustain) - T.sustain;
  const dyn = val(d.dynamics) - T.dynamics;
  const keyClar = val(d.keyClarity);
  const hc = val(d.harmonicChange) - T.harmonicChange;
  const pm = val(d.pitchMotion) - T.pitchMotion;
  // Unknown tempo: estimate from the onset rate (2 onsets/s ≈ 120 BPM → 0.6).
  const tempo = (d.tempo > 0 && Number.isFinite(d.tempo) ? clamp01(d.tempo) : Math.min(0.9, onsetsRaw * 3)) - T.tempo;
  // Mode only means something when a key is audible (whale song, drums: ignore).
  const mode = val(d.majorness, -1, 1) * (0.25 + 0.75 * keyClar);
  // Inter-onset irregularity is meaningless with hardly any onsets: fade it towards typical.
  const irr = (val(d.irregularity) - T.irregularity) * clamp01(onsetsRaw * 5);

  const pace = sig(7 * (0.45 * onsets + 0.3 * tempo + 0.15 * pm + 0.1 * hc));
  const energy = sig(7 * (0.45 * loud + 0.25 * onsets + 0.1 * tempo + 0.1 * bright + 0.1 * rough + 0.1 * dyn) + 0.3);
  const valence = Math.tanh(1.1 * mode + 1.6 * (pace - 0.5) + 0.8 * bright + 0.8 * reg - 0.8 * rough);
  const weight = sig(3.5 * (-1.4 * reg + 0.5 * loud + 0.4 * sustain - 0.6 * bright - 0.3 * (pace - 0.5)));
  const size = sig(3.4 * (-1.1 * sizeReg + 0.8 * loud + 0.3 * sustain + 0.4 * spread - 0.4 * attack));
  const agitation = sig(7 * (0.35 * irr + 0.2 * rough + 0.25 * dyn + 0.1 * onsets + 0.1 * hc + 0.05 * pm) - 0.4);
  const sharpness = sig(7 * (0.6 * attack - 0.35 * sustain + 0.05 * noise));
  const density = sig(7 * (0.4 * onsets + 0.25 * spread + 0.2 * loud + 0.1 * noise + 0.05 * sustain));
  const warmth = clamp01(0.45 * energy + (0.35 * (valence + 1)) / 2 + 0.2 * (bright + T.brightness));
  return { energy, valence, weight, size, agitation, sharpness, density, warmth, pace };
}

/** Projects axes + texture descriptors into the archetype space (valence → 0..1). */
export function spacePoint(a: CharacterAxes, texture: { pulse: number; noise: number; tonal: number }): SpacePoint {
  return {
    energy: a.energy, valence: (a.valence + 1) / 2, weight: a.weight, size: a.size, agitation: a.agitation,
    sharpness: a.sharpness, density: a.density, pace: a.pace,
    pulse: texture.pulse, noise: texture.noise, tonal: texture.tonal,
  };
}

/** Softmax temperature over prototype distances (smaller = more decisive). */
export const BLEND_TEMPERATURE = 0.022;

/** Archetype probabilities for a point: softmax(−distance / T + bias). */
export function archetypeLikelihoods(p: SpacePoint, bias?: Partial<Record<ArchetypeId, number>>): Record<ArchetypeId, number> {
  const logits = ARCHETYPE_IDS.map((id) => -protoDistance(ARCHETYPES[id], p) / BLEND_TEMPERATURE + (bias?.[id] ?? 0));
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((s, v) => s + v, 0);
  const out = {} as Record<ArchetypeId, number>;
  ARCHETYPE_IDS.forEach((id, i) => (out[id] = exps[i] / sum));
  return out;
}

// ── Neural tag fusion (optional; the tagger is deferred, the shipping path has no tags) ──

interface TagRule {
  axes?: Partial<Record<AxisName, number>>;
  arch?: Partial<Record<ArchetypeId, number>>;
}
/** MagnaTagATune tag → soft evidence. Looked up by name; unknown names are ignored. */
const TAG_RULES: Record<string, TagRule> = {
  fast: { axes: { pace: 0.5, energy: 0.2 } },
  slow: { axes: { pace: -0.5, energy: -0.15 } },
  loud: { axes: { energy: 0.4, size: 0.2 } },
  quiet: { axes: { energy: -0.4, size: -0.1 }, arch: { mist: 0.5 } },
  soft: { axes: { energy: -0.3, sharpness: -0.3 }, arch: { mist: 0.4 } },
  heavy: { axes: { weight: 0.5, energy: 0.2 }, arch: { abyss: 0.6, storm: 0.4 } },
  metal: { axes: { energy: 0.3, agitation: 0.3, density: 0.3 }, arch: { storm: 1.0 } },
  'heavy metal': { arch: { storm: 0.8 } },
  rock: { axes: { energy: 0.2, density: 0.2 }, arch: { storm: 0.4 } },
  ambient: { axes: { energy: -0.3, agitation: -0.3, pace: -0.3 }, arch: { mist: 1.0 } },
  'new age': { arch: { mist: 0.6 } },
  classical: { arch: { machine: -0.8 } },
  harpsichord: { axes: { sharpness: 0.4, size: -0.3, weight: -0.2 }, arch: { sugar: 0.8 } },
  piano: { arch: { machine: -0.4 } },
  strings: { arch: { machine: -0.4 } },
  violin: { axes: { size: -0.1 }, arch: { machine: -0.4 } },
  cello: { axes: { weight: 0.2 }, arch: { lament: 0.3 } },
  flute: { axes: { size: -0.2, weight: -0.2 }, arch: { sugar: 0.3, mist: 0.2 } },
  opera: { arch: { gold: 0.3, lament: 0.2 } },
  choir: { arch: { gold: 0.2, mist: 0.2 } },
  techno: { axes: { pace: 0.2 }, arch: { machine: 1.4 } },
  electronic: { arch: { machine: 0.9 } },
  electro: { arch: { machine: 0.9 } },
  dance: { axes: { pace: 0.2 }, arch: { machine: 0.6 } },
  house: { arch: { machine: 0.6 } },
  synth: { arch: { machine: 0.5 } },
  beat: { axes: { density: 0.2 }, arch: { machine: 0.5 } },
  beats: { axes: { density: 0.2 }, arch: { machine: 0.5 } },
  drums: { axes: { density: 0.2, sharpness: 0.2 } },
  weird: { axes: { agitation: 0.4 }, arch: { fire: 0.3 } },
  dark: { axes: { valence: -0.4 }, arch: { abyss: 0.5 } },
  happy: { axes: { valence: 0.4 }, arch: { gold: 0.4, sugar: 0.2 } },
  sad: { axes: { valence: -0.4 }, arch: { lament: 0.6 } },
};
/** How far tags may push an axis (on top of the descriptor estimate). */
const TAG_AXIS_CAP = 0.3;
const TAG_LOGIT_CAP = 1.5;

/** Converts tags into axis deltas and archetype logit biases. Exported for tests. */
export function tagEvidence(tags: NeuralTags): { axes: Partial<Record<AxisName, number>>; arch: Partial<Record<ArchetypeId, number>> } {
  const axes: Partial<Record<AxisName, number>> = {};
  const arch: Partial<Record<ArchetypeId, number>> = {};
  for (let i = 0; i < tags.names.length; i++) {
    const rule = TAG_RULES[tags.names[i].toLowerCase()];
    const p = tags.values[i];
    if (!rule || !Number.isFinite(p)) continue;
    // MagnaTagATune sigmoids rarely exceed ~0.6 for a true tag; ignore the noise floor.
    const e = clamp01((p - 0.1) / 0.5);
    if (e <= 0) continue;
    for (const [k, w] of Object.entries(rule.axes ?? {})) axes[k as AxisName] = (axes[k as AxisName] ?? 0) + w * e;
    for (const [k, w] of Object.entries(rule.arch ?? {})) arch[k as ArchetypeId] = (arch[k as ArchetypeId] ?? 0) + w * e;
  }
  for (const k of Object.keys(axes) as AxisName[]) axes[k] = clamp(axes[k]!, -TAG_AXIS_CAP, TAG_AXIS_CAP);
  for (const k of Object.keys(arch) as ArchetypeId[]) arch[k] = clamp(arch[k]!, -TAG_LOGIT_CAP, TAG_LOGIT_CAP);
  return { axes, arch };
}

// ── Words ──

/** [low word, high word, center, scale]: the most extreme axis lends an adjective. */
const AXIS_WORDS: Partial<Record<AxisName, [string, string, number, number]>> = {
  energy: ['hushed', 'intense', 0.45, 0.35],
  valence: ['gloomy', 'bright', 0, 0.7],
  weight: ['airy', 'heavy', 0.45, 0.35],
  size: ['tiny', 'massive', 0.45, 0.35],
  agitation: ['steady', 'erratic', 0.4, 0.35],
  sharpness: ['flowing', 'crisp', 0.45, 0.35],
  density: ['sparse', 'dense', 0.45, 0.35],
  pace: ['languid', 'brisk', 0.45, 0.35],
};

/** Musical "presence" below which the engine reports silence. */
const PRESENCE_ON = 0.2;
/** Logit bonus for the incumbent leader: the blend needs a real reason to switch. */
const INCUMBENT_BONUS = 0.3;
/**
 * The archetype the words name changes only once a challenger has out-weighed it
 * for LEADER_DWELL seconds (or by a clear LEADER_MARGIN at once): two close
 * archetypes (ragtime: gold / sugar) then don't make the name flicker, while a
 * real change still shows within a couple of seconds.
 */
const LEADER_DWELL = 2;
const LEADER_MARGIN = 0.2;
/** Sharpening exponent for mixing archetype palettes (1 = plain linear mix). */
const PALETTE_GAMMA = 2.5;
/** Extra smoothing (s) of the sharpened palette weights. */
const PALETTE_TAU = 2.5;

export class CharacterEngine {
  private axes: CharacterAxes = { ...REST };
  private texture = { pulse: 0, noise: 0, tonal: 0 };
  private weights: Record<ArchetypeId, number>;
  /** Palette mixing weights: sharpened blend weights, smoothed again (see computeMaterial). */
  private palWeights: Record<ArchetypeId, number>;
  private top: ArchetypeId = 'mist';
  private leader: ArchetypeId = 'mist';
  private challenger: ArchetypeId = 'mist';
  private challengeTime = 0;
  private presence = 0;
  private novelty = 1;
  private confidence = 0;
  private words: string[] = ['silent'];
  private wordClock = 0;
  private lastDt = 1 / 60;
  private brightness = 0.5;
  private emitAcc = 0;
  /** Spectrum of the previous update, and where in pitch height it last grew most (onset location). */
  private prevSpec = new Float32Array(0);
  private fluxHeight = NaN;
  private lastOnsetTime = -1;
  /** Melody register (0..1, smoothed), NaN when there has been no tune for a while. */
  private melReg = NaN;
  private melQuiet = 0;
  /** This update's melody frame (for events). */
  private mel: MelodyFrame | null = null;
  private rnd: () => number;
  private reservoir: GestureReservoir;
  private mat: Material;

  constructor(seed = 0x5eed) {
    this.weights = {} as Record<ArchetypeId, number>;
    for (const id of ARCHETYPE_IDS) this.weights[id] = id === 'mist' ? 1 : 0;
    this.palWeights = { ...this.weights };
    this.reservoir = new GestureReservoir(seed);
    this.rnd = mulberry32(seed ^ 0xa5a5a5);
    this.mat = { ...ARCHETYPES.mist.material, palette: ARCHETYPES.mist.palette.map((c) => [...c]) as Palette };
    this.computeMaterial();
  }

  /**
   * `dt`: wall seconds since the last update (axes, blend and words smooth on it).
   * `musicDt`: music-time seconds (MusicClock.advance) — the gesture reservoir moves
   * only on music time, so silence freezes the motion. Defaults to `dt`.
   * `melody`: the melody tracker's frame for this update, or null.
   */
  update(d: Descriptors, tags: NeuralTags | null, f: Features, dt: number, musicDt = dt, melody: MelodyFrame | null = null): Character {
    dt = clamp(Number.isFinite(dt) ? dt : 1 / 60, 1e-4, 0.25);
    musicDt = Number.isFinite(musicDt) ? clamp(musicDt, 0, 0.25) : dt;
    this.lastDt = dt;
    this.trackMelody(melody, dt);
    const presenceTarget = 1 - val(d.silence);
    this.presence += alpha(dt, presenceTarget > this.presence ? 0.5 : 1.2) * (presenceTarget - this.presence);
    const p = this.presence;

    // 1. Axes: descriptors (+ tags) → targets, gated by presence, then smoothed.
    const target = descriptorAxes(d, this.melReg);
    const ev = tags ? tagEvidence(tags) : null;
    let change = 0;
    for (const k of AXES) {
      let t = target[k] + (ev?.axes[k] ?? 0);
      t = k === 'valence' ? clamp(t, -1, 1) : clamp01(t);
      t = REST[k] + (t - REST[k]) * p;
      const cur = this.axes[k];
      const [up, down] = TAU[k];
      this.axes[k] = cur + alpha(dt, t > cur ? up : down) * (t - cur);
      change += Math.abs(t - this.axes[k]) * (k === 'valence' ? 0.5 : 1);
    }
    // Novelty: how far targets are from where we are (high right after a change).
    this.novelty += alpha(dt, 0.4) * (clamp01(change / 1.2) - this.novelty);
    const ta = alpha(dt, 1.5);
    this.texture.pulse += ta * (val(d.pulseClarity) * p - this.texture.pulse);
    this.texture.noise += ta * (val(d.noisiness) * p - this.texture.noise);
    this.texture.tonal += ta * (val(d.keyClarity) * p - this.texture.tonal);
    this.brightness += ta * (val(d.brightness) - this.brightness);

    // 2. Archetype blend: softmax over distances, incumbent bonus, smoothed weights.
    const bias: Partial<Record<ArchetypeId, number>> = { ...(ev?.arch ?? {}) };
    bias[this.top] = (bias[this.top] ?? 0) + INCUMBENT_BONUS;
    const like = archetypeLikelihoods(spacePoint(this.axes, this.texture), bias);
    const wa = alpha(dt, 1.0);
    let best: ArchetypeId = this.top;
    for (const id of ARCHETYPE_IDS) {
      this.weights[id] += wa * (like[id] - this.weights[id]);
      if (this.weights[id] > this.weights[best]) best = id;
    }
    // `top` (the heaviest archetype, with the incumbent bonus as hysteresis) shapes
    // the blend; `leader` (top, held for LEADER_DWELL) names it.
    this.top = best;
    if (best === this.leader) {
      this.challengeTime = 0;
    } else {
      if (best !== this.challenger) this.challengeTime = 0;
      this.challenger = best;
      this.challengeTime += dt;
      if (this.challengeTime >= LEADER_DWELL || this.weights[best] - this.weights[this.leader] > LEADER_MARGIN) {
        this.leader = best;
        this.challengeTime = 0;
      }
    }
    const blend = ARCHETYPE_IDS.map((id) => ({ id, weight: this.weights[id] })).sort((a, b) => b.weight - a.weight);
    const total = blend.reduce((s, b) => s + b.weight, 0) || 1;
    for (const b of blend) b.weight /= total;

    // 3. Confidence: present, decisive blend, not mid-change.
    const clarity = clamp01((blend[0].weight - blend[1].weight) * 2 + blend[0].weight * 0.5);
    const confTarget = clamp01(p * (0.45 + 0.55 * clarity) * (1 - 0.6 * this.novelty));
    this.confidence += alpha(dt, 0.5) * (confTarget - this.confidence);

    // 4. Words: refreshed once a second so they can be read, or at once when the leader changes.
    this.wordClock -= dt;
    const leaderWord = ARCHETYPES[this.leader].words[0];
    if (this.wordClock <= 0 || (p >= PRESENCE_ON && this.words[0] !== leaderWord)) {
      this.wordClock = 1;
      this.words = this.describe(blend);
    }

    // 5. Material and gesture. Palette weights: sharpened (w^γ), then smoothed so the
    // sharper crossover between two close archetypes stays a drift, not a jump.
    let pSum = 0;
    for (const id of ARCHETYPE_IDS) pSum += this.weights[id] ** PALETTE_GAMMA;
    const pa = alpha(dt, PALETTE_TAU);
    for (const id of ARCHETYPE_IDS) this.palWeights[id] += pa * (this.weights[id] ** PALETTE_GAMMA / (pSum || 1) - this.palWeights[id]);
    this.computeMaterial(val(d.noisiness));
    this.reservoir.update(d, f, this.axes, musicDt);
    this.trackFlux(f);

    return {
      axes: { ...this.axes },
      blend,
      words: [...this.words],
      confidence: clamp01(this.confidence),
    };
  }

  material(): Material {
    return this.mat;
  }

  gesture(): Gesture {
    return this.reservoir.gesture;
  }

  /**
   * Sound events for this frame: one per detected onset (weak onsets are dropped),
   * plus sparse continuous ticks while the music is loud and sustained, so legato
   * passages keep feeding the canvas. At most 2 events per frame. Onsets are
   * placed at the pitch height where the spectrum just grew (kick low, bell high);
   * continuous ticks at the register of what is sounding.
   */
  events(f: Features, d: Descriptors): SoundEvent[] {
    const out: SoundEvent[] = [];
    const dt = this.lastDt;
    const p = this.presence;
    if (p < PRESENCE_ON) {
      this.emitAcc = 0;
      return out;
    }
    const tonal = clamp01((f.tonality - 0.3) / 0.4);
    const note = tonal > 0 ? f.note : -1;
    // A voiced tune sets the height of what is sounding (the spectrum's register is the bass's).
    const mel = this.mel;
    const tune = mel?.voiced ? midiHeight(mel.pitch) : NaN;
    const height = Number.isFinite(tune) ? clamp01(tune + (this.rnd() * 2 - 1) * 0.02) : this.eventHeight(f, d, tonal);
    const g = this.reservoir.gesture;
    const jitter = this.mat.jitter;
    const pan = () => clamp(g.x + (this.rnd() * 2 - 1) * (0.15 + 0.6 * jitter), -1, 1);

    // `f.onset` must be true for one frame per onset (AudioEngine.analyze guarantees
    // it); a Features object re-read on a frame that ran no analysis hop keeps its
    // stale onset flag and time, so a repeated nonzero f.time is not a new onset.
    const fresh = !(f.time > 0 && f.time === this.lastOnsetTime);
    if (f.onset && fresh && f.onsetStrength >= 0.06) {
      this.lastOnsetTime = f.time;
      const strength = clamp01((0.35 + 0.65 * f.onsetStrength) * (0.5 + 0.5 * this.axes.energy) * p);
      // Onsets sit where the new sound is (spectral growth), anchored a little to the register.
      // A melody note starting with the onset puts it at the note; anything else (a kick under the tune) stays where it grew.
      const h = mel?.noteOn && mel.note
        ? midiHeight(mel.note.midi)
        : Number.isFinite(this.fluxHeight)
          ? clamp01(0.3 * val(d.register) + 0.7 * this.fluxHeight + (this.rnd() * 2 - 1) * 0.02)
          : height;
      out.push({ height: h, pan: pan(), strength, note, color: this.eventColor(h, strength, note, tonal), onset: true });
    }
    // Continuous emission: up to ~5/s for loud legato, nothing for dry staccato.
    const loudGate = clamp01((val(d.loudness) - 0.12) / 0.35);
    const rate = 5 * val(d.sustain) * loudGate * (1 - 0.7 * this.axes.sharpness) * p;
    this.emitAcc = Math.min(2, this.emitAcc + rate * dt);
    if (this.emitAcc >= 1 && out.length < 2) {
      this.emitAcc -= 1;
      const strength = clamp01(0.2 + 0.4 * loudGate * this.axes.energy);
      const h = clamp01(height + (this.rnd() * 2 - 1) * 0.05);
      out.push({ height: h, pan: pan(), strength, note, color: this.eventColor(h, strength, note, tonal), onset: false });
    }
    return out;
  }

  // ── internals ──

  /**
   * Smooths the tune's register (τ ≈ 1 s while voiced) so the size axis doesn't
   * chatter with voicing flicker; held through gaps between phrases, forgotten
   * after 2 s without a tune (the spectrum's register takes over again).
   */
  private trackMelody(m: MelodyFrame | null, dt: number) {
    this.mel = m;
    if (m?.voiced && Number.isFinite(m.pitch)) {
      const h = midiHeight(m.pitch);
      this.melReg = Number.isFinite(this.melReg) ? this.melReg + alpha(dt, 1) * (h - this.melReg) : h;
      this.melQuiet = 0;
    } else if ((this.melQuiet += dt) > 2) {
      this.melReg = NaN;
    }
  }

  /**
   * Where in pitch height the spectrum just grew: the centroid of the squared
   * positive change of `f.spectrum` since the last update, on the C1 = 0 … C8 = 1
   * scale (everything above C8 counts as 1). An onset happens where the new sound
   * is — a kick at the bottom, a celesta note or a hi-hat at the top — whereas the
   * loudest peak is almost always the bass. f.spectrum carries v1's display tilt
   * (+≈6 dB/oct towards the top), a rough stand-in for the ear's higher
   * sensitivity there, so it is used as is. NaN when nothing grew.
   */
  private trackFlux(f: Features): void {
    const spec = f.spectrum;
    const n = spec?.length ?? 0;
    if (n === 0) {
      this.fluxHeight = NaN;
      return;
    }
    if (this.prevSpec.length !== n) this.prevSpec = new Float32Array(n);
    const lo = Math.log(30);
    const span = Math.log(14000) - lo;
    let w = 0;
    let h = 0;
    for (let i = 0; i < n; i++) {
      const v = Number.isFinite(spec[i]) ? spec[i] : 0;
      const g = v - this.prevSpec[i];
      this.prevSpec[i] = v;
      if (g <= 0) continue;
      const hz = Math.exp(lo + ((i + 0.5) / n) * span);
      w += g * g;
      h += g * g * clamp01(Math.log2(hz / 32.7) / 7);
    }
    this.fluxHeight = w > 1e-8 ? h / w : NaN;
  }

  /**
   * Pitch height of what is sounding now: the descriptor register blended with the
   * dominant peak of the (de-tilted) spectrum, on the C1 = 0 … C8 = 1 scale. For
   * unpitched hits, the bass/treble balance stands in (kick low, hi-hat high).
   */
  private eventHeight(f: Features, d: Descriptors, tonal: number): number {
    const reg = val(d.register);
    const spec = f.spectrum;
    const n = spec.length;
    let wSum = 0;
    let hSum = 0;
    if (n > 0) {
      const lo = Math.log(30);
      const span = Math.log(14000) - lo;
      for (let i = 0; i < n; i++) {
        const v = spec[i] / (1 + (i * 64) / n / 16);
        const hz = Math.exp(lo + ((i + 0.5) / n) * span);
        if (hz < 32.7 || hz > 4186) continue;
        const w = v * v * v * v;
        wSum += w;
        hSum += w * (Math.log2(hz / 32.7) / 7);
      }
    }
    const inst = wSum > 1e-9 ? hSum / wSum : reg;
    const pitched = 0.5 * reg + 0.5 * inst;
    const bt = f.bass + f.treble;
    const unpitched = 0.5 * reg + 0.5 * (bt > 1e-6 ? 0.15 + 0.7 * (f.treble / bt) : 0.5);
    return clamp01(unpitched + (pitched - unpitched) * tonal + (this.rnd() * 2 - 1) * 0.03);
  }

  /** Higher and stronger events take lighter palette stops; the note's hue tints them. */
  private eventColor(height: number, strength: number, note: number, tonal: number): Rgb {
    const base = samplePalette(this.mat.palette, 0.25 + 0.4 * height + 0.35 * strength);
    if (note < 0) return base;
    let tint = 0;
    for (const id of ARCHETYPE_IDS) tint += this.weights[id] * ARCHETYPES[id].noteTint;
    return tintKeepLuma(base, noteRgb(note), tint * tonal);
  }

  private describe(blend: { id: ArchetypeId; weight: number }[]): string[] {
    if (this.presence < PRESENCE_ON) return ['silent'];
    // The leader (with dwell) names the music; a strong runner-up adds its word.
    const lead = this.leader;
    const words = [ARCHETYPES[lead].words[0]];
    const second = blend.find((b) => b.id !== lead)!;
    if (second.weight > 0.3) words.push(ARCHETYPES[second.id].words[0]);
    let bestDev = 0.5;
    let bestWord = '';
    for (const [k, spec] of Object.entries(AXIS_WORDS) as [AxisName, [string, string, number, number]][]) {
      const dev = (this.axes[k] - spec[2]) / spec[3];
      const w = dev > 0 ? spec[1] : spec[0];
      if (Math.abs(dev) > bestDev && !words.includes(w) && !ARCHETYPES[lead].words.includes(w)) {
        bestDev = Math.abs(dev);
        bestWord = w;
      }
    }
    if (bestWord) words.push(bestWord);
    return words.slice(0, 3);
  }

  /** Weighted blend of archetype materials, then continuous per-axis modulation on top. */
  private computeMaterial(noisiness = 0): void {
    const a = this.axes;
    const mix = {} as MaterialShape;
    for (const key of Object.keys(ARCHETYPES.fire.material) as (keyof MaterialShape)[]) {
      let s = 0;
      for (const id of ARCHETYPE_IDS) s += this.weights[id] * ARCHETYPES[id].material[key];
      mix[key] = s;
    }
    // Colors are mixed with sharpened weights (w^γ, renormalized, smoothed): averaging
    // the blackbody of fire with storm's steel violet gives a dusty mauve that reads
    // as neither, so the leading palette dominates while transitions stay continuous.
    const pal: Palette = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const id of ARCHETYPE_IDS) {
      const w = this.palWeights[id];
      if (w < 1e-4) continue;
      const ap = ARCHETYPES[id].palette;
      for (let s = 0; s < 4; s++) for (let c = 0; c < 3; c++) pal[s][c] += w * ap[s][c];
    }
    const quiet = this.presence;
    const t = this.mat;
    // `x * blendShare + axisTerm * (1 − blendShare)`: the archetype sets the base,
    // the axes keep it moving continuously inside one archetype.
    const mixIn = (base: number, axis: number, share: number) => clamp01(base * share + axis * (1 - share));
    t.splatSize = mixIn(mix.splatSize, a.size, 0.4);
    t.sparkSize = mixIn(mix.sparkSize, 0.8 * a.size + 0.2 * a.weight, 0.5);
    t.vorticity = mixIn(mix.vorticity, a.agitation, 0.6);
    t.jitter = mixIn(mix.jitter, a.agitation, 0.5);
    t.angularity = mixIn(mix.angularity, a.sharpness, 0.5);
    t.viscosity = mixIn(mix.viscosity, 0.6 * a.weight + 0.4 * (1 - a.pace), 0.6);
    t.gravity = mixIn(mix.gravity, clamp01((a.weight - 0.4) * 1.6), 0.6);
    t.buoyancy = mixIn(mix.buoyancy, a.warmth * a.energy * (1 - a.weight), 0.6);
    t.splatForce = mixIn(mix.splatForce, a.energy, 0.5);
    t.dyeFade = mixIn(mix.dyeFade, 0.6 * a.pace + 0.4 * a.sharpness, 0.6);
    t.sparkAmount = mixIn(mix.sparkAmount, a.sharpness * (0.4 + 0.6 * a.density), 0.6) * (0.3 + 0.7 * quiet);
    t.sparkLife = mixIn(mix.sparkLife, 1 - a.pace, 0.6);
    t.twinkle = mixIn(mix.twinkle, a.sharpness * (1 - a.weight), 0.6);
    t.emissive = mixIn(mix.emissive, a.energy, 0.6) * (0.4 + 0.6 * quiet);
    t.contrast = mixIn(mix.contrast, a.energy, 0.7);
    t.grain = mixIn(mix.grain, noisiness, 0.7);
    t.aura = mixIn(mix.aura, 1 - a.density, 0.7);
    t.palette = moodPalette(pal, a.valence, a.energy);
  }
}

/** MIDI note number → height on the C1 = 0 … C8 = 1 scale (C4 = 60). */
export const midiHeight = (note: number) => clamp01((note - 24) / 84);

/**
 * A SoundEvent for a played key, so a MIDI keyboard can paint directly: height from
 * the note, pan laid out like the keyboard (low left, high right), color from the
 * current palette tinted by the note's synesthetic hue.
 */
export function midiEvent(note: number, velocity: number, material: Material): SoundEvent {
  const height = midiHeight(note);
  const strength = clamp01(velocity);
  const pc = ((Math.round(note) % 12) + 12) % 12;
  const base = samplePalette(material.palette, 0.25 + 0.4 * height + 0.35 * strength);
  return {
    height,
    pan: (height * 2 - 1) * 0.7,
    strength,
    note: pc,
    color: tintKeepLuma(base, noteRgb(pc), 0.5),
    onset: true,
  };
}
