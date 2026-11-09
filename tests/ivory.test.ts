/// <reference types="node" />
// Ivory's plan: which keys it draws and when it stomps, worked out from the notes in advance.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Chord { t: number; notes: { m: number; v: number; d: number }[]; vel: number; lo: number; hi: number }
interface Plan { keys: { m: number; t: number; w: number; h: number; foot: number; angle: number; press?: number }[]; stomp: number | null; last?: number }

const tools: { id: string; plan: (c: Chord[], piece?: { lo: number; hi: number }) => Plan; params: { key: string; value: number; min: number; max: number }[] }[] = [];
new Function('TOOLS', 'ICON', 'CHORDS', readFileSync('lab/tools/ivory.js', 'utf8'))(tools, {}, []);
const { plan, params } = tools[0];

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

// The strike knob (snap night, C5) is opt-in: at 0 Ivory draws what it always drew, and the plan never sees the knob.
describe('ivory strike knob', () => {
  it('holds six knobs plus presence, strike and huddle last before presence and off by default', () => {
    expect(params.map((p) => p.key)).toEqual(['floor', 'crater', 'ripple', 'cracks', 'strike', 'huddle', 'presence']);
    expect(params.find((p) => p.key === 'huddle')!.value).toBe(0);
    const strike = params.find((p) => p.key === 'strike')!;
    expect([strike.min, strike.max, strike.value]).toEqual([0, 1, 0]);
  });
  it('leaves the plan as it was: the numbers below were taken before the knob existed', () => {
    const picked = (t: number, m: number, amount?: number): Chord => ({ t, notes: [{ m, v: 80, d: 0.5, ...(amount ? { amount } : {}) }], vel: 80, lo: m, hi: m });
    const p = plan([picked(1, 60), picked(2, 64, 1.6), picked(3, 67), picked(4, 72), picked(5, 65)]) as Plan & { keys: { rise: number }[] };
    const near = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 9));
    near(p.keys.map((k) => k.w), [75.10989891003817, 93.01284995781519, 89.22077495042235, 86.11027939707041]);
    near(p.keys.map((k) => k.h), [113.05545624772488, 310.7440089724027, 374.6640858484405, 545.6874842695064]);
    near(p.keys.map((k) => k.foot), [385.5344736019615, 551.9137802302527, 693.0215146517537, 901.1554597737268]);
    near(p.keys.map((k) => k.angle), [0.06705982016213238, 0.07285036224685609, 0.026403783362358806, -0.06676482072845101]);
    near((p.keys as unknown as { rise: number }[]).map((k) => k.rise), [0.2, 0.2 / (0.4 + 0.6 * 1.6), 0.2, 0.2]);
    expect(p.keys.map((k) => k.press)).toEqual([undefined, undefined, undefined, 5]);
    expect([p.stomp, p.last]).toEqual([4, 5]);
  });
});

// The huddle knob: the plan also holds the tidy row the keys move towards; the original numbers stay in `base`.
describe('ivory huddle knob', () => {
  type K = { m: number; t: number; foot: number; base: { w: number; h: number; foot: number; angle: number }; tidy: { w: number; h: number; foot: number } };
  const keys = (plan([chord(1, 60), chord(2, 64), chord(3, 62), chord(4, 67), chord(5, 72)]) as unknown as { keys: K[] }).keys;
  it('keeps the plain numbers as they were and lines the tidy ones up left to right by pitch', () => {
    for (const k of keys) expect(k.base.foot).toBe(k.foot);
    const row = [...keys].sort((a, b) => a.m - b.m).map((k) => k.tidy);
    for (let i = 1; i < row.length; i++) { expect(row[i].foot).toBeGreaterThan(row[i - 1].foot); expect(row[i].h).toBeGreaterThan(row[i - 1].h); }
  });
  it('spaces the row evenly, close together, centred on the phrase', () => {
    const row = [...keys].sort((a, b) => a.m - b.m).map((k) => k.tidy), gap = row[1].foot - row[0].foot;
    for (let i = 1; i < row.length; i++) expect(row[i].foot - row[i - 1].foot).toBeCloseTo(gap, 9);
    expect(gap).toBeCloseTo(row[0].w * 1.1, 9);
    expect((row[0].foot + row[row.length - 1].foot) / 2).toBeCloseTo(keys.reduce((a, k) => a + k.foot, 0) / keys.length, 6);
  });
  it('makes the staircase gentler than the plain one', () => {
    const sorted = [...keys].sort((a, b) => a.m - b.m);
    expect(sorted[4].tidy.h - sorted[0].tidy.h).toBeLessThan(sorted[4].base.h - sorted[0].base.h);
  });
});

describe('ivory in the piece: a line of less than an octave stands by its register', () => {
  const piece = { lo: 36, hi: 96 };
  it('one note alone is tall and to the right when it is high, short and to the left when it is low', () => {
    const high = plan([chord(1, 90)], piece).keys[0], low = plan([chord(1, 40)], piece).keys[0];
    expect(high.h).toBeGreaterThan(low.h * 2.5);
    expect(high.foot).toBeGreaterThan(1280 * 0.75);
    expect(low.foot).toBeLessThan(1280 * 0.25);
  });
  it('without a piece one note is what it always was: the lowest of its own set', () => {
    const k = plan([chord(1, 90)]).keys[0];
    expect(k.h).toBeLessThan(720 * 0.88 * 0.9 * 0.21);
    expect(k.foot).toBeLessThan(1280 / 2);
  });
  it('a line of an octave or more is unchanged by the piece', () => {
    const line = [chord(1, 60), chord(2, 64), chord(3, 67), chord(4, 72)];
    const a = plan(line), b = plan(line, piece);
    expect(b.keys.map((k) => [k.h, k.foot, k.w])).toEqual(a.keys.map((k) => [k.h, k.foot, k.w]));
  });
  it('a narrow line keeps its steps, smaller, and moves with its register', () => {
    const up = (base: number) => plan([chord(1, base), chord(2, base + 2), chord(3, base + 4)], piece).keys;
    const own = plan([chord(1, 84), chord(2, 86), chord(3, 88)]).keys, high = up(84), low = up(40);
    for (const ks of [high, low]) for (let i = 1; i < 3; i++) { expect(ks[i].h).toBeGreaterThan(ks[i - 1].h); expect(ks[i].foot).toBeGreaterThan(ks[i - 1].foot); }
    expect(high[2].h - high[0].h).toBeLessThan((own[2].h - own[0].h) * 0.6);   // a third is not a whole staircase
    expect(high[0].h).toBeGreaterThan(low[2].h);                               // the high line stands above the low one
    expect(high[0].foot).toBeGreaterThan(low[0].foot);                         // and to its right
    for (const k of [...high, ...low]) { expect(k.foot).toBeGreaterThan(0); expect(k.foot).toBeLessThan(1280); }
  });
  it('the same note twice in a piece: side by side, where its register lies', () => {
    const ks = plan([chord(1, 90), chord(2, 90)], piece).keys;
    expect(ks).toHaveLength(2);
    expect(ks[0].foot).not.toBe(ks[1].foot);
    expect((ks[0].foot + ks[1].foot) / 2).toBeGreaterThan(1280 / 2);
  });
  it('the tidy row follows: a high narrow line is tall there too', () => {
    type T = { tidy: { h: number } };
    const high = plan([chord(1, 84), chord(2, 86)], piece).keys as unknown as T[], low = plan([chord(1, 40), chord(2, 42)], piece).keys as unknown as T[];
    expect(high[0].tidy.h).toBeGreaterThan(low[1].tidy.h);
  });
});
