/**
 * A show on the widget runtime (plan §5): at every step it asks the pure scheduler which widgets play, which take
 * attacks and which decay, resets the ones entering at a boundary it crossed, switches knobs and the moment at section
 * changes, and hands the runtime its slots. Live (startLive), in render pages (exposeRenderApi) and paused previews
 * all go through reset() and step().
 */
import type { Stepper } from '../../widgets/driver';
import { resolveKnobs } from '../../widgets/features';
import type { RuntimeLike, Slot } from '../../widgets/runtime';
import type { InstanceSpec, SlotLayer, WidgetMeta } from '../../widgets/types';
import { entriesBetween, scheduleAt, sectionAt, type ScheduledWidget } from './schedule';
import { instanceKey, listenOf, type KnobSetting, type Show } from './show';

/** A slot with its layer (plan 2026-10-31 §6: Slot gains `layer` in runtime.ts with T12). */
export type ShowSlot = Slot & { layer?: SlotLayer };
/** What the Conductor needs of a runtime: RuntimeLike, with load taking instance specs and slots their layers (§6). */
export interface ShowRuntime extends Omit<RuntimeLike, 'load' | 'step'> {
  load(specs: readonly (string | InstanceSpec)[]): void;
  step(t: number, dt: number, slots: readonly ShowSlot[]): void;
}

/** The instances of a show in first-appearance order. own: it listens to a part, or some layer of it has a curve. */
export function showInstances(show: Show): InstanceSpec[] {
  const out = new Map<string, InstanceSpec>();
  for (const s of show.sections) for (const l of s.layers) {
    const key = instanceKey(l), listen = listenOf(l);
    let spec = out.get(key);
    if (!spec) {
      spec = { key, widget: l.widget, ...(listen !== undefined ? { listen } : {}), own: listen !== undefined };
      out.set(key, spec);
    }
    if (l.intensity?.length) spec.own = true;
  }
  return [...out.values()];
}

/** What runtime.load is given for an instance: its key when it is a plain widget (today's call), else its spec. */
const loadSpec = (s: InstanceSpec): string | InstanceSpec => (s.own || s.listen !== undefined ? s : s.key);

/** The instance keys of a show in first-appearance order (a widget's id when it listens to all notes). */
export function showWidgets(show: Show): string[] {
  return showInstances(show).map((s) => s.key);
}

/** The layer a slot carries, or undefined when the instance has no curve, region or glide (today's path). */
function slotLayer(w: ScheduledWidget): SlotLayer | undefined {
  if (!w.pivots && !w.region && !w.glide) return undefined;
  const layer: SlotLayer = {};
  if (w.pivots) { layer.pivots = w.pivots; if (w.until !== undefined) layer.until = w.until; }
  if (w.region) layer.region = w.region;
  if (w.glide) layer.glide = w.glide;
  return layer;
}

/** ctx.moment for section i: lewitt opens a new wall when it changes, so every section has its own, labels or not. */
export const momentOf = (show: Show, i: number): string => `${i}:${show.sections[i]?.label ?? ''}`;

const EMPTY: Record<string, KnobSetting> = {};

/** How a paused preview builds its picture: `seconds` of the song before t, in steps of 1/hz s. */
export interface Warmup { seconds: number; hz: number }
/** A paused seek, at once (also while scrubbing): one second at the display's pace. */
export const QUICK: Warmup = { seconds: 1, hz: 60 };
/** Once the playhead rests: widgets that build their picture over time (Kandinsky, the current) get four seconds, in
    steps of 1/20 s, the longest step live playing takes, so it costs little more than QUICK. */
export const SETTLED: Warmup = { seconds: 4, hz: 20 };

/** The steps preview(t, w) takes: reset at t0 = t − w.seconds (not before 0), then steps of about 1/w.hz up to t. */
function previewSteps(t: number, w: Warmup): { t0: number; times: number[] } {
  const t0 = Math.max(0, t - w.seconds);
  if (!(t > t0)) return { t0, times: [] };
  const n = Math.max(1, Math.round((t - t0) * w.hz));
  return { t0, times: Array.from({ length: n }, (_, i) => t0 + ((t - t0) * (i + 1)) / n) };
}

/** What the widgets are given at x: who plays, attacking or not, how strongly, with which knobs, what they hear,
    where and how intensely, and whether they keep their own pulse (own is show-wide: a curve added anywhere changes
    how the instance feels the music everywhere). */
const scheduleKey = (show: Show, x: number, own: ReadonlySet<string>) => JSON.stringify(scheduleAt(show, x).map((w) =>
  [w.id, w.receiving, w.weight, w.knobs, w.listen, own.has(w.id), slotLayer(w)]));
const ownKeys = (show: Show): Set<string> => new Set(showInstances(show).filter((s) => s.own).map((s) => s.key));

/** Would preview(t) (QUICK or SETTLED) draw the same picture for show b as for show a? It compares what the Conductor would hand the
    runtime at the reset and at every preview step (and who it resets on the way), so an edit to a section the preview
    does not reach, a split at t or a new name leaves a paused picture as it is. Moments are left out: a new name or a
    split only renumbers them. */
