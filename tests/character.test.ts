import { describe, expect, it } from 'vitest';
import {
  CharacterEngine, archetypeLikelihoods, descriptorAxes, midiEvent, midiHeight, spacePoint, tagEvidence,
} from '../src/character/character';
import { ARCHETYPES } from '../src/character/archetypes';
import { EchoStateNetwork, GestureReservoir, mulberry32 } from '../src/character/reservoir';
import { luma, moodPalette } from '../src/character/palette';
import { ARCHETYPE_IDS, neutralDescriptors, type Character, type Descriptors, type NeuralTags } from '../src/character/types';
import { emptyFeatures, type Features } from '../src/audio/features';
import type { MelodyFrame } from '../src/audio/types';

const desc = (over: Partial<Descriptors>): Descriptors => ({ ...neutralDescriptors(), silence: 0, ...over });

/** Canonical musical characters, as synthetic medium-timescale descriptors. */
const CASES = {
  // Dance of the Sugar Plum Fairy: celesta up high, pizzicato, light, quick, (nominally) major.
  sugarPlum: desc({
    loudness: 0.35, dynamics: 0.3, register: 0.75, registerSpread: 0.3, brightness: 0.7, noisiness: 0.1, roughness: 0.1,
    onsetRate: 0.5, irregularity: 0.3, attack: 0.85, sustain: 0.2, tempo: 0.6, pulseClarity: 0.5, majorness: 0.6,
    keyClarity: 0.7, harmonicChange: 0.4, pitchMotion: 0.6,
  }),
  // Rachmaninoff prelude in C♯ minor: very low, loud, sustained bell chords, slow, minor, dark.
  rachmaninoff: desc({
    loudness: 0.8, dynamics: 0.4, register: 0.22, registerSpread: 0.6, brightness: 0.2, noisiness: 0.1, roughness: 0.3,
    onsetRate: 0.15, irregularity: 0.3, attack: 0.3, sustain: 0.85, tempo: 0.3, pulseClarity: 0.3, majorness: -0.8,
    keyClarity: 0.7, harmonicChange: 0.3, pitchMotion: 0.2,
  }),
  // Erratic fire: dense irregular onsets, big dynamic contrast, sharp, minor & rough, mid-high register.
  fire: desc({
    loudness: 0.65, dynamics: 0.7, register: 0.6, registerSpread: 0.5, brightness: 0.6, noisiness: 0.2, roughness: 0.45,
    onsetRate: 0.7, irregularity: 0.8, attack: 0.75, sustain: 0.35, tempo: 0.75, pulseClarity: 0.25, majorness: -0.5,
    keyClarity: 0.4, harmonicChange: 0.6, pitchMotion: 0.7,
  }),
  // Serene: soft, slow, legato, consonant.
  serene: desc({
    loudness: 0.18, dynamics: 0.1, register: 0.55, registerSpread: 0.4, brightness: 0.4, noisiness: 0.05, roughness: 0.05,
    onsetRate: 0.05, irregularity: 0.2, attack: 0.1, sustain: 0.9, tempo: 0, pulseClarity: 0.1, majorness: 0.3,
    keyClarity: 0.6, harmonicChange: 0.1, pitchMotion: 0.1,
  }),
  // Steady electronic: metronomic pulse, noisy drums, little tonality.
  electronic: desc({
    loudness: 0.7, dynamics: 0.2, register: 0.45, registerSpread: 0.7, brightness: 0.65, noisiness: 0.6, roughness: 0.3,
    onsetRate: 0.6, irregularity: 0.15, attack: 0.8, sustain: 0.4, tempo: 0.7, pulseClarity: 0.9, majorness: 0,
    keyClarity: 0.2, harmonicChange: 0.1, pitchMotion: 0.2,
  }),
};

/** Runs an engine for `seconds` at a fixed frame rate and returns the last Character. */
function run(e: CharacterEngine, d: Descriptors | ((t: number) => Descriptors), seconds: number, fps = 60, f: Features = emptyFeatures()) {
  let ch!: Character;
  const n = Math.round(seconds * fps);
  for (let i = 0; i < n; i++) ch = e.update(typeof d === 'function' ? d(i / fps) : d, null, f, 1 / fps);
  return ch;
}

const weightOf = (ch: Character, id: string) => ch.blend.find((b) => b.id === id)!.weight;

function checkInvariants(ch: Character) {
  expect(ch.blend.length).toBe(8);
  expect(ch.blend.reduce((s, b) => s + b.weight, 0)).toBeCloseTo(1, 6);
  for (let i = 1; i < ch.blend.length; i++) expect(ch.blend[i].weight).toBeLessThanOrEqual(ch.blend[i - 1].weight);
  expect(ch.words.length).toBeGreaterThanOrEqual(1);
  expect(ch.words.length).toBeLessThanOrEqual(3);
  expect(ch.confidence).toBeGreaterThanOrEqual(0);
  expect(ch.confidence).toBeLessThanOrEqual(1);
  for (const [k, v] of Object.entries(ch.axes)) {
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(k === 'valence' ? -1 : 0);
    expect(v).toBeLessThanOrEqual(1);
  }
}

