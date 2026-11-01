// The intensity lanes' pure helpers (plan T18, §10): where a dragged or added pivot lands, how a segment drag bends
// the segment, and what the pointer is over.
import { describe, expect, it } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import { addPivot, bendFromDrag, hitTest, listenWord, snapTime } from '../src/studio/ui/lanes';
import type { Pivot } from '../src/widgets/types';

const span = { start: 0, end: 20 };

describe('listenWord', () => {
  it('names a part in words, the note types too', () => {
    expect(['melody', 'repeats', 'long', 'runs', 'chords', 'trills', 'family:strings', 'violin'].map(listenWord))
      .toEqual(['melody', 'repeated notes', 'long ringing notes', 'fast runs', 'big chords', 'trills', 'strings', 'violin']);
  });
});

describe('snapTime', () => {
  it('snaps to the nearest beat within 0.25 s when Snap is on, and not when fine', () => {
    expect(snapTime(10.1, { beats: [10, 10.5], snap: true, fine: false, span })).toBe(10);
    expect(snapTime(10.1, { beats: [10, 10.5], snap: true, fine: true, span })).toBe(10.1);
    expect(snapTime(10.1, { beats: [10, 10.5], snap: false, fine: false, span })).toBe(10.1);
    expect(snapTime(10.4, { beats: [10, 10.5], snap: true, fine: false, span })).toBe(10.5);
  });
  it('leaves a time with no beat within 0.25 s where it is', () => {
    expect(snapTime(11.2, { beats: [10, 10.5, 11.6], snap: true, fine: false, span })).toBe(11.2);
    expect(snapTime(3, { beats: [], snap: true, fine: false, span })).toBe(3);
  });
  it('is clamped to the span and rounded to the millisecond', () => {
    expect(snapTime(-2, { beats: [], snap: false, fine: false, span })).toBe(0);
    expect(snapTime(25, { beats: [], snap: false, fine: false, span })).toBe(20);
    expect(snapTime(19.9, { beats: [20.1], snap: true, fine: false, span })).toBe(20);   // a beat past the end: clamped
    expect(snapTime(4.12345, { beats: [], snap: false, fine: false, span })).toBe(4.123);
  });
});

describe('bendFromDrag', () => {
  it('dragging up bows the segment up, whichever way it runs', () => {
    expect(bendFromDrag(0, 1, -0.2)).toBeGreaterThan(0);
    expect(bendFromDrag(1, 0, -0.2)).toBeLessThan(0);
    expect(bendFromDrag(0, 1, 0.2)).toBeLessThan(0);
    expect(bendFromDrag(1, 0, 0.2)).toBeGreaterThan(0);
  });
  it('is 0 with no drag or on a flat segment, and stays in −1..1', () => {
    expect(bendFromDrag(0.2, 0.8, 0)).toBe(0);
    expect(bendFromDrag(0.5, 0.5, -0.3)).toBe(0);
    for (const dy of [-5, -1, -0.4, 0.4, 1, 5]) for (const [a, b] of [[0, 1], [1, 0], [0.3, 0.4]]) {
      const x = bendFromDrag(a, b, dy);
      expect(x).toBeGreaterThanOrEqual(-1); expect(x).toBeLessThanOrEqual(1);
    }
  });
  it('feels the same on a gentle segment as on a steep one: half the lane is a full bend', () => {
    expect(bendFromDrag(0, 1, -0.25)).toBe(0.5);
    expect(bendFromDrag(0.4, 0.45, -0.25)).toBe(0.5);
    expect(bendFromDrag(0, 1, -0.5)).toBe(1);
  });
  it('bows the way it was dragged on the shared curve, rising or falling', () => {
    const L = loadLayers();
    expect(L.automationAt([{ t: 0, v: 0, bend: bendFromDrag(0, 1, -0.2) }, { t: 2, v: 1 }], 1)).toBeGreaterThan(0.5);
    expect(L.automationAt([{ t: 0, v: 0.9, bend: bendFromDrag(0.9, 0.1, -0.2) }, { t: 2, v: 0.1 }], 1)).toBeGreaterThan(0.5);
    expect(L.automationAt([{ t: 0, v: 0.9, bend: bendFromDrag(0.9, 0.1, 0.2) }, { t: 2, v: 0.1 }], 1)).toBeLessThan(0.5);
  });
});

