/**
 * Test harness for the Living Canvas (living-test.html): drives it with synthetic
 * Materials and SoundEvents for each archetype, so the renderer can be judged on
 * its own before the character engine exists. URL parameters:
 *   m=fire | m=fire:0.5,abyss:0.5   material (or a blend)
 *   ev=own | neutral                 archetype-typical events, or one identical stream for all
 *   presets=engine                   the character engine's real archetype Materials (default: test ones)
 *   lowp=1                            force the RGBA8 fallback
 *   level=0..4                        pin the quality level
 *   seed=N                            emission seed
 */
import { emptyFeatures } from '../../audio/features';
import { neutralDescriptors, type ArchetypeId, type Gesture, type LivingInput, type Material, type Rgb, type SoundEvent } from '../../character/types';
import { ARCHETYPES } from '../../character/archetypes';
import { MATERIAL_KEYS, rng } from './emit';
import { LivingCanvas } from './living';

const P = (a: Rgb, b: Rgb, c: Rgb, d: Rgb): Material['palette'] => [a, b, c, d];

/** Test Materials, one per archetype. The real presets come from the character engine. */
export const TEST_MATERIALS: Record<ArchetypeId, Material> = {
  fire: {
    buoyancy: 0.9, gravity: 0, vorticity: 0.85, viscosity: 0.05, dyeFade: 0.75, splatSize: 0.35, splatForce: 0.7,
    jitter: 0.8, sparkAmount: 0.6, sparkSize: 0.55, sparkLife: 0.45, twinkle: 0.35, angularity: 0.55, emissive: 0.9,
    contrast: 0.7, grain: 0.25, aura: 0.15,
    palette: P([0.01, 0, 0], [0.5, 0.04, 0], [1, 0.35, 0.02], [1, 0.9, 0.55]),
  },
  abyss: {
    buoyancy: 0, gravity: 0.8, vorticity: 0.15, viscosity: 0.85, dyeFade: 0.12, splatSize: 0.95, splatForce: 0.45,
    jitter: 0.1, sparkAmount: 0.02, sparkSize: 0.3, sparkLife: 0.3, twinkle: 0, angularity: 0.05, emissive: 0.15,
    contrast: 0.9, grain: 0.35, aura: 0.25,
    palette: P([0, 0, 0.008], [0.03, 0.015, 0.09], [0.2, 0.025, 0.06], [0.36, 0.3, 0.42]),
  },
  sugar: {
    buoyancy: 0.15, gravity: 0.05, vorticity: 0.35, viscosity: 0.1, dyeFade: 0.85, splatSize: 0.08, splatForce: 0.75,
    jitter: 0.4, sparkAmount: 1, sparkSize: 0.12, sparkLife: 0.35, twinkle: 0.95, angularity: 0.85, emissive: 0.7,
    contrast: 0.45, grain: 0.1, aura: 0.3,
    palette: P([0.02, 0.02, 0.06], [0.45, 0.35, 0.85], [0.95, 0.55, 0.85], [0.85, 1, 1]),
  },
  mist: {
    buoyancy: 0.1, gravity: 0, vorticity: 0.2, viscosity: 0.5, dyeFade: 0.25, splatSize: 0.8, splatForce: 0.15,
    jitter: 0.15, sparkAmount: 0, sparkSize: 0.3, sparkLife: 0.8, twinkle: 0.1, angularity: 0, emissive: 0.45,
    contrast: 0.15, grain: 0.05, aura: 0.6,
    palette: P([0.04, 0.06, 0.1], [0.3, 0.45, 0.75], [0.85, 0.6, 0.85], [0.9, 0.95, 1]),
  },
  gold: {
    buoyancy: 0.3, gravity: 0, vorticity: 0.3, viscosity: 0.3, dyeFade: 0.5, splatSize: 0.75, splatForce: 0.6,
    jitter: 0.1, sparkAmount: 0.35, sparkSize: 0.4, sparkLife: 0.55, twinkle: 0.4, angularity: 0.2, emissive: 1,
    contrast: 0.55, grain: 0.1, aura: 0.35,
    palette: P([0.03, 0.015, 0], [0.5, 0.25, 0.02], [1, 0.7, 0.2], [1, 0.97, 0.85]),
  },
  storm: {
    buoyancy: 0.05, gravity: 0.1, vorticity: 1, viscosity: 0.05, dyeFade: 0.55, splatSize: 0.5, splatForce: 1,
    jitter: 0.9, sparkAmount: 0.3, sparkSize: 0.2, sparkLife: 0.2, twinkle: 0.7, angularity: 0.7, emissive: 0.6,
    contrast: 0.85, grain: 0.4, aura: 0.2,
    palette: P([0.01, 0.01, 0.03], [0.12, 0.12, 0.3], [0.35, 0.3, 0.7], [0.9, 0.92, 1]),
  },
  machine: {
    buoyancy: 0, gravity: 0, vorticity: 0.2, viscosity: 0.2, dyeFade: 0.8, splatSize: 0.35, splatForce: 0.6,
    jitter: 0.03, sparkAmount: 0.4, sparkSize: 0.25, sparkLife: 0.3, twinkle: 0.2, angularity: 0.95, emissive: 0.85,
    contrast: 0.8, grain: 0.15, aura: 0.2,
    palette: P([0, 0.01, 0.03], [0, 0.3, 0.45], [0.9, 0.1, 0.75], [0.6, 1, 1]),
  },
  lament: {
    buoyancy: 0, gravity: 0.4, vorticity: 0.1, viscosity: 0.7, dyeFade: 0.3, splatSize: 0.55, splatForce: 0.2,
    jitter: 0.1, sparkAmount: 0.12, sparkSize: 0.15, sparkLife: 0.9, twinkle: 0.2, angularity: 0.1, emissive: 0.3,
    contrast: 0.35, grain: 0.3, aura: 0.35,
    palette: P([0.02, 0.025, 0.035], [0.12, 0.15, 0.22], [0.35, 0.4, 0.5], [0.7, 0.75, 0.82]),
  },
};

