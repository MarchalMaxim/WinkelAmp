import { describe, expect, it } from 'vitest';
import { entriesBetween, scheduleAt, sectionAt } from '../src/studio/show/schedule';
import type { Show, ShowSection } from '../src/studio/show/show';

const show = (...sections: ShowSection[]): Show => ({ version: 1, id: 'demo', song: 'demo', sections });
const ABC = (restart = false) => show(
  { start: 0, end: 10, layers: [{ widget: 'squares' }, { widget: 'kandinsky' }] },
  { start: 10, end: 20, fade: 3, layers: [{ widget: 'kandinsky', knobs: { edges: 0.9 }, ...(restart ? { restart } : {}) }, { widget: 'casket' }] },
  { start: 20, end: 30, fade: 0, layers: [{ widget: 'squares' }] },
);
const brief = (t: number, s = ABC()) => scheduleAt(s, t).map((w) => [w.id, w.receiving, w.weight]);

describe('sectionAt', () => {
  it('is the last section starting at or before t, 0 before the show', () => {
    expect([-1, 0, 9.99, 10, 25, 99].map((t) => sectionAt(ABC(), t))).toEqual([0, 0, 0, 1, 2, 2]);
  });
});

describe('scheduleAt', () => {
  it('plays the section stack, receiving, at full weight', () => {
    expect(brief(5)).toEqual([['squares', true, 1], ['kandinsky', true, 1]]);
    expect(scheduleAt(ABC(), 5).map((w) => w.section)).toEqual([0, 0]);
  });

  it('a continuing widget switches to the new section knobs and is not decaying', () => {
    const s = scheduleAt(ABC(), 10.5);
    const k = s.filter((w) => w.id === 'kandinsky');
    expect(k).toHaveLength(1);
    expect(k[0]).toMatchObject({ receiving: true, weight: 1, knobs: { edges: 0.9 }, section: 1 });
  });

  it('a leaving widget decays first, without attacks, as (1 − u)²', () => {
    const s = scheduleAt(ABC(), 11.5);
    expect(s[0]).toMatchObject({ id: 'squares', receiving: false, section: 0, knobs: {} });
    expect(s[0].weight).toBeCloseTo(0.25, 10);
    expect(s.slice(1).map((w) => w.id)).toEqual(['kandinsky', 'casket']);
    expect(brief(13.01).map(([id]) => id)).not.toContain('squares');
  });

  it('fade 0 cuts', () => {
    expect(brief(20.001)).toEqual([['squares', true, 1]]);
  });

  it('several boundaries inside one fade: oldest first, each with the fade of the boundary it left at', () => {
    const s = show(
      { start: 0, end: 10, layers: [{ widget: 'x' }] },
      { start: 10, end: 11, fade: 3, layers: [{ widget: 'y' }] },
      { start: 11, end: 20, fade: 3, layers: [{ widget: 'z' }] },
    );
    const w = scheduleAt(s, 11.5);
    expect(w.map((v) => [v.id, v.receiving])).toEqual([['x', false], ['y', false], ['z', true]]);
    expect(w[0].weight).toBeCloseTo((1 - 1.5 / 3) ** 2, 10);
    expect(w[1].weight).toBeCloseTo((1 - 0.5 / 3) ** 2, 10);
  });

  it('a widget back in the current section plays there, not as a decaying copy', () => {
    const s = show(
      { start: 0, end: 10, layers: [{ widget: 'x' }] },
      { start: 10, end: 11, layers: [{ widget: 'y' }] },
      { start: 11, end: 20, layers: [{ widget: 'x' }] },
    );
    expect(brief(11.5, s).map(([id, r]) => [id, r])).toEqual([['y', false], ['x', true]]);
  });

  it('a widget that left twice decays from its latest leave only', () => {
    const s = show(
      { start: 0, end: 10, layers: [{ widget: 'x' }] },
      { start: 10, end: 11, layers: [{ widget: 'y' }] },
      { start: 11, end: 12, layers: [{ widget: 'x' }] },
      { start: 12, end: 20, layers: [{ widget: 'z' }] },
    );
    const w = scheduleAt(s, 12.5);
    expect(w.map((v) => v.id)).toEqual(['y', 'x', 'z']);
    expect(w[1]).toMatchObject({ section: 2 });
    expect(w[1].weight).toBeCloseTo((1 - 0.5 / 3) ** 2, 10);
  });

  it('a widget that came back and was then cut does not decay from its first leave', () => {
    const s = show(
      { start: 0, end: 10, layers: [{ widget: 'x' }] },
      { start: 10, end: 10.5, fade: 20, layers: [{ widget: 'y' }] },
      { start: 10.5, end: 11, layers: [{ widget: 'x' }] },
      { start: 11, end: 30, fade: 0, layers: [{ widget: 'z' }] },
    );
    expect(brief(12, s).map(([id]) => id)).toEqual(['y', 'z']);
  });

  it('before the show and after its end the first and last sections play', () => {
    expect(brief(-2)).toEqual([['squares', true, 1], ['kandinsky', true, 1]]);
    expect(brief(31)).toEqual([['squares', true, 1]]);
  });
});

describe('entriesBetween', () => {
  it('lists widgets entering at a boundary in (t0, t1]', () => {
    expect(entriesBetween(ABC(), 9.9, 10.1)).toEqual([{ id: 'casket', at: 10 }]);
    expect(entriesBetween(ABC(), 19.9, 20.1)).toEqual([{ id: 'squares', at: 20 }]);
    expect(entriesBetween(ABC(), 9.9, 9.99)).toEqual([]);
    expect(entriesBetween(ABC(), 10, 10.1)).toEqual([]);
    expect(entriesBetween(ABC(), 9.9, 10)).toEqual([{ id: 'casket', at: 10 }]);
  });

  it('lists restarts too, by boundary then layer order', () => {
    expect(entriesBetween(ABC(true), 9.9, 10.1)).toEqual([{ id: 'kandinsky', at: 10 }, { id: 'casket', at: 10 }]);
    expect(entriesBetween(ABC(true), 0, 30)).toEqual([{ id: 'kandinsky', at: 10 }, { id: 'casket', at: 10 }, { id: 'squares', at: 20 }]);
  });
});
