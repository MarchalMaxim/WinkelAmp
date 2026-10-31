// The lab's harness (lab/index.html) as a class: the same ctx, chord firing, feature arithmetic, shared fading canvas
// and per-widget save/restore, so a widget draws the lab's pixels. Plan §3; the step order below is pinned.
import { groupChords, soundingAt } from './chords';
import { advanceFeatures, knobValue, newFeatures, pitch01, resolveKnobs } from './features';
import { hdContext } from './hd-context';
import { instantiate } from './instantiate';
import { LAB_FIRST_MOMENT, makeIcon } from './lab-harness';
import type { Chord, IconLib, KnobMap, LabHarness, Note, SoundingNote, ToolDef, WidgetCtx } from './types';

/** A widget drawn this step: weight 1 = exactly as the lab draws it; receiving = it gets this step's attacks. */
export interface Slot { id: string; receiving: boolean; weight: number }
export interface RuntimeLike {
  load(ids: readonly string[]): void; setKnobs(id: string, knobs: KnobMap): void; setMoment(label: string): void;
  reset(t: number): void; resetWidget(id: string): void; step(t: number, dt: number, slots: readonly Slot[]): void;
}
/** scale S (plan §7): the canvas is 1280·S × 720·S; widgets draw in 1280×720 units through hdContext. */
export interface RuntimeOptions { scale?: 1 | 2 | 3 }

const W = 1280, H = 720;

export class WidgetRuntime implements RuntimeLike {
  readonly ctx: WidgetCtx;
  readonly chords: Chord[];
  readonly errors: Record<string, string> = {};
  /** Callbacks a widget queued to run after everything else drew (the lab's render-mode RENDER_POST: pixelsort's
      queueMicrotask). The render page routes queueMicrotask here; step() runs them at its end. */
  readonly post: (() => void)[] = [];
  resets = 0;
  lastT = 0;
  /** canvas.width / 1280. At 1 every statement is the lab's; above, ctx.g is a proxy and the background is real-size. */
  readonly S: number;
  private readonly g: CanvasRenderingContext2D;
  private readonly icon: IconLib;
  private readonly tools = new Map<string, ToolDef>();
  private readonly order: string[] = [];
  private readonly knobs: Record<string, KnobMap> = {};
  private scratch: HTMLCanvasElement | null = null;
  private ci = 0;

  constructor(canvas: HTMLCanvasElement, song: { notes: Note[] }, private readonly lib: { sources: Record<string, string>; harness: LabHarness },
    opts: RuntimeOptions = {}) {
    const S = opts.scale ?? 1;
    if (S !== 1 && S !== 2 && S !== 3) throw new Error(`scale ${String(S)}: 1, 2 or 3`);
    if (canvas.width !== W * S || canvas.height !== H * S) {
      throw new Error(`the canvas is ${canvas.width}×${canvas.height}; scale ${S} needs ${W * S}×${H * S}`);
    }
    this.S = S;
    const g = canvas.getContext('2d');   // no options, as the lab: willReadFrequently would change the pixels
    if (!g) throw new Error('no 2D canvas');
    this.g = g;
    this.chords = groupChords(song.notes);
    this.icon = makeIcon(lib.harness.iconSource);
    const notes = song.notes, knobs = this.knobs;
    const ctx: WidgetCtx = {
      g: hdContext(g, S, () => ctx.tool?.id ?? 'a widget'), W, H, canvas,
      t: 0, dt: 0, now: 0,
      moment: LAB_FIRST_MOMENT,   // as the lab before its first step; reset() keeps the last stepped moment, as the lab's
      level: 0, rate: 0,
      feat: newFeatures(),
      tool: undefined,
      rnd: (a = 0, b = 1) => a + Math.random() * (b - a),
      sounding: () => soundingAt(notes, ctx.t),
      top() { let b: SoundingNote | null = null; for (const n of ctx.sounding()) if (!b || n.m > b.m) b = n; return b; },
      pitch01,
      p(key) {
        const tool = ctx.tool, q = tool?.params?.find((x) => x.key === key);
        if (!tool || !q) return undefined;
        const m = (knobs[tool.id] ??= {});
        return knobValue(q, (m[q.key] ??= { base: q.value, drive: q.drive ?? '', depth: 0.5 }), ctx.feat);
      },
    };
    this.ctx = ctx;
  }