describe('character: canonical cases', () => {
  it('Sugar Plum (high, staccato, light, quick) → sugar: tiny, light, sharp, quick', () => {
    const ch = run(new CharacterEngine(), CASES.sugarPlum, 10);
    checkInvariants(ch);
    expect(ch.blend[0].id).toBe('sugar');
    expect(ch.blend[0].weight).toBeGreaterThan(0.5);
    expect(ch.axes.size).toBeLessThan(0.3);
    expect(ch.axes.weight).toBeLessThan(0.3);
    expect(ch.axes.sharpness).toBeGreaterThan(0.7);
    expect(ch.axes.pace).toBeGreaterThan(0.6);
    expect(ch.words[0]).toBe('whimsical');
  });

  it('Sugar Plum stays sugar even when the mode reads minor (it is in E minor)', () => {
    const ch = run(new CharacterEngine(), { ...CASES.sugarPlum, majorness: -0.5 }, 10);
    expect(ch.blend[0].id).toBe('sugar');
  });

  it('Rachmaninoff (low, loud, sustained, slow, minor, dark) → abyss, not storm: heavy, huge, sad', () => {
    const ch = run(new CharacterEngine(), CASES.rachmaninoff, 10);
    checkInvariants(ch);
    expect(ch.blend[0].id).toBe('abyss');
    expect(weightOf(ch, 'abyss')).toBeGreaterThan(weightOf(ch, 'storm') * 3);
    expect(ch.axes.weight).toBeGreaterThan(0.8);
    expect(ch.axes.size).toBeGreaterThan(0.8);
    expect(ch.axes.valence).toBeLessThan(-0.5);
    expect(ch.axes.sharpness).toBeLessThan(0.35);
    expect(ch.axes.pace).toBeLessThan(0.45);
  });

  it('erratic fire (dense, irregular, dynamic, sharp, minor) → fire: agitated and quick', () => {
    const ch = run(new CharacterEngine(), CASES.fire, 10);
    checkInvariants(ch);
    expect(ch.blend[0].id).toBe('fire');
    expect(ch.axes.agitation).toBeGreaterThan(0.75);
    expect(ch.axes.energy).toBeGreaterThan(0.7);
    expect(ch.words).toContain('fiery');
  });

  it('serene (soft, slow, legato, consonant) → mist: calm and round', () => {
    const ch = run(new CharacterEngine(), CASES.serene, 10);
    checkInvariants(ch);
    expect(ch.blend[0].id).toBe('mist');
    expect(ch.axes.energy).toBeLessThan(0.3);
    expect(ch.axes.agitation).toBeLessThan(0.25);
    expect(ch.axes.sharpness).toBeLessThan(0.2);
  });

  it('steady electronic (metronomic, noisy) → machine', () => {
    const ch = run(new CharacterEngine(), CASES.electronic, 10);
    checkInvariants(ch);
    expect(ch.blend[0].id).toBe('machine');
  });

  it('silence → low energy, low confidence, "silent", no crash', () => {
    const e = new CharacterEngine();
    const ch = run(e, neutralDescriptors(), 10);
    checkInvariants(ch);
    expect(ch.axes.energy).toBeLessThan(0.05);
    expect(ch.confidence).toBeLessThan(0.05);
    expect(ch.words).toEqual(['silent']);
    expect(e.events({ ...emptyFeatures(), onset: true, onsetStrength: 1 }, neutralDescriptors())).toEqual([]);
  });

  it('music fading to silence drops energy and confidence', () => {
    const e = new CharacterEngine();
    const loud = run(e, CASES.fire, 8);
    const quiet = run(e, neutralDescriptors(), 8);
    expect(quiet.axes.energy).toBeLessThan(loud.axes.energy * 0.2);
    expect(quiet.confidence).toBeLessThan(0.1);
  });

  it('garbage input (NaN, out of range) does not poison the state', () => {
    const e = new CharacterEngine();
    const bad = desc({ loudness: NaN, register: 7, majorness: -Infinity, tempo: NaN, onsetRate: -3 });
    const ch = run(e, bad, 3);
    checkInvariants(ch);
    const after = run(e, CASES.sugarPlum, 10);
    expect(after.blend[0].id).toBe('sugar');
  });
});

