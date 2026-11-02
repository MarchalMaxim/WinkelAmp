import { describe, expect, it } from 'vitest';
import { keyAction } from '../src/studio/ui/keys';
import { rankWidgets } from '../src/studio/ui/widget-palette';
import type { WidgetMeta } from '../src/widgets/types';

const meta = (id: string, name: string, feel: string[] = [], instruments: string[] = [], blurb = ''): WidgetMeta =>
  ({ id, name, blurb, tag: '', verdict: null, params: [], tags: { feel, instruments } }) as unknown as WidgetMeta;

const metas = [
  meta('miro', 'Miró', ['playful', 'airy'], ['flute']),
  meta('gust', 'Brass gust', ['powerful'], ['trumpet']),
  meta('lazy', 'Lazy', ['lazy', 'green', 'heavy'], ['bassoon'], 'It cannot be bothered.'),
  meta('honey', 'Honey', ['slow', 'heavy']),
  meta('flee', 'Skittish shapes', ['playful']),
];
const ids = (q: string) => rankWidgets(metas, q).map((m) => m.id);

describe('rankWidgets', () => {
  it('with nothing typed: all of them, in the order given', () => {
    expect(ids('')).toEqual(metas.map((m) => m.id));
    expect(ids('   ')).toEqual(metas.map((m) => m.id));
  });
  it('finds a name from its first letters, any case, and a later word of it', () => {
    expect(ids('la')[0]).toBe('lazy');
    expect(ids('LAZ')[0]).toBe('lazy');
    expect(ids('gust')).toEqual(['gust']);
  });
  it('finds by the letters that start its words', () => {
    expect(ids('bg')).toEqual(['gust']);
  });
  it('puts a name above a feel word above an instrument', () => {
    expect(ids('heavy')).toEqual(['lazy', 'honey']);
    expect(ids('tr')[0]).toBe('gust');           // trumpet
  });
  it('needs every typed word to fit', () => {
    expect(ids('heavy green')).toEqual(['lazy']);
    expect(ids('heavy flute')).toEqual([]);
  });
  it('reads the blurb only as a last resort, and not for one or two letters', () => {
    expect(ids('bothered')).toEqual(['lazy']);
    expect(ids('zz')).toEqual([]);
  });
});

describe('Ctrl+P', () => {
  const key = (k: string, o: Partial<KeyboardEvent> = {}) => ({ key: k, code: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...o });
  it('opens the palette, also while typing, never with Shift (the browser keeps that)', () => {
    for (const typing of [false, true]) {
      const focus = { typing, control: false };
      expect(keyAction(key('p', { ctrlKey: true }), focus)).toEqual({ action: 'palette' });
      expect(keyAction(key('P', { metaKey: true }), focus)).toEqual({ action: 'palette' });
      expect(keyAction(key('P', { ctrlKey: true, shiftKey: true }), focus)).toBeNull();
    }
    expect(keyAction(key('p'), { typing: false, control: false })).toBeNull();
  });
});
