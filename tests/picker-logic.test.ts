// The note picker's pure parts (spec 2026-11-01-note-picker): what the roll shows, what a pointer hits, what Suggest and
// Loudest choose, the popup's chips and words, marks and picks finding their notes again, and the preview's draft show.
import { describe, expect, it } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import type { SongPack } from '../src/studio/pack/pack';
import type { Mark } from '../src/studio/show/melody';
import { applyEdit } from '../src/studio/show/edit';
import { showInstances } from '../src/studio/show/conductor';
import { validateShow, type Show } from '../src/studio/show/show';
import type { LabelNote } from '../src/studio/ui/api';
import {
  boxHits, chipLayout, chipRuler, clock, countWords, earlierMarks, everyOther, fineClock, pickedSpan, phraseOf, sweptChips, draftKey, draftShow, firstClipOf, impulseWords, instrumentColor, loudest, marksOnRoll, marksToSave, moveView, nameOf,
  NoteIndex, noteAt, noteMark, pickerNotes, picksOnRoll, popupChips, previewSpan, recordingVolume, setRows, suggestLine, tipWords, toPicks, unmatchedInBox, unmatchedWords, undoWords, zoomView,
  type RollGeo, type RollNote,
} from '../src/studio/ui/picker-logic';
import type { Note } from '../src/widgets/types';

const L = loadLayers();
const roll = (t: number, m = 60, v = 80, e = t + 0.2, i = 0, id = 0, track?: string): RollNote => ({ id, t, e, m, v, i, ...(track ? { track } : {}) });
const ids = (ns: readonly RollNote[]) => ns.map((n) => n.id);
/** Numbered in order. */
const seq = (ns: RollNote[]): RollNote[] => ns.map((n, id) => ({ ...n, id }));

/** 100 px a second from x = 100, 10 px a semitone with midi 100 at the top. */
const geo: RollGeo = { xOf: (t) => 100 + t * 100, yOf: (m) => 20 + (100 - m) * 10, rowH: 10, gutter: 100, top: 20 };
const px = (t: number) => geo.xOf(t), py = (m: number) => geo.yOf(m) + 5;

describe('pickerNotes', () => {
  const pack = (notes: Note[], tracks?: unknown) => ({ notes, tracks }) as unknown as Pick<SongPack, 'notes' | 'tracks'>;

  it('tracks: a note per track note, sorted, its track the id, its loudness from the pack', () => {
    const tracks = { viola: { label: 'Violas', family: 'strings', notes: [[1, 2, 60, 50]] }, violin: { label: 'Violins', family: 'strings', notes: [[0.5, 1, 70, 90], [3, 4, 72, 91]] } };
    const r = pickerNotes(pack([[9, 10, 40, 40]], tracks), [[0, 1, 60, 70, 'Piano'], [0, 1, 61, 70, 'Horn']]);
    expect(r.guessed).toBe(false);
    expect(r.instruments.map((x) => x.key)).toEqual(['violin', 'viola']);
    expect(r.notes.map((n) => [n.id, n.t, n.m, n.v, n.track, n.i])).toEqual([[0, 0.5, 70, 90, 'violin', 0], [1, 1, 60, 50, 'viola', 1], [2, 3, 72, 91, 'violin', 0]]);
  });

  it('an empty track list falls through to the notes', () => {
    const r = pickerNotes(pack([[1, 2, 60, 80]], { violin: { label: 'Violins', family: 'strings', notes: [] } }), []);
    expect(r.instruments).toHaveLength(1);
    expect(r.notes).toHaveLength(1);
  });

  it('labels of two kinds: the nearest same pitch within 80 ms lends its loudness, else 70, and it says it is a guess', () => {
    const labels: LabelNote[] = [[1, 2, 60, 99, 'Piano'], [2, 3, 60, 99, 'Strings'], [5, 6, 61, 99, 'Piano'], [7, 8, 62, 99, 'Strings']];
    const r = pickerNotes(pack([[1.079, 1.5, 60, 33], [1.5, 1.6, 60, 44], [2.081, 2.5, 60, 55], [5.01, 5.5, 62, 66]]), labels);
    expect(r.guessed).toBe(true);
    expect(r.instruments.map((x) => x.label)).toEqual(['Piano', 'Strings']);
    expect(r.notes.map((n) => n.v)).toEqual([33, 70, 70, 70]);
    expect(r.notes.map((n) => n.track)).toEqual(['Piano', 'Strings', 'Piano', 'Strings']);
    expect(r.notes.map((n) => n.i)).toEqual([0, 1, 0, 1]);
  });

  it('labels sorted though the file is not, ids in that order', () => {
    const r = pickerNotes(pack([]), [[3, 4, 60, 1, 'A'], [1, 2, 60, 1, 'B']]);
    expect(r.notes.map((n) => [n.id, n.t])).toEqual([[0, 1], [1, 3]]);
  });

  it('one label or none: one instrument, from pack.notes, ids in order', () => {
    const notes: Note[] = [[1, 2, 60, 80], [1, 3, 64, 81], [4, 5, 67, 82]];
    for (const labels of [[], [[0, 1, 50, 70, 'Piano']]] as LabelNote[][]) {
      const r = pickerNotes(pack(notes), labels);
      expect(r.guessed).toBe(false);
      expect(r.instruments).toHaveLength(1);
      expect(r.notes.map((n) => [n.id, n.m, n.v])).toEqual([[0, 60, 80], [1, 64, 81], [2, 67, 82]]);
      expect(r.notes[0].track).toBeUndefined();
    }
  });
});

