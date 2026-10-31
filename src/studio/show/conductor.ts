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

  /** A paused seek: reset(t − 1), then 60 steps of 1/60 s, so the picture at t shows. */
  preview(t: number): void {
    const t0 = Math.max(0, t - 1), n = 60, d = (t - t0) / n;
    this.reset(t0);
    if (!(d > 0)) return;
    for (let i = 1; i <= n; i++) this.step(t0 + ((t - t0) * i) / n, d);
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
