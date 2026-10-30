import { describe, expect, it } from 'vitest';
import { ScriptPlayer } from '../src/stage/player';
import type { CastMember, Cue, Script, SongData, StageDirectives } from '../src/stage/types';

/** A script with the given timeline over three scenes: `a` and `b` share `mel`; `c` reuses the id `mel` as a different type. */
function script(timeline: Cue[]): Script {
  return {
    version: 1,
    id: 'test-piece',
    title: 'Test Piece',
    duration: 120,
    match: { kind: 'recording' },
    scenes: {
      a: {
        look: { trails: 0.2, warp: 0.1, mirror: 2, palette: 'mood' },
        elements: [{ id: 'mel', type: 'melody' }, { id: 'low', type: 'bass', params: { intensity: 0.4 } }],
      },
      b: {
        look: { trails: 0.8, warp: 0.5, mirror: 6, palette: ['#000', '#111', '#222', '#333'] },
        elements: [{ id: 'mel', type: 'melody', params: { intensity: 1, region: 'top' } }, { id: 'air', type: 'bloom' }],
      },
      c: { elements: [{ id: 'mel', type: 'wave' }] },
    },
    timeline,
  };
}

/** Song data with only what the player reads (onsets and beats). */
function songData(onsets: number[], beats: number[] = []): SongData {
  return { onsets: onsets.map((t) => ({ t, s: 1 })), beats } as unknown as SongData;
}

const member = (d: StageDirectives, id: string): CastMember | undefined => d.cast.find((m) => m.spec.id === id);
const presence = (d: StageDirectives, id: string) => member(d, id)?.presence;