describe('instrumentColor', () => {
  it('by a word in its name, else a spare by its index', () => {
    expect(instrumentColor('Violins', 3)).toBe('#4fc3f7');
    expect(instrumentColor('French horns', 0)).toBe('#ff8a50');
    expect(instrumentColor('Bassoon', 0)).toBe('#bcaaa4');
    expect(instrumentColor('Double basses', 0)).toBe('#1fa187');
    expect(instrumentColor('Theremin', 1)).toBe('#90caf9');
    expect(instrumentColor('Theremin', 7)).toBe('#90caf9');
  });
});

describe('NoteIndex', () => {
  it('agrees with a plain filter on 2000 notes with long ones among them, at 50 windows', () => {
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const notes = Array.from({ length: 2000 }, () => { const t = rnd() * 600; return { t, len: rnd() < 0.02 ? 40 * rnd() : 0.3 * rnd() }; })
      .sort((a, b) => a.t - b.t).map(({ t, len }, id) => roll(t, 60, 80, t + len, 0, id));
    const index = new NoteIndex(notes);
    for (let k = 0; k < 50; k++) {
      const a = rnd() * 600, b = a + rnd() * 30;
      expect(ids(index.inView(a, b))).toEqual(ids(notes.filter((n) => n.t < b && n.e > a)));
    }
  });

  it('a note ending exactly at a is out, one starting exactly at b is out', () => {
    const index = new NoteIndex(seq([roll(0, 60, 80, 1), roll(2, 60, 80, 3)]));
    expect(ids(index.inView(1, 2))).toEqual([]);
    expect(index.firstFrom(2)).toBe(1);
  });
});

