/**
 * A show on the widget runtime: at every step it asks the pure scheduler which clips play and how strongly, resets the
 * ones starting in that step, sets the moment from the song's structure, and hands the runtime its slots. Every clip is an
 * instance of its own, loaded at once, in the order a show is saved, so the studio and the render page load alike. Live
 * (startLive), in render pages (exposeRenderApi) and paused previews all go through reset() and step().
 */
import type { Stepper } from '../../widgets/driver';
import { resolveKnobs } from '../../widgets/features';
import type { RuntimeLike, Slot } from '../../widgets/runtime';
import type { InstanceSpec, SlotLayer, WidgetMeta } from '../../widgets/types';
import { clipsAt, entriesBetween, scheduleAt, type ScheduledWidget } from './schedule';
import { instanceKey, listenOf, picksId, sortedClips, widgetOfKey, type KnobSetting, type Show } from './show';

/** A slot with its layer. */
export type ShowSlot = Slot & { layer?: SlotLayer };
/** What the Conductor needs of a runtime: RuntimeLike, with load taking instance specs and slots their layers (§6). */
export interface ShowRuntime extends Omit<RuntimeLike, 'load' | 'step'> {
  load(specs: readonly (string | InstanceSpec)[]): void;
  step(t: number, dt: number, slots: readonly ShowSlot[]): void;
}

/** The instances of a show, one per clip, in the order a show is saved. own: it listens to a part or has a curve.
    notes: a set of picks' notes, so a pick is the note itself and needs no song to look it up in; none for a missing set. */
export function showInstances(show: Show): InstanceSpec[] {
  return sortedClips(show.clips).map((c) => {
    const listen = listenOf(c), id = picksId(listen);
    return { key: instanceKey(c), widget: c.widget, ...(listen !== undefined ? { listen } : {}), own: listen !== undefined || !!c.intensity?.length,
      ...(id !== null ? { notes: show.picks?.[id]?.notes ?? [] } : {}) };
  });
}

/** The instance keys of a show, in that order. */
export function showWidgets(show: Show): string[] {
  return showInstances(show).map((s) => s.key);
}

/** The layer a slot carries, or undefined when the clip has no curve and no region (today's path). */
function slotLayer(w: ScheduledWidget): SlotLayer | undefined {
  if (!w.pivots && !w.region) return undefined;
  const layer: SlotLayer = {};
  if (w.pivots) layer.pivots = w.pivots;
  if (w.region) layer.region = w.region;
  return layer;
}

/** ctx.moment at t: which of the song's structure marks it is past (their times, sorted). lewitt opens a new wall when it
    changes. A function of the time alone, like everything a clip is handed. */
export function momentAt(marks: readonly number[], t: number): string {
  let i = 0;
  while (i < marks.length && marks[i] <= t) i++;
  return String(i);
}

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

/** What the widgets are given at x: who plays, how strongly, with which knobs, what they hear, where and how intensely. */
const scheduleKey = (show: Show, x: number, own: ReadonlySet<string>) => JSON.stringify(scheduleAt(show, x).map((w) =>
  [w.id, w.weight, w.knobs, w.listen, own.has(w.id), slotLayer(w)]));
const ownKeys = (show: Show): Set<string> => new Set(showInstances(show).filter((s) => s.own).map((s) => s.key));

/** Would preview(t) (QUICK or SETTLED) draw the same picture for show b as for show a? It compares what the Conductor would
    hand the runtime at the reset and at every preview step (and who it resets on the way), so an edit to a clip the preview
    does not reach leaves a paused picture as it is. Picks are not in the schedule, so any change of them counts. */
export function samePreview(a: Show, b: Show, t: number): boolean {
  if (a === b) return true;
  if (a.picks !== b.picks && JSON.stringify(a.picks) !== JSON.stringify(b.picks)) return false;
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
  private moment = '';
  /** The knob settings each instance has in the runtime now. */
  private applied = new Map<string, string>();
  /** What the runtime was loaded with, per instance key (JSON of loadSpec). */
  private loaded = new Map<string, string>();
  /** instance key → widget id, for the widget's knobs. */
  private widgetOf = new Map<string, string>();

  /** meta: by widget id. marks: the times of the song's structure marks, sorted: what ctx.moment follows. */
  constructor(private readonly rt: ShowRuntime, show: Show, private readonly meta: (widget: string) => WidgetMeta | undefined,
    private readonly marks: readonly number[] = []) {
    this.show = show;
    const specs = showInstances(show);
    this.load(specs);
    for (const c of show.clips) this.applyKnobs(instanceKey(c), c.knobs ?? EMPTY);
  }

  get current(): Show { return this.show; }

  /** Live edit: loads new clips, updates knobs in place, never resets the picture, but for a clip that was not playing at
      this time and now is (added, or moved here): it starts as a clip starts, with its reset. */
  setShow(show: Show): void {
    const was = new Set(clipsAt(this.show, this.lastT).map(instanceKey));
    this.show = show;
    this.load(showInstances(show));
    for (const c of clipsAt(show, this.lastT)) if (!was.has(instanceKey(c))) this.rt.resetWidget(instanceKey(c));
    for (const w of scheduleAt(show, this.lastT)) this.applyKnobs(w.id, w.knobs);
  }

  /** Seek: the picture starts again at t. */
  reset(t: number): void {
    const show = this.show;
    this.setMomentAt(t);   // before reset(): lewitt's reset() remembers the moment
    this.rt.reset(t);
    this.lastT = t;
    for (const w of scheduleAt(show, t)) this.applyKnobs(w.id, w.knobs);
  }

  step(t: number, dt: number): void {
    const show = this.show;
    for (const e of entriesBetween(show, this.lastT, t)) this.rt.resetWidget(e.id);
    this.setMomentAt(t);
    const slots: ShowSlot[] = [];
    for (const w of scheduleAt(show, t)) {
      this.applyKnobs(w.id, w.knobs);
      const slot: ShowSlot = { id: w.id, receiving: w.receiving, weight: w.weight }, layer = slotLayer(w);
      if (layer) slot.layer = layer;
      slots.push(slot);
    }
    this.rt.step(t, dt, slots);
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

  private setMomentAt(t: number): void {
    const m = momentAt(this.marks, t);
    if (m !== this.moment) { this.moment = m; this.rt.setMoment(m); }
  }

  /** Loads the instances new to the runtime, and those whose spec changed (a curve added makes one own). Always as specs:
      an instance key is not a widget id. */
  private load(specs: readonly InstanceSpec[]): void {
    const todo: InstanceSpec[] = [];
    for (const s of specs) {
      this.widgetOf.set(s.key, s.widget);
      const json = JSON.stringify(s);
      if (this.loaded.get(s.key) === json) continue;
      this.loaded.set(s.key, json);
      todo.push(s);
    }
    if (todo.length) this.rt.load(todo);
  }

  private applyKnobs(key: string, knobs: Record<string, KnobSetting>): void {
    const k = JSON.stringify(knobs);
    if (this.applied.get(key) === k) return;
    const m = this.meta(this.widgetOf.get(key) ?? widgetOfKey(key));
    if (!m) return;
    this.applied.set(key, k);
    this.rt.setKnobs(key, resolveKnobs(m.params, knobs));
  }
}
