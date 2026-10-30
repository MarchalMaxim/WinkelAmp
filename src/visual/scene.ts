import type { Features } from '../audio/features';
import type { Motion } from '../mapping';
import { soundColor, type Hsl, type PaletteDef } from './color';

export interface Frame {
  /** Layer context; origin is the center of the screen, units are CSS pixels. */
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** Radius of the largest circle that fits. */
  r: number;
  f: Features;
  m: Motion;
  palette: PaletteDef;
  dt: number;
  t: number;
  /** Where the user is pressing, in layer coordinates (folded into the first mirror wedge). */
  pointer: { x: number; y: number; down: boolean };
}

export interface Scene {
  id: string;
  name: string;
  draw(fr: Frame): void;
}

/** The color of the sound right now, optionally offset along the palette. */
export function colorNow(fr: Frame, offset = 0, note = fr.f.noteSmooth): Hsl {
  return soundColor(fr.palette, note, fr.f.tonality, fr.f.level, offset + (fr.m.colorShift - 0.15) * 0.25);
}
