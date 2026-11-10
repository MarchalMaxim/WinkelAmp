// The helpers in lab/kit.js (window.KIT): small, pure, and the same on every run.
import { describe, expect, it } from 'vitest';
import { kit } from './helpers/widget';

const K = kit();

describe('KIT', () => {
  it('clamp, lerp and smooth', () => {
    expect([K.clamp(2), K.clamp(-1), K.clamp(0.4), K.clamp(5, 2, 4), K.clamp(1, 2, 4)]).toEqual([1, 0, 0.4, 4, 2]);
    expect([K.lerp(10, 20, 0), K.lerp(10, 20, 0.5), K.lerp(10, 20, 1)]).toEqual([10, 15, 20]);
    expect([K.smooth(0, 1, -1), K.smooth(0, 1, 0.5), K.smooth(0, 1, 2)]).toEqual([0, 0.5, 1]);
    expect(K.smooth(2, 4, 3)).toBe(0.5);
  });

  it('rgb and hsl give css strings, alpha defaulting to 1', () => {
    expect(K.rgb(1, 2, 3)).toBe('rgba(1,2,3,1)');
    expect(K.rgb(1, 2, 3, 0.5)).toBe('rgba(1,2,3,0.5)');
    expect(K.hsl(10, 20, 30)).toBe('hsla(10,20%,30%,1)');
    expect(K.hsl(10, 20, 30, 0)).toBe('hsla(10,20%,30%,0)');
  });

  it('hash is deterministic, in 0..1 and spreads', () => {
    expect(K.hash(7)).toBe(K.hash(7));
    const v: number[] = Array.from({ length: 500 }, (_, i) => K.hash(i));
    expect(v.every((x: number) => x >= 0 && x < 1)).toBe(true);
    expect(new Set(v).size).toBe(500);
    expect(Math.abs(v.reduce((a, b) => a + b, 0) / 500 - 0.5)).toBeLessThan(0.06);
  });

  it('rng repeats per seed and differs between seeds', () => {
    const a = K.rng(42), b = K.rng(42), c = K.rng(43);
    const A: number[] = Array.from({ length: 20 }, a), B = Array.from({ length: 20 }, b), C = Array.from({ length: 20 }, c);
    expect(A).toEqual(B);
    expect(A).not.toEqual(C);
    expect(A.every((x: number) => x >= 0 && x < 1)).toBe(true);
  });

  it('SNAP is there and runs', () => {
    expect(K.SNAP.env(0, { v: 100, m: 60 }).E).toBeGreaterThan(0);
  });
});
