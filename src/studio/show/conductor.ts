/**
 * A show on the widget runtime (plan §5): at every step it asks the pure scheduler which widgets play, which take
 * attacks and which decay, resets the ones entering at a boundary it crossed, switches knobs and the moment at section
 * changes, and hands the runtime its slots. Live (startLive), in render pages (exposeRenderApi) and paused previews
 * all go through reset() and step().
 */
import type { Stepper } from '../../widgets/driver';
import { resolveKnobs } from '../../widgets/features';
import type { RuntimeLike, Slot } from '../../widgets/runtime';
import type { WidgetMeta } from '../../widgets/types';
import { entriesBetween, scheduleAt, sectionAt, type ScheduledWidget } from './schedule';
import type { KnobSetting, Show } from './show';

/** The widgets of a show in first-appearance order. */
export function showWidgets(show: Show): string[] {
  const out: string[] = [];
  for (const s of show.sections) for (const l of s.layers) if (!out.includes(l.widget)) out.push(l.widget);
  return out;
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

/** What the widgets are given at x: who plays, attacking or not, how strongly, with which knobs. */
const scheduleKey = (show: Show, x: number) => JSON.stringify(scheduleAt(show, x).map((w) => [w.id, w.receiving, w.weight, w.knobs]));

/** Would preview(t) (QUICK or SETTLED) draw the same picture for show b as for show a? It compares what the Conductor would hand the
    runtime at the reset and at every preview step (and who it resets on the way), so an edit to a section the preview
    does not reach, a split at t or a new name leaves a paused picture as it is. Moments are left out: a new name or a
    split only renumbers them. */
export function samePreview(a: Show, b: Show, t: number): boolean {
  if (a === b) return true;
  for (const w of [QUICK, SETTLED]) {
    const { t0, times } = previewSteps(t, w);
    for (const x of [t0, ...times]) if (scheduleKey(a, x) !== scheduleKey(b, x)) return false;
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
  /** The knob settings each widget has in the runtime now. */
  private applied = new Map<string, string>();

  constructor(private readonly rt: RuntimeLike, show: Show, private readonly meta: (id: string) => WidgetMeta | undefined) {
    this.show = show;
    const ids = showWidgets(show);
    rt.load(ids);
    for (const id of ids) {
      const l = show.sections.flatMap((s) => s.layers).find((x) => x.widget === id);
      this.applyKnobs(id, l?.knobs ?? EMPTY);
    }
  }

  get current(): Show { return this.show; }

  /** Live edit: loads new widgets, updates knobs in place, never resets the picture. */
  setShow(show: Show): void {
    const known = new Set(showWidgets(this.show));
    this.show = show;
    const fresh = showWidgets(show).filter((id) => !known.has(id));
    if (fresh.length) this.rt.load(fresh);
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
    const slots: Slot[] = [];
    for (const w of sched) { this.applyKnobs(w.id, w.knobs); slots.push({ id: w.id, receiving: w.receiving, weight: w.weight }); }
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

  private applyKnobs(id: string, knobs: Record<string, KnobSetting>): void {
    const key = JSON.stringify(knobs);
    if (this.applied.get(id) === key) return;
    const m = this.meta(id);
    if (!m) return;
    this.applied.set(id, key);
    this.rt.setKnobs(id, resolveKnobs(m.params, knobs));
  }
}