describe('hitTest', () => {
  // 10 px a second, the lane 100 px tall (v 1 at the top).
  const x = (t: number) => t * 10, y = (v: number) => 100 - v * 100;
  const P: Pivot[] = [{ t: 0, v: 0 }, { t: 10, v: 1 }, { t: 20, v: 1, shape: 'hold' }, { t: 30, v: 0 }];
  it('finds a pivot within 6 px, the nearest one', () => {
    expect(hitTest(P, x, y, 104, 4)).toEqual({ kind: 'pivot', index: 1 });
    expect(hitTest(P, x, y, 100, 6)).toEqual({ kind: 'pivot', index: 1 });
    expect(hitTest(P, x, y, 2, 98)).toEqual({ kind: 'pivot', index: 0 });
  });
  it('finds a segment within 5 px, else empty', () => {
    expect(hitTest(P, x, y, 50, 53)).toEqual({ kind: 'segment', index: 0 });   // the line from (0, 100) to (100, 0)
    expect(hitTest(P, x, y, 50, 62)).toEqual({ kind: 'empty' });
    expect(hitTest(P, x, y, 150, 3)).toEqual({ kind: 'segment', index: 1 });
    expect(hitTest(P, x, y, 150, 30)).toEqual({ kind: 'empty' });
    expect(hitTest(P, x, y, 350, 100)).toEqual({ kind: 'empty' });                // after the last pivot: no segment
    expect(hitTest([], x, y, 50, 50)).toEqual({ kind: 'empty' });
  });
  it('a hold segment is a step: flat to the next pivot, then straight down', () => {
    expect(hitTest(P, x, y, 250, 2)).toEqual({ kind: 'segment', index: 2 });
    expect(hitTest(P, x, y, 298, 50)).toEqual({ kind: 'segment', index: 2 });
    expect(hitTest(P, x, y, 250, 50)).toEqual({ kind: 'empty' });                 // where a straight line would run
  });
  it('follows the curve it is given, bent or eased', () => {
    const L = loadLayers();
    const B: Pivot[] = [{ t: 0, v: 0, bend: 0.8 }, { t: 10, v: 1 }];
    const curve = (t: number) => L.automationAt(B, t);
    const yMid = y(curve(5));                                                      // well above the straight line's 50
    expect(yMid).toBeLessThan(30);
    expect(hitTest(B, x, y, 50, yMid + 2, curve)).toEqual({ kind: 'segment', index: 0 });
    expect(hitTest(B, x, y, 50, 50, curve)).toEqual({ kind: 'empty' });
  });
});

describe('addPivot', () => {
  it('inserts in order; a split hold or ease segment keeps its shape', () => {
    const P: Pivot[] = [{ t: 1, v: 0, shape: 'hold' }, { t: 5, v: 1 }, { t: 9, v: 0 }];
    expect(addPivot(P, 3, 0.5, 256)).toEqual({ pivots: [P[0], { t: 3, v: 0.5, shape: 'hold' }, P[1], P[2]], index: 1 });
    expect(addPivot(P, 7, 0.5, 256)).toEqual({ pivots: [P[0], P[1], { t: 7, v: 0.5 }, P[2]], index: 2 });
    expect(addPivot(P, 12, 1, 256)!.index).toBe(3);
    expect(addPivot([], 2, 1, 256)).toEqual({ pivots: [{ t: 2, v: 1 }], index: 0 });
    expect(P).toHaveLength(3);   // not mutated
  });
  it('refuses a pivot past the cap instead of letting the edit drop the last one', () => {
    const full: Pivot[] = Array.from({ length: 256 }, (_, i) => ({ t: i / 10, v: i % 2 }));
    expect(addPivot(full, 5.05, 0.5, 256)).toBeNull();
    expect(addPivot(full.slice(1), 5.05, 0.5, 256)!.pivots).toHaveLength(256);
  });
});
