// The lab's harness (lab/index.html) as a class: the same ctx, chord firing, feature arithmetic, shared fading canvas
// and per-widget save/restore, so a widget draws the lab's pixels. Plan §3; the step order below is pinned.
//
// Instances (plan 2026-10-31 §6, spec Decisions 4 and 7): the runtime runs instances, keyed `widget` or
// `widget@listen`. A slot with no layer whose instance keeps no pulse of its own takes today's statements, verbatim;
// any other goes through the shared drawLayered (lab/layers/slot.js). A routed instance hears its part: it is evaluated
// with the part's NOTES and CHORDS, gets the part's chords, and its own pulse, features and sounding notes are swapped
// into ctx around each of its calls. A slot with a region (T15) is seen in a spot or a window (slot.js): a windowed
// instance draws on its own canvas, through hdContext at S > 1, and reset() and resetWidget() clear it to black.
import { groupChords, soundingAt } from './chords';
import { advanceFeatures, knobValue, newFeatures, pitch01, resolveKnobs } from './features';
import { hdContext } from './hd-context';
import { instantiate } from './instantiate';
import { LAB_FIRST_MOMENT, makeIcon } from './lab-harness';
import type { InstanceState, LayerHost, WaLayers } from './layers';
import type { Chord, IconLib, InstanceSpec, KnobMap, LabHarness, Note, SlotLayer, SongNotes, SoundingNote, ToolDef, WidgetCtx } from './types';

/** A widget drawn this step: weight 1 = exactly as the lab draws it; receiving = it gets this step's attacks; layer =
    its curve, its region and its glide. id is the instance key. */
export interface Slot { id: string; receiving: boolean; weight: number; layer?: SlotLayer }
export interface RuntimeLike {
  /** widget ids (today's call) or instance specs, in load order */
  load(specs: readonly (string | InstanceSpec)[]): void; setKnobs(key: string, knobs: KnobMap): void; setMoment(label: string): void;
  reset(t: number): void; resetWidget(key: string): void; step(t: number, dt: number, slots: readonly Slot[]): void;
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
  /** A debug hook (checks): when an array, every attack a layered instance is given is pushed as [key, chord time]. */
  deliveredLog: [string, number][] | null = null;
  private readonly g: CanvasRenderingContext2D;
  private readonly icon: IconLib;
  private readonly song: SongNotes;
  private readonly layers: (WaLayers & { clearWindow(win: HTMLCanvasElement): void }) | undefined;
  private readonly tools = new Map<string, ToolDef>();
  private readonly insts = new Map<string, InstanceState>();
  private readonly order: string[] = [];
  private readonly knobs: Record<string, KnobMap> = {};
  /** The instance being called (ctx.p reads its knobs) and the notes behind ctx.sounding() and ctx.top(). */
  private readonly cur: { key: string; notes: Note[] };
  private readonly host: LayerHost;
  private scratch: HTMLCanvasElement | null = null;
  /** Each windowed instance's widget-facing window context (the HD proxy at S > 1), by instance key. */
  private readonly winG = new Map<string, CanvasRenderingContext2D>();
  private ci = 0;
  /** The time of the last step (or reset): rt.lastT is already the new time when a clock calls step(). */
  private stepT = 0;
  /** The instances drawn in the last step: an own instance missing from it comes back cold. */
  private drawnPrev = new Set<string>();