describe('character: axes move the right way (monotone cross-modal mappings)', () => {
  const base = CASES.sugarPlum;
  const ax = (o: Partial<Descriptors>) => descriptorAxes({ ...base, ...o });
  it('lower register → bigger and heavier', () => {
    expect(ax({ register: 0.2 }).size).toBeGreaterThan(ax({ register: 0.8 }).size);
    expect(ax({ register: 0.2 }).weight).toBeGreaterThan(ax({ register: 0.8 }).weight);
  });
  it('louder → bigger and more energetic', () => {
    expect(ax({ loudness: 0.9 }).size).toBeGreaterThan(ax({ loudness: 0.2 }).size);
    expect(ax({ loudness: 0.9 }).energy).toBeGreaterThan(ax({ loudness: 0.2 }).energy);
  });
  it('sharper attack → sharper; more sustain → rounder', () => {
    expect(ax({ attack: 0.9 }).sharpness).toBeGreaterThan(ax({ attack: 0.1 }).sharpness);
    expect(ax({ sustain: 0.9 }).sharpness).toBeLessThan(ax({ sustain: 0.1 }).sharpness);
  });
  it('more onsets / faster tempo → quicker pace', () => {
    expect(ax({ onsetRate: 0.8, tempo: 0.8 }).pace).toBeGreaterThan(ax({ onsetRate: 0.1, tempo: 0.3 }).pace);
  });
  it('irregular, rough and dynamic → agitated', () => {
    expect(ax({ irregularity: 0.9, roughness: 0.6, dynamics: 0.8 }).agitation)
      .toBeGreaterThan(ax({ irregularity: 0.1, roughness: 0, dynamics: 0.1 }).agitation + 0.3);
  });
  it('major + fast → positive valence; minor + slow → negative (Palmer et al.)', () => {
    expect(ax({ majorness: 1, onsetRate: 0.7, tempo: 0.8 }).valence).toBeGreaterThan(0.4);
    expect(ax({ majorness: -1, onsetRate: 0.05, tempo: 0.25 }).valence).toBeLessThan(-0.4);
  });
  it('mode only counts when a key is clear', () => {
    const clear = ax({ majorness: -1, keyClarity: 1 }).valence - ax({ majorness: 1, keyClarity: 1 }).valence;
    const vague = ax({ majorness: -1, keyClarity: 0 }).valence - ax({ majorness: 1, keyClarity: 0 }).valence;
    expect(Math.abs(vague)).toBeLessThan(Math.abs(clear) * 0.5);
  });
  it('warmth follows energy and valence', () => {
    expect(ax({ loudness: 0.9, majorness: 1 }).warmth).toBeGreaterThan(ax({ loudness: 0.1, majorness: -1 }).warmth);
  });
});

describe('character: smoothing and blend stability', () => {
  it('does not flicker between two archetypes on a noisy midpoint', () => {
    const rnd = mulberry32(7);
    const mid: Descriptors = { ...CASES.fire };
    for (const k of Object.keys(mid) as (keyof Descriptors)[]) mid[k] = (CASES.fire[k] + CASES.electronic[k]) / 2;
    const e = new CharacterEngine();
    let leader = '';
    let changes = 0;
    for (let i = 0; i < 60 * 60; i++) {
      const d = { ...mid };
      for (const k of ['loudness', 'irregularity', 'pulseClarity', 'noisiness', 'onsetRate'] as const) {
        d[k] = Math.min(1, Math.max(0, d[k] + (rnd() - 0.5) * 0.15));
      }
      const ch = e.update(d, null, emptyFeatures(), 1 / 60);
      if (i > 600 && ch.blend[0].id !== leader) changes++;
      leader = ch.blend[0].id;
    }
    expect(changes).toBeLessThanOrEqual(2);
  });

  it('is frame-rate independent (30 vs 144 fps)', () => {
    const a = run(new CharacterEngine(), CASES.rachmaninoff, 3, 30);
    const b = run(new CharacterEngine(), CASES.rachmaninoff, 3, 144);
    for (const k of Object.keys(a.axes) as (keyof Character['axes'])[]) expect(Math.abs(a.axes[k] - b.axes[k])).toBeLessThan(0.03);
    expect(Math.abs(weightOf(a, 'abyss') - weightOf(b, 'abyss'))).toBeLessThan(0.05);
  });

  it('a sudden change rises fast but the blend settles over seconds', () => {
    const e = new CharacterEngine();
    run(e, CASES.serene, 8);
    const after1 = run(e, CASES.fire, 0.5);
    expect(after1.axes.energy).toBeGreaterThan(0.5);
    expect(after1.blend[0].id).not.toBe('fire');
    const later = run(e, CASES.fire, 8);
    expect(later.blend[0].id).toBe('fire');
  });
});

describe('character: words', () => {
  it('the named archetype ignores a brief challenger but follows a lasting change', () => {
    const e = new CharacterEngine();
    run(e, CASES.fire, 10);
    expect(run(e, CASES.fire, 0.1).words[0]).toBe('fiery');
    // A 2.3 s excursion lets machine out-weigh fire for ≈1.2 s: not enough to rename the music…
    const names = new Set<string>();
    let machineLed = false;
    for (let i = 0; i < 300; i++) {
      const ch = e.update(i < 140 ? CASES.electronic : CASES.fire, null, emptyFeatures(), 1 / 60);
      names.add(ch.words[0]);
      machineLed ||= ch.blend[0].id === 'machine';
    }
    expect(machineLed).toBe(true);
    expect([...names]).toEqual(['fiery']);
    // …but staying there is.
    expect(run(e, CASES.electronic, 8).words[0]).toBe('mechanical');
  });
});