describe('noteAt', () => {
  const held = roll(0, 60, 80, 5, 0, 1), short = roll(1, 60, 80, 1.1, 0, 2), other = roll(3, 61, 80, 3.1, 0, 3);

  it('a dense passage: a click on a short note under a long held one gets the short note', () => {
    expect(noteAt([held, short, other], px(1.02), py(60), geo)?.id).toBe(2);
    expect(noteAt([short, held, other], px(1.02), py(60), geo)?.id).toBe(2);
  });

  it('elsewhere on the held note it gets the held note', () => {
    expect(noteAt([held, short], px(4), py(60), geo)?.id).toBe(1);
  });

  it('nearest wins, and a tie goes to the nearest attack', () => {
    const a = roll(1, 60, 80, 2, 0, 1), b = roll(1.5, 60, 80, 2, 0, 2);
    expect(noteAt([a, b], px(1.6), py(60), geo)?.id).toBe(2);
    expect(noteAt([b, a], px(1.2), py(60), geo)?.id).toBe(1);
  });

  it('6 px off is in reach, 8 is nothing; the gutter and the ruler are nothing', () => {
    const n = roll(1, 60, 80, 1.1, 0, 5);
    expect(noteAt([n], px(1) - 6, py(60), geo)?.id).toBe(5);
    expect(noteAt([n], px(1) - 8, py(60), geo)).toBeNull();
    expect(noteAt([roll(0, 60, 80, 5)], 99, py(60), geo)).toBeNull();
    expect(noteAt([roll(0, 100, 80, 5)], px(1), 10, geo)).toBeNull();
  });

  it('a very short note still has 3 px to hit', () => {
    expect(noteAt([roll(1, 60, 80, 1.001, 0, 9)], px(1) + 3, py(60), geo)?.id).toBe(9);
  });
});

describe('boxHits', () => {
  it('starts inside only, by time and pitch, whichever way it was dragged', () => {
    const inside = roll(1, 60, 80, 1.2, 0, 1), held = roll(0, 60, 80, 5, 0, 2), high = roll(1, 90, 80, 1.2, 0, 3), late = roll(4, 60, 80, 4.2, 0, 4);
    const all = [inside, held, high, late];
    expect(ids(boxHits(all, { x0: px(0.5), y0: py(61), x1: px(2), y1: py(59) }, geo))).toEqual([1]);
    expect(ids(boxHits(all, { x0: px(2), y0: py(59), x1: px(0.5), y1: py(61) }, geo))).toEqual([1]);
  });
});

describe('suggestLine', () => {
  it('returns the same objects, and skips what it is not given', () => {
    const a = roll(0, 72, 80, 0.4, 0, 0), b = roll(0.5, 74, 80, 0.9, 0, 1), hidden = roll(0.5, 96, 80, 0.9, 1, 2);
    const line = suggestLine(L, [a, b]);
    expect(line).toEqual([a, b]);
    expect(line[0]).toBe(a);
    expect(line.includes(hidden)).toBe(false);
  });

  it('the top of an accompaniment under a held melody note is not marked', () => {
    // A melody note held for two seconds, with chords below it: the chords' tops never sound above it.
    const melody = roll(0, 76, 90, 2, 0, 0);
    const acc = [0.5, 1, 1.5].flatMap((t, k) => [roll(t, 55, 50, t + 0.2, 0, 1 + k * 2), roll(t, 64, 50, t + 0.2, 0, 2 + k * 2)]);
    const line = suggestLine(L, [melody, ...acc]);
    expect(line.includes(melody)).toBe(true);
    for (const n of acc.filter((x) => x.m === 64)) expect(line.includes(n)).toBe(false);
  });
});

describe('loudest', () => {
  const ns = [roll(0, 60, 50, 1, 0, 0), roll(1, 60, 90, 2, 0, 1), roll(2, 60, 70, 3, 0, 2), roll(3, 60, 90, 4, 0, 3)];
  it('k by velocity, ties by time; k over the length is fine; nothing changed', () => {
    expect(ids(loudest(ns, 2))).toEqual([1, 3]);
    expect(ids(loudest(ns, 3))).toEqual([1, 3, 2]);
    expect(loudest(ns, 99)).toHaveLength(4);
    expect(ids(ns)).toEqual([0, 1, 2, 3]);
  });
});

