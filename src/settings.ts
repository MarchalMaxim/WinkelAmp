import { DEFAULT_MAPPING, MOTIONS, SOURCES, type Mapping } from './mapping';
import { PALETTES } from './visual/color';

export const SCENE_IDS = ['bloom', 'swarm', 'ribbons', 'pulse'] as const;
export type SceneId = (typeof SCENE_IDS)[number];

export const MIRRORS = [1, 2, 4, 6, 8, 12] as const;

export interface Look {
  scene: SceneId;
  palette: string;
  /** Calm (0) ↔ Wild (1). */
  wild: number;
  /** Crisp (0) ↔ Dreamy (1). */
  trails: number;
  /** Still (0) ↔ Tunnel (1). */
  drift: number;
  /** Kaleidoscope segments; 1 = off. */
  mirror: number;
  mapping: Mapping;
}

export const DEFAULT_LOOK: Look = {
  scene: 'bloom',
  palette: 'notes',
  wild: 0.55,
  trails: 0.55,
  drift: 0.35,
  mirror: 1,
  mapping: DEFAULT_MAPPING,
};

export const cloneLook = (l: Look): Look => JSON.parse(JSON.stringify(l));

/** A tasteful random look: everything changes, nothing goes off the rails. */
export function surpriseLook(current: Look, rand = Math.random): Look {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const others = SCENE_IDS.filter((s) => s !== current.scene);
  const mapping = {} as Mapping;
  const lively = SOURCES.filter((s) => s.id !== 'none');
  for (const m of MOTIONS) {
    mapping[m.id] = { source: rand() < 0.1 ? 'none' : pick(lively).id, amount: 0.3 + rand() * 0.7 };
  }
  return {
    scene: pick(others),
    palette: pick(PALETTES).id,
    wild: 0.3 + rand() * 0.6,
    trails: 0.2 + rand() * 0.7,
    drift: rand() * 0.8,
    mirror: pick(MIRRORS),
    mapping,
  };
}

const STORE_KEY = 'winkelamp.looks.v1';
const CURRENT_KEY = 'winkelamp.current.v1';

export interface SavedLook {
  name: string;
  look: Look;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: looks just won't persist */
  }
}

export const loadSavedLooks = () => read<SavedLook[]>(STORE_KEY, []);
export const storeSavedLooks = (looks: SavedLook[]) => write(STORE_KEY, looks);

/** Restores the last look, filling in anything missing from older versions. */
export function loadCurrentLook(): Look {
  const saved = read<Partial<Look>>(CURRENT_KEY, {});
  return sanitizeLook({ ...cloneLook(DEFAULT_LOOK), ...saved, mapping: { ...DEFAULT_MAPPING, ...saved.mapping } });
}
export const storeCurrentLook = (look: Look) => write(CURRENT_KEY, look);

export function sanitizeLook(l: Look): Look {
  const clamp = (v: unknown, d: number) => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(1, v)) : d);
  return {
    scene: SCENE_IDS.includes(l.scene) ? l.scene : DEFAULT_LOOK.scene,
    palette: PALETTES.some((p) => p.id === l.palette) ? l.palette : DEFAULT_LOOK.palette,
    wild: clamp(l.wild, DEFAULT_LOOK.wild),
    trails: clamp(l.trails, DEFAULT_LOOK.trails),
    drift: clamp(l.drift, DEFAULT_LOOK.drift),
    mirror: (MIRRORS as readonly number[]).includes(l.mirror) ? l.mirror : 1,
    mapping: Object.fromEntries(
      MOTIONS.map((m) => {
        const r = l.mapping?.[m.id];
        const ok = r && SOURCES.some((s) => s.id === r.source);
        return [m.id, ok ? { source: r.source, amount: clamp(r.amount, 0.5) } : DEFAULT_MAPPING[m.id]];
      }),
    ) as Mapping,
  };
}