describe('character: material', () => {
  it('a mixed blend keeps the leading palette recognisable (fire stays warm)', () => {
    // Hungarian Dance no. 5 medians: fire ≈ 0.47, storm ≈ 0.34. A plain linear mix of
    // blackbody and steel violet reads as dusty mauve (red/blue ≈ 4.4 and 2.4 on the mid stops).
    const hu = desc({ loudness: 0.77, dynamics: 0.34, register: 0.56, registerSpread: 0.77, brightness: 0.51, noisiness: 0.21, roughness: 0.69, onsetRate: 0.3, irregularity: 0.64, attack: 0.38, sustain: 0.53, tempo: 0.47, pulseClarity: 0.18, majorness: -0.48, keyClarity: 0.76, harmonicChange: 0.55, pitchMotion: 0.33 });
    const e = new CharacterEngine();
    const ch = run(e, hu, 10);
    expect(ch.blend[0].id).toBe('fire');
    expect(weightOf(ch, 'storm')).toBeGreaterThan(0.2);
    const pal = e.material().palette;
    expect(pal[1][0]).toBeGreaterThan(6 * pal[1][2]);
    expect(pal[2][0]).toBeGreaterThan(3 * pal[2][2]);
  });

  it('follows the archetype and the axes', () => {
    const sugar = new CharacterEngine();
    run(sugar, CASES.sugarPlum, 10);
    const abyss = new CharacterEngine();
    run(abyss, CASES.rachmaninoff, 10);
    const fire = new CharacterEngine();
    run(fire, CASES.fire, 10);
    const ms = sugar.material();
    const ma = abyss.material();
    const mf = fire.material();
    expect(ms.splatSize).toBeLessThan(0.25);
    expect(ma.splatSize).toBeGreaterThan(0.8);
    expect(ms.sparkAmount).toBeGreaterThan(ma.sparkAmount + 0.4);
    expect(ms.twinkle).toBeGreaterThan(0.6);
    expect(ma.gravity).toBeGreaterThan(0.6);
    expect(ma.viscosity).toBeGreaterThan(0.7);
    expect(mf.buoyancy).toBeGreaterThan(0.6);
    expect(mf.vorticity).toBeGreaterThan(0.7);
    expect(mf.jitter).toBeGreaterThan(0.6);
    // Abyss is dark: even its highlight is dim.
    expect(luma(ma.palette[3])).toBeLessThan(0.25);
    expect(luma(ma.palette[3])).toBeLessThan(luma(ms.palette[3]) * 0.3);
    // Fire is a blackbody: highlight is warm (R ≥ G > B).
    const hi = mf.palette[3];
    expect(hi[0]).toBeGreaterThanOrEqual(hi[1]);
    expect(hi[1]).toBeGreaterThan(hi[2]);
    for (const m of [ms, ma, mf]) {
      for (const v of Object.values(m)) if (typeof v === 'number') expect(v >= 0 && v <= 1).toBe(true);
    }
  });

  it('splat size follows axes.size continuously within one archetype', () => {
    const hi = new CharacterEngine();
    run(hi, { ...CASES.rachmaninoff, register: 0.3, loudness: 0.6 }, 10);
    const lo = new CharacterEngine();
    run(lo, { ...CASES.rachmaninoff, register: 0.1, loudness: 0.95 }, 10);
    expect(lo.material().splatSize).toBeGreaterThan(hi.material().splatSize);
  });

  it('Palmer modulation keeps every palette monotone in luminance and bounded', () => {
    for (const id of ARCHETYPE_IDS) {
      for (const v of [-1, 0, 1]) {
        for (const e of [0, 1]) {
          const p = moodPalette(ARCHETYPES[id].palette, v, e);
          for (let i = 1; i < 4; i++) expect(luma(p[i])).toBeGreaterThan(luma(p[i - 1]));
          for (const c of p) for (const x of c) expect(x >= 0 && x <= 1).toBe(true);
        }
      }
      // Valence lightens, and abyss stays dark even when happy.
      expect(luma(moodPalette(ARCHETYPES[id].palette, 1, 0.5)[2])).toBeGreaterThan(luma(moodPalette(ARCHETYPES[id].palette, -1, 0.5)[2]));
    }
    expect(luma(moodPalette(ARCHETYPES.abyss.palette, 1, 1)[3])).toBeLessThan(0.25);
  });
});