describe('picking many', () => {
  const notes = [roll(0, 60, 80, 0.2), roll(0.5, 62, 80, 0.7), roll(0.51, 70, 80, 0.7), roll(1, 64, 80, 1.2), roll(5, 65, 80, 5.2), roll(5.5, 67, 80, 5.7)].map((n, id) => ({ ...n, id }));
  it('a drag takes the chips whose middles it passed, either way', () => {
    const { chips } = chipLayout(notes), mid = (i: number) => chips[i].x + 10;
    expect(sweptChips(chips, mid(0), mid(3)).map((n) => n.id)).toEqual([notes[0].id, notes[1].id, notes[2].id, notes[3].id]);
    expect(sweptChips(chips, mid(3), mid(0))).toHaveLength(4);
    expect(sweptChips(chips, mid(3) + 1, mid(4) - 1)).toEqual([]);
  });
  it('a phrase runs from pause to pause', () => {
    expect(phraseOf(notes, notes[1].id).map((n) => n.id)).toEqual(notes.slice(0, 4).map((n) => n.id));
    expect(phraseOf(notes, notes[5].id).map((n) => n.id)).toEqual(notes.slice(4).map((n) => n.id));
    expect(phraseOf(notes, -99)).toEqual([]);
  });
  it('every other attack keeps the notes of one attack together', () => {
    expect(everyOther(notes).map((n) => n.t)).toEqual([0, 1, 5.5]);
    const two = [roll(0, 60), roll(0.5, 62), roll(0.51, 70), roll(1, 64)];
    expect(everyOther(two.slice(1)).map((n) => n.t)).toEqual([0.5, 0.51]);
  });
});

describe('the times on the strip', () => {
  const run = (t: number, n: number, wait = 0.25) => Array.from({ length: n }, (_, i) => roll(t + i * wait, 60 + i, 80));
  it('reads to the tenth of a second, and carries over the minute', () => {
    expect(fineClock(173.556)).toBe('2:53.6');
    expect(fineClock(5)).toBe('0:05.0');
    expect(fineClock(59.97)).toBe('1:00.0');
  });
  it('labels the first note, then keeps the labels apart', () => {
    const { chips } = chipLayout(run(10, 40));
    const r = chipRuler(chips);
    expect(r[0]).toEqual({ x: chips[0].x, t: 10 });
    expect(r.length).toBeGreaterThan(5);
    for (let i = 1; i < r.length; i++) expect(r[i].x - r[i - 1].x).toBeGreaterThanOrEqual(56);
  });
  it('labels the note after a long pause', () => {
    const notes = [...run(10, 3), ...run(100, 3)];
    expect(chipRuler(chipLayout(notes).chips).map((l) => l.t)).toContain(100);
  });
  it('gives one label to the notes of one attack', () => {
    const { chips } = chipLayout([roll(10, 60), roll(10.01, 72), roll(10.02, 84)]);
    expect(chipRuler(chips)).toHaveLength(1);
  });
  it('says when the picked notes start and end', () => {
    expect(pickedSpan([])).toBe('');
    expect(pickedSpan([roll(173.556), roll(175.285)])).toBe('2:53.6 to 2:55.3');
    expect(pickedSpan([roll(60), roll(60.01)])).toBe('at 1:00.0');
  });
});

