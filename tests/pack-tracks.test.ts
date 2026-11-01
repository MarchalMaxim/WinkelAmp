import { describe, expect, it } from 'vitest';
import { TRACKS, trackOf } from '../src/studio/pack/instruments';
import {
  buildTracks, cleanRows, estimateVelocities, hybridNotes, midRank, onsetLevels, pianoShare, quantileOf, type Ymt3Row,
} from '../src/studio/pack/tracks';
import type { Note } from '../src/widgets/types';

describe('instruments', () => {
  it('maps YourMT3 classes to tracks, and the trackless ones to null', () => {
    expect(trackOf('French Horn')).toBe('horn');
    expect(trackOf('Tuba')).toBe('trombone');
    expect(trackOf('Pipe')).toBe('flute');
    expect(trackOf('English Horn')).toBe('oboe');
    expect(trackOf('Singing Voice (chorus)')).toBe('voice');
    for (const c of ['Synth Pad', 'Synth Lead', 'Drums', 'Organ', 'Chromatic Percussion', 'Orchestra Hit', 'program99', '']) {
      expect(trackOf(c)).toBeNull();
    }
  });

  it('lists every class once, under a family that matches the spec', () => {
    const all = Object.values(TRACKS).flatMap((t) => t.classes);
    expect(new Set(all).size).toBe(all.length);
    for (const [id, t] of Object.entries(TRACKS)) for (const c of t.classes) expect(trackOf(c)).toBe(id);
    expect(TRACKS.cello.family).toBe('strings');
    expect(TRACKS.horn.family).toBe('brass');
    expect(TRACKS.saxophone.family).toBe('winds');
    expect(TRACKS.timpani.family).toBe('percussion');
  });
});

describe('cleanRows and pianoShare', () => {
  it('drops Drums, vel 0 and end ≤ start, stable by (start, midi)', () => {
    const rows: Ymt3Row[] = [
      [2, 3, 60, 100, 'Violin'], [1, 2, 40, 100, 'Drums'], [1, 2, 64, 0, 'Violin'], [1, 1, 64, 100, 'Violin'],
      [1, 0.5, 64, 100, 'Violin'], [1, 2, 62, 100, 'Cello'], [1, 2, 55, 100, 'Viola'], [1, 2, 62, 100, 'Oboe'],
    ];
    expect(cleanRows(rows)).toEqual([[1, 2, 55, 100, 'Viola'], [1, 2, 62, 100, 'Cello'], [1, 2, 62, 100, 'Oboe'], [2, 3, 60, 100, 'Violin']]);
  });

  it('is the share of piano rows among the cleaned ones', () => {
    const p = (cls: string): Ymt3Row => [0, 1, 60, 100, cls];
    expect(pianoShare([p('Acoustic Piano'), p('Electric Piano'), p('Acoustic Piano'), p('Violin')])).toBe(0.75);
    expect(pianoShare([p('Acoustic Piano'), p('Drums'), p('Drums')])).toBe(1);
    expect(pianoShare([])).toBe(0);
  });
});

describe('hybridNotes', () => {
  it('adds only the extra notes more than 0.15 s from every piano attack', () => {
    // The spec's rule (Decisions 2): 1.1 is 0.1 s from the piano note and goes; 1.2 is 0.2 s away and stays.
    expect(hybridNotes([[1, 2, 60, 80]], [[1.1, 2, 64, 100], [1.2, 2, 67, 100], [3, 4, 70, 100]]))
      .toEqual([[1, 2, 60, 80], [1.2, 2, 67, 100], [3, 4, 70, 100]]);
    expect(hybridNotes([[1, 2, 60, 80]], [[1.1, 2, 64, 100], [1.14, 2, 67, 100], [3, 4, 70, 100]])).toEqual([[1, 2, 60, 80], [3, 4, 70, 100]]);
    expect(hybridNotes([], [[3, 4, 70, 100], [1, 2, 60, 80]])).toEqual([[1, 2, 60, 80], [3, 4, 70, 100]]);
  });

  it('drops a note exactly 0.15 s away and keeps one 0.151 s away, on both sides', () => {
    const piano: Note[] = [[1, 2, 60, 80]];
    expect(hybridNotes(piano, [[1.15, 2, 64, 100]])).toEqual(piano);
    expect(hybridNotes(piano, [[0.85, 2, 64, 100]])).toEqual(piano);
    expect(hybridNotes(piano, [[1.151, 2, 64, 100]])).toEqual([[1, 2, 60, 80], [1.151, 2, 64, 100]]);
    expect(hybridNotes(piano, [[0.849, 2, 64, 100]])).toEqual([[0.849, 2, 64, 100], [1, 2, 60, 80]]);
  });

  it('stable-sorts by start, piano notes first on a tie', () => {
    const out = hybridNotes([[5, 6, 60, 80], [1, 2, 62, 80]], [[3, 4, 70, 100], [5, 6, 71, 100]], 0);
    expect(out).toEqual([[1, 2, 62, 80], [3, 4, 70, 100], [5, 6, 60, 80]]);
  });
});

