/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import type { Note, SongNotes } from '../src/widgets/types';

const WA = loadLayers();

describe('melody and bassline', () => {
  it('keeps the sounding top note and drops an attack more than 2 below it', () => {
    const notes: Note[] = [[0, 2, 60, 80], [0, 2, 64, 80], [0, 2, 67, 80], [1, 1.5, 64, 80]];   // C4 E4 G4, then E4 under G4
    expect(WA.lineNotes(notes, 'melody')).toEqual([[0, 2, 67, 80]]);
  });

  it('lets a new top join once the melody note has ended, and a step of 2 below while it sounds', () => {
    const after: Note[] = [[0, 1, 67, 80], [1.2, 2, 64, 80]];
    expect(WA.lineNotes(after, 'melody')).toEqual(after);
    const step: Note[] = [[0, 2, 67, 80], [1, 2, 65, 80], [1.5, 2, 64, 80]];   // G4, F4 (−2 joins), E4 (−1 under F4 joins)
    expect(WA.lineNotes(step, 'melody')).toEqual(step);
    const higher: Note[] = [[0, 2, 60, 80], [1, 2, 72, 80]];
    expect(WA.lineNotes(higher, 'melody')).toEqual(higher);
  });

  it('is symmetric for the bassline', () => {
    const notes: Note[] = [[0, 2, 48, 80], [0, 2, 52, 80], [0, 2, 55, 80], [1, 1.5, 52, 80]];
    expect(WA.lineNotes(notes, 'bassline')).toEqual([[0, 2, 48, 80]]);
    const after: Note[] = [[0, 1, 48, 80], [1.2, 2, 51, 80]];
    expect(WA.lineNotes(after, 'bassline')).toEqual(after);
  });

  it('puts every other note in inner', () => {
    const notes: Note[] = [[0, 2, 48, 80], [0, 2, 55, 80], [0, 2, 60, 80], [0, 2, 67, 80], [1, 1.5, 62, 80], [3, 4, 70, 80]];
    expect(WA.lineNotes(notes, 'inner')).toEqual([[0, 2, 55, 80], [0, 2, 60, 80], [1, 1.5, 62, 80]]);
  });

  it('returns the input tuples, stable-sorted by start', () => {
    const notes: Note[] = [[0, 1, 60, 80], [0.01, 1, 72, 80], [0.5, 2, 74, 80]];
    const m = WA.lineNotes(notes, 'melody');
    expect(m[0]).toBe(notes[1]);
    expect(m[1]).toBe(notes[2]);
  });
});

describe('low, high, accents', () => {
  it('splits low and high at 55 and 72', () => {
    const notes: Note[] = [[0, 1, 54, 80], [0, 1, 55, 80], [0, 1, 71, 80], [0, 1, 72, 80]];
    expect(WA.lineNotes(notes, 'low')).toEqual([[0, 1, 54, 80]]);
    expect(WA.lineNotes(notes, 'high')).toEqual([[0, 1, 72, 80]]);
  });

  it('takes the chords at or above the 85th percentile (nearest rank) of chord vels', () => {
    const notes: Note[] = [];
    const order = [5, 17, 1, 20, 9, 13, 2, 18, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15, 16, 19];
    order.forEach((v, i) => { notes.push([i, i + 0.5, 60, v], [i + 0.01, i + 0.5, 64, Math.max(1, v - 1)]); });
    const acc = WA.lineNotes(notes, 'accents');
    const vels = new Set(acc.map((n) => order[Math.floor(n[0])]));
    expect([...vels].sort((a, b) => a - b)).toEqual([17, 18, 19, 20]);
    expect(acc.length).toBe(8);
  });
});

describe('listenNotes', () => {
  const v: Note[] = [[1, 2, 76, 80], [3, 4, 77, 80]];
  const c: Note[] = [[0.5, 2, 48, 80], [3, 5, 50, 80]];
  const all: Note[] = [[0, 1, 60, 80], [0, 1, 67, 80], [2, 3, 72, 80]];
  const song: SongNotes = { notes: all, tracks: { cello: { notes: c, family: 'strings' }, violin: { notes: v, family: 'strings' } } };

  it('gives all notes for no listen and for all', () => {
    expect(WA.listenNotes(song, undefined)).toEqual({ notes: all, heard: 'all' });
    expect(WA.listenNotes(song, 'all')).toEqual({ notes: all, heard: 'all' });
  });

  it('gives a present track\'s notes', () => {
    expect(WA.listenNotes(song, 'violin')).toEqual({ notes: v, heard: 'violin' });
  });

  it('gives a family\'s union, stable by start, in track order', () => {
    expect(WA.listenNotes(song, 'family:strings')).toEqual({ notes: [c[0], v[0], v[1], c[1]], heard: 'family:strings' });
  });

  it('falls back to all when the track or family is missing', () => {
    expect(WA.listenNotes(song, 'horn')).toEqual({ notes: all, heard: 'all' });
    expect(WA.listenNotes(song, 'family:brass')).toEqual({ notes: all, heard: 'all' });
    expect(WA.listenNotes({ notes: all }, 'violin')).toEqual({ notes: all, heard: 'all' });
  });

  it('gives a derived line by its name', () => {
    expect(WA.listenNotes(song, 'melody')).toEqual({ notes: WA.lineNotes(all, 'melody'), heard: 'melody' });
    expect(WA.listenNotes(song, 'melody').notes).toEqual([[0, 1, 67, 80], [2, 3, 72, 80]]);
  });
});