describe('chipLayout', () => {
  /** n notes, a wait apart, each sounding for most of it, starting at t. */
  const run = (t: number, n: number, wait = 0.25) => Array.from({ length: n }, (_, i) => roll(t + i * wait, 60 + (i % 5) * 3, 80, t + i * wait + wait * 0.8));
  const gapsAfter = (notes: ReturnType<typeof run>) => chipLayout(notes).chips;

  it('the usual wait is one chip wide, and notes never overlap', () => {
    const chips = gapsAfter(run(0, 20));
    for (let i = 1; i < chips.length; i++) expect(chips[i].x - chips[i - 1].x).toBeCloseTo(24, 6);
  });

  it('keeps time: a longer wait is a wider space, however fast the run around it', () => {
    const chips = gapsAfter([...run(0, 10), ...run(2.9, 10), ...run(5.9, 10)]);
    const space = (i: number) => chips[i].x - chips[i - 1].x;
    expect(space(5)).toBeCloseTo(24, 6);
    expect(space(10)).toBeGreaterThan(24 * 2.5);    // the wait of 0.65 s
    expect(space(20)).toBeGreaterThan(space(10));   // the wait of 0.75 s
  });

  it('a very long rest grows only slowly, so the rest of the melody stays near', () => {
    const chips = gapsAfter([...run(0, 10), ...run(300, 10)]);
    expect(chips[10].x - chips[9].x).toBeLessThan(500);   // not the 30 000 px it would be in time
  });

  it('a pause over 1 s of silence gets a line between the notes, saying how long', () => {
    const { chips, gaps, width } = chipLayout([roll(0, 60, 80, 0.5), roll(1.5, 62, 80, 2), roll(3.01, 64, 80, 3.5)]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].t).toBe(3.01);
    expect(gaps[0].secs).toBeCloseTo(1.01, 6);
    expect(gaps[0].x).toBeGreaterThan(chips[1].x + 20); expect(gaps[0].x).toBeLessThan(chips[2].x);
    expect(width).toBe(chips[2].x + 24 + 12);
  });

  it('notes of one attack stand over each other, unless they would touch', () => {
    const { chips } = chipLayout([roll(0, 60), roll(0.01, 80), roll(0.02, 80), roll(1, 62)]);
    expect(chips[1].x).toBe(chips[0].x);
    expect(chips[2].x).toBeGreaterThan(chips[1].x);   // the same pitch again: beside it
    expect(chips[3].x).toBeGreaterThan(chips[2].x);
  });

  it('a tail as long as the note sounds', () => {
    const chips = gapsAfter(run(0, 10));
    expect(chips[0].tail).toBeCloseTo(24 * 0.8, 6);
  });

  it('no pause while an earlier note still sounds', () => {
    expect(chipLayout([roll(0, 60, 80, 10), roll(0.1, 62, 80, 0.2), roll(5, 64, 80, 5.1)]).gaps).toEqual([]);
  });

  it('the highest pitch highest, one pitch centred, none is empty', () => {
    const { chips } = chipLayout([roll(0, 60), roll(1, 72), roll(2, 66)]);
    expect(chips[1].y).toBeLessThan(chips[2].y);
    expect(chips[2].y).toBeLessThan(chips[0].y);
    const flat = chipLayout([roll(0, 60), roll(1, 60)]).chips;
    expect(flat[0].y).toBe(56);
    expect(flat[1].y).toBe(56);
    expect(chipLayout([]).chips).toEqual([]);
  });
});

describe('countWords', () => {
  it('the count, and the impulses when they differ', () => {
    const chord = [roll(1, 60), roll(1.02, 64), roll(1.03, 67)];
    expect(countWords(chord, 25)).toEqual({ count: '3', of: 'of 25 melody notes picked', attacks: '1 impulse: notes within 40 ms are one' });
    expect(countWords([...chord, roll(2, 60)], 25).attacks).toBe('2 impulses: notes within 40 ms are one');
    expect(countWords([roll(1), roll(2)], 1)).toEqual({ count: '2', of: 'of 1 melody note picked', attacks: '' });
    expect(countWords([], 0).count).toBe('0');
  });
});

describe('toPicks and noteMark', () => {
  it('sorted by start, the note itself; a track only when it has one', () => {
    expect(toPicks([roll(2, 62, 70, 3), roll(1, 60, 80, 1.5)])).toEqual([[1, 1.5, 60, 80], [2, 3, 62, 70]]);
    expect(noteMark(roll(1, 60, 80, 2))).toEqual([1, 2, 60, 80]);
    expect(noteMark(roll(1, 60, 80, 2, 0, 0, 'violin'))).toEqual([1, 2, 60, 80, 'violin']);
  });
});

describe('picksOnRoll', () => {
  it('found within 50 ms at the pitch; lost kept', () => {
    const notes = seq([roll(1, 60), roll(2, 62), roll(3, 64)]);
    const { found, lost } = picksOnRoll([[1.04, 1.2, 60, 80], [2, 2.2, 63, 80], [3.06, 3.2, 64, 80]], notes);
    expect(ids(found)).toEqual([0]);
    expect(lost).toEqual([[2, 2.2, 63, 80], [3.06, 3.2, 64, 80]]);
  });
});

