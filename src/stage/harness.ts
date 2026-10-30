/**
 * Test harness for the stage (stage-test.html): drives `Stage` with synthetic
 * StageFrames from a scripted 10 s piece, so every element can be judged on its own
 * and in combination before the feed and the director exist.
 *
 * The piece (loops every 10 s): a rising C-major scale C4…C5 (0–4 s), an octave leap
 * to C6, a leap down to a held E4 (4.55–7 s), a rest (7–8 s), then G4 E5 C5; bass
 * pulses every second, a chord change every 2 s (C Am F G Em), beats at 120 BPM,
 * high "hats" on the off-beats. URL parameters: case=<name>, level=0..4 (fluid quality),
 * seed=N, label=0.
 */
import { emptyFeatures } from '../audio/features';
import { ARCHETYPES } from '../character/archetypes';
import { noteRgb } from '../character/palette';
import { neutralDescriptors, type ArchetypeId, type Gesture, type Material, type SoundEvent } from '../character/types';
import { Stage } from './stage';
import { normalizeSpec } from './script';
import { type Accent, DEFAULT_LOOK, type ElementSpec, type Look, type MelodyFrame, type StageFrame } from './types';

const FPS = 60;
const DT = 1 / FPS;
const LOOP = 10;

// ---- The piece ----------------------------------------------------------------------

interface Note {
  start: number;
  end: number;
  midi: number;
}
const SCALE = [60, 62, 64, 65, 67, 69, 71, 72];
const NOTES: Note[] = [
  ...SCALE.map((midi, i) => ({ start: i * 0.5, end: i * 0.5 + 0.45, midi })),
  { start: 4.0, end: 4.45, midi: 84 },
  { start: 4.55, end: 7.0, midi: 64 },
  { start: 8.0, end: 8.55, midi: 67 },
  { start: 8.6, end: 9.15, midi: 76 },
  { start: 9.2, end: 9.95, midi: 72 },
];
/** Chords every 2 s: root, minor. */
const CHORDS: [number, boolean][] = [[0, false], [9, true], [5, false], [7, false], [4, true]];
const noteAt = (t: number) => NOTES.find((n) => t >= n.start && t < n.end) ?? null;
const chordAt = (t: number) => CHORDS[Math.floor(t / 2) % CHORDS.length];

// ---- Cases --------------------------------------------------------------------------

interface Case {
  archetype: ArchetypeId;
  cast: ElementSpec[];
  look?: Partial<Look>;
  accents?: { at: number; kind: Accent['kind']; color?: [number, number, number]; strength?: number }[];
}
const el = (type: ElementSpec['type'], style = '', params: ElementSpec['params'] = {}): ElementSpec => ({
  id: `${type}${style ? '-' + style : ''}`, type, params: { style, ...params },
});

