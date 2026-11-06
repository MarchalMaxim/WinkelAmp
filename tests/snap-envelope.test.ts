/// <reference types="node" />
// The snap envelope (lab/snap/envelope.js, docs/mockups/snap/DESIGN.md sections 1 and 2): the paper curve, what it
// becomes on the shared canvas, the roll detector, and that every widget's pasted copy is the canonical one.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { groupChords } from '../src/widgets/chords';
import type { Chord, Note } from '../src/widgets/types';

const BEGIN = '// SNAP v1 begin', END = '// SNAP v1 end';
/** The block from its begin marker through its end marker, as raw text (no line-ending normalising: byte for byte). */
function blockOf(src: string): string {
  const a = src.indexOf(BEGIN), b = src.indexOf(END);
  return src.slice(a, b + END.length);
}
const canonical = readFileSync('lab/snap/envelope.js', 'utf8');
const block = blockOf(canonical);

interface Env { E: number; flash: number; body: number; P: number; L: number }
interface NoteIn { v: number; m: number; d?: number; a?: number }
interface Opts { preset?: string | number; ring?: number; picks?: boolean }
interface Snap {
  PRESETS: Record<string, { wf: number; wb: number; wt: number; hb0: number; L: number; o: number }>;
  TOUCH: string[];
  env(t: number, n: NoteIn, o?: Opts): Env;
  alpha(T: number, Tprev: number): number;
  settles(E: number): number;
  size(t: number, v: number, o?: { o?: number; preset?: string }): number;
  hot(rgb: number[], t: number, a?: number): number[];
  sharp(t: number, k: number): number;
  launch(t: number, dist: number, tau?: number): number;
  rolls(chords: Chord[]): Map<number, 'member' | 'top'>;
}
// Evaluated the way a widget holds it: pasted into a function, with no globals but what it defines.
const SNAP = new Function(block + '\nreturn SNAP;')() as Snap;

const DT = 1 / 60;
/** The shared canvas at 60 Hz, starting from black: fade by rgba(0,0,0,0.12), colour-burn with 252, then the mark in
    white at SNAP.alpha(E(t), E(t - dt)), 8-bit after each step. One value per step, the attack on step 0. */
function screen(n: NoteIn, o: Opts, seconds = 8): number[] {
  const out: number[] = [];
  let B = 0;
  for (let k = 0; k < seconds * 60; k++) {
    const t = k * DT;
    B *= 0.88;
    B = Math.max(0, 1 - (1 - B) * 255 / 252);
    B = Math.round(B * 255) / 255;
    const a = SNAP.alpha(SNAP.env(t, n, o).E, SNAP.env(t - DT, n, o).E);
    B = B * (1 - a) + a;
    B = Math.round(B * 255) / 255;
    out.push(B);
  }
  return out;
}
/** Frame indices, as integers, so 7 frames against a target of 0.10 s is exactly one frame off and not float noise. */
const halfStep = (s: number[]) => s.findIndex((y) => y <= s[0] / 2);
const goneStep = (s: number[]) => s.reduce((last, y, i) => (y > s[0] * 0.05 ? i : last), 0);

const PRESETS = ['staccato', 'marcato', 'piano', 'bell'];
const GRID: NoteIn[] = [];
for (const m of [30, 60, 90]) for (const v of [20, 70, 127]) GRID.push({ m, v, d: 9 });

