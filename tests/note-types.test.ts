/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import { applyEdit } from '../src/studio/show/edit';
import { canonicalShow, instanceKey, isListen, repairShow, validateShow, type Show } from '../src/studio/show/show';
import { NOTE_TYPES, NOTE_TYPE_LABELS } from '../src/widgets/tags';
import type { Note, NoteType, SongNotes } from '../src/widgets/types';

const WA = loadLayers();
const heard = (notes: Note[], t: NoteType) => WA.listenNotes({ notes }, t).notes;
const seq = (n: number, gap: number, pitch: (i: number) => number, at = 0, len = 0.1): Note[] =>
  Array.from({ length: n }, (_, i) => [at + i * gap, at + i * gap + len, pitch(i), 80] as Note);
const byStart = (a: Note, b: Note) => a[0] - b[0];
/** Notes far from anything tested, so a track counts (40 notes or more). */
const pad = (at: number): Note[] => seq(40, 1, () => 30, at);

describe('the shared list', () => {
  it('lab/layers/lines.js and src/widgets/tags.ts name the same types, each with a label, and grace notes and tremolo are not among them', () => {
    expect(WA.NOTE_TYPES).toEqual(NOTE_TYPES);
    expect(Object.keys(NOTE_TYPE_LABELS)).toEqual(NOTE_TYPES);
    expect(NOTE_TYPES).toEqual(['chords', 'runs', 'trills', 'long', 'repeats', 'rolls']);
  });
});

describe('big chords', () => {
  it('takes every note of an attack of 5 or more, and nothing of a smaller one', () => {
    const big: Note[] = [48, 55, 60, 64, 67].map((m) => [0, 1, m, 80]);
    const small: Note[] = [48, 55, 60, 64].map((m) => [2, 3, m, 80]);
    expect(heard([...big, ...small], 'chords')).toEqual(big);
  });
  it('counts an attack as groupChords does: within 40 ms of its first note', () => {
    const spread: Note[] = [48, 55, 60, 64].map((m, i) => [i * 0.01, 1, m, 80]);
    expect(heard([...spread, [0.039, 1, 67, 80]], 'chords')).toHaveLength(5);
    expect(heard([...spread, [0.04, 1, 67, 80]], 'chords')).toEqual([]);
  });
});

describe('fast runs', () => {
  it('takes 6 or more steps of 1..3 semitones, 30..200 ms apart, that keep going', () => {
    const run = seq(8, 0.1, (i) => 60 + 2 * i);
    expect(heard(run, 'runs')).toEqual(run);
    expect(heard(run.slice(0, 5), 'runs')).toEqual([]);
    expect(heard(seq(8, 0.25, (i) => 60 + 2 * i), 'runs')).toEqual([]);
  });
  it('leaves a figure that turns back all the time, and one that goes nowhere', () => {
    expect(heard(seq(10, 0.1, (i) => 60 + (i % 2) * 2), 'runs')).toEqual([]);
    expect(heard(seq(8, 0.1, (i) => 60 + [0, 1, 2, 3, 3, 2, 1, 0][i]), 'runs')).toEqual([]);
  });
  it('leaves the notes around a run out', () => {
    const run = seq(8, 0.1, (i) => 60 + 2 * i), other: Note[] = [[0.05, 0.1, 30, 80], [5, 6, 90, 80]];
    expect(heard([...run, ...other].sort(byStart), 'runs')).toEqual(run);
  });
});