/** The character engine's own archetype Materials: what the app will actually show. */
export const ENGINE_MATERIALS = Object.fromEntries(
  Object.values(ARCHETYPES).map((a) => [a.id, { ...a.material, palette: a.palette.map((c) => [...c]) as Material['palette'] }]),
) as Record<ArchetypeId, Material>;

export function blendMaterials(parts: { m: Material; w: number }[]): Material {
  const total = parts.reduce((s, p) => s + p.w, 0) || 1;
  const out = JSON.parse(JSON.stringify(parts[0].m)) as Material;
  const o = out as unknown as Record<string, number>;
  for (const k of Object.keys(o)) if (typeof o[k] === 'number') o[k] = 0;
  out.palette = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const { m, w } of parts) {
    const src = m as unknown as Record<string, number>;
    for (const k of Object.keys(o)) if (typeof o[k] === 'number') o[k] += (src[k] * w) / total;
    for (let i = 0; i < 4; i++) for (let c = 0; c < 3; c++) out.palette[i][c] += (m.palette[i][c] * w) / total;
  }
  return out;
}

/** Note → color around the circle of fifths (linear RGB). */
function noteColor(note: number, sat = 0.8): Rgb {
  const h = ((note * 7) % 12) / 12;
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return 1 - sat * Math.max(0, Math.min(1, Math.min(k, 4 - k)));
  };
  return [f(5) ** 2.2, f(3) ** 2.2, f(1) ** 2.2];
}

/** Synthetic event streams that sound (on paper) like each archetype. */
type Gen = (t: number, dt: number, r: () => number) => SoundEvent[];
const ev = (height: number, pan: number, strength: number, note: number, onset = true): SoundEvent =>
  ({ height, pan, strength, note, color: noteColor(note), onset });

function poisson(rate: number, dt: number, r: () => number) {
  return r() < rate * dt;
}

/** Wraps a generator so onsets can hold their note: held notes emit sustained events every frame. */
function withHolds(gen: (t: number, dt: number, r: () => number, hold: (e: SoundEvent, secs: number) => void) => SoundEvent[]): Gen {
  const held: { e: SoundEvent; end: number }[] = [];
  return (t, dt, r) => {
    const out = gen(t, dt, r, (e, secs) => held.push({ e: { ...e, onset: false }, end: t + secs }));
    for (let i = held.length - 1; i >= 0; i--) {
      if (held[i].end < t) held.splice(i, 1);
      else out.push(held[i].e);
    }
    return out;
  };
}

