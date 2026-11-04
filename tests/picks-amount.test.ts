/// <reference types="node" />
// A picked note's intensity: kept through every step that rebuilds a set, heard as loudness, and read by Ivory.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { showInstances } from '../src/studio/show/conductor';
import { applyEdit } from '../src/studio/show/edit';
import { repairPickNotes, repairShow, validateShow, withAmount, type Show } from '../src/studio/show/show';
import { amountAt, amountBars, draftShow, picksOnRoll, popupChips, toPicks, type Chip, type RollNote } from '../src/studio/ui/picker-logic';
import { groupChords } from '../src/widgets/chords';
import type { Note } from '../src/widgets/types';

const NOTES: Note[] = [[1, 2, 60, 80, 1.5], [3, 4, 64, 100, 2], [5, 6, 67, 60]];
const show = (notes: unknown): Show => ({
  version: 3, id: 'demo', song: 'demo', clips: [{ id: 'a', start: 0, end: 10, track: 0, widget: 'pointillism', listen: 'picks:p1' }],
  picks: { p1: { notes } },
} as Show);
const C = { duration: 10, tracks: [] };
const roll: RollNote[] = [{ id: 7, t: 1, e: 2, m: 60, v: 80, i: 0 }, { id: 8, t: 3, e: 4, m: 64, v: 100, i: 0 }, { id: 9, t: 5, e: 6, m: 67, v: 60, i: 0 }];

describe('a picked note\'s intensity in a show', () => {
  it('is valid in 0..2, and only there', () => {
    expect(validateShow(show(NOTES), C).errors).toEqual([]);
    expect(validateShow(show([[1, 2, 60, 80, 2.5]]), C).errors.length).toBe(1);
    expect(validateShow(show([[1, 2, 60, 80, -1]]), C).errors.length).toBe(1);
    expect(validateShow(show([[1, 2, 60, 80, 1, 1]]), C).errors.length).toBe(1);
  });
  it('survives a repair, and a bad value costs the value, not the note', () => {
    expect(repairPickNotes(NOTES)).toEqual(NOTES);
    expect(repairPickNotes([[1, 2, 60, 80, 9]])).toEqual([[1, 2, 60, 80]]);
    expect(repairShow(show(NOTES), C).show.picks?.p1.notes).toEqual(NOTES);
  });
  it('stays on its note when a repair sorts the set', () => {
    expect(repairPickNotes([[5, 6, 67, 60, 0.5], [1, 2, 60, 80]])).toEqual([[1, 2, 60, 80], [5, 6, 67, 60, 0.5]]);
  });
  it('is not written for 1, so a set nobody touched stays as it was', () => {
    expect(withAmount([1, 2, 60, 80], 1)).toEqual([1, 2, 60, 80]);
    expect(repairPickNotes([[1, 2, 60, 80, 1]])).toEqual([[1, 2, 60, 80]]);
  });
  it('can be 0', () => {
    expect(repairPickNotes([[1, 2, 60, 80, 0]])).toEqual([[1, 2, 60, 80, 0]]);
  });
  it('survives placing and updating a set', () => {
    const placed = applyEdit({ version: 3, id: 'demo', song: 'demo', clips: [] } as Show, { kind: 'placePicks', widget: 'ivory', notes: NOTES });
    expect(placed.picks?.p1.notes).toEqual(NOTES);
    const louder: Note[] = [[1, 2, 60, 80, 0.5], [3, 4, 64, 100, 2], [5, 6, 67, 60]];
    expect(applyEdit(placed, { kind: 'updatePicks', id: 'p1', widget: 'ivory', notes: louder }).picks?.p1.notes).toEqual(louder);
  });
  it('leaves a clip where it was placed when only an intensity changes, and is an edit all the same', () => {
    const placed = applyEdit({ version: 3, id: 'demo', song: 'demo', clips: [] } as Show, { kind: 'placePicks', widget: 'ivory', notes: NOTES });
    const moved = { ...placed, clips: placed.clips.map((c) => ({ ...c, start: 0.5, end: 9 })) };
    const after = applyEdit(moved, { kind: 'updatePicks', id: 'p1', widget: 'ivory', notes: [[1, 2, 60, 80, 0.5], [3, 4, 64, 100, 2], [5, 6, 67, 60]] });
    expect(after.clips).toEqual(moved.clips);
    expect(after).not.toBe(moved);
    expect(applyEdit(placed, { kind: 'updatePicks', id: 'p1', widget: 'ivory', notes: NOTES })).toBe(placed);
  });
});

describe('what a widget hears', () => {
  const heard = (s: Show) => showInstances(s)[0].notes!;
  it('is the note at velocity times intensity, up to 127, with the value on it', () => {
    expect(heard(show(NOTES))).toEqual([[1, 2, 60, 120, 1.5], [3, 4, 64, 127, 2], [5, 6, 67, 60]]);
  });
  it('is the very same set without a value, as today', () => {
    const notes: Note[] = [[1, 2, 60, 80]];
    expect(heard(show(notes))).toBe(notes);
  });
  it('is the same array each time, or the runtime would start the widget again on any edit', () => {
    const s = show(NOTES);
    expect(heard(s)).toBe(heard(s));
  });
  it('reaches the chord', () => {
    const [c, d] = groupChords([[1, 2, 60, 120, 1.5], [3, 4, 64, 90]]);
    expect(c.notes[0]).toEqual({ m: 60, v: 120, d: 1, amount: 1.5 });
    expect(d.notes[0]).toEqual({ m: 64, v: 90, d: 1 });
  });
});

