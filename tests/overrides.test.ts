import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK as V1_DEFAULT, type Look as V1Look } from '../src/settings';
import { parseColor } from '../src/stage/gl';
import { Overrides, stageLook } from '../src/stage/overrides';
import { ScriptPlayer } from '../src/stage/player';
import type { CastMember, Look, Script, StageDirectives } from '../src/stage/types';

/** Two scenes with different looks and casts; `a` at 0 s, a cut to `b` at 10 s, a flash at 12 s. */
const SCRIPT: Script = {
  version: 1,
  id: 'test-piece',
  title: 'Test Piece',
  duration: 60,
  match: { kind: 'recording' },
  scenes: {
    a: { look: { palette: 'mood', trails: 0.2, warp: 0.1, mirror: 2 }, elements: [{ id: 'mel', type: 'melody' }, { id: 'low', type: 'bass' }] },
    b: { look: { palette: ['#000', '#123', '#456', '#fff'], trails: 0.8, warp: 0.5, mirror: 6 }, elements: [{ id: 'air', type: 'bloom' }] },
  },
  timeline: [
    { at: 0, scene: 'a', snap: false },
    { at: 10, scene: 'b', transition: { kind: 'cut' }, snap: false },
    { at: 12, accent: { kind: 'flash' }, snap: false },
  ],
};
const player = new ScriptPlayer(SCRIPT);
const USER: Look = { palette: ['#ff0000', '#00ff00', '#0000ff', '#ffffff'], trails: 0.9, warp: 0.7, mirror: 8, glow: 0.3 };
const ids = (d: StageDirectives) => d.cast.map((m) => m.spec.id).sort();

describe('Overrides', () => {
  it('passes the directives through untouched when nothing is pinned or paused', () => {
    const o = new Overrides();
    const dir = player.at(5);
    const before = JSON.stringify(dir);
    const out = o.apply(dir, USER);
    expect(out).toEqual(dir);
    expect(JSON.stringify(dir)).toBe(before);
  });

  it('a pinned palette survives a scripted scene change; unpinned parameters still follow the script', () => {
    const o = new Overrides();
    o.pin('palette');
    const a = o.apply(player.at(5), USER);
    const b = o.apply(player.at(11), USER);
    expect(a.look.palette).toEqual(USER.palette);
    expect(b.look.palette).toEqual(USER.palette);
    expect(a.look.trails).toBeCloseTo(0.2);
    expect(b.look.trails).toBeCloseTo(0.8);
    expect(b.scene).toBe('b');
    expect(ids(b)).toEqual(['air']);
  });

  it('pins each parameter on its own, and does not mutate the directives', () => {
    const o = new Overrides();
    o.pin('trails');
    o.pin('mirror');
    o.pin('warp');
    const dir = player.at(5);
    const before = JSON.stringify(dir);
    const out = o.apply(dir, USER);
    expect(out.look).toEqual({ ...dir.look, trails: 0.9, mirror: 8, warp: 0.7 });
    expect(JSON.stringify(dir)).toBe(before);
    // A pinned palette is a copy: changing the result leaves the user's look alone.
    o.pin('palette');
    const p = o.apply(dir, USER).look.palette as string[];
    p[0] = '#000000';
    expect(USER.palette[0]).toBe('#ff0000');
  });

  it("pauseScript: the user's look, the last cast, and no accents", () => {
    const o = new Overrides();
    const a = o.apply(player.at(5), USER);
    o.pauseScript();
    expect(o.scriptPaused).toBe(true);
    // The script moves on to scene b and fires a flash; the stage keeps scene a's cast.
    const later = o.apply(player.at(12.1), USER);
    expect(player.at(12.1).accents.length).toBe(1);
    expect(later.look).toEqual(USER);
    expect(ids(later)).toEqual(ids(a));
    expect(later.scene).toBe('a');
    expect(later.accents).toEqual([]);
    // Resuming returns to the script where it now is.
    o.resume();
    const back = o.apply(player.at(12.1), USER);
    expect(ids(back)).toEqual(['air']);
    expect(back.accents.length).toBe(1);
  });

  it('pauseScript can hold a chosen cast (a scene picked in the drawer)', () => {
    const o = new Overrides();
    o.apply(player.at(5), USER);
    const cast: CastMember[] = [{ spec: { id: 'w', type: 'wave', params: { intensity: 1, size: 0.5, region: 'full', color: 'mood', style: '' } }, presence: 1 }];
    o.pauseScript({ scene: 'Picked', cast });
    const out = o.apply(player.at(30), USER);
    expect(out.scene).toBe('Picked');
    expect(ids(out)).toEqual(['w']);
  });

  it('reset (a track change) clears the pins and resumes the script', () => {
    const o = new Overrides();
    o.pin('palette');
    o.pin('mirror');
    o.pauseScript();
    o.reset();
    expect(o.pinned.size).toBe(0);
    expect(o.scriptPaused).toBe(false);
    const dir = player.at(11);
    expect(o.apply(dir, USER)).toEqual(dir);
  });
});

describe('stageLook', () => {
  const v1 = (p: Partial<V1Look>): V1Look => ({ ...V1_DEFAULT, ...p });

  it('maps drift to warp and keeps trails and mirror', () => {
    const l = stageLook(v1({ trails: 0.3, drift: 0.9, mirror: 6 }));
    expect(l.trails).toBe(0.3);
    expect(l.warp).toBe(0.9);
    expect(l.mirror).toBe(6);
    expect(Number.isFinite(l.glow)).toBe(true);
  });

  it("keeps 'notes' and turns a v1 palette into four fixed colors, darkest first", () => {
    expect(stageLook(v1({ palette: 'notes' })).palette).toBe('notes');
    const p = stageLook(v1({ palette: 'sunset' })).palette;
    expect(Array.isArray(p)).toBe(true);
    const rgb = (p as string[]).map((h) => parseColor(h));
    expect(rgb.every((c) => c !== null)).toBe(true);
    const luma = rgb.map((c) => 0.2126 * c![0] + 0.7152 * c![1] + 0.0722 * c![2]);
    expect(luma[0]).toBeLessThan(luma[3]);
  });
});