describe('marks', () => {
  const notes = seq([roll(1, 60, 80, 1.2, 0, 0, 'violin'), roll(1, 60, 80, 1.2, 1, 0, 'viola'), roll(2, 62, 80, 2.2, 0, 0, 'violin')]);

  it('find their notes, the same track first; those that find none are listed', () => {
    const marks: Mark[] = [[1, 1.2, 60, 80, 'viola'], [9, 9.2, 60, 80, 'violin']];
    const r = marksOnRoll(marks, notes);
    expect([...r.marked]).toEqual([1]);
    expect(r.unmatched).toEqual([marks[1]]);
  });

  it('are saved with the ones that found none, never dropped', () => {
    const lost: Mark = [9, 9.2, 60, 80, 'violin'];
    expect(marksToSave(new Set(), new Set([2]), notes, [lost])).toEqual([[2, 2.2, 62, 80, 'violin'], lost]);
  });

  it('are saved as the earlier marks and the new picks together, each note once: unpicking loses no earlier mark', () => {
    const lost: Mark = [9, 9.2, 60, 80, 'violin'], saved = (picked: number[]) => marksToSave(new Set([0, 1]), new Set(picked), notes, [lost]);
    expect(saved([])).toEqual([[1, 1.2, 60, 80, 'violin'], [1, 1.2, 60, 80, 'viola'], lost]);
    expect(saved([1, 2])).toEqual([[1, 1.2, 60, 80, 'violin'], [1, 1.2, 60, 80, 'viola'], [2, 2.2, 62, 80, 'violin'], lost]);
  });

  it('are offered back when neither being picked nor connected to a widget', () => {
    expect(earlierMarks(new Set([0, 1, 2]), new Set([1]), new Map([[2, 'hsl(0 0% 0%)']]))).toEqual([0]);
    expect(earlierMarks(new Set([1]), new Set([1]), new Set())).toEqual([]);
    expect(earlierMarks(new Set(), new Set(), new Set())).toEqual([]);
  });

  it('come back as they went', () => {
    const saved = marksToSave(new Set([0]), new Set([2]), notes, []);
    expect([...marksOnRoll(saved, notes).marked].sort()).toEqual([0, 2]);
  });
});

describe('popupChips', () => {
  const notes = seq([roll(1, 60), roll(2, 62), roll(3, 64), roll(4, 65)]);

  it('placing: the melody, none on', () => {
    const r = popupChips([notes[0], notes[2]], null, notes);
    expect(ids(r.chips)).toEqual([0, 2]);
    expect(r.on.size).toBe(0);
  });

  it('editing with nothing being picked: the set alone, all on, a pick off every note too, so an update loses none', () => {
    const picks: Note[] = [[2, 2.2, 62, 80], [3, 3.2, 64, 80, 0.5], [3.5, 3.6, 70, 66]];
    const r = popupChips([], picks, notes);
    expect(r.chips.map((n) => n.t)).toEqual([2, 3, 3.5]);
    expect(r.on.size).toBe(3);
    expect(toPicks(r.chips.filter((n) => r.on.has(n.id)), r.values)).toEqual([[2, 2.2, 62, 80], [3, 3.2, 64, 80, 0.5], [3.5, 3.6, 70, 66]]);
  });

  it('editing: the set on, an unmarked pick listed, a pick off every note listed with an id below zero', () => {
    const picks: Note[] = [[2, 2.2, 62, 80], [3, 3.2, 64, 80], [3.5, 3.6, 70, 66]];
    const r = popupChips([notes[0], notes[2]], picks, notes);
    expect(r.chips.map((n) => n.t)).toEqual([1, 2, 3, 3.5]);
    expect(ids(r.chips.filter((n) => r.on.has(n.id)))).toEqual([1, 2, -1]);
    const lost = r.chips[3];
    expect([lost.t, lost.e, lost.m, lost.v, lost.i]).toEqual([3.5, 3.6, 70, 66, -1]);
    expect(toPicks(r.chips.filter((n) => r.on.has(n.id))).map((n) => n[0])).toEqual([2, 3, 3.5]);
  });
});

