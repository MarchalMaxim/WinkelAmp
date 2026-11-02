import { describe, expect, it } from 'vitest';
import { History } from '../src/studio/show/history';
import type { Show } from '../src/studio/show/show';

const show = (n: number): Show => ({ version: 3, id: 'demo', song: 'demo', clips: [{ id: 'c1', start: 0, end: 10 + n, track: 0, widget: 'squares' }] });

describe('History', () => {
  it('undo and redo restore the exact shows', () => {
    const h = new History();
    h.record(show(0));                      // show(0) → show(1)
    h.record(show(1));                      // show(1) → show(2)
    expect(h.undo(show(2))).toEqual(show(1));
    expect(h.undo(show(1))).toEqual(show(0));
    expect(h.undo(show(0))).toBeNull();
    expect(h.redo(show(0))).toEqual(show(1));
    expect(h.redo(show(1))).toEqual(show(2));
    expect(h.redo(show(2))).toBeNull();
  });

  it('records in one group in a row undo in one step', () => {
    const h = new History();
    h.record(show(0));
    h.record(show(1), 'knob:0:0:size'); h.record(show(2), 'knob:0:0:size'); h.record(show(3), 'knob:0:0:size');
    expect(h.undo(show(4))).toEqual(show(1));
    expect(h.undo(show(1))).toEqual(show(0));
  });

  it('a group starts again after an undo', () => {
    const h = new History();
    h.record(show(0), 'g'); h.record(show(1), 'g');
    expect(h.undo(show(2))).toEqual(show(0));
    h.record(show(0), 'g');
    expect(h.undo(show(5))).toEqual(show(0));
  });

  it('a new record clears redo', () => {
    const h = new History();
    h.record(show(0));
    h.undo(show(1));
    h.record(show(0));
    expect(h.redo(show(9))).toBeNull();
  });

  it('keeps 200 steps: the 201st record drops the oldest', () => {
    const h = new History();
    for (let i = 0; i < 201; i++) h.record(show(i));
    let cur = show(201), n = 0, last: Show | null = null;
    for (let s = h.undo(cur); s; s = h.undo(cur)) { last = s; cur = s; n++; }
    expect(n).toBe(200);
    expect(last).toEqual(show(1));
  });

  it('clear forgets everything', () => {
    const h = new History();
    h.record(show(0)); h.clear();
    expect(h.undo(show(1))).toBeNull();
  });
});