describe('character: events', () => {
  const onsetFeatures = (note: number, tonality: number): Features => {
    const f = emptyFeatures();
    f.onset = true;
    f.onsetStrength = 0.8;
    f.note = note;
    f.tonality = tonality;
    f.level = 0.7;
    return f;
  };

  it('emits one onset event per onset, with sane fields; drums are unpitched', () => {
    const e = new CharacterEngine();
    run(e, CASES.sugarPlum, 5);
    const evs = e.events(onsetFeatures(4, 0.9), CASES.sugarPlum);
    const on = evs.filter((v) => v.onset);
    expect(on.length).toBe(1);
    expect(on[0].note).toBe(4);
    expect(on[0].height).toBeGreaterThan(0.5);
    expect(on[0].strength).toBeGreaterThan(0.3);
    for (const x of on[0].color) expect(x >= 0 && x <= 1).toBe(true);
    const drum = e.events(onsetFeatures(4, 0.1), CASES.sugarPlum).filter((v) => v.onset);
    expect(drum[0].note).toBe(-1);
  });

  it('low music makes low events, high music high events', () => {
    const low = new CharacterEngine();
    run(low, CASES.rachmaninoff, 5);
    const high = new CharacterEngine();
    run(high, CASES.sugarPlum, 5);
    const hl = low.events(onsetFeatures(1, 0.9), CASES.rachmaninoff)[0].height;
    const hh = high.events(onsetFeatures(4, 0.9), CASES.sugarPlum)[0].height;
    expect(hh).toBeGreaterThan(hl + 0.25);
  });

  it('sustained loud music emits sparse continuous ticks; dry staccato does not', () => {
    const count = (d: Descriptors) => {
      const e = new CharacterEngine();
      run(e, d, 5);
      let n = 0;
      const f = emptyFeatures();
      for (let i = 0; i < 600; i++) {
        e.update(d, null, f, 1 / 60);
        n += e.events(f, d).filter((v) => !v.onset).length;
      }
      return n / 10;
    };
    const legato = count(CASES.rachmaninoff);
    const staccato = count({ ...CASES.sugarPlum, sustain: 0 });
    expect(legato).toBeGreaterThan(1);
    expect(legato).toBeLessThan(6);
    expect(staccato).toBe(0);
  });

  it('a stale onset (same features re-read on a frame with no analysis hop) is not emitted twice', () => {
    const e = new CharacterEngine();
    run(e, CASES.sugarPlum, 5);
    const f = onsetFeatures(4, 0.9);
    f.time = 12.5;
    let n = 0;
    for (let i = 0; i < 3; i++) {
      e.update(CASES.sugarPlum, null, f, 1 / 144);
      n += e.events(f, CASES.sugarPlum).filter((v) => v.onset).length;
    }
    expect(n).toBe(1);
    f.time = 12.6;
    e.update(CASES.sugarPlum, null, f, 1 / 144);
    expect(e.events(f, CASES.sugarPlum).filter((v) => v.onset).length).toBe(1);
  });

  it('onsets sit where the spectrum grew: a kick low, a high note high', () => {
    const heightOf = (lo: number, hi: number) => {
      const e = new CharacterEngine();
      const f = emptyFeatures();
      f.spectrum.fill(0.2);
      run(e, CASES.fire, 5, 60, f);
      const g = onsetFeatures(4, 0.9);
      g.spectrum.fill(0.2);
      for (let i = lo; i < hi; i++) g.spectrum[i] = 0.9;
      e.update(CASES.fire, null, g, 1 / 60);
      return e.events(g, CASES.fire).find((v) => v.onset)!.height;
    };
    const kick = heightOf(2, 8); // ≈ 40–70 Hz
    const bell = heightOf(44, 50); // ≈ 2–3.5 kHz
    expect(kick).toBeLessThan(0.35);
    expect(bell).toBeGreaterThan(0.6);
  });

  it('an onset while the melody is voiced sits at the tune, even before the tracker confirms a note', () => {
    // Live, noteOn arrives ≥ 60 ms after the note starts, so the onset hop sees a voiced pitch but no noteOn.
    const heightWith = (mel: MelodyFrame | null) => {
      const e = new CharacterEngine();
      const f = emptyFeatures();
      f.spectrum.fill(0.2);
      run(e, CASES.fire, 5, 60, f);
      const g = onsetFeatures(4, 0.9);
      g.spectrum.fill(0.2);
      for (let i = 2; i < 8; i++) g.spectrum[i] = 0.9; // the spectrum grew low (≈ 40–70 Hz)
      e.update(CASES.fire, null, g, 1 / 60, 1 / 60, mel);
      return e.events(g, CASES.fire).find((v) => v.onset)!.height;
    };
    const voiced: MelodyFrame = { pitch: 84, voiced: true, salience: 0.6, note: null, noteOn: false };
    expect(Math.abs(heightWith(voiced) - midiHeight(84))).toBeLessThan(0.03);
    expect(heightWith({ ...voiced, pitch: NaN, voiced: false })).toBeLessThan(0.35);
    expect(heightWith(null)).toBeLessThan(0.35);
  });

  it('midiEvent maps keys like a keyboard', () => {
    const m = new CharacterEngine().material();
    expect(midiHeight(24)).toBe(0);
    expect(midiHeight(108)).toBe(1);
    expect(midiHeight(60)).toBeCloseTo(36 / 84);
    const lo = midiEvent(36, 0.5, m);
    const hi = midiEvent(96, 1, m);
    expect(hi.height).toBeGreaterThan(lo.height);
    expect(hi.pan).toBeGreaterThan(lo.pan);
    expect(lo.note).toBe(0);
    expect(hi.strength).toBe(1);
    expect(hi.onset).toBe(true);
  });
});