  constructor(canvas: HTMLCanvasElement, song: SongNotes,
    private readonly lib: { sources: Record<string, string>; harness: LabHarness; layers?: WaLayers },
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
    this.song = song;
    this.layers = lib.layers as (WaLayers & { clearWindow(win: HTMLCanvasElement): void }) | undefined;   // slot.js (T15)
    this.chords = groupChords(song.notes);
    this.icon = makeIcon(lib.harness.iconSource);
    const knobs = this.knobs, cur = (this.cur = { key: '', notes: song.notes });
    const ctx: WidgetCtx = {
      g: hdContext(g, S, () => ctx.tool?.id ?? 'a widget'), W, H, canvas,
      t: 0, dt: 0, now: 0,
      moment: LAB_FIRST_MOMENT,   // as the lab before its first step; reset() keeps the last stepped moment, as the lab's
      level: 0, rate: 0,
      feat: newFeatures(),
      tool: undefined,
      rnd: (a = 0, b = 1) => a + Math.random() * (b - a),
      sounding: () => soundingAt(cur.notes, ctx.t),
      top() { let b: SoundingNote | null = null; for (const n of ctx.sounding()) if (!b || n.m > b.m) b = n; return b; },
      pitch01,
      p(key) {
        const tool = ctx.tool, q = tool?.params?.find((x) => x.key === key);
        if (!tool || !q) return undefined;
        const m = (knobs[cur.key] ??= {});   // the instance's knobs: its key is the widget's id unless it listens to a part
        return knobValue(q, (m[q.key] ??= { base: q.value, drive: q.drive ?? '', depth: 0.5 }), ctx.feat);
      },
    };
    this.ctx = ctx;
    const make = (w: number, h: number) => Object.assign(document.createElement('canvas'), { width: w, height: h });
    const host: LayerHost & { windowG(inst: InstanceState): CanvasRenderingContext2D; error(inst: InstanceState, e: unknown): void } = {
      ctx, g, canvas, S,
      // host.ctx, not ctx: a windowed call runs with host.ctx set to the instance's window view (slot.js), whose canvas
      // is the window; the base transform at S > 1 goes on that canvas's context.
      call: (inst, fn, ch) => {
        const x = host.ctx, real = x === ctx ? g : x.canvas.getContext('2d')!;
        if (fn === 'onChord') { this.deliveredLog?.push([inst.key, ch!.t]); this.safe(inst.key, 'onChord', real, ch, x); }
        else this.safe(inst.key, fn, real, x);
      },
      scratch: () => (this.scratch ??= make(W * S, H * S)),
      windowOf: (inst) => {
        if (!inst.win) {   // opaque black when created
          const win = make(W * S, H * S), wg = win.getContext('2d')!;
          wg.fillStyle = '#000'; wg.fillRect(0, 0, W * S, H * S);
          inst.win = win;
        }
        return inst.win;
      },
      /** The widget-facing context of an instance's window: through hdContext, one per instance (g itself at S = 1). */
      windowG: (inst) => {
        let wg = this.winG.get(inst.key);
        if (!wg) { wg = hdContext(host.windowOf(inst).getContext('2d')!, S, () => ctx.tool?.id ?? 'a widget'); this.winG.set(inst.key, wg); }
        return wg;
      },
      make,
      /** An error in a region layer's queued post-pass (slot.js runs a window's at its slot, a spot's at the end of the
          step through its mask; both report here): kept as safe() keeps
          the first error per instance. */
      error: (inst, e) => { if (!this.errors[inst.key]) { this.errors[inst.key] = String(e); console.error(inst.key, e); } },
    };
    this.host = host;
  }

  /** Evaluates each not-yet-loaded instance once, in this order (load order is draw order and, through load-time
      randomness, part of the pixels). A widget id loads its plain instance (today's call); a spec with a listen that the
      song has is routed: evaluated with its part's NOTES and CHORDS. A key already loaded only takes the spec's `own`
      (a curve added in an edit), in place: re-evaluating would wipe its state. A failure is kept in errors[key]. */
  load(specs: readonly (string | InstanceSpec)[]): void {
    const L = this.layers;
    for (const x of specs) {
      const spec: InstanceSpec = typeof x === 'string' ? { key: x, widget: x } : x;
      const key = spec.key, have = this.insts.get(key);
      if (have) { this.setOwn(have, !!L && (!!spec.own || have.routed)); continue; }
      if (this.tools.has(key) || this.errors[key]) continue;
      const src = this.lib.sources[spec.widget];
      if (src == null) { this.errors[key] = `no widget file lab/tools/${spec.widget}.js`; continue; }
      let notes = this.song.notes, routed = false;
      if (spec.listen !== undefined && spec.listen !== 'all') {
        if (!L) { this.errors[key] = `listens to ${spec.listen}, but this runtime has no layer code`; continue; }
        const heard = L.listenNotes(this.song, spec.listen);
        if (heard.heard !== 'all') { notes = heard.notes; routed = true; }   // a part the song lacks: all notes, unrouted
      }
      const chords = routed ? groupChords(notes) : this.chords;
      try {
        const tool = instantiate(spec.widget, src, routed ? { icon: this.icon, chords, notes } : { icon: this.icon, chords: this.chords });
        this.tools.set(key, tool); this.order.push(key);
        this.knobs[key] = resolveKnobs(Array.isArray(tool.params) ? tool.params : []);
        const inst: InstanceState = {
          key, widget: spec.widget, salt: L ? L.fnv32(key) : 0, notes, chords, ci: 0,
          pulse: { level: 0, rate: 0 }, feat: newFeatures(),
          own: !!L && (!!spec.own || routed), routed, persist: L?.PERSIST[spec.widget] ?? 'redraw', win: null,
        };
        this.insts.set(key, inst);
        L?.coldInstance(inst, this.stepT);
      } catch (e) { this.errors[key] = `load: ${e instanceof Error ? e.message : String(e)}`; }
    }
  }
  /** Instance keys in load order. */
  loaded(): readonly string[] { return this.order; }
  /** By instance key, else the first loaded instance of that widget (meta and names ask by widget id). */
  tool(id: string): ToolDef | undefined {
    const t = this.tools.get(id);
    if (t) return t;
    for (const k of this.order) if (this.insts.get(k)?.widget === id) return this.tools.get(k);
    return undefined;
  }
  /** An instance's state: its part, pulse and features (checks read feat.pitch). */
  instance(key: string): InstanceState | undefined { return this.insts.get(key); }
  setKnobs(key: string, knobs: KnobMap): void { this.knobs[key] = knobs; }
  setMoment(label: string): void { this.ctx.moment = label; }

