/**
 * Color helpers for the character engine. Everything is linear RGB (what the
 * Living Canvas blends and blooms in); hex/HSL inputs are sRGB and get decoded.
 *
 * The emotional color modulation follows Palmer, Schloss, Xu & Prado-León (2013,
 * PNAS, "Music–color associations are mediated by emotion"): faster / major music
 * is matched with lighter, more saturated, yellower colors; slower / minor music
 * with darker, desaturated, bluer ones; arousal tracks saturation and redness.
 */
import type { Rgb } from './types';
import { fifthsPosition } from '../visual/color';

export type Palette = [Rgb, Rgb, Rgb, Rgb];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** sRGB transfer function, decoded (0..1 → linear 0..1). */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** '#rrggbb' → linear RGB. */
export function hex(h: string): Rgb {
  const n = parseInt(h.replace('#', ''), 16);
  return [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255)];
}

/** Relative luminance (Rec. 709 primaries) of a linear RGB color. */
export const luma = (c: Rgb) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** HSL (h in degrees, s/l 0..1, sRGB space) → linear RGB. */
export function hslLinear(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [srgbToLinear(f(0)), srgbToLinear(f(8)), srgbToLinear(f(4))];
}

/** Synesthetic note color (circle of fifths around the hue wheel, C = red), linear RGB. */
export function noteRgb(note: number): Rgb {
  return hslLinear(fifthsPosition(note) * 360, 0.85, 0.55);
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Samples a 4-stop palette at t (0 = shadow … 1 = highlight), piecewise linear. */
export function samplePalette(p: Palette, t: number): Rgb {
  const x = clamp01(t) * 3;
  const i = Math.min(2, Math.floor(x));
  return mixRgb(p[i], p[i + 1], x - i);
}

/**
 * Pulls `base` towards the hue of `tint` by `amount`, keeping base's luminance:
 * the note colors an event without changing how bright the palette wants it.
 */
export function tintKeepLuma(base: Rgb, tint: Rgb, amount: number): Rgb {
  const lb = luma(base);
  const lt = Math.max(1e-6, luma(tint));
  const scaled: Rgb = [(tint[0] * lb) / lt, (tint[1] * lb) / lt, (tint[2] * lb) / lt];
  const m = mixRgb(base, scaled, clamp01(amount));
  return [clamp01(m[0]), clamp01(m[1]), clamp01(m[2])];
}

/**
 * Applies the Palmer et al. emotion → color effect to a palette, bounded so the
 * archetype's identity survives (Abyss stays dark, Sugar stays pastel):
 *  - valence ↑ → lighter (×0.75 … ×1.33 luminance) and yellower;
 *  - arousal ↑ → more saturated (×0.7 … ×1.3 chroma) and warmer (redder).
 * Stops stay monotone in luminance from shadow to highlight.
 */
export function moodPalette(base: Palette, valence: number, energy: number): Palette {
  const v = Math.max(-1, Math.min(1, valence));
  const e = clamp01(energy);
  const light = 2 ** (0.42 * v);
  const sat = 0.7 + 0.6 * e;
  // Multiplicative tints: yellow = +R +G −B, warm = +R −B.
  const ky = 0.07 * v;
  const kw = 0.14 * (e - 0.4);
  const tint: Rgb = [1 + ky + kw, 1 + ky * 0.8, Math.max(0.2, 1 - ky * 1.6 - kw * 1.4)];
  const out = base.map((c) => {
    const y = luma(c);
    let r = (y + (c[0] - y) * sat) * tint[0];
    let g = (y + (c[1] - y) * sat) * tint[1];
    let b = (y + (c[2] - y) * sat) * tint[2];
    // Saturation and tint must not change brightness; only `light` does.
    const y2 = Math.max(1e-6, 0.2126 * r + 0.7152 * g + 0.0722 * b);
    const k = (y * light) / y2;
    r = clamp01(Math.max(0, r * k));
    g = clamp01(Math.max(0, g * k));
    b = clamp01(Math.max(0, b * k));
    return [r, g, b] as Rgb;
  }) as Palette;
  // Clipping near white can reorder stops; lift any stop that fell below its predecessor.
  for (let i = 1; i < 4; i++) {
    const prev = luma(out[i - 1]);
    const cur = luma(out[i]);
    if (cur < prev * 1.05 + 1e-4) {
      const need = prev * 1.05 + 1e-4;
      const c = out[i];
      // Lift by mixing towards white (always increases luminance, keeps hue roughly).
      const t = clamp01((need - cur) / Math.max(1e-6, 1 - cur));
      out[i] = mixRgb(c, [1, 1, 1], t);
    }
  }
  return out;
}
