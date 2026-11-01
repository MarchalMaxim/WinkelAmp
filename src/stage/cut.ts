/**
 * The casket's two violences, as pure geometry the post pass mirrors in GLSL:
 *
 *   cut   the picture sliced along a straight line, the two halves shoved apart
 *         along it (one side +d, the other −d) once, on the frame of the attack;
 *         a thin pale-yellow scar flashes on the line and fades over SCAR_LIFE
 *   melt  the picture sliding down in thin columns, each at its own slowly
 *         varying speed, so it drips off the screen
 *
 * Both act on the feedback history, so whatever is already on screen carries the
 * scar and runs. Sizes are in screen heights (any canvas size looks the same) and
 * shifts are whole texels (an exact read: a frozen picture never blurs).
 */
import type { Accent } from './types';

/** A cut: a point (uv, y up), the line's unit direction in aspect space (x scaled by the aspect), the shove in screen heights. */
export interface Cut {
  x: number;
  y: number;
  dx: number;
  dy: number;
  d: number;
}

/** A cut on screen: the line, its scar color (sRGB 0..1), strength and age in music seconds. */
export interface Scar {
  cut: Cut;
  color: [number, number, number];
  strength: number;
  age: number;
}

/** The sketch's sickly pale yellow, rgb(235, 240, 170), sRGB 0..1 like accent colors. */
export const CUT_COLOR: [number, number, number] = [235 / 255, 240 / 255, 170 / 255];
/** Music seconds a scar takes to fade. */
export const SCAR_LIFE = 0.9;
/** The shove at strength 0 and 1: the sketch's 14…40 px at 720 px high. */
const SHOVE: [number, number] = [14 / 720, 40 / 720];
/** A script's cut accent slices only if the stage sees it this young (song seconds): a seek into one doesn't slice late. */
const FRESH = 0.1;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : Number.isFinite(v) ? v : 0);

/**
 * A random cut that the mirror shows. The final pass keeps one part of the
 * picture and reflects it (2: the left half, 4: the bottom-left quarter, 6 and up
 * a wedge just right of straight up), so the point goes in the middle of that part,
 * clear of the seams, or the slice would happen off screen. Without a mirror: the
 * middle half of the picture, as in the sketch. The line's angle is anything
 * within ±1.2 rad of horizontal or of vertical.
 */
export function cutAt(rand: () => number, mirror: number, aspect: number, strength: number, scale = 1): Cut {
  let x: number;
  let y: number;
  if (mirror > 4) {
    const half = Math.PI / mirror;
    const a = Math.PI / 2 - half * (0.2 + 0.6 * rand());
    const r = 0.12 + 0.28 * rand();
    x = 0.5 + (r * Math.cos(a)) / aspect;
    y = 0.5 + r * Math.sin(a);
  } else {
    x = mirror >= 2 ? 0.1 + 0.3 * rand() : 0.25 + 0.5 * rand();
    y = mirror === 4 ? 0.1 + 0.3 * rand() : 0.25 + 0.5 * rand();
  }
  const ang = rand() * 2.4 - 1.2 + (rand() < 0.5 ? 0 : Math.PI / 2);
  const d = (SHOVE[0] + (SHOVE[1] - SHOVE[0]) * clamp01(strength)) * (Number.isFinite(scale) ? Math.max(0, scale) : 1);
  return { x, y, dx: Math.cos(ang), dy: Math.sin(ang), d };
}

/** Which side of the cut (u, v) is on: +1 or −1. */
export function cutSide(c: Cut, u: number, v: number, aspect: number): 1 | -1 {
  return c.dx * (v - c.y) - c.dy * (u - c.x) * aspect >= 0 ? 1 : -1;
}

/**
 * How far the picture at (u, v) moves in texels on a render target `h` texels
 * high: d along the line, one way on each side, rounded to whole texels. The
 * content at (u, v) afterwards is what was at (u, v) − shift.
 */
export function cutShift(c: Cut, u: number, v: number, aspect: number, h: number): [number, number] {
  const s = cutSide(c, u, v, aspect) * c.d * h;
  return [Math.round(s * c.dx), Math.round(s * c.dy)];
}

/**
 * The script's cut accents that slice now: each once, on the first frame music time
 * moves while it is young. `seen` holds the fire times already sliced and forgets
 * those no longer listed, so a pause never slices twice and a seek back replays it.
 */
export function freshCuts(accents: readonly Accent[], seen: Set<number>, musicDt: number): Accent[] {
  const listed = new Set<number>();
  const out: Accent[] = [];
  for (const a of accents) {
    if (a.kind !== 'cut') continue;
    listed.add(a.at);
    if (seen.has(a.at) || !(musicDt > 0) || !(a.age <= FRESH)) continue;
    seen.add(a.at);
    out.push(a);
  }
  for (const k of seen) if (!listed.has(k)) seen.delete(k);
  return out;
}

/** Columns across the picture (≈ 10 px at 1280 wide, as in the sketch). */
export const MELT_COLUMNS = 128;

/**
 * A column's melting speed at melt 1, screen heights per music second: smooth
 * waves over the columns and music time, 0 … ≈ 0.37 (the sketch's 0 … 4.4 px a
 * frame at 60 fps, 720 px high). Mirrored in post.ts's FEEDBACK.
 */
export function meltSpeed(col: number, time: number): number {
  return 0.1833 * (1 + 0.5 * Math.sin(col * 0.37 + time * 0.7) + 0.5 * Math.sin(col * 1.1));
}

/**
 * Whole texels column `col` moves down this frame on a target `h` texels high.
 * `jitter` (0..1, a hash per column and frame in the shader) rounds stochastically,
 * so slow columns still move on average and every read is texel-exact. No music
 * time, or no melt: exactly 0.
 */
export function meltShift(col: number, time: number, melt: number, musicDt: number, h: number, jitter: number): number {
  if (!(musicDt > 0) || !(melt > 0)) return 0;
  return Math.floor(clamp01(melt) * musicDt * meltSpeed(col, time) * h + Math.min(0.999, Math.max(0, jitter)));
}