describe('trills', () => {
  const trill = seq(8, 0.1, (i) => 60 + (i % 2) * 2);
  it('takes a fast strict alternation at most a tone wide', () => {
    expect(heard(trill, 'trills')).toEqual(trill);
    expect(heard(seq(8, 0.1, (i) => 60 + (i % 2) * 4), 'trills')).toEqual([]);   // a third: a tremolo, which is not offered
    expect(heard(seq(8, 0.2, (i) => 60 + (i % 2) * 2), 'trills')).toEqual([]);   // too slow
  });
  it('wants a short one (under 6 notes) to stand alone', () => {
    const short = trill.slice(0, 4), nearby: Note = [short[0][0] - 0.1, short[0][0] - 0.05, 64, 80];
    expect(heard(short, 'trills')).toEqual(short);
    expect(heard([nearby, ...short], 'trills')).toEqual([]);
  });
  it('wants most of the notes near the pair to be the pair', () => {
    const crowd = seq(6, 0.1, () => 65, 0.03, 0.05);
    expect(heard([...trill, ...crowd].sort(byStart), 'trills')).toEqual([]);
  });
});

describe('long, ringing notes', () => {
  const short = seq(40, 0.5, () => 90, 0, 0.2);
  it('takes a note of at least 1.5 s with nothing near it starting in its first second', () => {
    const long: Note = [3, 6, 40, 80];
    expect(heard([...short, long].sort(byStart), 'long')).toEqual([long]);
    expect(heard([...short, [3, 4.4, 40, 80] as Note].sort(byStart), 'long')).toEqual([]);
  });
  it('leaves one whose neighbour moves within 4 semitones, but not a chord struck with it', () => {
    const long: Note = [3, 6, 40, 80];
    expect(heard([...short, long, [3.5, 3.7, 43, 80] as Note].sort(byStart), 'long')).toEqual([]);
    expect(heard([...short, long, [3.03, 3.2, 43, 80] as Note].sort(byStart), 'long')).toEqual([long]);
  });
  it('under a pedal, keeps to the longest tenth of the notes', () => {
    const rung = seq(40, 3, (i) => 30 + i).map((n, i) => [n[0], n[0] + 1.6 + i * 0.02, n[2], n[3]] as Note);
    expect(heard(rung, 'long')).toEqual(rung.slice(36));
  });
});

describe('repeated notes', () => {
  it('takes one pitch struck 3 times or more, 50..350 ms apart', () => {
    const hits = seq(4, 0.2, () => 60);
    expect(heard(hits, 'repeats')).toEqual(hits);
    expect(heard(hits.slice(0, 2), 'repeats')).toEqual([]);
    expect(heard(seq(4, 0.4, () => 60), 'repeats')).toEqual([]);
  });
  it('leaves a pitch that a neighbour plays between (a figure, not a repetition)', () => {
    const hits = seq(4, 0.2, () => 60);
    expect(heard([...hits, [0.1, 0.15, 62, 80] as Note].sort(byStart), 'repeats')).toEqual([]);
  });
});