export const CASES: Record<string, Case> = {
  'melody-ribbon': { archetype: 'gold', cast: [el('melody', 'ribbon')] },
  'melody-beads': { archetype: 'gold', cast: [el('melody', 'beads')] },
  'melody-ink': { archetype: 'lament', cast: [el('melody', 'ink')] },
  'melody-notes': { archetype: 'storm', cast: [el('melody', 'ribbon', { color: 'note' })] },
  'bass-orbs': { archetype: 'storm', cast: [el('bass', 'orbs')] },
  'bass-tides': { archetype: 'storm', cast: [el('bass', 'tides')] },
  'sparks-stars': { archetype: 'sugar', cast: [el('sparks', 'stars')] },
  'sparks-dust': { archetype: 'mist', cast: [el('sparks', 'dust')] },
  'sparks-embers': { archetype: 'fire', cast: [el('sparks', 'embers')] },
  'bloom-fields': { archetype: 'mist', cast: [el('bloom', 'fields')] },
  'bloom-aurora': { archetype: 'mist', cast: [el('bloom', 'aurora')] },
  'pulse-rings': { archetype: 'machine', cast: [el('pulse', 'rings')] },
  'pulse-grid': { archetype: 'machine', cast: [el('pulse', 'grid')] },
  'pulse-flash': { archetype: 'machine', cast: [el('pulse', 'flash')] },
  'wave-line': { archetype: 'fire', cast: [el('wave', 'line')] },
  'wave-circle': { archetype: 'fire', cast: [el('wave', 'circle')] },
  'fluid-living': { archetype: 'fire', cast: [el('fluid')] },
  abyss: {
    archetype: 'abyss', look: { trails: 0.6, warp: 0.1, glow: 0.5 },
    cast: [el('fluid'), el('bass', 'orbs', { region: 'bottom' }), el('melody', 'ink')],
  },
  sugar: {
    archetype: 'sugar', look: { trails: 0.35, warp: 0.25, glow: 0.7 },
    cast: [el('sparks', 'stars'), el('melody', 'beads'), el('pulse', 'rings', { intensity: 0.5 })],
  },
  mist: {
    archetype: 'mist', look: { trails: 0.75, warp: 0.15, glow: 0.8 },
    cast: [el('bloom', 'aurora'), el('melody', 'ribbon')],
  },
  accents: {
    archetype: 'machine', look: { mirror: 4, trails: 0.5, warp: 0.4 },
    cast: [el('wave', 'circle'), el('melody', 'ribbon')],
    accents: [{ at: 2.0, kind: 'flash' }, { at: 4.0, kind: 'shock', color: [0.6, 0.9, 1] }, { at: 6.2, kind: 'swell' }],
  },
  kaleido: {
    archetype: 'sugar', look: { mirror: 6, trails: 0.6, warp: 0.5 },
    cast: [el('sparks', 'stars'), el('melody', 'ribbon', { color: 'note' }), el('bloom', 'fields', { intensity: 0.4 })],
  },
  all: {
    archetype: 'gold',
    cast: [el('bloom', 'fields', { intensity: 0.4 }), el('bass', 'orbs'), el('pulse', 'rings'), el('wave', 'line', { region: 'top' }),
      el('sparks', 'stars'), el('melody', 'ribbon'), el('fluid', '', { intensity: 0.5 })],
  },
};

// ---- Frames -------------------------------------------------------------------------

const WEIGHT: Partial<Record<ArchetypeId, number>> = { abyss: 0.9, storm: 0.7, sugar: 0.15, mist: 0.3, fire: 0.5 };

function material(id: ArchetypeId): Material {
  const a = ARCHETYPES[id];
  return { ...a.material, palette: a.palette.map((c) => [...c]) as Material['palette'] };
}

function gesture(t: number): Gesture {
  return {
    x: Math.sin(t * 0.31) * 0.6 + Math.sin(t * 0.73) * 0.3,
    y: Math.sin(t * 0.23 + 1) * 0.5,
    angle: t * 0.21 + Math.sin(t * 0.17) * 1.5,
    swirl: Math.sin(t * 0.11 + 0.8),
    breath: 0.5 + 0.5 * Math.sin(t * 0.4),
    extra: [Math.sin(t * 0.13), Math.cos(t * 0.19), Math.sin(t * 0.07 + 2), Math.cos(t * 0.05 + 1)],
  };
}

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

export class Song {
  /** Song (= music) time. */
  t = 0;
  wave = new Float32Array(2048);
  private hatSeed = 1;

  constructor(private c: Case) {}