describe('character: neural tags (optional fusion path)', () => {
  const names = ['techno', 'classical', 'fast', 'slow', 'beat', 'piano', 'nonexistent'];
  const tags = (vals: number[]): NeuralTags => ({ names, values: new Float32Array(vals), at: 0 });

  it('a strong techno tag raises machine; null tags change nothing', () => {
    // Tags are soft evidence: they tip an ambiguous case, they don't overrule clear descriptors.
    const d: Descriptors = { ...CASES.fire };
    for (const k of Object.keys(d) as (keyof Descriptors)[]) d[k] = (CASES.fire[k] + CASES.electronic[k]) / 2;
    const plain = run(new CharacterEngine(), d, 6);
    const again = run(new CharacterEngine(), d, 6);
    expect(again).toEqual(plain);
    const e = new CharacterEngine();
    let ch!: Character;
    const t = tags([0.8, 0, 0, 0, 0.6, 0, 0.9]);
    for (let i = 0; i < 360; i++) ch = e.update(d, t, emptyFeatures(), 1 / 60);
    expect(weightOf(ch, 'machine')).toBeGreaterThan(weightOf(plain, 'machine') + 0.05);
  });

  it('evidence is capped and ignores unknown names', () => {
    const ev = tagEvidence(tags([1, 1, 1, 0, 1, 1, 1]));
    for (const v of Object.values(ev.axes)) expect(Math.abs(v!)).toBeLessThanOrEqual(0.3);
    for (const v of Object.values(ev.arch)) expect(Math.abs(v!)).toBeLessThanOrEqual(1.5);
    expect(ev.arch.machine).toBeGreaterThan(0);
  });
});

describe('character: likelihood geometry', () => {
  it('every archetype wins at its own prototype', () => {
    for (const id of ARCHETYPE_IDS) {
      const a = ARCHETYPES[id];
      const p = spacePoint(
        { energy: 0.5, valence: 0, weight: 0.5, size: 0.5, agitation: 0.5, sharpness: 0.5, density: 0.5, warmth: 0.5, pace: 0.5 },
        { pulse: 0.5, noise: 0.5, tonal: 0.5 },
      );
      for (const [dim, spec] of Object.entries(a.proto)) (p as Record<string, number>)[dim] = spec![0];
      const like = archetypeLikelihoods(p);
      const best = ARCHETYPE_IDS.reduce((b, x) => (like[x] > like[b] ? x : b));
      expect(best).toBe(id);
    }
  });
});