  /** Evaluates each not-yet-loaded widget once, in this order (load order is draw order and, through load-time
      randomness, part of the pixels). A failure is kept in errors[id]. */
  load(ids: readonly string[]): void {
    for (const id of ids) {
      if (this.tools.has(id) || this.errors[id]) continue;
      const src = this.lib.sources[id];
      if (src == null) { this.errors[id] = `no widget file lab/tools/${id}.js`; continue; }
      try {
        const tool = instantiate(id, src, { icon: this.icon, chords: this.chords });
        this.tools.set(id, tool); this.order.push(id);
        this.knobs[id] = resolveKnobs(Array.isArray(tool.params) ? tool.params : []);
      } catch (e) { this.errors[id] = `load: ${e instanceof Error ? e.message : String(e)}`; }
    }
  }
  loaded(): readonly string[] { return this.order; }
  tool(id: string): ToolDef | undefined { return this.tools.get(id); }
  setKnobs(id: string, knobs: KnobMap): void { this.knobs[id] = knobs; }
  setMoment(label: string): void { this.ctx.moment = label; }

  /** The lab's reset(t): pulse to 0, the next chord after t, opaque black, reset() on every loaded widget. */
  reset(t: number): void {
    const { ctx, g } = this;
    this.lastT = t; ctx.t = t; ctx.level = 0; ctx.rate = 0;
    this.ci = this.chords.findIndex((ch) => ch.t > t); if (this.ci < 0) this.ci = this.chords.length;
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = '#000';
    if (this.S > 1) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillRect(0, 0, W * this.S, H * this.S); } else g.fillRect(0, 0, W, H);
    for (const id of this.order) this.safe(id, 'reset', ctx);
    this.resets++;
  }
  resetWidget(id: string): void { if (this.tools.has(id)) this.safe(id, 'reset', this.ctx); }

  /** One picture at song time t, dt after the last: the lab's step(), with the widgets given by slots. */
  step(t: number, dt: number, slots: readonly Slot[]): void {
    const { ctx, g, chords, S } = this;
    const RW = W * S, RH = H * S;   // the real size: at S = 1 the lab's 1280×720
    ctx.t = t; ctx.dt = dt; this.lastT = t;
    const fired: Chord[] = [];
    while (this.ci < chords.length && chords[this.ci].t <= t) fired.push(chords[this.ci++]);
    advanceFeatures(ctx, ctx.feat, fired, ctx.sounding(), dt);
    // Shared background: fade toward black; a light colour-burn takes the last 8-bit levels to black.
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    if (S > 1) g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, RW, RH);
    g.globalCompositeOperation = 'color-burn'; g.fillStyle = 'rgb(252,252,252)'; g.fillRect(0, 0, RW, RH);
    g.globalCompositeOperation = 'source-over';
    for (const slot of slots) {
      if (!this.tools.has(slot.id)) continue;
      const fading = slot.weight < 1;
      let sc: HTMLCanvasElement | null = null;
      if (fading) {
        sc = this.scratch ??= Object.assign(document.createElement('canvas'), { width: RW, height: RH });
        const sg = sc.getContext('2d')!;
        sg.globalCompositeOperation = 'copy'; sg.drawImage(ctx.canvas, 0, 0); sg.globalCompositeOperation = 'source-over';
      }
      if (slot.receiving) for (const ch of fired) this.safe(slot.id, 'onChord', ch, ctx);
      g.save(); this.safe(slot.id, 'frame', ctx); g.restore();
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.filter = 'none'; g.shadowBlur = 0;
      if (sc) {
        if (S > 1) g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = 1 - Math.max(0, slot.weight); g.drawImage(sc, 0, 0); g.globalAlpha = 1;
      }
    }
    if (S > 1 && this.post.length) g.setTransform(S, 0, 0, S, 0, 0);   // queued widget code draws in widget units too
    while (this.post.length) { try { this.post.shift()!(); } catch (e) { console.warn(e); } }
  }

  /** The lab's safe(): ctx.tool set, the first error per widget kept, the step never stops. */
  private safe(id: string, fn: 'reset' | 'onChord' | 'frame', ...a: unknown[]): void {
    const tool = this.tools.get(id)!;
    this.ctx.tool = tool;
    if (this.S > 1) this.g.setTransform(this.S, 0, 0, this.S, 0, 0);   // the base transform: 1280×720 units
    try { const f = tool[fn] as ((...x: unknown[]) => void) | undefined; if (f != null) f.apply(tool, a); }   // tool[fn]?.(…a): `this` is the tool
    catch (e) { if (!this.errors[id]) { this.errors[id] = String(e); console.error(id, e); } }
  }
}