function makeGen(kind: string): Gen {
  let next = 0;
  let k = 0;
  switch (kind) {
    case 'fire': // frequent, erratic, mid-high, sharp
      return (_t, dt, r) => (poisson(7, dt, r) ? [ev(0.25 + r() * 0.5, r() * 2 - 1, 0.4 + r() * 0.6, Math.floor(r() * 12))] : []);
    case 'abyss': // rare, huge, low chords that ring on
      return withHolds((t, _dt, r, hold) => {
        if (t < next) return [];
        next = t + 1.4 + r() * 1.2;
        const e = ev(0.03 + r() * 0.12, r() * 1.2 - 0.6, 0.85 + r() * 0.15, [1, 4, 8][k++ % 3]);
        hold({ ...e, strength: 0.6 }, 1.2);
        return [e];
      });
    case 'sugar': // frequent, tiny, high, quick, regular-ish
      return (t, _dt, r) => {
        if (t < next) return [];
        next = t + 0.1 + (r() < 0.2 ? 0.1 : 0);
        k++;
        return [ev(0.68 + r() * 0.28, Math.sin(k * 1.9) * 0.85, 0.3 + r() * 0.35, [11, 7, 4, 2, 9][k % 5])];
      };
    case 'mist': // soft entries, long sustained notes
      return withHolds((t, _dt, r, hold) => {
        if (t < next) return [];
        next = t + 0.6 + r() * 0.6;
        const e = ev(0.3 + r() * 0.45, r() * 1.6 - 0.8, 0.25, [0, 4, 7, 11][Math.floor(r() * 4)]);
        hold({ ...e, strength: 0.5 }, 2 + r() * 1.5);
        return [e];
      });
    case 'gold': // steady strong pulse, ringing chords
      return withHolds((t, _dt, _r, hold) => {
        if (t < next) return [];
        next = (next || t) + 0.5;
        k++;
        const e = ev(0.4 + (k % 2) * 0.15, (k % 3 - 1) * 0.35, 0.9, [7, 2, 11][k % 3]);
        hold({ ...e, strength: 0.5 }, 0.35);
        return [e];
      });
    case 'storm': // dense, loud, everywhere
      return (_t, dt, r) => {
        const out: SoundEvent[] = [];
        for (let i = 0; i < 2; i++) if (poisson(7, dt, r)) out.push(ev(r(), r() * 2 - 1, 0.6 + r() * 0.4, Math.floor(r() * 12)));
        return out;
      };
    case 'machine': // metronomic 8ths, quantized heights
      return (t) => {
        if (t < next) return [];
        next = (next || t) + 0.25;
        k++;
        return [ev([0.2, 0.5, 0.35, 0.8][k % 4], [-0.6, 0.6, -0.2, 0.2][k % 4], k % 4 === 0 ? 1 : 0.6, [0, 3, 7, 10][k % 4])];
      };
    case 'lament': // slow, soft, mid-low, sustained
      return withHolds((t, _dt, r, hold) => {
        if (t < next) return [];
        next = t + 1.2 + r() * 0.6;
        const e = ev(0.3 + r() * 0.25, r() * 1.2 - 0.6, 0.45, [9, 0, 4][k++ % 3]);
        hold({ ...e, strength: 0.4 }, 1.6);
        return [e];
      });
    case 'none':
      return () => [];
    default: // neutral: one identical stream for every material
      return (t, _dt, r) => {
        if (t < next) return [];
        next = t + 0.22 + r() * 0.12;
        return [ev(r(), r() * 1.6 - 0.8, 0.4 + r() * 0.5, Math.floor(r() * 12))];
      };
  }
}

/** "aura:1,emissive:0.5" → overrides on top of the material (for experiments). */
function override(m: Material, ov: string | null): Material {
  const o = m as unknown as Record<string, number>;
  for (const kv of (ov ?? '').split(',')) {
    const [k, v] = kv.split(':');
    if (k in o && typeof o[k] === 'number') o[k] = Number(v);
  }
  return m;
}

function parseMaterial(spec: string): { material: Material; gen: string } {
  const table = presets === 'engine' ? ENGINE_MATERIALS : TEST_MATERIALS;
  const parts = spec.split(',').map((s) => {
    const [id, w] = s.split(':');
    return { id: id as ArchetypeId, w: w ? Number(w) : 1 };
  }).filter((p) => table[p.id]);
  if (!parts.length) parts.push({ id: 'fire', w: 1 });
  const material = override(blendMaterials(parts.map((p) => ({ m: table[p.id], w: p.w }))), q.get('ov'));
  const top = parts.slice().sort((a, b) => b.w - a.w)[0].id;
  return { material, gen: top };
}

