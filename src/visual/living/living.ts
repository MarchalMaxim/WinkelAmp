/**
 * The Living Canvas: a WebGL2 picture whose *material* follows the music's
 * character. A stable-fluids simulation carries dye and heat; GPU sparks ride the
 * flow; a CPPN aura breathes behind it; bloom, a filmic curve and palette grading
 * finish the image. Every behavior is a continuous function of the Material, so
 * fire, abyss, sugar and the rest are regions of one space, not modes.
 */
import type { LivingInput, Material, Rgb, SoundEvent } from '../../character/types';
import { Aura } from './aura';
import {
  clamp01, cleanEvent, cleanGesture, cleanMaterial, emitEvents, emitStroke, type Emitted, MATERIAL_KEYS, mix, physics, rng,
  smoothstep, Sources, Sustain,
} from './emit';
import { Fluid } from './fluid';
import { type Caps, detectCaps, type GL } from './gl';
import { type FinalParams, Post } from './post';
import { LEVELS, QualityController } from './quality';
import { Sparks } from './sparks';

/** The 4-stop palette at t (0 = shadow … 1 = highlight), like ramp() in the shaders. */
function rampRgb(p: Material['palette'], t: number): Rgb {
  const x = clamp01(t) * 3;
  const i = Math.min(2, Math.floor(x));
  const f = x - i;
  return [mix(p[i][0], p[i + 1][0], f), mix(p[i][1], p[i + 1][1], f), mix(p[i][2], p[i + 1][2], f)];
}

function cloneMaterial(m: Material): Material {
  return { ...m, palette: m.palette.map((c) => [...c] as Rgb) as Material['palette'] };
}

export interface LivingOptions {
  /** Force the RGBA8 fallback (testing). */
  lowp?: boolean;
  /** Start at this quality level (0..4). */
  level?: number;
  /** Seed for emission randomness (repeatable screenshots). */
  seed?: number;
}