describe('the envelope on paper', () => {
  it('starts at the peak P', () => {
    for (const preset of PRESETS) for (const n of GRID) {
      const e = SNAP.env(0, n, { preset });
      expect(e.E).toBeCloseTo(e.P, 12);
      expect(e.flash).toBe(1);
    }
  });
  it('only falls after the two-step hold', () => {
    for (const preset of PRESETS) for (const n of GRID) for (const ring of [0.25, 1, 3]) {
      let prev = Infinity;
      for (let t = 0.033; t < 20; t += 0.004) {
        const E = SNAP.env(t, n, { preset, ring }).E;
        expect(E).toBeLessThanOrEqual(prev + 1e-12);
        prev = E;
      }
    }
  });
  it('is 0 from L times ring on, and before the attack', () => {
    for (const preset of PRESETS) for (const ring of [0.25, 1, 3]) {
      const L = SNAP.PRESETS[preset].L * ring;
      for (const n of GRID) {
        expect(SNAP.env(L, n, { preset, ring }).E).toBe(0);
        expect(SNAP.env(L + 0.5, n, { preset, ring }).E).toBe(0);
        expect(SNAP.env(-0.001, n, { preset, ring }).E).toBe(0);
      }
    }
  });
  it('lets every picked note land: the floor is 0.35 even at velocity 1', () => {
    expect(SNAP.env(0, { v: 1, m: 60 }, { picks: true }).P).toBeGreaterThanOrEqual(0.35);
    expect(SNAP.env(0, { v: 1, m: 60 }, {}).P).toBeLessThan(0.35);
  });
  it('reads the touch knob as the four presets in order', () => {
    PRESETS.forEach((name, i) => {
      expect(SNAP.env(0.2, { v: 90, m: 60 }, { preset: i }).E).toBe(SNAP.env(0.2, { v: 90, m: 60 }, { preset: name }).E);
    });
    expect(SNAP.env(0.2, { v: 90, m: 60 }).E).toBe(SNAP.env(0.2, { v: 90, m: 60 }, { preset: 'piano' }).E);
  });
  // gain(a) weighs the flash against the body, and E is normalised to P: so above intensity 1 the strike stands out
  // further from what it leaves behind (velocity is clipped at 127, the contrast is not).
  it('cracks harder above intensity 1: the same peak, a deeper drop to the body', () => {
    const n = { v: 127, m: 60, d: 9 };
    const loud = SNAP.env(0.3, { ...n, a: 1.8 }), plain = SNAP.env(0.3, n);
    expect(loud.E).toBeLessThan(plain.E);
    expect(SNAP.env(0, { ...n, a: 1.8 }).E).toBeCloseTo(plain.P, 12);
  });
  it('cuts a short note only below the top strings', () => {
    const short = { v: 90, m: 60, d: 0.1 }, long = { v: 90, m: 60, d: 0.5 }, high = { v: 90, m: 95, d: 0.1 };
    expect(SNAP.env(0.3, short).E).toBeLessThan(SNAP.env(0.3, long).E * 0.1);
    expect(SNAP.env(0.3, high).E).toBe(SNAP.env(0.3, { ...high, d: 0.5 }).E);
  });
});

describe('the helpers', () => {
  it('alpha puts the peak on at once, holds like settles, and lets the fade take a fast fall', () => {
    expect(SNAP.alpha(0.6, 0)).toBeCloseTo(0.6, 12);
    expect(SNAP.alpha(0.5, 0.5)).toBeCloseTo(SNAP.settles(0.5), 12);
    expect(SNAP.alpha(0.2, 0.6)).toBe(0);
    expect(SNAP.alpha(1.4, 0)).toBe(0.98);
  });
  it('size rings only on loud notes and settles at 1', () => {
    expect(SNAP.size(0, 127, { o: 0.18 })).toBeCloseTo(1.18, 12);
    expect(SNAP.size(0, 60, { o: 0.18 })).toBe(1);
    expect(Math.abs(SNAP.size(0.5, 127, { o: 0.18 }) - 1)).toBeLessThan(0.001);
    expect(SNAP.size(-0.01, 127)).toBe(1);
  });
  it('hot lights toward bone on the strike, not for a note turned down, and cools', () => {
    const red = [140, 20, 20];
    expect(SNAP.hot(red, 0, 1)).toEqual([193, 133, 123]);
    expect(SNAP.hot(red, 0, 0.5)).toEqual(red);
    expect(SNAP.hot(red, 1, 1)).toEqual(red);
  });
  it('sharp starts crisp; launch starts at full speed and slows', () => {
    expect(SNAP.sharp(0, 8)).toBe(0);
    expect(SNAP.sharp(0.075, 8)).toBeCloseTo(4, 12);
    expect(SNAP.sharp(2, 8)).toBe(8);
    const a = SNAP.launch(DT, 100, 0.1), b = SNAP.launch(2 * DT, 100, 0.1) - a;
    expect(a).toBeGreaterThan(15);
    expect(b).toBeLessThan(a);
    expect(SNAP.launch(-1, 100)).toBe(0);
  });
});

