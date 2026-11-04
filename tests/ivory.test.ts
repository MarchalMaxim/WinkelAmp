/// <reference types="node" />
// Ivory's plan: which keys it draws and when it stomps, worked out from the notes in advance.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Chord { t: number; notes: { m: number; v: number; d: number }[]; vel: number; lo: number; hi: number }
interface Plan { keys: { m: number; t: number; w: number; h: number; foot: number; angle: number; press?: number }[]; stomp: number | null; last?: number }

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
    const p = plan([chord(1, 60), chord(2, 72), chord(3, 62), chord(4, 72), chord(5, 64)]);
    expect(p.stomp).toBe(4);
    expect(p.keys.map((k) => k.m)).toEqual([60, 72, 62, 72]);
  });
  it('gives a pitch that comes back a key of its own, beside the first and on the picture', () => {
    const p = plan([chord(1, 60), chord(2, 62), chord(3, 60), chord(4, 70)]);
    const twins = p.keys.filter((k) => k.m === 60);
    expect(twins.map((k) => k.t)).toEqual([1, 3]);
    expect(twins[0].foot).not.toBe(twins[1].foot);
    for (const k of p.keys) { expect(k.foot).toBeGreaterThan(0); expect(k.foot).toBeLessThan(1280); }
  });
  it('gives every note before the stomp a key on a line of few pitches, and the rest press them down', () => {
    const line = [67, 68, 65, 65, 67, 68, 70, 68, 67, 68, 70, 72, 73, 67, 68, 70, 68, 67, 70, 72];
    const p = plan(line.map((m, i) => chord(i + 1, m)));
    expect(p.stomp).toBe(13);
    expect(p.keys).toHaveLength(13);
    expect(p.keys.filter((k) => k.press !== undefined)).toHaveLength(7);
  });
  it('makes one key of the same note twice at the same moment', () => {
    expect(plan([chord(1, 60, 60), chord(2, 70)]).keys).toHaveLength(2);
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
  it('follows a falling line down and stomps on the lowest note', () => {
    const p = plan([chord(1, 72), chord(2, 67), chord(3, 64), chord(4, 60)]);
    expect(p.keys.map((k) => k.m)).toEqual([72, 67, 64, 60]);
    expect(p.stomp).toBe(4);
  });
  it('ignores what comes after the lowest note of a falling line', () => {
    const p = plan([chord(1, 72), chord(2, 50), chord(3, 60)]);
    expect(p.keys.map((k) => k.m)).toEqual([72, 50]);
    expect(p.stomp).toBe(2);
  });
  it('stomps on the last time the bottom pitch of a falling line is played', () => {
    expect(plan([chord(1, 72), chord(2, 50), chord(3, 62), chord(4, 50), chord(5, 55)]).stomp).toBe(4);
  });
  it('still calls a rising line with a dip rising', () => {
    expect(plan([chord(1, 60), chord(2, 58), chord(3, 65), chord(4, 72)]).stomp).toBe(4);
  });
  it('gives the same picture every time', () => {
    const notes = [chord(1, 60), chord(2, 64)];
    expect(plan(notes).keys.map((k) => k.angle)).toEqual(plan(notes).keys.map((k) => k.angle));
  });
  it('presses one key down for each note after the top, tallest first', () => {
    const p = plan([chord(1, 60), chord(2, 64), chord(3, 67), chord(4, 72), chord(5, 65), chord(6, 62)]);
    expect(p.stomp).toBe(4);
    expect(p.keys.map((k) => [k.m, k.press])).toEqual([[60, undefined], [64, undefined], [67, 6], [72, 5]]);
    expect(p.last).toBe(6);
  });
  it('on a falling line, presses from the low end', () => {
    const p = plan([chord(1, 72), chord(2, 67), chord(3, 60), chord(4, 70)]);
    expect(p.stomp).toBe(3);
    expect(p.keys.find((k) => k.m === 60)?.press).toBe(4);
    expect(p.keys.find((k) => k.m === 72)?.press).toBeUndefined();
  });
  it('has nothing to press when the line ends on its stomp', () => {
    const p = plan([chord(1, 60), chord(2, 64), chord(3, 67)]);
    expect(p.keys.every((k) => k.press === undefined)).toBe(true);
    expect(p.last).toBe(3);
  });
  it('stops pressing when no key is left', () => {
    const p = plan([chord(1, 60), chord(2, 72), chord(3, 65), chord(4, 62), chord(5, 61), chord(6, 59)]);
    expect(p.keys.map((k) => k.press)).toEqual([4, 3]);
    expect(p.last).toBe(4);
  });
  it('has no way back on a whole song', () => {
    const song = Array.from({ length: 4000 }, (_, i) => chord(i * 0.2, 40 + (i * 7) % 48));
    expect(plan(song).keys.every((k) => k.press === undefined)).toBe(true);
  });
});
