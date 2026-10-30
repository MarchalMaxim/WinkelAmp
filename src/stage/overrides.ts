/**
 * What the user has taken over from the show. A tweak in the drawer pins that
 * parameter for the rest of the song (the script or the director still decide
 * everything else); picking a scene pauses the script: the stage then shows the
 * user's whole look and holds a cast (the last one shown, or the scene picked)
 * until the user resumes. A new track starts afresh (`reset`).
 *
 *   const look = overrides.apply(directives, stageLook(userLook));   // every frame
 */
import type { Look as UserLook } from '../settings';
import { PALETTES } from '../visual/color';
import { DEFAULT_LOOK, type CastMember, type Look, type StageDirectives } from './types';

export type Pinnable = 'palette' | 'trails' | 'mirror' | 'warp';

/** Lightness (%) of the four stage stops, shadow → highlight: a v1 palette is four hues at about one lightness. */
const RAMP = [24, 46, 62, 80];

const hex = (h: number, s: number, l: number) => {
  // HSL → sRGB (CSS's formula), as #rrggbb.
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

/**
 * The drawer's look (v1 settings) as the stage's: `drift` is the stage's warp; a
 * v1 palette becomes four fixed colors, its stops ordered dark to light; 'notes'
 * stays 'notes'. Glow has no knob in the drawer, so it keeps the stage default.
 */
export function stageLook(l: UserLook): Look {
  const def = PALETTES.find((p) => p.id === l.palette);
  let palette: Look['palette'] = 'notes';
  if (def && def.stops.length) {
    const stops = [...def.stops].sort((x, y) => x[2] - y[2]).slice(0, 4);
    while (stops.length < 4) stops.push(stops[stops.length - 1]);
    palette = stops.map(([h, s], i) => hex(h, s, RAMP[i])) as [string, string, string, string];
  }
  return { palette, trails: l.trails, warp: l.drift, mirror: l.mirror as Look['mirror'], glow: DEFAULT_LOOK.glow };
}

const copyPalette = (p: Look['palette']): Look['palette'] => (Array.isArray(p) ? [...p] as Look['palette'] : p);

export class Overrides {
  readonly pinned = new Set<Pinnable>();
  scriptPaused = false;
  /** The scene and cast shown while paused: the last unpaused frame's, or the one picked. */
  private held: { scene: string; cast: CastMember[] } = { scene: '', cast: [] };

  pin(k: Pinnable): void {
    this.pinned.add(k);
  }

  /** Stops following the script (or the director). `hold` is the cast to show instead of the last one. */
  pauseScript(hold?: { scene: string; cast: CastMember[] }): void {
    this.scriptPaused = true;
    if (hold) this.held = { scene: hold.scene, cast: hold.cast.map((m) => ({ spec: m.spec, presence: m.presence })) };
  }

  resume(): void {
    this.scriptPaused = false;
  }

  /** A new track: no pins, the script runs. */
  reset(): void {
    this.pinned.clear();
    this.scriptPaused = false;
    this.held = { scene: '', cast: [] };
  }

  /** The directives with the user's choices laid over them. Never mutates `dir` or `userLook`. */
  apply(dir: StageDirectives, userLook: Look): StageDirectives {
    if (this.scriptPaused) {
      return {
        source: dir.source,
        scene: this.held.scene,
        look: { ...userLook, palette: copyPalette(userLook.palette) },
        cast: this.held.cast.map((m) => ({ spec: m.spec, presence: m.presence })),
        accents: [],
      };
    }
    this.held = { scene: dir.scene, cast: dir.cast.map((m) => ({ spec: m.spec, presence: m.presence })) };
    if (!this.pinned.size) return dir;
    const look: Look = { ...dir.look, palette: copyPalette(dir.look.palette) };
    if (this.pinned.has('palette')) look.palette = copyPalette(userLook.palette);
    if (this.pinned.has('trails')) look.trails = userLook.trails;
    if (this.pinned.has('mirror')) look.mirror = userLook.mirror;
    if (this.pinned.has('warp')) look.warp = userLook.warp;
    return { ...dir, look };
  }
}
