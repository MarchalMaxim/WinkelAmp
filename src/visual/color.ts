/**
 * Synesthetic color: notes become hues.
 *
 * Pitch classes are laid out on the color wheel in circle-of-fifths order, so
 * harmonically related notes (C, G, D…) get neighboring hues and a key change
 * shifts the whole mood of the picture.
 */

export interface PaletteDef {
  id: string;
  name: string;
  /** Color stops, as [h, s, l]; empty means "pure synesthesia" (notes → full wheel). */
  stops: [number, number, number][];
}

export const PALETTES: PaletteDef[] = [
  { id: 'notes', name: 'Notes', stops: [] },
  { id: 'sunset', name: 'Sunset', stops: [[340, 85, 55], [15, 95, 58], [42, 100, 60], [280, 70, 55]] },
  { id: 'ocean', name: 'Ocean', stops: [[190, 90, 50], [215, 85, 58], [165, 80, 50], [250, 70, 65]] },
  { id: 'neon', name: 'Neon', stops: [[300, 100, 60], [180, 100, 55], [90, 100, 55], [55, 100, 60]] },
  { id: 'ink', name: 'Ink', stops: [[220, 15, 85], [200, 30, 70], [40, 30, 80], [0, 0, 95]] },
];

/** Position (0..1) of a pitch class on the circle of fifths. C = 0. */
export function fifthsPosition(note: number): number {
  // Continuous note → continuous position: interpolate between neighbors.
  const n = ((note % 12) + 12) % 12;
  const lo = Math.floor(n);
  const t = n - lo;
  const a = ((lo * 7) % 12) / 12;
  const b = ((((lo + 1) % 12) * 7) % 12) / 12;
  let d = b - a;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return (a + d * t + 1) % 1;
}

/** Hue in degrees for a note, in the pure "Notes" palette. C is red. */
export function noteHue(note: number): number {
  return fifthsPosition(note) * 360;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** Samples a palette at t (0..1, wraps). */
export function paletteColor(palette: PaletteDef, t: number): Hsl {
  t = ((t % 1) + 1) % 1;
  if (palette.stops.length === 0) return { h: t * 360, s: 90, l: 58 };
  const n = palette.stops.length;
  const x = t * n;
  const i = Math.floor(x) % n;
  const j = (i + 1) % n;
  const f = x - Math.floor(x);
  const [h1, s1, l1] = palette.stops[i];
  const [h2, s2, l2] = palette.stops[j];
  let dh = h2 - h1;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return { h: (h1 + dh * f + 360) % 360, s: s1 + (s2 - s1) * f, l: l1 + (l2 - l1) * f };
}

/**
 * The color a sound "is": palette position from the note, desaturated when the
 * sound is noisy (drums turn into white sparks), brighter when loud.
 */
export function soundColor(
  palette: PaletteDef,
  note: number,
  tonality: number,
  level: number,
  offset = 0,
): Hsl {
  const c = paletteColor(palette, fifthsPosition(note) + offset);
  const sat = c.s * (0.35 + 0.65 * Math.min(1, tonality * 1.4));
  const light = Math.min(85, c.l * (0.75 + 0.45 * level));
  return { h: c.h, s: sat, l: light };
}

export const hsl = (c: Hsl, alpha = 1) =>
  `hsla(${c.h.toFixed(1)},${c.s.toFixed(1)}%,${c.l.toFixed(1)}%,${alpha.toFixed(3)})`;

export const NOTE_COLORS_CSS = (palette: PaletteDef) =>
  Array.from({ length: 12 }, (_, i) => hsl(soundColor(palette, i, 1, 0.8)));