export class LivingCanvas {
  /** True when this browser can run the Living Canvas at all (WebGL2). */
  static supported(): boolean {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2');
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      return !!gl;
    } catch {
      return false;
    }
  }

  readonly gl: GL;
  caps!: Caps;
  readonly quality: QualityController;
  private fluid!: Fluid;
  private sparks!: Sparks;
  private aura!: Aura;
  private post!: Post;
  private lost = false;
  private locked = false;
  private width = 0;
  private height = 0;
  private renderW = 0;
  private renderH = 0;
  private mat: Material | null = null;
  private pal = new Float32Array(12);
  private rand: () => number;
  private lastNow = 0;
  private lastPointer: { x: number; y: number } | null = null;
  private wasDown = false;
  private lastColor: Rgb = [0.6, 0.5, 0.9];
  private flash = 0;
  private sources = new Sources();
  private sustain = new Sustain();
  private flashWait = 0;
  private aberr = 0;
  private auraFrame = 0;
  private time = 0;
  private lastFinal: FinalParams | null = null;

  constructor(readonly canvas: HTMLCanvasElement, private opts: LivingOptions = {}) {
    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false,
      preserveDrawingBuffer: false, powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    this.rand = rng(opts.seed ?? 12345);
    this.quality = new QualityController(opts.level ?? 3);
    this.locked = opts.level !== undefined;
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
    this.init();
  }

  private onLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
  };

  private onRestored = () => {
    this.init();
    this.lost = false;
  };

  private init() {
    const gl = this.gl;
    this.caps = detectCaps(gl, this.opts.lowp);
    this.fluid = new Fluid(gl, this.caps.float);
    this.sparks = new Sparks(gl);
    this.aura = new Aura(gl, this.caps.float);
    this.post = new Post(gl, this.caps.float);
    this.width = 0;
    this.resize();
  }

  /** Pins the quality level (benchmarks, screenshots); `null` returns to adaptive. */
  setQuality(level: number | null) {
    this.locked = level !== null;
    if (level !== null) this.quality.level = Math.max(0, Math.min(LEVELS.length - 1, level));
    this.applyQuality();
  }

  info() {
    return {
      renderer: this.caps.renderer, float: this.caps.float, level: this.quality.level,
      sim: [this.fluid.simW, this.fluid.simH], dye: [this.fluid.dyeW, this.fluid.dyeH],
      render: [this.renderW, this.renderH], canvas: [this.width, this.height],
    };
  }

  /** Matches the canvas backbuffer to its CSS size (devicePixelRatio capped at 2, like the 2D renderer). */
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round((this.canvas.clientWidth || window.innerWidth) * dpr));
    const h = Math.max(1, Math.round((this.canvas.clientHeight || window.innerHeight) * dpr));
    if (w === this.width && h === this.height) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.width = w;
    this.height = h;
    this.applyQuality();
  }

  private applyQuality() {
    if (!this.width) return;
    const L = LEVELS[this.quality.level];
    let rw = this.width * L.scale;
    let rh = this.height * L.scale;
    const k = Math.min(1, Math.sqrt(L.maxPixels / (rw * rh)));
    rw = Math.max(16, Math.round(rw * k));
    rh = Math.max(16, Math.round(rh * k));
    this.renderW = rw;
    this.renderH = rh;
    const aspect = this.width / this.height;
    const short = Math.min(rw, rh);
    this.fluid.allocate(aspect, L.sim, Math.min(L.dye, short));
    this.post.allocate(rw, rh);
    this.aura.allocate(Math.max(8, Math.round(rw / 6)), Math.max(8, Math.round(rh / 6)));
    this.sparks.capacity = L.sparks;
  }

  /** Clears the picture (fluid and sparks). */
  reset() {
    this.fluid.reset();
    this.sparks.reset();
    this.sources.clear();
    this.sustain.clear();
    this.mat = null;
    this.flash = 0;
    this.aberr = 0;
  }

  /** Material eases toward its target so abrupt engine changes still blend. */
  private follow(target: Material, dt: number): Material {
    if (!this.mat) {
      this.mat = cloneMaterial(target);
    } else {
      const k = 1 - Math.exp(-dt * 4);
      const m = this.mat as unknown as Record<string, number>;
      const t = target as unknown as Record<string, number>;
      for (const key of MATERIAL_KEYS) m[key] += (t[key] - m[key]) * k;
      for (let i = 0; i < 4; i++) for (let c = 0; c < 3; c++) {
        this.mat.palette[i][c] += (target.palette[i][c] - this.mat.palette[i][c]) * k;
      }
    }
    const p = this.mat.palette;
    for (let i = 0; i < 4; i++) this.pal.set(p[i], i * 3);
    return this.mat;
  }

  render(input: LivingInput) {
    if (this.lost) return;
    const gl = this.gl;
    const now = performance.now();
    if (this.lastNow && !this.locked && this.quality.update((now - this.lastNow) / 1000)) this.applyQuality();
    this.lastNow = now;
    if (this.canvas.width !== this.width || this.canvas.height !== this.height) this.width = 0;
    this.resize();

    // A stalled tab must not explode the simulation.
    const dt = Math.min(1 / 30, Math.max(1e-4, input.dt || 1 / 60));
    this.time += dt;
    const t = this.time;
    // Everything from upstream is sanitized here: one NaN would poison the eased
    // material and the GPU fields for good.
    const m = this.follow(cleanMaterial(input.material, this.mat), dt);
    const ph = physics(m);
    const g = cleanGesture(input.gesture);
    const aspect = this.width / this.height;
    const level = clamp01(input.features?.level || 0);
    const silence = clamp01(input.descriptors?.silence ?? 0) || 0;
    const register = clamp01(input.descriptors?.register ?? 0.5) || 0;

    // --- Emission -------------------------------------------------------------------
    const onsets: SoundEvent[] = [];
    const held: SoundEvent[] = [];
    for (const raw of input.events ?? []) {
      const e = cleanEvent(raw);
      if (!e) continue;
      if (e.onset) {
        onsets.push(e);
        this.lastColor = e.color;
      } else {
        held.push(e);
      }
    }
    const events = onsets.concat(this.sustain.update(held, dt));
    // A gentle continuous emitter keeps the material alive between onsets.
    if (level > 0.02 && silence < 0.9) {
      events.push({
        height: register, pan: g.x * 0.8, strength: level * 0.3, note: -1,
        color: this.lastColor, onset: false,
      });
    }
    const em = emitEvents(events, m, g, aspect, this.rand, dt);
    this.pointer(input, m, aspect, em);
    for (const s of em.sources) this.sources.add(s.splat, s.life);
    em.splats.push(...this.sources.tick(dt, m.jitter, this.rand));

    // Flashes are rare events: only accents well above the rest, with a refractory gap.
    this.flashWait -= dt;
    if (em.hit > 0.85 && this.flashWait <= 0 && ph.flash > 0.05) {
      this.flash = Math.max(this.flash, ph.flash * (0.5 + 0.5 * this.rand()));
      this.flashWait = 0.5 + this.rand() * 1.2;
      this.bolt(em, ph.flash, aspect);
    }
    this.flash *= Math.exp(-dt * 16);
    this.aberr = Math.max(this.aberr * Math.exp(-dt * 8), em.hit * ph.aberration);

    // --- Simulation -----------------------------------------------------------------
    const L = LEVELS[this.quality.level];
    this.fluid.splat(em.splats, aspect, m.grain);
    this.fluid.step({
      dt, time: t,
      curl: ph.curl, buoyancy: ph.buoyancy, gravity: ph.gravity,
      swirl: g.swirl * (0.5 + m.vorticity) * 0.9,
      turbulence: ph.turbulence * (0.5 + 0.5 * level),
      thickness: ph.thickness, velFade: ph.velFade, dyeFade: ph.dyeFade, heatFade: ph.heatFade,
      grid: ph.grid,
      wind: [Math.cos(g.angle) * 0.04 * (1 - m.viscosity), Math.sin(g.angle) * 0.04 * (1 - m.viscosity)],
      iterations: L.iterations, maccormack: L.maccormack, cap: ph.cap, budget: ph.budget, sharp: ph.sharp,
    }, aspect);

    const sp = {
      dt, time: t, aspect,
      follow: mix(6, 1.5, m.sparkSize),
      lift: m.buoyancy * 1.4 - m.gravity * 0.35,
      jitter: m.jitter * 1.2 + 0.05,
      drag: 0.2 + m.viscosity * 1.2,
      twinkle: m.twinkle,
      star: smoothstep(0.25, 0.85, m.angularity),
      gain: 0.7 + m.emissive * 2.2,
      // Hot, light, erratic sparks streak (embers); angular ones stay crisp points.
      streak: 0.006 + 0.014 * m.buoyancy + 0.006 * m.jitter,
      prism: m.twinkle * m.angularity,
    };
    // Sparks glow in the material's hottest colors, tinted by the sound; glittery
    // materials spread them over the upper palette (candy pinks and mints, not all white).
    for (const b of em.sparks) {
      const at = 1 - this.rand() * (0.15 + 0.6 * sp.prism);
      const hi = rampRgb(m.palette, at);
      const k = 0.55;
      b.color = [mix(b.color[0], hi[0], k), mix(b.color[1], hi[1], k), mix(b.color[2], hi[2], k)];
    }
    // Ambient motes drift everywhere while music plays: dust for slow materials,
    // sparkles for twinkly ones. Hot materials keep their sparks at the flames.
    const moteRate = 150 * m.sparkAmount * level * (1 - 0.9 * m.buoyancy) * (1 - silence);
    const motes = Math.floor(moteRate * dt + this.rand());
    if (motes > 0) {
      const hi = m.palette[3];
      const lo = m.palette[2];
      const k = this.rand();
      em.sparks.push({
        count: motes, x: 0.05 + this.rand() * 0.9, y: 0.05 + this.rand() * 0.9, radius: 0.5, vx: 0, vy: 0,
        spread: 0.05 + 0.2 * m.jitter, color: [mix(lo[0], hi[0], k), mix(lo[1], hi[1], k), mix(lo[2], hi[2], k)],
        size: m.sparkSize * 0.8, life: mix(0.4, 6, m.sparkLife),
      });
    }
    this.sparks.step(em.sparks, this.fluid.vel.read.tex, this.fluid.enc.vel, sp);

    // --- Image ----------------------------------------------------------------------
    // The aura changes slowly: refresh it every other frame.
    if (this.auraFrame++ % 2 === 0 || m.aura > 0.5) {
      this.aura.render(t, aspect, g.breath, g.extra, this.pal);
    }
    // A dark palette already says "dark": don't darken it twice through low emissive.
    // Its dye is lifted so the densest ink reaches the palette's own highlight (a dim
    // but visible color) instead of sinking into black.
    const hi = m.palette[3];
    const lift = Math.min(2.5, Math.max(1, 0.3 / Math.max(0.03, 0.2126 * hi[0] + 0.7152 * hi[1] + 0.0722 * hi[2])));
    this.post.compose(this.fluid.dye.read, this.fluid.enc.dye, this.aura.target, this.pal, {
      emissive: m.emissive, gloss: ph.gloss,
      // Steep curve: a background for misty materials, nearly absent for the rest.
      aura: Math.pow(m.aura, 3) * (0.5 + 0.5 * g.breath),
      heatGlow: 0.5 + 3 * m.emissive,
      flash: this.flash * 0.35,
      gain: (0.45 + 0.85 * m.emissive) * lift,
      grid: ph.grid,
      shade: ph.shade,
      time: t,
    });
    this.sparks.draw(this.renderH, sp);
    this.lastFinal = {
      time: t,
      bloom: 0.15 + 1.1 * m.emissive,
      // Emissive materials are light; dull ones are lit more dimly (but the palette
      // carries most of the darkness).
      exposure: 0.8 + 0.4 * m.emissive + this.flash * 0.6,
      shimmer: ph.shimmer,
      aberration: this.aberr,
      grade: 0.4,
      contrast: m.contrast,
      grain: m.grain,
      vignette: 0.35 + 0.4 * m.contrast,
    };
    this.post.finish(this.fluid.dye.read, this.fluid.enc.dye, this.pal, this.width, this.height, this.lastFinal);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * A PNG of the current picture. The drawing buffer isn't preserved between frames,
   * so this redraws the last frame's final pass and reads it in the same task.
   */
  snapshot(): Promise<Blob | null> {
    if (this.lastFinal && !this.lost) {
      this.post.finish(this.fluid.dye.read, this.fluid.enc.dye, this.pal, this.width, this.height, this.lastFinal);
    }
    return new Promise((res) => this.canvas.toBlob(res, 'image/png'));
  }

  /** A forked lightning bolt of thin bright shards, from the top down, scaled by `k`. */
  private bolt(em: Emitted, k: number, aspect: number) {
    // Bolts are pure heat: they glow white-hot through the palette and vanish quickly.
    const color: Rgb = [0.05 * k, 0.05 * k, 0.08 * k];
    const heat = 4 * k;
    let x = 0.15 + this.rand() * 0.7;
    let y = 1.02;
    const end = 0.15 + this.rand() * 0.35;
    while (y > end) {
      const len = 0.05 + this.rand() * 0.07;
      const a = -Math.PI / 2 + (this.rand() - 0.5) * 1.4;
      const nx = x + (Math.cos(a) * len) / aspect;
      const ny = y + Math.sin(a) * len;
      em.splats.push({
        x: (x + nx) / 2, y: (y + ny) / 2, rx: len * 0.55, ry: 0.006, color, heat,
        // Bolts push nothing: thinner than a grid cell, any impulse would just be noise.
        fx: 0, fy: 0, radial: 0, rot: a, star: 0, points: 4, square: 0, hard: 0.9,
      });
      // Occasionally fork.
      if (this.rand() < 0.25) {
        const fa = a + (this.rand() < 0.5 ? -1 : 1) * (0.5 + this.rand() * 0.5);
        const fl = len * 0.8;
        em.splats.push({
          x: nx + (Math.cos(fa) * fl) / aspect / 2, y: ny + (Math.sin(fa) * fl) / 2, rx: fl * 0.5, ry: 0.0025,
          color, heat: heat * 0.6, fx: 0, fy: 0, radial: 0, rot: fa,
          star: 0, points: 4, square: 0, hard: 0.9,
        });
      }
      x = nx;
      y = ny;
    }
  }

  /** Dragging paints with the fluid; a press splashes. */
  private pointer(input: LivingInput, m: Material, aspect: number, em: Emitted) {
    const p = input.pointer;
    if (!p?.down || !Number.isFinite(p.x + p.y + p.dx + p.dy)) {
      this.lastPointer = null;
      this.wasDown = false;
      return;
    }
    const pos = { x: p.x, y: 1 - p.y };
    // Pointer velocity (normalized / s, y down) → height units / s, y up.
    const vel = { x: p.dx * aspect, y: -p.dy };
    // The brush cycles slowly through hues, nudged toward the last sound's color.
    const h = (this.time * 0.07) % 1;
    const hue: Rgb = [0, 1, 2].map((i) => clamp01(Math.abs(((h * 6 + [0, 4, 2][i]) % 6) - 3) - 1)) as Rgb;
    const color: Rgb = [0, 1, 2].map((i) => mix(hue[i], this.lastColor[i], 0.4) * 1.4) as Rgb;
    if (!this.wasDown) {
      em.hit = Math.max(em.hit, 0.5);
      const splash = emitEvents([{ height: 0, pan: 0, strength: 0.8, note: -1, color, onset: true }], m,
        { x: 0, y: 0, angle: 0, swirl: 0, breath: 0, extra: [0, 0, 0, 0] }, aspect, this.rand);
      for (const s of splash.splats) {
        s.x = pos.x;
        s.y = pos.y;
        s.radial = Math.max(s.radial, 0.8);
      }
      for (const b of splash.sparks) {
        b.x = pos.x;
        b.y = pos.y;
      }
      em.splats.push(...splash.splats);
      em.sparks.push(...splash.sparks);
    }
    const from = this.lastPointer ?? pos;
    const stroke = emitStroke(from, pos, vel, m, color, aspect, this.rand);
    em.splats.push(...stroke.splats);
    em.sparks.push(...stroke.sparks);
    this.lastPointer = pos;
    this.wasDown = true;
  }

  dispose() {
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    if (!this.lost) {
      this.fluid.dispose();
      this.sparks.dispose();
      this.aura.dispose();
      this.post.dispose();
    }
    this.lost = true;
  }
}
