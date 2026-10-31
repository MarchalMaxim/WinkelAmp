import { describe, expect, it } from 'vitest';
import { ELEMENTS, STYLES, WIDGETS, widgetOf } from '../src/stage/elements';
import { DRIVES } from '../src/stage/kit';

describe('the widget registry', () => {
  it('holds the built-in cast, each type once', () => {
    const types = WIDGETS.map((w) => w.type);
    expect(types).toEqual(['melody', 'bass', 'sparks', 'bloom', 'pulse', 'wave', 'fluid', 'slash', 'drip']);
    expect(new Set(types).size).toBe(types.length);
  });

  it('derives STYLES and ELEMENTS from the widgets', () => {
    expect(Object.keys(STYLES)).toEqual(WIDGETS.map((w) => w.type));
    expect(STYLES.melody).toEqual(['ribbon', 'beads', 'ink']);
    expect(STYLES.slash).toEqual(['chords', 'every']);
    for (const w of WIDGETS) expect(ELEMENTS[w.type]).toBe(w.create);
  });

  it('looks a widget up by type, and nothing for an unknown one', () => {
    expect(widgetOf('drip')?.type).toBe('drip');
    expect(widgetOf('nope')).toBeUndefined();
  });

  it('keeps the draw order and the crisp set the stage had', () => {
    const order = [...WIDGETS].sort((a, b) => a.layer - b.layer).map((w) => w.type);
    expect(order).toEqual(['bloom', 'bass', 'drip', 'pulse', 'wave', 'sparks', 'melody', 'fluid', 'slash']);
    expect(WIDGETS.filter((w) => w.crisp).map((w) => w.type).sort()).toEqual(['melody', 'pulse', 'wave']);
  });

  it('casts like the director did: melody and pulse gated, sparks and bass by level, the rest always', () => {
    const s = { melodyVoiced: 0.5, bass: 0.3, pulse: 0.2, highActivity: 0.6 };
    const want = (t: string) => widgetOf(t)?.stream?.(s) ?? 1;
    expect(want('melody')).toBe(1);
    expect(want('pulse')).toBe(0);
    expect(want('sparks')).toBe(0.6);
    expect(want('bass')).toBe(0.3);
    expect(want('bloom')).toBe(1);
    expect(want('fluid')).toBe(1);
    expect(widgetOf('melody')?.stream?.({ ...s, melodyVoiced: 0.4 })).toBe(0);
    expect(widgetOf('pulse')?.stream?.({ ...s, pulse: 0.36 })).toBe(1);
  });

  describe.each(WIDGETS.map((w) => [w.type, w] as const))('%s', (_, w) => {
    it('documents itself for the cast table', () => {
      expect(w.follows.trim()).not.toBe('');
      expect(w.use.trim()).not.toBe('');
      expect(w.styles.length).toBeGreaterThan(0);
      for (const s of w.styles) {
        expect(s.name).toMatch(/^[a-z][a-z0-9-]*$/);
        expect(s.doc.trim()).not.toBe('');
      }
      expect(new Set(w.styleNames).size).toBe(w.styles.length);
    });

    it('declares sane knobs', () => {
      const names = w.knobs.map((k) => k.name);
      expect(new Set(names).size).toBe(names.length);
      for (const k of w.knobs) {
        expect(k.name).toMatch(/^[a-z][a-zA-Z0-9]*$/);
        expect(['intensity', 'size', 'region', 'color', 'style']).not.toContain(k.name);
        expect(k.max).toBeGreaterThan(k.min);
        expect(k.value).toBeGreaterThanOrEqual(k.min);
        expect(k.value).toBeLessThanOrEqual(k.max);
        expect(DRIVES).toContain(k.drive ?? '');
        expect(k.doc.trim()).not.toBe('');
      }
    });

    it('makes instances of its own type', () => {
      expect(w.create().type).toBe(w.type);
    });
  });
});