describe('reservoir (echo-state network)', () => {
  it('is scaled to spectral radius < 1', () => {
    const esn = new EchoStateNetwork({ size: 300, inputs: 4, outputs: 2, seed: 1, spectralRadius: 0.92, fanIn: 10, inputScale: 0.5 });
    expect(esn.spectralRadius).toBeGreaterThan(0.85);
    expect(esn.spectralRadius).toBeLessThan(1);
  });

  it('has the echo-state property: different initial states converge under the same input', () => {
    const a = new EchoStateNetwork({ size: 200, inputs: 2, outputs: 1, seed: 3, spectralRadius: 0.9, fanIn: 10, inputScale: 0.5 });
    const b = new EchoStateNetwork({ size: 200, inputs: 2, outputs: 1, seed: 3, spectralRadius: 0.9, fanIn: 10, inputScale: 0.5 });
    const rnd = mulberry32(9);
    for (let i = 0; i < 200; i++) b.state[i] = rnd() * 2 - 1;
    for (let t = 0; t < 2000; t++) {
      const u = [Math.sin(t * 0.05), Math.cos(t * 0.031)];
      a.step(u, 0.3);
      b.step(u, 0.3);
    }
    let diff = 0;
    for (let i = 0; i < 200; i++) diff = Math.max(diff, Math.abs(a.state[i] - b.state[i]));
    expect(diff).toBeLessThan(1e-6);
  });

  const regimes: Record<string, (t: number, rnd: () => number) => [Descriptors, Features]> = {
    silence: () => [neutralDescriptors(), emptyFeatures()],
    noise: (_t, rnd) => {
      const d = neutralDescriptors();
      for (const k of Object.keys(d) as (keyof Descriptors)[]) d[k] = rnd();
      d.majorness = rnd() * 2 - 1;
      const f = emptyFeatures();
      f.level = rnd(); f.bass = rnd(); f.treble = rnd(); f.beat = rnd();
      return [d, f];
    },
    loud: () => {
      const d = neutralDescriptors();
      for (const k of Object.keys(d) as (keyof Descriptors)[]) d[k] = 1;
      d.silence = 0;
      const f = emptyFeatures();
      f.level = 1; f.bass = 1; f.treble = 1; f.beat = 1;
      return [d, f];
    },
  };

  for (const [name, gen] of Object.entries(regimes)) {
    it(`stays finite and bounded for 10 simulated minutes of ${name}`, () => {
      const r = new GestureReservoir(42);
      const rnd = mulberry32(11);
      const ctx = { pace: 0.5, agitation: 0.5, energy: 0.5 };
      let maxState = 0;
      const xs: number[] = [];
      for (let i = 0; i < 36000; i++) {
        const [d, f] = gen(i / 60, rnd);
        ctx.pace = name === 'noise' ? rnd() : name === 'loud' ? 1 : 0.1;
        ctx.agitation = name === 'noise' ? rnd() : name === 'loud' ? 1 : 0;
        const g = r.update(d, f, ctx, 1 / 60);
        for (const v of [g.x, g.y, g.swirl, ...g.extra]) {
          expect(Number.isFinite(v) && Math.abs(v) <= 1).toBe(true);
        }
        expect(Math.abs(g.angle)).toBeLessThanOrEqual(Math.PI);
        expect(g.breath >= 0 && g.breath <= 1).toBe(true);
        if (i % 100 === 0) for (const s of r.esn.state) maxState = Math.max(maxState, Math.abs(s));
        if (i >= 36000 - 600) xs.push(g.x);
      }
      expect(maxState).toBeLessThanOrEqual(1);
      // Never freezes: the last 10 s still move (even in silence the clock dreams).
      const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
      const sd = Math.sqrt(xs.reduce((s, v) => s + (v - mean) ** 2, 0) / xs.length);
      expect(sd).toBeGreaterThan(0.05);
    });
  }

  it('uses the -1..1 range under music-like input, and doesn\'t freeze on a sustained chord', () => {
    const r = new GestureReservoir(5);
    const d = { ...CASES.rachmaninoff };
    const f = emptyFeatures();
    f.level = 0.6; f.bass = 0.8;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < 60 * 120; i++) {
      const g = r.update(d, f, { pace: 0.3, agitation: 0.4, energy: 0.8 }, 1 / 60);
      if (i > 60 * 30) {
        xs.push(g.x);
        ys.push(g.y);
      }
    }
    const range = (a: number[]) => Math.max(...a) - Math.min(...a);
    expect(range(xs)).toBeGreaterThan(0.8);
    expect(range(ys)).toBeGreaterThan(0.8);
  });

  it('quick music makes quicker gestures than slow music', () => {
    const speed = (pace: number) => {
      const r = new GestureReservoir(5);
      const f = emptyFeatures();
      let prev = 0;
      let travel = 0;
      for (let i = 0; i < 60 * 60; i++) {
        const g = r.update(CASES.serene, f, { pace, agitation: 0.2, energy: 0.5 }, 1 / 60);
        if (i > 600) travel += Math.abs(g.x - prev);
        prev = g.x;
      }
      return travel;
    };
    expect(speed(0.9)).toBeGreaterThan(speed(0.1) * 1.5);
  });

  it('is deterministic for a given seed', () => {
    const a = new GestureReservoir(123);
    const b = new GestureReservoir(123);
    const f = emptyFeatures();
    for (let i = 0; i < 1000; i++) {
      const d = i % 200 < 100 ? CASES.fire : CASES.serene;
      const ga = a.update(d, f, { pace: 0.6, agitation: 0.7, energy: 0.6 }, 1 / 60);
      const gb = b.update(d, f, { pace: 0.6, agitation: 0.7, energy: 0.6 }, 1 / 60);
      expect(ga).toEqual(gb);
    }
  });

  it('reservoir frozen when musicDt is 0', () => {
    const e = new CharacterEngine(7);
    const f = emptyFeatures();
    f.level = 0.7;
    f.bass = 0.6;
    run(e, CASES.fire, 3, 60, f); // moving: musicDt defaults to dt
    const x0 = e.gesture().x;
    const y0 = e.gesture().y;
    expect(Math.abs(x0) + Math.abs(y0)).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) {
      // The music keeps changing; only music time stands still.
      f.level = 0.3 + 0.6 * ((i * 7) % 10) / 10;
      f.beat = i % 8 === 0 ? 1 : 0;
      const ch = e.update(i % 40 < 20 ? CASES.fire : CASES.serene, null, f, 1 / 60, 0);
      expect(e.gesture().x).toBe(x0);
      expect(e.gesture().y).toBe(y0);
      expect(Number.isFinite(ch.axes.energy)).toBe(true);
    }
    // …and it moves again once music time runs.
    e.update(CASES.fire, null, f, 1 / 60, 1 / 60);
    expect(e.gesture().x !== x0 || e.gesture().y !== y0).toBe(true);
  });

  it('is cheap (< 0.3 ms per frame)', () => {
    const r = new GestureReservoir(1);
    const f = emptyFeatures();
    const ctx = { pace: 0.5, agitation: 0.5, energy: 0.5 };
    for (let i = 0; i < 500; i++) r.update(CASES.fire, f, ctx, 1 / 60);
    const n = 10000;
    const t0 = performance.now();
    for (let i = 0; i < n; i++) r.update(CASES.fire, f, ctx, 1 / 60);
    const perFrame = (performance.now() - t0) / n;
    console.log(`reservoir: ${(perFrame * 1000).toFixed(1)} µs/frame`);
    expect(perFrame).toBeLessThan(0.3);
  });

  it('whole engine update is cheap too', () => {
    const e = new CharacterEngine();
    const f = emptyFeatures();
    for (let i = 0; i < 500; i++) e.update(CASES.fire, null, f, 1 / 60);
    const n = 5000;
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      e.update(CASES.fire, null, f, 1 / 60);
      e.events(f, CASES.fire);
    }
    const perFrame = (performance.now() - t0) / n;
    console.log(`character engine: ${(perFrame * 1000).toFixed(1)} µs/frame`);
    expect(perFrame).toBeLessThan(0.5);
  });
});

