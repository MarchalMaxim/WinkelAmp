/**
 * The stage: one WebGL2 compositor for the whole cast. Each frame it brings the
 * element instances in line with the directives' cast (by id; an id whose type
 * changes gets a fresh instance), lets every element draw additively into an HDR
 * scene (trailed or crisp), then runs the post chain (feedback/trails, glow,
 * mirror, accents, dim).
 *
 *   const stage = new Stage(canvas);   // <canvas id="stage-gl">
 *   stage.render(frame);               // once per animation frame
 */
import type { Rgb } from '../character/types';
import { ELEMENTS } from './elements';
import { detectCaps, fin, parseColor, rng, SpriteBatch, StrokeBatch, type Caps, type GL } from './gl';
import { StagePost } from './post';
import type { CastMember, ElementType, StageElement, StageFrame, StageShared } from './types';

/** Draw order. Additive, so it only matters for hand-offs: the melody's ink reaches a fluid drawn after it. */
const ORDER: ElementType[] = ['bloom', 'bass', 'pulse', 'wave', 'sparks', 'melody', 'fluid'];
/** Elements that carry their own history: drawn sharp, with only a faint echo in the feedback (see post.ts). */
const CRISP = new Set<ElementType>(['melody', 'pulse', 'wave']);
/** Render pixels at most (scene + feedback + bloom); the canvas itself stays at full size. */
const MAX_PIXELS = 2.2e6;

/**
 * What to create and what to dispose so that `live` (id → type of the instances we
 * hold) matches `cast`. An id whose type changed is both dropped and created.
 */
export function reconcile(live: ReadonlyMap<string, ElementType>, cast: readonly CastMember[]): { create: CastMember[]; drop: string[] } {
  const want = new Map<string, CastMember>();
  for (const m of cast) if (!want.has(m.spec.id)) want.set(m.spec.id, m);
  const drop: string[] = [];
  for (const [id, type] of live) {
    const m = want.get(id);
    if (!m || m.spec.type !== type) drop.push(id);
  }
  const create = [...want.values()].filter((m) => live.get(m.spec.id) !== m.spec.type);
  return { create, drop };
}

export interface StageOptions {
  /** Seed for element randomness (repeatable screenshots). */
  seed?: number;
  /** Pin the Living Canvas quality level of fluid elements (0..4); default adaptive. */
  fluidLevel?: number;
}

export class Stage {
  /** True when this browser can run the stage (WebGL2). */
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
  readonly caps: Caps;
  /** Called once when the GPU context is lost (the app falls back to the Classic renderer). */
  onContextLost?: () => void;
  private post: StagePost;
  private shared: StageShared;
  private live = new Map<string, StageElement>();
  private lost = false;
  private width = 0;
  private height = 0;
  private last: { fr: StageFrame } | null = null;
  /** clock.time of the last rendered frame (a number, not the frame: the app may reuse one frame object). */
  private lastTime = -Infinity;

  constructor(readonly canvas: HTMLCanvasElement, opts: StageOptions = {}) {
    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false,
      preserveDrawingBuffer: false, powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    this.caps = detectCaps(gl);
    this.post = new StagePost(gl, this.caps.float);
    const aspect = () => this.shared.aspect;
    this.shared = {
      w: 1, h: 1, aspect: 1,
      quad: () => this.post.quad(),
      sprites: new SpriteBatch(gl, aspect),
      strokes: new StrokeBatch(gl, aspect),
      palette: [[0, 0, 0], [0.2, 0.2, 0.3], [0.6, 0.5, 0.7], [1, 1, 1]],
      notes: false,
      react: 1,
      rand: rng(opts.seed ?? 7),
      fluid: false,
      ink: [],
      fluidLevel: opts.fluidLevel,
      layers: [],
    };
    canvas.addEventListener('webglcontextlost', this.onLost);
    this.resize();
  }

  private onLost = (e: Event) => {
    e.preventDefault();
    if (this.lost) return;
    this.lost = true;
    this.onContextLost?.();
  };

