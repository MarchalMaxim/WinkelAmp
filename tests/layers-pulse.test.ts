/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import { groupChords, soundingAt } from '../src/widgets/chords';
import { advanceFeatures, newFeatures } from '../src/widgets/features';
import type { Chord, Features, Note } from '../src/widgets/types';

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

const fields = (f: Features) => [f.level, f.rate, f.pitch, f.bass, f.density];

describe('advancePulse ≡ advanceFeatures', () => {
  it('agrees bit for bit over 10 000 random steps', () => {
    const r = rng(20261031);
    const notes = randomNotes(r, 3000);
    const chords = groupChords(notes);
    const pa = { level: 0, rate: 0 }, fa = newFeatures();
    const pb = { level: 0, rate: 0 }, fb = newFeatures();
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
      expect(Object.is(pa.level, pb.level) && Object.is(pa.rate, pb.rate)).toBe(true);
      const A = fields(fa), B = fields(fb);
      for (let i = 0; i < A.length; i++) if (!Object.is(A[i], B[i])) expect([step, i, B[i]]).toEqual([step, i, A[i]]);
    }
    expect(fb.density).toBeGreaterThan(0);
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