describe('listenNotes with a note type', () => {
  it('hands back the input tuples, in order', () => {
    const run = seq(8, 0.1, (i) => 60 + 2 * i), out = heard(run, 'runs');
    out.forEach((n, i) => expect(n).toBe(run[i]));
  });

  it('hears nothing, and says it heard the type, when the song has none: never all notes', () => {
    const notes = seq(3, 1, (i) => 40 + 10 * i);
    for (const t of NOTE_TYPES) expect(WA.listenNotes({ notes }, t)).toEqual({ notes: [], heard: t });
    for (const t of NOTE_TYPES) expect(WA.listenNotes({ notes: [] }, t)).toEqual({ notes: [], heard: t });
  });

  it('finds trills and runs per track on an ensemble, in the union sorted by start', () => {
    const violin = seq(8, 0.1, (i) => 60 + (i % 2) * 2);
    const flute = seq(8, 0.1, (i) => 70 + 2 * i, 20);
    const mud = seq(6, 0.1, () => 65, 0.03, 0.05);   // a viola near the violin's pair: in all the notes the trill is lost
    const song: SongNotes = {
      notes: [...violin, ...flute, ...mud, ...pad(100)].sort(byStart),
      tracks: {
        violin: { notes: [...violin, ...pad(100)], family: 'strings' },
        viola: { notes: [...mud, ...pad(200)], family: 'strings' },
        flute: { notes: [...flute, ...pad(300)], family: 'winds' },
      },
    };
    expect(WA.listenNotes({ notes: song.notes }, 'trills').notes).toEqual([]);
    expect(WA.listenNotes(song, 'trills')).toEqual({ notes: violin, heard: 'trills' });
    expect(WA.listenNotes(song, 'runs').notes).toEqual(flute);
  });

  it('uses all the notes when only one track has 40 notes or more, and for the other types always', () => {
    const run = seq(8, 0.1, (i) => 60 + 2 * i), other = seq(8, 0.1, (i) => 40 + 2 * i, 10);
    const song: SongNotes = {
      notes: [...run, ...other].sort(byStart),
      tracks: { violin: { notes: run, family: 'strings' }, cello: { notes: [...other, ...pad(100)], family: 'strings' } },
    };
    expect(WA.listenNotes(song, 'runs').notes).toEqual(song.notes);
    const hits = seq(4, 0.2, () => 60), both: SongNotes = {
      notes: hits,
      tracks: { violin: { notes: [...pad(100)], family: 'strings' }, cello: { notes: [...pad(200)], family: 'strings' } },
    };
    expect(WA.listenNotes(both, 'repeats').notes).toEqual(hits);
  });

  it('fires a note as its own attack on this layer when another voice plays within 40 ms, and leaves the song as it was', () => {
    const run = seq(8, 0.1, (i) => 60 + 2 * i, 1);
    const chord: Note[] = [[0.98, 2, 30, 80], [0.99, 2, 34, 80]];   // 20 ms before the run's first note
    const notes = [...chord, ...run].sort(byStart);
    // Frozen: a type that sorted or edited the song's notes would throw or be seen here. That each routed instance
    // groups its own copy is runtime.ts's and lab/index.html's code, which no unit test runs.
    notes.forEach((n) => Object.freeze(n));
    Object.freeze(notes);
    const before = JSON.stringify(WA.groupChords(notes));
    expect(WA.groupChords(notes)[0].notes).toHaveLength(3);         // all the notes: one attack
    for (const t of NOTE_TYPES) heard(notes, t);
    WA.noteTypeAttacks({ notes });
    const own = WA.groupChords(heard(notes, 'runs'));
    expect(own).toHaveLength(8);
    expect(own[0]).toMatchObject({ t: 1, lo: 60, hi: 60 });         // this layer: the run note alone
    expect(JSON.stringify(WA.groupChords(notes))).toBe(before);
  });
});

describe('rolls', () => {
  // C2 G2 C3 E3 G3 C4 E4 G4: a chord rolled upwards, 0.1 s between notes, each ringing on.
  const roll = (at = 1, gap = 0.1): Note[] => [36, 43, 48, 52, 55, 60, 64, 67].map((m, i) => [at + i * gap, at + i * gap + 3, m, 70] as Note);
  it('finds a rolled chord, rising or falling, and lets one note out of line through', () => {
    expect(heard(roll(), 'rolls')).toEqual(roll());
    const down = roll().map((n, i, all) => [n[0], n[1], all[all.length - 1 - i][2], n[3]] as Note);
    expect(heard(down, 'rolls')).toEqual(down);
    const stray = roll(); stray[5] = [stray[5][0], stray[5][1], 50, 70];
    expect(heard(stray, 'rolls')).toEqual(stray);
  });
  it('wants it to arrive and ring: more notes straight after, and it is not a roll', () => {
    const on: Note[] = [[1.9, 2.1, 69, 70], [2.1, 2.3, 65, 70], [2.3, 2.5, 67, 70], [2.5, 2.7, 62, 70]];
    expect(heard([...roll(), ...on], 'rolls')).toEqual([]);
    expect(heard([...roll(), [2.3, 3, 72, 70]], 'rolls')).toEqual(roll());   // 0.6 s later: the roll had arrived
  });
  it('leaves out a scale, a chord struck unevenly, and three slow notes', () => {
    expect(heard(seq(8, 0.1, (i) => 60 + i), 'rolls')).toEqual([]);                  // steps: a run
    expect(heard(roll(1, 0.012), 'rolls')).toEqual([]);                              // 0.08 s in all
    expect(heard(seq(4, 0.3, (i) => 48 + i * 4), 'rolls')).toEqual([]);              // slow needs five
    expect(heard(roll(1, 0.3), 'rolls')).toEqual(roll(1, 0.3));                      // slow, eight, all in line
  });
});