  /** The lab's reset(t): pulse to 0, the next chord after t, opaque black, reset() on every loaded widget. Every
      instance starts cold at t too. */
  reset(t: number): void {
    const { ctx, g } = this;
    this.lastT = t; ctx.t = t; ctx.level = 0; ctx.rate = 0;
    this.ci = this.chords.findIndex((ch) => ch.t > t); if (this.ci < 0) this.ci = this.chords.length;
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = '#000';
    if (this.S > 1) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillRect(0, 0, W * this.S, H * this.S); } else g.fillRect(0, 0, W, H);
    this.stepT = t; this.drawnPrev = new Set();
    if (this.layers) {
      for (const inst of this.insts.values()) {
        this.layers.coldInstance(inst, t);
        if (inst.win) this.layers.clearWindow(inst.win);   // windows go black with the shared canvas
      }
    }
    for (const id of this.order) this.safe(id, 'reset', g, ctx);
    this.resets++;
  }
  /** One instance's reset() (a restart), its window cleared to black. */
  resetWidget(key: string): void {
    if (!this.tools.has(key)) return;
    const win = this.insts.get(key)?.win;
    if (win && this.layers) this.layers.clearWindow(win);
    this.safe(key, 'reset', this.g, this.ctx);
  }

  /** One picture at song time t, dt after the last: the lab's step(), with the instances given by slots. */
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
    const L = this.layers, drawn = new Set<string>();
    for (const slot of slots) {
      if (!this.tools.has(slot.id)) continue;
      const inst = this.insts.get(slot.id)!;
      drawn.add(slot.id);
      if (L && (slot.layer || inst.own)) {
        if (inst.own && !this.drawnPrev.has(slot.id)) L.coldInstance(inst, this.stepT);   // back after an absence
        L.drawLayered(this.host, { inst, receiving: slot.receiving, weight: slot.weight, layer: slot.layer ?? {}, fired, lastT: this.stepT, t, dt });
        continue;
      }
      // Today's statements (no layer, no own pulse): the paste-back at 1 − weight.
      const fading = slot.weight < 1;
      let sc: HTMLCanvasElement | null = null;
      if (fading) {
        sc = this.scratch ??= Object.assign(document.createElement('canvas'), { width: RW, height: RH });
        const sg = sc.getContext('2d')!;
        sg.globalCompositeOperation = 'copy'; sg.drawImage(ctx.canvas, 0, 0); sg.globalCompositeOperation = 'source-over';
      }
      if (slot.receiving) for (const ch of fired) this.safe(slot.id, 'onChord', g, ch, ctx);
      g.save(); this.safe(slot.id, 'frame', g, ctx); g.restore();
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.filter = 'none'; g.shadowBlur = 0;
      if (sc) {
        if (S > 1) g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = 1 - Math.max(0, slot.weight); g.drawImage(sc, 0, 0); g.globalAlpha = 1;
      }
    }
    this.drawnPrev = drawn; this.stepT = t;
    if (S > 1 && this.post.length) g.setTransform(S, 0, 0, S, 0, 0);   // queued widget code draws in widget units too
    while (this.post.length) { try { this.post.shift()!(); } catch (e) { console.warn(e); } }
  }

  /** An instance that starts keeping its own pulse (a curve added in an edit) takes the global one as it is now: an
      unrouted one would have had the same. */
  private setOwn(inst: InstanceState, own: boolean): void {
    if (own && !inst.own) {
      const { ctx } = this;
      inst.pulse.level = ctx.level; inst.pulse.rate = ctx.rate; Object.assign(inst.feat, ctx.feat);
    }
    inst.own = own;
  }

  /** The lab's safe(): ctx.tool set, the first error per instance kept, the step never stops. An own instance's pulse,
      features and notes are in ctx for the call, and the global ones back after it. */
  private safe(key: string, fn: 'reset' | 'onChord' | 'frame', real: CanvasRenderingContext2D, ...a: unknown[]): void {
    const { ctx, cur } = this, tool = this.tools.get(key)!, inst = this.insts.get(key);
    ctx.tool = tool; cur.key = key;
    if (this.S > 1) real.setTransform(this.S, 0, 0, this.S, 0, 0);   // the base transform: 1280×720 units
    const swap = inst !== undefined && inst.own;
    const level = ctx.level, rate = ctx.rate, feat = ctx.feat, notes = cur.notes;
    if (swap) { ctx.level = inst.pulse.level; ctx.rate = inst.pulse.rate; ctx.feat = inst.feat; cur.notes = inst.notes; }
    try { const f = tool[fn] as ((...x: unknown[]) => void) | undefined; if (f != null) f.apply(tool, a); }   // tool[fn]?.(…a): `this` is the tool
    catch (e) { if (!this.errors[key]) { this.errors[key] = String(e); console.error(key, e); } }
    if (swap) { ctx.level = level; ctx.rate = rate; ctx.feat = feat; cur.notes = notes; }
  }
}
