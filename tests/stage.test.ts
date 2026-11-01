import { describe, expect, it } from 'vitest';
import { chordOf, chordRgb } from '../src/stage/elements/bloom';
import { melodyLayout, pitchHeight } from '../src/stage/elements/melody';
import { trigger } from '../src/stage/elements/wave';
import { ELEMENTS, STYLES } from '../src/stage/elements';
import { ease, parseColor, regionRect, styleOf } from '../src/stage/gl';
import { reconcile } from '../src/stage/stage';
import { normalizeSpec } from '../src/stage/script';
import type { CastMember, ElementType, Region } from '../src/stage/types';

const member = (id: string, type: ElementType): CastMember => ({ spec: normalizeSpec({ id, type }), presence: 1 });

describe('stage cast reconcile', () => {
  it('creates new ids and drops ids no longer cast', () => {
    const live = new Map<string, ElementType>([['a', 'melody'], ['b', 'bass']]);
    const r = reconcile(live, [member('a', 'melody'), member('c', 'sparks')]);
    expect(r.drop).toEqual(['b']);
    expect(r.create.map((m) => m.spec.id)).toEqual(['c']);
  });
  it('recreates an id whose type changed', () => {
    const r = reconcile(new Map([['x', 'melody']]), [member('x', 'wave')]);
    expect(r.drop).toEqual(['x']);
    expect(r.create.map((m) => `${m.spec.id}:${m.spec.type}`)).toEqual(['x:wave']);
  });
  it('keeps an instance at presence 0 (fading out keeps its state)', () => {
    const r = reconcile(new Map([['x', 'melody']]), [{ ...member('x', 'melody'), presence: 0 }]);
    expect(r).toEqual({ create: [], drop: [] });
  });
  it('creates a duplicated id once', () => {
    const r = reconcile(new Map(), [member('x', 'melody'), member('x', 'melody')]);
    expect(r.create).toHaveLength(1);
  });
});

describe('element registry', () => {
  it('has a factory for every element type, producing that type', () => {
    for (const type of Object.keys(STYLES) as ElementType[]) expect(ELEMENTS[type]().type).toBe(type);
  });
});

describe('chord reading', () => {
  const chroma = (tones: number[], rest = 0.05) => {
    const c = new Float32Array(12).fill(rest);
    tones.forEach((t, i) => (c[t] = [1, 0.8, 0.85][i]));
    return c;
  };
  it('names major and minor triads', () => {
    expect(chordOf(chroma([0, 4, 7]))).toEqual({ root: 0, minor: false });
    expect(chordOf(chroma([9, 0, 4]))).toEqual({ root: 9, minor: true });
    expect(chordOf(chroma([7, 11, 2]))).toEqual({ root: 7, minor: false });
  });
  it('names nothing in silence or noise (the caller keeps its chord)', () => {
    expect(chordOf(new Float32Array(12))).toBeNull();
    expect(chordOf(new Float32Array(12).fill(1))).toBeNull();
    expect(chordOf(new Float32Array(12).fill(NaN))).toBeNull();
  });
  it('colors minor chords cooler than their major', () => {
    const blue = (c: number[]) => c[2] / (c[0] + c[1] + c[2]);
    for (const root of [0, 2, 7]) expect(blue(chordRgb({ root, minor: true }))).toBeGreaterThan(blue(chordRgb({ root, minor: false })));
  });
});

describe('stage helpers', () => {
  it('maps pitch over the melody range, clamped', () => {
    expect(pitchHeight(36)).toBe(0);
    expect(pitchHeight(66)).toBeCloseTo(0.5);
    expect(pitchHeight(96)).toBe(1);
    expect(pitchHeight(120)).toBe(1);
  });
  it('freezes eased values when no music time passes', () => {
    expect(ease(0.3, 1, 0, 0.1)).toBe(0.3);
    expect(ease(0.3, 1, 1, 0.1)).toBeCloseTo(1, 3);
  });
  it('parses #rgb and #rrggbb to linear RGB', () => {
    expect(parseColor('#fff')).toEqual([1, 1, 1]);
    expect(parseColor('#000000')).toEqual([0, 0, 0]);
    expect(parseColor('#ff0000')![0]).toBe(1);
    expect(parseColor('mood')).toBeNull();
  });
  it('places regions with y up', () => {
    expect(regionRect('bottom')).toEqual([0, 0, 1, 0.5]);
    expect(regionRect('top')).toEqual([0, 0.5, 1, 1]);
    expect(regionRect('full')).toEqual([0, 0, 1, 1]);
  });
  it('falls back to the first style', () => {
    expect(styleOf('', STYLES.melody)).toBe('ribbon');
    expect(styleOf('nope', STYLES.pulse)).toBe('rings');
    expect(styleOf('beads', STYLES.melody)).toBe('beads');
  });
  it('triggers the scope on a rising zero crossing', () => {
    const w = new Float32Array(2048).map((_, i) => Math.sin(((i - 100) / 64) * Math.PI * 2));
    const i = trigger(w);
    expect(w[i - 1]).toBeLessThan(0);
    expect(w[i]).toBeGreaterThanOrEqual(0);
    expect(trigger(new Float32Array(2048))).toBe(0);
  });
});

