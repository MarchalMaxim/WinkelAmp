import { describe, expect, it } from 'vitest';
import { bassAttack, lowSquares, shakeDecay, shakeKick, squareEnvelope, squareSize, untone, held } from '../src/stage/elements/squares';
import { LIBRARY } from '../src/stage/library';
import { validateScript } from '../src/stage/script';

const SR = 48000;
/** 2048 samples: `before` sounding over the whole buffer, `after` only in the newest `fresh` samples (an attack this frame). */
function buffer(before: (t: number) => number, after: (t: number) => number, fresh = 700): Float32Array {
  const w = new Float32Array(2048);
  for (let i = 0; i < w.length; i++) {
    const t = i / SR;
    w[i] = before(t) + (i >= w.length - fresh ? after(t) : 0);
  }
  return w;
}
const sine = (hz: number, a: number) => (t: number) => a * Math.sin(2 * Math.PI * hz * t);
const none = () => 0;

describe('dread squares', () => {
  describe('bassAttack: how much of this frame\'s attack is below the split', () => {
    it('a low note struck this frame scores high; a high one, over the same quiet room, low', () => {
      const low = bassAttack(buffer(sine(440, 0.02), sine(41.2, 0.4)), 50);
      const high = bassAttack(buffer(sine(440, 0.02), sine(880, 0.4)), 50);
      expect(low).toBeGreaterThan(0.6);
      expect(high).toBeLessThan(0.15);
    });

    it('a bass struck this frame counts for more than one that was already ringing', () => {
      // (A chord over a ringing bass still counts somewhat: a piano's big chords strike their octaves too.)
      const ringing = bassAttack(buffer(sine(41.2, 0.3), sine(880, 0.3)), 50);
      const struck = bassAttack(buffer(sine(880, 0.05), sine(41.2, 0.3)), 50);
      expect(ringing).toBeLessThan(struck / 2);
    });

    it('a high note over a bass that is dying away makes no square', () => {
      const dying = (t: number) => 0.3 * Math.exp(-t * 30) * Math.sin(2 * Math.PI * 41.2 * t);
      expect(bassAttack(buffer(dying, sine(523, 0.2)), 50)).toBe(0);
    });

    it('a higher split lets higher notes count as low', () => {
      const g3 = buffer(none, sine(196, 0.4));
      expect(bassAttack(g3, 50)).toBeLessThan(bassAttack(g3, 66));
      expect(bassAttack(g3, 66)).toBeGreaterThan(0.3);
    });

    it('is 0 for silence and never NaN', () => {
      expect(bassAttack(new Float32Array(2048), 50)).toBe(0);
      expect(bassAttack(new Float32Array(0), 50)).toBe(0);
      expect(bassAttack(buffer(none, () => NaN), 50)).toBe(0);
    });
  });

  describe('lowSquares: which squares an attack makes', () => {
    it('nothing below the threshold, nothing while music time stands still', () => {
      expect(lowSquares(0.22, 0.9, 1 / 60)).toEqual([]);
      expect(lowSquares(0.9, 0.9, 0)).toEqual([]);
      expect(lowSquares(0.9, 0, 1 / 60)).toEqual([]);
    });

    it('a clearly low attack makes a square, a very low one its octave too (as the sketch\'s octaves did)', () => {
      const one = lowSquares(0.28, 0.8, 1 / 60);
      expect(one).toHaveLength(1);
      const two = lowSquares(0.9, 0.8, 1 / 60);
      expect(two).toHaveLength(2);
      // The deeper one is further below the split, so bigger.
      expect(two[0].depth).toBeGreaterThan(two[1].depth);
      expect(two[0].depth).toBeGreaterThan(one[0].depth);
    });

    it('maps the attack strength to the sketch\'s key velocity (about 65…115)', () => {
      const [soft] = lowSquares(0.5, 0.2, 1 / 60);
      const [hard] = lowSquares(0.5, 1, 1 / 60);
      expect(soft.v).toBeLessThan(hard.v);
      expect(hard.v).toBeCloseTo(115, 0);
      expect(soft.v).toBeGreaterThanOrEqual(60);
      // A typical live attack (strength 0.5–0.7) is a forte key, 85–97.
      expect(lowSquares(0.5, 0.5, 1 / 60)[0].v).toBeCloseTo(85, 0);
    });
  });

  it('squareSize: the sketch\'s pixels at 720p, in screen heights', () => {
    // C♯1 at velocity 110 under the default split: (110 + 25·9) px at 720p.
    expect(squareSize(25, 110, 1)).toBeCloseTo(335 / 720, 3);
    expect(squareSize(1, 110, 1)).toBeCloseTo(119 / 720, 3);
    expect(squareSize(25, 110, 2)).toBeCloseTo((2 * 335) / 720, 3);
    // Softer is smaller.
    expect(squareSize(25, 55, 1)).toBeLessThan(squareSize(25, 110, 1));
  });

  it('squareEnvelope: lands 16 % big and shrinks in 0.1 s, glows for 0.3 s, fades out over its life', () => {
    const e0 = squareEnvelope(0, 1.4);
    expect(e0.k).toBeCloseTo(1.16, 3);
    expect(e0.lit).toBeCloseTo(1, 3);
    expect(e0.fade).toBeCloseTo(1, 3);
    const e1 = squareEnvelope(0.1, 1.4);
    expect(e1.k).toBeCloseTo(1, 3);
    expect(squareEnvelope(0.3, 1.4).lit).toBeCloseTo(0.35, 3);
    expect(squareEnvelope(0.7, 1.4).fade).toBeCloseTo(Math.pow(0.5, 1.6), 3);
    expect(squareEnvelope(1.4, 1.4).fade).toBe(0);
    expect(squareEnvelope(3, 1.4).fade).toBe(0);
  });

  it("held: the sketch's canvas redraws a square every frame over its 12 % fade, so a faint square shows far brighter", () => {
    expect(held(0)).toBe(0);
    expect(held(1)).toBeCloseTo(1, 6);
    expect(held(0.92)).toBeCloseTo(0.92 / (0.12 + 0.88 * 0.92), 6);
    // A square at a fifth of its opacity still shows at two thirds.
    expect(held(0.19)).toBeCloseTo(0.66, 2);
    expect(held(NaN)).toBe(0);
  });

  it('shake: only the loudest attacks kick it (velocity over 95), and it dies away on music time', () => {
    expect(shakeKick(95, 1)).toBe(0);
    expect(shakeKick(110, 1)).toBeCloseTo(18, 3);
    expect(shakeKick(110, 0)).toBe(0);
    expect(shakeKick(110, 2)).toBeCloseTo(36, 3);
    expect(shakeDecay(10, 0)).toBe(10);
    expect(shakeDecay(10, 1 / 60)).toBeCloseTo(8.6, 3);
    expect(shakeDecay(10, 1)).toBeLessThan(0.01);
  });

  it("is in the live director's library: the Dread scene, a dark blend never above an archetype's own scene", () => {
    const d = LIBRARY.find((s) => s.name === 'Dread')!;
    expect(d.elements.map((e) => e.type)).toContain('squares');
    expect(d.affinity.abyss).toBeGreaterThan(0);
    for (const v of Object.values(d.affinity)) expect(v).toBeLessThanOrEqual(0.7);
  });

  it("untone: the scene light the final pass's exposure and ACES tone map show as the sketch's colour", () => {
    const aces = (x: number) => Math.min(1, Math.max(0, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)));
    for (const y of [0, 0.01, 0.05, 0.12, 0.3, 0.6]) expect(aces(0.9 * untone(y))).toBeCloseTo(y, 4);
    expect(untone(0.12)).toBeLessThan(0.12);
    expect(untone(NaN)).toBe(0);
  });

  it('scripts can set its knobs', () => {
    const r = validateScript({
      version: 1, id: 'sq', title: 'Squares', duration: 60, match: { kind: 'recording' },
      scenes: { s: { elements: [{ id: 'dread', type: 'squares', params: { style: 'blood', knobs: { life: 2, split: 56, shake: { drive: '+level', depth: 1 } } } }] } },
      timeline: [{ at: 0, scene: 's' }],
    });
    expect(r.ok ? [] : r.errors).toEqual([]);
  });
});