  /** The next frame: music when `silent` is false, else held silence (musicDt = 0, no events). */
  frame(silent: boolean): StageFrame {
    const prev = this.t;
    if (!silent) this.t += DT;
    const t = this.t;
    const lt = t % LOOP;
    const lp = prev % LOOP;
    const f = emptyFeatures();
    const d = neutralDescriptors();
    const events: SoundEvent[] = [];
    const chroma = new Float32Array(12);
    let melody: MelodyFrame = { pitch: NaN, voiced: false, salience: 0, note: null, noteOn: false };
    let beat = { phase: (lt / 0.5) % 1, hit: false, strength: 0 };

    if (silent) {
      this.wave.fill(0);
      d.silence = 1;
    } else {
      // Melody.
      const n = noteAt(lt);
      if (n) {
        const on = lp < n.start || lp > lt;
        const held = lt - n.start;
        const vib = held > 0.3 ? 0.12 * Math.sin(2 * Math.PI * 5.5 * t) : 0;
        const sal = 0.55 + 0.35 * Math.exp(-held * 2);
        melody = {
          pitch: n.midi + vib, voiced: true, salience: sal, noteOn: on,
          note: { start: n.start, end: n.end, midi: n.midi, strength: 0.8, confidence: 0.9 },
        };
        const pc = n.midi % 12;
        const ev: SoundEvent = { height: (n.midi - 24) / 84, pan: 0.4 * Math.sin(t * 0.7), strength: on ? 0.85 : 0.45, note: pc, color: noteRgb(pc), onset: on };
        events.push(ev);
        if (on) {
          f.onset = true;
          f.onsetStrength = 0.8;
        }
      }
      // Beat (120 BPM) and bass on beats 1 and 3.
      const bi = Math.floor(lt / 0.5);
      if (Math.floor(lp / 0.5) !== bi || lp > lt) {
        beat = { phase: (lt / 0.5) % 1, hit: true, strength: bi % 4 === 0 ? 1 : 0.7 };
        f.onset = true;
        f.onsetStrength = Math.max(f.onsetStrength, beat.strength * 0.7);
        if (bi % 2 === 0) {
          const [root] = chordAt(lt);
          events.push({ height: 0.08, pan: 0, strength: 0.9, note: root, color: noteRgb(root), onset: true });
        }
      }
      // Hats on the off-beats.
      if (Math.floor((lp + 0.25) / 0.5) !== Math.floor((lt + 0.25) / 0.5) && lt > lp) {
        this.hatSeed = (this.hatSeed * 16807) % 2147483647;
        events.push({ height: 0.86, pan: ((this.hatSeed % 1000) / 500) - 1, strength: 0.4, note: 11, color: noteRgb(11), onset: true });
      }
      const bassAge = lt % 1;
      f.bass = 0.2 + 0.8 * Math.exp(-bassAge * 3);
      const [root, minor] = chordAt(lt);
      for (let i = 0; i < 12; i++) chroma[i] = 0.08;
      chroma[root] = 1;
      chroma[(root + (minor ? 3 : 4)) % 12] = 0.8;
      chroma[(root + 7) % 12] = 0.85;
      if (n) chroma[n.midi % 12] = Math.max(chroma[n.midi % 12], 0.6);
      f.chroma.set(chroma);
      f.level = Math.min(1, 0.35 + 0.3 * f.bass + (n ? 0.2 : 0));
      f.mid = n ? 0.6 : 0.2;
      f.treble = 0.3;
      f.beat = Math.exp(-((lt % 0.5) * 6));
      f.note = n ? n.midi % 12 : root;
      f.noteSmooth = f.note;
      f.tonality = 0.8;
      f.bpm = 120;
      d.silence = 0;
      d.loudness = f.level;
      d.pulseClarity = 0.8;
      d.tempo = 0.6;
      d.register = n ? (n.midi - 24) / 84 : 0.4;
      d.majorness = minor ? -0.6 : 0.6;
      d.keyClarity = 0.8;
      // Waveform: bass sine on the chord root + the melody with two harmonics.
      const bf = midiHz(36 + root);
      const mf = n ? midiHz(n.midi) : 0;
      const ba = 0.35 * f.bass;
      const ma = n ? 0.3 * Math.min(1, (lt - n.start) * 40) : 0;
      for (let i = 0; i < 2048; i++) {
        const tau = t - (2048 - i) / 44100;
        let v = ba * Math.sin(2 * Math.PI * bf * tau);
        if (mf) v += ma * (Math.sin(2 * Math.PI * mf * tau) + 0.4 * Math.sin(4 * Math.PI * mf * tau) + 0.15 * Math.sin(6 * Math.PI * mf * tau));
        this.wave[i] = v;
      }
    }
    f.waveform = this.wave.subarray(1024);
    f.time = t;

    const look: Look = { ...DEFAULT_LOOK, ...this.c.look };
    const accents: Accent[] = [];
    for (const a of this.c.accents ?? []) {
      const age = lt - a.at;
      if (age >= 0 && age < 1.5) accents.push({ kind: a.kind, color: a.color ?? [1, 1, 1], strength: a.strength ?? 1, age });
    }
    const weight = WEIGHT[this.c.archetype] ?? 0.5;
    return {
      dt: DT, musicDt: silent ? 0 : DT, clock: { time: t, drive: silent ? 0 : 1, dim: 1 },
      f, d,
      character: {
        axes: { energy: 0.6, valence: 0.2, weight, size: weight, agitation: 0.4, sharpness: 0.5, density: 0.5, warmth: 0.5, pace: 0.5 },
        blend: [{ id: this.c.archetype, weight: 1 }], words: ARCHETYPES[this.c.archetype].words.slice(0, 2), confidence: 1,
      },
      material: material(this.c.archetype), gesture: gesture(t), melody, events, beat, chroma, wave: this.wave, wild: 0.5,
      pointer: { x: 0.5, y: 0.5, dx: 0, dy: 0, down: false },
      directives: {
        source: 'scripted', scene: 'test', look, accents,
        cast: this.c.cast.map((spec) => ({ spec: normalizeSpec(spec), presence: 1 })),
      },
    };
  }
}

