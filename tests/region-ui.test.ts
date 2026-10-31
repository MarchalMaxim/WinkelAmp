// lab/region-ui.js as the studio evaluates it: the global stays untouched, and tidy() gives regions the show keeps
// (validator ranges, −180..180°, four decimals). The gestures themselves run in a browser: npm run overlay-check.
import { describe, expect, it } from 'vitest';
import { repairRegion } from '../src/studio/show/show';
import { CANVAS_READERS, regionUi } from '../src/studio/ui/region-overlay';
import type { Region } from '../src/widgets/types';

describe('region-ui', () => {
  it('evaluates without setting a global', () => {
    const ui = regionUi();
    expect(typeof ui.mount).toBe('function');
    expect((globalThis as { WA_REGION_UI?: unknown }).WA_REGION_UI).toBeUndefined();
    expect(regionUi()).toBe(ui);
  });

  it('tidy keeps a region inside the show validator, unchanged by repairRegion', () => {
    const { tidy } = regionUi();
    const wild: Region = { mode: 'window', shape: 'ellipse', x: 2.3, y: -0.912345, w: 0.001, h: 3.5, rot: 200.500004, feather: 1.4, blend: 'lighten', fit: 'contain' };
    const t = tidy(wild);
    expect(t).toEqual({ mode: 'window', shape: 'ellipse', x: 1.5, y: -0.5, w: 0.02, h: 2, rot: -159.5, feather: 1, blend: 'lighten', fit: 'contain' });
    expect(repairRegion(t)).toEqual(t);
    expect(wild.x).toBe(2.3);   // never mutated
    expect(tidy({ mode: 'spot', shape: 'rect', x: 0.078125, y: 0.5, w: 0.3, h: 0.3 })).toEqual({ mode: 'spot', shape: 'rect', x: 0.0781, y: 0.5, w: 0.3, h: 0.3 });
    expect(tidy({ mode: 'spot', shape: 'rect', x: 0.5, y: 0.5, w: 0.3, h: 0.3, rot: 180 }).rot).toBe(180);
  });

  it('names the six canvas readers', () => {
    expect([...CANVAS_READERS].sort()).toEqual(['blocks', 'casket', 'fold', 'pixelsort', 'timeslice', 'tunnel']);
  });
});