const base = (): Show => ({ version: 3, id: 's', song: 's', clips: [{ id: 'c1', start: 0, end: 30, track: 0, widget: 'squares' }] });

describe('setRows and firstClipOf', () => {
  const picks: Note[] = [[12, 12.2, 60, 80], [25, 25.2, 62, 80]];
  const placed = applyEdit(base(), { kind: 'placePicks', widget: 'pointillism', notes: picks });

  it('a row per set, with its widget; a show without picks has none', () => {
    expect(setRows(base())).toEqual([]);
    expect(setRows(placed)).toEqual([{ id: 'p1', widget: 'pointillism', notes: picks, neverHeard: 0 }]);
    expect(firstClipOf(placed, 'p1')?.id).toBe('c2');
    expect(firstClipOf(placed, 'p9')).toBeNull();
  });

  it('a pick left outside every clip using its set is counted on the row, as the failure it is', () => {
    const moved = applyEdit(placed, { kind: 'moveClip', clip: 'c2', start: 20, track: 1 });
    expect(setRows(moved)[0].neverHeard).toBe(1);
  });

  it('a set no clip uses has no widget', () => {
    expect(setRows({ ...base(), picks: { p1: { notes: picks } } })[0].widget).toBeNull();
  });
});

describe('draftShow', () => {
  const notes: Note[] = [[1, 2, 60, 80]];

  it('on picks: one clip over the whole song, its own set, no fade', () => {
    const d = draftShow('s', 30, 'pointillism', notes);
    expect(d.clips).toEqual([{ id: 'draft', start: 0, end: 30, track: 0, fade: 0, widget: 'pointillism', listen: 'picks:draft' }]);
    expect(d.picks).toEqual({ draft: { notes } });
    expect(validateShow(d).errors).toEqual([]);
    expect(showInstances(d)).toEqual([{ key: 'pointillism@picks:draft#draft', widget: 'pointillism', listen: 'picks:draft', own: true, notes }]);
    expect(draftKey('pointillism', 'pick')).toBe('pointillism@picks:draft#draft');
  });

  it('every note: the plain widget; no picks at all', () => {
    const d = draftShow('s', 30, 'pointillism', null);
    expect(d.clips[0].listen).toBeUndefined();
    expect(d.picks).toBeUndefined();
    expect(showInstances(d)[0].key).toBe('pointillism#draft');
    expect(draftKey('pointillism', 'all')).toBe('pointillism#draft');
  });

  it('none picked hears nothing, never every note', () => {
    expect(showInstances(draftShow('s', 30, 'pointillism', []))[0].notes).toEqual([]);
  });

  it('each draft has a notes list of its own, so a change of picks reloads the instance; knobs go on the clip', () => {
    expect(draftShow('s', 30, 'a', notes).picks!.draft.notes).not.toBe(draftShow('s', 30, 'a', notes).picks!.draft.notes);
    expect(draftShow('s', 30, 'a', notes, { size: 0.5 }).clips[0].knobs).toEqual({ size: 0.5 });
  });
});

describe('previewSpan', () => {
  it('a second before the first, 1.5 s after the last has ended, not before 0', () => {
    expect(previewSpan([{ t: 5, e: 5.5 }, { t: 6, e: 6.2 }])).toEqual({ from: 4, to: 7.7 });
    expect(previewSpan([{ t: 0.5, e: 9 }, { t: 1, e: 1.1 }])).toEqual({ from: 0, to: 10.5 });
    expect(previewSpan([])).toBeNull();
  });
});

