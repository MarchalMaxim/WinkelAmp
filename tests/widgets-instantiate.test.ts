import { describe, expect, it } from 'vitest';
import { toMeta } from '../src/widgets/catalogue';
import { fnv1a } from '../src/widgets/driver';
import { instantiate } from '../src/widgets/instantiate';
import type { Chord, IconLib } from '../src/widgets/types';

const icon = { ink: '#fff', gauge() {} } as IconLib;
const chords: Chord[] = [{ t: 1, notes: [{ m: 60, v: 80, d: 1 }], vel: 80, lo: 60, hi: 60 }];

describe('instantiate (a lab/tools file, unchanged)', () => {
  it('runs the file with TOOLS, ICON and CHORDS and returns its tool', () => {
    const t = instantiate('demo', "(() => { TOOLS.push({ id: 'demo', name: 'Demo', n: CHORDS.length, ink: ICON.ink }); })();", { icon, chords });
    expect(t).toMatchObject({ id: 'demo', name: 'Demo', n: 1, ink: '#fff' });
  });
  it('fails naming the file when it pushes another id, none or two', () => {
    expect(() => instantiate('demo', "TOOLS.push({ id: 'other', name: 'x' });", { icon, chords })).toThrow(/lab\/tools\/demo\.js.*'demo'/);
    expect(() => instantiate('demo', '', { icon, chords })).toThrow(/pushed: none/);
    expect(() => instantiate('demo', "TOOLS.push({ id: 'demo' }, { id: 'demo' });", { icon, chords })).toThrow(/exactly one/);
  });
  it('a throwing file throws', () => {
    expect(() => instantiate('demo', 'throw new Error("boom")', { icon, chords })).toThrow(/boom/);
  });
});

describe('toMeta', () => {
  it('keeps the words and knobs, drops icons and code', () => {
    const m = toMeta({ id: 'a', name: 'A', params: [{ key: 'k', min: 0, max: 1, value: 0.5, icon: () => {} }], frame() {} }, null);
    expect(m).toEqual({ id: 'a', name: 'A', blurb: '', tag: '', verdict: null, params: [{ key: 'k', min: 0, max: 1, value: 0.5 }] });
  });
});

describe('fnv1a', () => {
  it('is the 32-bit FNV-1a', () => {
    expect(fnv1a(new Uint8Array([]))).toBe('811c9dc5');
    expect(fnv1a(new TextEncoder().encode('a'))).toBe('e40c292c');
  });
});
