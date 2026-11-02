import { describe, expect, it } from 'vitest';
import { keyAction } from '../src/studio/ui/keys';
import { handleWidth, sameLayerIn } from '../src/studio/ui/timeline';
import type { Show } from '../src/studio/show/show';

const show = { sections: [
  { start: 0, end: 10, layers: [{ widget: 'squares' }, { widget: 'lazy' }] },
  { start: 10, end: 20, layers: [{ widget: 'lazy' }] },
  { start: 20, end: 30, layers: [{ widget: 'honey' }] },
] } as unknown as Show;

describe('moving the selection to another section', () => {
  it('keeps the same widget open if it plays there too', () => {
    expect(sameLayerIn(show, 0, 1, 1)).toBe(0);
  });
  it('closes it if it does not, or if nothing was open', () => {
    expect(sameLayerIn(show, 0, 1, 2)).toBeNull();
    expect(sameLayerIn(show, 0, null, 1)).toBeNull();
  });
});

describe('a boundary between two blocks', () => {
  it('is its usual width between wide blocks', () => {
    expect(handleWidth(200, 200)).toBe(24);
  });
  it('leaves the middle of a short block to click', () => {
    expect(handleWidth(20, 200)).toBe(10);
    expect(handleWidth(6, 200)).toBe(6);
  });
});

describe('the zoom keys', () => {
  const key = (k: string, o: Partial<KeyboardEvent> = {}) => ({ key: k, code: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...o });
  const free = { typing: false, control: false };
  it('+ and = in, − out, 0 the whole song', () => {
    expect(keyAction(key('='), free)).toEqual({ action: 'zoom', arg: 1 });
    expect(keyAction(key('+', { shiftKey: true }), free)).toEqual({ action: 'zoom', arg: 1 });
    expect(keyAction(key('-'), free)).toEqual({ action: 'zoom', arg: -1 });
    expect(keyAction(key('0'), free)).toEqual({ action: 'zoom', arg: 0 });
  });
  it('stay out of a field being typed in, and leave Ctrl+= to the browser', () => {
    for (const k of ['=', '+', '-', '0']) expect(keyAction(key(k), { typing: true, control: false })).toBeNull();
    expect(keyAction(key('=', { ctrlKey: true }), free)).toBeNull();
  });
});