/** The final pass's mirrorUv (src/stage/post.ts), in JS: the point of the frame that shows at `p`. */
function fold([x, y]: [number, number], mirror: number, aspect: number): [number, number] {
  if (mirror === 2) return [0.5 - Math.abs(x - 0.5), y];
  if (mirror === 4) return [0.5 - Math.abs(x - 0.5), 0.5 - Math.abs(y - 0.5)];
  if (mirror > 4) {
    const px = (x - 0.5) * aspect;
    const py = y - 0.5;
    const seg = (2 * Math.PI) / mirror;
    const t = Math.atan2(py, px) + Math.PI / 2;
    let a = t - seg * Math.floor(t / seg); // GLSL mod
    a = Math.abs(a - seg * 0.5) + Math.PI / 2 - seg * 0.5;
    const r = Math.hypot(px, py);
    return [(r * Math.cos(a)) / aspect + 0.5, r * Math.sin(a) + 0.5];
  }
  return [x, y];
}

describe('melody layout under a mirror', () => {
  const REGIONS: Region[] = ['full', 'top', 'bottom', 'left', 'right', 'center'];
  const MIRRORS = [1, 2, 4, 6, 8, 12];

  // A point is on screen where it was drawn exactly when the mirror shows it in place.
  it('draws the whole thread (head and 4 s of trail) where the mirror shows it', () => {
    for (const mirror of MIRRORS) {
      for (const region of REGIONS) {
        for (const aspect of [16 / 9, 4 / 3, 1, 9 / 16]) {
          const place = melodyLayout(region, mirror, aspect);
          for (let age = 0; age <= 4; age += 0.25) {
            for (let h = 0; h <= 1; h += 0.125) {
              const p = place(age, h);
              const q = fold(p, mirror, aspect);
              const where = `mirror ${mirror}, ${region}, aspect ${aspect.toFixed(2)}, age ${age}, height ${h}: (${p.map((v) => v.toFixed(3))})`;
              expect(Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]), where).toBeLessThan(1e-6);
              expect(Math.min(...p), where).toBeGreaterThanOrEqual(0);
              expect(Math.max(...p), where).toBeLessThanOrEqual(1);
            }
          }
        }
      }
    }
  });

  it('keeps the plain layout without a mirror: the head at 0.8 across the region, higher notes higher', () => {
    const place = melodyLayout('top', 1, 16 / 9);
    expect(place(0, 0)[0]).toBeCloseTo(0.8);
    expect(place(4, 0)[0]).toBeCloseTo(0);
    expect(place(0, 1)[1]).toBeGreaterThan(place(0, 0)[1]);
    expect(place(0, 0)[1]).toBeGreaterThanOrEqual(0.5);
  });

  it('puts the head on the seam under 2 and 4, and straight above the centre under a kaleidoscope', () => {
    for (const mirror of [2, 4]) for (const region of REGIONS) expect(melodyLayout(region, mirror, 16 / 9)(0, 0.5)[0]).toBeCloseTo(0.5);
    for (const mirror of [6, 8, 12]) {
      const place = melodyLayout('full', mirror, 16 / 9);
      expect(place(0, 0.5)[0]).toBeCloseTo(0.5);
      // Higher notes further out.
      expect(place(0, 1)[1]).toBeGreaterThan(place(0, 0)[1]);
      expect(place(0, 0)[1]).toBeGreaterThan(0.5);
    }
  });
});