const q = new URLSearchParams(location.search);
let presets = q.get('presets') ?? 'test';
const canvas = document.getElementById('living') as HTMLCanvasElement;
const label = document.getElementById('label')!;
const living = new LivingCanvas(canvas, {
  lowp: q.get('lowp') === '1',
  level: q.has('level') ? Number(q.get('level')) : undefined,
  seed: Number(q.get('seed') ?? 1),
});
console.log('[living] renderer:', living.caps.renderer, 'float:', living.caps.float);

let spec = q.get('m') ?? 'fire';
let evMode = q.get('ev') ?? 'own';
let { material, gen } = parseMaterial(spec);
let generator = makeGen(evMode === 'own' ? gen : evMode);
let r = rng(Number(q.get('seed') ?? 1));
let simTime = 0;
let paused = false;
let envelope = 0;

const pointer = { x: 0.5, y: 0.5, dx: 0, dy: 0, down: false };
let lastMove = { x: 0.5, y: 0.5, t: performance.now() };
canvas.addEventListener('pointerdown', (e) => {
  pointer.down = true;
  move(e);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointerup', () => (pointer.down = false));
canvas.addEventListener('pointermove', move);
function move(e: PointerEvent) {
  const now = performance.now();
  const x = e.clientX / innerWidth;
  const y = e.clientY / innerHeight;
  const dt = Math.max(0.008, (now - lastMove.t) / 1000);
  pointer.dx = pointer.dx * 0.5 + ((x - lastMove.x) / dt) * 0.5;
  pointer.dy = pointer.dy * 0.5 + ((y - lastMove.y) / dt) * 0.5;
  pointer.x = x;
  pointer.y = y;
  lastMove = { x, y, t: now };
}
addEventListener('resize', () => living.resize());

function gesture(t: number): Gesture {
  return {
    x: Math.sin(t * 0.31) * 0.6 + Math.sin(t * 0.73) * 0.3,
    y: Math.sin(t * 0.23 + 1) * 0.5,
    angle: t * 0.21 + Math.sin(t * 0.17) * 1.5,
    swirl: Math.sin(t * 0.11),
    breath: 0.5 + 0.5 * Math.sin(t * 0.4),
    extra: [Math.sin(t * 0.13), Math.cos(t * 0.19), Math.sin(t * 0.07 + 2), Math.cos(t * 0.05 + 1)],
  };
}

/**
 * A recorded run of the real chain (audio → descriptors → CharacterEngine), one row
 * per 60 Hz frame: m = 17 material scalars + 12 palette values, g = gesture (9: x, y,
 * angle, swirl, breath, extra×4), ev = events as [height, pan, strength, note, r, g,
 * b, onset], l = features.level, reg / sil = descriptors.register / silence.
 */
export interface ReplayFrame { m: number[]; g: number[]; ev: number[][]; l: number; reg: number; sil: number }
let replay: ReplayFrame[] | null = null;
let replayAt = 0;

function replayInput(dt: number, fr: ReplayFrame): LivingInput {
  const mat = {} as Record<string, number>;
  MATERIAL_KEYS.forEach((k, i) => (mat[k] = fr.m[i]));
  const p = fr.m.slice(MATERIAL_KEYS.length);
  const palette = [0, 1, 2, 3].map((i) => p.slice(i * 3, i * 3 + 3)) as Material['palette'];
  const features = emptyFeatures();
  features.level = fr.l;
  features.time = simTime;
  const descriptors = neutralDescriptors();
  descriptors.register = fr.reg;
  descriptors.silence = fr.sil;
  const [x, y, angle, swirl, breath, e0, e1, e2, e3] = fr.g;
  return {
    dt, time: simTime, features, descriptors,
    character: { axes: { energy: 0.5, valence: 0, weight: 0.5, size: 0.5, agitation: 0.5, sharpness: 0.5, density: 0.5, warmth: 0.5, pace: 0.5 }, blend: [], words: [], confidence: 1 },
    material: { ...(mat as unknown as Omit<Material, 'palette'>), palette },
    gesture: { x, y, angle, swirl, breath, extra: [e0, e1, e2, e3] },
    events: fr.ev.map((e) => ({ height: e[0], pan: e[1], strength: e[2], note: e[3], color: [e[4], e[5], e[6]] as Rgb, onset: !!e[7] })),
    pointer: { ...pointer },
  };
}

function frameInput(dt: number): LivingInput {
  simTime += dt;
  if (replay) return replayInput(dt, replay[Math.min(replay.length - 1, replayAt++)]);
  const events = generator(simTime, dt, r);
  for (const e of events) if (e.onset) envelope = Math.max(envelope, e.strength);
  envelope *= Math.exp(-dt * 3);
  const features = emptyFeatures();
  features.level = 0.25 + envelope * 0.6;
  features.time = simTime;
  const descriptors = neutralDescriptors();
  descriptors.silence = 0;
  descriptors.loudness = features.level;
  descriptors.register = events.length ? events[0].height : 0.5;
  if (!pointer.down) {
    pointer.dx *= 0.8;
    pointer.dy *= 0.8;
  }
  return {
    dt, time: simTime, features, descriptors,
    character: { axes: { energy: 0.5, valence: 0, weight: 0.5, size: 0.5, agitation: 0.5, sharpness: 0.5, density: 0.5, warmth: 0.5, pace: 0.5 }, blend: [], words: [], confidence: 1 },
    material, gesture: gesture(simTime), events, pointer: { ...pointer },
  };
}

let frames = 0;
let fpsT = performance.now();
let fps = 0;
function loop() {
  if (!paused) living.render(frameInput(1 / 60));
  frames++;
  const now = performance.now();
  if (now - fpsT > 500) {
    fps = (frames * 1000) / (now - fpsT);
    frames = 0;
    fpsT = now;
    const i = living.info();
    label.textContent = `${spec} · ${evMode} events · ${fps.toFixed(0)} fps · level ${i.level} · sim ${i.sim.join('×')} · dye ${i.dye.join('×')} · ${i.float ? 'float' : 'RGBA8'}`;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/** Hooks for scripts/living-shots.mjs. */
(window as unknown as { harness: unknown }).harness = {
  set(m: string, mode = 'own', seed = 1, table?: 'test' | 'engine') {
    if (table) presets = table;
    replay = null;
    spec = m;
    evMode = mode;
    ({ material, gen } = parseMaterial(m));
    generator = makeGen(mode === 'own' ? gen : mode);
    r = rng(seed);
    simTime = 0;
    envelope = 0;
    living.reset();
  },
  /** Plays back a recorded engine run, starting at frame `from` (see ReplayFrame). */
  replay(frames: ReplayFrame[], from = 0, name = 'replay') {
    replay = frames;
    replayAt = from;
    spec = name;
    simTime = from / 60;
    living.reset();
  },
  /** Advances the simulation `n` frames immediately (deterministic, independent of rAF). */
  advance(n: number, dt = 1 / 60) {
    for (let i = 0; i < n; i++) living.render(frameInput(dt));
  },
  /** Renders one frame from a hand-made input (robustness checks). */
  renderRaw(patch: (input: LivingInput) => void) {
    const input = frameInput(1 / 60);
    patch(input);
    living.render(input);
  },
  pause(p: boolean) {
    paused = p;
  },
  info: () => ({ ...living.info(), fps }),
  label(show: boolean) {
    label.style.display = show ? '' : 'none';
  },
  /** Renders `n` frames back to back, waiting for the GPU after each; returns ms/frame. */
  bench(level: number, n = 120) {
    living.setQuality(level);
    const gl = living.gl;
    const px = new Uint8Array(4);
    for (let i = 0; i < 90; i++) living.render(frameInput(1 / 60));
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const times: number[] = [];
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      living.render(frameInput(1 / 60));
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    // Throughput: n frames queued back to back, one sync at the end (GPU-bound cost per frame).
    const t0 = performance.now();
    for (let i = 0; i < n; i++) living.render(frameInput(1 / 60));
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const throughput = (performance.now() - t0) / n;
    return { level, median: times[n >> 1], p90: times[Math.floor(n * 0.9)], throughput, info: living.info() };
  },
  setQuality: (l: number | null) => living.setQuality(l),
  living,
  dispose: () => living.dispose(),
};
