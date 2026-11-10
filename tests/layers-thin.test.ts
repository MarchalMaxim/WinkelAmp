/// <reference types="node" />
// "Keep the strongest" (a layer's thin: 'loud'): automation.js thinRanks and
// passesStrongest, and slot.js deliveredChords with and without the flag.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadLayers } from '../scripts/node/layers';
import { REPO } from '../scripts/node/pack-io';
import { groupChords } from '../src/widgets/chords';
import { newFeatures } from '../src/widgets/features';
import type { InstanceState, LayeredSlot } from '../src/widgets/layers';
import type { Chord, Note, SlotLayer } from '../src/widgets/types';

const WA = loadLayers();

const notes: Note[] = [];
for (let i = 0; i < 400; i++) notes.push([i * 0.25, i * 0.25 + 0.4, 40 + ((i * 7) % 40), 30 + ((i * 13) % 90)]);
const chords = groupChords(notes);
const SALT = WA.fnv32('gust');

/** passes as it was before attackHash was split out of it, statement for statement. */
function oldPasses(t: number, a: number, salt: number): boolean {
  if (a >= 1) return true;
  if (!(a > 0)) return false;
  let h = 0x811c9dc5, i;
  const x = salt >>> 0, y = Math.round(t * 1000) >>> 0;
  for (i = 0; i < 4; i++) { h ^= (x >>> (8 * i)) & 0xff; h = Math.imul(h, 0x01000193); }
  for (i = 0; i < 4; i++) { h ^= (y >>> (8 * i)) & 0xff; h = Math.imul(h, 0x01000193); }
  return (h >>> 0) / 4294967296 < a;
}

/** A chord at t with velocity vel. */
const ch = (t: number, vel: number): Chord => ({ t, vel, notes: [{ m: 60, v: vel, d: 0.2 }], lo: 60, hi: 60 });

function inst(over: Partial<InstanceState> = {}): InstanceState {
  return { key: 'gust', widget: 'gust', salt: SALT, notes, chords, ci: 0, pulse: { level: 0, rate: 0, hit: 0 },
    feat: newFeatures(), own: true, routed: true, persist: 'redraw', win: null, ...over };
}
function slot(i: InstanceState, layer: SlotLayer, t: number): LayeredSlot {
  return { inst: i, receiving: true, weight: 1, layer, fired: [], lastT: 0, t, dt: 1 / 60 };
}

describe('the rule', () => {
  it('keeps the strongest first: a chord passes when the share of louder ones around it is below a', () => {
    // Five chords within 4 s of each other, velocities 10..50: at a, the loudest ⌈5a⌉ pass.
    const cs = [ch(0, 30), ch(1, 50), ch(2, 10), ch(3, 40), ch(3.5, 20)];
    const kept = (a: number) => cs.filter((c) => WA.passesStrongest(cs, c, a, SALT)).map((c) => c.vel);
    expect(kept(0.01)).toEqual([50]);
    expect(kept(0.2)).toEqual([50]);
    expect(kept(0.21)).toEqual([50, 40]);
    expect(kept(0.5)).toEqual([30, 50, 40]);
    expect(kept(0.99)).toEqual([30, 50, 10, 40, 20]);
    expect(WA.thinRanks(cs, SALT)).toEqual([0.4, 0, 0.8, 0.2, 0.6]);
  });
  it('keeps about the fraction a of a long piece, the strongest of any 8 s at any a above 0', () => {
    const rank = WA.thinRanks(chords, SALT);
    for (const a of [0.1, 0.3, 0.5, 0.8]) {
      const n = chords.filter((c) => WA.passesStrongest(chords, c, a, SALT)).length;
      expect(Math.abs(n / chords.length - a)).toBeLessThan(0.06);
    }
    for (let i = 0; i < chords.length; i++) {
      const near = chords.filter((c) => Math.abs(c.t - chords[i].t) <= WA.THIN_SPAN);
      if (chords[i].vel > Math.max(...near.filter((c) => c !== chords[i]).map((c) => c.vel))) {
        expect(rank[i]).toBe(0);
        expect(WA.passesStrongest(chords, chords[i], 1e-6, SALT)).toBe(true);
      }
    }
  });
  it('looks 4 s each way, both ends counted', () => {
    expect(WA.thinRanks([ch(0, 90), ch(4, 50), ch(8, 90)], SALT)).toEqual([0, 2 / 3, 0]);   // the middle one sees both
    expect(WA.thinRanks([ch(0, 90), ch(4, 50), ch(8.001, 90)], SALT)).toEqual([0, 1 / 2, 0]);   // the first only
  });
  it('breaks ties by the hash: on flat velocities it ranks by the hash within each window', () => {
    const flat = chords.map((c) => ({ ...c, vel: 64 }));
    const r = WA.thinRanks(flat, SALT), hs = flat.map((c) => WA.attackHash(c.t, SALT));
    for (let i = 0; i < flat.length; i++) {
      const near = flat.map((_c, j) => j).filter((j) => Math.abs(flat[j].t - flat[i].t) <= WA.THIN_SPAN);
      expect(r[i]).toBe(near.filter((j) => hs[j] > hs[i]).length / near.length);
    }
    // the biggest hash around wins, whatever the order the chords come in
    const two = [ch(0, 64), ch(1, 64)], h = two.map((c) => WA.attackHash(c.t, SALT));
    const first = h[0] > h[1] ? 0 : 1;
    expect(two.filter((c) => WA.passesStrongest(two, c, 0.4, SALT))).toEqual([two[first]]);
  });
  it('a lone chord passes at any a above 0', () => {
    const one = [ch(12, 5)];
    expect(WA.thinRanks(one, SALT)).toEqual([0]);
    expect(WA.passesStrongest(one, one[0], 0.001, SALT)).toBe(true);
  });
  it('passes everything at a ≥ 1 and nothing at a ≤ 0 (or NaN)', () => {
    for (const c of chords.slice(0, 50)) {
      expect(WA.passesStrongest(chords, c, 1, SALT)).toBe(true);
      expect(WA.passesStrongest(chords, c, 1.5, SALT)).toBe(true);
      expect(WA.passesStrongest(chords, c, 0, SALT)).toBe(false);
      expect(WA.passesStrongest(chords, c, -0.1, SALT)).toBe(false);
      expect(WA.passesStrongest(chords, c, NaN, SALT)).toBe(false);
    }
  });
  it('a chord not in the list takes passes', () => {
    const stray = ch(1234.5678, 100);
    for (const a of [0.2, 0.5, 0.9]) expect(WA.passesStrongest(chords, stray, a, SALT)).toBe(WA.passes(stray.t, a, SALT));
  });
});