/** Seeded PRNG (mulberry32), local to each test that needs one. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

describe('ScriptPlayer', () => {
  it('player seek determinism', () => {
    const s = script([
      { at: 0, scene: 'a' },
      { at: 5, enter: { id: 'sp', type: 'sparks' } },
      { at: 8, ramp: { target: 'look.trails', to: 0.9, duration: 6 } },
      { at: 10, scene: 'b', transition: { kind: 'blend', duration: 2 } },
      { at: 10.5, accent: { kind: 'flash' } },
      { at: 14, ramp: { target: 'mel.size', to: 0.9, duration: 4 } },
      { at: 15, exit: 'sp' },
      { at: 20, scene: 'c', transition: { kind: 'blend' } },
      { at: 30, scene: 'a', transition: { kind: 'cut' } },
      { at: 30, accent: { kind: 'shock', color: '#f80', strength: 0.5 } },
    ]);
    const data = songData([4.95, 10.06, 19.9, 29.97], [0, 0.5, 15.1]);
    const r = rng(7);
    const ts = Array.from({ length: 200 }, () => -2 + r() * 40);
    ts.push(-1, 0, 5, 10.06, 11.06, 15.1, 30, 200);
    const player = new ScriptPlayer(s, data);
    const shuffled = [...ts].sort(() => r() - 0.5);
    const random = new Map(shuffled.map((t) => [t, player.at(t)]));
    const fresh = new ScriptPlayer(s, data);
    for (const t of [...ts].sort((x, y) => x - y)) {
      const asc = player.at(t);
      expect(asc).toEqual(random.get(t));
      expect(fresh.at(t)).toEqual(asc);
    }
  });

  it('returns fresh objects: mutating one result does not change the next', () => {
    const s = script([{ at: 0, scene: 'b' }, { at: 1, accent: { kind: 'flash' } }]);
    const p = new ScriptPlayer(s);
    const first = p.at(1.2);
    const again = structuredClone(first);
    first.cast[0].spec.params.intensity = 0;
    first.cast[0].presence = 0;
    (first.look.palette as string[])[0] = '#fff';
    first.accents[0].color[0] = 0;
    expect(p.at(1.2)).toEqual(again);
  });

  it('is empty before the first cue', () => {
    const p = new ScriptPlayer(script([{ at: 3, scene: 'a' }]));
    const d = p.at(2.9);
    expect(d.cast).toEqual([]);
    expect(d.scene).toBe('');
    expect(d.source).toBe('scripted');
    expect(p.at(3).scene).toBe('a');
  });

  it('blend presences', () => {
    const p = new ScriptPlayer(script([{ at: 0, scene: 'a' }, { at: 20, scene: 'b', transition: { kind: 'blend', duration: 2 } }]));
    expect(presence(p.at(19.99), 'low')).toBe(1);
    expect(presence(p.at(19.99), 'air')).toBeUndefined();
    expect(presence(p.at(20), 'air')).toBe(0);
    const mid = p.at(21);
    expect(mid.scene).toBe('b');
    expect(presence(mid, 'low')).toBeCloseTo(0.5, 2);
    expect(presence(mid, 'air')).toBeCloseTo(0.5, 2);
    expect(presence(p.at(21.5), 'low')).toBeCloseTo(0.25, 2);
    const after = p.at(22);
    expect(presence(after, 'low')).toBeUndefined();
    expect(presence(after, 'air')).toBe(1);
  });

  it('blend defaults to 1.5 s', () => {
    const p = new ScriptPlayer(script([{ at: 0, scene: 'a' }, { at: 20, scene: 'b' }]));
    expect(presence(p.at(20.75), 'low')).toBeCloseTo(0.5, 2);
    expect(presence(p.at(21.5), 'low')).toBeUndefined();
  });

  it('cut is instant', () => {
    const p = new ScriptPlayer(script([{ at: 0, scene: 'a' }, { at: 20, scene: 'b', transition: { kind: 'cut' } }]));
    expect(presence(p.at(19.999), 'low')).toBe(1);
    const d = p.at(20);
    expect(presence(d, 'low')).toBeUndefined();
    expect(presence(d, 'air')).toBe(1);
    expect(d.look.trails).toBe(0.8);
    expect(d.look.mirror).toBe(6);
  });

  it('carry-through id keeps presence 1', () => {
    const p = new ScriptPlayer(script([{ at: 0, scene: 'a' }, { at: 20, scene: 'b', transition: { kind: 'blend', duration: 2 } }]));
    for (const t of [19.5, 20, 20.5, 21, 21.5, 22, 30]) {
      const d = p.at(t);
      expect(d.cast.filter((m) => m.spec.id === 'mel')).toHaveLength(1);
      expect(presence(d, 'mel')).toBe(1);
    }
    // Its params move to the new scene's: numbers glide over the blend, the rest switches at the midpoint.
    expect(member(p.at(21), 'mel')!.spec.params.intensity).toBeCloseTo(0.85, 6);
    expect(member(p.at(20.9), 'mel')!.spec.params.region).toBe('full');
    expect(member(p.at(21), 'mel')!.spec.params.region).toBe('top');
    expect(member(p.at(22), 'mel')!.spec.params.intensity).toBe(1);
  });

  it('a carried id whose type changes dips out and back in, switching type at the midpoint', () => {
    const p = new ScriptPlayer(script([{ at: 0, scene: 'a' }, { at: 20, scene: 'c', transition: { kind: 'blend', duration: 2 } }]));
    expect(presence(p.at(20.5), 'mel')).toBeCloseTo(0.5, 6);
    expect(member(p.at(20.99), 'mel')!.spec.type).toBe('melody');
    expect(presence(p.at(21), 'mel')).toBe(0);
    expect(member(p.at(21), 'mel')!.spec.type).toBe('wave');
    expect(member(p.at(21), 'mel')!.spec.params.style).toBe('line');
    expect(presence(p.at(21.5), 'mel')).toBeCloseTo(0.5, 6);
    expect(presence(p.at(22), 'mel')).toBe(1);
  });

  it('enter/exit fades', () => {
    const p = new ScriptPlayer(script([
      { at: 0, scene: 'a' },
      { at: 10, enter: { id: 'sp', type: 'sparks' } },
      { at: 20, exit: 'sp' },
      { at: 30, enter: { id: 'sp2', type: 'pulse' }, fade: 2 },
      { at: 40, exit: 'sp2', fade: 0 },
    ]));
    expect(presence(p.at(9.99), 'sp')).toBeUndefined();
    expect(presence(p.at(10), 'sp')).toBe(0);
    expect(presence(p.at(10.4), 'sp')).toBeCloseTo(0.5, 6);
    expect(presence(p.at(10.8), 'sp')).toBe(1);
    expect(presence(p.at(20), 'sp')).toBe(1);
    expect(presence(p.at(20.6), 'sp')).toBeCloseTo(0.5, 6);
    expect(presence(p.at(21.19), 'sp')).toBeGreaterThan(0);
    expect(presence(p.at(21.2), 'sp')).toBeUndefined();
    expect(presence(p.at(31), 'sp2')).toBeCloseTo(0.5, 6);
    expect(presence(p.at(40), 'sp2')).toBeUndefined();
    // Entered elements get every param filled.
    expect(member(p.at(15), 'sp')!.spec.params).toEqual({ intensity: 0.7, size: 0.5, region: 'full', color: 'mood', style: 'stars' });
  });

  it('an exit during a fade-in fades out from where it got to', () => {
    const p = new ScriptPlayer(script([{ at: 0, scene: 'a' }, { at: 10, enter: { id: 'sp', type: 'sparks' }, fade: 1 }, { at: 10.5, exit: 'sp', fade: 1 }]));
    expect(presence(p.at(10.5), 'sp')).toBeCloseTo(0.5, 6);
    expect(presence(p.at(11), 'sp')).toBeCloseTo(0.25, 6);
    expect(presence(p.at(11.5), 'sp')).toBeUndefined();
  });

  it('a scene change fades out elements entered by cues that are not in the new scene', () => {
    const p = new ScriptPlayer(script([{ at: 0, scene: 'a' }, { at: 5, enter: { id: 'sp', type: 'sparks' } }, { at: 20, scene: 'b', transition: { kind: 'blend', duration: 2 } }]));
    expect(presence(p.at(21), 'sp')).toBeCloseTo(0.5, 2);
    expect(presence(p.at(22), 'sp')).toBeUndefined();
  });

  it('entering an id already on stage restyles it instead of adding a second one', () => {
    const p = new ScriptPlayer(script([{ at: 0, scene: 'a' }, { at: 10, enter: { id: 'low', type: 'bass', params: { intensity: 1, style: 'tides' } }, fade: 2 }]));
    const d = p.at(11);
    expect(d.cast.filter((m) => m.spec.id === 'low')).toHaveLength(1);
    expect(presence(d, 'low')).toBe(1);
    expect(member(d, 'low')!.spec.params.intensity).toBeCloseTo(0.7, 6);
    expect(member(d, 'low')!.spec.params.style).toBe('tides');
    expect(member(p.at(10.99), 'low')!.spec.params.style).toBe('orbs');
  });

  it('exit or ramp of an id not on stage does nothing', () => {
    const p = new ScriptPlayer(script([{ at: 0, scene: 'a' }, { at: 10, exit: 'air' }, { at: 11, ramp: { target: 'air.size', to: 1, duration: 1 } }]));
    expect(p.at(12)).toEqual(p.at(9));
  });

  it('accent window', () => {
    const p = new ScriptPlayer(script([{ at: 0, scene: 'a' }, { at: 30, accent: { kind: 'shock', color: '#ff8000', strength: 0.5 } }, { at: 40, accent: { kind: 'flash' } }]));
    expect(p.at(29.99).accents).toEqual([]);
    expect(p.at(30).accents).toEqual([{ kind: 'shock', color: [1, 128 / 255, 0], strength: 0.5, age: 0 }]);
    const a = p.at(31.4).accents;
    expect(a).toHaveLength(1);
    expect(a[0].age).toBeCloseTo(1.4, 9);
    expect(p.at(31.6).accents).toEqual([]);
    // Defaults: white, full strength; `#rgb` shorthand parses too.
    expect(p.at(40).accents).toEqual([{ kind: 'flash', color: [1, 1, 1], strength: 1, age: 0 }]);
  });

  it('ramp', () => {
    const p = new ScriptPlayer(script([{ at: 0, scene: 'a' }, { at: 30, ramp: { target: 'look.trails', to: 0.8, duration: 10 } }]));
    expect(p.at(29).look.trails).toBeCloseTo(0.2, 9);
    expect(p.at(35).look.trails).toBeCloseTo(0.5, 9);
    expect(p.at(40).look.trails).toBeCloseTo(0.8, 9);
    expect(p.at(60).look.trails).toBeCloseTo(0.8, 9);
  });

  it('ramps an element param, and a later ramp starts from where the earlier one got to', () => {
    const p = new ScriptPlayer(script([
      { at: 0, scene: 'a' },
      { at: 10, ramp: { target: 'low.intensity', to: 1, duration: 6 } },
      { at: 13, ramp: { target: 'low.intensity', to: 0, duration: 7 } },
    ]));
    expect(member(p.at(13), 'low')!.spec.params.intensity).toBeCloseTo(0.7, 9);
    expect(member(p.at(16.5), 'low')!.spec.params.intensity).toBeCloseTo(0.35, 9);
    expect(member(p.at(25), 'low')!.spec.params.intensity).toBe(0);
  });

  it('look blends linearly across a scene blend; palette and mirror switch at the midpoint', () => {
    const p = new ScriptPlayer(script([{ at: 0, scene: 'a' }, { at: 20, scene: 'b', transition: { kind: 'blend', duration: 2 } }, { at: 40, scene: 'c', transition: { kind: 'cut' } }]));
    const q = p.at(20.5).look;
    expect(q.trails).toBeCloseTo(0.35, 9);
    expect(q.warp).toBeCloseTo(0.2, 9);
    expect(q.glow).toBeCloseTo(0.6, 9);
    expect(q.palette).toBe('mood');
    expect(q.mirror).toBe(2);
    const h = p.at(21).look;
    expect(h.trails).toBeCloseTo(0.5, 9);
    expect(h.palette).toEqual(['#000', '#111', '#222', '#333']);
    expect(h.mirror).toBe(6);
    // A scene without a look gets the default look, not the previous scene's.
    expect(p.at(40).look).toEqual({ palette: 'mood', trails: 0.5, warp: 0.2, mirror: 1, glow: 0.6 });
  });

  it('snapping', () => {
    const tl: Cue[] = [{ at: 0, scene: 'a' }, { at: 10, accent: { kind: 'flash' } }];
    const near = new ScriptPlayer(script(tl), songData([3, 10.09]));
    expect(near.cueTimes[1]).toBeCloseTo(10.09, 9);
    expect(near.at(10.05).accents).toEqual([]);
    expect(near.at(10.09).accents).toHaveLength(1);

    expect(new ScriptPlayer(script(tl), songData([10.2])).cueTimes[1]).toBe(10);
    const off: Cue[] = [{ at: 0, scene: 'a' }, { at: 10, accent: { kind: 'flash' }, snap: false }];
    expect(new ScriptPlayer(script(off), songData([10.09])).cueTimes[1]).toBe(10);
    expect(new ScriptPlayer(script(tl)).cueTimes).toEqual([0, 10]);
  });

  it('snaps to the nearest of onsets and beats, at most 120 ms away', () => {
    const tl: Cue[] = [{ at: 0, scene: 'a' }, { at: 10, accent: { kind: 'flash' } }, { at: 20, accent: { kind: 'swell' } }, { at: 30, accent: { kind: 'shock' } }];
    const p = new ScriptPlayer(script(tl), songData([9.9, 20.12, 30.13], [10.05, 29.95]));
    expect(p.cueTimes[1]).toBeCloseTo(10.05, 9);
    expect(p.cueTimes[2]).toBeCloseTo(20.12, 9);
    expect(p.cueTimes[3]).toBeCloseTo(29.95, 9);
  });

  it('applies cues in snapped order, ties in timeline order', () => {
    // The exit is written first but snaps later than the enter of the same id.
    const tl: Cue[] = [
      { at: 0, scene: 'a' },
      { at: 10, enter: { id: 'sp', type: 'sparks' }, fade: 0 },
      { at: 20, exit: 'sp', fade: 0 },
      { at: 20.05, enter: { id: 'sp', type: 'sparks' }, fade: 0, snap: false },
    ];
    const p = new ScriptPlayer(script(tl), songData([20.1]));
    expect(p.cueTimes).toEqual([0, 10, 20.1, 20.05]);
    expect(presence(p.at(20.07), 'sp')).toBe(1);
    expect(presence(p.at(20.1), 'sp')).toBeUndefined();
  });
});
