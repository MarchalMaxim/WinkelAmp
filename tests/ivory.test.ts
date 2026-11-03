/// <reference types="node" />
// Ivory's plan: which keys it draws and when it stomps, worked out from the notes in advance.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Chord { t: number; notes: { m: number; v: number; d: number }[]; vel: number; lo: number; hi: number }
interface Plan { keys: { m: number; t: number; hits: number[]; w: number; h: number; foot: number; angle: number }[]; stomp: number | null }

const tools: { id: string; plan: (c: Chord[]) => Plan }[] = [];
new Function('TOOLS', 'ICON', 'CHORDS', readFileSync('lab/tools/ivory.js', 'utf8'))(tools, {}, []);
const { plan } = tools[0];

const chord = (t: number, ...ms: number[]): Chord => ({ t, notes: ms.map((m) => ({ m, v: 80, d: 0.5 })), vel: 80, lo: Math.min(...ms), hi: Math.max(...ms) });

describe('ivory plan', () => {
  it('has nothing to do without notes', () => {
    expect(plan([])).toEqual({ keys: [], stomp: null });
  });
  it('gives each pitch one key, in order of arrival, and stomps on the highest', () => {
    const p = plan([chord(1, 60), chord(2, 64), chord(3, 67)]);
    expect(p.keys.map((k) => k.m)).toEqual([60, 64, 67]);
    expect(p.stomp).toBe(3);
  });
  it('ignores what comes after the highest note', () => {
    const p = plan([chord(1, 60), chord(2, 72), chord(3, 50), chord(4, 65)]);
    expect(p.keys.map((k) => k.m)).toEqual([60, 72]);
    expect(p.stomp).toBe(2);
  });
  it('stomps on the last time the top pitch is played', () => {
    const p = plan([chord(1, 72), chord(2, 60), chord(3, 72), chord(4, 62)]);
    expect(p.stomp).toBe(3);
    expect(p.keys.map((k) => k.m)).toEqual([72, 60]);
  });
  it('keeps one key for a pitch that comes back, and remembers each time', () => {
    const p = plan([chord(1, 60), chord(2, 62), chord(3, 60), chord(4, 70)]);
    expect(p.keys.filter((k) => k.m === 60).map((k) => k.hits)).toEqual([[1, 3]]);
  });
  it('draws a key for each note of a picked chord', () => {
    expect(plan([chord(1, 60, 64, 67)]).keys).toHaveLength(3);
  });
  it('makes a taller key of a higher note, and stands it further right', () => {
    const [a, b] = plan([chord(1, 40), chord(2, 90)]).keys;
    expect(b.h).toBeGreaterThan(a.h);
    expect(b.foot).toBeGreaterThan(a.foot);
  });
  it('thins a whole song down to a few dozen keys', () => {
    const song = Array.from({ length: 4000 }, (_, i) => chord(i * 0.2, 40 + (i * 7) % 48));
    const p = plan(song);
    expect(p.keys.length).toBeGreaterThan(0);
    expect(p.keys.length).toBeLessThanOrEqual(36);
    expect(p.stomp).not.toBeNull();
  });
  it('gives the same picture every time', () => {
    const notes = [chord(1, 60), chord(2, 64)];
    expect(plan(notes).keys.map((k) => k.angle)).toEqual(plan(notes).keys.map((k) => k.angle));
  });
});