describe('ranks and quantiles', () => {
  it('midRank', () => {
    expect(midRank([3, 1, 2, 2])).toEqual([1, 0, 0.5, 0.5]);
    expect(midRank([5])).toEqual([0.5]);
    expect(midRank([])).toEqual([]);
    expect(midRank([7, 7, 7])).toEqual([0.5, 0.5, 0.5]);
  });

  it('quantileOf interpolates between order statistics', () => {
    expect(quantileOf([10, 20, 30], 0.5)).toBe(20);
    expect(quantileOf([10, 20, 30], 0.25)).toBe(15);
    expect(quantileOf([10, 20, 30], 0)).toBe(10);
    expect(quantileOf([10, 20, 30], 1)).toBe(30);
    expect(quantileOf([42], 0.7)).toBe(42);
    expect(quantileOf([], 0.5)).toBeNaN();
  });
});

describe('estimateVelocities', () => {
  const row = (t: number, m = 60): Ymt3Row => [t, t + 0.5, m, 100, 'Violin'];

  it('borrows the velocity of a piano note of the same pitch within 0.05 s', () => {
    const piano: Note[] = [[1.04, 2, 60, 33], [5.06, 6, 60, 44], [9, 10, 61, 55]];
    const r = estimateVelocities([row(1), row(5), row(9)], [-20, -20, -20], piano);
    expect(r.borrowed).toEqual([true, false, false]);
    expect(r.vel[0]).toBe(33);
  });

  it('borrows the nearest, the earlier on a tie', () => {
    const piano: Note[] = [[0.97, 2, 60, 10], [1.02, 2, 60, 20], [3.96875, 4, 60, 30], [4.03125, 5, 60, 40]];
    const r = estimateVelocities([row(1), row(4)], [0, 0], piano);
    expect(r.vel).toEqual([20, 30]);
  });

  it('reads the song\'s own velocities at the level\'s rank with 50 or more piano notes', () => {
    const piano: Note[] = Array.from({ length: 60 }, (_, i): Note => [i * 10, i * 10 + 1, 30, i + 40]);
    const rows = [row(1001, 70), row(1002, 70), row(1003, 70)];
    const r = estimateVelocities(rows, [-6, -40, -20], piano);
    expect(r.vel[0]).toBe(99);
    expect(r.vel[1]).toBe(40);
    expect(r.borrowed).toEqual([false, false, false]);
  });

  it('falls back to the anchors without enough piano notes', () => {
    const rows = Array.from({ length: 21 }, (_, i) => row(i));
    const levels = rows.map((_, i) => -60 + i);   // rank i/20
    const r = estimateVelocities(rows, levels, []);
    expect(r.vel[10]).toBe(69);
    expect(r.vel[1]).toBe(46);
    expect(r.vel[19]).toBe(95);
    expect(r.vel[0]).toBe(43);    // extrapolated: 46 − 0.05 × 23/0.45
    expect(r.vel[20]).toBe(98);   // 95 + 0.05 × 26/0.45
    expect(estimateVelocities([row(0)], [-30], []).vel).toEqual([69]);
  });

  it('always gives integers in 1..127', () => {
    const piano: Note[] = Array.from({ length: 80 }, (_, i): Note => [i, i + 0.5, 20 + (i % 5), [0, 127, 63.4, 0.2, 200][i % 5]]);
    const rows = Array.from({ length: 200 }, (_, i) => row(i * 0.37, 20 + (i % 9)));
    const levels = rows.map((_, i) => (i % 7 === 0 ? NaN : -((i * 13) % 90)));
    const r = estimateVelocities(rows, levels, piano);
    for (const v of r.vel) expect(Number.isInteger(v) && v >= 1 && v <= 127).toBe(true);
    for (const v of estimateVelocities(rows, levels, []).vel) expect(Number.isInteger(v) && v >= 1 && v <= 127).toBe(true);
  });
});

