/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import { groupChords, soundingAt } from '../src/widgets/chords';
import { advanceFeatures, newFeatures, pitch01 } from '../src/widgets/features';
import type { Chord, Features, Note, SoundingNote } from '../src/widgets/types';

const WA = loadLayers();

/** mulberry32: a seeded generator, so the random data is the same on every run. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomNotes(r: () => number, n: number): Note[] {
  const out: Note[] = [];
  let t = r() * 2;
  for (let i = 0; i < n; i++) {
    t += r() < 0.4 ? r() * 0.03 : r() * 0.6;
    out.push([t, t + 0.02 + r() * 3, 21 + Math.floor(r() * 88), 1 + Math.floor(r() * 127)]);
  }
  return out;
}

const fields = (f: Features) => [f.level, f.rate, f.pitch, f.bass, f.density, f.hit];

/** advanceFeatures as it was before the +hit drive (commit c3ef83e), statement for statement: the arithmetic that the
    scenes' stored drives (+level, +rate, pitch, bass, density) have always read. */
type OldFeatures = { level: number; rate: number; pitch: number; bass: number; density: number };
function oldAdvance(p: { level: number; rate: number }, f: OldFeatures, fired: readonly Chord[], snd: readonly SoundingNote[], dt: number): void {
  p.level *= Math.pow(0.5, dt / 0.8); p.rate *= Math.pow(0.5, dt / 1.0);
  for (const ch of fired) { p.level = Math.max(p.level, ch.vel / 115); p.rate += 1 / 1.44; }
  const k = 1 - Math.pow(0.5, dt / 0.25);
  let top: SoundingNote | null = null, bass = 0;
  for (const n of snd) { if (!top || n.m > top.m) top = n; if (n.m < 50) bass += n.v / 127; }
  f.level = p.level; f.rate = Math.min(1, p.rate / 8);
  f.pitch += ((top ? pitch01(top.m) : f.pitch) - f.pitch) * k;
  f.bass += (Math.min(1, bass / 2) - f.bass) * k;
  f.density += (Math.min(1, snd.length / 10) - f.density) * k;
}

describe('advancePulse ≡ advanceFeatures', () => {
  it('agrees bit for bit over 10 000 random steps', () => {
    const r = rng(20261031);
    const notes = randomNotes(r, 3000);
    const chords = groupChords(notes);
    const pa = { level: 0, rate: 0, hit: 0 }, fa = newFeatures();
    const pb = { level: 0, rate: 0, hit: 0 }, fb = newFeatures();
    let t = 0;
    for (let step = 0; step < 10000; step++) {
      const dt = r() * 0.05;
      const fired: Chord[] = [];
      const k = r();
      if (k < 0.3) fired.push(chords[Math.floor(r() * chords.length)]);
      if (k < 0.05) fired.push(chords[Math.floor(r() * chords.length)]);
      t += dt;
      const snd = soundingAt(notes, t);
      advanceFeatures(pa, fa, fired, snd, dt);
      WA.advancePulse(pb, fb, fired, snd, dt);
      expect(Object.is(pa.level, pb.level) && Object.is(pa.rate, pb.rate) && Object.is(pa.hit, pb.hit)).toBe(true);
      const A = fields(fa), B = fields(fb);
      for (let i = 0; i < A.length; i++) if (!Object.is(A[i], B[i])) expect([step, i, B[i]]).toEqual([step, i, A[i]]);
    }
    expect(fb.density).toBeGreaterThan(0);
    expect(fb.hit).toBeGreaterThanOrEqual(0);
  });
});

describe('the +hit drive leaves the old pulse alone', () => {
  it('level, rate, pitch, bass and density equal the old arithmetic bit for bit over 10 000 random steps, in both copies', () => {
    const r = rng(20261105);
    const notes = randomNotes(r, 3000);
    const chords = groupChords(notes);
    const po = { level: 0, rate: 0 }, fo: OldFeatures = { level: 0, rate: 0, pitch: 0.5, bass: 0, density: 0 };
    const pn = { level: 0, rate: 0, hit: 0 }, fn = newFeatures();
    const pl = { level: 0, rate: 0, hit: 0 }, fl = newFeatures();
    let t = 0, kicks = 0, peak = 0;
    for (let step = 0; step < 10000; step++) {
      const dt = r() * 0.05;
      const fired: Chord[] = [];
      const k = r();
      if (k < 0.3) fired.push(chords[Math.floor(r() * chords.length)]);
      if (k < 0.05) fired.push(chords[Math.floor(r() * chords.length)]);
      kicks += fired.length;
      t += dt;
      const snd = soundingAt(notes, t);
      oldAdvance(po, fo, fired, snd, dt);
      advanceFeatures(pn, fn, fired, snd, dt);
      WA.advancePulse(pl, fl, fired, snd, dt);
      const O = [po.level, po.rate, fo.level, fo.rate, fo.pitch, fo.bass, fo.density];
      for (const [p, f] of [[pn, fn], [pl, fl]] as const) {
        const N = [p.level, p.rate, f.level, f.rate, f.pitch, f.bass, f.density];
        for (let i = 0; i < O.length; i++) if (!Object.is(O[i], N[i])) expect([step, i, N[i]]).toEqual([step, i, O[i]]);
      }
      peak = Math.max(peak, fn.hit);
    }
    // the run really kicked hit, so the old numbers were checked beside a live hit
    expect(kicks).toBeGreaterThan(2500);
    expect(peak).toBeGreaterThan(0.9);
  });
});

describe('groupChords and soundingAt copies', () => {
  it('equal src/widgets/chords.ts on 50 random note lists', () => {
    const r = rng(7);
    for (let k = 0; k < 50; k++) {
      const notes = randomNotes(r, 1 + Math.floor(r() * 400));
      expect(WA.groupChords(notes)).toEqual(groupChords(notes));
      const end = notes[notes.length - 1][1];
      for (let j = 0; j < 20; j++) {
        const t = r() * (end + 1) - 0.5;
        expect(WA.soundingAt(notes, t)).toEqual(soundingAt(notes, t));
      }
    }
    expect(WA.groupChords([])).toEqual([]);
  });
});