describe('the view', () => {
  it('moves inside the song', () => {
    expect(moveView({ a: 10, b: 34 }, -5, 100)).toEqual({ a: 0, b: 24 });
    expect(moveView({ a: 10, b: 34 }, 90, 100)).toEqual({ a: 76, b: 100 });
    expect(moveView({ a: 10, b: 34 }, 20, 100)).toEqual({ a: 20, b: 44 });
  });

  it('zooms about a time, which stays where it is; 3 s to the whole song', () => {
    const v = zoomView({ a: 10, b: 30 }, 0.5, 15, 100);
    expect(v).toEqual({ a: 12.5, b: 22.5 });
    expect((15 - v.a) / (v.b - v.a)).toBe(0.25);
    const tight = zoomView({ a: 10, b: 14 }, 0.1, 12, 100);
    expect(tight.b - tight.a).toBe(3);
    expect(zoomView({ a: 10, b: 30 }, 100, 15, 100)).toEqual({ a: 0, b: 100 });
  });
});

describe('words', () => {
  it('names, times, the hover and the set line', () => {
    expect(nameOf(60)).toBe('C4');
    expect(nameOf(61)).toBe('C♯4');
    expect(clock(125.7)).toBe('2:05');
    expect(tipWords(roll(65, 60, 100), 'Violins')).toBe('Violins · C4 · 1:05 · loud');
    expect(tipWords(roll(5, 60, 70), null)).toBe('C4 · 0:05 · medium');
    expect(tipWords(roll(5, 60, 30), null)).toBe('C4 · 0:05 · soft');
    expect(impulseWords([[1, 2, 60, 80], [1.01, 2, 64, 80], [3, 4, 60, 80]])).toBe('2 impulses (3 notes picked)');
    expect(impulseWords([[1, 2, 60, 80]])).toBe('1 impulse (1 note picked)');
  });
});

describe('the marks by hand', () => {
  it('unmatchedInBox: the outlines an Alt-drag crosses, by the same geometry as the notes', () => {
    const a: Mark = [1, 1.2, 60, 80], b: Mark = [5, 5.2, 60, 80], c: Mark = [1, 1.2, 90, 80];
    expect(unmatchedInBox([a, b, c], { x0: px(0.5), y0: py(61), x1: px(2), y1: py(59) }, geo)).toEqual([a]);
    expect(unmatchedInBox([a, b, c], { x0: px(8), y0: py(61), x1: px(9), y1: py(59) }, geo)).toEqual([]);
  });

  it('unmatchedWords: counts, and says how to drop one on purpose', () => {
    expect(unmatchedWords(1)).toMatch(/^1 earlier mark has no note/);
    expect(unmatchedWords(3)).toMatch(/^3 earlier marks have no note/);
    expect(unmatchedWords(1)).toMatch(/Alt-drag a small box around just that outline, touching no notes/);
  });

  it('undoWords: says what the undo did, and where a placement is undone', () => {
    expect(undoWords(1)).toMatch(/^Undo here took back 1 change to your picked notes/);
    expect(undoWords(3)).toMatch(/3 changes/);
    expect(undoWords(0)).toMatch(/^Undo here is for your picked notes/);
    for (const k of [0, 1]) expect(undoWords(k)).toMatch(/Back to the studio/);
  });
});

describe('the popup', () => {
  it('draftKey: the key the runtime knows each side of the compare by', () => {
    const key = (s: Show) => showInstances(s)[0].key;
    expect(draftKey('halftone', 'pick')).toBe(key(draftShow('demo', 10, 'halftone', [[1, 2, 60, 80]])));
    expect(draftKey('halftone', 'all')).toBe(key(draftShow('demo', 10, 'halftone', null)));
  });

  it('recordingVolume: down with a ♪ on, up again while the popup previews, when no tone plays', () => {
    expect(recordingVolume(0, false)).toBe(1);
    expect(recordingVolume(2, false)).toBe(0.3);
    expect(recordingVolume(2, true)).toBe(1);
  });
});
