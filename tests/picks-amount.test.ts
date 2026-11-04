/// <reference types="node" />
// A picked note's intensity: kept through every step that rebuilds a set, heard as loudness, and read by Ivory.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Conductor, showInstances } from '../src/studio/show/conductor';
import { applyEdit } from '../src/studio/show/edit';
import { heardPicks, heldValues, noteKnobs, notPerNote, perNote, valuesOf, withValues, type NoteValues, type PickNote } from '../src/studio/show/note-values';
import { scheduleAt } from '../src/studio/show/schedule';
import { canonicalShow, repairPickNotes, repairShow, validateShow, type Show } from '../src/studio/show/show';
import { addedChips, amountBars, attackMates, barWords, draftShow, INTENSITY_LANE, knobLane, laneShare, laneValue, picksOnRoll, popupChips, renumberLost, toPicks, type Chip, type RollNote } from '../src/studio/ui/picker-logic';
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
    expect(withValues([1, 2, 60, 80], { intensity: 1 })).toEqual([1, 2, 60, 80]);
    expect(withValues([1, 2, 60, 80], {})).toEqual([1, 2, 60, 80]);
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
  const ids = new Map([[7, { intensity: 1.5 }], [8, { intensity: 2 }]]);
  it('writes the values it holds into the set', () => {
    expect(toPicks(roll, ids)).toEqual(NOTES);
    expect(toPicks(roll)).toEqual(roll.map((n) => [n.t, n.e, n.m, n.v]));
  });
  it('finds every note of a set with values on the roll: in a mark, the fifth place is a track', () => {
    const { found, lost, values } = picksOnRoll(NOTES, roll);
    expect(found.map((n) => n.id)).toEqual([7, 8, 9]);
    expect(lost).toEqual([]);
    expect([...values]).toEqual([[7, { intensity: 1.5 }], [8, { intensity: 2 }]]);
  });
  it('opens on the values, also of a note no longer on the roll', () => {
    const o = popupChips(roll, [...NOTES, [8, 9, 70, 50, 0.25]], roll);
    expect([...o.on].sort()).toEqual([-1, 7, 8, 9].sort());
    expect(o.values.get(7)).toEqual({ intensity: 1.5 });
    expect(o.values.get(-1)).toEqual({ intensity: 0.25 });
    expect(toPicks(o.chips, o.values)).toEqual([...NOTES, [8, 9, 70, 50, 0.25]]);
  });
  it('previews with the values', () => {
    expect(draftShow('demo', 10, 'ivory', NOTES).picks?.draft.notes).toEqual(NOTES);
  });
  it('turns a height into a value, caught at 1', () => {
    expect(laneValue(0, 48, INTENSITY_LANE)).toBe(2);
    expect(laneValue(48, 48, INTENSITY_LANE)).toBe(0);
    expect(laneValue(24, 48, INTENSITY_LANE)).toBe(1);
    expect(laneValue(23.5, 48, INTENSITY_LANE)).toBe(1);
    expect(laneValue(12, 48, INTENSITY_LANE)).toBe(1.5);
    expect(laneValue(-50, 48, INTENSITY_LANE)).toBe(2);
    expect(laneValue(99, 48, INTENSITY_LANE)).toBe(0);
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

// A knob on a note: a sequencer's parameter lock, in one place, that no widget knows of.
const LOCKS: PickNote[] = [[1, 2, 60, 80, { crater: 0.8 }], [3, 4, 64, 100], [5, 6, 67, 60, { crater: 0.1, intensity: 1.5 }]];
const onSet = (knobs?: Show['clips'][number]['knobs'], start = 0): Show => ({
  version: 3, id: 'demo', song: 'demo', clips: [{ id: 'a', start, end: 10, track: 0, widget: 'ivory', listen: 'picks:p1', ...(knobs ? { knobs } : {}) }],
  picks: { p1: { notes: LOCKS } },
} as Show);
const knobsAt = (s: Show, t: number) => scheduleAt(s, t)[0].knobs;

describe('a knob on a note, stored', () => {
  it('is an object in the fifth place, one form for equal values', () => {
    expect(withValues([1, 2, 60, 80], { z: 0.123456, a: 1, intensity: 1 })).toEqual([1, 2, 60, 80, { a: 1, z: 0.1235 }]);
    expect(withValues([1, 2, 60, 80], { intensity: 1.5 })).toEqual([1, 2, 60, 80, 1.5]);
    expect(valuesOf([1, 2, 60, 80, 1.5])).toEqual({ intensity: 1.5 });
    expect(valuesOf([1, 2, 60, 80])).toEqual({});
  });
  it('is valid in a show and survives a repair and a save', () => {
    expect(validateShow(show(LOCKS), C).errors).toEqual([]);
    expect(repairPickNotes(LOCKS)).toEqual(LOCKS);
    expect(JSON.parse(canonicalShow(show(LOCKS))).picks.p1.notes).toEqual(LOCKS);
  });
  it('writes equal values as equal text', () => {
    const one = canonicalShow(show([[1, 2, 60, 80, { b: 1, a: 2 }]])), two = canonicalShow(show([[1, 2, 60, 80, { a: 2, b: 1 }]]));
    expect(one).toBe(two);
  });
  it('costs only itself when bad: not the note, not the other values', () => {
    expect(validateShow(show([[1, 2, 60, 80, { crater: 'deep' }]]), C).errors.length).toBe(1);
    expect(validateShow(show([[1, 2, 60, 80, { intensity: 3 }]]), C).errors.length).toBe(1);
    expect(repairPickNotes([[1, 2, 60, 80, { crater: 'deep', ripple: 2 }]])).toEqual([[1, 2, 60, 80, { ripple: 2 }]]);
    expect(repairPickNotes([[1, 2, 60, 80, 'x']])).toEqual([[1, 2, 60, 80]]);
  });
  it('survives placing a set and updating one, which keeps the clip as it was', () => {
    const placed = applyEdit({ version: 3, id: 'demo', song: 'demo', clips: [] } as Show, { kind: 'placePicks', widget: 'ivory', notes: LOCKS });
    expect(placed.picks?.p1.notes).toEqual(LOCKS);
    const moved = { ...placed, clips: placed.clips.map((c) => ({ ...c, start: 2.5, end: 3 })) }, other: PickNote[] = [LOCKS[0], LOCKS[1], [5, 6, 67, 60, { ripple: 1 }]];
    const after = applyEdit(moved, { kind: 'updatePicks', id: 'p1', widget: 'ivory', notes: other });
    expect(after.picks?.p1.notes).toEqual(other);
    expect(after.clips).toEqual(moved.clips);
  });
});

describe('a knob on a note, heard', () => {
  it('holds from its attack until the next, and then the clip has its own value back', () => {
    const s = onSet({ crater: 0.5 });
    expect(knobsAt(s, 0.99)).toEqual({ crater: 0.5 });
    expect(knobsAt(s, 1)).toEqual({ crater: 0.8 });
    expect(knobsAt(s, 2.9)).toEqual({ crater: 0.8 });
    expect(knobsAt(s, 3)).toEqual({ crater: 0.5 });
    expect(knobsAt(s, 5)).toEqual({ crater: 0.1 });
    expect(knobsAt(s, 9)).toEqual({ crater: 0.1 });
  });
  it('keeps a knob\'s drive', () => {
    expect(knobsAt(onSet({ crater: { base: 0.5, drive: '+level', depth: 0.3 } }), 1)).toEqual({ crater: { base: 0.8, drive: '+level', depth: 0.3 } });
  });
  it('is the clip\'s own knobs, the very object, when no note holds one', () => {
    const knobs = { crater: 0.5 }, s = { ...onSet(knobs), picks: { p1: { notes: [[1, 2, 60, 80, 1.5]] as PickNote[] } } };
    expect(knobsAt(s, 1.5)).toBe(knobs);
  });
  it('ignores an attack before the clip began', () => {
    expect(knobsAt(onSet({ crater: 0.5 }, 2), 2.5)).toEqual({ crater: 0.5 });
  });
  it('counts by the runtime\'s attacks: a note 30 ms into a chord sets it at the chord\'s first note, the later note winning', () => {
    const notes: PickNote[] = [[1, 2, 60, 80, { a: 1 }], [1.03, 2, 64, 80, { a: 2, b: 3 }], [3, 4, 67, 80]];
    expect(heldValues(notes, 0, 1)).toEqual({ a: 2, b: 3 });
    expect(heldValues(notes, 0, 3)).toEqual({});
    expect(heldValues(notes, 0, 0.5)).toBeNull();
  });
  it('ignores a knob a note can\'t set', () => {
    const s = { ...onSet({ cracks: 2 }), picks: { p1: { notes: [[1, 2, 60, 80, { cracks: 8, presence: 0, crater: 0.2 }]] as PickNote[] } } };
    expect(knobsAt(s, 1.5)).toEqual({ cracks: 2, crater: 0.2 });
  });
  it('never reaches the widget as a note: numbers only, and no new notes when only a knob changed', () => {
    expect(heardPicks(LOCKS)).toEqual([[1, 2, 60, 80], [3, 4, 64, 100], [5, 6, 67, 90, 1.5]]);
    expect(heardPicks(LOCKS)).toBe(heardPicks(LOCKS));
    const a = showInstances(onSet())[0], b = showInstances({ ...onSet(), picks: { p1: { notes: LOCKS.map((n, i) => (i === 0 ? [1, 2, 60, 80, { crater: 0.3 }] : n)) as PickNote[] } } })[0];
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('which knobs a note can set', () => {
  const widgets = new Map(readdirSync('lab/tools').filter((f) => f.endsWith('.js')).map((f) => [f.slice(0, -3), readFileSync(`lab/tools/${f}`, 'utf8')]));
  const keysOf = (src: string) => [...src.matchAll(/key:\s*'(\w+)'/g)].map((m) => m[1]);
  it('names only knobs that exist on the list of exceptions', () => {
    for (const entry of notPerNote()) {
      const [widget, key] = entry.split('.');
      expect(keysOf(widgets.get(widget) ?? ''), entry).toContain(key);
    }
  });
  it('has no widget knob called intensity, which a note\'s value would take for itself', () => {
    for (const [id, src] of widgets) expect(keysOf(src), id).not.toContain('intensity');
  });
  it('leaves most of them, never how present, and a new widget\'s all', () => {
    expect(perNote('ivory', 'presence')).toBe(false);
    expect(perNote('ivory', 'cracks')).toBe(false);
    expect(perNote('ivory', 'crater')).toBe(true);
    expect(perNote('brand-new', 'anything')).toBe(true);
    expect(noteKnobs('ivory', [{ key: 'crater' }, { key: 'presence' }, { key: 'floor' }]).map((q) => q.key)).toEqual(['crater']);
  });
});

describe('the lane on a knob', () => {
  const q = { key: 'size', label: 'how big', hint: '', min: 10, max: 30, step: 5, value: 20 };
  it('spans the knob, on its step, catching at the clip\'s own value', () => {
    const s = knobLane(q, 15);
    expect(s.base).toBe(15);
    expect(knobLane(q, { base: 25, drive: '+level' }).base).toBe(25);
    expect(knobLane(q).base).toBe(20);
    expect(laneValue(0, 40, s)).toBe(30);
    expect(laneValue(40, 40, s)).toBe(10);
    expect(laneValue(21, 40, s)).toBe(20);
    expect(laneValue(30, 40, { ...s, base: 20 })).toBe(15);
    expect(laneValue(30, 40, s)).toBe(15);
    expect(laneShare(15, s)).toBe(0.25);
  });
  it('lets the next step up be had on a knob of whole steps, though its value is caught', () => {
    const s = knobLane({ key: 'pieces', min: 6, max: 40, step: 1, value: 18 });
    expect(laneValue(40 * (1 - (18.2 - 6) / 34), 40, s)).toBe(18);
    expect(laneValue(40 * (1 - (18.8 - 6) / 34), 40, s)).toBe(19);
  });
  it('says what a bar does', () => {
    const s = knobLane(q, 15), n = { m: 60, t: 1, v: 80 };
    expect(barWords(n, 25, s)).toContain('how big 25 until the next picked note');
    expect(barWords(n, 15, s)).toContain('own');
  });
  it('groups the notes of one attack as the runtime does', () => {
    const m = attackMates([{ id: 1, t: 1 }, { id: 2, t: 1.03 }, { id: 3, t: 1.05 }, { id: 4, t: 2 }]);
    expect(m.get(2)).toEqual([1, 2]);
    expect(m.get(3)).toEqual([3]);
    expect(m.get(4)).toEqual([4]);
  });
});

describe('the Conductor\'s knobs and a widget\'s reset', () => {
  const META = (id: string) => ({ id, name: id, blurb: '', tag: '', verdict: null, params: [
    { key: 'stay', min: 1, max: 20, value: 8, less: 2 }, { key: 'presence', min: 0, max: 1, value: 1, leads: true },
  ] });
  const stub = () => {
    const now: Record<string, number> = {}, seen: number[] = [];
    return { seen, rt: {
      load() {}, setMoment() {}, setKnobs(k: string, m: { stay: { base: number } }) { now[k] = m.stay.base; },
      reset() { seen.push(...Object.values(now)); }, resetWidget(k: string) { seen.push(now[k]); }, step() {},
    } as unknown as ConstructorParameters<typeof Conductor>[0] };
  };
  const clip = { id: 'a', start: 5, end: 30, track: 0, fade: 0, widget: 'pointillism', listen: 'picks:p1' };

  it('gives a reset what a note holds at that time', () => {
    const { rt, seen } = stub(), s = { version: 3, id: 'd', song: 'd', clips: [clip], picks: { p1: { notes: [[4, 4.5, 60, 80], [6, 7, 62, 80, { stay: 15 }], [20, 21, 64, 80]] } } } as Show;
    new Conductor(rt, s, META).reset(10);
    expect(seen.at(-1)).toBe(15);
  });
  it('leaves a curve that moves how present until after the reset, so a show without values draws as it did', () => {
    const { rt, seen } = stub(), s = { version: 3, id: 'd', song: 'd', clips: [{ ...clip, intensityMoves: 'present', intensity: [{ t: 5, v: 0 }, { t: 30, v: 1 }] }], picks: { p1: { notes: [[6, 7, 62, 80]] } } } as unknown as Show;
    const c = new Conductor(rt, s, META);
    c.reset(4);
    c.step(5.01, 1.01);
    expect(seen.at(-1)).toBe(8);
  });
});

describe('adding notes to a set', () => {
  it('comes back with the notes picked now on, the values kept, and a pick with no note here', () => {
    const set: PickNote[] = [[1, 2, 60, 80, { crater: 0.3 }], [3, 4, 64, 100, 1.5], [8, 9, 70, 50, 0.25]];
    const { chips, on, values } = addedChips([roll[0], roll[1], roll[2]], set, roll);
    expect(chips.map((n) => n.t)).toEqual([1, 3, 5, 8]);
    expect(on.size).toBe(4);
    expect(toPicks(chips, values)).toEqual([[1, 2, 60, 80, { crater: 0.3 }], [3, 4, 64, 100, 1.5], [5, 6, 67, 60], [8, 9, 70, 50, 0.25]]);
  });
  it('leaves off a note taken off on the roll', () => {
    const { chips } = addedChips([roll[1]], [[1, 2, 60, 80], [3, 4, 64, 100]], roll);
    expect(chips.map((n) => n.t)).toEqual([3]);
  });
  it('keeps another widget\'s value on its own lost pick when an earlier one was taken off', () => {
    const set: PickNote[] = [[50, 51, 60, 80], [52, 53, 62, 80], [54, 55, 64, 80]];
    const { chips } = addedChips([], set, []);
    const held = new Map<number, Readonly<NoteValues>>([[-2, { crater: 0.7 }], [-1, { crater: 0.2 }]]);
    const left = chips.filter((c) => c.id !== -1);
    renumberLost(left, [held]);
    const back = addedChips([], toPicks(left), []).chips;
    expect(back.find((c) => held.get(c.id))?.t).toBe(52);
    expect(held.get(back.find((c) => c.t === 52)!.id)).toEqual({ crater: 0.7 });
    expect(held.size).toBe(1);
  });
  const placed = () => applyEdit({ version: 3, id: 'demo', song: 'demo', clips: [] } as Show, { kind: 'placePicks', widget: 'ivory', notes: [[10, 11, 60, 80], [12, 13, 64, 80]] });
  const short = (s: Show): Show => ({ ...s, clips: s.clips.map((c) => ({ ...c, start: 9, end: 30 })) });
  it('keeps a clip\'s hand-made length when notes are added inside it', () => {
    const s = short(placed());
    expect(applyEdit(s, { kind: 'updatePicks', id: 'p1', widget: 'ivory', notes: [[10, 11, 60, 80], [11, 12, 62, 80], [12, 13, 64, 80]] }).clips).toEqual(s.clips);
  });
  it('grows a clip to reach a note added outside it', () => {
    const c = applyEdit(short(placed()), { kind: 'updatePicks', id: 'p1', widget: 'ivory', notes: [[10, 11, 60, 80], [12, 13, 64, 80], [40, 41, 67, 80]] }).clips[0];
    expect(c.start).toBe(9);
    expect(c.end).toBeGreaterThanOrEqual(41);
  });
  it('grows a clip for a note so near its end that a live step could carry it past', () => {
    const c = applyEdit(short(placed()), { kind: 'updatePicks', id: 'p1', widget: 'ivory', notes: [[10, 11, 60, 80], [12, 13, 64, 80], [29.97, 30.5, 67, 80]] }).clips[0];
    expect(c.end).toBeGreaterThan(30);
  });
  it('counts a pick that came back as the note it found on the roll as kept', () => {
    const s = short(placed()), snapped: PickNote[] = [[10.03, 11.03, 60, 82], [12, 13, 64, 80], [20, 21, 67, 80]];
    expect(applyEdit(s, { kind: 'updatePicks', id: 'p1', widget: 'ivory', notes: snapped }).clips).toEqual(s.clips);
  });
  it('still fits a clip around what is left when a note is taken off', () => {
    const before = short(placed());
    const c = applyEdit(before, { kind: 'updatePicks', id: 'p1', widget: 'ivory', notes: [[12, 13, 64, 80]] }).clips[0];
    expect(c.end).toBeLessThan(30);
  });
});
