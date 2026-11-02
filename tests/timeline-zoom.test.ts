import { describe, expect, it } from 'vitest';
import { keyAction } from '../src/studio/ui/keys';

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