  /** Matches the backbuffer to the canvas's CSS size (devicePixelRatio capped at 2). */
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round((this.canvas.clientWidth || window.innerWidth) * dpr));
    const h = Math.max(1, Math.round((this.canvas.clientHeight || window.innerHeight) * dpr));
    if (w === this.width && h === this.height) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.width = w;
    this.height = h;
    const k = Math.min(1, Math.sqrt(MAX_PIXELS / (w * h)));
    const rw = Math.max(16, Math.round(w * k));
    const rh = Math.max(16, Math.round(h * k));
    this.post.allocate(rw, rh);
    this.shared.w = rw;
    this.shared.h = rh;
    this.shared.aspect = rw / rh;
  }

  info() {
    return {
      renderer: this.caps.renderer, float: this.caps.float, canvas: [this.width, this.height],
      render: [this.post.w, this.post.h], cast: [...this.live.entries()].map(([id, e]) => `${id}:${e.type}`),
    };
  }

  render(fr: StageFrame) {
    if (this.lost || this.gl.isContextLost()) return;
    const gl = this.gl;
    if (this.canvas.width !== this.width || this.canvas.height !== this.height) this.width = 0;
    this.resize();

    // Music time went backward: a new track (MusicClock.reset()). Elements stamp their history
    // with music time and assume it only grows, so start every one afresh and forget the trails.
    const time = fin(fr.clock.time);
    if (time < this.lastTime) this.forget();
    this.lastTime = time;

    const cast = fr.directives.cast;
    this.syncCast(cast);
    const s = this.shared;
    s.palette = this.palette(fr);
    s.notes = fr.directives.look.palette === 'notes';
    s.react = 0.5 + Math.min(1, Math.max(0, fin(fr.wild)));
    s.fluid = cast.some((m) => m.spec.type === 'fluid' && m.presence > 0.01);
    s.ink.length = 0;
    s.layers.length = 0;

    this.post.beginScene();
    const order = cast.slice().sort((a, b) => ORDER.indexOf(a.spec.type) - ORDER.indexOf(b.spec.type));
    for (const m of order) {
      const el = this.live.get(m.spec.id);
      if (!el) continue;
      this.post.bindScene(CRISP.has(el.type));
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      el.draw(fr, m);
    }
    gl.disable(gl.BLEND);
    this.post.feedback(fr.directives.look, Math.max(0, fin(fr.musicDt)), fin(fr.gesture.swirl));
    this.finish(fr);
    this.last = { fr };
  }

  private finish(fr: StageFrame) {
    this.post.finish(this.width, this.height, {
      look: fr.directives.look, accents: fr.directives.accents, layers: this.shared.layers,
      dim: fin(fr.clock.dim), time: fin(fr.clock.time),
    });
  }

  /**
   * A PNG of the current picture. The drawing buffer isn't preserved between
   * frames, so this redraws the last final pass and reads it in the same task.
   */
  snapshot(): Promise<Blob | null> {
    if (this.last && !this.lost) this.finish(this.last.fr);
    return new Promise((res) => this.canvas.toBlob(res, 'image/png'));
  }

  /** RGBA pixels of the last frame (redrawn first, like snapshot): for tests and the silence check. */
  pixels(): Uint8Array {
    const gl = this.gl;
    if (this.last && !this.lost) this.finish(this.last.fr);
    const px = new Uint8Array(this.width * this.height * 4);
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return px;
  }

  /** Drops every element instance (syncCast recreates the cast) and clears the trails. */
  private forget() {
    for (const el of this.live.values()) el.dispose();
    this.live.clear();
    this.post.clearHistory();
  }

  private syncCast(cast: CastMember[]) {
    const types = new Map<string, ElementType>();
    for (const [id, el] of this.live) types.set(id, el.type);
    const { create, drop } = reconcile(types, cast);
    for (const id of drop) {
      this.live.get(id)?.dispose();
      this.live.delete(id);
    }
    for (const m of create) {
      const make = ELEMENTS[m.spec.type];
      if (!make) continue;
      const el = make();
      el.init(this.gl, this.shared);
      this.live.set(m.spec.id, el);
    }
  }

  /** `look.palette` resolved: four fixed colors, or the material's palette ('mood' and 'notes'). */
  private palette(fr: StageFrame): StageShared['palette'] {
    const p = fr.directives.look.palette;
    const mat = fr.material.palette;
    const clean = (c: Rgb | undefined, i: number): Rgb =>
      c && c.every(Number.isFinite) ? [c[0], c[1], c[2]] : (this.shared.palette[i] ?? [0.5, 0.5, 0.5]);
    if (Array.isArray(p)) {
      return p.map((h, i) => parseColor(h) ?? clean(mat?.[i], i)) as StageShared['palette'];
    }
    return [0, 1, 2, 3].map((i) => clean(mat?.[i], i)) as StageShared['palette'];
  }

  dispose() {
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    for (const el of this.live.values()) el.dispose();
    this.live.clear();
    if (!this.lost) {
      this.post.dispose();
      this.shared.sprites.dispose();
      this.shared.strokes.dispose();
    }
    this.lost = true;
  }
}