describe('onsetLevels', () => {
  it('measures the loudest 10 ms frame in the first 60 ms, in dBFS', () => {
    const rate = 44100, pcm = new Float32Array(rate * 2);
    for (let i = rate; i < pcm.length; i++) pcm[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / rate);
    const [atOne, atHalf, pastEnd] = onsetLevels(pcm, rate, [1.0, 0.5, 5]);
    expect(Math.abs(atOne - -9.03)).toBeLessThan(0.2);   // 0.5/√2 RMS; a 10 ms frame holds 4.4 periods
    expect(atHalf).toBe(-120);
    expect(pastEnd).toBe(-120);
  });

  it('sees a sound that starts inside the window, not one that starts after it', () => {
    const rate = 44100, pcm = new Float32Array(rate);
    for (let i = Math.round(0.53 * rate); i < pcm.length; i++) pcm[i] = 0.25;
    const [inside, before] = onsetLevels(pcm, rate, [0.5, 0.46]);
    expect(inside).toBeCloseTo(20 * Math.log10(0.25), 3);
    expect(before).toBe(-120);
  });
});

describe('buildTracks', () => {
  it('writes a track only with enough notes, its share, family and label from TRACKS', () => {
    const rows: Ymt3Row[] = [];
    for (let i = 0; i < 20; i++) rows.push([i, i + 1, 60, 100, 'Violin']);
    for (let i = 0; i < 11; i++) rows.push([i + 0.5, i + 1, 48, 100, 'Cello']);   // 11 < 12: no track
    for (let i = 0; i < 12; i++) rows.push([i + 0.2, i + 1, 40, 100, 'Contrabass']);
    for (let i = 0; i < 30; i++) rows.push([i + 0.3, i + 1, 70, 100, 'Synth Pad']);  // no track, still counts
    rows.sort((a, b) => a[0] - b[0]);
    const vel = rows.map((_, i) => 40 + (i % 50)), borrowed = rows.map((_, i) => i % 4 === 0);
    const t = buildTracks(rows, vel, borrowed);
    expect(Object.keys(t)).toEqual(['violin', 'contrabass']);
    expect(t.violin!.label).toBe(TRACKS.violin.label);
    expect(t.violin!.family).toBe('strings');
    expect(t.violin!.notes.length).toBe(20);
    expect(t.violin!.share).toBeCloseTo(20 / 73, 4);
    expect(t.violin!.vel.borrowed + t.violin!.vel.level).toBe(20);
    const vi = rows.map((r, i) => [r, i] as const).filter(([r]) => r[4] === 'Violin');
    expect(t.violin!.notes).toEqual(vi.map(([r, i]) => [r[0], r[1], r[2], vel[i]]));
    expect(t.violin!.vel.borrowed).toBe(vi.filter(([, i]) => borrowed[i]).length);
  });

  it('raises the bar to 0.5 % of the rows for a long song', () => {
    const rows: Ymt3Row[] = [];
    for (let i = 0; i < 4000; i++) rows.push([i, i + 0.5, 60, 100, 'Violin']);
    for (let i = 0; i < 19; i++) rows.push([i + 0.1, i + 0.5, 50, 100, 'Oboe']);   // 19 < 0.005 × 4039 = 20.2
    for (let i = 0; i < 21; i++) rows.push([i + 0.2, i + 0.5, 50, 100, 'Bassoon']);
    rows.sort((a, b) => a[0] - b[0]);
    const t = buildTracks(rows, rows.map(() => 64), rows.map(() => false));
    expect(Object.keys(t)).toEqual(['violin', 'bassoon']);
  });
});
