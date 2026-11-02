import { describe, expect, it } from 'vitest';
import { markLabelAt, songMarks, structureTimes } from '../src/studio/show/marks';
import type { Clip } from '../src/studio/show/show';
import { handleWidth, jumpTime, newClipSpan, rowCount, snapMove, snapPoint, snapTargets, trackAtHeight } from '../src/studio/ui/timeline-logic';

const clip = (id: string, start: number, end: number, track = 0): Clip => ({ id, start, end, track, widget: 'squares' });

describe('snapping', () => {
  const T = snapTargets([clip('me', 10, 20), clip('other', 30, 40)], 'me', [25], [1, 2, 3, 26, 27, 30.4]);

  it('takes the other clips\' edges and the marks, not its own', () => {
    expect(T.strong).toEqual([25, 30, 40]);
  });
  it('a point lands on the nearest edge or mark within r; an edge beats a nearer beat', () => {
    expect(snapPoint(29.9, T, 0.5)).toEqual({ t: 30, kind: 'edge' });
    expect(snapPoint(30.3, T, 0.5)).toEqual({ t: 30, kind: 'edge' });
    expect(snapPoint(25.3, T, 0.5)).toEqual({ t: 25, kind: 'edge' });
  });
  it('else on the nearest beat, else where it is', () => {
    expect(snapPoint(2.2, T, 0.5)).toEqual({ t: 2, kind: 'beat' });
    expect(snapPoint(8, T, 0.5)).toEqual({ t: 8, kind: null });
  });
  it('a move lands by whichever edge of the clip is nearest', () => {
    expect(snapMove(24.8, 10, T, 0.5)).toEqual({ start: 25, at: 25, kind: 'edge' });          // its start on the mark
    expect(snapMove(19.8, 10, T, 0.5)).toEqual({ start: 20, at: 30, kind: 'edge' });          // its end on the other clip
    expect(snapMove(50, 10, T, 0.5)).toEqual({ start: 50, at: null, kind: null });
    expect(snapMove(0.9, 100, T, 0.2)).toEqual({ start: 1, at: 1, kind: 'beat' });
  });
  it('an edge beats a beat for the other end of the clip too', () => {
    expect(snapMove(1.9, 28.3, snapTargets([clip('o', 30, 31)], 'x', [], [2]), 0.5)).toMatchObject({ kind: 'edge', at: 30 });
  });
});

describe('a clip\'s edge grab', () => {
  it('is its usual width on a wide clip', () => { expect(handleWidth(400)).toBe(10); });
  it('leaves the middle of a short clip to click and drag', () => {
    expect(handleWidth(20)).toBeCloseTo(4.8, 6);
    expect(20 - 2 * handleWidth(20)).toBeGreaterThan(10);
  });
  it('is gone on a clip too small to have both', () => {
    expect(handleWidth(7)).toBe(0);
    expect(handleWidth(8)).toBe(3);
    expect(8 - 2 * handleWidth(8)).toBeGreaterThan(0);
  });
});

describe('a new clip', () => {
  const marks = [30, 34, 100];
  it('runs to the next mark at least 4 s on', () => {
    expect(newClipSpan(28, 200, marks)).toEqual({ start: 28, end: 34 });
    expect(newClipSpan(10, 200, marks)).toEqual({ start: 10, end: 30 });
  });
  it('without a mark within a minute, 15 s', () => {
    expect(newClipSpan(35, 200, marks)).toEqual({ start: 35, end: 50 });
    expect(newClipSpan(0, 200, [])).toEqual({ start: 0, end: 15 });
  });
  it('stays in the song and is never a sliver at its end', () => {
    expect(newClipSpan(190, 200, [])).toEqual({ start: 190, end: 200 });
    expect(newClipSpan(199.5, 200, [])).toEqual({ start: 196, end: 200 });
    expect(newClipSpan(500, 200, [])).toEqual({ start: 196, end: 200 });
    expect(newClipSpan(0, 2, [])).toEqual({ start: 0, end: 2 });
  });
});

describe('the rows', () => {
  it('the tracks in use and one free above them', () => {
    expect(rowCount([])).toBe(1);
    expect(rowCount([clip('a', 0, 1, 0)])).toBe(2);
    expect(rowCount([clip('a', 0, 1, 3)])).toBe(5);
  });
  it('the track at a height, inside the rows', () => {
    expect(trackAtHeight(0, 26, 4)).toBe(0);
    expect(trackAtHeight(30, 26, 4)).toBe(1);
    expect(trackAtHeight(999, 26, 4)).toBe(3);
    expect(trackAtHeight(-50, 26, 4)).toBe(0);
  });
});

describe('Shift+arrows', () => {
  const times = [40, 10, 20];
  it('forward: the next one, or stays at the last', () => {
    expect(jumpTime(times, 5, 1)).toBe(10);
    expect(jumpTime(times, 10, 1)).toBe(20);
    expect(jumpTime(times, 50, 1)).toBe(50);
  });
  it('back: where the stretch began, or the one before when just past it', () => {
    expect(jumpTime(times, 15, -1)).toBe(10);
    expect(jumpTime(times, 10.5, -1)).toBe(0);
    expect(jumpTime(times, 0, -1)).toBe(0);
  });
});

describe('the song\'s marks', () => {
  const sections = [{ start: 0 }, { start: 30 }, { start: 60 }];
  it('the analysis boundaries after 0 are what moments follow', () => {
    expect(structureTimes(sections)).toEqual([30, 60]);
  });
  it('a named moment takes the place of a boundary near it; others keep the stretch\'s word', () => {
    expect(songMarks(sections, ['calm', 'loud', 'fast'], [[31, 'First theme'], [90, 'Coda']])).toEqual([
      { t: 31, label: 'First theme' }, { t: 60, label: 'fast' }, { t: 90, label: 'Coda' }]);
    expect(songMarks(sections, [], [])).toEqual([{ t: 30 }, { t: 60 }]);
  });
  it('the name at a time is the last one before it', () => {
    const m = [{ t: 10, label: 'A' }, { t: 20 }, { t: 30, label: 'B' }];
    expect(markLabelAt(m, 5)).toBe('');
    expect(markLabelAt(m, 25)).toBe('A');
    expect(markLabelAt(m, 30)).toBe('B');
  });
});