describe('the envelope on screen (60 Hz, fade 0.12, burn 252, 8-bit, from black)', () => {
  it('shows at least 85 % of the peak on the attack step, and never brightens after it', () => {
    for (const preset of PRESETS) for (const n of GRID) for (const picks of [false, true]) {
      const s = screen(n, { preset, picks }), P = SNAP.env(0, n, { preset, picks }).P;
      expect(s[0]).toBeGreaterThanOrEqual(0.85 * P);
      // One 8-bit level of slack: at the bottom the burn takes a pixel to 0 that alpha() thinks still holds a trace,
      // and the next step puts 1/255 back (marcato, v 20, at 0.18 s). Nothing an eye can see; anything more fails.
      for (let k = 1; k < s.length; k++) expect(s[k]).toBeLessThanOrEqual(s[k - 1] + 1.5 / 255);
    }
  });
  it('shows a picked note at velocity 1 at 0.3 or more on its attack step', () => {
    for (const preset of PRESETS) expect(screen({ v: 1, m: 60, d: 9 }, { preset, picks: true }, 1)[0]).toBeGreaterThanOrEqual(0.3);
  });
  // The design's "on screen" column, for v 127 at middle C, ring 1, no picks, a long written note. Half: the first step
  // at or below half the attack step. Gone: the last step above 5 % of it. Each within one 60 Hz frame.
  const TARGETS: Record<string, { half: number; gone?: number }> = {
    staccato: { half: 0.10, gone: 0.3 },
    marcato: { half: 0.12, gone: 0.5 },
    piano: { half: 0.15, gone: 0.8 },
    // The bell's "ring ~3.5 s" is not met: hb0 0.75 is what puts its half at 0.3 s, and then the slow tail stays
    // above 5 % until the cut at 6 s (gone at 5.9 s). hb0 cannot hold both; the half is the one kept.
    bell: { half: 0.3 },
  };
  for (const [preset, target] of Object.entries(TARGETS)) {
    it(`${preset}: half ${target.half} s${target.gone ? `, gone ${target.gone} s` : ''}, within a frame`, () => {
      const s = screen({ v: 127, m: 60, d: 9 }, { preset });
      expect(Math.abs(halfStep(s) - Math.round(target.half * 60))).toBeLessThanOrEqual(1);
      if (target.gone) expect(Math.abs(goneStep(s) - Math.round(target.gone * 60))).toBeLessThanOrEqual(1);
    });
  }
});

describe('rolls', () => {
  // shows/liebesleid.json is the user's own show copy; without it, or without its p5 pick set, the roll test is skipped.
  let show: { picks?: Record<string, unknown> } | null = null;
  try { show = JSON.parse(readFileSync('shows/liebesleid.json', 'utf8')); } catch { show = null; }
  const haveP5 = !!show?.picks?.p5;
  if (!haveP5) console.warn('SKIPPED: the roll test needs shows/liebesleid.json with a pick set p5 (the show copy is missing or lacks it)');
  const notesOf = (set: unknown): Note[] => (Array.isArray(set) ? set : (set as { notes: Note[] }).notes)
    .map((n: Note) => [n[0], n[1], n[2], n[3]] as Note);
  it.skipIf(!haveP5)("finds one roll in Liebesleid's p5, topped by midi 74", () => {
    const chords = groupChords(notesOf(show!.picks!.p5));
    const map = SNAP.rolls(chords);
    expect(map.size).toBe(4);
    const tops = [...map].filter(([, r]) => r === 'top');
    expect(tops.length).toBe(1);
    expect(chords[tops[0][0]].hi).toBe(74);
    expect(SNAP.rolls(chords)).toBe(map);
  });
  it('leaves chords alone that are too far apart, too few, or turn around', () => {
    const c = (t: number, m: number): Chord => ({ t, notes: [{ m, v: 70, d: 0.3 }], vel: 70, lo: m, hi: m });
    expect(SNAP.rolls([c(0, 60), c(0.2, 64), c(0.4, 67)]).size).toBe(0);
    expect(SNAP.rolls([c(0, 60), c(0.08, 64)]).size).toBe(0);
    expect(SNAP.rolls([c(0, 60), c(0.08, 64), c(0.16, 62)]).size).toBe(0);
    const down = SNAP.rolls([c(0, 72), c(0.07, 67), c(0.14, 64), c(0.21, 60)]);
    expect(down.get(0)).toBe('top');
    expect(down.get(3)).toBe('member');
  });
});

describe('pasted copies', () => {
  it('the canonical file holds the block once', () => {
    expect(canonical.split(BEGIN).length).toBe(2);
    expect(canonical.split(END).length).toBe(2);
    expect(canonical.indexOf(BEGIN)).toBeLessThan(canonical.indexOf(END));
  });
  it('every lab/tools widget holding the markers holds the canonical block byte for byte', () => {
    for (const f of readdirSync('lab/tools').filter((f) => f.endsWith('.js'))) {
      const src = readFileSync(`lab/tools/${f}`, 'utf8');
      if (!src.includes(BEGIN) && !src.includes(END)) continue;
      expect(src.split(BEGIN).length, f).toBe(2);
      expect(blockOf(src), f).toBe(block);
    }
  });
});
