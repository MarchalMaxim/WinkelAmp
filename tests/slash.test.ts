import { describe, expect, it } from 'vitest';
import { chordLike, slashCut } from '../src/stage/elements/slash';
import { validateScript } from '../src/stage/script';

describe('slash', () => {
  const C = (n: number) => {
    const c = new Float32Array(12).fill(0.1);
    for (let i = 0; i < n; i++) c[(i * 4) % 12] = 1 - i * 0.1;
    return c;
  };

  it('reads three or more strong pitch classes, or a sound spanning the keyboard, as a chord', () => {
    expect(chordLike(C(3), 0.3)).toBe(true);
    expect(chordLike(C(2), 0.3)).toBe(false);
    expect(chordLike(new Float32Array(12), 0)).toBe(false);
    // A massive chord smears the chroma (reverb, the last chord still ringing) but fills the register.
    expect(chordLike(C(2), 0.7)).toBe(true);
    expect(chordLike(C(1), NaN)).toBe(false);
  });

  it('chords: cuts on a loud chord, not on a loud single line or a soft chord', () => {
    expect(slashCut('chords', 0.7, 0.95, true, 10, -Infinity, 1 / 60)).not.toBeNull();
    expect(slashCut('chords', 0.7, 0.95, false, 10, -Infinity, 1 / 60)).toBeNull();
    expect(slashCut('chords', 0.7, 0.5, true, 10, -Infinity, 1 / 60)).toBeNull();
  });

  it('intensity lowers the threshold', () => {
    expect(slashCut('chords', 0.3, 0.62, true, 10, -Infinity, 1 / 60)).toBeNull();
    expect(slashCut('chords', 1, 0.62, true, 10, -Infinity, 1 / 60)).not.toBeNull();
  });

  it('every: cuts on any onset above a lower threshold, chord or not', () => {
    expect(slashCut('every', 0.7, 0.5, false, 10, -Infinity, 1 / 60)).not.toBeNull();
    expect(slashCut('chords', 0.7, 0.5, true, 10, -Infinity, 1 / 60)).toBeNull();
    expect(slashCut('every', 0.7, 0.3, false, 10, -Infinity, 1 / 60)).toBeNull();
  });

  it('rests 120 ms (music time) after a cut', () => {
    expect(slashCut('chords', 0.7, 1, true, 10, 9.9, 1 / 60)).toBeNull();
    expect(slashCut('every', 0.7, 1, false, 10, 9.9, 1 / 60)).toBeNull();
    expect(slashCut('chords', 0.7, 1, true, 10, 9.87, 1 / 60)).not.toBeNull();
  });

  it('never cuts while music time stands still (a noisy room in silence)', () => {
    expect(slashCut('every', 1, 1, true, 10, -Infinity, 0)).toBeNull();
  });

  it('cuts harder on louder attacks, 0..1', () => {
    const soft = slashCut('chords', 0.7, 0.8, true, 10, -Infinity, 1 / 60)!;
    const hard = slashCut('chords', 0.7, 1, true, 10, -Infinity, 1 / 60)!;
    expect(hard).toBeGreaterThan(soft);
    expect(soft).toBeGreaterThanOrEqual(0);
    expect(hard).toBeLessThanOrEqual(1);
  });

  it('treats an unknown style as the default (chords)', () => {
    expect(slashCut('nope', 0.7, 0.9, false, 10, -Infinity, 1 / 60)).toBeNull();
  });
});

function knives(): any {
  return {
    version: 1, id: 'knives', title: 'Knives', duration: 60, match: { kind: 'recording' },
    scenes: {
      casket: {
        look: { melt: 0.6 },
        elements: [
          { id: 'knife', type: 'slash', params: { style: 'every', intensity: 0.8 } },
          { id: 'paint', type: 'drip', params: { style: 'tar' } },
        ],
      },
    },
    timeline: [{ at: 0, scene: 'casket' }, { at: 10, enter: { id: 'blade', type: 'slash' } }],
  };
}

describe('validator: slash and drip', () => {
  it('accepts them with their styles', () => {
    const r = validateScript(knives());
    expect(r.ok ? [] : r.errors).toEqual([]);
  });

  it('rejects an unknown slash or drip style', () => {
    const s = knives();
    s.scenes.casket.elements[0].params.style = 'stab';
    s.scenes.casket.elements[1].params.style = 'stars';
    const r = validateScript(s);
    expect(r.ok ? [] : r.errors).toEqual([
      expect.stringMatching(/^scenes\.casket\.elements\[0\]\.params\.style:/),
      expect.stringMatching(/^scenes\.casket\.elements\[1\]\.params\.style:/),
    ]);
  });
});