describe('the cache', () => {
  it('works a list out once per list and salt', () => {
    const a = WA.thinRanks(chords, SALT);
    expect(WA.thinRanks(chords, SALT)).toBe(a);
    const other = WA.thinRanks(chords, WA.fnv32('fireworks'));
    expect(other).not.toBe(a);
    expect(WA.thinRanks(chords, SALT)).toBe(a);
  });
  it('a new list (a set of picks edited) gets its own ranks', () => {
    const before = [ch(0, 90), ch(1, 20), ch(2, 50)];
    expect(before.filter((c) => WA.passesStrongest(before, c, 0.3, SALT)).map((c) => c.t)).toEqual([0]);
    const after = [ch(0, 10), ch(1, 20), ch(2, 50)];
    expect(after.filter((c) => WA.passesStrongest(after, c, 0.3, SALT)).map((c) => c.t)).toEqual([2]);
    expect(before.filter((c) => WA.passesStrongest(before, c, 0.3, SALT)).map((c) => c.t)).toEqual([0]);
  });
});

describe('deliveredChords', () => {
  const pivots = [{ t: 0, v: 0.2 }, { t: 100, v: 0.9 }];

  it('without the flag, exactly what the old passes lets through', () => {
    const i = inst(), got = WA.deliveredChords(slot(i, { pivots }, 200));
    expect(got).toEqual(chords.filter((c) => oldPasses(c.t, WA.automationAt(pivots, c.t), SALT)));
    for (const c of chords) for (const a of [0, 0.05, 0.3, 0.77, 1]) expect(WA.passes(c.t, a, SALT)).toBe(oldPasses(c.t, a, SALT));
  });
  it('with the flag, what passesStrongest lets through, at each chord\'s own intensity', () => {
    const i = inst(), got = WA.deliveredChords(slot(i, { pivots, thin: 'loud' }, 200));
    expect(got).toEqual(chords.filter((c) => WA.passesStrongest(chords, c, WA.automationAt(pivots, c.t), SALT)));
    expect(got).not.toEqual(chords.filter((c) => WA.passes(c.t, WA.automationAt(pivots, c.t), SALT)));
  });
  it('an unrouted instance thins the step\'s fired chords on the song\'s chords', () => {
    const i = inst({ routed: false }), fired = chords.slice(20, 60);
    const got = WA.deliveredChords({ ...slot(i, { pivots: [{ t: 0, v: 0.3 }], thin: 'loud' }, 15), fired });
    expect(got).toEqual(fired.filter((c) => WA.passesStrongest(chords, c, 0.3, SALT)));
  });
  it('play and a seek deliver the same attacks', () => {
    const layer: SlotLayer = { pivots, thin: 'loud' };
    const run = (from: number, to: number) => {
      const i = inst(), out: number[] = [];
      WA.coldInstance(i, from);
      for (let t = from + 1 / 60; t <= to; t += 1 / 60) for (const c of WA.deliveredChords(slot(i, layer, t))) out.push(c.t);
      return out;
    };
    const played = run(0, 80), sought = run(40, 80);
    expect(sought.length).toBeGreaterThan(10);
    expect(played.filter((t) => t > 40 + 1 / 60)).toEqual(sought.filter((t) => t > 40 + 1 / 60));
  });
});

describe('on a real chord list', () => {
  const pack = resolve(REPO, 'songs', 'mountain-king', 'pack.json');
  it.skipIf(!existsSync(pack))('the unflagged path is today\'s, and the flag keeps the louder notes', () => {
    const real = groupChords((JSON.parse(readFileSync(pack, 'utf8')) as { notes: Note[] }).notes);
    const i = inst({ notes: [], chords: real });
    const flat = WA.deliveredChords(slot(i, { pivots: [{ t: 0, v: 0.3 }] }, 1e9));
    expect(flat).toEqual(real.filter((c) => oldPasses(c.t, 0.3, SALT)));
    const loud = WA.deliveredChords(slot(inst({ notes: [], chords: real }), { pivots: [{ t: 0, v: 0.3 }], thin: 'loud' }, 1e9));
    const mean = (cs: Chord[]) => cs.reduce((s, c) => s + c.vel, 0) / cs.length;
    expect(Math.abs(loud.length / real.length - 0.3)).toBeLessThan(0.05);
    expect(mean(loud)).toBeGreaterThan(mean(flat) + 5);
  });
});