describe('noteTypeAttacks', () => {
  it('gives the attack times per type', () => {
    const big: Note[] = [48, 55, 60, 64, 67].map((m) => [0, 1, m, 80]);
    const hits = seq(4, 0.25, () => 90, 5);
    expect(WA.noteTypeAttacks({ notes: [...big, ...hits] })).toEqual({ chords: [0], runs: [], trills: [], long: [], repeats: [5, 5.25, 5.5, 5.75], rolls: [] });
  });
  it('is empty for a song with no notes', () => {
    expect(WA.noteTypeAttacks({ notes: [] })).toEqual({ chords: [], runs: [], trills: [], long: [], repeats: [], rolls: [] });
  });
});

describe('in a show', () => {
  const show = (listen?: string): Show => ({
    version: 3, id: 'x', song: 'x', clips: [{ id: 'c1', start: 0, end: 10, track: 0, widget: 'flee', ...(listen ? { listen } : {}) }],
  });

  it('a type is a listen; grace notes, tremolo and ornaments are not', () => {
    for (const t of NOTE_TYPES) expect(isListen(t)).toBe(true);
    for (const t of ['grace', 'graces', 'tremolo', 'ornaments']) expect(isListen(t)).toBe(false);
  });

  it('validates, is its own instance, and survives repair and the canonical form', () => {
    expect(validateShow(show('runs')).errors).toEqual([]);
    expect(instanceKey({ id: 'c1', widget: 'flee', listen: 'runs' })).toBe('flee@runs#c1');
    expect(repairShow(show('runs'), {}).fixed).toEqual([]);
    const text = canonicalShow(show('runs'));
    expect(JSON.parse(text).version).toBe(3);
    expect(JSON.parse(text).clips[0]).toEqual({ id: 'c1', start: 0, end: 10, track: 0, widget: 'flee', listen: 'runs' });
  });

  it('warns, once, when the song or the clip has none of the type, saying what happens, only when the times are known', () => {
    const c = { noteTypes: { chords: [3], runs: [], trills: [20], long: [10], repeats: [9.9] } };
    expect(validateShow(show('runs'), c).warnings).toEqual([
      { path: 'clips[0].listen', message: 'this song has no fast runs: this clip stays still' },
    ]);
    expect(validateShow(show('trills'), c).warnings).toEqual([
      { path: 'clips[0].listen', message: 'this clip has no trills: it stays still' },
    ]);
    expect(validateShow(show('long'), c).warnings).toHaveLength(1);            // the clip ends at 10: that attack is past it
    expect(validateShow(show('chords'), c).warnings).toEqual([]);
    expect(validateShow(show('repeats'), c).warnings).toEqual([]);
    expect(validateShow(show('runs'), {}).warnings).toEqual([]);
    expect(validateShow(show('runs'), { tracks: [] }).warnings).toEqual([]);   // a type is no track the song lacks
    expect(validateShow(show(), c).warnings).toEqual([]);
    expect(validateShow(show('melody'), c).warnings).toEqual([]);
  });

  it('addClip and setClip take a type', () => {
    const added = applyEdit(show(), { kind: 'addClip', widget: 'stella', start: 0, end: 10, listen: 'repeats' });
    expect(added.clips[1]).toEqual({ id: 'c2', start: 0, end: 10, track: 1, widget: 'stella', listen: 'repeats' });
    const cleared = applyEdit(added, { kind: 'setClip', clip: 'c2', patch: { listen: null } });
    expect(cleared.clips[1]).toEqual({ id: 'c2', start: 0, end: 10, track: 1, widget: 'stella' });
  });
});