export function samePreview(a: Show, b: Show, t: number): boolean {
  if (a === b) return true;
  const ownA = ownKeys(a), ownB = ownKeys(b);
  for (const w of [QUICK, SETTLED]) {
    const { t0, times } = previewSteps(t, w);
    for (const x of [t0, ...times]) if (scheduleKey(a, x, ownA) !== scheduleKey(b, x, ownB)) return false;
    if (JSON.stringify(entriesBetween(a, t0, t)) !== JSON.stringify(entriesBetween(b, t0, t))) return false;
  }
  return true;
}

export class Conductor implements Stepper {
  private show: Show;
  private lastT = 0;
  private section = -1;
  /** Widgets drawn in the last step: a decaying widget only goes on if it was drawn (nothing decays after a seek). */
  private drawn = new Set<string>();
  /** The knob settings each instance has in the runtime now. */
  private applied = new Map<string, string>();
  /** What the runtime was loaded with, per instance key (JSON of loadSpec). */
  private loaded = new Map<string, string>();
  /** instance key → widget id, for the widget's knobs. */
  private widgetOf = new Map<string, string>();

  /** meta: by widget id. */
  constructor(private readonly rt: ShowRuntime, show: Show, private readonly meta: (widget: string) => WidgetMeta | undefined) {
    this.show = show;
    const specs = showInstances(show);
    this.load(specs);
    for (const s of specs) {
      const l = show.sections.flatMap((x) => x.layers).find((x) => instanceKey(x) === s.key);
      this.applyKnobs(s.key, l?.knobs ?? EMPTY);
    }
  }

  get current(): Show { return this.show; }

  /** Live edit: loads new widgets, updates knobs in place, never resets the picture. */
  setShow(show: Show): void {
    this.show = show;
    this.load(showInstances(show));
    const sec = sectionAt(show, this.lastT);
    if (sec !== this.section) { this.section = sec; this.rt.setMoment(momentOf(show, sec)); }
    for (const w of scheduleAt(show, this.lastT)) this.applyKnobs(w.id, w.knobs);
  }

  /** Seek: the picture starts again at t; only the section at t plays. */
  reset(t: number): void {
    const show = this.show;
    this.section = sectionAt(show, t);
    this.rt.setMoment(momentOf(show, this.section));   // before reset(): lewitt's reset() remembers the moment
    this.rt.reset(t);
    this.lastT = t;
    const sched = scheduleAt(show, t).filter((w) => w.receiving);
    this.drawn = new Set(sched.map((w) => w.id));
    for (const w of sched) this.applyKnobs(w.id, w.knobs);
  }

  step(t: number, dt: number): void {
    const show = this.show;
    for (const e of entriesBetween(show, this.lastT, t)) this.rt.resetWidget(e.id);
    const sec = sectionAt(show, t);
    if (sec !== this.section) { this.section = sec; this.rt.setMoment(momentOf(show, sec)); }
    const sched: ScheduledWidget[] = scheduleAt(show, t).filter((w) => w.receiving || this.drawn.has(w.id));
    const slots: ShowSlot[] = [];
    for (const w of sched) {
      this.applyKnobs(w.id, w.knobs);
      const slot: ShowSlot = { id: w.id, receiving: w.receiving, weight: w.weight }, layer = slotLayer(w);
      if (layer) slot.layer = layer;
      slots.push(slot);
    }
    this.rt.step(t, dt, slots);
    this.drawn = new Set(slots.map((s) => s.id));
    this.lastT = t;
  }

  /** A paused seek: reset(t − w.seconds), then steps of 1/w.hz s up to t, so the picture at t shows. QUICK (one second,
      60 steps) by default. */
  preview(t: number, w: Warmup = QUICK): void {
    const { t0, times } = previewSteps(t, w);
    this.reset(t0);
    let last = t0;
    for (const x of times) { this.step(x, x - last); last = x; }
  }

  /** Loads the instances new to the runtime, and those whose spec changed (a curve added makes one own): the specs
      in first-appearance order, a plain widget as its id. */
  private load(specs: readonly InstanceSpec[]): void {
    const todo: (string | InstanceSpec)[] = [];
    for (const s of specs) {
      this.widgetOf.set(s.key, s.widget);
      const x = loadSpec(s), json = JSON.stringify(x);
      if (this.loaded.get(s.key) === json) continue;
      this.loaded.set(s.key, json);
      todo.push(x);
    }
    if (todo.length) this.rt.load(todo);
  }

  private applyKnobs(key: string, knobs: Record<string, KnobSetting>): void {
    const k = JSON.stringify(knobs);
    if (this.applied.get(key) === k) return;
    const m = this.meta(this.widgetOf.get(key) ?? key);
    if (!m) return;
    this.applied.set(key, k);
    this.rt.setKnobs(key, resolveKnobs(m.params, knobs));
  }
}