describe('the picker', () => {
  const ids = new Map([[7, 1.5], [8, 2]]);
  it('writes the values it holds into the set', () => {
    expect(toPicks(roll, ids)).toEqual(NOTES);
    expect(toPicks(roll)).toEqual(roll.map((n) => [n.t, n.e, n.m, n.v]));
  });
  it('finds every note of a set with values on the roll: in a mark, the fifth place is a track', () => {
    const { found, lost, amounts } = picksOnRoll(NOTES, roll);
    expect(found.map((n) => n.id)).toEqual([7, 8, 9]);
    expect(lost).toEqual([]);
    expect([...amounts]).toEqual([[7, 1.5], [8, 2]]);
  });
  it('opens on the values, also of a note no longer on the roll', () => {
    const o = popupChips(roll, [...NOTES, [8, 9, 70, 50, 0.25]], roll);
    expect([...o.on].sort()).toEqual([-1, 7, 8, 9].sort());
    expect(o.amounts.get(7)).toBe(1.5);
    expect(o.amounts.get(-1)).toBe(0.25);
    expect(toPicks(o.chips, o.amounts)).toEqual([...NOTES, [8, 9, 70, 50, 0.25]]);
  });
  it('previews with the values', () => {
    expect(draftShow('demo', 10, 'ivory', NOTES).picks?.draft.notes).toEqual(NOTES);
  });
  it('turns a height into a value, caught at 1', () => {
    expect(amountAt(0, 48)).toBe(2);
    expect(amountAt(48, 48)).toBe(0);
    expect(amountAt(24, 48)).toBe(1);
    expect(amountAt(23.5, 48)).toBe(1);
    expect(amountAt(12, 48)).toBe(1.5);
    expect(amountAt(-50, 48)).toBe(2);
    expect(amountAt(99, 48)).toBe(0);
  });
  it('shares a bar\'s room between the notes of one attack', () => {
    const chip = (id: number, x: number): Chip => ({ note: { ...roll[0], id }, x, y: 0, tail: 0 });
    expect(amountBars([chip(1, 10), chip(2, 10), chip(3, 40)])).toEqual([{ id: 1, x: 12, w: 8 }, { id: 2, x: 20, w: 8 }, { id: 3, x: 42, w: 16 }]);
  });
});

describe('ivory', () => {
  interface Key { m: number; w: number; h: number; rise: number; sink: number; show: number; press?: number }
  const tools: { plan: (c: unknown[]) => { keys: Key[]; strike: number } }[] = [];
  new Function('TOOLS', 'ICON', 'CHORDS', readFileSync('lab/tools/ivory.js', 'utf8'))(tools, {}, []);
  const { plan } = tools[0];
  const line = (a: (number | undefined)[]) => groupChords([60, 64, 67].map((m, i): Note => (a[i] === undefined ? [i, i + 0.5, m, 80] : [i, i + 0.5, m, 80, a[i]])));
  const even = plan(line([undefined, undefined, undefined]));

  it('without a value draws as it always did', () => {
    expect(even.strike).toBe(1);
    expect(even.keys.map((k) => [k.rise, k.sink, k.show])).toEqual(even.keys.map(() => [0.2, 0.16, 1]));
    const ones = plan(groupChords([[0, 0.5, 60, 80, 1], [1, 1.5, 64, 80, 1], [2, 2.5, 67, 80, 1]]));
    expect(ones.keys).toEqual(even.keys);
  });
  it('makes a strong key bigger and quicker, a soft one smaller, slower and fainter', () => {
    const p = plan(line([2, 0.25, undefined]));
    expect(p.keys[0].w).toBeGreaterThan(even.keys[0].w);
    expect(p.keys[0].h).toBeGreaterThan(even.keys[0].h);
    expect(p.keys[0].rise).toBeLessThan(0.2);
    expect(p.keys[1].w).toBeLessThan(even.keys[1].w);
    expect(p.keys[1].h).toBeLessThan(even.keys[1].h);
    expect(p.keys[1].rise).toBeGreaterThan(0.2);
    expect(p.keys[1].show).toBeLessThan(1);
  });
  it('never lets a key out of the top of the picture', () => {
    for (const k of plan(line([2, 2, 2])).keys) expect(k.h).toBeLessThanOrEqual(720 * 0.88 * 0.97);
  });
  it('strikes the last note as hard as its value', () => {
    expect(plan(line([undefined, undefined, 1.75])).strike).toBe(1.75);
  });
  it('sends a key back as hard as the note that sends it', () => {
    const p = plan(groupChords([[0, 0.5, 60, 80], [1, 1.5, 64, 80], [2, 2.5, 60, 80, 2]]));
    expect(p.keys.find((k) => k.press !== undefined)!.sink).toBeLessThan(0.16);
  });
});