describe('character: calibrated on real recordings', () => {
  // Per-descriptor medians of real recordings, as measured by src/audio/descriptors.ts
  // (scripts: npx tsx scripts/character-file.ts <file>). Mastered records are loud
  // (≈0.7–0.85), so these pin the TYPICAL centering: without it everything reads as storm.
  const REAL = {
    hungarian5: desc({ loudness: 0.77, dynamics: 0.34, register: 0.56, registerSpread: 0.77, brightness: 0.51, noisiness: 0.21, roughness: 0.64, onsetRate: 0.3, irregularity: 0.64, attack: 0.38, sustain: 0.53, tempo: 0.47, pulseClarity: 0.18, majorness: -0.48, keyClarity: 0.76, harmonicChange: 0.55, pitchMotion: 0.38 }),
    ragtime: desc({ loudness: 0.8, dynamics: 0.29, register: 0.57, registerSpread: 0.63, brightness: 0.42, noisiness: 0.25, roughness: 0.41, onsetRate: 0.4, irregularity: 0.29, attack: 0.67, sustain: 0.27, tempo: 0.72, pulseClarity: 0.6, majorness: 0.27, keyClarity: 0.88, harmonicChange: 0.57, pitchMotion: 0.83 }),
    waltz: desc({ loudness: 0.69, dynamics: 0.25, register: 0.52, registerSpread: 0.25, brightness: 0.47, noisiness: 0.06, roughness: 0.58, onsetRate: 0.3, irregularity: 0.01, attack: 0.65, sustain: 0.36, tempo: 0.75, pulseClarity: 1, majorness: 0.48, keyClarity: 0.85, harmonicChange: 0.62, pitchMotion: 0.2 }),
    humpback: desc({ loudness: 0.68, dynamics: 0.52, register: 0.5, registerSpread: 0.03, brightness: 0.67, noisiness: 0.95, roughness: 0.09, onsetRate: 0.05, irregularity: 0.29, attack: 0.23, sustain: 0.81, tempo: 0.4, pulseClarity: 0.06, majorness: 0, keyClarity: 0, harmonicChange: 0, pitchMotion: 0 }),
    dnb: desc({ loudness: 0.65, dynamics: 0.32, register: 0.3, registerSpread: 0.63, brightness: 0.35, noisiness: 0.61, roughness: 0.33, onsetRate: 0.44, irregularity: 0.4, attack: 0.75, sustain: 0.2, tempo: 0.34, pulseClarity: 0.91, majorness: 0.27, keyClarity: 0.29, harmonicChange: 0.72, pitchMotion: 0.5 }),
    fishin: desc({ loudness: 0.85, dynamics: 0.16, register: 0.44, registerSpread: 0.79, brightness: 0.49, noisiness: 0.33, roughness: 0.52, onsetRate: 0.52, irregularity: 0.33, attack: 0.53, sustain: 0.33, tempo: 0.44, pulseClarity: 0.62, majorness: 0.99, keyClarity: 0.74, harmonicChange: 0.33, pitchMotion: 0.53 }),
  };
  const top2 = (d: Descriptors) => run(new CharacterEngine(), d, 15).blend.slice(0, 2).map((b) => b.id);
  it('Brahms Hungarian Dance no. 5 → fire / storm', () => expect(top2(REAL.hungarian5)).toEqual(expect.arrayContaining(['fire'])));
  it('whale song → mist (serene), not abyss', () => expect(top2(REAL.humpback)[0]).toBe('mist'));
  it('drum & bass → machine', () => expect(top2(REAL.dnb)[0]).toBe('machine'));
  it('ragtime and a sweet waltz → gold / sugar', () => {
    for (const d of [REAL.ragtime, REAL.waltz]) expect(top2(d).sort()).toEqual(['gold', 'sugar']);
  });
  it('major pop song → gold', () => expect(top2(REAL.fishin)[0]).toBe('gold'));
  it('real music spreads over the axes instead of pinning them', () => {
    const e = Object.values(REAL).map((d) => descriptorAxes(d).energy);
    for (const v of e) expect(v > 0.3 && v < 0.85).toBe(true);
  });
});
