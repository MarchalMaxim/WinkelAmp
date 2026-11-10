import { describe, expect, it } from 'vitest';
import { sectionCharacters } from '../src/studio/compose/character';
import type { Note } from '../src/widgets/types';

const ms = (t: number) => Math.round(t * 1000) / 1000;
/** Attacks every 1/rate s from..to of two notes (a chord within 2 ms) at the given pitch and velocity. */
function part(from: number, to: number, rate: number, vel: number, pitch: number): Note[] {
  const notes: Note[] = [];
  for (let i = 0, t = from; t < to - 1e-9; t = from + ++i / rate) {
    for (let k = 0; k < 2; k++) notes.push([ms(t + k * 0.002), ms(t + 0.4), pitch + 4 * k, vel]);
  }
  return notes;
}

describe('sectionCharacters', () => {
  const notes = [part(0, 10, 1, 40, 60), part(10, 20, 1, 110, 60), part(20, 30, 6, 40, 60), part(30, 40, 1, 40, 36)]
    .flat().sort((a, b) => a[0] - b[0]);
  const spans = [{ start: 0, end: 10 }, { start: 10, end: 20 }, { start: 20, end: 30 }, { start: 30, end: 40 }];
  const ch = sectionCharacters(notes, spans);

  it('ranks the louder part louder and the faster part faster', () => {
    expect(ch[1].loud).toBeGreaterThan(ch[0].loud);
    expect(ch[1].loud).toBe(1);
    expect(ch[2].fast).toBe(1);
    expect(ch[2].fast).toBeGreaterThan(ch[0].fast);
  });

  it('measures the bass share', () => {
    expect(ch[3].low).toBeCloseTo(1, 5);
    expect(ch[0].low).toBe(0);
  });

  it('quiet = (1 - loud)(1 - fast); all in 0..1', () => {
    for (const c of ch) {
      expect(c.quiet).toBeCloseTo((1 - c.loud) * (1 - c.fast), 10);
      for (const v of Object.values(c)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    }
  });

  it('one span ranks 0.5; a span without attacks is 0', () => {
    expect(sectionCharacters(notes, [{ start: 0, end: 40 }])[0]).toMatchObject({ loud: 0.5, fast: 0.5, dense: 0.5 });
    const c = sectionCharacters(notes, [{ start: 0, end: 40 }, { start: 40, end: 50 }]);
    expect(c[1]).toEqual({ loud: 0, dense: 0, low: 0, fast: 0, quiet: 1 });
    expect(c[0]).toMatchObject({ loud: 1, fast: 1, dense: 1 });
  });
});