// ---- Page ---------------------------------------------------------------------------

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('stage-gl') as HTMLCanvasElement;
const label = document.getElementById('label')!;
if (q.get('label') === '0') label.style.display = 'none';
const opts = { seed: Number(q.get('seed') ?? 7), fluidLevel: Number(q.get('level') ?? 3) };
let stage = new Stage(canvas, opts);
let name = q.get('case') ?? 'mist';
let song = new Song(CASES[name] ?? CASES.mist);
let paused = false;
let captured: Uint8Array | null = null;
addEventListener('resize', () => stage.resize());

function step(silent = false) {
  stage.render(song.frame(silent));
}

function loop() {
  if (!paused) {
    step();
    label.textContent = `${name} · ${song.t.toFixed(2)} s · ${stage.info().cast.join(' ')}`;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/** Hooks for scripts/stage-shots.mjs. */
(window as unknown as { harness: unknown }).harness = {
  cases: Object.keys(CASES),
  /** Starts a case from song time 0 on a fresh stage (no trails or element state carried over). */
  set(c: string) {
    stage.dispose();
    stage = new Stage(canvas, opts);
    name = c;
    song = new Song(CASES[c]);
  },
  pause(p: boolean) {
    paused = p;
  },
  /** Plays frames until song time `t` (deterministic, independent of rAF). */
  advanceTo(t: number) {
    while (song.t < t - 1e-9) step();
  },
  /** `n` frames of held silence: musicDt = 0, no events, a flat waveform. */
  silence(n: number) {
    for (let i = 0; i < n; i++) step(true);
  },
  capture() {
    captured = stage.pixels();
  },
  /** Fraction of pixels whose largest channel change since capture() exceeds `threshold` (0..255), and the largest change. */
  diff(threshold = 8) {
    const now = stage.pixels();
    if (!captured || captured.length !== now.length) return { changed: 1, max: 255 };
    let changed = 0;
    let max = 0;
    for (let i = 0; i < now.length; i += 4) {
      const m = Math.max(Math.abs(now[i] - captured[i]), Math.abs(now[i + 1] - captured[i + 1]), Math.abs(now[i + 2] - captured[i + 2]));
      if (m > threshold) changed++;
      if (m > max) max = m;
    }
    return { changed: changed / (now.length / 4), max };
  },
  /**
   * For `cols` columns across the picture: the height (0 bottom … 1 top) of the
   * brightest pixel, or null for a dark column. Lets a script check that the melody
   * stroke climbs with the scale.
   */
  trace(cols = 40) {
    const px = stage.pixels();
    const [w, h] = stage.info().canvas;
    const out: (number | null)[] = [];
    for (let c = 0; c < cols; c++) {
      const x = Math.floor(((c + 0.5) / cols) * w);
      let best = -1;
      let by = 0;
      for (let y = 0; y < h; y++) {
        const i = (y * w + x) * 4;
        const l = px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722;
        if (l > best) {
          best = l;
          by = y;
        }
      }
      out.push(best > 40 ? by / (h - 1) : null);
    }
    return out;
  },
  /** Renders `n` frames, waiting for the GPU after each (1-pixel readPixels); ms per frame. */
  bench(n = 120) {
    const gl = stage.gl;
    const px = new Uint8Array(4);
    for (let i = 0; i < 60; i++) step();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const times: number[] = [];
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      step();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    return { median: times[n >> 1], p90: times[Math.floor(n * 0.9)], info: stage.info() };
  },
  label(show: boolean) {
    label.style.display = show ? '' : 'none';
  },
  info: () => ({ ...stage.info(), t: song.t, case: name }),
};
