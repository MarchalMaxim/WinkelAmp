import { describe, expect, it } from 'vitest';
import { hdContext, scaleFilter } from '../src/widgets/hd-context';

/** A fake 2D context that records calls and checks `this`, with a transform it keeps. */
function fake() {
  const calls: [string, ...unknown[]][] = [];
  const thisOk: boolean[] = [];
  const g = {
    shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, filter: 'none', lineWidth: 1, fillStyle: '#000',
    canvas: { width: 2560, height: 1440 },
    m: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    setTransform(...a: unknown[]) {
      thisOk.push(this === g); calls.push(['setTransform', ...a]);
      const [a0, b, c, d, e, f] = a as number[];
      g.m = { a: a0, b, c, d, e, f };
    },
    resetTransform() { thisOk.push(this === g); calls.push(['resetTransform']); g.m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; },
    getTransform() { thisOk.push(this === g); return { ...g.m }; },
    fillRect(...a: unknown[]) { thisOk.push(this === g); calls.push(['fillRect', ...a]); },
    getImageData() { return {}; },
    putImageData() { /* nothing */ },
  };
  return { g, calls, thisOk };
}
type Ctx = CanvasRenderingContext2D;

describe('hdContext', () => {
  it('is the context itself at scale 1', () => {
    const { g } = fake();
    expect(hdContext(g as unknown as Ctx, 1, () => 'w')).toBe(g);
  });

  it('composes setTransform and resetTransform with scale(S)', () => {
    const { g, calls } = fake();
    const p = hdContext(g as unknown as Ctx, 2, () => 'w');
    p.setTransform(1, 0, 0, 1, 10, 20);
    expect(calls.at(-1)).toEqual(['setTransform', 2, 0, 0, 2, 20, 40]);
    p.setTransform({ a: 0.5, b: 0.25, c: -0.25, d: 0.5, e: 3, f: 4 });
    expect(calls.at(-1)).toEqual(['setTransform', 1, 0.5, -0.5, 1, 6, 8]);
    p.setTransform({ m11: 1, m22: 1, m41: 5, m42: 6 });
    expect(calls.at(-1)).toEqual(['setTransform', 2, 0, 0, 2, 10, 12]);
    p.setTransform();
    expect(calls.at(-1)).toEqual(['setTransform', 2, 0, 0, 2, 0, 0]);
    p.resetTransform();
    expect(calls.at(-1)).toEqual(['setTransform', 2, 0, 0, 2, 0, 0]);
  });

  it('reads the transform back in 1280×720 units', () => {
    const { g } = fake();
    const p = hdContext(g as unknown as Ctx, 2, () => 'w');
    g.m = { a: 2, b: 0, c: 0, d: 2, e: 20, f: 40 };
    const m = p.getTransform();
    expect([m.a, m.b, m.c, m.d, m.e, m.f]).toEqual([1, 0, 0, 1, 10, 20]);
    expect(g.m.a).toBe(2);   // the target's own matrix is untouched
  });

  it('scales shadow lengths on set and divides on get', () => {
    const { g } = fake();
    const p = hdContext(g as unknown as Ctx, 2, () => 'w');
    p.shadowBlur = 8; p.shadowOffsetX = 3; p.shadowOffsetY = -1.5;
    expect([g.shadowBlur, g.shadowOffsetX, g.shadowOffsetY]).toEqual([16, 6, -3]);
    expect([p.shadowBlur, p.shadowOffsetX, p.shadowOffsetY]).toEqual([8, 3, -1.5]);
  });

  it('scales the px lengths of filter, and reads back the string as set', () => {
    const { g } = fake();
    const p = hdContext(g as unknown as Ctx, 2, () => 'w');
    p.filter = 'blur(4px) drop-shadow(1px 2px 3px #000)';
    expect(g.filter).toBe('blur(8px) drop-shadow(2px 4px 6px #000)');
    expect(p.filter).toBe('blur(4px) drop-shadow(1px 2px 3px #000)');
    g.filter = 'none';   // the runtime resets the real context between widgets
    expect(p.filter).toBe('none');
  });

  it('throws, naming the widget, on reading or writing the shared canvas\'s pixels', () => {
    const { g } = fake();
    const p = hdContext(g as unknown as Ctx, 2, () => 'casket');
    expect(() => p.getImageData(0, 0, 1, 1)).toThrow(/casket reads the shared canvas's pixels: adapt it for scale 2/);
    expect(() => p.putImageData({} as ImageData, 0, 0)).toThrow(/casket/);
  });

  it('calls methods with this = the target, and passes other properties through', () => {
    const { g, calls, thisOk } = fake();
    const p = hdContext(g as unknown as Ctx, 3, () => 'w');
    p.fillRect(1, 2, 3, 4);
    const fr = p.fillRect; fr.call(null, 5, 6, 7, 8);   // detached, as `const f = x.g.fillRect` would be
    p.setTransform(1, 0, 0, 1, 0, 0); p.getTransform(); p.resetTransform();
    expect(thisOk.every(Boolean)).toBe(true);
    expect(calls.filter((c) => c[0] === 'fillRect')).toEqual([['fillRect', 1, 2, 3, 4], ['fillRect', 5, 6, 7, 8]]);
    p.lineWidth = 2.5; p.fillStyle = '#fff';
    expect([g.lineWidth, g.fillStyle, p.lineWidth]).toEqual([2.5, '#fff', 2.5]);
    expect(p.canvas).toBe(g.canvas);
  });
});

describe('scaleFilter', () => {
  it('scales every px length and leaves the rest', () => {
    expect(scaleFilter('none', 2)).toBe('none');
    expect(scaleFilter('blur(2.5px)', 2)).toBe('blur(5px)');
    expect(scaleFilter('blur(.5px) brightness(1.2) contrast(150%)', 3)).toBe('blur(1.5px) brightness(1.2) contrast(150%)');
    expect(scaleFilter('drop-shadow(-1px 0px 4px rgba(0,0,0,0.5))', 2)).toBe('drop-shadow(-2px 0px 8px rgba(0,0,0,0.5))');
    expect(scaleFilter('blur(4px)', 1)).toBe('blur(4px)');
  });
});
